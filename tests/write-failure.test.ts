import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Une panne d'ecriture arrive jusqu'a un abonne.
 *
 * ## 🔴 Le defaut que ce fichier garde, et il n'etait pas dans le code
 *
 * `onFailure` a ete ajoute le 2026-08-11, documente, teste (`idempotence.test.ts`), et
 * propage jusqu'a `socialFrom`. Mesure le 2026-08-16 : **aucun appelant ne le passait**. Un
 * rappel sans abonne est un rappel qui n'existe pas, et les tests d'alors etaient verts —
 * ils verifiaient que le client *appelle* le rappel qu'on lui donne, jamais que quelqu'un
 * lui en donne un.
 *
 * ⚠️ **C'est donc le cablage qui est teste ici, pas le mecanisme.** La difference est
 * exactement celle qui a laisse passer trois fonctionnalites mortes en silence (lot 10.0,
 * `017`, la carte des abandons) : chacune avait du code juste, et personne au bout du fil.
 */

const OK = () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('le canal des pannes d ecriture', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://exemple.test';
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'cle-anonyme';
  });

  afterEach(() => {
    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    vi.unstubAllGlobals();
  });

  it('🔴 un client construit par socialFrom a un abonne, sans que l appelant y pense', async () => {
    // Le coeur du defaut : les douze appelants ecrivent `socialFrom(accessToken)` et rien
    // de plus. Si le cablage n'est pas le DEFAUT, il n'a jamais lieu.
    const { socialFrom } = await import('@/app/social/socialFrom');
    const { onWriteFailure } = await import('@/app/social/failures');

    const seen: string[] = [];
    const off = onWriteFailure((failure) => seen.push(failure.where));

    vi.stubGlobal('fetch', async () => new Response('nope', { status: 403 }));
    const social = socialFrom('jeton');
    expect(social).toBeDefined();

    await social?.follow('moi', 'toi');

    expect(seen).toEqual(['follows']);
    off();
  });

  it('une lecture ratee ne remonte PAS a la banniere', async () => {
    // Elle a deja son ecran — `EmptyState status`, et `FriendsFeed` distingue « rien a
    // lire » de « je n'ai pas pu lire ». Une banniere en plus serait du bruit sur chaque
    // chargement d'un reseau capricieux, c'est-a-dire la meilleure facon de la faire
    // ignorer le jour ou elle dit quelque chose.
    const { socialFrom } = await import('@/app/social/socialFrom');
    const { onWriteFailure } = await import('@/app/social/failures');

    const seen: string[] = [];
    const off = onWriteFailure((failure) => seen.push(failure.where));

    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    await socialFrom('jeton')?.feed();

    expect(seen).toEqual([]);
    off();
  });

  it('un abonne qui leve ne prive pas les autres', async () => {
    const { reportFailure, onWriteFailure } = await import('@/app/social/failures');

    const seen: string[] = [];
    const offBad = onWriteFailure(() => {
      throw new Error('cet abonne est casse');
    });
    const offGood = onWriteFailure((failure) => seen.push(failure.where));

    expect(() => reportFailure('activity', 403, 'write')).not.toThrow();
    expect(seen).toEqual(['activity']);
    offBad();
    offGood();
  });

  it('se desabonner arrete vraiment de recevoir', async () => {
    // Sans ca, un composant demonte garderait une reference et re-rendrait un etat mort —
    // la fuite classique d'un canal global.
    const { reportFailure, onWriteFailure } = await import('@/app/social/failures');

    const seen: string[] = [];
    const off = onWriteFailure((failure) => seen.push(failure.where));
    off();
    reportFailure('reviews', 403, 'write');

    expect(seen).toEqual([]);
  });

  it('un appelant peut toujours donner le sien, et il remplace le commun', async () => {
    const { socialFrom } = await import('@/app/social/socialFrom');
    const { onWriteFailure } = await import('@/app/social/failures');

    const commun: string[] = [];
    const propre: string[] = [];
    const off = onWriteFailure((failure) => commun.push(failure.where));

    vi.stubGlobal('fetch', async () => new Response('nope', { status: 403 }));
    await socialFrom('jeton', (where) => propre.push(where))?.follow('moi', 'toi');

    expect(propre).toEqual(['follows']);
    expect(commun).toEqual([]);
    off();
  });

  it('la garde voit bien ce qu elle vise', async () => {
    // Sans cet ancrage, un `fetch` qui repondrait 200 rendrait ces tests verts pour
    // toujours — le defaut le plus courant des tests qui verifient une absence.
    const { socialFrom } = await import('@/app/social/socialFrom');
    const { onWriteFailure } = await import('@/app/social/failures');

    const seen: string[] = [];
    const off = onWriteFailure((failure) => seen.push(failure.where));

    vi.stubGlobal('fetch', OK);
    await socialFrom('jeton')?.follow('moi', 'toi');

    expect(seen).toEqual([]);
    off();
  });
});

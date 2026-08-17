import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialClient } from '../src/social/client';
import { EMPTY_JOURNAL, mergeJournals, setShareTags, setTag } from '../src/domain/journal';

/**
 * Les mots publies — F11, et **le consentement avant tout le reste**.
 *
 * ## 🔴 Ce que ce fichier protege
 *
 * `Tags.tsx` a promis pendant neuf lots, a l'ecran : *« vos mots, ranges par vous, pour
 * vous »*. Les publier par defaut romprait cette promesse **retroactivement**, sur du texte
 * ecrit quand il etait promis prive. Le champ `shareTags` nomme donc l'ACCORD et non le
 * refus — l'inverse exact de `keepStopsPrivate`, dont la documentation explique pourquoi
 * contribuer y est le defaut : ce qui part est anonyme et illisible.
 *
 * ⚠️ Le test qui compte est le second : **rien ne part sans accord**. C'est la seule faute de
 * ce lot qui ne se rattrape pas — une fois les mots en ligne, ils ont ete lus.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

function spying() {
  const seen: { url: string; method: string; body: string }[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    seen.push({
      url: String(input),
      method: String(init?.method ?? 'GET'),
      body: String(init?.body ?? ''),
    });
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { seen, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

describe('publishTags — un etat, ecrit par suppression puis insertion', () => {
  it('efface les siens avant de reinserer', async () => {
    const { seen, client } = spying();
    await client.publishTags('moi', [
      { subject: 'tmdb:1396', tag: 'le dimanche', title: 'Breaking Bad' },
    ]);

    expect(seen.map((one) => one.method)).toEqual(['DELETE', 'POST']);
    // ⚠️ Le `DELETE` est borne a soi dans l'URL **et** par `tags_delete` dans la base. Sans
    // la seconde borne, republier ses mots viderait la table de tout le monde.
    expect(seen[0]?.url).toContain('tags?user_id=eq.moi');
    // ⚠️ Jamais `merge-duplicates` : ce chemin emprunte `UPDATE`, que cette table n'a
    // volontairement pas — c'est ce qui a rendu 42501 en silence le 2026-08-11.
    expect(seen[1]?.body).toContain('le dimanche');
  });

  it('🔴 sans un seul mot, efface quand meme — et n’insere rien', async () => {
    // Retirer son dernier mot doit le retirer du profil. Une condition `length > 0` laisserait
    // l'ancien vocabulaire en ligne pour toujours : c'est la difference entre un fait et un
    // etat, et c'est la lecon des quatre epinglees.
    const { seen, client } = spying();
    await client.publishTags('moi', []);

    expect(seen.map((one) => one.method)).toEqual(['DELETE']);
  });
});

describe('la fusion de deux appareils', () => {
  it('🔴 le SILENCE gagne, a l’inverse du refus de la carte des abandons', async () => {
    // `keepStopsPrivate` nomme un refus : `a || b`, le refus l'emporte. `shareTags` nomme un
    // accord : `a && b`, le silence l'emporte. Recopier la premiere regle ici republierait
    // les mots qu'on vient de reprendre sur l'autre appareil.
    const accepte = setShareTags(EMPTY_JOURNAL, true);
    const muet = EMPTY_JOURNAL;

    expect(mergeJournals(accepte, muet).shareTags).toBeUndefined();
    expect(mergeJournals(muet, accepte).shareTags).toBeUndefined();
    expect(mergeJournals(accepte, accepte).shareTags).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Le cablage : rien ne part sans accord
// ---------------------------------------------------------------------------

const envois = vi.hoisted(() => ({ tags: [] as unknown[][], pins: [] as unknown[][] }));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: { userId: 'moi', accessToken: 'jeton' },
  }),
}));

vi.mock('@/app/social/socialFrom', () => ({
  socialFrom: () => ({
    publish: async () => true,
    publishStops: async () => true,
    publishFavorites: async (_id: string, items: unknown[]) => {
      envois.pins.push(items);
      return true;
    },
    publishTags: async (_id: string, items: unknown[]) => {
      envois.tags.push(items);
      return true;
    },
    // ⚠️ Ajoutee le 2026-08-18 avec la lecture qui evite deux ecritures par page vue : le
    // composant demande d'abord au serveur ce qu'il porte. Un double qui l'ignore fait
    // lever l'effet — et c'est ce que ces tests ont attrape immediatement.
    tagsBy: async () => [],
    forgetStops: async () => true,
  }),
}));

const { PublishActivity } = await import('@/app/components/PublishActivity');
const { serializeJournal } = await import('@/src/domain/journal');
const { STORAGE_KEY } = await import('@/src/journal/local');

/** Un journal avec un mot pose, accord donne ou non. */
function journalWithWord(share: boolean) {
  const tagged = setTag(EMPTY_JOURNAL, 'tmdb:1396', 'le dimanche', true);
  return share ? setShareTags(tagged, true) : tagged;
}

beforeEach(() => {
  envois.tags = [];
  envois.pins = [];
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PublishActivity et les mots', () => {
  it('🔴 n’envoie RIEN tant que l’accord n’est pas donne', async () => {
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(journalWithWord(false)));
    render(<PublishActivity />);
    await vi.advanceTimersByTimeAsync(6_000);

    // ⚠️ **Pas un seul appel**, et c'est plus fort qu'un appel au tableau vide.
    //
    // La premiere version envoyait `[]`, ce qui etait defendable en principe — un etat vide
    // retire ce qui a ete publie avant — et coutait en pratique un `DELETE` par chargement de
    // page a tout le monde. Mesure du 2026-08-17 : deux suppressions par page vue, pour un
    // compte qui n'a jamais rien partage. Publier le vide au MONTAGE ne peut que detruire ;
    // il n'a de sens qu'en transition, et c'est ce que le test suivant garde.
    expect(envois.tags).toEqual([]);
    expect(envois.pins).toEqual([]);
  });

  it('🔴 mais retire bien ce qui a ete publie, quand l’etat DEVIENT vide', async () => {
    // Le cas que la clause doit garder : on partage un mot, puis on le retire. Sans le second
    // envoi, le profil montrerait un mot que la personne vient d'effacer.
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(journalWithWord(true)));
    render(<PublishActivity />);
    for (let i = 0; i < 6 && envois.tags.length === 0; i += 1) {
      await vi.advanceTimersByTimeAsync(5_000);
    }
    expect(envois.tags.flat()).toHaveLength(1);

    // Le mot disparait du journal, l'accord reste donne.
    const sansMot = setShareTags(EMPTY_JOURNAL, true);
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(sansMot));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    for (let i = 0; i < 6 && envois.tags.length < 2; i += 1) {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    expect(envois.tags[1], 'le retrait n’est pas parti').toEqual([]);
  });

  it('envoie le mot une fois l’accord donne, avec son instantane', async () => {
    // L'ancrage : sans lui, le test ci-dessus passerait aussi avec un composant qui
    // n'envoie jamais rien — il comparerait deux fois la meme absence.
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(journalWithWord(true)));
    render(<PublishActivity />);
    // ⚠️ Plusieurs tours, et non un seul saut de 6 s : le journal se lit d'abord (asynchrone),
    // et c'est cette lecture qui declenche l'effet qui arme le minuteur de 4 s. Un unique
    // `advanceTimersByTime` avance un minuteur qui n'est pas encore pose.
    for (let i = 0; i < 6 && envois.tags.flat().length === 0; i += 1) {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    expect(envois.tags.flat()).toEqual([{ subject: 'tmdb:1396', tag: 'le dimanche' }]);
  });
});

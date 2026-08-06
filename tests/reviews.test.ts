/**
 * Les critiques : ce qu'on ecrit, et qui peut le lire.
 *
 * Le caviardage vit dans `spoiler.ts` — `AGENTS.md` regle 7 : le filtrage est dans le
 * domaine, jamais dans la couche de rendu, sinon les agregats fuient.
 */

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { ROOT, codeOf } from './sources';
import {
  EMPTY_JOURNAL,
  MAX_REVIEW_CHARS,
  checkReview,
  hasContent,
  journalKey,
  mergeJournals,
  parseJournal,
  reviewKey,
  serializeJournal,
  setReview,
} from '../src/domain/journal';
import { redactReviews } from '../src/domain/spoiler';
import type { Position } from '../src/domain/types';

const NOW = new Date('2026-08-06T12:00:00Z');
const LATER = new Date('2026-08-07T12:00:00Z');
const BB = journalKey('1396');

const at = (seasonNumber: number): Position => ({
  at: { seriesId: '1396', seasonNumber, episodeNumber: 1 },
  declaredAt: NOW,
});

const review = (throughSeason: number, text = 'un texte') => ({ throughSeason, text });

describe('checkReview — on signale, on ne tronque pas', () => {
  it('refuse le vide et le trop long, accepte la limite exacte', () => {
    expect(checkReview('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkReview('x'.repeat(MAX_REVIEW_CHARS + 1))).toEqual({
      ok: false,
      reason: 'too_long',
    });
    expect(checkReview('x'.repeat(MAX_REVIEW_CHARS))).toEqual({ ok: true });
  });
});

describe('le caviardage', () => {
  it('une critique sans spoiler est lisible par qui n a pas commence', () => {
    // C'est le cas qui compte : l'audience d'une critique est celle qui hesite encore.
    const [out] = redactReviews([review(0)], undefined);
    expect(out?.hidden).toBeUndefined();
    expect(out?.text).toBe('un texte');
  });

  it('une critique avec spoiler est masquee a qui n a pas commence', () => {
    // Defaut strict, comme `isBeyondPosition` : mieux vaut masquer a tort que spoiler.
    const [out] = redactReviews([review(3)], undefined);
    expect(out?.hidden).toBe(true);
  });

  it('visible des que le lecteur a atteint la saison annoncee, pas avant', () => {
    expect(redactReviews([review(3)], at(2))[0]?.hidden).toBe(true);
    expect(redactReviews([review(3)], at(3))[0]?.hidden).toBeUndefined();
    expect(redactReviews([review(3)], at(4))[0]?.hidden).toBeUndefined();
  });

  it('🔴 le texte masque est DEPLACE, pas laisse en place', () => {
    // Le defaut vise : rendre le texte puis le cacher en CSS. Un `display:none` se lit dans
    // l'inspecteur, se copie, et part dans le presse-papier d'un « tout selectionner ».
    const [out] = redactReviews([review(6, 'Walt meurt a la fin')], at(2));
    expect(out?.text).toBe('');
    expect(out?.hiddenText).toBe('Walt meurt a la fin');
  });

  it('une critique masquee reste dans la liste, et garde son auteur', () => {
    // Un fil a trous est lui-meme un indice. Et le caviardage ne doit pas effacer l'auteur
    // en meme temps que le spoiler — la lecon est ecrite dans `activity.ts`.
    const out = redactReviews(
      [{ ...review(6), handle: 'marie' }, { ...review(0), handle: 'jean' }],
      at(1),
    );
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.handle)).toEqual(['marie', 'jean']);
  });
});

describe('le journal', () => {
  it('ecrit, relit et efface une critique, par serie et par saison', () => {
    let journal = setReview(EMPTY_JOURNAL, BB, reviewKey(), review(0, 'sur la serie'), NOW);
    journal = setReview(journal, BB, reviewKey(3), review(3, 'sur la saison 3'), NOW);

    expect(journal.entries[BB]?.reviews?.['series']?.text).toBe('sur la serie');
    expect(journal.entries[BB]?.reviews?.['season:3']?.throughSeason).toBe(3);
    expect(hasContent(journal.entries[BB])).toBe(true);

    // Un texte vide efface — le meme geste rejoue annule.
    const cleared = setReview(journal, BB, reviewKey(3), review(3, '  '), LATER);
    expect(cleared.entries[BB]?.reviews?.['season:3']).toBeUndefined();
    expect(cleared.entries[BB]?.reviews?.['series']?.text).toBe('sur la serie');
  });

  it('une critique effacee ne ressuscite pas a la fusion', () => {
    const written = setReview(EMPTY_JOURNAL, BB, reviewKey(), review(0), NOW);
    const cleared = setReview(written, BB, reviewKey(), review(0, ''), LATER);

    expect(mergeJournals(cleared, written).entries[BB]?.reviews?.['series']).toBeUndefined();
    expect(mergeJournals(written, cleared).entries[BB]?.reviews?.['series']).toBeUndefined();
  });

  it('survit a l aller-retour, langue comprise', () => {
    const journal = setReview(
      EMPTY_JOURNAL,
      BB,
      reviewKey(2),
      { ...review(2, 'texte'), lang: 'fr' },
      NOW,
    );
    const reread = parseJournal(serializeJournal(journal), NOW);
    expect(reread.entries[BB]?.reviews?.['season:2']).toMatchObject({
      text: 'texte',
      throughSeason: 2,
      lang: 'fr',
    });
  });

  it('une cible inconnue est ecartee a la lecture', () => {
    const raw = JSON.stringify({
      version: 3,
      entries: { [BB]: { reviews: { 'episode:3:7': { text: 'x', at: NOW.toISOString() } } } },
    });
    expect(parseJournal(raw, NOW).entries[BB]).toBeUndefined();
  });

  it('un texte deja ecrit n est jamais perdu parce qu il depasse le plafond', () => {
    // Tolerant a la lecture, strict a l'ecriture : le plafond peut baisser un jour, et un
    // texte deja ecrit ne doit pas disparaitre pour autant.
    const long = 'x'.repeat(MAX_REVIEW_CHARS + 500);
    const raw = JSON.stringify({
      version: 3,
      entries: { [BB]: { reviews: { series: { text: long, at: NOW.toISOString() } } } },
    });
    expect(parseJournal(raw, NOW).entries[BB]?.reviews?.['series']?.text).toHaveLength(
      long.length,
    );
  });
});

describe('les maillons que rien d autre ne couvre', () => {
  const sourceOf = (path: string): string => codeOf(join(ROOT, path));

  // ⚠️ Le montage des composants n'est plus verifie ici : `no-orphan-component` s'en charge
  // pour TOUS les composants a la fois, et sans se coupler a la syntaxe exacte d'une balise.
  // Ne restent que les appels qu'aucune regle generale ne peut deviner.

  it('les critiques sont publiees par le meme chemin que le fil', () => {
    // Sans cet appel, tout marche en local et rien ne sort jamais du navigateur.
    expect(sourceOf('app/components/Friends.tsx')).toMatch(/publishReview\(/);
  });

  it('la visibilite du profil est reglable, et unfollow a un appelant', () => {
    // Les deux etaient du code mort : sans elles, aucune critique n'aurait pu etre lue par
    // quelqu'un qui ne vous suit pas deja, et on ne pouvait pas cesser de suivre.
    const source = sourceOf('app/components/Friends.tsx');
    expect(source).toMatch(/client\.setVisibility\(/);
    expect(source).toMatch(/client\.unfollow\(/);
  });
});

/**
 * Les exceptions a la position : episodes sautes, episodes vus en avance.
 *
 * ## Ce que ces tests protegent, et qui n'est pas evident
 *
 * Deux modules lisent les memes marques et en tirent des conclusions de **signe oppose** —
 * `remainingAfter` compte ce qui reste, `buildTally` compte ce qui a ete vu, et il le fait
 * par soustraction. Le defaut qui en resulte est silencieux : un bilan legerement flatteur,
 * que rien dans l'interface ne contredit.
 */

import { describe, expect, it } from 'vitest';
import { projectActivity } from '../src/domain/activity';
import {
  EMPTY_JOURNAL,
  hasContent,
  journalKey,
  marksOf,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setDecision,
  setEpisodeMark,
  setEpisodeRating,
  setPosition,
  setSnapshot,
} from '../src/domain/journal';
import { classifyMarks, remainingAfter } from '../src/domain/remaining';
import { seasonToRate } from '../src/domain/nudge';
import { buildTally } from '../src/domain/tally';
import type { Journal } from '../src/domain/journal';

const NOW = new Date('2026-08-06T12:00:00Z');
const LATER = new Date('2026-08-07T12:00:00Z');
const BB = journalKey('1396');

/** Trois saisons de dix, soit trente episodes. */
const SEASONS = [
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 10 },
  { seasonNumber: 3, episodeCount: 10 },
];

const skipped = (seasonNumber: number, episodeNumber: number) =>
  ({ seasonNumber, episodeNumber, kind: 'skipped' }) as const;
const watched = (seasonNumber: number, episodeNumber: number) =>
  ({ seasonNumber, episodeNumber, kind: 'watched' }) as const;

function withPosition(season: number, episode: number): Journal {
  return setPosition(EMPTY_JOURNAL, BB, season, episode, NOW);
}

describe('ce qu il reste', () => {
  it('sans marque, le calcul est exactement celui d avant', () => {
    // L'ancrage de toute la feature : elle est additive, ou elle ne l'est pas.
    const position = { seasonNumber: 2, episodeNumber: 5 };
    expect(remainingAfter(SEASONS, position)).toEqual(
      remainingAfter(SEASONS, position, undefined, []),
    );
  });

  it('deux episodes sautes devant : deux de moins a voir', () => {
    const position = { seasonNumber: 2, episodeNumber: 10 };
    const marks = [skipped(3, 1), skipped(3, 2)];

    expect(remainingAfter(SEASONS, position)?.episodes).toBe(10);
    expect(remainingAfter(SEASONS, position, undefined, marks)?.episodes).toBe(8);
  });

  it('un episode vu en avance compte aussi en moins, et les minutes suivent', () => {
    const after = remainingAfter(SEASONS, { seasonNumber: 3, episodeNumber: 7 }, 45, [
      watched(3, 10),
    ]);
    expect(after?.episodes).toBe(2);
    expect(after?.minutes).toBe(90);
  });

  it('une marque hors catalogue est ignoree, et un doublon ne soustrait qu une fois', () => {
    // Les decoupages en saisons changent : une marque peut pointer un episode disparu.
    const marks = [skipped(9, 99), skipped(3, 10), skipped(3, 10)];
    expect(
      remainingAfter(SEASONS, { seasonNumber: 3, episodeNumber: 8 }, undefined, marks)?.episodes,
    ).toBe(1);
  });
});

describe('classifyMarks — le tri qui empeche les deux signes de diverger', () => {
  it('range chaque marque selon ce qu elle change', () => {
    const marks = [skipped(1, 3), skipped(3, 1), watched(3, 5), watched(1, 2)];
    const out = classifyMarks(marks, { seasonNumber: 2, episodeNumber: 5 });

    expect(out.skippedBefore.map((m) => m.episodeNumber)).toEqual([3]);
    expect(out.skippedAfter.map((m) => m.episodeNumber)).toEqual([1]);
    // « vu en avance » AVANT la position est redondant : le pointeur le dit deja.
    expect(out.aheadAfter.map((m) => m.episodeNumber)).toEqual([5]);
  });
});

describe('le bilan — le piege du signe inverse', () => {
  const shaped = (journal: Journal): Journal =>
    setSnapshot(journal, BB, { title: 'BB', seasonSizes: SEASONS, episodeMinutes: 45 }, NOW);

  it('un episode SAUTE ne fait pas monter les heures vues', () => {
    // Le defaut vise, et il est silencieux : `buildTally` compte par `total − restant`.
    // Passer naivement les marques a `remainingAfter` ferait baisser le restant, donc
    // MONTER le total vu — pour un episode qu'on vient de declarer ne pas avoir regarde.
    const base = shaped(withPosition(2, 5));

    expect(buildTally(base, LATER).episodes).toBe(15);
    expect(buildTally(setEpisodeMark(base, BB, 3, 1, 'skipped', LATER), LATER).episodes).toBe(15);
  });

  it('un episode saute EN DECA retire un episode du total', () => {
    // Le pointeur dit « les quinze premiers sont vus ». Si l'un d'eux a ete saute, il ne
    // l'est pas — c'est le seul cas ou une marque diminue le bilan.
    const after = buildTally(
      setEpisodeMark(shaped(withPosition(2, 5)), BB, 1, 3, 'skipped', LATER),
      LATER,
    );
    expect(after.episodes).toBe(14);
    expect(after.minutes).toBe(14 * 45);
  });

  it('un episode vu en avance ajoute au total', () => {
    const after = buildTally(
      setEpisodeMark(shaped(withPosition(2, 5)), BB, 3, 9, 'watched', LATER),
      LATER,
    );
    expect(after.episodes).toBe(16);
  });

  it('ancrage : le meme montage compte bien quelque chose sans marque', () => {
    // Sans lui, les trois tests ci-dessus pourraient comparer deux bilans vides — le
    // quatrieme faux negatif de fixture de ce depot etait exactement celui-la.
    expect(buildTally(shaped(withPosition(2, 5)), LATER).episodes).toBeGreaterThan(0);
  });
});

describe('le rappel de notation survit aux fins de saison sautees', () => {
  it('propose de noter une saison dont les deux derniers sont sautes', () => {
    // Sans cela, sauter la fin d'une saison ferait disparaitre DEFINITIVEMENT son rappel :
    // la position ne l'atteindrait jamais, et rien ne le signalerait.
    const position = { seasonNumber: 1, episodeNumber: 8 };
    const marks = [skipped(1, 9), skipped(1, 10)];

    expect(seasonToRate(SEASONS, position, new Set())).toBeUndefined();
    expect(seasonToRate(SEASONS, position, new Set(), marks)).toBe(1);
  });

  it('mais pas si un episode du milieu manque encore', () => {
    const position = { seasonNumber: 1, episodeNumber: 8 };
    expect(seasonToRate(SEASONS, position, new Set(), [skipped(1, 10)])).toBeUndefined();
  });
});

describe('le journal', () => {
  it('un episode ne peut pas etre saute ET vu en avance', () => {
    // Exclusion mutuelle VRAIE PAR CONSTRUCTION : un seul enregistrement par episode.
    let journal = setEpisodeMark(EMPTY_JOURNAL, BB, 3, 4, 'skipped', NOW);
    journal = setEpisodeMark(journal, BB, 3, 4, 'watched', LATER);

    expect(marksOf(journal.entries[BB])).toEqual([
      { seasonNumber: 3, episodeNumber: 4, kind: 'watched' },
    ]);
  });

  it('effacer une NOTE d episode n efface pas la MARQUE du meme episode', () => {
    // Le piege : la pierre tombale `episode:3:4` est deja prise par la note. Reutiliser ce
    // prefixe pour la marque ferait qu'un geste en efface deux, silencieusement.
    let journal = setEpisodeMark(EMPTY_JOURNAL, BB, 3, 4, 'skipped', NOW);
    journal = setEpisodeRating(journal, BB, 3, 4, 4, NOW);
    const before = journal;
    journal = setEpisodeRating(journal, BB, 3, 4, undefined, LATER);

    expect(journal.entries[BB]?.episodeRatings?.['3:4']).toBeUndefined();
    expect(journal.entries[BB]?.episodeMarks?.['3:4']?.kind).toBe('skipped');

    // Et apres fusion avec l'appareil qui portait encore la note.
    const merged = mergeJournals(journal, before);
    expect(merged.entries[BB]?.episodeRatings?.['3:4']).toBeUndefined();
    expect(merged.entries[BB]?.episodeMarks?.['3:4']?.kind).toBe('skipped');
  });

  it('une marque retiree ne ressuscite pas a la fusion, dans les deux sens', () => {
    const marked = setEpisodeMark(EMPTY_JOURNAL, BB, 3, 4, 'skipped', NOW);
    const cleared = setEpisodeMark(marked, BB, 3, 4, undefined, LATER);

    expect(mergeJournals(cleared, marked).entries[BB]?.episodeMarks?.['3:4']).toBeUndefined();
    expect(mergeJournals(marked, cleared).entries[BB]?.episodeMarks?.['3:4']).toBeUndefined();
  });

  it('une entree qui n a qu une marque survit a l aller-retour', () => {
    const journal = setEpisodeMark(EMPTY_JOURNAL, BB, 2, 7, 'skipped', NOW);
    expect(hasContent(journal.entries[BB])).toBe(true);
    expect(
      parseJournal(serializeJournal(journal), NOW).entries[BB]?.episodeMarks?.['2:7']?.kind,
    ).toBe('skipped');
  });

  it('un genre de marque inconnu est ecarte, pas devine', () => {
    const raw = JSON.stringify({
      version: 3,
      entries: { [BB]: { episodeMarks: { '2:7': { kind: 'teleporte', at: NOW.toISOString() } } } },
    });
    expect(parseJournal(raw, NOW).entries[BB]).toBeUndefined();
  });

  it('les marques ne sont PAS publiees dans le fil', () => {
    // Publier un saut revelerait la position fine, ce que la projection refuse par
    // conception. Ancrage d'abord : le meme journal publie bien autre chose.
    let journal = setDecision(withPosition(2, 5), BB, 'continuing', NOW);
    journal = setEpisodeMark(journal, BB, 3, 1, 'skipped', NOW);

    const kinds = projectActivity(journal, NOW).map((item) => item.kind);
    expect(kinds).toContain('started');
    expect(kinds.join(',')).not.toContain('skip');
  });
});

describe('le maillon que rien d autre ne couvre', () => {
  it('MyProgress passe bien les marques a remainingAfter ET a seasonToRate', async () => {
    // Une fonctionnalite ecrite n'est pas une fonctionnalite qui marche. Les 17 tests
    // ci-dessus prouvent le calcul ; aucun ne prouve que l'ecran l'APPELLE. C'est le trou
    // exact par lequel `ordering.ts` et `episodeMinutes` ont ete livres morts-nes, et le
    // meme procede que le test qui a rattrape `SeriesOrderings` : on lit la source.
    const { join } = await import('node:path');
    const { ROOT, codeOf } = await import('./sources');
    const source = codeOf(join(ROOT, 'app/components/MyProgress.tsx'));

    // ⚠️ On verifie que `marks` est PASSE, sans figer l'ordre ni le nom des autres
    // arguments : un test couple a une signature casse au premier renommage, pour un
    // produit qui marche toujours.
    expect(source).toMatch(/remainingAfter\([^)]*\bmarks\b[^)]*\)/);
    expect(source).toMatch(/seasonToRate\([^)]*\bmarks\b[^)]*\)/);
  });
});

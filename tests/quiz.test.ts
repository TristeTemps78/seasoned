import { describe, expect, it } from 'vitest';

import { buildQuiz } from '../src/domain/quiz';
import { EMPTY_JOURNAL, type Journal, type JournalKey } from '../src/domain/journal';

const NOW = new Date('2026-08-10T12:00:00Z');

/** Un journal fabrique a la main : on veut controler les dates ET la marque d'import. */
function journalOf(
  series: readonly {
    readonly key: string;
    readonly title?: string;
    readonly declaredAt?: string;
    readonly imported?: boolean;
    /** Les notes de saison, dans l'ordre : `[4, 3.5, 5]` = S1 a S3. */
    readonly seasons?: readonly number[];
    /** Les notes d'episode d'UNE saison : `{ season: 2, stars: [4, 3, 5, 4, 4] }`. */
    readonly episodes?: { readonly season: number; readonly stars: readonly number[] };
  }[],
): Journal {
  const entries: Record<string, unknown> = {};
  for (const one of series) {
    const ratings: Record<string, unknown> = {};
    for (const [index, stars] of (one.seasons ?? []).entries()) {
      ratings[String(index + 1)] = {
        stars,
        at: '2026-01-15T20:00:00Z',
        ...(one.imported === true ? { origin: 'import' as const } : {}),
      };
    }
    const episodeRatings: Record<string, unknown> = {};
    for (const [index, stars] of (one.episodes?.stars ?? []).entries()) {
      episodeRatings[`${one.episodes?.season}:${index + 1}`] = {
        stars,
        at: '2026-01-15T20:00:00Z',
        ...(one.imported === true ? { origin: 'import' as const } : {}),
      };
    }
    entries[one.key] = {
      ...(one.title === undefined ? {} : { snapshot: { title: one.title } }),
      ...(one.seasons === undefined ? {} : { seasonRatings: ratings }),
      ...(one.episodes === undefined ? {} : { episodeRatings }),
      ...(one.declaredAt === undefined
        ? {}
        : {
            position: {
              seasonNumber: 1,
              episodeNumber: 1,
              declaredAt: one.declaredAt,
              ...(one.imported === true ? { origin: 'import' as const } : {}),
            },
          }),
    };
  }
  return { ...EMPTY_JOURNAL, entries } as unknown as Journal;
}

/** Retire la date plutot que de la poser a `undefined` : `exactOptionalPropertyTypes`. */
function sansDate<T extends { declaredAt?: string }>(one: T): Omit<T, 'declaredAt'> {
  const { declaredAt: _ignore, ...reste } = one;
  return reste;
}

const QUATRE = [
  { key: 'tmdb:1', title: 'Dark', declaredAt: '2026-01-07T20:00:00Z' },
  { key: 'tmdb:2', title: 'Severance', declaredAt: '2026-02-11T20:00:00Z' },
  { key: 'tmdb:3', title: 'The Leftovers', declaredAt: '2026-03-02T20:00:00Z' },
  { key: 'tmdb:4', title: 'Breaking Bad', declaredAt: '2026-04-05T20:00:00Z' },
];

/**
 * ⚠️ Ancrage. Sans lui, tous les tests de silence passeraient en comparant `undefined` a
 * `undefined` sans qu'aucune question n'ait jamais pu etre construite.
 */
describe('ancrage', () => {
  it('construit bien une question quand la matiere est la', () => {
    const quiz = buildQuiz(journalOf(QUATRE), NOW, 1);
    expect(quiz).toBeDefined();
    expect(quiz?.choices).toHaveLength(4);
    expect(quiz?.choices.map((choice) => choice.key)).toContain(quiz?.answer);
  });
});

describe('il se tait plutot que de poser une mauvaise question', () => {
  it('sur un journal vide', () => {
    expect(buildQuiz(EMPTY_JOURNAL, NOW, 1)).toBeUndefined();
  });

  it('quand il n y a pas de quoi faire trois leurres', () => {
    expect(buildQuiz(journalOf(QUATRE.slice(0, 3)), NOW, 1)).toBeUndefined();
  });

  it('quand aucun titre n est connu — on n affiche jamais `tmdb:1396`', () => {
    const sansTitres = QUATRE.map(({ key, declaredAt }) => ({ key, declaredAt }));
    expect(buildQuiz(journalOf(sansTitres), NOW, 1)).toBeUndefined();
  });

  it('quand tout est trop recent : personne n a oublie hier', () => {
    const hier = QUATRE.map((one) => ({ ...one, declaredAt: '2026-08-09T20:00:00Z' }));
    expect(buildQuiz(journalOf(hier), NOW, 1)).toBeUndefined();
  });
});

/**
 * 🔴 Le coeur du module. Un import depose la date **de l'import**, pas celle du visionnage.
 * Une question batie dessus affirmerait quelque chose de faux.
 */
describe('les faits importes ne repondent a rien', () => {
  it('un journal entierement importe ne donne aucune question', () => {
    const importe = QUATRE.map((one) => ({ ...one, imported: true }));
    expect(buildQuiz(journalOf(importe), NOW, 1)).toBeUndefined();
  });

  it('un fait importe n est jamais la reponse, meme entoure de faits vecus', () => {
    const melange = [
      { ...QUATRE[0]!, imported: true },
      QUATRE[1]!,
      QUATRE[2]!,
      QUATRE[3]!,
    ];
    // Sur toutes les graines : la serie importee ne doit jamais etre la bonne reponse.
    for (let seed = 0; seed < 50; seed += 1) {
      expect(buildQuiz(journalOf(melange), NOW, seed)?.answer).not.toBe('tmdb:1');
    }
  });
});

/**
 * Deux series vues le meme jour donnent DEUX bonnes reponses. La question serait injuste,
 * et un joueur qui repond juste et se voit refuser n'y revient pas.
 */
it('ecarte les jours ou deux series ont un fait', () => {
  const memeJour = QUATRE.map((one) => ({ ...one, declaredAt: '2026-01-07T20:00:00Z' }));
  expect(buildQuiz(journalOf(memeJour), NOW, 1)).toBeUndefined();
});

it('la reponse correspond bien au jour demande', () => {
  const quiz = buildQuiz(journalOf(QUATRE), NOW, 7);
  expect(quiz?.kind).toBe('onDay');
  const jour = quiz?.kind === 'onDay' ? quiz.on : 'x';
  expect(QUATRE.find((one) => one.declaredAt.startsWith(jour))?.key).toBe(quiz?.answer);
});

/**
 * « Quelle serie a cette courbe ? » — la trajectoire, qui est le differenciateur du
 * produit, retournee en jeu. Elle ne coute rien : elle est deja dans le journal.
 */
describe('la question « devinez la courbe »', () => {
  const AVEC_COURBES = QUATRE.map((one, index) => ({
    ...one,
    seasons: [4 - index * 0.5, 3 + index * 0.5, 5 - index * 0.25],
  }));

  it('ancrage — elle est bien posee quand les notes existent', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildQuiz(journalOf(AVEC_COURBES), NOW, seed);
      if (quiz !== undefined) kinds.add(quiz.kind);
    }
    expect(kinds).toContain('byCurve');
  });

  it('rend la courbe de la bonne serie, saison par saison, dans l ordre', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildQuiz(journalOf(AVEC_COURBES), NOW, seed);
      if (quiz?.kind !== 'byCurve') continue;
      const attendu = AVEC_COURBES.find((one) => one.key === quiz.answer);
      expect(quiz.curve.map((point) => point.season)).toEqual([1, 2, 3]);
      expect(quiz.curve.map((point) => point.stars)).toEqual(attendu?.seasons);
    }
  });

  /** A deux points, toutes les trajectoires se ressemblent : ce serait un tirage au sort. */
  it('ne se pose pas sur deux saisons', () => {
    const courtes = QUATRE.map((one) => sansDate({ ...one, seasons: [4, 3] }));
    expect(buildQuiz(journalOf(courtes), NOW, 1)).toBeUndefined();
  });

  it('🔴 ecarte les notes importees : on ne devine pas ce qu on n a pas juge', () => {
    const reprises = QUATRE.map((one) => sansDate({ ...one, seasons: [4, 3, 5], imported: true }));
    expect(buildQuiz(journalOf(reprises), NOW, 1)).toBeUndefined();
  });
});

describe('le hasard est injecte, donc reproductible', () => {
  it('la meme graine rend exactement la meme question', () => {
    const a = buildQuiz(journalOf(QUATRE), NOW, 42);
    const b = buildQuiz(journalOf(QUATRE), NOW, 42);
    expect(a).toEqual(b);
  });

  it('l ordre des cles du journal ne change pas la question', () => {
    const endroit = buildQuiz(journalOf(QUATRE), NOW, 42);
    const envers = buildQuiz(journalOf([...QUATRE].reverse()), NOW, 42);
    expect(envers).toEqual(endroit);
  });

  /**
   * ⚠️ Sans melange, la bonne reponse serait **toujours la premiere** — ce qu'un joueur
   * remarque au deuxieme tour, et qui transforme le quiz en bouton.
   */
  it('la bonne reponse n est pas toujours au meme rang', () => {
    const rangs = new Set<number>();
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildQuiz(journalOf(QUATRE), NOW, seed);
      if (quiz === undefined) continue;
      rangs.add(quiz.choices.findIndex((choice) => choice.key === quiz.answer));
    }
    expect(rangs.size).toBeGreaterThan(1);
  });

  it('des graines differentes finissent par poser des questions differentes', () => {
    const jours = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildQuiz(journalOf(QUATRE), NOW, seed);
      if (quiz?.kind === 'onDay') jours.add(quiz.on);
    }
    expect(jours.size).toBeGreaterThan(1);
  });
});

/** A7 : la note d'episode est la granularite la plus fine du produit. */
describe('la question « devinez la saison, episode par episode »', () => {
  const AVEC_EPISODES = QUATRE.map((one, index) => ({
    ...one,
    episodes: { season: 2, stars: [4, 3.5, 5, 4.5, 3, 4].map((s) => s - index * 0.25) },
  }));

  it('ancrage — elle est bien posee quand les notes d episode existent', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildQuiz(journalOf(AVEC_EPISODES), NOW, seed);
      if (quiz !== undefined) kinds.add(quiz.kind);
    }
    expect(kinds).toContain('byEpisodes');
  });

  it('rend les episodes dans l ordre, numerotes a partir de 1', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildQuiz(journalOf(AVEC_EPISODES), NOW, seed);
      if (quiz?.kind !== 'byEpisodes') continue;
      expect(quiz.episodes.map((point) => point.season)).toEqual([1, 2, 3, 4, 5, 6]);
      const attendu = AVEC_EPISODES.find((one) => one.key === quiz.answer);
      expect(quiz.episodes.map((point) => point.stars)).toEqual(attendu?.episodes.stars);
    }
  });

  it('ne se pose pas sous cinq episodes notes', () => {
    const maigres = QUATRE.map((one) =>
      sansDate({ ...one, episodes: { season: 1, stars: [4, 3, 5] } }),
    );
    expect(buildQuiz(journalOf(maigres), NOW, 1)).toBeUndefined();
  });

  /**
   * 🔴 Les numeros d'episode repartent a 1 a chaque saison. Coller deux saisons dessinerait
   * une courbe qui remonte au milieu sans que rien ne se soit passe.
   */
  it('ne melange jamais deux saisons dans la meme courbe', () => {
    const journal = journalOf(
      QUATRE.map((one) => sansDate({ ...one, episodes: { season: 1, stars: [4, 4, 4, 4, 4] } })),
    );
    for (let seed = 0; seed < 30; seed += 1) {
      const quiz = buildQuiz(journal, NOW, seed);
      if (quiz?.kind !== 'byEpisodes') continue;
      const numeros = quiz.episodes.map((point) => point.season);
      expect(new Set(numeros).size).toBe(numeros.length);
    }
  });

  it('ecarte les notes d episode importees', () => {
    const reprises = QUATRE.map((one) =>
      sansDate({ ...one, episodes: { season: 1, stars: [4, 3, 5, 4, 4] }, imported: true }),
    );
    expect(buildQuiz(journalOf(reprises), NOW, 1)).toBeUndefined();
  });
});

it('ne propose jamais deux fois la meme serie dans les choix', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const quiz = buildQuiz(journalOf(QUATRE), NOW, seed);
    if (quiz === undefined) continue;
    const keys = quiz.choices.map((choice) => choice.key as JournalKey);
    expect(new Set(keys).size).toBe(keys.length);
  }
});

import { describe, expect, it } from 'vitest';

import { buildFriendQuiz, type FriendFact } from '../src/domain/friend-quiz';

const TITRES: Record<string, string> = {
  'tmdb:1': 'Dark',
  'tmdb:2': 'Severance',
  'tmdb:3': 'The Leftovers',
  'tmdb:4': 'Breaking Bad',
};
const titleOf = (subject: string) => TITRES[subject];

const aime = (subject: string, handle = 'marie'): FriendFact => ({
  kind: 'liked',
  subject,
  handle,
});

const note = (subject: string, season: number, stars: number, handle = 'paul'): FriendFact => ({
  kind: 'rated_season',
  subject,
  handle,
  season,
  stars,
});

const QUATRE_AIMES = Object.keys(TITRES).map((subject) => aime(subject));

describe('ancrage', () => {
  it('pose bien une question quand la matiere est la', () => {
    const quiz = buildFriendQuiz(QUATRE_AIMES, titleOf, 1);
    expect(quiz).toBeDefined();
    expect(quiz?.choices).toHaveLength(4);
    expect(quiz?.choices.map((choice) => choice.key)).toContain(quiz?.answer);
  });
});

describe('il se tait plutot que de poser une mauvaise question', () => {
  it('sans rien', () => {
    expect(buildFriendQuiz([], titleOf, 1)).toBeUndefined();
  });

  it('quand le lecteur ne sait nommer que trois series', () => {
    expect(buildFriendQuiz(QUATRE_AIMES.slice(0, 3), titleOf, 1)).toBeUndefined();
  });

  /**
   * Une serie dont le lecteur n'a pas d'instantane ne lui dit rien, et on n'affiche
   * jamais `tmdb:1396`.
   */
  it('quand aucun titre n est connu', () => {
    expect(buildFriendQuiz(QUATRE_AIMES, () => undefined, 1)).toBeUndefined();
  });
});

/**
 * 🔴 Le coeur du module. Ces faits arrivent **deja caviardes** par `redactActivity` : ce
 * qui n'y est plus n'a jamais a reapparaitre ici.
 */
describe('le caviardage amont est respecte', () => {
  it('ne montre que les saisons qui ont survecu au filtre', () => {
    // Le lecteur en est a la saison 2 : `redactActivity` n'a laisse passer que S1 et S2.
    const survivants = [
      note('tmdb:1', 1, 4),
      note('tmdb:1', 2, 4.5),
      note('tmdb:1', 3, 2),
      ...QUATRE_AIMES,
    ];
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildFriendQuiz(survivants, titleOf, seed);
      if (quiz?.kind !== 'friendCurve') continue;
      // Le module ne peut montrer que ce qu'on lui a donne — jamais plus.
      expect(quiz.curve.length).toBeLessThanOrEqual(3);
      expect(quiz.curve.map((point) => point.season)).toEqual([...quiz.curve]
        .map((point) => point.season)
        .sort((a, b) => a - b));
    }
  });

  it('ne pose pas de courbe quand il reste moins de trois saisons', () => {
    const tronque = [note('tmdb:1', 1, 4), note('tmdb:1', 2, 5), ...QUATRE_AIMES];
    for (let seed = 0; seed < 40; seed += 1) {
      expect(buildFriendQuiz(tronque, titleOf, seed)?.kind).not.toBe('friendCurve');
    }
  });

  /**
   * ⚠️ `liked` et `finished` ne portent aucun numero de saison : ils ne peuvent rien
   * apprendre de l'interieur d'une serie. C'est le raisonnement de 10.2.
   */
  it('les faits sans interieur ne portent jamais de saison', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildFriendQuiz(QUATRE_AIMES, titleOf, seed);
      if (quiz?.kind !== 'friendLiked') continue;
      expect(Object.hasOwn(quiz, 'curve')).toBe(false);
    }
  });

  it('ignore les genres qui porteraient une saison sans etre caviardes', () => {
    // `started` et `wanted` ne sont pas retenus : ils ne disent rien de ce qu'on en a
    // pense, donc ils ne font pas une question — et un genre inconnu non plus.
    const bruit: FriendFact[] = [
      { kind: 'started', subject: 'tmdb:1', handle: 'marie' },
      { kind: 'wanted', subject: 'tmdb:2', handle: 'marie' },
      { kind: 'inconnu', subject: 'tmdb:3', handle: 'marie' },
      { kind: 'autre', subject: 'tmdb:4', handle: 'marie' },
    ];
    expect(buildFriendQuiz(bruit, titleOf, 1)).toBeUndefined();
  });
});

describe('le hasard est injecte', () => {
  it('la meme graine rend la meme question', () => {
    expect(buildFriendQuiz(QUATRE_AIMES, titleOf, 9)).toEqual(
      buildFriendQuiz(QUATRE_AIMES, titleOf, 9),
    );
  });

  it("l'ordre des faits ne change pas la question", () => {
    expect(buildFriendQuiz([...QUATRE_AIMES].reverse(), titleOf, 9)).toEqual(
      buildFriendQuiz(QUATRE_AIMES, titleOf, 9),
    );
  });

  it('la bonne reponse n est pas toujours au meme rang', () => {
    const rangs = new Set<number>();
    for (let seed = 0; seed < 40; seed += 1) {
      const quiz = buildFriendQuiz(QUATRE_AIMES, titleOf, seed);
      if (quiz === undefined) continue;
      rangs.add(quiz.choices.findIndex((choice) => choice.key === quiz.answer));
    }
    expect(rangs.size).toBeGreaterThan(1);
  });
});

it('ne propose jamais deux fois la meme serie', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const quiz = buildFriendQuiz(QUATRE_AIMES, titleOf, seed);
    if (quiz === undefined) continue;
    const keys = quiz.choices.map((choice) => choice.key);
    expect(new Set(keys).size).toBe(keys.length);
  }
});

it('nomme l ami dont on parle', () => {
  const quiz = buildFriendQuiz(QUATRE_AIMES, titleOf, 3);
  expect(quiz?.handle).toBe('marie');
});

import { describe, expect, it } from 'vitest';
import {
  MIN_EPISODES_AIRED,
  MIN_SEASON_GAP,
  judgeCurrentSeason,
} from '../src/domain/current-season';
import type { RatedEpisode } from '../src/domain/entry-point';

/** Une saison d'episodes notes, tous a la meme valeur sauf indication. */
function season(seasonNumber: number, ratings: readonly number[], votes = 500): RatedEpisode[] {
  return ratings.map((voteAverage, index) => ({
    seasonNumber,
    episodeNumber: index + 1,
    voteAverage,
    voteCount: votes,
  }));
}

/** Trois saisons de reference solides, autour de 8,0. */
const HISTORY = [
  ...season(1, [8, 8.1, 7.9, 8, 8.1, 8]),
  ...season(2, [8.1, 8, 8.2, 8, 7.9, 8.1]),
  ...season(3, [8, 8.1, 8, 7.9, 8.1, 8]),
];

describe('judgeCurrentSeason — le silence est le comportement nominal', () => {
  it('se tait sur une saison qui se deroule normalement', () => {
    expect(judgeCurrentSeason([...HISTORY, ...season(4, [8, 8.1, 7.9, 8])], 4)).toBeUndefined();
  });

  it('se tait tant que trop peu d’episodes sont sortis', () => {
    // Deux episodes ne font pas une saison. C'est la lecon des trois passes de
    // `computeTrajectory` : un instrument taille pour des notes humaines ne s'applique
    // pas a des moyennes de foule.
    expect(judgeCurrentSeason([...HISTORY, ...season(4, [5, 5.1])], 4)).toBeUndefined();
    expect(
      judgeCurrentSeason([...HISTORY, ...season(4, Array(MIN_EPISODES_AIRED).fill(5))], 4),
    ).toBeDefined();
  });

  it('se tait faute de reference : une seule saison passee est un accident', () => {
    const thin = [...season(1, [8, 8.1, 7.9, 8]), ...season(2, [5, 5.1, 5, 5.2])];
    expect(judgeCurrentSeason(thin, 2)).toBeUndefined();
  });

  it('se tait quand l’ecart tient dans le bruit', () => {
    // Les notes d'episode d'une meme serie tiennent dans une bande d'environ un point
    // sur dix : 0,3 d'ecart n'est pas un verdict, c'est de la dispersion.
    const noise = [...HISTORY, ...season(4, [7.7, 7.75, 7.7, 7.8])];
    expect(judgeCurrentSeason(noise, 4)).toBeUndefined();
  });

  it('ignore les episodes trop peu notes', () => {
    // Les episodes d'une saison qui vient de sortir ont parfois trois votes. Les croire
    // fabriquerait un verdict a partir de rien, la semaine ou il est le plus lu.
    const fresh = [...HISTORY, ...season(4, [3, 3, 3, 3], 4)];
    expect(judgeCurrentSeason(fresh, 4)).toBeUndefined();
  });

  it('se tait sur une serie sans historique du tout', () => {
    expect(judgeCurrentSeason(season(1, [8, 8, 8, 8]), 1)).toBeUndefined();
    expect(judgeCurrentSeason([], 1)).toBeUndefined();
  });
});

describe('judgeCurrentSeason — ce qu’il sait dire', () => {
  it('signale une saison nettement en dessous', () => {
    const verdict = judgeCurrentSeason([...HISTORY, ...season(4, [6.5, 6.4, 6.6, 6.5])], 4);
    expect(verdict?.seasonNumber).toBe(4);
    expect(verdict?.airedEpisodes).toBe(4);
    expect(verdict?.gap).toBeLessThan(-MIN_SEASON_GAP);
    expect(verdict?.reference).toBeCloseTo(8, 1);
  });

  it('signale aussi une saison nettement au-dessus', () => {
    // Le produit ne doit pas etre plus severe que genereux : la meme mesure dans les
    // deux sens, ou aucune.
    const verdict = judgeCurrentSeason([...HISTORY, ...season(4, [9.2, 9.1, 9.3, 9.2])], 4);
    expect(verdict?.gap).toBeGreaterThan(MIN_SEASON_GAP);
  });

  it('ne compte que les episodes deja sortis de la saison en cours', () => {
    const verdict = judgeCurrentSeason([...HISTORY, ...season(4, [6.5, 6.4, 6.6])], 4);
    // Quatre episodes annonces, trois notes : on parle des trois, pas de la saison
    // entiere, et surtout on ne predit pas les suivants.
    expect(verdict?.airedEpisodes).toBe(3);
  });

  it('ignore une saison posterieure annoncee par le catalogue', () => {
    // TMDB annonce parfois la saison suivante avant diffusion. Elle ne doit ni servir de
    // reference, ni polluer la mediane historique.
    const withFuture = [...HISTORY, ...season(4, [6.5, 6.4, 6.6, 6.5]), ...season(5, [9, 9])];
    const verdict = judgeCurrentSeason(withFuture, 4);
    expect(verdict?.reference).toBeCloseTo(8, 1);
  });
});

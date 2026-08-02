import { describe, expect, it } from 'vitest';
import {
  MAX_ENTRY_FRACTION,
  MIN_SKIPPED_EPISODES,
  findEntryPoint,
  type RatedEpisode,
} from '../src/domain/entry-point';

/**
 * Le point d'entree, teste d'abord sur ses **refus**.
 *
 * La lecon la plus chere du projet est qu'un conseil exact mais sans portee ne vaut pas
 * mieux que pas de conseil (`TASKS.md` §1.22). Sur cette feature, se taire est donc le
 * comportement nominal : les cas ou le module parle sont minoritaires, et ce sont les
 * refus qui font sa valeur.
 */

/** Fabrique une serie d'episodes notes, saison 1, avec assez de votes pour compter. */
function series(ratings: readonly number[], votes = 500): RatedEpisode[] {
  return ratings.map((voteAverage, index) => ({
    seasonNumber: 1,
    episodeNumber: index + 1,
    voteAverage,
    voteCount: votes,
  }));
}

describe('findEntryPoint — ce qu’il refuse de dire', () => {
  it('se tait sur une serie qui demarre deja bien', () => {
    expect(findEntryPoint(series([8, 8.1, 8, 8.2, 8.1, 8, 8.1, 8, 8.2, 8, 8.1, 8]))).toBeUndefined();
  });

  it('se tait sur une serie qui decline', () => {
    // Le point d'arret s'en charge ; annoncer un decollage ici serait faux.
    expect(findEntryPoint(series([9, 9, 8.8, 8.5, 8, 7.5, 7, 6.8, 6.5, 6, 6, 5.8]))).toBeUndefined();
  });

  it('se tait quand l’ecart tient dans le bruit', () => {
    // Les notes d'episode d'une meme serie tiennent dans environ un point sur dix : un
    // ecart de 0,2 n'est pas un signal, c'est la dispersion normale.
    expect(findEntryPoint(series([7.8, 7.7, 7.8, 7.9, 8, 7.9, 8, 7.9, 8, 7.9, 8, 7.9]))).toBeUndefined();
  });

  it('se tait quand il n’y aurait qu’un ou deux episodes a passer', () => {
    // « Le pilote est faible » ne fait renoncer personne : tout le monde regarde le
    // pilote. Ici seul l'episode 1 est mauvais — le module doit soit se taire, soit
    // proposer un point qui vaut la peine, jamais un entre-deux.
    const found = findEntryPoint(series([5, 8.5, 8.6, 8.5, 8.6, 8.5, 8.6, 8.5, 8.6, 8.5, 8.6, 8.5]));
    if (found !== undefined) {
      expect(found.skipped).toBeGreaterThanOrEqual(MIN_SKIPPED_EPISODES);
    }
  });

  it('ne fait jamais commencer sur un episode encore mauvais', () => {
    // Le defaut trouve par les tests, et la cinquieme regle du module. Ici l'episode 4
    // est encore faible : conseiller « commencez a l'episode 4 » serait dementi dans la
    // minute par celui qui suit le conseil.
    const found = findEntryPoint(
      series([6, 6.1, 6, 6.2, 8.5, 8.4, 8.6, 8.5, 8.4, 8.6, 8.5, 8.4]),
    );
    expect(found?.skipped).toBe(4);
  });

  it('se tait quand le decollage arrive au-dela du premier tiers', () => {
    // « Ca devient bon a la moitie » n'est pas un demarrage lent, c'est une autre serie.
    const ratings = [...Array(12).fill(6.5), ...Array(12).fill(8.5)];
    const found = findEntryPoint(series(ratings));
    if (found !== undefined) {
      expect(found.skipped).toBeLessThanOrEqual(Math.floor(24 * MAX_ENTRY_FRACTION));
    }
  });

  it('se tait faute d’episodes exploitables', () => {
    expect(findEntryPoint([])).toBeUndefined();
    expect(findEntryPoint(series([5, 6, 9, 9, 9]))).toBeUndefined();
  });

  it('ignore les episodes trop peu notes plutot que de les croire', () => {
    // Le debut des series obscures est plein d'episodes a trois votes. Les prendre pour
    // argent comptant fabriquerait un decollage a partir de rien.
    const noisy = series([2, 2, 2, 2], 3);
    const solid = series([8.5, 8.5, 8.6, 8.5, 8.6, 8.5, 8.6, 8.5]).map((e, i) => ({
      ...e,
      episodeNumber: i + 5,
    }));
    expect(findEntryPoint([...noisy, ...solid])).toBeUndefined();
  });
});

describe('findEntryPoint — ce qu’il sait dire', () => {
  it('trouve le decollage d’une serie a demarrage lent', () => {
    // Le cas archetypal : cinq episodes tiedes, puis la serie trouve son ton.
    const found = findEntryPoint(series([6.2, 6.3, 6.1, 6.4, 6.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5, 8.4, 8.6, 8.5, 8.4]));
    expect(found).toBeDefined();
    expect(found?.skipped).toBe(5);
    expect(found?.afterEpisode).toBe(5);
    expect((found?.after ?? 0) - (found?.before ?? 0)).toBeGreaterThan(1.5);
  });

  it('rend une position lisible, saison et episode', () => {
    const twoSeasons: RatedEpisode[] = [
      ...series([6, 6.1, 6, 6.2]),
      ...series([8.5, 8.4, 8.6, 8.5, 8.4, 8.6, 8.5, 8.4]).map((e, i) => ({
        ...e,
        seasonNumber: 2,
        episodeNumber: i + 1,
      })),
    ];
    const found = findEntryPoint(twoSeasons);
    expect(found?.afterSeason).toBe(1);
    expect(found?.afterEpisode).toBe(4);
    // L'episode ou commencer traverse la frontiere de saison : c'est S2E1, et surtout
    // pas « S1E5 » sur une saison qui n'en compte que quatre.
    expect(found?.startSeason).toBe(2);
    expect(found?.startEpisode).toBe(1);
  });

  it('prefere le point le plus precoce a ecart egal', () => {
    // Un conseil qui fait passer moins d'episodes est toujours le meilleur des deux.
    const found = findEntryPoint(series([6, 6, 6, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5]));
    expect(found?.skipped).toBe(3);
  });

  it('range les episodes lui-meme, quel que soit l’ordre d’entree', () => {
    const ordered = series([6.2, 6.3, 6.1, 6.4, 6.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5, 8.4, 8.6, 8.5, 8.4]);
    const shuffled = [...ordered].reverse();
    expect(findEntryPoint(shuffled)).toEqual(findEntryPoint(ordered));
  });

  it('resiste a un episode culte isole au milieu du creux', () => {
    // Mediane et non moyenne : un 9,5 perdu dans les premiers episodes ne doit pas
    // effacer le fait que le debut est faible.
    const found = findEntryPoint(series([6, 6.1, 9.5, 6, 6.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5, 8.4, 8.6, 8.5, 8.4]));
    expect(found).toBeDefined();
    expect(found?.skipped).toBe(5);
  });
});

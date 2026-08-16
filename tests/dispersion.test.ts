import { describe, expect, it } from 'vitest';
import {
  MIN_EPISODES_FOR_SPREAD,
  episodeSpread,
  type RatedEpisode,
} from '../src/domain/dispersion';
import { MIN_VOTES_FOR_TRUST } from '../src/domain/rating-scale';

/**
 * La dispersion des episodes — la seule moitie de F1 que la donnee permette.
 *
 * ⚠️ Ce fichier ne teste pas « la distribution des notes du public » : elle n'existe pas.
 * TMDB sert une moyenne et un effectif, et l'histogramme des votants ne s'en derive pas.
 * Ce qui est teste ici est la dispersion des episodes entre eux — question voisine, reponse
 * differente, et c'est le titre affiche qui porte la distinction.
 */

/** Un episode note, avec assez de votes pour compter sauf mention contraire. */
function ep(
  seasonNumber: number,
  episodeNumber: number,
  voteAverage: number,
  voteCount = MIN_VOTES_FOR_TRUST,
): RatedEpisode {
  return { seasonNumber, episodeNumber, voteAverage, voteCount };
}

/** N episodes tous a la meme note, pour composer des cas lisibles. */
function flat(count: number, voteAverage: number, from = 1): RatedEpisode[] {
  return Array.from({ length: count }, (_, i) => ep(1, from + i, voteAverage));
}

describe('episodeSpread — le seuil', () => {
  it('se tait sous douze episodes assez notes', () => {
    expect(episodeSpread(flat(MIN_EPISODES_FOR_SPREAD - 1, 8))).toBeUndefined();
    expect(episodeSpread(flat(MIN_EPISODES_FOR_SPREAD, 8))).toBeDefined();
  });

  it('🔴 les episodes trop peu votes sont ecartes AVANT le compte', () => {
    // Le piege : chez TMDB, un episode ancien ou de niche a une poignee de votes et une
    // note extreme. Les compter fabriquerait une dispersion qui ne mesure que l'affluence.
    const solides = flat(MIN_EPISODES_FOR_SPREAD, 8);
    const bruyants = [ep(9, 1, 2, MIN_VOTES_FOR_TRUST - 1), ep(9, 2, 10, 1)];

    const spread = episodeSpread([...solides, ...bruyants]);
    expect(spread?.counted).toBe(MIN_EPISODES_FOR_SPREAD);
    // Et surtout : ni le pire ni le meilleur ne viennent des deux intrus.
    expect(spread?.worst.seasonNumber).not.toBe(9);
    expect(spread?.best.seasonNumber).not.toBe(9);
  });

  it('un episode a zero vote_average n’est pas un episode detestable', () => {
    // Chez TMDB, `0` veut dire « personne n'a vote ». Meme regle que `starsFromTen`.
    const spread = episodeSpread([...flat(MIN_EPISODES_FOR_SPREAD, 8), ep(9, 1, 0, 500)]);
    expect(spread?.counted).toBe(MIN_EPISODES_FOR_SPREAD);
  });
});

describe('episodeSpread — les tranches', () => {
  it('🔴 la somme des tranches fait le compte, borne haute comprise', () => {
    // Le defaut vise : des tranches toutes ouvertes a droite perdraient l'episode note
    // exactement a la borne haute — c'est-a-dire le MEILLEUR, donc toujours present. La
    // somme ne ferait jamais `counted`, et personne ne le verrait sur un dessin.
    const episodes = [
      ...flat(6, 7.2),
      ...flat(6, 8.4, 10),
      ...flat(4, 9.5, 20),
    ];
    const spread = episodeSpread(episodes);
    expect(spread).toBeDefined();
    expect(spread?.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(spread?.counted);
  });

  it('garde quatre tranches quand tout est groupe', () => {
    // Meme lecon que `MIN_CHART_SPAN` : cadrer sur le seul ecart reel ferait ressortir une
    // serie plate aussi contrastee qu'une serie qui s'effondre.
    const spread = episodeSpread(flat(20, 8.1));
    expect(spread?.buckets).toHaveLength(4);
    // Elle est plate, et le dessin doit le dire : tout dans une seule tranche.
    expect(spread?.buckets.filter((b) => b.count > 0)).toHaveLength(1);
  });

  it('les bornes sont alignees sur les demi-points', () => {
    // Sans alignement, deux series voisines n'auraient pas les memes tranches — donc ne se
    // compareraient pas, ce qui est tout ce qu'un histogramme sert a faire.
    const spread = episodeSpread([...flat(10, 6.3), ...flat(10, 8.7, 20)]);
    for (const bucket of spread?.buckets ?? []) {
      expect((bucket.from * 2) % 1).toBe(0);
      expect(bucket.to - bucket.from).toBeCloseTo(0.5);
    }
  });
});

describe('episodeSpread — ce que la phrase annonce', () => {
  it('compte les episodes a plus d’un demi-point de la mediane', () => {
    // 16 episodes a 8,0 et 4 a 9,0 : la mediane est 8,0, et les quatre s'en ecartent d'un
    // point plein. Le chiffre affiche est celui-la, brut — jamais une constance normalisee.
    const spread = episodeSpread([...flat(16, 8), ...flat(4, 9, 20)]);
    expect(spread?.median).toBe(8);
    expect(spread?.apart).toBe(4);
    expect(spread?.counted).toBe(20);
  });

  it('une serie regulière n’en compte aucun', () => {
    const spread = episodeSpread([...flat(18, 8), ...flat(2, 8.4, 20)]);
    // 0,4 point d'ecart : sous le demi-point, ce n'est pas un ecart, c'est du bruit.
    expect(spread?.apart).toBe(0);
  });

  it('nomme le plus bas et le plus haut, avec leurs coordonnees', () => {
    const spread = episodeSpread([...flat(12, 8), ep(5, 9, 6.4), ep(3, 7, 9.6)]);
    expect(spread?.worst.seasonNumber).toBe(5);
    expect(spread?.worst.episodeNumber).toBe(9);
    expect(spread?.best.seasonNumber).toBe(3);
    expect(spread?.best.episodeNumber).toBe(7);
    expect(spread?.span).toBeCloseTo(3.2);
  });
});

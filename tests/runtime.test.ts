import { describe, expect, it } from 'vitest';
import { medianRuntime, posterDimensions, posterUrl } from '../lib/catalog';
import { normalizeSeasons, representativeSeason } from '../src/domain/seasons';
import type { SeasonDetail } from '../src/catalog/provider';

/**
 * Regression du 2026-08-01, trouvee en production.
 *
 * La premiere version estimait la duree totale a partir du **dernier episode paru**.
 * Stranger Things affichait « 90 heures » pour 42 episodes — 128 min chacun — parce
 * que le final de la saison 5 est un long-metrage. La serie fait environ 45 heures.
 *
 * Un chiffre faux du simple au double est pire que pas de chiffre : c'est la seule
 * promesse chiffree de la page d'accueil.
 */

function season(runtimes: readonly (number | undefined)[]): SeasonDetail {
  return {
    seasonNumber: 1,
    episodes: runtimes.map((runtimeMinutes, i) => ({
      seasonNumber: 1,
      episodeNumber: i + 1,
      ...(runtimeMinutes !== undefined ? { runtimeMinutes } : {}),
    })),
  };
}

describe('medianRuntime — resiste aux episodes hors norme', () => {
  it('ignore un final de deux heures', () => {
    // Le cas Stranger Things : huit episodes normaux, un final demesure.
    const st = season([62, 54, 59, 61, 57, 63, 58, 120]);
    expect(medianRuntime(st)).toBe(60);

    // Ce qu'aurait donne l'ancienne methode, pour memoire.
    const naive = 120;
    expect(naive).toBeGreaterThan(medianRuntime(st)! * 1.9);
  });

  it('ignore un pilote rallonge', () => {
    expect(medianRuntime(season([90, 45, 44, 46, 45]))).toBe(45);
  });

  it('moyenne les deux valeurs centrales sur un nombre pair', () => {
    expect(medianRuntime(season([40, 50, 60, 70]))).toBe(55);
  });

  it('ecarte les durees absentes ou nulles', () => {
    expect(medianRuntime(season([undefined, 50, 0, 50]))).toBe(50);
  });

  it('rend undefined quand aucune duree n est exploitable', () => {
    expect(medianRuntime(season([]))).toBeUndefined();
    expect(medianRuntime(season([undefined, undefined]))).toBeUndefined();
    expect(medianRuntime(season([0, 0]))).toBeUndefined();
  });
});

describe('affiches — declarer les dimensions evite que la page saute', () => {
  it('deduit la hauteur du ratio constant des affiches TMDB', () => {
    // Sans width/height, le navigateur ne reserve pas la place : la page saute a
    // l'arrivee des images. C'est un des trois indicateurs que Google mesure.
    expect(posterDimensions('w342')).toEqual({ width: 342, height: 513 });
    expect(posterDimensions('w185')).toEqual({ width: 185, height: 278 });
    expect(posterDimensions('w500')).toEqual({ width: 500, height: 750 });
  });

  it('sert les affiches depuis le CDN du fournisseur, jamais depuis nous', () => {
    // Une ligne du budget : optimiser des images qu'un CDN sert deja serait payer
    // deux fois.
    expect(posterUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(posterUrl(undefined)).toBeUndefined();
  });
});

describe('representativeSeason — ni la premiere, ni la derniere', () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
  const NOW = new Date('2026-08-01T00:00:00Z');

  function build(count: number) {
    return normalizeSeasons(
      's',
      Array.from({ length: count }, (_, i) => ({
        seasonNumber: i + 1,
        episodeCount: 10,
        airDate: d(`20${String(10 + i).padStart(2, '0')}-01-01`),
      })),
      { now: NOW },
    );
  }

  it('prend celle du milieu — le pilote et le final sont souvent rallonges', () => {
    expect(representativeSeason(build(5))?.ref.seasonNumber).toBe(3);
    expect(representativeSeason(build(3))?.ref.seasonNumber).toBe(2);
  });

  it('evite la derniere sur un nombre pair de saisons', () => {
    expect(representativeSeason(build(4))?.ref.seasonNumber).toBe(2);
    expect(representativeSeason(build(2))?.ref.seasonNumber).toBe(1);
  });

  it('se contente de l unique saison quand il n y en a qu une', () => {
    expect(representativeSeason(build(1))?.ref.seasonNumber).toBe(1);
  });

  it('rend undefined quand rien n est diffuse', () => {
    expect(representativeSeason(build(0))).toBeUndefined();
  });
});

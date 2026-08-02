import { describe, expect, it } from 'vitest';
import { mapWatchOptions } from '../src/catalog/tmdb';
import { COLOR_CEILING, COLOR_FLOOR, ratingHue } from '../src/domain/rating-scale';

/** Forme reelle de `/tv/{id}/watch/providers` : un objet par pays. */
const FIXTURE = {
  results: {
    FR: {
      link: 'https://www.themoviedb.org/tv/1396/watch?locale=FR',
      flatrate: [{ provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
      rent: [
        { provider_name: 'Apple TV', logo_path: '/apple.jpg' },
        { provider_name: 'Netflix' },
      ],
      buy: [{ provider_name: 'Google Play Movies' }],
    },
    US: {
      flatrate: [{ provider_name: 'Hulu' }],
    },
  },
};

describe('mapWatchOptions', () => {
  it('ne rend que le pays demande', () => {
    // La disponibilite est nationale : afficher celle d'un autre pays serait pire
    // que ne rien afficher.
    const fr = mapWatchOptions(FIXTURE, 'FR').map((o) => o.providerName);
    const us = mapWatchOptions(FIXTURE, 'US').map((o) => o.providerName);

    expect(fr).toContain('Netflix');
    expect(fr).not.toContain('Hulu');
    expect(us).toEqual(['Hulu']);
  });

  it('accepte un code pays en minuscules', () => {
    expect(mapWatchOptions(FIXTURE, 'fr').length).toBeGreaterThan(0);
  });

  it('ne mentionne un service qu une fois, au mode le plus interessant', () => {
    // Netflix figure en abonnement ET en location : l'abonnement l'emporte.
    const fr = mapWatchOptions(FIXTURE, 'FR');
    const netflix = fr.filter((o) => o.providerName === 'Netflix');
    expect(netflix).toHaveLength(1);
    expect(netflix[0]?.kind).toBe('flatrate');
  });

  it('conserve le logo quand il existe, et s en passe sinon', () => {
    const fr = mapWatchOptions(FIXTURE, 'FR');
    expect(fr.find((o) => o.providerName === 'Netflix')?.logoPath).toBe('/netflix.jpg');
    expect(fr.find((o) => o.providerName === 'Google Play Movies')?.logoPath).toBeUndefined();
  });

  it('rend une liste vide pour un pays absent — le cas courant, pas une erreur', () => {
    expect(mapWatchOptions(FIXTURE, 'JP')).toEqual([]);
    expect(mapWatchOptions(null, 'FR')).toEqual([]);
    expect(mapWatchOptions({ results: 'nawak' }, 'FR')).toEqual([]);
  });

  it('ignore une entree sans nom de service', () => {
    const out = mapWatchOptions(
      { results: { FR: { flatrate: [{ logo_path: '/x.jpg' }, { provider_name: 'OK' }] } } },
      'FR',
    );
    expect(out.map((o) => o.providerName)).toEqual(['OK']);
  });
});

describe('ratingHue — l echelle de couleur de la grille', () => {
  it('s etale sur la plage reellement occupee, pas sur 0–10', () => {
    // Les notes d'episode s'agglutinent entre 6 et 9 : ceux qui notent un episode
    // l'ont regarde, donc l'aiment. Etaler sur l'echelle theorique donnerait une
    // grille uniformement verte, ou l'on ne verrait rien.
    expect(ratingHue(COLOR_FLOOR)).toBe(0);
    expect(ratingHue(COLOR_CEILING)).toBe(1);
    expect(ratingHue(7.5)).toBeCloseTo(0.5, 5);
  });

  it('borne les valeurs hors plage', () => {
    expect(ratingHue(2)).toBe(0);
    expect(ratingHue(10)).toBe(1);
  });

  it('distingue deux episodes que l echelle 0–10 confondrait', () => {
    // Un ecart d'un point sur dix devient un tiers de l'echelle de couleur.
    expect(ratingHue(8.5) - ratingHue(7.5)).toBeCloseTo(1 / 3, 5);
  });
});

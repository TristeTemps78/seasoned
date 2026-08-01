import { describe, expect, it } from 'vitest';
import {
  MIN_VOTES_FOR_TRUST,
  representativeRating,
  starsFromTen,
} from '../src/domain/rating-scale';

describe('starsFromTen', () => {
  it('convertit sans arrondir', () => {
    // L'arrondi au demi-point convient a une note humaine, jamais a une moyenne de
    // foule : les notes d'une meme serie tiennent dans une bande d'un point sur dix.
    // Arrondies, toutes les saisons de Dexter valaient 4,0 et la serie ressortait
    // « tenue de bout en bout » — l'exact contraire de sa reputation.
    expect(starsFromTen(10)).toBe(5);
    expect(starsFromTen(8)).toBe(4);
    expect(starsFromTen(7.3)).toBeCloseTo(3.65, 5);
    expect(starsFromTen(7.6)).toBeCloseTo(3.8, 5);
  });

  it('conserve l ecart que l arrondi detruisait', () => {
    const best = starsFromTen(8.2)!;
    const worst = starsFromTen(7.0)!;
    expect(best - worst).toBeCloseTo(0.6, 5);
  });

  it('traite zero comme « personne n a vote », pas comme « detestable »', () => {
    // Chez TMDB, 0 signifie l'absence de vote. Les confondre placerait toutes les
    // oeuvres inconnues au fond du classement.
    expect(starsFromTen(0)).toBeUndefined();
    expect(starsFromTen(undefined)).toBeUndefined();
    expect(starsFromTen(Number.NaN)).toBeUndefined();
    expect(starsFromTen(-3)).toBeUndefined();
  });

  it('ne descend jamais sous la borne basse de l echelle', () => {
    // 0,4/10 arrondirait a 0, hors echelle.
    expect(starsFromTen(0.4)).toBe(0.5);
    expect(starsFromTen(0.1)).toBe(0.5);
  });

  it('borne les valeurs aberrantes', () => {
    expect(starsFromTen(42)).toBe(5);
  });
});

describe('representativeRating', () => {
  it('prend la mediane, pas la moyenne', () => {
    // Un final plebiscite ne doit pas decider de la saison entiere — meme raison que
    // pour la duree d'episode.
    const ratings = [7, 7.2, 7.1, 7.3, 9.8].map((voteAverage) => ({
      voteAverage,
      voteCount: 100,
    }));
    expect(representativeRating(ratings)).toBe(7.2);
  });

  it(`ecarte les episodes sous ${MIN_VOTES_FOR_TRUST} votes`, () => {
    // Une note adossee a trois votes dit surtout qui a vote.
    const ratings = [
      { voteAverage: 9.9, voteCount: 2 },
      { voteAverage: 7, voteCount: 200 },
      { voteAverage: 7.4, voteCount: 150 },
    ];
    expect(representativeRating(ratings)).toBe(7.2);
  });

  it('rend undefined quand rien n est fiable', () => {
    expect(representativeRating([])).toBeUndefined();
    expect(representativeRating([{ voteAverage: 9, voteCount: 1 }])).toBeUndefined();
    expect(
      representativeRating([{ voteAverage: 0, voteCount: 500 }]),
    ).toBeUndefined();
  });

  it('moyenne les deux valeurs centrales sur un nombre pair', () => {
    const ratings = [6, 7, 8, 9].map((voteAverage) => ({ voteAverage, voteCount: 50 }));
    expect(representativeRating(ratings)).toBe(7.5);
  });
});

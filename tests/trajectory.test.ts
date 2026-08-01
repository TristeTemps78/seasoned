import { describe, expect, it } from 'vitest';
import {
  BREAK_POINT_MIN_DROP,
  HIGH_CONSISTENCY_THRESHOLD,
  MIN_SEASONS_FOR_CONSISTENCY,
  computeTrajectory,
  type SeasonScore,
} from '../src/domain/trajectory';
import type { Stars } from '../src/domain/types';

/** Construit une suite de notes a partir des saisons 1..n. */
function scores(...stars: Stars[]): SeasonScore[] {
  return stars.map((s, i) => ({ seasonNumber: i + 1, stars: s }));
}

describe('computeTrajectory — les deux cas de reference', () => {
  // Les deux series qui motivent tout le modele : meme pic, memes notes possibles,
  // trajectoires opposees. Toute note unique les rendrait comparables.
  it('classe une serie tenue de bout en bout comme chef-d oeuvre', () => {
    const t = computeTrajectory('breaking-bad', scores(4, 4.5, 4.5, 5, 5));

    expect(t.peak).toBe(5);
    expect(t.peakSeason).toBe(4);
    expect(t.shape).toBe('masterpiece');
    expect(t.consistency).toBeGreaterThanOrEqual(HIGH_CONSISTENCY_THRESHOLD);
    expect(t.breakPoint).toBeUndefined();
    expect(t.suggestedStopAfter).toBeUndefined();
  });

  it('classe une serie qui decroche comme declin et situe le point d arret', () => {
    const t = computeTrajectory('dexter', scores(4.5, 4, 3.5, 5, 2.5, 1.5));

    expect(t.peak).toBe(5);
    expect(t.shape).toBe('decline');
    expect(t.trend).toBe('falling');
    expect(t.consistency).toBeLessThan(HIGH_CONSISTENCY_THRESHOLD);

    // Le resultat attendu par n'importe quel spectateur : « arrete-toi apres la 4 ».
    expect(t.breakPoint?.afterSeason).toBe(4);
    expect(t.breakPoint?.drop).toBe(2.5);
    expect(t.breakPoint?.contiguous).toBe(true);
    expect(t.suggestedStopAfter).toBe(4);
  });

  it('distingue deux series que la moyenne rendrait proches', () => {
    const masterpiece = computeTrajectory('a', scores(4, 4, 4, 4, 4));
    const erratic = computeTrajectory('b', scores(5, 2, 5, 2, 5, 3));

    // Moyennes voisines, formes incomparables — c'est tout l'argument du modele.
    expect(masterpiece.mean).toBeCloseTo(4, 5);
    expect(erratic.mean).toBeCloseTo(3.667, 2);
    expect(masterpiece.shape).toBe('masterpiece');
    expect(erratic.shape).toBe('erratic');
  });
});

describe('computeTrajectory — formes', () => {
  it('detecte une montee', () => {
    const t = computeTrajectory('s', scores(2, 2.5, 3.5, 4.5, 5));
    expect(t.trend).toBe('rising');
    expect(t.shape).toBe('grower');
  });

  it('classe une serie reguliere sans sommet comme fiable', () => {
    const t = computeTrajectory('sitcom', scores(3, 3, 3.5, 3, 3, 3.5));
    expect(t.shape).toBe('steady');
    expect(t.consistency).toBeGreaterThanOrEqual(HIGH_CONSISTENCY_THRESHOLD);
    expect(t.peak).toBeLessThan(4);
  });

  it('refuse de nommer une forme quand la dispersion est negligeable — si on le demande', () => {
    // Correctif du 2026-08-01 : sur des notes de foule, Dexter ressortait « tenue de
    // bout en bout ». La foule ne discriminait pas ; qualifier cela etait presenter du
    // bruit comme un jugement.
    const flat = [
      { seasonNumber: 1, stars: 4.0 },
      { seasonNumber: 2, stars: 4.05 },
      { seasonNumber: 3, stars: 3.95 },
      { seasonNumber: 4, stars: 4.02 },
    ];
    expect(computeTrajectory('s', flat, { minSpread: 0.25 }).shape).toBe('undifferentiated');

    // Sans garde-fou — le defaut — une note humaine constante reste un jugement.
    expect(computeTrajectory('s', flat).shape).toBe('masterpiece');
  });

  it('detecte un decrochage tenu que le seuil des notes humaines manquait', () => {
    // L'ecart reel entre les saisons de Dexter sur TMDB, une fois l'arrondi retire.
    const dexterPublic = [
      { seasonNumber: 1, stars: 4.0 },
      { seasonNumber: 2, stars: 4.05 },
      { seasonNumber: 3, stars: 3.9 },
      { seasonNumber: 4, stars: 4.1 },
      { seasonNumber: 5, stars: 3.7 },
      { seasonNumber: 6, stars: 3.6 },
    ];
    expect(computeTrajectory('dexter', dexterPublic).breakPoint).toBeUndefined();

    const detected = computeTrajectory('dexter', dexterPublic, { minDrop: 0.25 });
    expect(detected.breakPoint?.afterSeason).toBe(4);
    expect(detected.suggestedStopAfter).toBe(4);
  });

  it('ne classe rien sous deux saisons notees', () => {
    expect(computeTrajectory('s', []).shape).toBe('insufficient_data');
    expect(computeTrajectory('s', scores(5)).shape).toBe('insufficient_data');
  });

  it('rend tout de meme le pic avec une seule saison notee', () => {
    const t = computeTrajectory('mini', scores(4.5));
    expect(t.peak).toBe(4.5);
    expect(t.peakSeason).toBe(1);
    expect(t.consistency).toBeUndefined();
  });
});

describe('computeTrajectory — honnetete statistique', () => {
  it(`ne publie pas de constance sous ${MIN_SEASONS_FOR_CONSISTENCY} saisons notees`, () => {
    expect(computeTrajectory('s', scores(1, 5)).consistency).toBeUndefined();
    expect(computeTrajectory('s', scores(1, 5, 3)).consistency).toBeDefined();
  });

  it('borne la constance sur [0, 1]', () => {
    // Le pire cas possible : alternance entre les deux bornes de l'echelle.
    const worst = computeTrajectory('s', scores(0.5, 5, 0.5, 5, 0.5, 5));
    expect(worst.consistency).toBeGreaterThanOrEqual(0);
    expect(worst.consistency).toBeLessThanOrEqual(1);

    const perfect = computeTrajectory('s', scores(3, 3, 3, 3));
    expect(perfect.consistency).toBe(1);
  });

  it('utilise le numero de saison reel, pas le rang, pour la pente', () => {
    // Meme chute, mais etalee sur dix saisons : la pente doit etre plus douce.
    const tight = computeTrajectory('a', [
      { seasonNumber: 1, stars: 5 },
      { seasonNumber: 2, stars: 1 },
    ]);
    const spread = computeTrajectory('b', [
      { seasonNumber: 1, stars: 5 },
      { seasonNumber: 11, stars: 1 },
    ]);

    expect(tight.slope).toBeCloseTo(-4, 5);
    expect(spread.slope).toBeCloseTo(-0.4, 5);
  });
});

describe('computeTrajectory — points de rupture', () => {
  it(`ignore les chutes sous ${BREAK_POINT_MIN_DROP} etoile`, () => {
    const t = computeTrajectory('s', scores(4, 3.5, 3, 2.5));
    expect(t.breakPoint).toBeUndefined();
  });

  it('retient la chute la plus forte, pas la premiere', () => {
    const t = computeTrajectory('s', scores(5, 3.5, 5, 1.5));
    expect(t.breakPoint?.afterSeason).toBe(3);
    expect(t.breakPoint?.drop).toBe(3.5);
  });

  it('signale une chute qui enjambe une saison non notee', () => {
    const t = computeTrajectory('s', [
      { seasonNumber: 1, stars: 5 },
      { seasonNumber: 3, stars: 2 },
    ]);
    expect(t.breakPoint?.contiguous).toBe(false);
  });
});

describe('computeTrajectory — robustesse des entrees', () => {
  it('trie les saisons donnees dans le desordre', () => {
    const t = computeTrajectory('s', [
      { seasonNumber: 3, stars: 2 },
      { seasonNumber: 1, stars: 5 },
      { seasonNumber: 2, stars: 4 },
    ]);
    expect(t.scores.map((s) => s.seasonNumber)).toEqual([1, 2, 3]);
    expect(t.trend).toBe('falling');
  });

  it('garde la derniere note en cas de renotation', () => {
    const t = computeTrajectory('s', [
      { seasonNumber: 1, stars: 1 },
      { seasonNumber: 2, stars: 3 },
      { seasonNumber: 1, stars: 5 },
    ]);
    expect(t.scores).toHaveLength(2);
    expect(t.scores[0]?.stars).toBe(5);
  });

  it('n invente pas les saisons non notees', () => {
    const t = computeTrajectory('s', [
      { seasonNumber: 1, stars: 4 },
      { seasonNumber: 5, stars: 4 },
    ]);
    expect(t.scores).toHaveLength(2);
  });
});

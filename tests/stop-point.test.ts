import { describe, expect, it } from 'vitest';
import { MIN_STOP_POINT_SAVING, stopPointAdvice } from '../lib/catalog';
import { computeTrajectory } from '../src/domain/trajectory';
import { normalizeSeasons } from '../src/domain/seasons';

/**
 * Correctif du 2026-08-01, motive par la production.
 *
 * Sur *Dexter*, la plus forte chute de notes publiques se situe entre les saisons 7
 * et 8. S'arreter la epargne huit episodes sur quatre-vingt-seize : exact, et
 * parfaitement inutile. **Conseiller d'arreter juste avant la fin n'aide personne.**
 */

const NOW = new Date('2026-08-01T00:00:00Z');

function seasonsOf(episodeCounts: readonly number[]) {
  return normalizeSeasons(
    's',
    episodeCounts.map((episodeCount, i) => ({
      seasonNumber: i + 1,
      episodeCount,
      airDate: new Date(Date.UTC(2010 + i, 0, 1)),
    })),
    { now: NOW },
  );
}

describe('stopPointAdvice', () => {
  it('se tait quand s arreter n epargne presque rien', () => {
    // Le cas Dexter : huit saisons, la chute est a la toute fin.
    const seasons = seasonsOf([12, 12, 12, 12, 12, 12, 12, 12]);
    const trajectory = computeTrajectory(
      's',
      [4.0, 4.1, 3.9, 4.2, 4.1, 3.9, 4.0, 3.6].map((stars, i) => ({
        seasonNumber: i + 1,
        stars,
      })),
      { minDrop: 0.25 },
    );

    expect(trajectory.suggestedStopAfter).toBe(7);
    expect(stopPointAdvice(trajectory, seasons, 96 * 51, 96)).toBeUndefined();
  });

  it('parle quand s arreter change vraiment la donne', () => {
    // Chute apres la saison 2 sur six saisons : on epargne les deux tiers.
    const seasons = seasonsOf([10, 10, 10, 10, 10, 10]);
    const trajectory = computeTrajectory(
      's',
      [4.5, 4.4, 3.0, 2.8, 2.9, 2.7].map((stars, i) => ({ seasonNumber: i + 1, stars })),
    );

    const advice = stopPointAdvice(trajectory, seasons, 6000, 60);
    expect(advice?.afterSeason).toBe(2);
    expect(advice?.shortenedMinutes).toBeCloseTo(2000, 5);
    expect(advice?.fullMinutes).toBe(6000);
  });

  it(`exige au moins ${Math.round(MIN_STOP_POINT_SAVING * 100)} % d economie`, () => {
    const seasons = seasonsOf([10, 10, 10]);
    // Chute apres la saison 2 : un tiers epargne, tout juste au seuil.
    const trajectory = computeTrajectory(
      's',
      [4.5, 4.5, 2.0].map((stars, i) => ({ seasonNumber: i + 1, stars })),
    );
    expect(stopPointAdvice(trajectory, seasons, 3000, 30)?.afterSeason).toBe(2);
  });

  it('se tait sans decrochage, sans duree, ou sans episode', () => {
    const seasons = seasonsOf([10, 10, 10]);
    const rising = computeTrajectory(
      's',
      [3.0, 4.0, 4.5].map((stars, i) => ({ seasonNumber: i + 1, stars })),
    );
    expect(rising.suggestedStopAfter).toBeUndefined();
    expect(stopPointAdvice(rising, seasons, 3000, 30)).toBeUndefined();

    const falling = computeTrajectory(
      's',
      [4.5, 4.5, 2.0].map((stars, i) => ({ seasonNumber: i + 1, stars })),
    );
    expect(stopPointAdvice(falling, seasons, undefined, 30)).toBeUndefined();
    expect(stopPointAdvice(falling, seasons, 3000, 0)).toBeUndefined();
  });
});

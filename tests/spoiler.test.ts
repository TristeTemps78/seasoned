import { describe, expect, it } from 'vitest';
import {
  compareEpisodes,
  isBeyondPosition,
  isSeasonBeyondPosition,
  isSpoiler,
  redactTrajectory,
  visibleScores,
} from '../src/domain/spoiler';
import { computeTrajectory } from '../src/domain/trajectory';
import type { Position } from '../src/domain/types';

const AT = new Date('2026-07-31T00:00:00Z');

function positionAt(seasonNumber: number, episodeNumber: number): Position {
  return {
    at: { seriesId: 'dexter', seasonNumber, episodeNumber },
    declaredAt: AT,
  };
}

const DEXTER = computeTrajectory('dexter', [
  { seasonNumber: 1, stars: 4.5 },
  { seasonNumber: 2, stars: 4 },
  { seasonNumber: 3, stars: 3.5 },
  { seasonNumber: 4, stars: 5 },
  { seasonNumber: 5, stars: 2.5 },
  { seasonNumber: 6, stars: 1.5 },
]);

describe('compareEpisodes', () => {
  it('ordonne d abord par saison puis par episode', () => {
    const a = { seriesId: 's', seasonNumber: 1, episodeNumber: 9 };
    const b = { seriesId: 's', seasonNumber: 2, episodeNumber: 1 };
    expect(compareEpisodes(a, b)).toBeLessThan(0);
    expect(compareEpisodes(b, a)).toBeGreaterThan(0);
    expect(compareEpisodes(a, a)).toBe(0);
  });
});

describe('isBeyondPosition — le defaut est de masquer', () => {
  it('masque tout a qui n a pas declare de position', () => {
    // Regle du module : sans position, le spectateur n'a rien vu.
    const target = { seriesId: 'dexter', seasonNumber: 1, episodeNumber: 1 };
    expect(isBeyondPosition(target, undefined)).toBe(true);
  });

  it('ne masque pas l episode ou l on se trouve', () => {
    const target = { seriesId: 'dexter', seasonNumber: 3, episodeNumber: 7 };
    expect(isBeyondPosition(target, positionAt(3, 7))).toBe(false);
  });

  it('masque l episode suivant', () => {
    const target = { seriesId: 'dexter', seasonNumber: 3, episodeNumber: 8 };
    expect(isBeyondPosition(target, positionAt(3, 7))).toBe(true);
  });

  it('ne masque pas ce qui precede, meme dans une saison anterieure', () => {
    const target = { seriesId: 'dexter', seasonNumber: 1, episodeNumber: 12 };
    expect(isBeyondPosition(target, positionAt(3, 1))).toBe(false);
  });
});

describe('isSeasonBeyondPosition', () => {
  it('rend la saison en cours visible des son premier episode', () => {
    // Quelqu'un en S03E01 sait que la saison 3 existe : les jugements portes sur
    // elle ne lui apprennent rien qu'il ne puisse deja voir.
    const target = { seriesId: 'dexter', seasonNumber: 3 };
    expect(isSeasonBeyondPosition(target, positionAt(3, 1))).toBe(false);
  });

  it('masque la saison suivante', () => {
    const target = { seriesId: 'dexter', seasonNumber: 4 };
    expect(isSeasonBeyondPosition(target, positionAt(3, 12))).toBe(true);
  });
});

describe('isSpoiler', () => {
  it('traite les trois formes de cible', () => {
    const position = positionAt(3, 5);

    expect(
      isSpoiler({ kind: 'episode', ref: { seriesId: 'dexter', seasonNumber: 4, episodeNumber: 1 } }, position),
    ).toBe(true);
    expect(
      isSpoiler({ kind: 'season', ref: { seriesId: 'dexter', seasonNumber: 2 } }, position),
    ).toBe(false);
    // Une cible « serie » ne se spoile pas elle-meme : c'est ce qui l'accompagne
    // (verdict, trajectoire) qui doit etre filtre.
    expect(isSpoiler({ kind: 'series', seriesId: 'dexter' }, position)).toBe(false);
  });
});

describe('redactTrajectory — la courbe est elle-meme un spoiler', () => {
  it('coupe la courbe a la position du spectateur', () => {
    const redacted = redactTrajectory(DEXTER, positionAt(2, 4));

    expect(redacted.trajectory.scores.map((s) => s.seasonNumber)).toEqual([1, 2]);
    expect(redacted.hiddenSeasons).toBe(4);
    expect(redacted.hasHiddenSignal).toBe(true);
  });

  it('ne laisse fuir ni le pic ni le point de rupture par les agregats', () => {
    // Le point capital : on recalcule au lieu de masquer a l'affichage. Un pic
    // derive de saisons non vues fuirait a travers les agregats meme courbe coupee.
    const redacted = redactTrajectory(DEXTER, positionAt(3, 12));

    expect(redacted.trajectory.peak).toBe(4.5);
    expect(redacted.trajectory.peakSeason).toBe(1);
    expect(redacted.trajectory.breakPoint).toBeUndefined();
    expect(redacted.trajectory.suggestedStopAfter).toBeUndefined();

    // La trajectoire complete, elle, sait tout.
    expect(DEXTER.peak).toBe(5);
    expect(DEXTER.suggestedStopAfter).toBe(4);
  });

  it('signale qu il reste quelque chose plus loin sans dire quoi', () => {
    const redacted = redactTrajectory(DEXTER, positionAt(4, 12));
    expect(redacted.hasHiddenSignal).toBe(true);
    expect(redacted.hiddenSeasons).toBe(2);
  });

  it('ne masque rien a qui a tout vu', () => {
    const redacted = redactTrajectory(DEXTER, positionAt(6, 12));
    expect(redacted.hiddenSeasons).toBe(0);
    expect(redacted.hasHiddenSignal).toBe(false);
    expect(redacted.trajectory.suggestedStopAfter).toBe(4);
  });

  it('ne montre rien a qui n a pas commence', () => {
    const redacted = redactTrajectory(DEXTER, undefined);
    expect(redacted.trajectory.scores).toHaveLength(0);
    expect(redacted.trajectory.shape).toBe('insufficient_data');
    expect(visibleScores(DEXTER.scores, undefined)).toHaveLength(0);
  });
});

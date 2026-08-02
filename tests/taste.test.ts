import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  journalKey,
  setDecision,
  setEpisodeRating,
  setPosition,
  setSeasonRating,
  setSnapshot,
  type Journal,
} from '../src/domain/journal';
import {
  MIN_SERIES_FOR_TASTE,
  buildTasteProfile,
  severityOf,
} from '../src/domain/taste';
import type { Stars } from '../src/domain/types';

const NOW = new Date('2026-08-02T12:00:00Z');

/** Une serie notee, avec la note du public correspondante. */
function rated(journal: Journal, id: string, mine: Stars, theirs?: number): Journal {
  const key = journalKey(id);
  let j = setSeasonRating(journal, key, 1, mine, NOW);
  if (theirs !== undefined) {
    j = setSnapshot(j, key, { title: `Série ${id}`, publicStars: theirs }, NOW);
  }
  return j;
}

describe('buildTasteProfile — ne parle pas avant d avoir de quoi', () => {
  it('se tait sous le seuil', () => {
    // Un profil calcule sur trois series est du bruit presente comme un fait. Meme
    // lecon que le point d'arret qui epargnait 8 % de la serie.
    let j = EMPTY_JOURNAL;
    for (let i = 0; i < MIN_SERIES_FOR_TASTE - 1; i += 1) {
      j = rated(j, `10${i}`, 4);
    }
    expect(buildTasteProfile(j, NOW).speaks).toBe(false);
  });

  it('parle une fois le seuil atteint', () => {
    let j = EMPTY_JOURNAL;
    for (let i = 0; i < MIN_SERIES_FOR_TASTE; i += 1) {
      j = rated(j, `10${i}`, 4);
    }
    const profile = buildTasteProfile(j, NOW);
    expect(profile.speaks).toBe(true);
    expect(profile.ratedSeries).toBe(MIN_SERIES_FOR_TASTE);
  });

  it('rend un profil vide sans lever, sur un journal vide', () => {
    const profile = buildTasteProfile(EMPTY_JOURNAL, NOW);
    expect(profile).toMatchObject({ ratedSeries: 0, seasonRatings: 0, speaks: false });
    expect(profile.averageStars).toBeUndefined();
  });
});

describe('l ecart au public — la comparaison sociale sans personne d autre', () => {
  it('mesure la severite', () => {
    let j = rated(EMPTY_JOURNAL, '1', 3, 4);
    j = rated(j, '2', 3.5, 4.5);
    const profile = buildTasteProfile(j, NOW);

    expect(profile.gapToPublic).toBeCloseTo(-1, 5);
    expect(profile.comparedSeries).toBe(2);
    expect(severityOf(profile.gapToPublic)).toBe('severe');
  });

  it('mesure la generosite', () => {
    const j = rated(EMPTY_JOURNAL, '1', 5, 3.5);
    expect(severityOf(buildTasteProfile(j, NOW).gapToPublic)).toBe('generous');
  });

  it('ne conclut rien sur un ecart de bruit', () => {
    // Deux dixiemes d'etoile sur dix crans, ce n'est pas un gout.
    const j = rated(EMPTY_JOURNAL, '1', 4, 3.8);
    expect(severityOf(buildTasteProfile(j, NOW).gapToPublic)).toBe('aligned');
    expect(severityOf(undefined)).toBeUndefined();
  });

  it('ignore les series dont on ignore la note du public', () => {
    let j = rated(EMPTY_JOURNAL, '1', 3, 4);
    j = rated(j, '2', 5);
    const profile = buildTasteProfile(j, NOW);

    expect(profile.comparedSeries).toBe(1);
    expect(profile.gapToPublic).toBeCloseTo(-1, 5);
  });

  it('oublie un instantane expire plutot que de comparer a une valeur perimee', () => {
    const j = rated(EMPTY_JOURNAL, '1', 3, 4);
    const bienPlusTard = new Date(NOW.getTime() + 200 * 86_400_000);
    expect(buildTasteProfile(j, bienPlusTard).comparedSeries).toBe(0);
  });
});

describe('ce qu on mene au bout, et ou l on decroche', () => {
  it('compte les decisions et la part de series finies', () => {
    let j = setDecision(EMPTY_JOURNAL, journalKey('1'), 'completed', NOW);
    j = setDecision(j, journalKey('2'), 'completed', NOW);
    j = setDecision(j, journalKey('3'), 'abandoned', NOW);

    const profile = buildTasteProfile(j, NOW);
    expect(profile.completed).toBe(2);
    expect(profile.abandoned).toBe(1);
    expect(profile.completionRate).toBeCloseTo(2 / 3, 5);
  });

  it('rend la saison mediane d abandon', () => {
    // La donnee propre du produit : personne d'autre ne sait ou les gens lachent.
    let j = EMPTY_JOURNAL;
    for (const [id, season] of [['1', 2], ['2', 5], ['3', 3]] as const) {
      const key = journalKey(id);
      j = setPosition(j, key, season, 1, NOW);
      j = setDecision(j, key, 'abandoned', NOW);
    }
    expect(buildTasteProfile(j, NOW).medianAbandonSeason).toBe(3);
  });

  it('ne rend pas de taux quand rien n a ete decide', () => {
    const j = rated(EMPTY_JOURNAL, '1', 4);
    expect(buildTasteProfile(j, NOW).completionRate).toBeUndefined();
  });

  it('compte les notes d episode a part', () => {
    let j = setEpisodeRating(EMPTY_JOURNAL, journalKey('1'), 1, 1, 5, NOW);
    j = setEpisodeRating(j, journalKey('1'), 1, 2, 4, NOW);
    const profile = buildTasteProfile(j, NOW);

    expect(profile.episodeRatings).toBe(2);
    // Une note d'episode n'est pas une note de saison : elle ne gonfle pas la moyenne.
    expect(profile.seasonRatings).toBe(0);
  });
});

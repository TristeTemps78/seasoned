import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  parseJournal,
  seasonScoresOf,
  serializeJournal,
  setDecision,
  setPosition,
  setSeasonRating,
} from '../src/domain/journal';

const NOW = new Date('2026-08-02T12:00:00Z');

describe('parseJournal — ne perd jamais tout', () => {
  it('lit un journal valide', () => {
    const journal = setPosition(EMPTY_JOURNAL, '1396', 3, 7, NOW);
    expect(parseJournal(serializeJournal(journal), NOW)).toEqual(journal);
  });

  it('rend un journal vide plutot que de lever', () => {
    for (const bad of [null, undefined, '', '   ', 'pas du json', '[]', '42', '{}']) {
      expect(() => parseJournal(bad, NOW)).not.toThrow();
      expect(parseJournal(bad, NOW).entries).toEqual({});
    }
  });

  it('ecarte une entree corrompue et garde les autres', () => {
    // Perdre tout un journal parce qu'une ligne est illisible serait indefendable
    // pour un produit qui demande d'y investir du temps.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        '1396': { position: { seasonNumber: 2, episodeNumber: 5, declaredAt: NOW.toISOString() } },
        '1405': { position: { seasonNumber: 'trois', episodeNumber: null } },
        '1402': { seasonRatings: { '1': { stars: 4, at: NOW.toISOString() } } },
      },
    });

    const journal = parseJournal(raw, NOW);
    expect(Object.keys(journal.entries).sort()).toEqual(['1396', '1402']);
    expect(journal.entries['1396']?.position?.seasonNumber).toBe(2);
  });

  it('refuse une version inconnue plutot que de deviner', () => {
    const raw = JSON.stringify({ version: 99, entries: { '1': { position: {} } } });
    expect(parseJournal(raw, NOW)).toEqual(EMPTY_JOURNAL);
  });

  it('ecarte une note hors echelle', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: { '1': { seasonRatings: { '1': { stars: 3.7 }, '2': { stars: 4 } } } },
    });
    const ratings = parseJournal(raw, NOW).entries['1']?.seasonRatings ?? {};
    expect(Object.keys(ratings)).toEqual(['2']);
  });

  it('remplace une date illisible au lieu de jeter l entree', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: { '1': { position: { seasonNumber: 1, episodeNumber: 1, declaredAt: 'hier' } } },
    });
    expect(parseJournal(raw, NOW).entries['1']?.position?.declaredAt).toBe(NOW.toISOString());
  });
});

describe('ecritures', () => {
  it('la position est un pointeur qu on deplace', () => {
    let j = setPosition(EMPTY_JOURNAL, '1396', 1, 1, NOW);
    j = setPosition(j, '1396', 3, 7, NOW);
    expect(j.entries['1396']?.position).toMatchObject({ seasonNumber: 3, episodeNumber: 7 });
  });

  it('note et denote une saison', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, '1396', 2, 4.5, NOW);
    expect(j.entries['1396']?.seasonRatings?.['2']?.stars).toBe(4.5);

    j = setSeasonRating(j, '1396', 2, undefined, NOW);
    expect(j.entries['1396']).toBeUndefined();
  });

  it('retire une serie devenue vide du journal', () => {
    // Une entree vide n'a pas a encombrer le journal ni son export.
    let j = setPosition(EMPTY_JOURNAL, '1396', 1, 1, NOW);
    j = setSeasonRating(j, '1396', 1, 4, NOW);
    j = setSeasonRating(j, '1396', 1, undefined, NOW);
    expect(j.entries['1396']?.position).toBeDefined();
  });

  it('une decision retient le point exact ou elle a ete prise', () => {
    // C'est ce point qui fera la carte des abandons.
    let j = setPosition(EMPTY_JOURNAL, '1405', 5, 3, NOW);
    j = setDecision(j, '1405', 'abandoned', NOW);

    expect(j.entries['1405']?.decision).toMatchObject({
      kind: 'abandoned',
      atSeason: 5,
      atEpisode: 3,
    });
  });

  it('accepte une decision sans position connue', () => {
    const j = setDecision(EMPTY_JOURNAL, '1405', 'completed', NOW);
    expect(j.entries['1405']?.decision?.kind).toBe('completed');
    expect(j.entries['1405']?.decision?.atSeason).toBeUndefined();
  });

  it('n altere jamais le journal recu', () => {
    const before = setPosition(EMPTY_JOURNAL, '1', 1, 1, NOW);
    const snapshot = serializeJournal(before);
    setPosition(before, '2', 2, 2, NOW);
    expect(serializeJournal(before)).toBe(snapshot);
  });
});

describe('seasonScoresOf', () => {
  it('rend les notes triees, pretes pour le moteur de trajectoire', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, '1405', 3, 3.5, NOW);
    j = setSeasonRating(j, '1405', 1, 4.5, NOW);
    j = setSeasonRating(j, '1405', 2, 4, NOW);

    expect(seasonScoresOf(j, '1405')).toEqual([
      { seasonNumber: 1, stars: 4.5 },
      { seasonNumber: 2, stars: 4 },
      { seasonNumber: 3, stars: 3.5 },
    ]);
  });

  it('rend une liste vide pour une serie inconnue', () => {
    expect(seasonScoresOf(EMPTY_JOURNAL, 'inconnue')).toEqual([]);
  });
});

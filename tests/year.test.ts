import { describe, expect, it } from 'vitest';
import { buildYearReview, yearsWithActivity } from '../src/domain/year';
import { importForeign } from '../src/domain/import';
import {
  EMPTY_JOURNAL,
  markCompleted,
  setLiked,
  setSeasonRating,
  setSnapshot,
  setWanted,
  type Journal,
} from '../src/domain/journal';

const BB = 'tmdb:1396';
const IN_2026 = new Date('2026-03-14T10:00:00Z');
const IN_2025 = new Date('2025-06-02T10:00:00Z');
const NOW = new Date('2026-08-09T12:00:00Z');

/** Deux saisons de dix episodes de quarante minutes : 800 minutes en tout. */
const SHAPE = {
  title: 'Breaking Bad',
  episodeMinutes: 40,
  seasonSizes: [
    { seasonNumber: 1, episodeCount: 10 },
    { seasonNumber: 2, episodeCount: 10 },
  ],
};

function shaped(journal: Journal): Journal {
  return setSnapshot(journal, BB, SHAPE, NOW);
}

describe('buildYearReview', () => {
  it('compte les gestes de l’annee, et pas ceux des autres', () => {
    let journal = setWanted(EMPTY_JOURNAL, BB, true, IN_2025);
    journal = setSeasonRating(journal, BB, 1, 4, IN_2025);
    journal = setSeasonRating(journal, BB, 2, 5, IN_2026);
    journal = setLiked(journal, BB, true, IN_2026);
    journal = markCompleted(journal, BB, IN_2026);
    journal = shaped(journal);

    const y2026 = buildYearReview(journal, 2026, NOW);
    expect(y2026.seasonsRated).toBe(1);
    expect(y2026.liked).toBe(1);
    expect(y2026.finished).toBe(1);

    const y2025 = buildYearReview(journal, 2025, NOW);
    expect(y2025.seasonsRated).toBe(1);
    expect(y2025.liked).toBe(0);
    expect(y2025.finished).toBe(0);
  });

  it('🔴 ne compte PAS les notes reprises d’un import', () => {
    // Le piege que 9.0 existe pour eviter, et le seul endroit de ce module ou il mord :
    // un import date TOUS ses faits du jour de l'import. Sans le filtre de provenance,
    // reprendre dix ans de TV Time un mardi d'aout donnerait une annee 2026 avec des
    // centaines de saisons notees, toutes le meme jour.
    const doc = JSON.stringify({
      shows: [
        { title: 'Breaking Bad', ids: { tmdb: 1396 }, season: 2, rating: 9 },
        { title: 'Dexter', ids: { tmdb: 1405 }, season: 3, rating: 8 },
      ],
    });
    const imported = importForeign(doc, EMPTY_JOURNAL, IN_2026).journal;

    // Ancrage : l'import a bien ecrit des notes, sinon on comparerait deux fois rien.
    expect(Object.keys(imported.entries[BB]?.seasonRatings ?? {})).toHaveLength(1);

    expect(buildYearReview(imported, 2026, NOW).seasonsRated).toBe(0);
    // Et l'annee ne se propose meme pas au selecteur : elle n'a rien de vecu.
    expect(yearsWithActivity(imported)).toEqual([]);
  });

  it('chiffre les series terminees dans l’annee, et rien de plus', () => {
    // ⚠️ Ce n'est pas « le temps regarde en 2026 » : c'est ce que pesent les series
    // terminees cette annee-la. Le journal ne sait pas quand chaque episode a ete vu.
    const journal = shaped(markCompleted(EMPTY_JOURNAL, BB, IN_2026));
    expect(buildYearReview(journal, 2026, NOW).minutesOfFinished).toBe(800);
    expect(buildYearReview(journal, 2025, NOW).minutesOfFinished).toBe(0);
  });

  it('se tait sur une annee trop maigre', () => {
    // Un « bilan » a un seul geste n'est pas un bilan. Meme regle que le point d'arret
    // qui epargnait 8 % de la serie et qu'on a appris a ne pas afficher.
    const maigre = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, IN_2026);
    expect(buildYearReview(maigre, 2026, NOW).worthShowing).toBe(false);

    let fourni = maigre;
    fourni = setSeasonRating(fourni, BB, 2, 5, IN_2026);
    fourni = setLiked(fourni, BB, true, IN_2026);
    expect(buildYearReview(fourni, 2026, NOW).worthShowing).toBe(true);
  });

  it('retient la saison la mieux notee de l’annee', () => {
    let journal = setSeasonRating(EMPTY_JOURNAL, BB, 1, 3, IN_2026);
    journal = setSeasonRating(journal, BB, 2, 5, IN_2026);
    journal = shaped(journal);
    expect(buildYearReview(journal, 2026, NOW).best?.stars).toBe(5);
  });
});

describe('yearsWithActivity', () => {
  it('rend les annees vecues, de la plus recente a la plus ancienne', () => {
    let journal = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, IN_2025);
    journal = markCompleted(journal, BB, IN_2026);
    expect(yearsWithActivity(journal)).toEqual([2026, 2025]);
  });
});

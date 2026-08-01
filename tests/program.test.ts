import { describe, expect, it } from 'vitest';
import { dominantKind, isShowcased, type ProgramKind } from '../src/domain/program';
import { mapSearchResults, mapSeriesDetail } from '../src/catalog/tmdb';

/**
 * Regression du 2026-08-01, constatee en production.
 *
 * La rangee « En attente » de la page d'accueil remontait *Tagesschau* — le journal
 * televise allemand diffuse depuis 1952 — et *Paradise Hotel*. « Depuis combien de
 * temps attendez-vous la suite ? » n'a aucun sens pour un programme en flux continu.
 */

describe('isShowcased — filtrer la vitrine, pas le catalogue', () => {
  it('met en avant la fiction et le documentaire', () => {
    expect(isShowcased('scripted')).toBe(true);
    expect(isShowcased('documentary')).toBe(true);
  });

  it('ecarte les programmes en flux continu', () => {
    expect(isShowcased('news')).toBe(false);
    expect(isShowcased('talk')).toBe(false);
    expect(isShowcased('soap')).toBe(false);
  });

  it('ecarte la telerealite — decision discutable et assumee', () => {
    // Elle a de vraies saisons, mais « jusqu'ou reste-t-elle bonne » ne s'y applique
    // guere. Revisable en une ligne dans src/domain/program.ts.
    expect(isShowcased('reality')).toBe(false);
  });

  it('laisse passer ce qui n est pas etiquete', () => {
    // Mieux vaut montrer une fiction mal etiquetee que masquer par exces de zele.
    expect(isShowcased('unknown')).toBe(true);
  });
});

describe('dominantKind — la nature la plus disqualifiante l emporte', () => {
  it('retient l information plutot que la fiction', () => {
    // Une fiction porte souvent aussi « drame » ; un journal, jamais.
    expect(dominantKind(['scripted', 'news'])).toBe('news');
  });

  it('ordonne les cas ambigus', () => {
    expect(dominantKind(['documentary', 'reality'])).toBe('reality');
    expect(dominantKind(['scripted', 'documentary'])).toBe('documentary');
    expect(dominantKind(['soap', 'scripted'])).toBe('soap');
  });

  it('rend unknown pour une liste vide', () => {
    expect(dominantKind([])).toBe('unknown');
    expect(dominantKind(['unknown' as ProgramKind])).toBe('unknown');
  });
});

describe('traduction des genres TMDB', () => {
  it('lit `genre_ids`, la forme rendue par les listes', () => {
    const [series] = mapSearchResults({
      results: [{ id: 1, name: 'Tagesschau', genre_ids: [10763] }],
    });
    expect(series?.kind).toBe('news');
  });

  it('lit `genres`, la forme rendue par la fiche detaillee', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'Breaking Bad',
      genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
    });
    expect(detail?.kind).toBe('scripted');
  });

  it('reconnait la telerealite', () => {
    const [series] = mapSearchResults({
      results: [{ id: 1, name: 'Paradise Hotel', genre_ids: [10764] }],
    });
    expect(series?.kind).toBe('reality');
  });

  it('rend unknown quand aucun genre n est exploitable', () => {
    const [noGenre] = mapSearchResults({ results: [{ id: 1, name: 'x' }] });
    expect(noGenre?.kind).toBe('unknown');

    // Un genre qui decrit le sujet, pas la nature : ne dit rien de plus.
    const [unrelated] = mapSearchResults({
      results: [{ id: 2, name: 'y', genre_ids: [99999] }],
    });
    expect(unrelated?.kind).toBe('unknown');
  });

  it('ne tombe pas sur des genres malformes', () => {
    const [series] = mapSearchResults({
      results: [{ id: 1, name: 'x', genre_ids: ['18', null, 18] }],
    });
    expect(series?.kind).toBe('scripted');
  });
});

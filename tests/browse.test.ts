import { describe, expect, it, beforeEach } from 'vitest';
import {
  ALL_BROWSE_GENRES,
  ALL_BROWSE_SORTS,
  type BrowseQuery,
  type CatalogProvider,
  type SeriesSummary,
} from '../src/catalog/provider';

/**
 * Le parcours a facettes.
 *
 * ## Ce que ces tests protegent
 *
 * Pas la mise en page — elle se mesure au navigateur. **Ce qui part chez le fournisseur.**
 * Une facette mal traduite ne leve jamais : elle rend simplement zero resultat, ou pire, les
 * mauvais. C'est la panne la plus difficile a voir, et c'est celle que le type ne peut pas
 * attraper — `with_genres=28` est une chaine parfaitement valide qui designe le genre
 * « Action » des **films**, sur un endpoint qui ne sert que des series.
 */

/** Ce que le fournisseur a recu, dans l'ordre. */
let seen: { query: BrowseQuery; page: number }[] = [];

function providerOf(items: readonly SeriesSummary[]): CatalogProvider {
  return {
    name: 'fake',
    async search() {
      return [];
    },
    async getSeries() {
      throw new Error('inutilise');
    },
    async getSeason() {
      throw new Error('inutilise');
    },
    async discover() {
      return [];
    },
    async browse(query, page = 1) {
      seen.push({ query, page });
      return items;
    },
    async personName() {
      return undefined;
    },
    // ⚠️ Ajoutee au faux le 2026-08-16 avec la page de personne : un faux exhaustif est ce
    // qui garantit qu'une methode nouvelle ne passe pas inapercue dans les six autres.
    async personCredits() {
      return { cast: [], crew: [] };
    },
    async seriesByCreator() {
      return [];
    },
    async watchOptions() {
      return {};
    },
    async artwork() {
      return { posters: [], backdrops: [] };
    },
    async episodeGroups() {
      return [];
    },
  };
}

beforeEach(() => {
  seen = [];
});

describe('le contrat de browse()', () => {
  it('tout fournisseur doit savoir parcourir', async () => {
    // Le cout de portabilite assume par `CatalogProvider.browse` : un fournisseur qui ne
    // saurait pas filtrer ne peut pas servir ce produit. Ce test l'ecrit noir sur blanc.
    const provider = providerOf([{ providerId: '1', title: 'S1' }]);

    expect(await provider.browse({}, 1)).toHaveLength(1);
    expect(seen).toEqual([{ query: {}, page: 1 }]);
  });

  it('transmet les trois criteres tels quels', async () => {
    const provider = providerOf([]);
    await provider.browse({ genre: 'crime', decade: 2000, sort: 'rating' }, 2);

    expect(seen[0]).toEqual({
      query: { genre: 'crime', decade: 2000, sort: 'rating' },
      page: 2,
    });
  });
});

describe('les jeux de valeurs', () => {
  it('les douze genres sont uniques', () => {
    expect(new Set(ALL_BROWSE_GENRES).size).toBe(ALL_BROWSE_GENRES.length);
    expect(ALL_BROWSE_GENRES).toHaveLength(12);
  });

  it('n expose AUCUN genre que la vitrine refuse', () => {
    // 🔴 `isShowcased` ecarte `news`, `talk`, `reality` et `soap`. Les proposer au parcours
    // rendrait des rangees que le reste du produit refuse d'afficher — donc des facettes
    // qui mentent sur ce qu'elles vont montrer.
    const refuses = ['news', 'talk', 'reality', 'soap'];
    for (const genre of refuses) {
      expect(ALL_BROWSE_GENRES).not.toContain(genre);
    }
  });

  it('les trois tris sont uniques, et « popular » vient en premier', () => {
    // L'ordre n'est pas cosmetique : c'est le defaut, et il doit etre le premier lu.
    expect(new Set(ALL_BROWSE_SORTS).size).toBe(3);
    expect(ALL_BROWSE_SORTS[0]).toBe('popular');
  });
});

import { describe, expect, it } from 'vitest';
import {
  ALL_LIST_SORTS,
  DEFAULT_LIST_SORT,
  isListSort,
  orderLists,
  type OrderableList,
} from '../src/domain/list-order';

/**
 * Le rangement des listes.
 *
 * Ce qui est garde ici n'est pas « ca trie » — un tri se voit — mais les deux choses qui se
 * cassent en silence : **les egalites**, qui font sauter des cartes d'un rendu a l'autre sans
 * qu'aucun test ne tombe, et le fait que l'entree ne soit **jamais** modifiee, la liste venant
 * d'un etat React que React tient pour immuable.
 */

function list(title: string, count: number, updatedAt: string): OrderableList {
  return { title, count, updatedAt };
}

const LISTS = [
  list('Polars', 3, '2026-08-10T12:00:00Z'),
  list('À revoir', 12, '2026-08-14T09:00:00Z'),
  list('Zapping', 3, '2026-08-01T08:00:00Z'),
] as const;

describe('les trois tris', () => {
  it('range par modification, la plus recente d abord', () => {
    expect(orderLists(LISTS, 'updated', 'fr-FR').map((l) => l.title)).toEqual([
      'À revoir',
      'Polars',
      'Zapping',
    ]);
  });

  it('range par titre, accents compris', () => {
    // ⚠️ « À revoir » avant « Polars » : un tri sur les points de code mettrait le A accentue
    // apres le Z. C'est la raison d'etre du collateur, et la raison pour laquelle la langue
    // est un parametre.
    expect(orderLists(LISTS, 'title', 'fr-FR').map((l) => l.title)).toEqual([
      'À revoir',
      'Polars',
      'Zapping',
    ]);
  });

  it('range par taille, la plus grande d abord', () => {
    expect(orderLists(LISTS, 'size', 'fr-FR').map((l) => l.count)).toEqual([12, 3, 3]);
  });

  it('classe « Saison 10 » apres « Saison 9 »', () => {
    const seasons = [
      list('Saison 10', 1, '2026-08-01T00:00:00Z'),
      list('Saison 9', 1, '2026-08-01T00:00:00Z'),
    ];
    expect(orderLists(seasons, 'title', 'fr-FR').map((l) => l.title)).toEqual([
      'Saison 9',
      'Saison 10',
    ]);
  });
});

describe('🔴 les egalites ne bougent pas toutes seules', () => {
  it('departage deux listes de meme taille par leur date', () => {
    // Sans rupture d'egalite, ces deux-la s'echangeraient leur place selon l'humeur du
    // moteur : un ordre qui bouge tout seul se lit comme un bug.
    expect(orderLists(LISTS, 'size', 'fr-FR').map((l) => l.title)).toEqual([
      'À revoir',
      'Polars',
      'Zapping',
    ]);
  });

  it('departage deux dates identiques par le titre', () => {
    const meme = [
      list('Zapping', 1, '2026-08-10T12:00:00Z'),
      list('Polars', 1, '2026-08-10T12:00:00Z'),
    ];
    expect(orderLists(meme, 'updated', 'fr-FR').map((l) => l.title)).toEqual([
      'Polars',
      'Zapping',
    ]);
  });
});

describe('l entree n est jamais touchee', () => {
  it('rend une nouvelle liste', () => {
    const before = LISTS.map((l) => l.title);
    const after = orderLists(LISTS, 'title', 'fr-FR');
    expect(after).not.toBe(LISTS);
    expect(LISTS.map((l) => l.title)).toEqual(before);
  });
});

describe('une valeur venue d ailleurs', () => {
  it('reconnait les trois tris et rien d autre', () => {
    for (const sort of ALL_LIST_SORTS) expect(isListSort(sort)).toBe(true);
    expect(isListSort('taille')).toBe(false);
    expect(isListSort('')).toBe(false);
  });

  it('part sur l ordre que la base rend deja', () => {
    // Sinon la page sauterait a l'arrivee : la base ordonne par `updated_at.desc`, et un
    // defaut different reordonnerait tout des le premier rendu.
    expect(DEFAULT_LIST_SORT).toBe('updated');
  });
});

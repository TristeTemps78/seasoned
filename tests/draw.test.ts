import { describe, expect, it } from 'vitest';

import { drawFrom, pickOne, seedOf, shuffle, takeSome } from '../src/domain/draw';

/**
 * Le tirage partage par les trois quiz. Sa seule qualite est d'etre **reproductible** :
 * c'est elle qu'on teste, pas la « qualite » du hasard, qui n'a aucune importance ici.
 */

describe('drawFrom', () => {
  it('la meme graine rend la meme suite', () => {
    const a = drawFrom(42);
    const b = drawFrom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('deux graines voisines ne rendent pas la meme suite', () => {
    const a = drawFrom(42);
    const b = drawFrom(43);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('reste dans [0, 1[', () => {
    const draw = drawFrom(7);
    for (let step = 0; step < 500; step += 1) {
      const value = draw();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('seedOf', () => {
  it('deux jours differents donnent deux graines differentes', () => {
    expect(seedOf('2026-08-10')).not.toBe(seedOf('2026-08-11'));
  });

  it('le meme texte donne la meme graine', () => {
    expect(seedOf('2026-08-10')).toBe(seedOf('2026-08-10'));
  });
});

describe('pickOne', () => {
  it('rend undefined sur une liste vide plutot que de lever', () => {
    expect(pickOne([], drawFrom(1))).toBeUndefined();
  });

  it('rend toujours un element de la liste', () => {
    const list = ['a', 'b', 'c'];
    const draw = drawFrom(3);
    for (let step = 0; step < 100; step += 1) {
      expect(list).toContain(pickOne(list, draw));
    }
  });
});

describe('shuffle', () => {
  it('garde exactement les memes elements', () => {
    const shuffled = shuffle([1, 2, 3, 4, 5], drawFrom(5));
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  /** Sans melange, la bonne reponse d'un quiz resterait toujours au meme rang. */
  it('deplace reellement le premier element, au moins parfois', () => {
    const rangs = new Set<number>();
    for (let seed = 0; seed < 40; seed += 1) {
      rangs.add(shuffle(['cible', 'a', 'b', 'c'], drawFrom(seed)).indexOf('cible'));
    }
    expect(rangs.size).toBeGreaterThan(1);
  });
});

describe('takeSome', () => {
  it('ne rend jamais deux fois le meme element', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const taken = takeSome(['a', 'b', 'c', 'd', 'e'], 3, drawFrom(seed));
      expect(new Set(taken).size).toBe(taken.length);
    }
  });

  it('rend ce qu il peut quand la source est trop courte', () => {
    expect(takeSome(['a'], 3, drawFrom(1))).toHaveLength(1);
  });

  /** ⚠️ La source ne doit pas etre consommee : elle est partagee par les appelants. */
  it('ne modifie pas la liste recue', () => {
    const source = ['a', 'b', 'c', 'd'];
    takeSome(source, 3, drawFrom(1));
    expect(source).toEqual(['a', 'b', 'c', 'd']);
  });
});

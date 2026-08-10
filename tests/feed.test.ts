import { describe, expect, it } from 'vitest';

import { mergeFeed } from '../src/domain/feed';

const fait = (happenedOn: string, id = happenedOn) => ({ happenedOn, id });
const texte = (publishedAt: string, id = publishedAt) => ({ publishedAt, id });

/**
 * ⚠️ Ancrage. Sans lui, tous les tests qui suivent compareraient des listes vides et
 * passeraient — le faux negatif de fixture que ce depot a attrape quatre fois.
 */
describe('ancrage', () => {
  it('rend bien les deux sources, et rien de plus', () => {
    const fil = mergeFeed([fait('2026-08-01')], [texte('2026-08-02T10:00:00Z')]);
    expect(fil).toHaveLength(2);
    expect(fil.map((entry) => entry.of)).toEqual(['review', 'fact']);
  });
});

it('range du plus recent au plus ancien, sources melangees', () => {
  const fil = mergeFeed(
    [fait('2026-08-05'), fait('2026-08-01')],
    [texte('2026-08-09T08:00:00Z'), texte('2026-08-03T08:00:00Z')],
  );

  expect(fil.map((entry) => (entry.of === 'fact' ? entry.fact.id : entry.review.id))).toEqual([
    '2026-08-09T08:00:00Z',
    '2026-08-05',
    '2026-08-03T08:00:00Z',
    '2026-08-01',
  ]);
});

/**
 * Le coeur du module : une date (`2026-08-10`) et un instant
 * (`2026-08-10T09:00:00Z`) tombent le meme jour. Comparees telles quelles, la date serait
 * toujours la plus petite — donc tout texte passerait devant tout fait, y compris ceux
 * d'un jour PLUS RECENT.
 */
it('un fait plus recent passe devant un texte plus ancien', () => {
  const fil = mergeFeed([fait('2026-08-20')], [texte('2026-08-10T23:59:59Z')]);
  expect(fil[0]?.of).toBe('fact');
});

it('a egalite de jour, le texte passe devant', () => {
  const fil = mergeFeed([fait('2026-08-10')], [texte('2026-08-10T00:00:01Z')]);
  expect(fil.map((entry) => entry.of)).toEqual(['review', 'fact']);
});

/**
 * 🔴 **Le seul test qui prouve `dayOf`, et il a fallu une mutation pour s'en apercevoir.**
 *
 * Les deux tests ci-dessus restent verts si l'on compare les chaines brutes : une date
 * courte est deja plus petite qu'un instant du meme jour. Ils decrivent donc la regle sans
 * la prouver.
 *
 * Ici le fait porte une heure — 23 h contre 1 h pour le texte. Sans la coupe au jour, le
 * fait passe devant et la regle tombe. `happened_on` est une `date` aujourd'hui, mais rien
 * dans le schema ne l'y oblige, et une regression pareille serait muette.
 */
it('la regle tient quelle que soit la precision de la date', () => {
  const fil = mergeFeed([fait('2026-08-10T23:00:00Z')], [texte('2026-08-10T01:00:00Z')]);
  expect(fil.map((entry) => entry.of)).toEqual(['review', 'fact']);
});

it("preserve l'ordre que la base a deja donne, a l'interieur d'une source", () => {
  const fil = mergeFeed(
    [],
    [texte('2026-08-10T10:00:00Z', 'a'), texte('2026-08-10T09:00:00Z', 'b')],
  );
  expect(fil.map((entry) => (entry.of === 'review' ? entry.review.id : ''))).toEqual(['a', 'b']);
});

it('se tait quand il n y a rien', () => {
  expect(mergeFeed([], [])).toEqual([]);
});

it('marche quand une seule source est vide', () => {
  expect(mergeFeed([fait('2026-08-01')], [])).toHaveLength(1);
  expect(mergeFeed([], [texte('2026-08-01T00:00:00Z')])).toHaveLength(1);
});

it('coupe apres fusion, jamais avant', () => {
  // Couper chaque source a 2 AVANT de fusionner rendrait les 2 plus recents de chacune,
  // donc potentiellement 2 vieux textes devant 2 faits recents.
  const fil = mergeFeed(
    [fait('2026-08-09'), fait('2026-08-08')],
    [texte('2026-08-02T10:00:00Z'), texte('2026-08-01T10:00:00Z')],
    2,
  );
  expect(fil.map((entry) => entry.of)).toEqual(['fact', 'fact']);
});

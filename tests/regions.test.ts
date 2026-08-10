import { describe, expect, it } from 'vitest';

import {
  EMPTY_JOURNAL,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setRegions,
} from '../src/domain/journal';

/**
 * Les pays choisis — « ou la regarder », 5.11.
 *
 * 🔴 Ce fichier existe pour une raison precise : un champ de document qui n'est pas relu
 * par `parseJournal` est **ecrit puis efface a la premiere sauvegarde**, avec tous les
 * tests verts. C'est le defaut de 10.4bis, mot pour mot, et il est invisible autrement.
 */

describe('setRegions', () => {
  it('ancrage — pose bien les pays', () => {
    expect(setRegions(EMPTY_JOURNAL, ['FR', 'GB']).regions).toEqual(['FR', 'GB']);
  });

  it('normalise en majuscules : `fr` et `FR` sont le meme pays', () => {
    expect(setRegions(EMPTY_JOURNAL, ['fr']).regions).toEqual(['FR']);
  });

  it('dedoublonne, sinon le meme pays donnerait deux lignes a l ecran', () => {
    expect(setRegions(EMPTY_JOURNAL, ['fr', 'FR', 'Fr']).regions).toEqual(['FR']);
  });

  it('ecarte ce qui n est pas un code a deux lettres', () => {
    expect(setRegions(EMPTY_JOURNAL, ['FRA', '', 'F', 'GB']).regions).toEqual(['GB']);
  });

  it('accepte de tout retirer', () => {
    const avec = setRegions(EMPTY_JOURNAL, ['FR']);
    expect(setRegions(avec, []).regions).toEqual([]);
  });
});

/**
 * 🔴 Le test qui compte. Sans la relecture dans `parseJournal`, il echoue — et sans lui,
 * personne ne verrait que le reglage disparait a la sauvegarde suivante.
 */
describe('le champ survit a un aller-retour', () => {
  it('serialise puis relit les pays', () => {
    const avec = setRegions(EMPTY_JOURNAL, ['FR', 'GB']);
    expect(parseJournal(serializeJournal(avec)).regions).toEqual(['FR', 'GB']);
  });

  it('un journal sans pays n en invente pas', () => {
    expect(parseJournal(serializeJournal(EMPTY_JOURNAL)).regions).toBeUndefined();
  });

  it('un document venu d ailleurs avec des pays mal formes est nettoye, pas rejete', () => {
    const brut = JSON.stringify({ version: 4, regions: ['fr', 'XX', 42, 'GB'], entries: {} });
    expect(parseJournal(brut).regions).toEqual(['FR', 'XX', 'GB']);
  });
});

/**
 * ⚠️ Deux appareils, deux reglages. Sans union a la fusion, brancher un second appareil
 * effacerait en silence les pays choisis sur le premier.
 */
describe('la fusion garde les pays des deux cotes', () => {
  it('unit plutot que de choisir', () => {
    const a = setRegions(EMPTY_JOURNAL, ['FR']);
    const b = setRegions(EMPTY_JOURNAL, ['GB']);
    expect([...(mergeJournals(a, b).regions ?? [])].sort()).toEqual(['FR', 'GB']);
  });

  it('ne duplique pas un pays present des deux cotes', () => {
    const a = setRegions(EMPTY_JOURNAL, ['FR']);
    const b = setRegions(EMPTY_JOURNAL, ['FR']);
    expect(mergeJournals(a, b).regions).toEqual(['FR']);
  });

  it('un cote vide ne vide pas l autre', () => {
    const a = setRegions(EMPTY_JOURNAL, ['FR']);
    expect(mergeJournals(a, EMPTY_JOURNAL).regions).toEqual(['FR']);
    expect(mergeJournals(EMPTY_JOURNAL, a).regions).toEqual(['FR']);
  });
});

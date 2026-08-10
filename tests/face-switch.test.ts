import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  announceFace,
  EMPTY_JOURNAL,
  mergeJournals,
  parseJournal,
  serializeJournal,
} from '../src/domain/journal';

/**
 * 9.3 — l'annonce de la bascule.
 *
 * Ce qui se verrouille ici n'est pas l'animation, c'est la **memoire** qui la rend jouable
 * une seule fois. Sans elle, l'annonce se rejoue a chaque chargement de page — donc elle ne
 * veut plus rien dire ; mal ecrite, elle transforme un evenement en battement de coeur.
 */

const NOW = new Date('2026-08-11T09:00:00Z');

describe('announceFace retient ce qu on a montre', () => {
  it('ecrit la face et la date', () => {
    const journal = announceFace(EMPTY_JOURNAL, 'cutter', NOW);

    expect(journal.announcedFace).toEqual({ id: 'cutter', at: NOW.toISOString() });
  });

  /**
   * 🔴 **Le garde qui empeche l'annonce de devenir un battement de coeur.** Sans lui, chaque
   * rendu ecrirait une date neuve : nouveau journal, donc sauvegarde, donc synchronisation —
   * et `PublishActivity` se declenchant sur un changement de journal, un envoi reseau par
   * page affichee.
   */
  it('rend le journal TEL QUEL si la face est deja annoncee', () => {
    const une = announceFace(EMPTY_JOURNAL, 'cutter', NOW);
    const deux = announceFace(une, 'cutter', new Date('2026-08-11T10:00:00Z'));

    // L'egalite de reference est le test : une copie identique relancerait tout.
    expect(deux).toBe(une);
  });

  it('mais une vraie bascule ecrit bien', () => {
    const une = announceFace(EMPTY_JOURNAL, 'cutter', NOW);
    const deux = announceFace(une, 'rewatcher', new Date('2026-08-11T10:00:00Z'));

    expect(deux.announcedFace?.id).toBe('rewatcher');
  });
});

describe('l annonce survit a un aller-retour', () => {
  /**
   * ⚠️ Le defaut que ce test ferme est le plus banal du fichier `parse.ts`, et il s'est deja
   * produit deux fois : un champ que `parseJournal` ne relit pas est **efface a la premiere
   * sauvegarde**. Ici la consequence serait de rejouer l'annonce indefiniment.
   */
  it('serialiser puis relire preserve la face annoncee', () => {
    const journal = announceFace(EMPTY_JOURNAL, 'finisher', NOW);

    const relu = parseJournal(serializeJournal(journal));

    expect(relu.announcedFace).toEqual({ id: 'finisher', at: NOW.toISOString() });
  });

  it('une face inconnue est ecartee, pas gardee a moitie', () => {
    const relu = parseJournal(
      JSON.stringify({ version: 1, entries: {}, announcedFace: { id: 'wizard', at: '2026-08-11' } }),
    );

    expect(relu.announcedFace).toBeUndefined();
  });

  it('une annonce sans date est ecartee — elle ne pourrait pas fusionner', () => {
    const relu = parseJournal(
      JSON.stringify({ version: 1, entries: {}, announcedFace: { id: 'cutter' } }),
    );

    expect(relu.announcedFace).toBeUndefined();
  });
});

describe('la fusion tranche par la date, jamais par l ordre', () => {
  const tot = announceFace(EMPTY_JOURNAL, 'finisher', new Date('2026-08-01T00:00:00Z'));
  const tard = announceFace(EMPTY_JOURNAL, 'rewatcher', new Date('2026-08-09T00:00:00Z'));

  it('la plus recente gagne', () => {
    expect(mergeJournals(tot, tard).announcedFace?.id).toBe('rewatcher');
  });

  /**
   * 🔴 Le defaut qu'on ne refait pas : trancher par l'ordre des arguments, c'est-a-dire par
   * l'appareil qui a lance la fusion. C'est le `deviceId` de `sameJournal`, et ici la
   * consequence serait de rejouer sur le telephone une bascule deja vue sur l'ordinateur.
   */
  it('et le resultat ne depend pas de qui fusionne qui', () => {
    expect(mergeJournals(tard, tot).announcedFace?.id).toBe('rewatcher');
  });

  it('un cote sans annonce prend celle de l autre', () => {
    expect(mergeJournals(EMPTY_JOURNAL, tard).announcedFace?.id).toBe('rewatcher');
    expect(mergeJournals(tard, EMPTY_JOURNAL).announcedFace?.id).toBe('rewatcher');
  });
});

/**
 * Comme `publish-activity.test.ts` : ni un test de domaine ni un test de composant ne
 * prouvent qu'une page **monte** quoi que ce soit — et une annonce montee nulle part est
 * exactement la feature ecrite qui ne marche pas.
 */
describe('la bascule est annoncee depuis toutes les pages', () => {
  it('le chrome du site monte l annonce', () => {
    expect(readFileSync('app/components/SiteChrome.tsx', 'utf8')).toContain('<FaceSwitch />');
  });

  it('l annonce ecrit ce qu elle vient de montrer', () => {
    const source = readFileSync('app/components/FaceSwitch.tsx', 'utf8');
    expect(source).toContain('announceFace(current)');
  });

  /** Le mouvement se retire pour qui le refuse : un objet qui tourne deux fois sur lui-meme
   *  est exactement ce que ce reglage existe pour supprimer. */
  it('le retournement respecte prefers-reduced-motion', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const reduced = css.slice(css.indexOf('.mark[data-turning]'));
    expect(reduced).toContain('prefers-reduced-motion');
    expect(reduced.slice(reduced.indexOf('prefers-reduced-motion'))).toContain('data-turning');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_JOURNAL,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setHideHours,
} from '../src/domain/journal';
import { importForeign } from '../src/domain/import';

const NOW = new Date('2026-08-10T12:00:00Z');

/** 4.6 — le chiffre le plus spectaculaire du produit est aussi le plus anxiogene. */
describe('masquer le temps passe', () => {
  it('ancrage — pose et retire la preference', () => {
    expect(setHideHours(EMPTY_JOURNAL, true).hideHours).toBe(true);
    expect(setHideHours(setHideHours(EMPTY_JOURNAL, true), false).hideHours).toBeUndefined();
  });

  it('survit a un aller-retour', () => {
    const masque = setHideHours(EMPTY_JOURNAL, true);
    expect(parseJournal(serializeJournal(masque)).hideHours).toBe(true);
  });

  it("n'ecrit rien quand le chiffre s'affiche — le defaut ne se stocke pas", () => {
    expect(serializeJournal(EMPTY_JOURNAL)).not.toContain('hideHours');
  });

  /**
   * ⚠️ Asymetrique **volontairement** : un appareil qui affiche encore le chiffre n'a pas
   * choisi de l'afficher, il n'a pas ete regle. Se tromper vers le silence se rattrape en
   * un clic ; l'inverse remet sous les yeux un chiffre qu'on avait demande a ne plus voir.
   */
  it('le masquage gagne des qu un cote le demande', () => {
    const masque = setHideHours(EMPTY_JOURNAL, true);
    expect(mergeJournals(masque, EMPTY_JOURNAL).hideHours).toBe(true);
    expect(mergeJournals(EMPTY_JOURNAL, masque).hideHours).toBe(true);
  });
});

/**
 * 🔴 **Une preference qui ne vaut que pour un ecran sur deux n'est pas une preference.**
 *
 * Le masquage cachait le total de `MyTally` et laissait `MyYear` afficher « ce que pesent
 * les series terminees » juste au-dessus — le meme genre de chiffre, dans la carte
 * voisine. Trouve en auditant, pas en testant : les deux composants se lisent separement
 * et se voient ensemble.
 *
 * Ce test lit la source, comme `ordering-notice` : c'est le seul moyen de prouver qu'un
 * ecran **consulte** une preference, et le trou qu'`episodeMinutes` avait laisse.
 */
describe('le masquage vaut pour tous les comptes de temps passe', () => {
  const sources: readonly [string, string][] = [
    ['MyTally', 'app/components/MyTally.tsx'],
    ['MyYear', 'app/components/MyYear.tsx'],
  ];

  for (const [name, path] of sources) {
    it(`${name} consulte hideHours`, () => {
      expect(readFileSync(path, 'utf8')).toContain('hideHours');
    });
  }

  /**
   * ⚠️ Le temps **a venir** n'est pas concerne : « il vous reste ~9 h » n'est pas un compte
   * de ce qu'on a consomme, c'est le prix d'entree d'une decision. Le reglage porte sur le
   * regard en arriere.
   */
  it('mais pas le temps restant, qui n en est pas un', () => {
    expect(readFileSync('app/components/MyProgress.tsx', 'utf8')).not.toContain('hideHours');
  });
});

/** 4.7 — on signale, on ne repare jamais en silence. */
describe('les titres que l import n a pas repris', () => {
  const EXPORT = JSON.stringify([
    { title: 'Breaking Bad', tmdb_id: 1396, season: 1, episode: 3 },
    { title: 'Kaamelott', season: 2, episode: 4 },
    { title: 'Le Bureau des Legendes', season: 1, episode: 1 },
  ]);

  it('ancrage — reprend ce qui a un identifiant', () => {
    expect(importForeign(EXPORT, EMPTY_JOURNAL, NOW).imported).toBe(1);
  });

  it('🔴 nomme celles qu il a laissees, pas seulement leur nombre', () => {
    const outcome = importForeign(EXPORT, EMPTY_JOURNAL, NOW);
    expect(outcome.skipped).toBe(2);
    expect(outcome.missed).toEqual(['Kaamelott', 'Le Bureau des Legendes']);
  });

  /** Ces exports repetent une serie une fois par episode : la lister vingt fois n'aide pas. */
  it('ne repete pas un titre', () => {
    const repete = JSON.stringify([
      { title: 'Kaamelott', season: 1, episode: 1 },
      { title: 'Kaamelott', season: 1, episode: 2 },
      { title: 'Kaamelott', season: 1, episode: 3 },
    ]);
    expect(importForeign(repete, EMPTY_JOURNAL, NOW).missed).toEqual(['Kaamelott']);
  });

  it('borne la liste, pour qu elle reste lisible', () => {
    const enorme = JSON.stringify(
      Array.from({ length: 300 }, (_, i) => ({ title: `Serie ${i}`, season: 1, episode: 1 })),
    );
    expect(importForeign(enorme, EMPTY_JOURNAL, NOW).missed.length).toBeLessThanOrEqual(50);
  });

  it('se tait quand l export ne nomme rien', () => {
    const sansTitre = JSON.stringify([{ season: 1, episode: 1, rating: 4 }]);
    expect(importForeign(sansTitre, EMPTY_JOURNAL, NOW).missed).toEqual([]);
  });
});

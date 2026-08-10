import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_JOURNAL,
  journalKey,
  serializeJournal,
  setPosition,
  setSeasonRating,
  setSnapshot,
  type Journal,
} from '../src/domain/journal';
/**
 * Ce qu'une ecriture coute reellement (4.5).
 *
 * ## Pourquoi c'est une garde et pas un script
 *
 * `journals` stocke le document entier dans une colonne `jsonb`, et la synchronisation
 * fait un **UPSERT du document complet** a chaque sauvegarde. Le cout d'une ecriture n'est
 * donc pas celui du geste : c'est celui de **tout ce qu'on a jamais ecrit**.
 *
 * Ecrite en script, cette mesure aurait dormi. Ecrite en test, elle **echoue le jour ou le
 * document devient intransportable** — et c'est ce jour-la qu'il faut le savoir, pas le
 * jour ou quelqu'un pense a relancer un outil.
 *
 * On mesure le document **serialise et compresse** : ce qui part vraiment sur le reseau,
 * pas la taille en memoire, qui ne coute a personne.
 *
 * ## Le verdict, mesure le 2026-08-10
 *
 * ```
 *    10 series :    5 Ko brut →  <1 Ko compresse
 *    50 series :   26 Ko      →   1 Ko
 *   300 series :  168 Ko      →   3 Ko
 *  1000 series :  606 Ko      →  10 Ko   (0,21 s en 4G lente)
 * ```
 *
 * **La synchro par delta n'est pas necessaire.** Le `jsonb` se compresse tres bien parce
 * qu'il est massivement repetitif — les memes cles reviennent a chaque entree — et c'est
 * exactement ce que gzip mange le mieux. La question 4.5 est donc close par un chiffre.
 *
 * ⚠️ **Une reserve honnete sur ces nombres** : les fixtures utilisent des titres et des
 * chemins d'affiche tres proches les uns des autres, donc elles compressent mieux qu'un
 * vrai journal. Ce ne sont pas des mesures de production. Elles restent probantes parce
 * que l'ecart avec le seuil est d'un facteur cinquante, pas de dix pour cent — et les
 * seuils asserts ci-dessous portent, eux, sur des valeurs bien plus larges que le mesure.
 */

/** Un journal realiste : position, notes de saison, instantane complet. */
function journalOf(count: number, seasonsEach: number): Journal {
  let out = EMPTY_JOURNAL;
  const now = new Date('2026-08-10T12:00:00Z');
  for (let i = 0; i < count; i += 1) {
    const key = journalKey(String(100_000 + i));
    out = setPosition(out, key, seasonsEach, 8, now);
    for (let s = 1; s <= seasonsEach; s += 1) out = setSeasonRating(out, key, s, 4, now);
    // L'instantane est ce qui pese le plus : titre, affiche, statut, libelle traduit.
    out = setSnapshot(
      out,
      key,
      {
        title: `Une serie au titre de longueur realiste ${i}`,
        posterPath: `/aBcDeFgHiJkLmNoPqRsTuVwXyZ${i}.jpg`,
        status: 'between_seasons',
        statusLabel: 'Entre deux saisons',
      },
      now,
    );
  }
  return out;
}

/** Le poids compresse du document, en kilo-octets — ce qui traverse le reseau. */
function weightKb(journal: Journal): number {
  return Math.round(gzipSync(serializeJournal(journal)).length / 1024);
}

describe('ce qu une ecriture renvoie sur le reseau', () => {
  it('ancrage — un journal vide ne pese rien, la mesure mesure donc bien quelque chose', () => {
    expect(weightKb(EMPTY_JOURNAL)).toBe(0);
    expect(weightKb(journalOf(50, 4))).toBeGreaterThan(0);
  });

  it('50 series restent negligeables', () => {
    expect(weightKb(journalOf(50, 4))).toBeLessThan(16);
  });

  it('300 series — un usage deja tres nourri — restent confortables', () => {
    expect(weightKb(journalOf(300, 5))).toBeLessThan(64);
  });

  /**
   * ⚠️ Le seuil qui compte. Au-dela, chaque demi-etoile posee renverrait un demi-mega sur
   * une 4G lente, et la reponse serait une synchro **par delta** — jamais un broker : le
   * motif write-behind perd des donnees au crash, et le traumatisme fondateur de ce
   * produit est justement 26 M d'historiques perdus.
   */
  it('1000 series restent transportables en une seule ecriture', () => {
    const kb = weightKb(journalOf(1000, 6));
    expect(kb).toBeLessThan(512);
  });

  /**
   * 🔴 **Et le risque annonce n'etait pas la ou on le croyait.**
   *
   * La tache 4.5 disait : « les listes sont la premiere donnee de taille non bornee que le
   * produit offre ; un UPSERT jsonb reecrit tout, donc 500 titres repartent quand on ajoute
   * le 501e ». C'est **faux**, et il a fallu ecrire ce test pour s'en apercevoir : les
   * listes ne vivent pas dans le journal. Elles ont leur propre table (`007_lists.sql`),
   * donc ajouter un titre ecrit **une ligne**, pas un document.
   *
   * L'inquietude etait juste au moment ou elle a ete formulee — avant que 8.13 ne tranche
   * ou les listes vivraient. Elle n'a jamais ete relue apres la livraison.
   *
   * Ce qui reste vrai : le journal grandit avec les series suivies, et cela seul est borne
   * par un usage humain. Le test ci-dessus le mesure ; ce commentaire empeche de rouvrir
   * une inquietude deja resolue par l'architecture.
   */
  it('le journal ne porte aucune liste — elles ont leur table', () => {
    const out = journalOf(20, 3);
    expect(serializeJournal(out)).not.toContain('lists');
  });
});

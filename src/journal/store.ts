/**
 * Port de stockage du journal.
 *
 * Meme patron que `CatalogProvider`, et pour la meme raison :
 * **changer d'endroit ou l'on range les donnees doit rester un module a ecrire, jamais
 * une application a reecrire.**
 *
 * Ce n'est pas une abstraction de principe. Trois echeances connues passent par ici :
 *
 *   - **le multiplateforme** — cinq appareils, cinq journaux qui divergent : il faudra
 *     un `SyncingJournalStore` qui compose le local et le distant, et `mergeJournals`
 *     est deja ecrit pour lui ;
 *   - **les comptes** — un `RemoteJournalStore` sur Supabase, le jour ou A3/A6 seront
 *     tranches, sans toucher une seule ligne d'interface ;
 *   - **le volume** — `localStorage` relit et reecrit le journal entier a chaque geste,
 *     de facon synchrone. Invisible a vingt series, sensible a mille. Le remede est un
 *     `IndexedDbJournalStore`, c'est-a-dire une implementation de plus.
 *
 * ## Pourquoi l'interface est asynchrone
 *
 * `localStorage` est synchrone et il aurait ete plus simple de l'exposer tel quel —
 * mais un port synchrone **exclut par construction** le distant et IndexedDB,
 * c'est-a-dire exactement ce pour quoi ce port existe. Le cout est nul : l'interface
 * distingue deja « journal vide » de « pas encore lu ».
 */

import type { Journal } from '../domain/journal';

export interface JournalStore {
  /** Nom court, pour les diagnostics. */
  readonly name: string;

  /** Lit le journal. Ne leve jamais : un stockage inaccessible rend un journal vide. */
  load(): Promise<Journal>;

  /**
   * Ecrit le journal.
   *
   * Ne leve jamais non plus. Un quota plein ou une navigation privee ne doivent pas
   * faire echouer une interaction sous les yeux de l'utilisateur — le site reste
   * utilisable, simplement sans memoire.
   */
  save(journal: Journal): Promise<void>;

  /**
   * S'abonne aux changements venus d'ailleurs : un autre onglet, ou un autre appareil.
   *
   * ⚠️ Cette phrase disait « un autre onglet aujourd'hui, un autre appareil demain »
   * jusqu'au 2026-08-07. Demain est arrive au lot 6.3.
   *
   * @returns la fonction de desabonnement.
   */
  subscribe(listener: (journal: Journal) => void): () => void;
}

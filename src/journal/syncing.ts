/**
 * Le journal d'un compte connecte : local d'abord, serveur ensuite.
 *
 * Troisieme implementation du port {@link JournalStore}, et la seule qui en compose deux
 * autres. Elle n'invente aucune decision : `sync.ts` les a toutes prises, sans reseau et
 * sous test. Ici on branche.
 *
 * ## Le local est la source de verite, pas une copie
 *
 * `load()` **ne touche jamais au reseau**. C'est ce qui rend Q12 vraie *par construction* :
 * si Supabase tombe, si le projet est en pause, si l'on est dans un train — le produit
 * s'ouvre, affiche tout, et accepte les gestes. Une implementation qui lirait le serveur au
 * demarrage rendrait la panne d'un tiers visible sur chaque page, pour un gain nul : le
 * navigateur a deja le journal.
 *
 * > La synchronisation est un **rattrapage**, jamais un chemin critique.
 *
 * ## L'ecriture est debattue, et la lecture precede toujours l'ecriture
 *
 * Deux etoiles cliquees a une seconde d'intervalle ne doivent pas faire deux requetes. Mais
 * surtout, **pousser sans avoir lu ecraserait la ligne distante** : `RemoteJournalStore`
 * remplace le document entier. Chaque poussee est donc une synchronisation complete —
 * lire, fusionner, ecrire ce qui a change. La fusion etant commutative et idempotente
 * (`tests/journal-merge.test.ts`), deux appareils qui font cela dans leur propre ordre
 * convergent.
 *
 * ## Ce qui n'est PAS fait, et c'est un choix
 *
 * Aucune reprise automatique apres une panne reseau : pas de file d'attente, pas de
 * minuterie de reessai, pas d'ecoute de l'evenement `online`. Un geste fait hors ligne est
 * **garde en local** — la promesse du produit — et part a la prochaine synchronisation,
 * c'est-a-dire au prochain geste ou a la prochaine ouverture de page. Ecrire la mecanique
 * de reessai maintenant serait mecaniser un probleme qu'on n'a pas encore : le seul cas
 * qu'elle rattraperait est celui de quelqu'un qui fait un geste hors ligne **et ne revient
 * jamais**, auquel cas rien n'est perdu non plus, puisque le journal est chez lui.
 */

import type { Journal } from '../domain/journal';
import type { JournalStore } from './store';
import { syncJournals, type RemoteRead } from './sync';

/**
 * Ce que la synchronisation attend du cote distant.
 *
 * Volontairement plus etroit que `JournalStore` : ce qui compte ici est `read()`, qui
 * distingue « le compte n'a rien pousse » de « je n'ai pas pu lire ». `RemoteJournalStore`
 * satisfait cette forme sans le savoir — donc ce module ne connait ni PostgREST, ni
 * Supabase, ni `fetch`, et se teste avec un objet de dix lignes.
 */
export interface RemoteJournal {
  read(): Promise<RemoteRead>;
  save(journal: Journal): Promise<void>;
}

/** Le delai par defaut entre le dernier geste et la poussee. */
const PUSH_DELAY_MS = 2_000;

export interface SyncingJournalStoreOptions {
  readonly local: JournalStore;
  readonly remote: RemoteJournal;
  readonly delayMs?: number;
  /**
   * La minuterie, injectee.
   *
   * Le domaine n'a pas d'horloge implicite (`AGENTS.md` regle 2) et cette couche s'en tient
   * a la meme discipline : un test qui doit **attendre deux secondes** pour verifier un
   * debat est un test qu'on finit par supprimer.
   */
  readonly schedule?: (run: () => void, ms: number) => () => void;
}

function defaultSchedule(run: () => void, ms: number): () => void {
  const id = setTimeout(run, ms);
  return () => clearTimeout(id);
}

export class SyncingJournalStore implements JournalStore {
  readonly name = 'syncing';

  readonly #local: JournalStore;
  readonly #remote: RemoteJournal;
  readonly #delayMs: number;
  readonly #schedule: (run: () => void, ms: number) => () => void;

  #cancel: (() => void) | undefined;
  /** Une synchronisation en cours : on ne la double pas, on s'y raccroche. */
  #running: Promise<void> | undefined;
  #stopped = false;

  constructor(options: SyncingJournalStoreOptions) {
    this.#local = options.local;
    this.#remote = options.remote;
    this.#delayMs = options.delayMs ?? PUSH_DELAY_MS;
    this.#schedule = options.schedule ?? defaultSchedule;
  }

  /** Le journal de cet appareil. **Aucun appel reseau** — voir l'en-tete. */
  async load(): Promise<Journal> {
    return this.#local.load();
  }

  /**
   * Ecrit ici tout de suite, la-haut dans un instant.
   *
   * L'attente ne porte que sur le local : une etoile cliquee doit s'afficher a la vitesse
   * du navigateur, jamais a celle du reseau.
   */
  async save(journal: Journal): Promise<void> {
    await this.#local.save(journal);
    this.#schedulePush();
  }

  subscribe(listener: (journal: Journal) => void): () => void {
    return this.#local.subscribe(listener);
  }

  #schedulePush(): void {
    if (this.#stopped) return;
    // Chaque geste repousse l'echeance : c'est le debat. Une rafale de dix gestes fait une
    // synchronisation, pas dix.
    this.#cancel?.();
    this.#cancel = this.#schedule(() => {
      this.#cancel = undefined;
      void this.sync();
    }, this.#delayMs);
  }

  /**
   * Lit le distant, fusionne, et ecrit **uniquement** les cotes que la decision designe.
   *
   * ⚠️ L'issue `unavailable` n'ecrit **nulle part**. C'est la seule perte de donnees
   * possible de toute la synchronisation, et elle est nommee dans `sync.ts` : un `GET` rate
   * suivi d'un `POST` qui passe ecraserait un journal distant qu'on n'a pas pu fusionner.
   */
  async sync(): Promise<Journal> {
    if (this.#running !== undefined) await this.#running;
    if (this.#stopped) return this.#local.load();

    let resolve: () => void = () => {};
    this.#running = new Promise<void>((done) => {
      resolve = done;
    });

    try {
      const local = await this.#local.load();
      const remote = await this.#remote.read();
      const outcome = syncJournals(local, remote);

      // ⚠️ Le local d'abord : c'est lui que la personne voit. Si l'ecriture distante
      // echoue, la fusion reste acquise ici et repartira a la prochaine synchronisation.
      if (outcome.writeLocal) await this.#local.save(outcome.merged);
      if (outcome.writeRemote && !this.#stopped) await this.#remote.save(outcome.merged);
      return outcome.merged;
    } finally {
      this.#running = undefined;
      resolve();
    }
  }

  /** Pousse maintenant ce qui attendait. A appeler quand la page se ferme. */
  async flush(): Promise<void> {
    if (this.#cancel === undefined) return;
    this.#cancel();
    this.#cancel = undefined;
    await this.sync();
  }

  /**
   * Ferme la synchronisation — a la deconnexion, ou en quittant le composant.
   *
   * ⚠️ **Ce qui attendait n'est pas pousse.** Se deconnecter est un ordre : envoyer une
   * derniere fois vers le compte qu'on vient de quitter serait exactement le contraire de
   * ce qui a ete demande. Le journal, lui, reste en local et n'est pas perdu.
   */
  stop(): void {
    this.#stopped = true;
    this.#cancel?.();
    this.#cancel = undefined;
  }
}

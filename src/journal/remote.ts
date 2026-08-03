/**
 * Le journal range sur le serveur — implementation distante du port {@link JournalStore}.
 *
 * ## Pourquoi `fetch` et non le SDK Supabase
 *
 * Le SDK pese **670 Ko non compresses**, soit de l'ordre de 40 Ko une fois compresses —
 * un cinquieme du poids actuel de `/moi`, pour ce qui se resume ici a **un GET et un PUT
 * sur une seule table**. PostgREST est une API HTTP ordinaire ; le SDK n'apporte, pour cet
 * usage, qu'une syntaxe.
 *
 * ⚠️ **La conclusion inverse vaut pour l'authentification**, et elle est traitee ailleurs :
 * jetons, rafraichissement, PKCE et redirections sont de la securite, on ne les reecrit
 * pas a la main. Le SDK y est utilise, en import dynamique, pour ne peser que sur les
 * pages qui s'y connectent.
 *
 * ## Ce module ne decide rien
 *
 * Il transporte. Fusionner, adopter, savoir qui doit etre reecrit : tout cela vit dans
 * `sync.ts`, pur et teste sans reseau. Ici, on lit et on ecrit — et **on ne leve jamais**,
 * conformement au contrat du port : une panne de reseau doit degrader le produit, pas
 * l'interrompre. C'est aussi ce qui rend vraie la promesse « si la base tombe, le produit
 * continue » (`docs/ARCHITECTURE-APP.md` Q12).
 */

import { parseJournal, serializeJournal, type Journal } from '../domain/journal';
import { EMPTY_JOURNAL } from '../domain/journal';
import type { JournalStore } from './store';

export interface RemoteJournalOptions {
  /** Racine du projet Supabase, sans barre finale. */
  readonly url: string;
  /** Cle publique du projet. Destinee au navigateur : ce n'est pas un secret. */
  readonly anonKey: string;
  /**
   * Jeton d'acces du compte connecte, relu **a chaque appel**.
   *
   * Une fonction et non une valeur : un jeton se rafraichit, et le capturer une fois
   * ferait echouer toutes les requetes suivant le premier rafraichissement — avec une
   * erreur d'autorisation trompeuse, qui ferait chercher un probleme de droits.
   */
  readonly accessToken: () => string | undefined;
  /** Identifiant du compte connecte. */
  readonly userId: string;
  /** Injecte pour les tests. */
  readonly fetchImpl?: typeof fetch;
}

export class RemoteJournalStore implements JournalStore {
  readonly name = 'supabase';

  readonly #options: RemoteJournalOptions;
  readonly #fetch: typeof fetch;

  constructor(options: RemoteJournalOptions) {
    this.#options = options;
    this.#fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  #headers(): Record<string, string> {
    const token = this.#options.accessToken();
    return {
      apikey: this.#options.anonKey,
      // Sans jeton, la requete part avec la seule cle publique : RLS la rejettera, ce qui
      // est le comportement voulu. On ne fabrique pas d'erreur ici pour un cas que la
      // base traite deja correctement.
      Authorization: `Bearer ${token ?? this.#options.anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  #endpoint(): string {
    const base = this.#options.url.replace(/\/$/, '');
    return `${base}/rest/v1/journals`;
  }

  /**
   * Lit le journal du compte.
   *
   * Rend {@link EMPTY_JOURNAL} quand il n'y a rien **ou** quand l'appel echoue : le
   * contrat du port l'exige, et `syncJournals` sait distinguer les deux par ailleurs.
   */
  async load(): Promise<Journal> {
    const remote = await this.fetchDocument();
    return remote ?? EMPTY_JOURNAL;
  }

  /**
   * Le journal distant, ou `undefined` s'il n'y en a pas — **ou si l'appel a echoue**.
   *
   * ⚠️ Cette distinction compte : `syncJournals(local, undefined)` pousse le local. Sur
   * une panne reseau, on pousserait donc… rien, puisque l'ecriture echouera aussi. Le cas
   * degrade est sur : on n'ecrase jamais le distant avec le local sans l'avoir lu, parce
   * qu'une ecriture qui echoue ne detruit rien.
   */
  async fetchDocument(): Promise<Journal | undefined> {
    try {
      const url = `${this.#endpoint()}?user_id=eq.${encodeURIComponent(
        this.#options.userId,
      )}&select=document`;
      const response = await this.#fetch(url, { headers: this.#headers() });
      if (!response.ok) return undefined;

      const rows = (await response.json()) as readonly { document?: unknown }[];
      const document = rows[0]?.document;
      if (document === undefined) return undefined;

      // Le parsing tolerant s'applique **aussi** a ce qui vient de notre serveur
      // (`AGENTS.md` regle 4). Un document ecrit par une version plus recente du produit,
      // depuis un autre appareil, ne doit pas casser celui-ci.
      return parseJournal(JSON.stringify(document));
    } catch {
      // Hors ligne, DNS, CORS, base en pause : aucun de ces cas ne doit interrompre le
      // produit. Le journal local reste la source de verite.
      return undefined;
    }
  }

  /**
   * Ecrit le journal du compte.
   *
   * `Prefer: resolution=merge-duplicates` fait un veritable **upsert** : la premiere
   * synchronisation cree la ligne, les suivantes la remplacent, sans que l'appelant ait a
   * savoir laquelle est laquelle.
   */
  async save(journal: Journal): Promise<void> {
    try {
      // `updated_at` n'est **pas** envoye : le declencheur SQL le pose. Un client peut
      // mentir sur l'heure, et une horloge deregle de trois jours ferait passer une
      // ecriture ancienne pour la plus recente.
      const body = JSON.stringify({
        user_id: this.#options.userId,
        document: JSON.parse(serializeJournal(journal)) as unknown,
      });

      await this.#fetch(this.#endpoint(), {
        method: 'POST',
        headers: {
          ...this.#headers(),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body,
      });
    } catch {
      // Meme regle que le stockage local : une ecriture qui echoue ne doit pas faire
      // echouer une interaction sous les yeux de l'utilisateur.
    }
  }

  /**
   * Aucun abonnement.
   *
   * Le temps reel coute **une connexion permanente par visiteur** — exactement le cout
   * marginal par utilisateur qui a tue TV Time (`ROADMAP.md` §1.4). Les changements venus
   * d'un autre appareil sont vus a la synchronisation suivante, c'est-a-dire a l'ouverture
   * d'une page. Personne n'a besoin de voir arriver sa propre note d'un autre appareil a
   * la seconde pres.
   */
  subscribe(_listener: (journal: Journal) => void): () => void {
    return () => {};
  }
}

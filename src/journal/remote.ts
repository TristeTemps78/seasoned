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
 * continue » ( Q12).
 */

import { serializeJournal, tryParseJournal, type Journal } from '../domain/journal';
import { EMPTY_JOURNAL } from '../domain/journal';
import type { RemoteRead } from './sync';
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
   * contrat du port l'exige, et {@link read} distingue les deux pour qui en a besoin.
   */
  async load(): Promise<Journal> {
    const outcome = await this.read();
    return outcome.kind === 'found' ? outcome.journal : EMPTY_JOURNAL;
  }

  /**
   * Le journal distant, ou `undefined` s'il n'y en a pas **ou si l'appel a echoue**.
   *
   * ⚠️ Conserve pour les appelants qui n'ont pas besoin de la distinction. Celui qui
   * decide d'**ecrire** doit passer par {@link read} — voir le defaut documente la-bas.
   */
  async fetchDocument(): Promise<Journal | undefined> {
    const outcome = await this.read();
    return outcome.kind === 'found' ? outcome.journal : undefined;
  }

  /**
   * Lit le journal distant en distinguant les **trois** issues.
   *
   * ## 🔴 Le defaut que cette distinction repare
   *
   * `fetchDocument()` rendait `undefined` pour « le compte n'a rien pousse » **et** pour
   * « l'appel a echoue ». Or `syncJournals(local, undefined)` **pousse le local**, et le
   * `POST` remplace la ligne entiere.
   *
   * Le commentaire d'origine tenait ce cas pour sur : « une ecriture qui echoue ne detruit
   * rien ». C'est vrai quand le reseau est **entierement** mort — et faux dans le cas
   * **mixte**, qui est le plus banal : un `GET` qui echoue (delai depasse, 5xx passager,
   * jeton expire pile entre les deux appels) suivi d'un `POST` qui passe.
   *
   * > Alors on ecrase le journal distant avec un local **qu'on n'a pas fusionne**, parce
   * > qu'on n'a pas pu le lire. Tout ce qui n'existait que la-haut disparait.
   *
   * C'est la seule perte de donnees possible de toute la synchronisation, et elle vient
   * d'une valeur de retour qui repond « non » a deux questions differentes.
   */
  async read(): Promise<RemoteRead> {
    try {
      const url = `${this.#endpoint()}?user_id=eq.${encodeURIComponent(
        this.#options.userId,
      )}&select=document`;
      const response = await this.#fetch(url, { headers: this.#headers() });
      // Un statut d'erreur n'est PAS une absence : le compte a peut-etre un journal qu'on
      // n'a simplement pas pu lire.
      if (!response.ok) return { kind: 'unavailable' };

      const rows = (await response.json()) as readonly { document?: unknown }[];
      const document = rows[0]?.document;
      // Zero ligne, c'est une reponse : le compte n'a encore rien pousse.
      if (document === undefined) return { kind: 'absent' };

      // Le parsing tolerant s'applique **aussi** a ce qui vient de notre serveur
      // — mais un document qu'on ne sait pas lire n'est pas un
      // document vide. C'est le **troisieme** cas, celui que la reparation d'`undefined`
      // decrite plus haut n'avait pas vu : repondre `found` avec zero entree fait conclure
      // « le compte n'a rien », et la suite est identique au scenario ci-dessus.
      const read = tryParseJournal(JSON.stringify(document));
      if (read.kind === 'unreadable') return { kind: 'unavailable' };
      return { kind: 'found', journal: read.journal };
    } catch {
      // Hors ligne, DNS, CORS, base en pause : aucun de ces cas ne doit interrompre le
      // produit. Le journal local reste la source de verite.
      return { kind: 'unavailable' };
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
   * marginal par utilisateur qui a tue TV Time. Les changements venus
   * d'un autre appareil sont vus a la synchronisation suivante, c'est-a-dire a l'ouverture
   * d'une page. Personne n'a besoin de voir arriver sa propre note d'un autre appareil a
   * la seconde pres.
   */
  subscribe(_listener: (journal: Journal) => void): () => void {
    return () => {};
  }
}

/**
 * Le social, en `fetch` brut sur PostgREST.
 *
 * Meme choix que `src/journal/remote.ts`, et pour la meme raison : lire et ecrire quelques
 * lignes, c'est un GET et un POST. Le SDK n'apporterait qu'une syntaxe, pour ~40 Ko.
 * L'exception reste l'authentification, ou l'on ne reecrit pas des jetons a la main.
 *
 * **Ce module ne decide rien.** Il transporte, et **ne leve jamais** : une panne du social
 * ne doit pas interrompre un produit dont tout le reste est local.
 *
 * ## 🔴 {@link IDEMPOTENCE} — la regle qui manquait, et elle a coute quatre defauts
 *
 * `Prefer: resolution=merge-duplicates` **est** un `ON CONFLICT DO UPDATE`. Le chemin
 * `UPDATE` exige une politique `UPDATE`, et une table qui n'a rien a mettre a jour n'en a
 * pas — a raison. Ecrire deux fois y rend alors **42501**, silencieusement : `response.ok`
 * devient `false`, et aucun ecran ne dit rien.
 *
 * Le 2026-08-11, **quatre** ecritures sur cinq etaient dans ce cas — `activity`, `follows`,
 * `review_likes`, `list_items` — et l'une d'elles portait un commentaire promettant
 * exactement le contraire de ce qu'elle faisait.
 *
 * > **La resolution se choisit sur le contenu de la ligne, pas par habitude.**
 * >
 * > - La ligne porte une charge qui peut changer — une note, un texte, une saison
 * >   atteinte : `merge-duplicates`, **et la table doit avoir une politique `UPDATE`**.
 * >   C'est le cas de `activity` (les etoiles), `reviews` (le texte), `stops` (la saison).
 * > - La cle **est** le fait entier — je suis cette personne, j'aime cette critique, cette
 * >   serie est dans cette liste : `ignore-duplicates`. Rien a mettre a jour, donc aucun
 * >   droit d'`UPDATE` a accorder. Refaire le geste ne doit meme pas toucher `added_at`.
 *
 * Les scenarios 46 a 48 de `scripts/rls-scenarios.sql` tiennent cette regle contre la vraie
 * base : aucun test ne peut le faire, ils doublent `fetch`.
 */

import type { ActivityItem, ActivityKind } from '../domain/activity';
import type { StopBucket, StopRecord } from '../domain/attrition';
// ⚠️ `readFace` vient du domaine et n'a plus de copie ici : le controle etait le meme mot
// pour mot, et deux copies finissent par se repondre differemment le jour ou l'une est
// corrigee. `parseJournal` en a besoin aussi, depuis la face annoncee (9.3).
import { readFace, type FaceId } from '../domain/face';

export interface SocialOptions {
  readonly url: string;
  readonly anonKey: string;
  /** Relu a chaque appel : un jeton se rafraichit. */
  readonly accessToken: () => string | undefined;
  readonly fetchImpl?: typeof fetch;
  /**
   * 🔴 **Ce qui manquait pour qu'un echec cesse d'etre indiscernable d'un vide.**
   *
   * Ce module rend `[]` quand une lecture echoue, et `false` quand une ecriture echoue. La
   * promesse « ne leve jamais » est juste — une panne du social ne doit pas interrompre un
   * produit dont tout le reste est local — mais elle a un prix, et ce depot l'a paye deux
   * fois : *l'ecran d'un defaut est identique a celui d'un demarrage a froid.*
   *
   * 10.0 : trois lectures sociales repondaient **400 depuis toujours**, pour tout le monde,
   * et rien ne pouvait le signaler. 017 : quatre ecritures sur cinq echouaient en 42501, et
   * rien non plus.
   *
   * Ce rappel ne change **aucun** comportement par defaut : sans lui, tout se passe comme
   * avant. Il donne seulement a l'appelant de quoi distinguer « rien a montrer » de « je
   * n'ai pas pu lire », ce qu'aucune valeur de retour ne pouvait porter sans faire mentir
   * les vingt sites d'appel.
   *
   * @param where le chemin PostgREST concerne — de quoi nommer ce qui a echoue.
   * @param status le code HTTP, absent si la panne est reseau.
   */
  readonly onFailure?: (where: string, status?: number) => void;
}

export type Visibility = 'private' | 'followers' | 'public';

export interface Profile {
  readonly userId: string;
  readonly handle: string;
  readonly displayName?: string;
  readonly visibility: Visibility;
  /**
   * La face, si elle a ete publiee. Absente = sous le seuil, donc on se tait.
   *
   * ⚠️ Elle suit la visibilite du profil **sans qu'une regle de plus ait ete ecrite** :
   * c'est une colonne de `profiles`, et `profiles_select_visible` gouverne la ligne entiere.
   */
  readonly face?: FaceId;
}

/** Ce qui peut arriver quand on reclame un nom. */
export type ClaimOutcome =
  | { readonly kind: 'claimed'; readonly profile: Profile }
  /** Deja pris, ou reserve. Les deux se disent pareil : le nom n'est pas disponible. */
  | { readonly kind: 'taken' }
  | { readonly kind: 'failed' };

/** Les coeurs d'une critique, identifiee par son auteur et sa cible. */
export interface ReviewLikes {
  readonly authorId: string;
  readonly target: string;
  /** Stable pour tout le monde : compte par une fonction, pas par les lignes visibles. */
  readonly likes: number;
  /** Ai-je aime celle-la ? */
  readonly mine: boolean;
}

/** Une question de la manche, telle que le serveur accepte de la montrer. */
export interface QuizServed {
  readonly kind: string;
  /** Ce qu'on affiche : acteurs, notes, chemin d'affiche… La forme depend de `kind`. */
  readonly prompt: Record<string, unknown>;
  readonly choices: readonly string[];
  /** L'instant **serveur** ou le chronometre est parti. Affiche, jamais renvoye. */
  readonly askedAt: string;
}

export interface QuizVerdict {
  readonly correct: boolean;
  readonly points: number;
}

export interface QuizScore {
  readonly handle: string;
  readonly score: number;
  readonly rightAnswers: number;
  readonly face?: FaceId;
}

/** Une critique publiee, telle qu'elle revient du serveur. */
export interface PublishedReview {
  /**
   * La cle de journal de l'oeuvre — `tmdb:1396`.
   *
   * ⚠️ Redondante sur une fiche serie, **indispensable sur une page de profil** : la fiche
   * sait de quelle serie elle parle, un profil non. Sans elle, la page montrerait des textes
   * sans dire de quoi ils parlent.
   */
  readonly subject: string;
  /** `series` ou `season:3`. */
  readonly target: string;
  readonly text: string;
  readonly throughSeason: number;
  readonly lang: string;
  readonly publishedAt: string;
  readonly handle: string;
  readonly authorId: string;
  /** La face de l'auteur, si elle en a une. Voir {@link Profile.face}. */
  readonly face?: FaceId;
}

/**
 * Un profil public, augmente de **ce qu'il y a a lire chez lui**.
 *
 * Un seul nombre pour les critiques et les listes : ce qu'on veut dire a quelqu'un qui
 * hesite a cliquer n'est pas « 3 critiques et 2 listes », c'est « il y a quelque chose
 * ici ». Deux compteurs cote a cote se liraient comme un tableau de bord.
 */
export interface Discoverable extends Profile {
  readonly wrote: number;
}

/** Une liste, telle qu'une page de profil la montre — sans son contenu. */
export interface SeriesList {
  /** L'identifiant d'URL, derive du titre par `src/domain/lists.ts`. */
  readonly slug: string;
  readonly title: string;
  readonly note?: string;
  /**
   * Nombre de series dedans.
   *
   * ⚠️ Rendu par la base dans la meme requete (`list_items(count)`) et non par un appel par
   * liste : une page de profil qui montre dix listes en ferait sinon onze.
   */
  readonly count: number;
  readonly updatedAt: string;
}

/**
 * Le compte que PostgREST renvoie pour une relation imbriquee.
 *
 * Sa forme est `[{ count: 3 }]`, et elle **change selon la version** — un tableau vide
 * quand rien ne correspond. Parsing tolerant : tout ce qui n'est pas
 * un nombre lisible vaut zero, plutot qu'un `NaN` qui traverserait jusqu'a l'ecran.
 */
function countOf(value: unknown): number {
  const first = Array.isArray(value) ? value[0] : value;
  const count = (first as { count?: unknown } | undefined)?.count;
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

/** Un fait du fil, tel qu'il revient du serveur — augmente de son auteur. */
export interface FeedItem extends ActivityItem {
  readonly handle: string;
  /** L'auteur du fait — necessaire pour pouvoir le signaler. */
  readonly authorId: string;
  /** Sa face, si elle en a une. Voir {@link Profile.face}. */
  readonly face?: FaceId;
}

/**
 * Les genres que ce navigateur sait afficher.
 *
 * Derive du type, donc **impossible a oublier** : ajouter un `ActivityKind` sans l'ajouter
 * ici ne compile pas. C'est le meme procede que `REPORT_GROUNDS` sur `/regles`, ou le typage
 * interdit d'appliquer une regle qu'on n'a pas publiee.
 */
const KNOWN_KINDS: Readonly<Record<ActivityKind, true>> = {
  rated_season: true,
  finished: true,
  started: true,
  wanted: true,
  liked: true,
};

function isKnownKind(value: unknown): value is ActivityKind {
  return typeof value === 'string' && Object.hasOwn(KNOWN_KINDS, value);
}

function rowToProfile(row: Record<string, unknown>): Profile {
  const face = readFace(row['face']);
  return {
    userId: String(row['user_id']),
    handle: String(row['handle']),
    ...(typeof row['display_name'] === 'string' ? { displayName: row['display_name'] } : {}),
    visibility: (row['visibility'] as Visibility) ?? 'followers',
    ...(face !== undefined ? { face } : {}),
  };
}

export class SocialClient {
  readonly #options: SocialOptions;
  readonly #fetch: typeof fetch;

  constructor(options: SocialOptions) {
    this.#options = options;
    this.#fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    const token = this.#options.accessToken();
    return {
      apikey: this.#options.anonKey,
      Authorization: `Bearer ${token ?? this.#options.anonKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  #url(path: string): string {
    return `${this.#options.url.replace(/\/$/, '')}/rest/v1/${path}`;
  }

  /**
   * Les lignes d'une lecture PostgREST — **toujours un tableau**.
   *
   * 🔴 **Ce que la version precedente laissait passer.** Elle rendait `T | undefined` et
   * transtypait le corps sans le regarder (`as T`). Le `try/catch` couvrait le reseau et
   * le decodage, mais **pas le post-traitement**, qui vit chez l'appelant : un corps JSON
   * valide de la mauvaise forme — un objet la ou l'on attend un tableau — passait le garde
   * `rows === undefined`, puis `rows.map(...)` levait. Et `??  []` ne rattrape que
   * `null`/`undefined`, jamais un objet : c'est le piege du `??` que ce depot documente
   * deja pour `TMDB_LANGUAGE`.
   *
   * Le module promet en tete de fichier qu'il **ne leve jamais**. La promesse tenait pour
   * la panne et pas pour la reponse inattendue — or `Reviews.tsx` l'a crue et n'a pose
   * aucun `.catch`, donc une reponse mal formee y devenait un rejet non gere.
   *
   * Rendre `[]` plutot que `undefined` n'efface aucune information : les six appelants
   * lisaient tous une liste, et « erreur » comme « aucune ligne » y menaient deja au meme
   * ecran. Le type dit maintenant ce que le module fait.
   */
  /**
   * Le seul endroit ou une panne est **nommee**. Voir {@link SocialOptions.onFailure} : le
   * rappel ne doit jamais pouvoir casser ce qu'il observe, donc son propre echec est avale.
   */
  #failed(where: string, status?: number): void {
    try {
      this.#options.onFailure?.(where, status);
    } catch {
      /* Un observateur qui leve ne doit pas faire tomber ce qu'il observe. */
    }
  }

  async #rows<T>(path: string): Promise<readonly T[]> {
    try {
      const response = await this.#fetch(this.#url(path), { headers: this.#headers() });
      if (!response.ok) {
        this.#failed(path, response.status);
        return [];
      }
      const body: unknown = await response.json();
      // ⚠️ Une reponse 200 de la mauvaise **forme** est un echec aussi, et c'est celui qui
      // se voit le moins : un portail captif rend du HTML en 200.
      if (!Array.isArray(body)) {
        this.#failed(path, response.status);
        return [];
      }
      return body as T[];
    } catch {
      this.#failed(path);
      return [];
    }
  }

  /** Mon profil, ou `undefined` si je n'en ai pas encore reclame un. */
  async myProfile(userId: string): Promise<Profile | undefined> {
    const rows = await this.#rows<Record<string, unknown>>(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`,
    );
    const row = rows[0];
    return row === undefined ? undefined : rowToProfile(row);
  }

  /**
   * Reclame un nom.
   *
   * ⚠️ La disponibilite **n'est pas verifiee avant** : entre la verification et l'ecriture,
   * quelqu'un d'autre peut prendre le nom. C'est l'unicite de la base qui tranche, et le
   * conflit qui remonte ici — verifier d'abord ne ferait que rendre la course plus rare,
   * donc le defaut plus difficile a reproduire.
   */
  async claim(userId: string, handle: string, visibility: Visibility): Promise<ClaimOutcome> {
    try {
      const response = await this.#fetch(this.#url('profiles'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'return=representation' }),
        body: JSON.stringify({ user_id: userId, handle, visibility }),
      });
      if (response.ok) {
        const rows = (await response.json()) as Record<string, unknown>[];
        const row = rows[0];
        return row === undefined
          ? { kind: 'failed' }
          : { kind: 'claimed', profile: rowToProfile(row) };
      }
      // 409 : unicite. 400 : le declencheur des noms reserves, ou la forme refusee.
      return response.status === 409 || response.status === 400
        ? { kind: 'taken' }
        : { kind: 'failed' };
    } catch {
      return { kind: 'failed' };
    }
  }

  /**
   * Publie sa face.
   *
   * ⚠️ **A n'appeler que quand elle a change**, contrairement a `publish()` et
   * `publishReview()` qui renvoient tout a chaque passage. Ces deux-la poussent des **faits**,
   * dont la cle naturelle absorbe les republications ; une face est un **etat**, donc la
   * reecrire a l'identique est une requete pour rien a chaque ouverture de page.
   *
   * `undefined` efface la colonne : c'est ce qui arrive quand on repasse sous le seuil, par
   * exemple apres avoir efface des decisions. La face doit alors se taire, pas rester figee
   * sur ce qu'elle etait.
   */
  async setFace(userId: string, face: FaceId | undefined): Promise<boolean> {
    return this.#write(`profiles?user_id=eq.${encodeURIComponent(userId)}`, 'PATCH', {
      face: face ?? null,
    });
  }

  async setVisibility(userId: string, visibility: Visibility): Promise<boolean> {
    try {
      const response = await this.#fetch(
        this.#url(`profiles?user_id=eq.${encodeURIComponent(userId)}`),
        { method: 'PATCH', headers: this.#headers(), body: JSON.stringify({ visibility }) },
      );
      if (!response.ok) this.#failed('profiles', response.status);
      return response.ok;
    } catch {
      this.#failed('profiles');
      return false;
    }
  }

  /**
   * Cherche quelqu'un par son nom.
   *
   * ⚠️ Correspondance **exacte**, jamais partielle : une recherche approchante sur les
   * profils est un annuaire, c'est-a-dire un moyen de parcourir les gens. Ici on ne trouve
   * que quelqu'un dont on connait deja le nom.
   */
  async findByHandle(handle: string): Promise<Profile | undefined> {
    const rows = await this.#rows<Record<string, unknown>>(
      `profiles?handle=eq.${encodeURIComponent(handle)}&select=*`,
    );
    const row = rows[0];
    return row === undefined ? undefined : rowToProfile(row);
  }

  /**
   * 🔴 **`ignore-duplicates` et non `merge-duplicates`** — mesure du 2026-08-11 : suivre
   * deux fois rendait **42501**.
   *
   * `merge-duplicates` est un `ON CONFLICT DO UPDATE`, et le chemin `UPDATE` exige une
   * politique `UPDATE` que `follows` n'a pas — a raison, puisqu'il n'y a rien a mettre a
   * jour. Voir {@link IDEMPOTENCE} : quand la cle **est** le fait entier, la bonne
   * resolution est `DO NOTHING`.
   */
  async follow(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url('follows'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
        body: JSON.stringify({ follower_id: followerId, followee_id: followeeId }),
      });
      if (!response.ok) this.#failed('follows', response.status);
      return response.ok;
    } catch {
      this.#failed('follows');
      return false;
    }
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const response = await this.#fetch(
        this.#url(
          `follows?follower_id=eq.${encodeURIComponent(followerId)}&followee_id=eq.${encodeURIComponent(followeeId)}`,
        ),
        { method: 'DELETE', headers: this.#headers() },
      );
      if (!response.ok) this.#failed('follows', response.status);
      return response.ok;
    } catch {
      this.#failed('follows');
      return false;
    }
  }

  /** Les profils que je suis. */
  async following(followerId: string): Promise<readonly Profile[]> {
    const rows = await this.#rows<{ followee_id: string }>(
      `follows?follower_id=eq.${encodeURIComponent(followerId)}&select=followee_id`,
    );
    return this.#profilesOf(rows.map((row) => row.followee_id));
  }

  /**
   * Les profils qui me suivent — le pendant manquant du lot 6.
   *
   * ⚠️ **Sans `008_followers.sql`, cette methode rend une liste vide et personne ne le
   * signale.** `follows_select_mine` rend bien la ligne d'abonnement (`auth.uid() =
   * followee_id`), donc on **sait** que quelqu'un suit ; mais `profiles_select_visible`
   * passe par `can_see()`, qui exige de suivre en retour. Un abonne en visibilite
   * `followers` — la valeur par defaut — n'aurait donc **aucun nom** a afficher.
   *
   * ⚠️ La liste rendue peut etre **plus courte** que le nombre d'abonnements, et c'est
   * voulu : un compte sans handle n'a pas de ligne dans `profiles`, donc rien a montrer.
   * `008` refuse desormais qu'il suive — mais les lignes anterieures, elles, restent.
   * C'est aussi pourquoi rien n'affiche de **compteur** : il ne collerait pas aux noms.
   */
  async followers(followeeId: string): Promise<readonly Profile[]> {
    const rows = await this.#rows<{ follower_id: string }>(
      `follows?followee_id=eq.${encodeURIComponent(followeeId)}&select=follower_id`,
    );
    return this.#profilesOf(rows.map((row) => row.follower_id));
  }

  /**
   * Les profils d'une liste d'identifiants, en un appel.
   *
   * Le corps commun de {@link following} et {@link followers}, qui ne different que par la
   * colonne lue. Meme motif que {@link #reviews}, et pour la meme raison : deux copies du
   * meme parsing finissent par se repondre differemment le jour ou l'une est corrigee.
   *
   * L'appel est evite quand il n'y a rien a demander — `in.()` est une requete vide envoyee
   * pour rien.
   */
  async #profilesOf(ids: readonly string[]): Promise<readonly Profile[]> {
    if (ids.length === 0) return [];
    const rows = await this.#rows<Record<string, unknown>>(
      `profiles?user_id=in.(${ids.map(encodeURIComponent).join(',')})&select=*`,
    );
    return rows.map(rowToProfile);
  }

  /**
   * Le fil.
   *
   * Un seul appel, jointure cote PostgREST : sans elle il faudrait une requete par personne
   * suivie, c'est-a-dire un cout qui grandit avec le nombre d'amis — exactement le cout
   * marginal par utilisateur que ce produit refuse partout ailleurs.
   *
   * RLS fait le filtrage : on demande tout, la base ne rend que le visible.
   */
  async feed(limit = 50): Promise<readonly FeedItem[]> {
    return this.#activity('', limit);
  }

  /**
   * Qui d'autre a **aime** ou **termine** cette serie.
   *
   * ## La porte de decouverte principale, restee fermee jusqu'ici
   *
   * `Discover.tsx` la nomme lui-meme : *« on croise quelqu'un parce que son avis sur une
   * serie nous interesse, pas parce qu'on cherchait des gens »*. Le nom de l'auteur d'une
   * critique y menait deja ; encore faut-il avoir **ecrit**. Un coeur, lui, se pose en un
   * clic — donc cette porte s'ouvre sur une population bien plus large.
   *
   * **Zero table neuve, zero route serveur** : `activity_select_visible` porte
   * `can_see(user_id)`, donc un visiteur anonyme ne voit que les profils `public` et un
   * lecteur connecte y ajoute ceux qu'il suit. Le filtre de visibilite n'est pas ecrit ici,
   * et ne doit pas l'etre : le refaire donnerait deux sources de verite pour une meme regle.
   *
   * ## ⚠️ `liked` et `finished` seulement, et la raison n'est pas le hasard
   *
   * pose la question juste : *ce fait decrit-il l'oeuvre ou quelqu'un
   * d'autre ?* Ces deux-la ne portent **aucun numero de saison** — ils ne peuvent donc rien
   * apprendre de l'interieur de la serie. Un `rated_season` en dirait, lui : « quelqu'un a
   * note la saison 6 » apprend qu'il existe une saison 6. Il exigerait `redactActivity` et
   * la position du lecteur, c'est-a-dire la mecanique du fil — pour un encart qui n'en a pas
   * besoin. `started` et `wanted` sont ecartes pour une autre raison : ils ne disent rien de
   * ce qu'on en a pense, donc ils ne donnent aucune envie d'ouvrir un profil.
   */
  async watchersOf(subject: string, limit = 12): Promise<readonly FeedItem[]> {
    return this.#activity(
      `subject=eq.${encodeURIComponent(subject)}&kind=in.(liked,finished)&`,
      limit,
    );
  }

  /**
   * Le corps commun des deux lectures du fil — elles ne different que par leur filtre.
   *
   * Meme motif que {@link #reviews}, et pour la meme raison : ce parsing tolerant **ecarte**
   * les lignes sans auteur et les genres inconnus, et deux copies de ce rejet finiraient par
   * se repondre differemment le jour ou l'une serait corrigee.
   */
  async #activity(filter: string, limit: number): Promise<readonly FeedItem[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `activity?${filter}select=kind,subject,season,stars,happened_on,profiles!inner(handle,user_id,face)&order=happened_on.desc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as
        | { handle?: unknown; user_id?: unknown; face?: unknown }
        | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const face = readFace(author.face);
      // ⚠️ Le genre est **valide**, pas simplement transtype. Il vient du serveur, mais
      // le serveur est en avance sur ce navigateur des qu'un deploiement ajoute un genre
      // — c'est exactement ce que fait `005_liked.sql`. Un `as` laissait alors passer une
      // valeur pour laquelle il n'existe aucune cle de dictionnaire, et la ligne
      // s'affichait **muette**. Regle 4 : on ecarte ce qu'on ne sait pas lire.
      if (!isKnownKind(row['kind'])) return [];

      const season = row['season'];
      const stars = row['stars'];
      return [
        {
          kind: row['kind'],
          subject: row['subject'] as FeedItem['subject'],
          happenedOn: String(row['happened_on']),
          handle: author.handle,
          authorId: author.user_id,
          ...(face !== undefined ? { face } : {}),
          ...(typeof season === 'number' ? { season } : {}),
          ...(stars === null || stars === undefined
            ? {}
            : { stars: Number(stars) as FeedItem['stars'] }),
        } as FeedItem,
      ];
    });
  }

  /**
   * Pousse mon activite.
   *
   * `merge-duplicates` sur la cle naturelle : republier les memes faits ne duplique rien,
   * ce qui permet de pousser **tout** ce qui est publiable a chaque fois plutot que de
   * tenir un journal de ce qui a deja ete envoye — un etat de plus a synchroniser, et donc
   * un etat de plus a desynchroniser.
   *
   * ⚠️ **`on_conflict` est nomme, et il doit l'etre.** Sans lui, PostgREST vise la cle
   * **primaire** — or `017` l'a retiree au profit de `activity_fait`, qui porte `season`.
   * La cle d'origine confondait deux saisons notees le meme jour, ce qui faisait echouer
   * l'envoi entier en `21000` (voir `017_activity_saison.sql`, et le dedoublonnage de
   * `projectActivity` qui en est l'autre moitie).
   */
  async publish(userId: string, items: readonly ActivityItem[]): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const response = await this.#fetch(
        this.#url('activity?on_conflict=user_id,kind,subject,season,happened_on'),
        {
          method: 'POST',
          headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(
            items.map((item) => ({
              user_id: userId,
              kind: item.kind,
              subject: item.subject,
              season: item.season ?? null,
              stars: item.stars ?? null,
              happened_on: item.happenedOn,
            })),
          ),
        },
      );
      if (!response.ok) this.#failed('activity', response.status);
      return response.ok;
    } catch {
      this.#failed('activity');
      return false;
    }
  }

  /**
   * Pousse ma contribution a la carte des abandons.
   *
   * Meme mecanique que {@link publish} : `merge-duplicates` sur `(user_id, subject)`, donc
   * on renvoie tout a chaque passage plutot que de tenir un registre de ce qui est deja
   * parti — un etat de plus a synchroniser serait un etat de plus a desynchroniser.
   *
   * ⚠️ **Rien ne revient, et ce n'est pas le meme « rien » que {@link report}.** Ici la
   * table n'a aucune politique de lecture parce que l'anonymat *est* la fonctionnalite :
   * personne ne relit ces lignes, pas meme leur auteur. C'est pour ca qu'on republie sans
   * jamais comparer — il n'y a rien a quoi comparer.
   */
  async publishStops(userId: string, records: readonly StopRecord[]): Promise<boolean> {
    if (records.length === 0) return true;
    try {
      const response = await this.#fetch(this.#url('stops'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(
          records.map((record) => ({
            user_id: userId,
            subject: record.subject,
            reached_season: record.reachedSeason,
            left_at_season: record.leftAtSeason ?? null,
          })),
        ),
      });
      if (!response.ok) this.#failed('stops', response.status);
      return response.ok;
    } catch {
      this.#failed('stops');
      return false;
    }
  }

  /**
   * Sortir entierement de la carte des abandons.
   *
   * ⚠️ **Retroactif, et c'est la seule forme honnete.** Cesser de publier laisserait en
   * place tout ce qui a deja ete pose : quelqu'un qui se retire resterait dans la carte
   * pour toujours, sans aucun moyen de le verifier — la table etant illisible, il n'aurait
   * meme pas de quoi constater le probleme. Le refus efface donc, il ne se contente pas de
   * se taire.
   *
   * ## 🔴 Pourquoi une RPC et non un `DELETE` filtre, comme partout ailleurs ici
   *
   * Parce que le `DELETE` filtre **n'efface rien** : Postgres applique aussi les politiques
   * `select` a un `DELETE` porteur d'une clause `WHERE`, et `stops` n'en a aucune. La
   * requete voit zero ligne, en efface zero, et repond **204** — donc `ok`. Mesure contre
   * la vraie base le 2026-08-10 ; aucun test ne pouvait le voir, ils doublent `fetch`.
   *
   * ⚠️ **Ne pas « simplifier » ceci en `DELETE stops?user_id=eq.…`.** C'est exactement le
   * code qui a ete ecrit d'abord, il compile, il repond `true`, et il ne fait rien.
   */
  async forgetStops(): Promise<boolean> {
    return this.#write('rpc/forget_stops', 'POST', {});
  }

  /**
   * La courbe de survie d'une serie — combien atteignent chaque saison, combien s'y
   * arretent.
   *
   * ⚠️ **Rend `[]` aussi bien quand la serie n'a pas assez de contributeurs que quand
   * l'appel echoue** : `stop_map()` se tait sous son plancher, et `#rpc` ne leve jamais.
   * Les deux silences sont indistinguables ici, et c'est assume — mais c'est exactement le
   * mecanisme du defaut 10.0, ou un 400 ressemblait a un demarrage a froid. La distinction,
   * si elle doit se faire un jour, se fera contre la vraie base, pas dans ce code.
   */
  async stopMap(subject: string): Promise<readonly StopBucket[]> {
    const rows = await this.#rpc<Record<string, unknown>>('stop_map', {
      for_subject: subject,
    });
    return rows.flatMap((row) => {
      const season = Number(row['season']);
      // Une saison qui n'est pas un nombre n'est pas une saison. Meme prudence que partout
      // ici : le serveur peut etre en avance sur le navigateur.
      if (!Number.isFinite(season)) return [];
      return [
        {
          season,
          reached: Number(row['reached'] ?? 0),
          leftHere: Number(row['left_here'] ?? 0),
        },
      ];
    });
  }

  /**
   * Signale quelqu'un.
   *
   * ⚠️ **Rien ne revient, et c'est voulu.** La table n'a aucune politique de lecture : un
   * signalement relisible par son auteur devient un accuse de reception, donc une promesse
   * de suivi a tenir dans l'interface. La reponse passe par l'adresse annoncee sur
   * `/regles`. Ici on rend seulement « c'est parti » ou « ca n'est pas parti ».
   */
  async report(reporterId: string, subjectId: string, ground: string, note?: string): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url('reports'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          reporter_id: reporterId,
          subject_id: subjectId,
          ground,
          ...(note === undefined || note.trim().length === 0 ? {} : { note: note.trim() }),
        }),
      });
      // 409 : deja signale pour ce motif. Le dire comme un echec serait pousser a
      // recommencer ; c'est un succes du point de vue de la personne.
      return response.ok || response.status === 409;
    } catch {
      return false;
    }
  }

  /**
   * Publie — ou republie — une critique.
   *
   * `merge-duplicates` sur la cle naturelle `(user_id, subject, target)` : corriger son
   * texte remplace la ligne, ne la duplique pas. Meme mecanique que `publish()`.
   */
  async publishReview(
    userId: string,
    subject: string,
    target: string,
    review: { readonly text: string; readonly throughSeason: number; readonly lang: string },
  ): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url('reviews'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({
          user_id: userId,
          subject,
          target,
          body: review.text,
          through_season: review.throughSeason,
          lang: review.lang,
        }),
      });
      if (!response.ok) this.#failed('reviews', response.status);
      return response.ok;
    } catch {
      this.#failed('reviews');
      return false;
    }
  }

  /** Retire une critique publiee. Le texte reste dans le journal de son auteur. */
  /**
   * ⚠️ **Ici vivait `unpublishReview()`, retiree le 2026-08-07.**
   *
   * Zero appelant, zero test — le motif exact que ce depot documente comme sa panne la
   * plus chere : `setVisibility()` et `unfollow()` ont vecu deux lots sans appelant, ce qui
   * rendait tout le social illisible sans que rien ne le signale.
   *
   * 🔴 **Et la garder etait pire que l'oublier.** Elle faisait un `DELETE` dur, alors que
   * `/regles` promet « on masque, on ne supprime jamais » et que `006_reviews.sql` porte
   * `hidden_at` precisement pour rendre cette promesse executable. La phrase publique sur
   * le **retrait d'une critique par son auteur** n'est pas encore ecrite :
   * on avait donc du code qui supprime, et aucune regle publiee qui dise ce qu'il fait.
   *
   * *On ecrit le geste le jour ou l'on ecrit ce qu'il promet* — 8.9 tranchera masquer ou
   * supprimer, et la methode reviendra avec son bouton.
   */

  /**
   * Les critiques publiees sur une serie.
   *
   * ⚠️ Aucun caviardage ici : RLS decide **qui** peut lire, le navigateur decide **quoi**
   * afficher (`redactReviews`, avec le journal du lecteur). Le serveur ne sait pas ou en
   * est le lecteur, et c'est precisement ce qui empeche sa position de fuir.
   */
  async reviewsFor(subject: string, limit = 30): Promise<readonly PublishedReview[]> {
    return this.#reviews(`subject=eq.${encodeURIComponent(subject)}`, limit);
  }

  /**
   * Les critiques ecrites **par quelqu'un** — ce que sa page de profil montre.
   *
   * ⚠️ **Aucun controle de visibilite ici, et c'est voulu** : la politique `reviews_select`
   * porte `can_see(user_id)`, donc la base rend une liste **vide** a qui n'a pas le droit de
   * lire, sans que le client ait a le savoir. Refaire le test cote navigateur donnerait deux
   * sources de verite pour une meme regle — et c'est celle du client qui se perime.
   *
   * ⚠️ Le `subject` est rendu **en plus** du reste : sur une fiche serie on sait de quelle
   * serie on parle, sur un profil non. Sans lui, la page afficherait des textes sans dire
   * de quoi ils parlent.
   */
  async reviewsBy(userId: string, limit = 30): Promise<readonly PublishedReview[]> {
    return this.#reviews(`user_id=eq.${encodeURIComponent(userId)}`, limit);
  }

  /**
   * Les critiques recentes de tout ce que je peux lire — la seconde moitie du fil.
   *
   * ## Pourquoi une lecture de plus, et pas un genre d'activite
   *
   * `activity` est **derivee du journal**, et une critique n'y vit pas : elle a sa table et
   * sa moderation. L'y projeter donnerait un second etat a tenir d'accord avec le premier,
   * et une critique retiree resterait annoncee dans le fil. `src/domain/feed.ts` range les
   * deux listes ensemble ; c'est le seul endroit qui decide de l'ordre.
   *
   * ⚠️ **Aucun filtre de visibilite ici**, comme {@link reviewsBy} : `reviews_select` porte
   * `can_see(user_id)` **et** ecarte ce qui est masque. On demande tout, la base ne rend que
   * le lisible. Le refaire ici donnerait deux sources de verite pour une meme regle.
   *
   * ⚠️ Le cout est **borne** : un appel, quel que soit le nombre de personnes suivies. C'est
   * la meme raison qui a fait choisir la jointure PostgREST pour {@link feed} — une requete
   * par ami est exactement le cout marginal par utilisateur que ce produit refuse.
   */
  async feedReviews(limit = 30): Promise<readonly PublishedReview[]> {
    return this.#reviews('', limit);
  }

  /**
   * Les coeurs des critiques d'une serie : combien, et si j'en fais partie.
   *
   * ⚠️ **Un appel pour toute la page**, jamais un par critique : une fiche en affiche dix,
   * et dix appels seraient dix fois le cout que ce produit refuse partout.
   *
   * ⚠️ Le compte vient d'une fonction `security definer`, donc il est **le meme pour tout
   * le monde**. C'est ce qui le distingue du compteur refuse en 10.2 : celui-la comptait
   * des lignes rendues par RLS, donc il variait d'un lecteur a l'autre.
   */
  async reviewLikes(subject: string): Promise<readonly ReviewLikes[]> {
    const rows = await this.#rpc<Record<string, unknown>>('review_like_counts', {
      for_subject: subject,
    });
    return rows.flatMap((row) =>
      typeof row['author_id'] !== 'string' || typeof row['target'] !== 'string'
        ? []
        : [
            {
              authorId: row['author_id'],
              target: row['target'],
              likes: Number(row['likes'] ?? 0),
              mine: row['mine'] === true,
            },
          ],
    );
  }

  /**
   * Aime une critique, ou retire son coeur.
   *
   * ⚠️ Un coeur **se reprend** — ce n'est pas un fait vecu, contrairement a un visionnage.
   * D'ou un `delete` reel et non une pierre tombale.
   */
  async likeReview(
    userId: string,
    authorId: string,
    subject: string,
    target: string,
    liked: boolean,
  ): Promise<boolean> {
    try {
      if (!liked) {
        const response = await this.#fetch(
          this.#url(
            `review_likes?liker_id=eq.${encodeURIComponent(userId)}` +
              `&author_id=eq.${encodeURIComponent(authorId)}` +
              `&subject=eq.${encodeURIComponent(subject)}` +
              `&target=eq.${encodeURIComponent(target)}`,
          ),
          { method: 'DELETE', headers: this.#headers() },
        );
        if (!response.ok) this.#failed('review_likes', response.status);
        return response.ok;
      }
      const response = await this.#fetch(this.#url('review_likes'), {
        method: 'POST',
        // 🔴 « Aimer deux fois ne doit pas lever, c'est le meme etat » — c'est ce que cette
        // ligne promettait, et elle rendait **42501**. `merge-duplicates` emprunte le chemin
        // `UPDATE`, que RLS refuse ici faute de politique. La promesse etait juste, la
        // resolution non : voir {@link IDEMPOTENCE}.
        headers: this.#headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
        body: JSON.stringify({
          liker_id: userId,
          author_id: authorId,
          subject,
          target,
        }),
      });
      if (!response.ok) this.#failed('review_likes', response.status);
      return response.ok;
    } catch {
      this.#failed('review_likes');
      return false;
    }
  }

  /**
   * Une question de la manche du jour, **sans sa reponse**.
   *
   * ⚠️ Passe par une fonction et non par une lecture de table, et ce n'est pas un detour :
   * `quiz_questions` a RLS **sans aucune politique**, donc personne ne lit rien. Une
   * politique « tout sauf la colonne answer » n'existe pas — RLS filtre des lignes, jamais
   * des colonnes. La fonction est le seul chemin, et c'est elle qui choisit ce qu'elle
   * projette (`013_quiz.sql`).
   *
   * Le chronometre part **au premier appel**, cote serveur. Rappeler la meme question ne
   * le remet pas a zero : sinon recharger la page rendrait le temps infini.
   */
  async quizServe(day: string, ordinal: number): Promise<QuizServed | undefined> {
    const rows = await this.#rpc<Record<string, unknown>>('quiz_serve', {
      day,
      want: ordinal,
    });
    const row = rows[0];
    if (row === undefined || typeof row['kind'] !== 'string') return undefined;
    return {
      kind: row['kind'],
      prompt: row['prompt'] as Record<string, unknown>,
      choices: Array.isArray(row['choices']) ? (row['choices'] as string[]) : [],
      askedAt: String(row['asked_at']),
    };
  }

  /**
   * Repond, une seule fois. Le score est calcule **par la base**, jamais envoye d'ici.
   *
   * ⚠️ Aucun temps n'est transmis : un temps mesure par le navigateur serait un temps
   * falsifiable. Le serveur connait l'instant ou il a servi la question et celui ou il
   * recoit la reponse — c'est tout ce qu'il lui faut.
   */
  async quizAnswer(day: string, ordinal: number, choice: number): Promise<QuizVerdict> {
    const rows = await this.#rpc<Record<string, unknown>>('quiz_answer', {
      day,
      want: ordinal,
      choice,
    });
    const row = rows[0];
    return {
      correct: row?.['correct'] === true,
      points: typeof row?.['points'] === 'number' ? row['points'] : 0,
    };
  }

  /**
   * Le classement du jour.
   *
   * ⚠️ **Il n'est pas le meme pour deux personnes**, et c'est voulu : la vue est en
   * `security_invoker`, donc `profiles_select_visible` s'applique — on voit les profils
   * publics et ceux qu'on suit. Un classement general serait l'annuaire que ce produit
   * refuse de construire.
   */
  async quizBoard(day: string, limit = 20): Promise<readonly QuizScore[]> {
    // ⚠️ Une fonction, pas une lecture de vue. La vue existait et **ne montrait qu'un seul
    // joueur : soi** — evaluee avec les droits de l'appelant, elle heritait de la politique
    // « own only » de `quiz_answers`. La fonction declare son filtre au lieu de le laisser
    // emerger de deux regles ecrites ailleurs (`013_quiz.sql`).
    const rows = await this.#rpc<Record<string, unknown>>('quiz_board', { day });
    return rows.slice(0, limit).flatMap((row) => {
      if (typeof row['handle'] !== 'string') return [];
      const face = readFace(row['face']);
      return [
        {
          handle: row['handle'],
          score: Number(row['score'] ?? 0),
          rightAnswers: Number(row['right_answers'] ?? 0),
          ...(face !== undefined ? { face } : {}),
        },
      ];
    });
  }

  /**
   * Un appel de fonction PostgREST.
   *
   * Meme promesse que {@link #rows} : **ne leve jamais**, rend un tableau. Une manche qui
   * echoue doit se taire, pas casser la page.
   */
  async #rpc<T>(name: string, args: Record<string, unknown>): Promise<readonly T[]> {
    try {
      const response = await this.#fetch(this.#url(`rpc/${name}`), {
        method: 'POST',
        headers: this.#headers(),
        body: JSON.stringify(args),
      });
      if (!response.ok) return [];
      const body: unknown = await response.json();
      return Array.isArray(body) ? (body as T[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Le corps commun des deux lectures de critiques — elles ne different que par leur filtre.
   *
   * Les ecrire deux fois aurait duplique le parsing tolerant et son
   * rejet des lignes sans auteur : deux copies qui se seraient repondu differemment le jour
   * ou l'une aurait ete corrigee.
   */
  async #reviews(filter: string, limit: number): Promise<readonly PublishedReview[]> {
    // ⚠️ Le `&` est porte ici et non par les appelants : `feedReviews` ne filtre sur rien,
    // et `reviews?&select=` est une URL que PostgREST accepte aujourd'hui sans qu'on ait
    // demande son avis. On ne construit pas une URL douteuse en pariant sur sa tolerance.
    const rows = await this.#rows<Record<string, unknown>>(
      `reviews?${filter === '' ? '' : `${filter}&`}select=subject,target,body,through_season,lang,published_at,profiles!inner(handle,user_id,face)&order=published_at.desc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as
        | { handle?: unknown; user_id?: unknown; face?: unknown }
        | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const through = row['through_season'];
      const face = readFace(author.face);
      return [
        {
          subject: String(row['subject']),
          target: String(row['target']),
          text: String(row['body']),
          throughSeason: typeof through === 'number' ? through : 0,
          lang: String(row['lang']),
          publishedAt: String(row['published_at']),
          handle: author.handle,
          authorId: author.user_id,
          ...(face !== undefined ? { face } : {}),
        },
      ];
    });
  }

  /**
   * Des gens a decouvrir — **ceux qui ont rendu leur profil public, et eux seuls**.
   *
   * ## ⚠️ Ce n'est pas un annuaire, et la difference est toute la decision
   *
   * `Friends.tsx` s'interdit la recherche approchante sur les profils, et pour une bonne
   * raison : parcourir des gens qui ne l'ont pas demande est le premier outil de qui veut
   * en harceler un. Cette methode ne contredit pas la regle, elle en donne l'exception
   * exacte — **`public` est une demande explicite d'etre trouve**. La visibilite par defaut
   * est `followers` (Q1), donc personne n'y arrive par inadvertance.
   *
   * ⚠️ Le filtre est ecrit ici **et** applique par RLS (`profiles_select_visible`) : le
   * retirer ne montrerait rien de plus, la base rendrait la meme liste. La base decide, le
   * client demande.
   *
   * ## Trier, jamais filtrer — et la nuance est toute la feature
   *
   * Cette methode rendait les 24 derniers **inscrits**, par date : on ouvrait donc des
   * profils vides. Elle rend desormais les memes gens **ordonnes par ce qu'il y a a lire
   * chez eux**.
   *
   * 🔴 **Filtrer sur « a ecrit quelque chose » aurait ete le reflexe, et il aurait detruit
   * ce composant** : `Discover` existe pour repondre au demarrage a froid, c'est-a-dire
   * exactement au moment ou personne n'a encore rien ecrit. Il se serait tu precisement le
   * jour ou il sert. Le tri, lui, ne retire personne.
   */
  async discoverable(limit = 24): Promise<readonly Discoverable[]> {
    // ⚠️ Le vivier est **borne, et deliberement plus large que ce qu'on affiche**. On ne peut
    // pas demander a PostgREST de trier par un compte imbrique ; trier ici suppose donc
    // d'avoir sous la main plus de monde qu'on n'en montre. Tout demander serait le cout non
    // borne que ce produit refuse partout — quelqu'un d'inscrit tres tot et tres bavard peut
    // donc rester hors du vivier, et c'est le prix assume.
    const rows = await this.#rows<Record<string, unknown>>(
      `profiles?visibility=eq.public&select=*,reviews(count),lists(count)&order=created_at.desc&limit=${limit * 2}`,
    );
    return rows
      .map((row) => ({
        ...rowToProfile(row),
        wrote: countOf(row['reviews']) + countOf(row['lists']),
      }))
      .sort((a, b) => b.wrote - a.wrote)
      .slice(0, limit);
  }

  // -------------------------------------------------------------------------
  // Les listes (8.13)
  // -------------------------------------------------------------------------

  /**
   * Les listes de quelqu'un, avec le nombre d'elements de chacune.
   *
   * ⚠️ **Aucun controle de visibilite ici**, exactement comme {@link reviewsBy} : la
   * politique `lists_select` porte `can_see(user_id)`, donc la base rend une liste vide a
   * qui n'a pas le droit de lire. Le refaire ici donnerait deux sources de verite pour une
   * meme regle, et c'est celle du client qui se perime.
   *
   * Le compte vient de PostgREST (`list_items(count)`) plutot que d'un second appel : une
   * page de profil qui affiche dix listes ferait sinon onze requetes.
   */
  async listsBy(userId: string, limit = 50): Promise<readonly SeriesList[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `lists?user_id=eq.${encodeURIComponent(userId)}&select=slug,title,note,updated_at,list_items(count)&order=updated_at.desc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const slug = row['slug'];
      const title = row['title'];
      if (typeof slug !== 'string' || typeof title !== 'string') return [];
      const note = row['note'];
      return [
        {
          slug,
          title,
          ...(typeof note === 'string' && note.length > 0 ? { note } : {}),
          count: countOf(row['list_items']),
          updatedAt: String(row['updated_at'] ?? ''),
        },
      ];
    });
  }

  /** Les series d'une liste, dans l'ordre ou elles y ont ete posees. */
  async listItems(userId: string, slug: string, limit = 500): Promise<readonly string[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `list_items?user_id=eq.${encodeURIComponent(userId)}&slug=eq.${encodeURIComponent(slug)}&select=subject&order=added_at.asc&limit=${limit}`,
    );
    return rows.flatMap((row) => (typeof row['subject'] === 'string' ? [row['subject']] : []));
  }

  /**
   * Cree une liste.
   *
   * ⚠️ **Pas de `merge-duplicates` ici, contrairement a `publishReview`** : republier une
   * critique corrige un texte, mais deux listes de meme nom sont deux listes. Un `upsert`
   * ecraserait silencieusement la premiere — c'est {@link uniqueSlug} qui evite le conflit,
   * en amont et visiblement.
   */
  async createList(
    userId: string,
    list: { readonly slug: string; readonly title: string; readonly note?: string },
  ): Promise<boolean> {
    return this.#write('lists', 'POST', {
      user_id: userId,
      slug: list.slug,
      title: list.title,
      ...(list.note !== undefined ? { note: list.note } : {}),
    });
  }

  /**
   * Supprime une liste, et ses elements avec elle (la cascade est dans le SQL).
   *
   * ⚠️ **Une suppression dure, et c'est la difference avec une critique.** `/regles` promet
   * « on masque, on ne supprime jamais » pour un contenu **retire par la moderation** — pas
   * pour ce que son auteur defait lui-meme. `hidden_at` reste la colonne de la moderation ;
   * personne d'autre que l'auteur ne peut passer par ici (`lists_delete`).
   */
  async deleteList(userId: string, slug: string): Promise<boolean> {
    return this.#write(
      `lists?user_id=eq.${encodeURIComponent(userId)}&slug=eq.${encodeURIComponent(slug)}`,
      'DELETE',
    );
  }

  /**
   * Ajoute une serie a une liste.
   *
   * Ajouter deux fois la meme serie est un geste **repete**, pas un second element : le
   * second clic ne doit pas remonter d'erreur pour un geste sans consequence.
   *
   * 🔴 **Mais `merge-duplicates` rendait 42501**, mesure le 2026-08-11 — et il aurait en
   * plus **remonte la ligne** en reecrivant `added_at`, alors que la liste se lit dans
   * l'ordre d'ajout. `ignore-duplicates` dit exactement ce qu'on veut : la serie y est
   * deja, on ne touche a rien. Voir {@link IDEMPOTENCE}.
   */
  async addToList(userId: string, slug: string, subject: string): Promise<boolean> {
    return this.#write(
      'list_items',
      'POST',
      { user_id: userId, slug, subject },
      'resolution=ignore-duplicates,return=minimal',
    );
  }

  /** Retire une serie d'une liste. */
  async removeFromList(userId: string, slug: string, subject: string): Promise<boolean> {
    return this.#write(
      `list_items?user_id=eq.${encodeURIComponent(userId)}&slug=eq.${encodeURIComponent(slug)}&subject=eq.${encodeURIComponent(subject)}`,
      'DELETE',
    );
  }

  /**
   * Une ecriture qui ne leve jamais — le pendant de {@link #rows} pour ce qui modifie.
   *
   * Les cinq methodes ci-dessus repetaient sinon le meme `try/catch` autour du meme `fetch`,
   * ce qui est exactement la forme qui a laisse `client.ts` promettre de ne jamais lever
   * **et lever** : une copie corrigee et quatre oubliees.
   */
  async #write(
    path: string,
    method: 'POST' | 'DELETE' | 'PATCH',
    body?: Record<string, unknown>,
    prefer = 'return=minimal',
  ): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url(path), {
        method,
        headers: this.#headers({ Prefer: prefer }),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) this.#failed(path, response.status);
      return response.ok;
    } catch {
      this.#failed(path);
      return false;
    }
  }
}

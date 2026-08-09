/**
 * Le social, en `fetch` brut sur PostgREST.
 *
 * Meme choix que `src/journal/remote.ts`, et pour la meme raison : lire et ecrire quelques
 * lignes, c'est un GET et un POST. Le SDK n'apporterait qu'une syntaxe, pour ~40 Ko.
 * L'exception reste l'authentification, ou l'on ne reecrit pas des jetons a la main.
 *
 * **Ce module ne decide rien.** Il transporte, et **ne leve jamais** : une panne du social
 * ne doit pas interrompre un produit dont tout le reste est local.
 */

import type { ActivityItem, ActivityKind } from '../domain/activity';

export interface SocialOptions {
  readonly url: string;
  readonly anonKey: string;
  /** Relu a chaque appel : un jeton se rafraichit. */
  readonly accessToken: () => string | undefined;
  readonly fetchImpl?: typeof fetch;
}

export type Visibility = 'private' | 'followers' | 'public';

export interface Profile {
  readonly userId: string;
  readonly handle: string;
  readonly displayName?: string;
  readonly visibility: Visibility;
}

/** Ce qui peut arriver quand on reclame un nom. */
export type ClaimOutcome =
  | { readonly kind: 'claimed'; readonly profile: Profile }
  /** Deja pris, ou reserve. Les deux se disent pareil : le nom n'est pas disponible. */
  | { readonly kind: 'taken' }
  | { readonly kind: 'failed' };

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
 * quand rien ne correspond. Parsing tolerant (`AGENTS.md` regle 4) : tout ce qui n'est pas
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
  return {
    userId: String(row['user_id']),
    handle: String(row['handle']),
    ...(typeof row['display_name'] === 'string' ? { displayName: row['display_name'] } : {}),
    visibility: (row['visibility'] as Visibility) ?? 'followers',
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
  async #rows<T>(path: string): Promise<readonly T[]> {
    try {
      const response = await this.#fetch(this.#url(path), { headers: this.#headers() });
      if (!response.ok) return [];
      const body: unknown = await response.json();
      return Array.isArray(body) ? (body as T[]) : [];
    } catch {
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

  async setVisibility(userId: string, visibility: Visibility): Promise<boolean> {
    try {
      const response = await this.#fetch(
        this.#url(`profiles?user_id=eq.${encodeURIComponent(userId)}`),
        { method: 'PATCH', headers: this.#headers(), body: JSON.stringify({ visibility }) },
      );
      return response.ok;
    } catch {
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

  async follow(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url('follows'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ follower_id: followerId, followee_id: followeeId }),
      });
      return response.ok;
    } catch {
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
      return response.ok;
    } catch {
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
   * `AGENTS.md` regle 7 pose la question juste : *ce fait decrit-il l'oeuvre ou quelqu'un
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
      `activity?${filter}select=kind,subject,season,stars,happened_on,profiles!inner(handle,user_id)&order=happened_on.desc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as { handle?: unknown; user_id?: unknown } | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
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
   */
  async publish(userId: string, items: readonly ActivityItem[]): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const response = await this.#fetch(this.#url('activity'), {
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
      });
      return response.ok;
    } catch {
      return false;
    }
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
      return response.ok;
    } catch {
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
   * le **retrait d'une critique par son auteur** n'est pas encore ecrite (`TASKS.md` 8.9) :
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
   * Le corps commun des deux lectures de critiques — elles ne different que par leur filtre.
   *
   * Les ecrire deux fois aurait duplique le parsing tolerant (`AGENTS.md` regle 4) et son
   * rejet des lignes sans auteur : deux copies qui se seraient repondu differemment le jour
   * ou l'une aurait ete corrigee.
   */
  async #reviews(filter: string, limit: number): Promise<readonly PublishedReview[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `reviews?${filter}&select=subject,target,body,through_season,lang,published_at,profiles!inner(handle,user_id)&order=published_at.desc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as { handle?: unknown; user_id?: unknown } | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const through = row['through_season'];
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
   */
  async discoverable(limit = 24): Promise<readonly Profile[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `profiles?visibility=eq.public&select=*&order=created_at.desc&limit=${limit}`,
    );
    return rows.map(rowToProfile);
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
   * `merge-duplicates` ici, et pour la raison inverse de {@link createList} : ajouter deux
   * fois la meme serie est un geste **repete**, pas un second element. Sans lui, le second
   * clic remonterait une erreur de cle dupliquee pour un geste sans consequence.
   */
  async addToList(userId: string, slug: string, subject: string): Promise<boolean> {
    return this.#write(
      'list_items',
      'POST',
      { user_id: userId, slug, subject },
      'resolution=merge-duplicates,return=minimal',
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
    method: 'POST' | 'DELETE',
    body?: Record<string, unknown>,
    prefer = 'return=minimal',
  ): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url(path), {
        method,
        headers: this.#headers({ Prefer: prefer }),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

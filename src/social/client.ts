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
   * @param kind lecture ou ecriture. ⚠️ **Les deux ne se disent pas de la meme facon** : une
   *   lecture ratee a deja son ecran (« je n'ai pas pu lire », `EmptyState status`), alors
   *   qu'une ecriture ratee n'en a aucun — le geste a l'air d'avoir marche. Ajoute le
   *   2026-08-16 avec le premier abonne ; facultatif, donc les rappels d'avant compilent.
   */
  readonly onFailure?: (where: string, status?: number, kind?: 'read' | 'write') => void;
}

export type Visibility = 'private' | 'followers' | 'public';

export interface Profile {
  readonly userId: string;
  readonly handle: string;
  /**
   * Le nom lisible — accents, espaces, majuscules : tout ce que l'alphabet d'un handle
   * interdit. Absent tant que personne ne l'a pose, et c'etait le cas de **tout le monde**
   * jusqu'au 2026-08-17 : la colonne existait depuis `003` sans chemin d'ecriture.
   */
  readonly displayName?: string;
  /** Une phrase, 160 caracteres au plus. Voir `030_profile_words.sql`. */
  readonly bio?: string;
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

/**
 * Les memes coeurs, quand le lot melange les series.
 *
 * ⚠️ Le `subject` fait partie de l'identite ici et pas dans {@link ReviewLikes} : sur une
 * fiche serie il est connu et constant, sur un profil ou une vitrine il ne l'est pas. Deux
 * critiques du meme auteur, sur la meme cible, dans deux series differentes, ne se
 * distinguent que par lui.
 */
export interface ReviewLikesAcross extends ReviewLikes {
  readonly subject: string;
}

/**
 * Un mot pose sur une serie, tel qu'il est publie.
 *
 * ⚠️ L'instantane voyage avec, pour la quatrieme fois apres `018`, `020` et `021` : la page
 * d'un mot est lue par des gens qui ne suivent pas les memes series.
 */
export interface TaggedSeries extends SeriesRef {
  readonly tag: string;
}

/**
 * Le meme mot, **plus la personne qui l'a pose** — ce que la page d'un mot montre.
 *
 * ⚠️ L'auteur est rendu en plus pour la meme raison que sur une liste ou une critique : sur
 * un profil on sait de qui on lit le vocabulaire, sur `/mot/<mot>` non. Un index de mots sans
 * ses auteurs ne serait qu'une seconde liste de series — or tout son interet est de croiser
 * deux personnes qui rangent sous le meme mot.
 */
export interface TaggedByAuthor extends TaggedSeries {
  readonly handle: string;
  readonly authorId: string;
  readonly face?: FaceId;
}

/** Combien d'abonnes, combien d'abonnements. Voir {@link SocialClient.followCounts}. */
export interface FollowCounts {
  readonly followers: number;
  readonly following: number;
}

/**
 * Ce qu'une serie a recu — **parmi les profils publics uniquement**.
 *
 * ⚠️ Sous-compte volontairement, et le rendu doit le dire : « au moins N », jamais
 * « N personnes ». Voir `027_counts.sql` pour la raison, qui tient a l'anonymat.
 */
export interface SubjectCounts {
  readonly subject: string;
  /** Des gens qui l'ont commencee, finie, ou dont une saison est notee. */
  readonly watched: number;
  /** Des gens qui l'ont aimee. */
  readonly loved: number;
  /** Des listes ou elle est rangee. */
  readonly listed: number;
}

/** Les coeurs d'une liste : combien, et si j'en fais partie. */
export interface ListLikes {
  readonly slug: string;
  readonly likes: number;
  readonly mine: boolean;
}

/**
 * Un retour recu sur ce qu'on a ecrit — **le chemin de retour qui manquait**.
 *
 * ## 🔴 Pourquoi ce type existe
 *
 * Une critique pouvait recevoir un coeur (`015`) et une reponse (`024`), et **aucun des deux
 * ne revenait vers son auteur** : les deux ne s'affichent que sur la fiche de la bonne serie,
 * ou personne ne repasse trois semaines apres avoir ecrit. `015` avait pourtant ecrit la
 * raison d'etre du coeur en une phrase : *« ecrire dans le vide est ce qui fait arreter
 * d'ecrire »*.
 *
 * ⚠️ **Ce n'est pas une notification**, et la nuance est le produit entier : rien n'est
 * pousse, rien n'est stocke, rien ne coute par utilisateur — c'est le cout par utilisateur
 * qui a tue TV Time. C'est un retour **au retour** : la page ne dit ce qu'elle a recu que
 * quand on l'ouvre.
 */
export interface Feedback {
  /**
   * `heart` : quelqu'un a aime une critique. `reply` : quelqu'un a repondu.
   * `listHeart` : quelqu'un a aime une **liste**.
   *
   * ⚠️ Le coeur d'une liste est un genre a part et non un `heart` avec un autre sujet : il
   * ne porte pas de cle de journal, donc rien ne mene a une fiche serie. Les confondre
   * ferait un lien mort une ligne sur trois.
   */
  readonly kind: 'heart' | 'reply' | 'listHeart' | 'follow';
  /**
   * La cle de journal de l'oeuvre — `tmdb:1396`.
   *
   * ⚠️ Pour un `listHeart`, c'est le **slug** de la liste : il n'existe pas de cle de
   * journal pour une liste, et l'appelant le sait par `kind`.
   */
  readonly subject: string;
  /** `series` ou `season:3`. Vide pour un `listHeart`. */
  readonly target: string;
  /** Quand — le plus recent des faits regroupes ici. */
  readonly at: string;
  /**
   * Combien de coeurs ; toujours 1 pour une reponse.
   *
   * ⚠️ Les coeurs sont **regroupes par critique** : trois coeurs sur un meme texte sont une
   * ligne « 3 », jamais trois lignes. Un retour qui se compte en lignes deviendrait un flux,
   * donc quelque chose a rattraper — exactement ce que ce produit refuse d'imposer.
   */
  readonly count: number;
  /**
   * Qui a repondu. **Absent pour un coeur, et c'est deliberé** : nommer qui aime demanderait
   * de projeter `liker_id`, or `015` ne le projette nulle part et sa fonction de comptage
   * s'en interdit le principe — *un agregat n'est pas un annuaire*. Un coeur dit qu'on a ete
   * lu, pas par qui.
   */
  readonly handle?: string;
  /** La face de qui a repondu, si elle en a une. Voir {@link Profile.face}. */
  readonly face?: FaceId;
  /** Le texte de la reponse, pour un `reply`. */
  readonly body?: string;
}

/**
 * Une reponse a une critique.
 *
 * ⚠️ Porte l'identite de la critique commentee **et** celle de son propre auteur : les deux
 * servent, et pas au meme endroit. La premiere range la reponse sous le bon texte, la seconde
 * permet d'ouvrir un profil et de signaler — sans quoi une surface de discussion n'est pas
 * moderable.
 */
export interface ReviewComment {
  readonly id: string;
  /** L'auteur de la CRITIQUE, pas de la reponse. */
  readonly reviewAuthorId: string;
  readonly subject: string;
  readonly target: string;
  readonly body: string;
  readonly writtenAt: string;
  readonly handle: string;
  /** L'auteur de la reponse. */
  readonly authorId: string;
  readonly face?: FaceId;
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
  /**
   * L'instantane du titre et de l'affiche, publie avec la critique (018).
   *
   * 🔴 Sans eux, le fil affichait « @test wrote about **tmdb:94997** » : le lecteur ne
   * resolvait le titre que depuis SON journal, donc jamais pour une serie qu'il ne connait
   * pas — c'est-a-dire jamais dans le seul cas ou un fil sert a quelque chose.
   *
   * Optionnels : les critiques publiees avant le 2026-08-11 n'en ont pas.
   */
  readonly title?: string;
  readonly posterPath?: string;
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
  /**
   * Les premieres series de la liste, pour la donner a voir sans l'ouvrir.
   *
   * ## Pourquoi elle arrive dans la MEME requete
   *
   * Une carte de liste ne montrait que du texte : un titre, une phrase, un nombre. Sur un
   * produit dont le sujet est ce qu'on regarde, c'est une liste de courses — et pour savoir
   * ce qu'il y a dedans, il fallait cliquer chacune.
   *
   * La reponse evidente serait un appel par liste. C'est exactement ce que {@link count}
   * s'interdit deux lignes plus haut : *« une page de profil qui montre dix listes en ferait
   * sinon onze »*. Le second embarquement (`preview:list_items(subject)` avec
   * `preview.limit`) rend les deux dans **un seul aller-retour**, quel que soit le nombre de
   * listes.
   *
   * ⚠️ **La requete a ete verifiee contre la vraie base a la cle publique** avant d'etre
   * ecrite ici, et avec son ancrage : trois variantes invalides repondent 400 (`42703`,
   * `PGRST200`), la bonne repond 200. Ce n'est pas du zele — `#rows()` promet de ne jamais
   * lever, donc un `select` mal forme rendrait `[]` et **toutes les listes dispararaitraient
   * en silence**. C'est le defaut qui a coute trois sessions au lot 10.
   *
   * ⚠️ Chaque element porte sa **cle de journal** (`tmdb:1396`) — le catalogue est loue, pas
   * possede — et, depuis `020`, l'instantane du titre et de l'affiche pris au moment ou la
   * serie a ete rangee. Voir {@link SeriesRef} pour la raison, qui a coute deux fois le meme
   * defaut.
   */
  readonly preview: readonly SeriesRef[];
}

/**
 * Une serie dans une liste : sa cle, et le nom sous lequel on l'y a rangee.
 *
 * ## 🔴 Pourquoi le titre voyage, mesure au navigateur le 2026-08-16
 *
 * `018` a fait voyager le titre avec un fait du fil et avec une critique, et a **oublie les
 * listes**. Une carte de liste resolvait donc ses vignettes depuis le journal du **lecteur**,
 * avec « Tracked series » en repli : le lecteur voyait quatre fois le meme mot pour toute
 * liste faite de series qu'il ne suit pas — c'est-a-dire **toute liste qu'on decouvre**, ce
 * qui est exactement l'usage de `/listes`.
 *
 * La regle que ces deux defauts donnent : **une cle qui voyage sans son instantane n'est
 * lisible que par qui l'a deja vue**, et aucune surface de decouverte n'a cette propriete.
 *
 * ⚠️ Les deux champs sont **facultatifs et le resteront** : les elements ranges avant le
 * 2026-08-16 n'en ont pas, et `addToList` ecrit en `ignore-duplicates` (voir
 * {@link IDEMPOTENCE}), donc refaire le geste ne rattrape pas un instantane manquant. Le
 * rendu garde son repli — l'instantane du lecteur, puis la cle.
 */
export interface SeriesRef {
  /** La cle de journal, telle quelle : `tmdb:1396`. */
  readonly subject: string;
  /** Le titre au moment du rangement. Absent sur le fond d'avant `020`. */
  readonly title?: string;
  /** Le chemin d'affiche TMDB (`/xxxxx.jpg`), jamais une URL absolue — voir `020`. */
  readonly posterPath?: string;
}

/**
 * Une liste **plus son auteur** — ce que la surface de decouverte montre.
 *
 * ⚠️ Le handle est rendu **en plus** du reste, pour la meme raison que `subject` sur une
 * critique : sur `/u/<nom>` on sait de qui on lit la liste, sur une page de decouverte non.
 * Sans lui, la page afficherait des listes sans dire qui les tient — et une liste sans son
 * auteur n'est qu'un titre, alors que c'est justement le gout de quelqu'un qu'on parcourt.
 */
export interface DiscoverableList extends SeriesList {
  readonly handle: string;
  readonly authorId: string;
  /** La face de l'auteur, si elle en a une. Voir {@link Profile.face}. */
  readonly face?: FaceId;
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
/**
 * Combien de series une carte de liste donne a voir sans etre ouverte.
 *
 * Quatre, et pas plus : la carte fait la moitie de la largeur de lecture, et une cinquieme
 * vignette la ferait passer a la ligne — une rangee qui casse se lit comme un debordement,
 * pas comme un apercu. Voir {@link SeriesList.preview}.
 */
const LIST_PREVIEW = 4;

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

/**
 * Une ligne de `list_items` telle que le produit la lit — la cle, plus son instantane.
 *
 * ⚠️ **Un seul parsing pour les deux appelants** ({@link SocialClient.listsBy} par
 * l'embarquement `preview`, {@link SocialClient.listItems} en direct). Le contenu d'une liste
 * et son apercu montrent les memes series : deux copies de ce parsing finiraient par se
 * repondre differemment le jour ou l'une serait corrigee — c'est litteralement l'histoire de
 * `018`, qui a nomme deux tables sur trois.
 *
 * ⚠️ Rend un tableau : un element sans cle lisible disparait de la liste, il ne la fait pas
 * disparaitre. Le titre et l'affiche, eux, sont **facultatifs** — le fond d'avant `020` n'en
 * a pas, et une liste sans vignettes vaut infiniment mieux qu'une liste absente.
 */
function rowToSeriesRef(value: unknown): readonly SeriesRef[] {
  const row = value as Record<string, unknown> | null;
  const subject = row?.['subject'];
  if (typeof subject !== 'string') return [];
  const title = row?.['title'];
  const posterPath = row?.['poster_path'];
  return [
    {
      subject,
      ...(typeof title === 'string' && title.length > 0 ? { title } : {}),
      ...(typeof posterPath === 'string' && posterPath.length > 0 ? { posterPath } : {}),
    },
  ];
}

/**
 * Une ligne de `lists` telle que le produit la lit.
 *
 * Le corps commun de {@link SocialClient.listsBy} et {@link SocialClient.discoverLists}, qui
 * ne different que par ce qu'elles demandent autour. Meme motif que `#reviews` et
 * `#profilesOf`, et pour la meme raison : deux copies d'un meme parsing finissent par se
 * repondre differemment le jour ou l'une est corrigee.
 *
 * ⚠️ Rend un tableau plutot qu'un `undefined` : les deux appelants l'utilisent dans un
 * `flatMap`, donc une ligne inexploitable disparait sans qu'aucun d'eux ait a y penser.
 */
function rowToList(row: Record<string, unknown>): readonly SeriesList[] {
  const slug = row['slug'];
  const title = row['title'];
  if (typeof slug !== 'string' || typeof title !== 'string') return [];
  const note = row['note'];
  // ⚠️ Defensif jusqu'au bout : une liste dont l'apercu manque ou arrive dans une forme
  // inattendue doit s'afficher **sans vignettes**, jamais disparaitre. Une carte de liste
  // vaut infiniment plus que ses quatre miniatures.
  const raw = row['preview'];
  const preview = Array.isArray(raw) ? raw.flatMap(rowToSeriesRef) : [];
  return [
    {
      slug,
      title,
      ...(typeof note === 'string' && note.length > 0 ? { note } : {}),
      count: countOf(row['list_items']),
      updatedAt: String(row['updated_at'] ?? ''),
      preview,
    },
  ];
}

/**
 * Le motif d'un `ilike`, echappe — **et surtout pas entre guillemets**.
 *
 * ## 🔴 Ce que les guillemets faisaient vraiment, mesure le 2026-08-17
 *
 * `searchLists` composait `title=ilike."*motif*"` depuis le 2026-08-16, avec ce commentaire :
 * *« le motif est echappe pour PostgREST, pas seulement pour l'URL : une virgule ou une
 * parenthese dans un titre cherche sont de la syntaxe dans un filtre. Les guillemets doubles
 * autour de la valeur les neutralisent »*. C'etait faux sur les deux moities :
 *
 * - **Les guillemets ne neutralisent rien ici, ils entrent dans le motif.** Mesure contre la
 *   vraie base, sur une ligne dont le mot est `le dimanche` :
 *
 *       tags?tag=ilike."*dimanche*"  → 200 []
 *       tags?tag=ilike.*dimanche*    → 200 [{"tag":"le dimanche"}]
 *
 *   La recherche de listes ne pouvait donc **rien trouver, jamais** — et c'est le defaut
 *   10.0 sous sa forme la plus pure : un ecran identique a « aucun resultat », donc invisible.
 *   Les tests doublent `fetch` : ils prouvaient la forme de l'URL, pas qu'elle trouve.
 * - **Il n'y avait rien a neutraliser.** Une virgule et une parenthese dans la valeur d'un
 *   filtre simple `col=op.valeur` sont du **texte** : verifie, elles repondent 200 et ne
 *   correspondent a rien. Elles ne sont de la syntaxe que dans `in.(…)` et `or=(…)`.
 *
 * ## Ce qui doit vraiment etre echappe
 *
 * Les jokers, et eux seuls : `_` non echappe remplace **n'importe quel caractere** —
 * `*di_anche*` trouve `le dimanche`, mesure aussi. Une recherche ou un souligne tape par
 * quelqu'un elargit silencieusement le resultat n'est pas une recherche. La barre oblique
 * inverse traverse PostgREST jusqu'a Postgres, ou elle est l'echappement par defaut de
 * `like` : `\_` redevient un souligne litteral (verifie, 200 et zero ligne).
 */
function likePattern(raw: string): string {
  return raw
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('*', '\\*');
}

/**
 * Le premier de chaque — **et l'ordre d'entree est l'arbitre**.
 *
 * ⚠️ Employe sur des listes deja triees par la base (`happened_on desc`), donc « le premier »
 * veut dire « le plus recent ». Trier ici en plus donnerait deux ordres a tenir d'accord ;
 * s'en remettre a celui de la requete est ce qui rend cette fonction sure — et c'est aussi ce
 * qui interdit de l'employer sur une liste dont l'ordre n'a pas ete demande.
 */
function uniqueBy<T>(rows: readonly T[], key: (row: T) => string): readonly T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = key(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function rowToProfile(row: Record<string, unknown>): Profile {
  const face = readFace(row['face']);
  return {
    userId: String(row['user_id']),
    handle: String(row['handle']),
    // ⚠️ Verifies au type ET non vides : une colonne rognee a la chaine vide par un
    // tableau de bord rendrait un nom invisible qui remplacerait quand meme le handle.
    ...(typeof row['display_name'] === 'string' && row['display_name'].trim() !== ''
      ? { displayName: row['display_name'].trim() }
      : {}),
    ...(typeof row['bio'] === 'string' && row['bio'].trim() !== ''
      ? { bio: row['bio'].trim() }
      : {}),
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
  #failed(where: string, status?: number, kind: 'read' | 'write' = 'read'): void {
    try {
      this.#options.onFailure?.(where, status, kind);
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

  /**
   * Publie les quatre epinglees, dans l'ordre.
   *
   * ## 🔴 Le bouton s'appelait « Pin to profile », et le profil ne les voyait pas
   *
   * Constate le 2026-08-16 : `favorites.pin` porte ce nom depuis toujours et les epinglees
   * vivent dans `journal.favorites`, c'est-a-dire **dans le navigateur**. `<Favorites />`
   * n'est monte que sur `/moi`. On epinglait « sur son profil » quatre series que personne
   * d'autre ne pouvait voir. Le 2026-08-15 avait comble a cote — les **coeurs**, deja
   * publies — et un coeur n'est pas un choix ordonne de quatre.
   *
   * ## Un etat, pas des faits — donc on remplace
   *
   * `merge-duplicates` sur `(user_id, ordinal)` puis retrait de la queue : quatre epinglees
   * qui en deviennent deux doivent **effacer** les rangs 3 et 4, sinon d'anciennes series
   * resteraient sur le profil sans que rien ne les y ait remises. C'est la difference avec
   * `publish()`, dont la cle naturelle absorbe les republications parce qu'un fait ne se
   * retire pas.
   *
   * ⚠️ Le `DELETE` part **apres** l'insertion et seulement si elle a reussi : dans l'autre
   * sens, une panne reseau entre les deux laisserait un profil vide — c'est-a-dire une perte
   * visible pour reparer une incoherence invisible.
   *
   * ⚠️ Chaque ligne voyage avec son instantane, pour la troisieme fois apres `018` et `020` :
   * un profil est lu par des gens qui ne suivent pas les memes series.
   */
  async publishFavorites(userId: string, items: readonly SeriesRef[]): Promise<boolean> {
    const kept = items.slice(0, 4);
    if (kept.length === 0) {
      return this.#write(
        `profile_favorites?user_id=eq.${encodeURIComponent(userId)}`,
        'DELETE',
      );
    }

    const wrote = await this.#write(
      'profile_favorites?on_conflict=user_id,ordinal',
      'POST',
      kept.map((one, index) => ({
        user_id: userId,
        ordinal: index + 1,
        subject: one.subject,
        title: one.title ?? null,
        poster_path: one.posterPath ?? null,
      })),
      'resolution=merge-duplicates,return=minimal',
    );
    if (!wrote) return false;

    return this.#write(
      `profile_favorites?user_id=eq.${encodeURIComponent(userId)}&ordinal=gt.${kept.length}`,
      'DELETE',
    );
  }

  /**
   * Publie ses mots — ou les retire tous.
   *
   * ## ⚠️ Un ETAT, et il s'ecrit par suppression puis insertion
   *
   * Retirer un mot doit le retirer du profil : la condition `length > 0` des faits laisserait
   * l'ancien vocabulaire en place pour toujours. On efface donc **tout ce qui est a soi**,
   * puis on reinsere — jamais un `merge-duplicates`, qui emprunterait le chemin `UPDATE` et
   * demanderait une politique que cette table n'a volontairement pas. C'est la lecon de `021`
   * et du 2026-08-11, ou ce chemin rendait 42501 en silence.
   *
   * ⚠️ Le `DELETE` large est sur **parce que `tags_delete` le borne a `auth.uid()`** : un
   * client qui l'enverrait tel quel n'efface que ses propres lignes. La borne est dans la
   * base, pas ici — une borne posee dans l'appelant n'est pas une borne.
   *
   * ⚠️ **Cet appel ne part que si la personne l'a demande** (`shareTags`). Le client ne le
   * sait pas et n'a pas a le savoir : c'est `PublishActivity` qui tient le consentement, au
   * meme endroit que celui de la carte des abandons.
   */
  async publishTags(
    userId: string,
    items: readonly { readonly subject: string; readonly tag: string; readonly title?: string; readonly posterPath?: string }[],
  ): Promise<boolean> {
    const cleared = await this.#write(
      `tags?user_id=eq.${encodeURIComponent(userId)}`,
      'DELETE',
    );
    if (!cleared) return false;
    if (items.length === 0) return true;

    return this.#write(
      'tags',
      'POST',
      items.map((one) => ({
        user_id: userId,
        subject: one.subject,
        tag: one.tag,
        title: one.title ?? null,
        poster_path: one.posterPath ?? null,
      })),
      'resolution=ignore-duplicates,return=minimal',
    );
  }

  /**
   * Les mots de quelqu'un. RLS decide de qui les voit — et rien n'arrive ici sans son accord.
   *
   * ⚠️ La liste est rendue **telle quelle**, sans regroupement : compter les series par mot
   * est une decision d'affichage, et `src/domain/` la porte deja pour le journal local
   * (`tagCounts`). La refaire en SQL donnerait deux comptes a tenir d'accord.
   */
  async tagsBy(userId: string, limit = 500): Promise<readonly TaggedSeries[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `tags?user_id=eq.${encodeURIComponent(userId)}&select=subject,tag,title,poster_path&order=tag.asc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const tag = row['tag'];
      const subject = row['subject'];
      if (typeof tag !== 'string' || typeof subject !== 'string') return [];
      const title = row['title'];
      const posterPath = row['poster_path'];
      return [
        {
          tag,
          subject,
          ...(typeof title === 'string' ? { title } : {}),
          ...(typeof posterPath === 'string' ? { posterPath } : {}),
        },
      ];
    });
  }

  /**
   * **Un mot, et tout le monde qui l'emploie** — N2, la page qui manquait.
   *
   * ## Ce que les mots etaient, et ce qui leur manquait
   *
   * `023` les a publies le 2026-08-16, et un onglet de profil les montre groupes. Il n'y avait
   * **ni page par mot, ni recherche par mot** : aucune facon de croiser deux personnes qui
   * rangent sous « le dimanche ». Chez la reference un mot est un **index navigable**, et
   * c'est tout son interet — *le vocabulaire de quelqu'un ne vaut que confronte a celui des
   * autres.*
   *
   * ⚠️ **Correspondance exacte, et insensible a la casse.** Un mot est ce que la personne a
   * tape : « Le Dimanche » et « le dimanche » sont le meme rangement, et les separer ferait
   * deux pages a moitie vides pour un seul vocabulaire. Ce n'est pas une recherche
   * approchante — `ilike` sans joker ne peut pas enumerer les mots des autres.
   *
   * ⚠️ **Aucun controle de visibilite ecrit ici** : `tags_select` porte `can_see(user_id)`.
   * Un mot pose par quelqu'un qu'on ne peut pas voir n'arrive donc jamais — et la page ne
   * dit pas qu'il existe.
   */
  async tagged(tag: string, limit = 60): Promise<readonly TaggedByAuthor[]> {
    const clean = tag.trim();
    if (clean.length === 0) return [];
    const rows = await this.#rows<Record<string, unknown>>(
      `tags?tag=ilike.${encodeURIComponent(likePattern(clean))}` +
        `&select=subject,tag,title,poster_path,profiles!inner(handle,user_id,face)` +
        `&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as
        | { handle?: unknown; user_id?: unknown; face?: unknown }
        | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const word = row['tag'];
      const subject = row['subject'];
      if (typeof word !== 'string' || typeof subject !== 'string') return [];
      const face = readFace(author.face);
      const title = row['title'];
      const posterPath = row['poster_path'];
      return [
        {
          tag: word,
          subject,
          handle: author.handle,
          authorId: author.user_id,
          ...(face !== undefined ? { face } : {}),
          ...(typeof title === 'string' && title !== '' ? { title } : {}),
          ...(typeof posterPath === 'string' && posterPath !== '' ? { posterPath } : {}),
        },
      ];
    });
  }

  /**
   * Chercher un mot — l'entree de {@link tagged} depuis `/recherche` (F4).
   *
   * ⚠️ Rend des **mots**, pas des series : la reponse a « dimanche » est la page du mot, ou
   * plusieurs vocabulaires se croisent. Rendre directement les series ferait doublon avec la
   * recherche de series, qui est deja au-dessus sur la meme page.
   *
   * ⚠️ Le regroupement se fait **ici** et non en SQL : `tags_select` filtre par lecteur, donc
   * un `group by` cote base rendrait de toute facon un compte par lecteur. Compter des lignes
   * deja filtrees est la seule facon honnete — et c'est le meme raisonnement que
   * {@link tagsBy}, qui rend la liste telle quelle en laissant `tagCounts` (domaine) grouper.
   */
  async searchTags(query: string, limit = 8): Promise<readonly { readonly tag: string; readonly count: number }[]> {
    const clean = query.trim();
    // Meme seuil que `searchLists` et `searchProfiles` : sous trois caracteres, on rendrait
    // la moitie du vocabulaire, ce qui est une enumeration et non une recherche.
    if (clean.length < 3) return [];
    const rows = await this.#rows<Record<string, unknown>>(
      `tags?tag=ilike.*${encodeURIComponent(likePattern(clean))}*&select=tag&limit=${limit * 25}`,
    );
    const counted = new Map<string, { tag: string; count: number }>();
    for (const row of rows) {
      const tag = row['tag'];
      if (typeof tag !== 'string') continue;
      // La casse ne fait pas deux mots, comme dans `tagged` : c'est la premiere graphie
      // rencontree qui s'affiche, et les deux comptent ensemble.
      const key = tag.toLocaleLowerCase();
      const seen = counted.get(key);
      if (seen === undefined) counted.set(key, { tag, count: 1 });
      else seen.count += 1;
    }
    return [...counted.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /** Les epinglees de quelqu'un, dans l'ordre choisi. RLS decide de qui les voit. */
  async favoritesBy(userId: string): Promise<readonly SeriesRef[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `profile_favorites?user_id=eq.${encodeURIComponent(userId)}&select=subject,title,poster_path&order=ordinal.asc&limit=4`,
    );
    return rows.flatMap(rowToSeriesRef);
  }

  /**
   * **Le nom lisible et la phrase d'un profil** — 030.
   *
   * ## 🔴 `display_name` dormait dans le schema depuis `003`
   *
   * La colonne existait, `rowToProfile` la lisait, `handles.ts` promettait qu'*« un nom
   * d'affichage libre porte le reste »* — et **rien ne l'ecrivait, rien ne l'affichait**.
   * C'est le motif que ce fichier documente comme sa panne la plus chere : `unfollow()` et
   * `setVisibility()` ont vecu deux lots sans appelant.
   *
   * ⚠️ **`null` et non l'omission pour effacer** : une cle absente d'un `PATCH` laisse la
   * valeur en place, donc un nom retire ne partirait jamais. C'est le meme piege que le
   * `?? null` de `publishReview`, et il se paie ici par un nom qu'on ne peut plus enlever.
   *
   * ⚠️ Les deux champs partent **ensemble**, dans une seule requete : ils se modifient dans
   * le meme formulaire, et deux `PATCH` feraient deux allers-retours pour un geste.
   */
  async setProfileWords(
    userId: string,
    words: { readonly displayName?: string; readonly bio?: string },
  ): Promise<boolean> {
    return this.#write(`profiles?user_id=eq.${encodeURIComponent(userId)}`, 'PATCH', {
      display_name: words.displayName ?? null,
      bio: words.bio ?? null,
    });
  }

  async setVisibility(userId: string, visibility: Visibility): Promise<boolean> {
    try {
      const response = await this.#fetch(
        this.#url(`profiles?user_id=eq.${encodeURIComponent(userId)}`),
        { method: 'PATCH', headers: this.#headers(), body: JSON.stringify({ visibility }) },
      );
      if (!response.ok) this.#failed('profiles', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('profiles', undefined, 'write');
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
   * Chercher quelqu'un par son nom — **l'annuaire qui manquait**.
   *
   * ## 🔴 Le defaut
   *
   * `/recherche` ne trouve que des series : 20 resultats, pas de page 2, aucun filtre. Et
   * `/amis` propose de suivre en **tapant un nom exact**, ce qui suppose de le connaitre
   * d'avance. Un produit social sans annuaire ne se peuple pas : chez la reference, la
   * recherche separe films, critiques, listes, membres, mots et journal.
   *
   * ## ⚠️ Ce que ceci n'ouvre PAS, et il faut le dire
   *
   * `PublicProfile` explique pourquoi « ce nom n'existe pas » et « ce profil ne vous est pas
   * visible » ont la meme reponse : les distinguer ferait de la page un **oracle**, donc un
   * moyen d'enumerer les comptes. Une recherche par prefixe pourrait sembler pire.
   *
   * Elle ne l'est pas, et pour une raison structurelle : `profiles_select_visible` ne rend
   * que ce que le lecteur a le droit de voir. Un profil `private` ou `followers` reste donc
   * introuvable ici, et l'absence d'un nom dans les resultats **ne dit pas** qu'il est
   * disponible. L'oracle reste ferme ; ce qui s'ouvre est ce qui a choisi d'etre public.
   *
   * ## ⚠️ Le motif est reconstruit, jamais recopie
   *
   * La saisie part dans une chaine PostgREST. On la ramene donc a l'alphabet que
   * `profiles_handle_shape` autorise — minuscules, chiffres, soulignes — avant de la
   * composer. Sans ca, une virgule ou une parenthese tapees dans le champ deviendraient de
   * la syntaxe de requete, et non du texte cherche.
   */
  async searchProfiles(query: string, limit = 12): Promise<readonly Profile[]> {
    const safe = query.toLowerCase().replace(/[^a-z0-9_]/g, '');
    // Sous trois caracteres, on se tait : c'est le minimum d'un handle, et une lettre seule
    // rendrait la moitie de l'annuaire — ce qui est une enumeration, pas une recherche.
    if (safe.length < 3) return [];
    const rows = await this.#rows<Record<string, unknown>>(
      `profiles?handle=ilike.*${safe}*&select=*&order=handle.asc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const profile = rowToProfile(row);
      return profile === undefined ? [] : [profile];
    });
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
      if (!response.ok) this.#failed('follows', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('follows', undefined, 'write');
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
      if (!response.ok) this.#failed('follows', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('follows', undefined, 'write');
      return false;
    }
  }

  /**
   * **Se soustraire a quelqu'un** — 031.
   *
   * ## Le seul recours du produit etait de demander de l'aide
   *
   * Signaler (`004`) demande a quelqu'un d'autre de trancher, sous 48 heures ; passer son
   * profil en `private` se retire de **tout le monde** pour se retirer d'un seul. Il
   * n'existait aucun geste qu'une personne puisse faire seule, et ce manque ne se voit qu'au
   * premier incident.
   *
   * ⚠️ **Les deux cotes cessent de se voir, et le suivi tombe** — c'est la base qui le fait
   * (`blocked_with` dans `can_see`, et un declencheur sur `blocks`). Le client ne pose qu'une
   * ligne : refaire ces effets ici en donnerait deux versions, et c'est celle du client qui
   * se perime.
   *
   * ⚠️ **Rien n'est efface et rien n'est annonce.** Une reponse deja ecrite reste ecrite ; la
   * personne bloquee ne l'apprend pas. Voir `031_blocks.sql` pour les deux raisons.
   *
   * ⚠️ `ignore-duplicates` : bloquer deux fois est le meme etat, et la cle **est** le fait
   * entier — voir {@link IDEMPOTENCE}. `merge-duplicates` demanderait une politique `UPDATE`
   * que `031` n'ouvre pas, et rendrait **42501** en silence.
   */
  async block(userId: string, targetId: string): Promise<boolean> {
    return this.#write(
      'blocks',
      'POST',
      { blocker_id: userId, blocked_id: targetId },
      'resolution=ignore-duplicates,return=minimal',
    );
  }

  /** Defaire un blocage. La visibilite revient des deux cotes ; le suivi, lui, ne revient pas. */
  async unblock(userId: string, targetId: string): Promise<boolean> {
    return this.#write(
      `blocks?blocker_id=eq.${encodeURIComponent(userId)}&blocked_id=eq.${encodeURIComponent(targetId)}`,
      'DELETE',
    );
  }

  /**
   * Les gens que j'ai bloques, **avec leur nom**.
   *
   * 🔴 Le piege que ce lot fabrique lui-meme : bloquer rend le profil illisible, donc la
   * table ne rend plus que des identifiants. Une page de reglages afficherait des UUID, et
   * debloquer demanderait de reconnaitre quelqu'un a son identifiant. La fonction
   * `security definer` ne rend que ce que l'appelant a lui-meme ecrit.
   */
  async myBlocks(): Promise<readonly { readonly userId: string; readonly handle: string }[]> {
    const rows = await this.#rpc<Record<string, unknown>>('my_blocks', {});
    return rows.flatMap((row) =>
      typeof row['user_id'] !== 'string' || typeof row['handle'] !== 'string'
        ? []
        : [{ userId: row['user_id'], handle: row['handle'] }],
    );
  }

  /** Les profils que je suis. */
  async following(followerId: string): Promise<readonly Profile[]> {
    return this.#follows(
      `follower_id=eq.${encodeURIComponent(followerId)}`,
      'follows_followee_profile',
    );
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
   * voulu : un profil que le lecteur n'a pas le droit de voir disparait de la jointure.
   * C'est pourquoi le **compteur** ne se lit pas ici mais par {@link followCounts} : il
   * n'aurait pas colle aux noms.
   */
  async followers(followeeId: string): Promise<readonly Profile[]> {
    return this.#follows(
      `followee_id=eq.${encodeURIComponent(followeeId)}`,
      'follows_follower_profile',
    );
  }

  /**
   * Le corps commun de {@link following} et {@link followers} — **un seul aller-retour**.
   *
   * ## 🔴 Le dernier doublon d'un profil, mesure le 2026-08-17
   *
   * Ces deux methodes lisaient `follows` pour en tirer des identifiants, puis rappelaient
   * `profiles` pour les resoudre : **deux appels chacune, quatre pour un profil**. C'etait
   * le seul reste apres `useSocial()`, qui avait ramene un profil de 23 appels a 15.
   *
   * La sortie etait connue et ecrite deux fois dans ce fichier : `discoverLists` et `listBy`
   * portent leur filtre **et** leur auteur dans la meme requete. Ce qui manquait n'etait pas
   * l'idee mais la **cle etrangere** — PostgREST n'embarque que ce qu'une contrainte relie,
   * et `follows` n'en avait aucune vers `profiles`. C'est `026_embed_paths.sql`, et c'est la
   * huitieme fois que ce depot paie cette forme.
   *
   * ⚠️ **La contrainte se nomme, et ce n'est pas un detail de style.** `follows` reference
   * `profiles` deux fois — le suiveur et le suivi. `profiles!inner(...)` tout court est alors
   * **ambigu** et PostgREST refuse la requete entiere (300, « more than one relationship
   * found »). Les deux noms sont donc de l'API : voir le commentaire de `026`.
   *
   * ⚠️ `!inner` et non un embarquement decoratif : sans lui, une ligne dont le profil n'est
   * pas visible reviendrait avec `profiles: null` et il faudrait la filtrer ici. Le comportement
   * est le meme qu'avant — un profil qu'on n'a pas le droit de voir n'a pas de nom a afficher.
   */
  async #follows(filter: string, constraint: string): Promise<readonly Profile[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `follows?${filter}&select=profiles!${constraint}!inner(user_id,handle,display_name,visibility,face)`,
    );
    return rows.flatMap((row) => {
      const profile = row['profiles'] as Record<string, unknown> | undefined;
      // ⚠️ Verifie et non transtype : `!inner` promet la ligne, il ne promet pas sa forme.
      // Meme prudence que partout ici — le serveur peut etre en avance sur ce navigateur.
      if (profile === undefined || typeof profile['user_id'] !== 'string') return [];
      return [rowToProfile(profile)];
    });
  }

  /**
   * Combien d'abonnes, combien d'abonnements — **F2**.
   *
   * ## Pourquoi une fonction et pas `count(*)` sur `follows`
   *
   * `follows_select_mine` ne rend que **ses propres** lignes : un lecteur qui compte les
   * abonnes de quelqu'un d'autre obtiendrait zero, ou un chiffre qui ne parle que de lui.
   * C'est le piege que le lot 10.2 a refuse pour les compteurs de series, et la sortie est
   * la meme depuis : une fonction `security definer` qui ne rend que des agregats.
   *
   * ⚠️ **Zero ligne quand le profil n'est pas visible**, et c'est une garantie du serveur,
   * pas une politesse du client : sans elle, « 3 abonnes » sur un profil ferme en ferait un
   * oracle — exactement ce que `/u/<nom>` refuse d'etre pour les noms. Rend donc `undefined`,
   * que l'appelant doit traiter comme « on ne dit rien », jamais comme zero.
   */
  async followCounts(userId: string): Promise<FollowCounts | undefined> {
    const rows = await this.#rpc<Record<string, unknown>>('follow_counts', {
      for_user: userId,
    });
    const row = rows[0];
    if (row === undefined) return undefined;
    return {
      followers: Number(row['followers'] ?? 0),
      following: Number(row['following'] ?? 0),
    };
  }

  /**
   * Combien de gens ont vu, aime, range ces series — **F1**.
   *
   * ⚠️ Le chiffre ne compte **que les profils publics** (`027_counts.sql`), donc il
   * sous-compte volontairement : c'est ce qui le rend stable pour tout le monde sans rien
   * reveler de plus que ce qu'un inconnu pourrait deja denombrer profil par profil. Le rendu
   * doit le dire dans ses mots — « au moins N », jamais « N personnes ».
   *
   * ⚠️ Un lot, jamais une serie a la fois : une page de catalogue en affiche vingt, et vingt
   * appels seraient vingt fois le cout que ce produit refuse partout. Meme borne qu'en `022`.
   */
  async subjectCounts(subjects: readonly string[]): Promise<readonly SubjectCounts[]> {
    if (subjects.length === 0) return [];
    const rows = await this.#rpc<Record<string, unknown>>('subject_counts', {
      for_subjects: [...subjects],
    });
    return rows.flatMap((row) =>
      typeof row['subject'] !== 'string'
        ? []
        : [
            {
              subject: row['subject'],
              watched: Number(row['watched'] ?? 0),
              loved: Number(row['loved'] ?? 0),
              listed: Number(row['listed'] ?? 0),
            },
          ],
    );
  }

  /**
   * Le fil.
   *
   * Un seul appel, jointure cote PostgREST : sans elle il faudrait une requete par personne
   * suivie, c'est-a-dire un cout qui grandit avec le nombre d'amis — exactement le cout
   * marginal par utilisateur que ce produit refuse partout ailleurs.
   *
   * RLS fait le filtrage : on demande tout, la base ne rend que le visible.
   *
   * ## 🔴 Et « le visible » inclut ses PROPRES lignes, ce que le titre dementait
   *
   * Mesure le 2026-08-16 : **4 faits de `@test` sur 13** dans un fil intitule *« What they
   * are up to »*. Ses propres gestes lui revenaient annonces comme ceux de quelqu'un
   * d'autre — et sur une base a deux comptes, un fil peuple **surtout de soi** donne
   * l'illusion d'une communaute qui n'existe pas encore.
   *
   * `except` retire l'auteur au niveau de la requete plutot qu'apres coup : filtrer en aval
   * gaspillerait la moitie de la limite de 50 en lignes jetees, donc raccourcirait le fil
   * d'autant. ⚠️ Il reste **facultatif** — un appelant sans compte n'a personne a retirer,
   * et `undefined` doit alors demander le fil tel quel, jamais `user_id=neq.undefined`.
   */
  async feed(limit = 50, except?: string): Promise<readonly FeedItem[]> {
    return this.#activity(
      except === undefined ? '' : `user_id=neq.${encodeURIComponent(except)}&`,
      limit,
    );
  }

  /**
   * Ce que quelqu'un **aime** — la carte de visite de son profil.
   *
   * ## 🔴 Le geste s'appelle « epingler sur son profil », et le profil ne montrait rien
   *
   * Constate a l'ecran le 2026-08-15 : `/u/<nom>` porte un avatar, un nom, les critiques et
   * les listes. Rien du gout de la personne. Or `favorites.pin` s'intitule *« Pin to
   * profile »* depuis toujours, et `<Favorites />` n'est monte qu'a un endroit du depot —
   * `/moi`. On epinglait quatre series sur un profil que personne ne verrait.
   *
   * ⚠️ **Ce n'est PAS l'epinglage, et il ne faut pas le confondre.** Les quatre epinglees
   * vivent dans le journal, donc dans le navigateur : les faire voyager demande une colonne
   * de plus sur `profiles` et un chemin de publication, comme `face` en a un. Les coeurs,
   * eux, sont **deja publies** (`005_liked.sql` a ouvert le genre `liked` sur `activity`) et
   * n'etaient lus que par {@link watchersOf}, serie par serie — jamais par personne.
   *
   * Zero table neuve, zero migration, zero route serveur : `activity_select_visible` porte
   * `can_see(user_id)`, donc RLS decide de ce qu'un lecteur voit, exactement comme pour les
   * critiques juste au-dessus.
   */
  async lovedBy(userId: string, limit = 8): Promise<readonly FeedItem[]> {
    // 🔴 **La meme affiche apparaissait deux fois.** Vu a l'ecran le 2026-08-17 sur
    // `/u/test` : deux fois Breaking Bad dans « ce qu'il aime ». La cle naturelle
    // d'`activity` porte `happened_on` (017), donc aimer une serie, la retirer, et la
    // reaimer un autre jour pose **deux lignes** — toutes deux vraies, toutes deux `liked`.
    // Une carte de visite qui repete une affiche donne un gout deux fois plus etroit qu'il
    // n'est.
    //
    // ⚠️ On demande **plus large que ce qu'on montre**, sinon dedoublonner reduirait la
    // rangee : huit lignes dont trois doublons ne feraient que cinq affiches.
    const rows = await this.#activity(
      `user_id=eq.${encodeURIComponent(userId)}&kind=eq.liked&`,
      limit * 3,
    );
    return uniqueBy(rows, (row) => row.subject).slice(0, limit);
  }

  /**
   * Tout ce que quelqu'un a **fait** — son journal, tel qu'il est deja publie.
   *
   * ## 🔴 Ce que ca rend visible, et ce que ca ne publie PAS
   *
   * Le releve du 2026-08-16 demandait un journal public : *« le journal existe et il est riche
   * — annee, genre de fait, douze filtres. Il est strictement prive. Letterboxd en fait un
   * onglet public, et c'est ce qui rend un profil vivant entre deux critiques »*.
   *
   * ⚠️ **Aucune donnee nouvelle ne sort d'ici, et c'est tout le point.** `activity` est la
   * projection **deja publiee** du journal : les memes lignes alimentent `feed()` depuis le
   * lot 6, sous la meme politique `activity_select_visible` qui porte `can_see(user_id)`. Un
   * lecteur voit donc exactement ce qu'il voyait deja dans son fil — simplement range par
   * personne au lieu d'etre noye dans la chronologie de tout le monde. Zero migration, zero
   * colonne, et surtout **aucun elargissement de visibilite**.
   *
   * ⚠️ Ce n'est PAS `/journal`. La page personnelle lit le journal du navigateur, qui porte
   * des choses que personne ne publie — la position episode par episode, les mots, les
   * exceptions de progression. Ce qui voyage ici est ce que `PublishActivity` a choisi
   * d'envoyer, et rien de plus. Confondre les deux ferait de ce lien une fuite.
   *
   * ⚠️ Tous les genres, contrairement a {@link lovedBy} qui filtre `liked` : c'est la
   * difference entre « ce qu'il aime » et « ce qu'il fait ».
   */
  async journalBy(userId: string, limit = 40): Promise<readonly FeedItem[]> {
    return this.#activity(`user_id=eq.${encodeURIComponent(userId)}&`, limit);
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
    // ⚠️ **Une personne, une ligne.** Le filtre accepte deux genres : quelqu'un qui a aime
    // **et** termine la meme serie apparaissait deux fois dans « qui d'autre l'a vue », sous
    // deux phrases differentes. C'est le meme defaut que le doublon d'affiches de
    // {@link lovedBy}, sur l'autre dimension — la personne au lieu de l'oeuvre.
    const rows = await this.#activity(
      `subject=eq.${encodeURIComponent(subject)}&kind=in.(liked,finished)&`,
      limit * 3,
    );
    return uniqueBy(rows, (row) => row.authorId).slice(0, limit);
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
      `activity?${filter}select=kind,subject,season,stars,happened_on,title,poster_path,profiles!inner(handle,user_id,face)&order=happened_on.desc&limit=${limit}`,
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
      // ⚠️ Verifies au type et non transtypes, comme le genre juste au-dessus : ces deux
      // colonnes sont nulles pour tout fait publie avant le 2026-08-11, et un `as string`
      // ferait afficher la chaine « null » a la place du titre.
      const title = row['title'];
      const posterPath = row['poster_path'];
      return [
        {
          kind: row['kind'],
          subject: row['subject'] as FeedItem['subject'],
          happenedOn: String(row['happened_on']),
          handle: author.handle,
          authorId: author.user_id,
          ...(face !== undefined ? { face } : {}),
          ...(typeof title === 'string' && title !== '' ? { title } : {}),
          ...(typeof posterPath === 'string' && posterPath !== '' ? { posterPath } : {}),
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
              // ⚠️ `?? null` et non l'omission : `merge-duplicates` fait un `ON CONFLICT DO
              // UPDATE`, et une cle absente du corps laisserait l'ancienne valeur en place.
              // Un titre efface du journal doit s'effacer aussi du fil.
              title: item.title ?? null,
              poster_path: item.posterPath ?? null,
            })),
          ),
        },
      );
      if (!response.ok) this.#failed('activity', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('activity', undefined, 'write');
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
    // `userId` reste dans la signature et n'est plus transmis : c'est `auth.uid()`, cote
    // fonction, qui decide desormais du proprietaire. Le retirer de l'appelant ferait croire
    // qu'on peut publier sans savoir pour qui.
    void userId;
    try {
      const response = await this.#fetch(this.#url('rpc/publish_stops'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          records: records.map((record) => ({
            // ⚠️ `user_id` n'est plus envoye : la fonction impose `auth.uid()`. Le laisser
            // ici donnerait un champ que le serveur ignore, donc une fausse piste au
            // prochain qui lira ce code en cherchant qui decide du proprietaire.
            subject: record.subject,
            reached_season: record.reachedSeason,
            left_at_season: record.leftAtSeason ?? null,
          })),
        }),
      });
      if (!response.ok) this.#failed('rpc/publish_stops', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('rpc/publish_stops', undefined, 'write');
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
    review: {
      readonly text: string;
      readonly throughSeason: number;
      readonly lang: string;
      /** L'instantane du catalogue, pour que le fil n'affiche plus « tmdb:94997 » (018). */
      readonly title?: string;
      readonly posterPath?: string;
    },
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
          // `?? null` : `merge-duplicates` est un `ON CONFLICT DO UPDATE`, donc une cle
          // absente laisserait l'ancienne valeur en place a la republication.
          title: review.title ?? null,
          poster_path: review.posterPath ?? null,
        }),
      });
      if (!response.ok) this.#failed('reviews', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('reviews', undefined, 'write');
      return false;
    }
  }

  /**
   * Retirer sa propre critique — **F10, et le geste manquait depuis le 2026-08-07**.
   *
   * ## Ce que la version precedente attendait, et qui est maintenant ecrit
   *
   * `unpublishReview()` a ete retiree ce jour-la pour deux raisons, et les deux sont levees :
   *
   * 1. *Zero appelant* — le motif que ce depot documente comme sa panne la plus chere.
   *    Elle revient **avec son bouton** : `Reviews` le pose sous sa propre critique, et
   *    `ReviewEditor` l'offre a cote du texte. Sans bouton, ne pas la reecrire.
   * 2. *Aucune regle publiee ne disait ce qu'elle fait.* `/regles` promet « on masque, on ne
   *    supprime jamais » — et cette phrase parle de la **moderation**, pas de son auteur.
   *    C'est exactement la distinction que {@link deleteList} porte deja : *« `hidden_at`
   *    reste la colonne de la moderation ; personne d'autre que l'auteur ne peut passer par
   *    ici »*. `/regles` le dit desormais en toutes lettres, sinon ce code promettrait une
   *    chose et la page publique une autre.
   *
   * ## 🔴 Le cout de son absence, mesure le 2026-08-17
   *
   * `reviews_delete` existe dans `006_reviews.sql` depuis le premier jour : **la base
   * autorisait, et rien n'appelait**. Une critique publiee etait donc definitive du point de
   * vue de la personne qui l'avait ecrite — alors que « Retirer ma reponse » existe depuis
   * `024` pour un commentaire de 600 caracteres. Les deux surfaces d'ecriture du produit ne
   * se traitaient pas pareil, et c'est la plus engageante qui n'avait pas de sortie.
   *
   * ⚠️ **Une suppression dure, et les cascades avec.** `015` et `024` accrochent les coeurs
   * et les reponses a la cle naturelle de la critique : retirer le texte emporte donc son
   * fil et ses coeurs, ce qui est la seule forme coherente — des reponses a rien ne se
   * moderent pas.
   *
   * ⚠️ **Ne retire QUE la copie publiee.** Le texte reste dans le journal de son auteur, qui
   * est la source de verite (regle 9). L'appelant qui veut les deux doit aussi effacer
   * l'entree locale — sinon `Friends.refresh()` la republierait au passage suivant, ce qui
   * ferait ressusciter une critique retiree.
   */
  async unpublishReview(userId: string, subject: string, target: string): Promise<boolean> {
    return this.#write(
      `reviews?user_id=eq.${encodeURIComponent(userId)}` +
        `&subject=eq.${encodeURIComponent(subject)}` +
        `&target=eq.${encodeURIComponent(target)}`,
      'DELETE',
    );
  }

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
  async feedReviews(limit = 30, except?: string): Promise<readonly PublishedReview[]> {
    // ⚠️ Meme retrait que {@link feed}, et il doit se faire aux deux endroits : les deux
    // moities se rangent ensemble dans `src/domain/feed.ts`, donc n'en filtrer qu'une
    // laisserait ses propres critiques sous un titre qui dit « eux ».
    return this.#reviews(except === undefined ? '' : `user_id=neq.${encodeURIComponent(except)}&`, limit);
  }

  /**
   * Les critiques d'une **fenetre de temps** — la matiere d'un classement hebdomadaire (F3).
   *
   * ## Ce qui manquait, et ce qui ne manquait pas
   *
   * La vitrine de l'accueil servait les six plus recentes. Chez la reference, c'est un
   * classement de la semaine — et c'est la seule page qui fasse decouvrir quelqu'un qu'on ne
   * suit pas. Les coeurs existent depuis le 2026-08-17 sur cette surface : **la matiere etait
   * la**, il manquait l'ordre et la fenetre.
   *
   * ## ⚠️ Le tri n'est PAS fait ici, et ce n'est pas un oubli
   *
   * Le nombre de coeurs vit dans une autre table et se lit par une fonction
   * ({@link reviewLikesAcross}). Trier en SQL demanderait une troisieme fonction
   * `security definer` qui projetterait le **texte** de critiques que RLS filtre — c'est-a-dire
   * qui contournerait `reviews_select`. On rend donc la fenetre, filtree par RLS comme
   * partout, et `orderReviews` (domaine) la classe avec les coeurs deja charges. Deux appels
   * bornes, aucune regle de visibilite reecrite.
   *
   * ⚠️ Le **vivier** est plus large que ce qu'on affiche, comme `discoverable` : on ne peut
   * pas demander a PostgREST de trier sur un compte qu'il ne connait pas.
   */
  async popularReviews(since: Date, pool = 30): Promise<readonly PublishedReview[]> {
    return this.#reviews(
      `published_at=gte.${encodeURIComponent(since.toISOString())}`,
      pool,
    );
  }

  /**
   * Chercher dans **le texte** des critiques — F4, l'index qui manquait le plus.
   *
   * ## 🔴 Ce que la recherche ne trouvait pas
   *
   * Series, personnes, listes : trois index sur les six de la reference. Les critiques sont
   * pourtant **la moitie de la cible** et le corpus existe deja.
   *
   * ⚠️ **Aucun filtre de visibilite ecrit ici**, comme {@link searchLists} : `reviews_select`
   * porte `can_see(user_id)` et ecarte ce qui est masque. Chercher ne donne donc jamais acces
   * a un texte qu'on n'aurait pas pu lire en arrivant par la fiche.
   *
   * ⚠️ **Le caviardage, lui, reste au rendu.** Une critique trouvee ici peut parler de la
   * saison 6 : c'est `redactReviewsAcross` qui masque, comme sur toute autre surface. Ne
   * jamais afficher ces lignes brutes.
   *
   * ⚠️ Le motif passe par {@link likePattern} : les jokers sont neutralises, **et il n'y a
   * pas de guillemets** — ils entreraient dans le motif et la recherche ne trouverait
   * jamais rien. Meme seuil de trois caracteres que {@link searchLists}.
   */
  async searchReviews(query: string, limit = 8): Promise<readonly PublishedReview[]> {
    const clean = query.trim();
    if (clean.length < 3) return [];
    return this.#reviews(`body=ilike.*${encodeURIComponent(likePattern(clean))}*`, limit);
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
   * Les memes coeurs, pour un lot de series — ce que le profil et la vitrine demandent.
   *
   * ## ⚠️ Pourquoi ce n'est pas une boucle sur {@link reviewLikes}
   *
   * C'etait la reponse facile, et la documentation de `reviewLikes` juste au-dessus
   * l'interdit : *« un appel pour toute la page, jamais un par critique »*. Un profil charge
   * jusqu'a 30 critiques, donc jusqu'a 30 series : la boucle aurait fait 30 allers-retours
   * pour un chiffre. La regle vaut aussi quand c'est la dimension d'a cote qui change.
   *
   * ## ⚠️ Sans `022` applique, rend `[]` — et c'est voulu
   *
   * `#rpc` ne leve jamais : une fonction absente donne une liste vide, donc des coeurs a
   * zero, cliquables, sur les nouvelles surfaces. La fiche serie n'est pas touchee, elle
   * garde {@link reviewLikes}. C'est la degradation douce que `020` n'avait pas — la, le
   * client emettait des colonnes absentes et PostgREST refusait l'ecriture entiere.
   */
  async reviewLikesAcross(subjects: readonly string[]): Promise<readonly ReviewLikesAcross[]> {
    // Rien a demander : sans sujet, la reponse est vide et l'appel serait un aller-retour
    // pour un tableau vide. Le cas est frequent — une page sans critique.
    if (subjects.length === 0) return [];
    const rows = await this.#rpc<Record<string, unknown>>('review_like_counts_across', {
      for_subjects: [...subjects],
    });
    return rows.flatMap((row) =>
      typeof row['subject'] !== 'string' ||
      typeof row['author_id'] !== 'string' ||
      typeof row['target'] !== 'string'
        ? []
        : [
            {
              subject: row['subject'],
              authorId: row['author_id'],
              target: row['target'],
              likes: Number(row['likes'] ?? 0),
              mine: row['mine'] === true,
            },
          ],
    );
  }

  /**
   * Les reponses a une critique, dans l'ordre ou elles ont ete ecrites.
   *
   * ⚠️ **Un appel pour toute la fiche**, jamais un par critique : c'est la meme regle que
   * {@link reviewLikes}, et pour la meme raison — une fiche en affiche dix. Le filtre porte
   * donc sur le `subject`, et le rendu regroupe.
   *
   * ⚠️ `profiles!inner` et non `profiles` : sans `!inner`, PostgREST rend aussi les lignes
   * dont le profil ne correspond pas, avec `profiles: null`. Un commentaire sans auteur
   * lisible n'est pas affichable — on ne pourrait ni l'ouvrir ni le signaler.
   */
  async commentsOn(subject: string, limit = 200): Promise<readonly ReviewComment[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `review_comments?subject=eq.${encodeURIComponent(subject)}` +
        `&select=id,review_author_id,subject,target,body,written_at,profiles!inner(handle,user_id,face)` +
        `&order=written_at.asc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as
        | { handle?: unknown; user_id?: unknown; face?: unknown }
        | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      if (typeof row['id'] !== 'string' || typeof row['body'] !== 'string') return [];
      const face = readFace(author.face);
      return [
        {
          id: row['id'],
          reviewAuthorId: String(row['review_author_id']),
          subject: String(row['subject']),
          target: String(row['target']),
          body: row['body'],
          writtenAt: String(row['written_at'] ?? ''),
          handle: author.handle,
          authorId: author.user_id,
          ...(face !== undefined ? { face } : {}),
        },
      ];
    });
  }

  /**
   * Repondre a une critique.
   *
   * ⚠️ **Aucune idempotence ici, contrairement a presque tout le reste du client.** Deux
   * envois du meme texte sont deux reponses : c'est un fait ecrit, pas un etat. Un
   * `merge-duplicates` avalerait le second message de quelqu'un qui repete — et il exigerait
   * une politique `UPDATE` que `024` refuse volontairement.
   */
  async comment(
    authorId: string,
    review: { readonly authorId: string; readonly subject: string; readonly target: string },
    body: string,
    lang: string,
  ): Promise<boolean> {
    return this.#write('review_comments', 'POST', {
      review_author_id: review.authorId,
      subject: review.subject,
      target: review.target,
      author_id: authorId,
      body,
      lang,
    });
  }

  /**
   * Retirer sa propre reponse.
   *
   * ⚠️ Une suppression **dure**, et c'est la difference avec une critique : `/regles` promet
   * qu'une critique masquee reste consultable par la moderation, parce qu'elle a pu etre
   * signalee. Ici la personne retire ses propres mots avant que quiconque ne s'en plaigne —
   * et `review_comments_delete` la borne a `auth.uid()`, donc elle ne peut retirer que les
   * siens.
   */
  async removeComment(id: string): Promise<boolean> {
    return this.#write(`review_comments?id=eq.${encodeURIComponent(id)}`, 'DELETE');
  }

  /**
   * **Ce que mes textes ont recu** — coeurs et reponses, ensemble et dates.
   *
   * ## Le manque que ca comble, et pourquoi il etait le plus cher
   *
   * Les deux canaux de retour du produit ne s'affichent que sur la fiche de la bonne serie.
   * L'auteur d'une critique n'y repasse pas : il verrait ses reponses uniquement en rouvrant
   * par hasard la page ou il a ecrit, il y a trois semaines. Il y avait donc **deux** canaux
   * de retour et **aucun** qui revienne.
   *
   * ## ⚠️ Deux lectures, et aucune table de plus
   *
   * `review_likes_select` porte `author_id = auth.uid()` depuis `015` : les coeurs recus sont
   * lisibles depuis toujours, personne ne les lisait. `review_comments_select` fait de meme
   * pour les reponses. Zero migration, zero etat « lu / non lu » cote serveur — voir
   * {@link Feedback} pour pourquoi ce n'est pas, et ne doit pas devenir, une notification.
   *
   * ⚠️ **Ses propres reponses sont retirees a la requete** (`author_id=neq`), comme `feed()`
   * retire ses propres faits : repondre a un fil sous sa propre critique n'est pas un retour
   * recu, et l'ecran dirait « quelqu'un vous a repondu » pour se citer soi-meme.
   *
   * ⚠️ Les coeurs sont **regroupes ici**, pas au rendu : la ligne montree est « 3 coeurs sur
   * cette critique », et le regroupement decide de la date affichee (la plus recente). Le
   * faire dans le composant en donnerait deux copies le jour ou une seconde surface l'affiche.
   */
  async feedbackFor(userId: string, limit = 40): Promise<readonly Feedback[]> {
    const [hearts, replies, listHearts, suivis] = await Promise.all([
      this.#rows<Record<string, unknown>>(
        `review_likes?author_id=eq.${encodeURIComponent(userId)}` +
          `&select=subject,target,created_at&order=created_at.desc&limit=${limit * 4}`,
      ),
      this.#rows<Record<string, unknown>>(
        `review_comments?review_author_id=eq.${encodeURIComponent(userId)}` +
          `&author_id=neq.${encodeURIComponent(userId)}` +
          `&select=subject,target,body,written_at,profiles!inner(handle,face)` +
          `&order=written_at.desc&limit=${limit}`,
      ),
      // ⚠️ **Le coeur d'une liste avait le meme vide que celui d'une critique.** `028` l'a
      // ouvert le 2026-08-17 en citant `015` — *« ecrire dans le vide est ce qui fait
      // arreter d'ecrire »* — et le retour, lui, ne revenait pas non plus. Le titre voyage
      // par la cle etrangere composite de `028` : sans lui, la ligne dirait « votre liste
      // a-voir-cet-hiver », c'est-a-dire une adresse la ou on attend un nom.
      this.#rows<Record<string, unknown>>(
        `list_likes?author_id=eq.${encodeURIComponent(userId)}` +
          `&select=slug,created_at,lists!inner(title)` +
          `&order=created_at.desc&limit=${limit * 4}`,
      ),
      // 🔴 **Le troisieme retour qui n'en etait pas un.** On apprenait qu'on avait un nouvel
      // abonne en ouvrant `/amis` et en remarquant qu'une liste s'etait allongee —
      // c'est-a-dire jamais. `follows_select_mine` rend ces lignes depuis le lot 6, et `026`
      // a pose la cle etrangere qui permet d'en lire le nom au passage.
      //
      // ⚠️ `!inner` : un abonne dont le profil ne m'est plus visible — parce qu'il m'a bloque
      // entre-temps (`031`), ou qu'il a retire son nom — disparait de la liste plutot que d'y
      // laisser une ligne sans nom et sans lien.
      this.#rows<Record<string, unknown>>(
        `follows?followee_id=eq.${encodeURIComponent(userId)}` +
          `&select=created_at,profiles!follows_follower_profile!inner(handle,face)` +
          `&order=created_at.desc&limit=${limit}`,
      ),
    ]);

    // Un coeur par critique, jamais un par ligne : la cle est la critique, la valeur son
    // compte et sa date la plus recente. Les lignes arrivent deja triees, donc la premiere
    // vue est la plus recente.
    const grouped = new Map<string, { subject: string; target: string; at: string; count: number }>();
    for (const row of hearts) {
      const subject = row['subject'];
      const target = row['target'];
      if (typeof subject !== 'string' || typeof target !== 'string') continue;
      const key = `${subject}:${target}`;
      const seen = grouped.get(key);
      if (seen === undefined) {
        grouped.set(key, { subject, target, at: String(row['created_at'] ?? ''), count: 1 });
      } else {
        seen.count += 1;
      }
    }

    // Meme regroupement que les coeurs de critiques, et pour la meme raison : trois coeurs
    // sur une liste sont une ligne « 3 », jamais trois lignes.
    const byList = new Map<string, { slug: string; title: string; at: string; count: number }>();
    for (const row of listHearts) {
      const slug = row['slug'];
      const liste = row['lists'] as { title?: unknown } | undefined;
      if (typeof slug !== 'string') continue;
      const seen = byList.get(slug);
      if (seen === undefined) {
        byList.set(slug, {
          slug,
          // ⚠️ Vide plutot que le slug : un slug est une **adresse**, pas un nom. C'est la
          // meme regle que « jamais `tmdb:94997` a l'ecran » (018), sur l'autre table — et
          // c'est le rendu qui choisit la phrase de repli, pas le transport.
          title: typeof liste?.title === 'string' ? liste.title : '',
          at: String(row['created_at'] ?? ''),
          count: 1,
        });
      } else {
        seen.count += 1;
      }
    }

    const items: Feedback[] = [
      ...[...grouped.values()].map((one) => ({ kind: 'heart' as const, ...one })),
      ...suivis.flatMap((row) => {
        const qui = row['profiles'] as { handle?: unknown; face?: unknown } | undefined;
        if (typeof qui?.handle !== 'string') return [];
        const face = readFace(qui.face);
        return [
          {
            kind: 'follow' as const,
            // ⚠️ Le `subject` porte le handle : c'est ce qui identifie la ligne, et le rendu
            // en fait une adresse `/u/<nom>`. Un `subject` vide obligerait le composant a
            // lire `handle` dans un cas et `subject` dans les trois autres.
            subject: qui.handle,
            target: '',
            at: String(row['created_at'] ?? ''),
            count: 1,
            handle: qui.handle,
            ...(face !== undefined ? { face } : {}),
          },
        ];
      }),
      ...[...byList.values()].map((one) => ({
        kind: 'listHeart' as const,
        subject: one.slug,
        target: '',
        at: one.at,
        count: one.count,
        // Le titre voyage dans `body` : c'est le champ que le rendu affiche deja en clair
        // sous la ligne, et en ajouter un quatrieme pour un seul genre ferait un type dont
        // trois quarts des champs sont vides selon les cas.
        ...(one.title === '' ? {} : { body: one.title }),
      })),
      ...replies.flatMap((row) => {
        const author = row['profiles'] as { handle?: unknown; face?: unknown } | undefined;
        if (typeof author?.handle !== 'string' || typeof row['body'] !== 'string') return [];
        const face = readFace(author.face);
        return [
          {
            kind: 'reply' as const,
            subject: String(row['subject']),
            target: String(row['target']),
            at: String(row['written_at'] ?? ''),
            count: 1,
            handle: author.handle,
            ...(face !== undefined ? { face } : {}),
            body: row['body'],
          },
        ];
      }),
    ];

    // Un seul ordre pour les deux genres : ce qui vient d'arriver est en haut, quelle que
    // soit sa nature. Deux colonnes separees demanderaient de comparer deux dates soi-meme.
    return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
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
        if (!response.ok) this.#failed('review_likes', response.status, 'write');
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
      if (!response.ok) this.#failed('review_likes', response.status, 'write');
      return response.ok;
    } catch {
      this.#failed('review_likes', undefined, 'write');
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
      `reviews?${filter === '' ? '' : `${filter}&`}select=subject,target,body,through_season,lang,published_at,title,poster_path,profiles!inner(handle,user_id,face)&order=published_at.desc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as
        | { handle?: unknown; user_id?: unknown; face?: unknown }
        | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const through = row['through_season'];
      const face = readFace(author.face);
      // Nuls pour toute critique d'avant le 2026-08-11 : verifies au type, jamais transtypes
      // — `String(null)` afficherait « null » a la place du titre.
      const title = row['title'];
      const posterPath = row['poster_path'];
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
          ...(typeof title === 'string' && title !== '' ? { title } : {}),
          ...(typeof posterPath === 'string' && posterPath !== '' ? { posterPath } : {}),
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
    // ⚠️ **Deux embarquements de la meme table**, sous deux alias : `list_items(count)` pour
    // le nombre total, `preview:list_items(subject)` borne a quatre pour les vignettes. Un
    // alias est obligatoire — sans lui PostgREST fusionne les deux et le compte se perd.
    const rows = await this.#rows<Record<string, unknown>>(
      `lists?user_id=eq.${encodeURIComponent(userId)}` +
        `&select=slug,title,note,updated_at,list_items(count),preview:list_items(subject,title,poster_path)` +
        // ⚠️ Le meme ordre que le contenu de la liste (`032`), sinon la carte annoncerait un
        // ordre que l'ouverture dementirait — la vignette de tete ne serait pas la premiere.
        `&preview.order=ordinal.asc.nullslast,added_at.asc&preview.limit=${LIST_PREVIEW}` +
        `&order=updated_at.desc&limit=${limit}`,
    );
    return rows.flatMap(rowToList);
  }

  /**
   * Des listes a decouvrir — **celles des profils publics, et elles seules**.
   *
   * ## Le manque que ca comble
   *
   * `/listes` ne montrait que les siennes. C'etait la seule partie du produit qui **exige un
   * compte pour exister et vit sur le serveur**, donc la seule dont le contenu des autres
   * etait deja la, deja lisible, deja modere — et invisible. Un visiteur sans compte
   * arrivait sur une page qui ne parlait que de ce qu'il n'avait pas.
   *
   * ## ⚠️ Meme exception que {@link discoverable}, et pas une de plus
   *
   * `public` est une demande explicite d'etre trouve ; la visibilite par defaut est
   * `followers`, donc personne n'y arrive par inadvertance. Le filtre est ecrit ici **et**
   * applique par `lists_select` (`can_see(user_id)`) : le retirer ne montrerait rien de
   * plus, la base rendrait la meme liste.
   *
   * ⚠️ **`profiles!inner` et non `profiles`** : sans `!inner`, PostgREST rend aussi les
   * listes dont le profil ne correspond pas au filtre, avec `profiles: null`. On veut une
   * jointure qui restreint, pas un embarquement qui decore.
   *
   * ## Trier, jamais filtrer — la lecon de `discoverable`, appliquee telle quelle
   *
   * On classe par nombre de series, puis par fraicheur. **On n'ecarte pas les listes
   * vides** : filtrer sur « contient quelque chose » ferait taire cette surface exactement
   * au demarrage a froid, c'est-a-dire le jour ou elle sert. Une liste vide passe derriere,
   * elle ne disparait pas.
   */
  async discoverLists(limit = 12): Promise<readonly DiscoverableList[]> {
    // Le vivier est borne et plus large que ce qu'on affiche, pour la meme raison que
    // `discoverable` : PostgREST ne sait pas trier sur un compte imbrique.
    //
    // ⚠️ `profiles.visibility=eq.public` **en plus** de RLS, et seulement ici : une vitrine
    // s'adresse a un inconnu, donc elle ne montre que ce qui a choisi d'etre public. La
    // recherche, elle, laisse RLS trancher — voir {@link searchLists}.
    const rows = await this.#lists(
      `&profiles.visibility=eq.public&order=updated_at.desc`,
      limit * 2,
    );
    return [...rows]
      .sort((a, b) => (b.count - a.count) || (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, limit);
  }

  /**
   * Chercher une liste par son titre — **le dernier index qui manquait**.
   *
   * ## 🔴 Ce que la recherche ne trouvait pas
   *
   * Elle rendait des series, et depuis le 2026-08-15 des personnes. Chez la reference, elle
   * separe films, critiques, listes, membres, mots et journal. Les listes sont pourtant la
   * seule partie du produit qui **exige un compte pour exister et vit sur le serveur** :
   * elles sont ecrites, lisibles, deja montrees en vitrine sur `/listes` — et introuvables
   * autrement qu'en tombant dessus.
   *
   * ⚠️ **Pas de filtre de visibilite ecrit ici**, contrairement a {@link discoverLists} : une
   * vitrine s'adresse a un inconnu, une recherche s'adresse a **son lecteur**. `lists_select`
   * porte `can_see(user_id)`, donc quelqu'un qui suit une personne trouve ses listes, et un
   * visiteur anonyme ne trouve que les publiques. Rejouer la regle ici en donnerait deux, et
   * c'est celle du client qui se perime.
   *
   * ## 🔴 Elle ne trouvait RIEN, du 2026-08-16 au 2026-08-17
   *
   * Le motif etait compose `title=ilike."*motif*"`, guillemets compris — et les guillemets
   * entrent dans le motif. Aucune liste ne s'appelant `"quelque chose"`, cette recherche
   * repondait vide **pour tout le monde, depuis toujours**, avec l'ecran exact d'« aucun
   * resultat ». Mesure contre la vraie base ; voir {@link likePattern} pour la mesure et
   * pour ce qui doit reellement etre echappe.
   */
  async searchLists(query: string, limit = 8): Promise<readonly DiscoverableList[]> {
    const clean = query.trim();
    // Sous trois caracteres, on se tait : deux lettres rendraient la moitie des listes, ce
    // qui est une enumeration et non une recherche. Meme seuil que `searchProfiles`.
    if (clean.length < 3) return [];
    return this.#lists(
      `&title=ilike.*${encodeURIComponent(likePattern(clean))}*&order=updated_at.desc`,
      limit,
    );
  }

  /**
   * UNE liste, par le nom de son auteur et son identifiant d'URL — ce que `/u/<nom>/liste/…`
   * demande.
   *
   * ## 🔴 Le manque que ca comble
   *
   * `DiscoverLists.tsx` documentait la decision inverse : les listes n'existaient que
   * **groupees**, sous un onglet de profil. C'etait defendable et ca interdisait le geste que
   * « faire une liste pour quelqu'un » suppose — l'envoyer. Une liste sans adresse a elle ne
   * se partage pas ; on partage un profil et on dit « c'est la troisieme ».
   *
   * ## ⚠️ Un seul aller-retour, et le nom sert de filtre
   *
   * La reponse evidente etait `findByHandle` puis `listsBy` puis chercher le bon `slug` — deux
   * appels et une liste entiere pour une carte. `profiles!inner(handle)` porte le filtre dans
   * la meme requete que le contenu, exactement comme {@link discoverLists} le fait pour la
   * visibilite.
   *
   * ⚠️ **Aucun controle de visibilite ecrit ici**, comme {@link searchLists} : `lists_select`
   * porte `can_see(user_id)`. Une liste privee rend donc `undefined` — la meme reponse qu'un
   * `slug` inexistant, ce qui est exactement ce qu'il faut : distinguer les deux ferait de
   * cette adresse un oracle a listes, le defaut que `/u/<nom>` refuse deja pour les noms.
   */
  async listBy(handle: string, slug: string): Promise<DiscoverableList | undefined> {
    const found = await this.#lists(
      `&slug=eq.${encodeURIComponent(slug)}` +
        `&profiles.handle=eq.${encodeURIComponent(handle.toLowerCase())}`,
      1,
    );
    return found[0];
  }

  /**
   * Le corps commun des deux lectures de listes — elles ne different que par leur filtre.
   *
   * Meme motif que `#reviews` et `#activity`, et pour la meme raison : ce parsing tolerant
   * ecarte les lignes sans auteur, et deux copies de ce rejet finiraient par se repondre
   * differemment le jour ou l'une serait corrigee.
   */
  async #lists(filter: string, limit: number): Promise<readonly DiscoverableList[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `lists?select=slug,title,note,updated_at,list_items(count),preview:list_items(subject,title,poster_path),profiles!inner(handle,user_id,face)` +
        filter +
        // ⚠️ Le meme ordre que le contenu de la liste (`032`), sinon la carte annoncerait un
        // ordre que l'ouverture dementirait — la vignette de tete ne serait pas la premiere.
        `&preview.order=ordinal.asc.nullslast,added_at.asc&preview.limit=${LIST_PREVIEW}` +
        `&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const author = row['profiles'] as
        | { handle?: unknown; user_id?: unknown; face?: unknown }
        | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const face = readFace(author.face);
      return rowToList(row).map((list) => ({
        ...list,
        handle: author.handle as string,
        authorId: author.user_id as string,
        ...(face !== undefined ? { face } : {}),
      }));
    });
  }

  /**
   * Les series d'une liste, dans l'ordre ou elles y ont ete posees.
   *
   * ⚠️ Chacune avec son instantane depuis `020` : ouvrir la liste de quelqu'un d'autre
   * affichait sinon autant de fois « Tracked series » qu'elle contient de series que le
   * lecteur ne suit pas. Voir {@link SeriesRef}.
   */
  async listItems(userId: string, slug: string, limit = 500): Promise<readonly SeriesRef[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `list_items?user_id=eq.${encodeURIComponent(userId)}&slug=eq.${encodeURIComponent(slug)}` +
        `&select=subject,title,poster_path` +
        // ⚠️ `nullslast` n'est pas une precaution : sur un tri ascendant, Postgres met les
        // `null` **en tete**. Sans lui, une liste a moitie classee commencerait par ce qu'on
        // n'a justement pas classe. Le rang d'abord, le reste dans son ordre d'ajout (032).
        `&order=ordinal.asc.nullslast,added_at.asc&limit=${limit}`,
    );
    return rows.flatMap(rowToSeriesRef);
  }

  /**
   * **Classer une liste a la main** — 032.
   *
   * ## Un seul aller-retour, quel que soit le nombre de series
   *
   * PostgREST accepte plusieurs lignes dans un POST : `merge-duplicates` sur la cle primaire
   * `(user_id, slug, subject)` ecrit donc tous les rangs d'un coup. Un `PATCH` par ligne
   * aurait fait vingt allers-retours pour un glissement — le cout par geste que ce produit
   * refuse partout.
   *
   * ⚠️ **`merge-duplicates` emprunte le chemin `UPDATE`**, et `list_items` n'avait aucune
   * politique de ce genre : c'est exactement la forme qui rend **42501 en silence** (voir
   * {@link IDEMPOTENCE}, quatre ecritures sur cinq le 2026-08-11). `032` pose la politique
   * **avec** ce geste, pas avant.
   *
   * ⚠️ Le corps porte `title` et `poster_path` **absents** volontairement : un
   * `ON CONFLICT DO UPDATE` n'ecrit que les colonnes envoyees, donc ne rien dire d'eux les
   * laisse en place. Les envoyer a `null` effacerait l'instantane de `020` a chaque
   * reordonnement — un classement ne doit pas couter les vignettes.
   */
  async reorderList(
    userId: string,
    slug: string,
    subjects: readonly string[],
  ): Promise<boolean> {
    if (subjects.length === 0) return true;
    return this.#write(
      'list_items?on_conflict=user_id,slug,subject',
      'POST',
      subjects.map((subject, index) => ({
        user_id: userId,
        slug,
        subject,
        ordinal: index + 1,
      })),
      'resolution=merge-duplicates,return=minimal',
    );
  }

  /**
   * **Tout ce qu'on a range, en un appel** — la matiere de l'export des listes.
   *
   * ## Pourquoi pas une boucle sur {@link listItems}
   *
   * C'est la reponse evidente, et {@link SeriesList.count} l'interdit deux fois dans ce
   * fichier : *« une page de profil qui montre dix listes en ferait sinon onze »*. Ici le
   * filtre porte sur la **personne** et non sur la liste, donc dix listes coutent un appel.
   *
   * ⚠️ Le `slug` est projete **avec** chaque ligne : sans lui, on aurait le contenu de dix
   * listes melange sans savoir laquelle est laquelle.
   */
  async allListItems(
    userId: string,
    limit = 2000,
  ): Promise<readonly (SeriesRef & { readonly slug: string; readonly ordinal?: number })[]> {
    const rows = await this.#rows<Record<string, unknown>>(
      `list_items?user_id=eq.${encodeURIComponent(userId)}` +
        `&select=slug,subject,title,poster_path,ordinal` +
        `&order=slug.asc,ordinal.asc.nullslast,added_at.asc&limit=${limit}`,
    );
    return rows.flatMap((row) => {
      const slug = row['slug'];
      if (typeof slug !== 'string') return [];
      const ordinal = row['ordinal'];
      return rowToSeriesRef(row).map((ref) => ({
        ...ref,
        slug,
        ...(typeof ordinal === 'number' ? { ordinal } : {}),
      }));
    });
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
   * **Renommer une liste, ou reecrire sa phrase.**
   *
   * ## 🔴 Le geste qui manquait, et son cout reel
   *
   * `007_lists.sql` porte `lists_update` depuis le premier jour ; aucun appelant, aucun
   * bouton. Une faute de frappe dans un titre ne se corrigeait donc qu'en **supprimant la
   * liste** — ce qui emporte son contenu par cascade, et son adresse avec. C'est le meme
   * motif que `reviews_delete` (F10) : la base autorisait, le produit ne proposait pas.
   *
   * ## ⚠️ Le `slug` ne bouge PAS, et c'est la decision
   *
   * Il est l'adresse partageable de la liste (`/u/<nom>/liste/<slug>`) depuis le
   * 2026-08-16. Le recalculer depuis le nouveau titre casserait tous les liens deja
   * envoyes — c'est exactement le raisonnement qui interdit le prefixe `/en/` dans
   * `lib/routes.ts` : *l'asymetrie est le prix de la continuite.* Une liste renommee garde
   * donc une adresse qui parle de son ancien nom, et c'est le bon prix.
   *
   * ⚠️ `note: null` efface la phrase — `undefined` ne l'aurait pas envoyee, donc l'aurait
   * laissee en place. C'est le meme piege que `?? null` dans `publishReview`, et il se paie
   * ici de la meme facon : une phrase qu'on ne peut plus retirer.
   */
  async updateList(
    userId: string,
    slug: string,
    list: { readonly title: string; readonly note?: string },
  ): Promise<boolean> {
    return this.#write(
      `lists?user_id=eq.${encodeURIComponent(userId)}&slug=eq.${encodeURIComponent(slug)}`,
      'PATCH',
      {
        title: list.title,
        note: list.note ?? null,
        // ⚠️ Pose a la main : `updated_at` a un defaut a la creation et **aucun declencheur**
        // ne le rafraichit. Sans cette ligne, une liste renommee garderait la date de sa
        // creation, et `discoverLists` la classerait comme si rien n'avait bouge.
        updated_at: new Date().toISOString(),
      },
    );
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
   *
   * ⚠️ **L'instantane s'ecrit ici ou jamais.** `ignore-duplicates` ne met rien a jour : une
   * serie deja rangee garde le titre qu'elle avait — ou n'en aura jamais si elle a ete rangee
   * avant `020`. C'est le prix assume de la resolution juste ; voir {@link SeriesRef}.
   *
   * Il est **facultatif** parce qu'un appelant peut ranger une serie sans l'avoir sous les
   * yeux. L'omettre redonne exactement l'ancien comportement, jamais une erreur.
   */
  async addToList(
    userId: string,
    slug: string,
    subject: string,
    snapshot?: { readonly title?: string; readonly posterPath?: string },
  ): Promise<boolean> {
    return this.#write(
      'list_items',
      'POST',
      {
        user_id: userId,
        slug,
        subject,
        // `?? null` plutot que l'omission, par symetrie avec `publish` — et parce qu'un
        // corps de POST heterogene entre deux appels est une source de surprise gratuite.
        title: snapshot?.title ?? null,
        poster_path: snapshot?.posterPath ?? null,
      },
      'resolution=ignore-duplicates,return=minimal',
    );
  }

  /**
   * **Reprendre la liste de quelqu'un** — F5, le geste qui fait circuler les listes.
   *
   * Copier une liste chez soi pour la suivre est ce qui la fait voyager. Sans lui, une liste
   * partagee se lit et se referme — c'est-a-dire que l'adresse partageable ouverte le
   * 2026-08-16 ne menait a aucun geste.
   *
   * ## ⚠️ Une copie, jamais un lien
   *
   * La liste reprise est **a soi** : on peut y ajouter, en retirer, la renommer. Un abonnement
   * a la liste de quelqu'un d'autre serait un second etat a tenir d'accord avec le premier —
   * et il faudrait decider ce qui arrive quand l'original disparait. Une copie ne pose aucune
   * de ces questions. C'est le meme raisonnement qui fait voyager les instantanes de titre
   * avec chaque ligne depuis `020`.
   *
   * ⚠️ **Le slug est decide par l'appelant**, pas ici : `uniqueSlug` vit dans le domaine avec
   * le reste des regles de nommage, et il lui faut la liste des slugs deja pris. Le client ne
   * decide rien, il transporte — c'est la premiere phrase de ce fichier.
   *
   * ⚠️ **Les elements partent en UN seul POST**, jamais un par serie : PostgREST accepte un
   * tableau, et une liste de vingt series ferait sinon vingt allers-retours pour un geste.
   * `ignore-duplicates` comme {@link addToList}, pour la meme raison — la cle *est* le fait.
   *
   * ⚠️ L'insertion des elements ne part **qu'apres** la creation reussie : dans l'autre sens,
   * une panne entre les deux poserait des lignes rattachees a une liste qui n'existe pas — et
   * la cle etrangere les refuserait de toute facon, en laissant croire a un echec de copie.
   */
  async copyList(
    userId: string,
    list: { readonly slug: string; readonly title: string; readonly note?: string },
    items: readonly SeriesRef[],
  ): Promise<boolean> {
    const created = await this.createList(userId, list);
    if (!created) return false;
    if (items.length === 0) return true;
    return this.#write(
      'list_items',
      'POST',
      items.map((one) => ({
        user_id: userId,
        slug: list.slug,
        subject: one.subject,
        title: one.title ?? null,
        poster_path: one.posterPath ?? null,
      })),
      'resolution=ignore-duplicates,return=minimal',
    );
  }

  /**
   * Les coeurs des listes de quelqu'un : combien, et si j'en fais partie — N3.
   *
   * ⚠️ **Un appel pour toutes ses listes**, jamais un par liste : c'est la meme regle que
   * {@link reviewLikes}, et pour la meme raison — un profil en affiche dix. Le filtre porte
   * donc sur l'auteur, exactement comme {@link listsBy}.
   *
   * ⚠️ Le compte vient d'une fonction `security definer`, donc il est **le meme pour tout le
   * monde**. Compter les lignes visibles donnerait un chiffre different par lecteur.
   *
   * ⚠️ Sans `028` applique, rend `[]` — donc des coeurs a zero, cliquables. Meme degradation
   * douce que {@link reviewLikesAcross} : `#rpc` ne leve jamais.
   */
  async listLikes(authorId: string): Promise<readonly ListLikes[]> {
    const rows = await this.#rpc<Record<string, unknown>>('list_like_counts', {
      for_author: authorId,
    });
    return rows.flatMap((row) =>
      typeof row['slug'] !== 'string'
        ? []
        : [
            {
              slug: row['slug'],
              likes: Number(row['likes'] ?? 0),
              mine: row['mine'] === true,
            },
          ],
    );
  }

  /**
   * Aimer une liste, ou retirer son coeur.
   *
   * Meme mecanique que {@link likeReview}, et les memes deux raisons :
   * `resolution=ignore-duplicates` parce que la cle **est** le fait entier (voir
   * {@link IDEMPOTENCE} — `merge-duplicates` emprunterait le chemin `UPDATE`, que `028`
   * n'ouvre pas et qui rend **42501** en silence), et une suppression reelle parce qu'un
   * coeur se reprend.
   */
  async likeList(
    userId: string,
    authorId: string,
    slug: string,
    liked: boolean,
  ): Promise<boolean> {
    if (!liked) {
      return this.#write(
        `list_likes?liker_id=eq.${encodeURIComponent(userId)}` +
          `&author_id=eq.${encodeURIComponent(authorId)}` +
          `&slug=eq.${encodeURIComponent(slug)}`,
        'DELETE',
      );
    }
    return this.#write(
      'list_likes',
      'POST',
      { liker_id: userId, author_id: authorId, slug },
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
    // ⚠️ Un tableau est accepte depuis le 2026-08-16 (`publishFavorites`) : PostgREST prend
    // plusieurs lignes dans un seul POST, et c'est ce qui evite quatre allers-retours pour
    // quatre epinglees. Une seconde methode aurait duplique le `try/catch` — la forme exacte
    // qui a laisse ce fichier promettre de ne jamais lever **et** lever.
    body?: Record<string, unknown> | readonly Record<string, unknown>[],
    prefer = 'return=minimal',
  ): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url(path), {
        method,
        headers: this.#headers({ Prefer: prefer }),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) this.#failed(path, response.status, 'write');
      return response.ok;
    } catch {
      this.#failed(path, undefined, 'write');
      return false;
    }
  }
}

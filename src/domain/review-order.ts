/**
 * Trier et filtrer les critiques d'une serie — **sans un seul appel de plus**.
 *
 * ## Pourquoi c'est local, alors que `/parcourir` fait des liens
 *
 * `parcourir/page.tsx` s'interdit tout etat React et pose ses facettes en **liens**, parce
 * que chaque combinaison demande un appel au catalogue : c'est le serveur qui repond, donc
 * l'adresse doit porter la question. Ici, c'est l'inverse exact — les critiques d'une serie
 * sont **deja toutes dans le navigateur** au moment ou l'on descend jusqu'a elles, et les
 * coeurs aussi. Trier trente lignes en memoire ne coute aucun appel, ne touche pas au cache
 * de bord, et ne peut pas faire sortir `/serie/[id]` de `○ Static`.
 *
 * Deux mecaniques differentes pour deux couts differents, et non deux facons de faire la
 * meme chose : la regle est « la structure la plus simple **qui marche** ».
 *
 * ## Ce que ce module ne trie PAS, et pourquoi
 *
 * **Par note.** Letterboxd trie ses critiques par etoiles ; ici c'est impossible, et le dire
 * vaut mieux que de le redecouvrir : `PublishedReview` ne porte **aucune note**. La note vit
 * dans le journal de son auteur (`ratings`), la critique dans `reviews`, et les deux ne sont
 * jamais jointes — c'est ce qui permet a une critique d'exister sans note et a une note
 * d'exister sans texte. Un tri par note demanderait une lecture de plus par auteur, soit
 * exactement le cout marginal par utilisateur que `#reviews` refuse partout.
 *
 * Module pur : ni reseau, ni horloge, ni `Date.now()`. Les coeurs entrent par une fonction
 * plutot que par leur cle brute — la forme `${authorId}:${target}` est un detail de la
 * couche sociale, et le domaine n'a pas a la connaitre pour ranger une liste.
 */

/** Ce qu'il faut d'une critique pour la ranger. Le texte n'en fait pas partie. */
export interface AuthoredReview {
  readonly authorId: string;
  readonly publishedAt: string;
}

export const ALL_REVIEW_SORTS = ['recent', 'liked'] as const;
export type ReviewSort = (typeof ALL_REVIEW_SORTS)[number];

export const ALL_REVIEW_AUDIENCES = ['everyone', 'following', 'mine'] as const;
export type ReviewAudience = (typeof ALL_REVIEW_AUDIENCES)[number];

export interface ReviewView {
  readonly sort: ReviewSort;
  readonly audience: ReviewAudience;
}

export interface Reader<T> {
  /** Mon identifiant, absent sans compte. */
  readonly me?: string;
  /**
   * Les identifiants des gens que je suis.
   *
   * ⚠️ **`undefined` veut dire « on ne sait pas encore », et se lit comme un ensemble
   * vide.** C'est le choix sur : afficher toute la liste sous le libelle « les gens que je
   * suis » annoncerait un filtre qui n'a pas eu lieu — precisement le defaut que
   * `review.title` portait (« Ce qu'en disent les gens que vous suivez » au-dessus de
   * critiques que la base rend a tout le monde, y compris a un visiteur qui ne suit
   * personne). Un ecran vide se rattrape par une phrase ; un mensonge non.
   *
   * L'appelant, lui, n'a pas a en arriver la : il attend d'avoir la liste avant de filtrer.
   */
  readonly followed?: ReadonlySet<string>;
  /** Combien de coeurs porte cette critique. Zero par defaut, jamais devine. */
  readonly hearts: (review: T) => number;
}

/**
 * La liste rangee : d'abord qui l'a ecrite, ensuite dans quel ordre.
 *
 * ⚠️ **Le tri par date est refait ici alors que la base le fait deja** (`#reviews` demande
 * `order=published_at.desc`). Trois lignes pour ne pas dependre d'une promesse ecrite
 * ailleurs : le jour ou un appelant fusionnerait deux sources — ce que `mergeFeed` fait
 * deja pour le fil —, l'ordre viendrait d'une liste que personne n'a triee, et rien ne le
 * signalerait.
 *
 * ⚠️ **A egalite de coeurs, on retombe sur la date**, parce que le tri part de la liste
 * deja datee et que `Array.prototype.sort` est stable. Sans ce socle, deux critiques a zero
 * coeur — c'est-a-dire presque toutes — changeraient de place a chaque rendu.
 */
export function orderReviews<T extends AuthoredReview>(
  reviews: readonly T[],
  view: ReviewView,
  reader: Reader<T>,
): readonly T[] {
  const kept = reviews.filter((review) => {
    switch (view.audience) {
      case 'mine':
        // Sans compte il n'y a pas de « miennes ». Le cas ne se presente pas — le filtre
        // ne s'affiche qu'avec un compte —, mais le domaine ne se repose pas la-dessus.
        return reader.me !== undefined && review.authorId === reader.me;
      case 'following':
        return reader.followed?.has(review.authorId) ?? false;
      case 'everyone':
        return true;
    }
  });

  const dated = [...kept].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  if (view.sort === 'recent') return dated;
  return dated.sort((a, b) => reader.hearts(b) - reader.hearts(a));
}

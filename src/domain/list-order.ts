/**
 * Ranger des listes — **sans un seul appel de plus**.
 *
 * ## Le defaut que ca repare, et il se lit dans la requete
 *
 * `listsBy` demande `updated_at` a la base et ordonne dessus (`order=updated_at.desc`).
 * La colonne voyage donc dans **chaque** reponse, elle est portee par le type
 * (`SeriesList.updatedAt`), et le 2026-08-16 aucun `.tsx` du depot ne la lisait : la date
 * etait calculee, transportee, puis jetee a l'affichage. C'est la troisieme fois que ce
 * depot trouve exactement cette forme — la note du public (`f5a1cc4`), le creux de la
 * trajectoire (`spread`), la date de publication d'une critique (`publishedAt`) — et les
 * trois fois, la donnee etait deja payee.
 *
 * Consequence a l'ecran : l'ordre des listes changeait sous les yeux du lecteur (ajouter une
 * serie remonte sa liste) sans que rien ne dise pourquoi, et il n'existait aucun moyen de
 * retrouver « celle qui s'appelle Polars » dans trente cartes.
 *
 * ## Pourquoi trois tris, et pas plus
 *
 * Les trois que la reponse contient deja : la date de derniere modification, le titre, le
 * nombre de series. Ajouter « par date de creation » demanderait une colonne de plus dans le
 * `select` — donc un cout — pour une question que personne ne se pose sur ses propres listes.
 *
 * ⚠️ **Local, comme `review-order` et pour la meme raison** : les listes d'une personne
 * arrivent toutes dans un seul aller-retour (au plus 50), donc les ranger en memoire ne coute
 * aucun appel et ne touche pas au cache de bord. C'est `/parcourir` qui pose ses facettes en
 * liens, parce que la-bas chaque combinaison est une question posee au catalogue.
 *
 * Module pur : ni reseau, ni horloge. Le classement alphabetique recoit sa langue en
 * parametre plutot que de lire un contexte — « Epoque » se range avant ou apres « Etrange »
 * selon la langue, et une fonction qui devine sa locale n'est pas testable.
 */

export const ALL_LIST_SORTS = ['updated', 'title', 'size'] as const;
export type ListSort = (typeof ALL_LIST_SORTS)[number];

/** Ce qu'il faut d'une liste pour la ranger. Ni les vignettes, ni la note, ni l'auteur. */
export interface OrderableList {
  readonly title: string;
  readonly count: number;
  /** Horodatage ISO rendu par la base. */
  readonly updatedAt: string;
}

/**
 * Les listes rangees — une **nouvelle** liste, l'entree n'est jamais touchee.
 *
 * ⚠️ Chaque tri a sa rupture d'egalite, et ce n'est pas du zele : deux listes de trois
 * series, ou deux modifiees la meme seconde, s'echangeraient sinon leur place a chaque rendu
 * selon l'humeur du moteur. Un ordre qui bouge tout seul se lit comme un bug.
 */
export function orderLists<T extends OrderableList>(
  lists: readonly T[],
  sort: ListSort,
  locale: string,
): readonly T[] {
  // ⚠️ `numeric` : « Saison 10 » se range apres « Saison 9 », pas entre 1 et 2. `sensitivity`
  // a `base` pour que « ecrans » et « Écrans » se suivent au lieu de s'ignorer.
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const byTitle = (a: T, b: T) => collator.compare(a.title, b.title);
  // Le plus recent d'abord — c'est l'ordre que la base rend, et celui qu'on retrouve en
  // revenant sur la page.
  const byDate = (a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt);

  const compare: Record<ListSort, (a: T, b: T) => number> = {
    updated: (a, b) => byDate(a, b) || byTitle(a, b),
    title: (a, b) => byTitle(a, b) || byDate(a, b),
    size: (a, b) => b.count - a.count || byDate(a, b) || byTitle(a, b),
  };

  return [...lists].sort(compare[sort]);
}

/** Le tri par defaut : celui que la base applique deja, donc aucun saut a l'arrivee. */
export const DEFAULT_LIST_SORT: ListSort = 'updated';

/** Une valeur venue d'ailleurs — un menu, une adresse — est-elle un tri connu ? */
export function isListSort(value: string): value is ListSort {
  return (ALL_LIST_SORTS as readonly string[]).includes(value);
}

/**
 * La bibliotheque : ce que le journal donne a voir, une fois rassemble.
 *
 * ## Pourquoi ce module existe
 *
 * Le produit se souvenait de vous **sur la page ou vous etiez, et nulle part ailleurs**.
 * Aucun ecran ne montrait l'ensemble. Or trois des cinq ressorts qui font revenir —
 * progression visible, collection, comparaison — n'ont aucun sens sans un lieu ou
 * l'ensemble existe : une memoire sans restitution n'est pas une memoire, c'est un
 * formulaire.
 *
 * Ce module est **pur** : il ne lit ni reseau ni horloge, l'instant de reference est
 * injecte. C'est ce qui permet de tester la partie la plus fragile du produit sans
 * monter un navigateur.
 *
 * ## Pourquoi il ne fait aucun appel
 *
 * Tout ce qu'il affiche vient des instantanes deposes dans le journal en visitant les
 * pages serie. C'est la condition, pas une optimisation : rafraichir trente series a
 * chaque ouverture de la bibliotheque couterait, a cent mille utilisateurs, plusieurs
 * millions d'appels par jour — au-dela de ce que le fournisseur autorise et de ce que
 * le budget supporte (`ROADMAP.md` §1.4).
 */

import {
  freshSnapshot,
  hasContent,
  seriesEntries,
  type Journal,
  type JournalEntry,
  type JournalKey,
  type JournalSnapshot,
} from './journal';

/** Une serie de la bibliotheque, prete a etre dessinee. */
export interface LibraryItem {
  readonly key: JournalKey;
  readonly entry: JournalEntry;
  /** Absent quand l'instantane a expire, ou n'a jamais ete pose. */
  readonly snapshot?: JournalSnapshot;
  /** Date du dernier geste sur cette serie. Sert au tri « le plus recent d'abord ». */
  readonly touchedAt: number;
  /** Jours avant le prochain episode, quand il est annonce et a venir. */
  readonly daysUntilNext?: number;
}

/**
 * Les sections de la bibliotheque.
 *
 * Elles ne sont pas un rangement : chacune repond a une question qu'on se pose
 * reellement en ouvrant l'application.
 */
export interface Library {
  /** « Qu'est-ce que j'avais commence ? » */
  readonly resuming: readonly LibraryItem[];
  /** « Qu'est-ce qui revient bientot ? » — trie par proximite. */
  readonly returning: readonly LibraryItem[];
  /** « Qu'est-ce que je voulais voir ? » */
  readonly wanted: readonly LibraryItem[];
  /** La collection : ce qui est fini, et ce qu'on a laisse tomber. */
  readonly finished: readonly LibraryItem[];
  /** Nombre total de series suivies, toutes sections confondues. */
  readonly total: number;
}

function instant(value: string | undefined): number {
  if (value === undefined) return 0;
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? 0 : at;
}

/**
 * Date du dernier geste porte sur une serie.
 *
 * L'instantane en est exclu volontairement : il est depose par une simple visite, et
 * le laisser compter ferait remonter en tete une serie qu'on n'a fait que consulter.
 */
function lastTouch(entry: JournalEntry): number {
  const dates = [
    instant(entry.position?.declaredAt),
    instant(entry.decision?.at),
    instant(entry.wanted?.at),
    ...Object.values(entry.seasonRatings ?? {}).map((r) => instant(r.at)),
    ...Object.values(entry.episodeRatings ?? {}).map((r) => instant(r.at)),
  ];
  return Math.max(0, ...dates);
}

const DAY_MS = 86_400_000;

function daysUntil(when: string | undefined, now: Date): number | undefined {
  if (when === undefined) return undefined;
  const at = new Date(when).getTime();
  if (Number.isNaN(at)) return undefined;
  const days = Math.ceil((at - now.getTime()) / DAY_MS);
  // Une date passee n'est plus une attente : la diffusion a eu lieu, l'instantane est
  // simplement en retard sur la realite.
  return days >= 0 ? days : undefined;
}

function toItem(key: JournalKey, entry: JournalEntry, now: Date): LibraryItem {
  const snapshot = freshSnapshot(entry, now);
  const days = daysUntil(snapshot?.nextEpisodeAt, now);
  return {
    key,
    entry,
    touchedAt: lastTouch(entry),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(days !== undefined ? { daysUntilNext: days } : {}),
  };
}

const byRecency = (a: LibraryItem, b: LibraryItem): number => b.touchedAt - a.touchedAt;

/**
 * Range le journal en sections.
 *
 * Une serie n'apparait **que dans une section** : voir la meme vignette a trois
 * endroits donne l'impression d'une bibliotheque plus fournie qu'elle ne l'est, et
 * rend chaque section moins fiable. L'ordre de priorite ci-dessous est celui des
 * questions qu'on se pose, pas celui du modele de donnees.
 */
export function buildLibrary(journal: Journal, now: Date = new Date()): Library {
  // A13 : les sections de la bibliotheque sont en forme de serie (« reprendre »,
  // « revient bientot »). Accueillir les films y demande ses propres sections, pas un
  // melange — donc on les ecarte ici jusqu'a ce que cette decision soit prise.
  const items = seriesEntries(journal)
    .filter(([, entry]) => hasContent(entry))
    .map(([key, entry]) => toItem(key, entry, now));

  const resuming: LibraryItem[] = [];
  const returning: LibraryItem[] = [];
  const wanted: LibraryItem[] = [];
  const finished: LibraryItem[] = [];

  for (const item of items) {
    const decision = item.entry.decision?.kind;

    // Fini ou abandonne : c'est une decision explicite, elle prime sur tout le reste.
    if (decision === 'completed' || decision === 'abandoned') {
      finished.push(item);
      continue;
    }

    const started = item.entry.position !== undefined;

    // Commencee et attendue : c'est la seule information que personne d'autre ne
    // donne — « vous en etes la, et la suite arrive dans douze jours ».
    if (started && item.daysUntilNext !== undefined) {
      returning.push(item);
      continue;
    }

    if (started) {
      resuming.push(item);
      continue;
    }

    wanted.push(item);
  }

  return {
    resuming: resuming.sort(byRecency),
    // Par proximite : ce qui revient demain passe avant ce qui revient dans six mois.
    returning: returning.sort(
      (a, b) => (a.daysUntilNext ?? Infinity) - (b.daysUntilNext ?? Infinity),
    ),
    wanted: wanted.sort(byRecency),
    finished: finished.sort(byRecency),
    total: items.length,
  };
}

/**
 * La serie a reprendre en priorite, s'il y en a une.
 *
 * Sert la bande de l'accueil : c'est le rappel que le produit s'interdit d'envoyer par
 * notification (`ROADMAP.md` §3 — le cout marginal par utilisateur est exactement ce
 * qui a tue TV Time). La page d'accueil **est** le rappel : elle ne coute rien, ne
 * demande aucune permission, et se voit au moment ou l'on vient de toute facon.
 */
export function nextToResume(library: Library): LibraryItem | undefined {
  return library.returning[0] ?? library.resuming[0];
}

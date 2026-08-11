/**
 * « Votre annee » — ce que vous avez fait cette annee-la.
 *
 * ## Ce que ce module refuse de dire, et c'est ce qui le rend honnete
 *
 * **Il ne dit pas combien d'heures vous avez regardees en 2026.** Le journal ne le sait
 * pas : une position dit *ou* vous en etes, jamais *quand* vous avez vu chaque episode.
 * Repartir les heures sur l'annee ou la position a ete posee serait une invention — et ce
 * produit signale ce qu'il ignore au lieu de le combler.
 *
 * Ce qu'il dit, en revanche, est **exact** : chaque fait du journal porte sa date depuis la
 * v2, donc « ce que vous avez fait cette annee » se compte sans approximation.
 *
 * La seule grandeur en heures est celle des series **terminees** dans l'annee, et elle
 * s'annonce comme telle : *« les series que vous avez terminees en 2026 pesent 340 h »* est
 * vrai, *« vous avez regarde 340 h en 2026 »* ne l'est pas.
 *
 * ## 🔴 La provenance, sans quoi ce module ment a la premiere reprise d'historique
 *
 * Un import date **tous** ses faits de l'instant de l'import (9.0). Compter les notes par
 * annee sans filtrer donnerait donc, a quelqu'un qui reprend dix ans de TV Time un mardi
 * d'aout, une annee 2026 avec **quatre cents saisons notees** — toutes le meme jour.
 *
 * > **Le filtre est l'annee ET la provenance, jamais l'annee seule.** C'est la raison
 * > d'etre de 9.0, et le piege que ce module aurait eu sans elle.
 *
 * Module **pur** : ni reseau, ni horloge implicite.
 */

import {
  freshSnapshot,
  seriesEntries,
  type Journal,
  type JournalEntry,
  type JournalKey,
} from './journal';

/** La serie la plus notable de l'annee. */
export interface YearHighlight {
  readonly key: JournalKey;
  readonly title: string;
  readonly stars: number;
  /** L'affiche, du meme instantane que le titre — voir {@link HeaviestSeries.posterPath}. */
  readonly posterPath?: string;
}

export interface YearReview {
  readonly year: number;
  /** Series menees au bout dans l'annee. Le geste le plus fort du produit. */
  readonly finished: number;
  /** Saisons notees dans l'annee — **hors import**. */
  readonly seasonsRated: number;
  /** Critiques ecrites dans l'annee. */
  readonly reviewsWritten: number;
  /** Coeurs poses dans l'annee. */
  readonly liked: number;
  /**
   * Minutes que representent les series terminees dans l'annee.
   *
   * ⚠️ **Ce n'est pas « le temps regarde en 2026 »** : un visionnage acheve en janvier a pu
   * commencer l'annee precedente. La phrase qui l'affiche doit dire « les series terminees
   * cette annee pesent X », jamais « vous avez regarde X ». Minorant, comme tout chiffre
   * d'heures ici : une serie sans instantane frais ne compte pas.
   */
  readonly minutesOfFinished: number;
  /** La saison la mieux notee de l'annee, s'il y en a une. */
  readonly best?: YearHighlight;
  /** Vrai quand l'annee contient assez pour meriter un ecran. */
  readonly worthShowing: boolean;
}

/** L'annee d'une date ISO, ou `undefined` si elle est illisible. */
function yearOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const at = new Date(value);
  const year = at.getFullYear();
  return Number.isNaN(year) ? undefined : year;
}

/**
 * Un fait compte-t-il pour cette annee ?
 *
 * Deux conditions, et la seconde est celle qu'on oublie : la bonne annee, **et** un fait
 * vecu ici. Voir la note de provenance en tete de module.
 */
function counts(fact: { readonly at: string; readonly origin?: string } | undefined, year: number): boolean {
  if (fact === undefined) return false;
  if (fact.origin !== undefined) return false;
  return yearOf(fact.at) === year;
}

/** Les minutes d'une serie entierement vue, ou `undefined` si on ne sait pas les chiffrer. */
function minutesOfWhole(entry: JournalEntry, now: Date): number | undefined {
  const snapshot = freshSnapshot(entry, now);
  const sizes = snapshot?.seasonSizes;
  const perEpisode = snapshot?.episodeMinutes;
  if (sizes === undefined || perEpisode === undefined) return undefined;
  return sizes.reduce((sum, s) => sum + s.episodeCount, 0) * perEpisode;
}

/**
 * Les annees ou il s'est passe quelque chose, de la plus recente a la plus ancienne.
 *
 * Sert au selecteur : proposer 2019 a quelqu'un qui n'a rien fait cette annee-la serait
 * l'inviter a decouvrir un ecran vide.
 */
export function yearsWithActivity(journal: Journal): readonly number[] {
  const years = new Set<number>();
  for (const [, entry] of seriesEntries(journal)) {
    for (const completion of entry.completions ?? []) {
      const year = yearOf(completion.at);
      if (year !== undefined) years.add(year);
    }
    for (const rating of Object.values(entry.seasonRatings ?? {})) {
      if (rating.origin !== undefined) continue;
      const year = yearOf(rating.at);
      if (year !== undefined) years.add(year);
    }
    for (const review of Object.values(entry.reviews ?? {})) {
      const year = yearOf(review.at);
      if (year !== undefined) years.add(year);
    }
    const likedYear = entry.liked === undefined ? undefined : yearOf(entry.liked.at);
    if (likedYear !== undefined) years.add(likedYear);
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * Ce que vous avez fait cette annee-la.
 *
 * @param now instant de reference, injecte : il ne sert qu'a l'expiration des instantanes.
 */
export function buildYearReview(journal: Journal, year: number, now: Date = new Date()): YearReview {
  let finished = 0;
  let seasonsRated = 0;
  let reviewsWritten = 0;
  let liked = 0;
  let minutesOfFinished = 0;
  let best: YearHighlight | undefined;

  for (const [key, entry] of seriesEntries(journal)) {
    // Un visionnage acheve n'a pas de provenance : aucun import n'ecrit de `completions`,
    // et une serie menee au bout est un evenement qui a eu lieu ici.
    const completedThisYear = (entry.completions ?? []).some((c) => yearOf(c.at) === year);
    if (completedThisYear) {
      finished += 1;
      minutesOfFinished += minutesOfWhole(entry, now) ?? 0;
    }

    for (const rating of Object.values(entry.seasonRatings ?? {})) {
      if (!counts(rating, year)) continue;
      seasonsRated += 1;
      if (best === undefined || rating.stars > best.stars) {
        const snapshot = freshSnapshot(entry, now);
        const title = snapshot?.title;
        if (title !== undefined) {
          best = {
            key,
            title,
            stars: rating.stars,
            ...(snapshot?.posterPath !== undefined ? { posterPath: snapshot.posterPath } : {}),
          };
        }
      }
    }

    for (const review of Object.values(entry.reviews ?? {})) {
      if (yearOf(review.at) === year) reviewsWritten += 1;
    }

    if (counts(entry.liked, year)) liked += 1;
  }

  return {
    year,
    finished,
    seasonsRated,
    reviewsWritten,
    liked,
    minutesOfFinished: Math.round(minutesOfFinished),
    ...(best !== undefined ? { best } : {}),
    // Se taire plutot que d'annoncer une annee vide : c'est la regle de tout ce qui est
    // derive ici (`MIN_TALLY_COVERAGE`, le point d'arret sans portee, le fil qui compte
    // zero). Un « bilan » a un seul geste n'est pas un bilan.
    worthShowing: finished + seasonsRated + reviewsWritten + liked >= 3,
  };
}

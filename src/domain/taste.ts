/**
 * La forme d'un gout, tiree de son propre journal.
 *
 * ## Le contre-sens dont ce module est ne
 *
 * « La comparaison sociale demande des amis. » Non : **il y a deja un tiers dans la
 * piece**, le public du catalogue. Comparer sa note a la sienne est de la comparaison
 * sociale au sens strict — celle qui accroche — et elle fonctionne des le premier
 * utilisateur, sans compte, sans base, sans moderation. Le blocage de la phase 5 ne
 * porte que sur la **publication de texte d'autrui** ; il ne couvre pas ceci.
 *
 * ## La regle qui gouverne ce module
 *
 * **Un profil calcule sur trois series est du bruit presente comme un fait.** Le
 * projet a deja appris cette lecon a ses depens : un conseil exact mais sans portee ne
 * vaut pas mieux que pas de conseil (le point d'arret qui epargnait 8 % de la serie).
 * D'ou {@link MIN_SERIES_FOR_TASTE} — en dessous, on ne dit rien, et on le dit.
 *
 * Module pur : aucun reseau, aucune horloge implicite.
 */

import { freshSnapshot, type Journal, type JournalEntry } from './journal';

/**
 * Nombre de series notees en dessous duquel aucun trait n'est enonce.
 *
 * Cinq n'a rien de magique, mais la question n'est pas la : il s'agit de refuser
 * d'annoncer « vous notez severement » a quelqu'un qui a mis une note.
 */
export const MIN_SERIES_FOR_TASTE = 5;

/** Ecart moyen au public en deca duquel on ne conclut rien. */
export const NEUTRAL_GAP = 0.25;

export interface TasteProfile {
  /** Series portant au moins une note. */
  readonly ratedSeries: number;
  /** Notes de saison posees, toutes series confondues. */
  readonly seasonRatings: number;
  readonly episodeRatings: number;
  /** Moyenne de toutes les notes de saison, ou `undefined` s'il n'y en a aucune. */
  readonly averageStars?: number;
  /**
   * Ecart moyen a la note du public, en etoiles. Positif = plus genereux.
   *
   * Calcule sur les seules series dont l'instantane porte encore une note publique.
   */
  readonly gapToPublic?: number;
  /** Nombre de series ayant servi au calcul de l'ecart. */
  readonly comparedSeries: number;
  /** Series terminees, abandonnees, et part de celles qu'on mene au bout. */
  readonly completed: number;
  readonly abandoned: number;
  readonly completionRate?: number;
  /** Saison mediane a laquelle on abandonne. La donnee propre du produit. */
  readonly medianAbandonSeason?: number;
  /** Assez de matiere pour enoncer quelque chose ? */
  readonly speaks: boolean;
}

function average(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (lower === undefined || upper === undefined) return undefined;
  return (lower + upper) / 2;
}

function starsOf(entry: JournalEntry): readonly number[] {
  return Object.values(entry.seasonRatings ?? {}).map((r) => r.stars);
}

export function buildTasteProfile(journal: Journal, now: Date = new Date()): TasteProfile {
  const entries = Object.values(journal.entries);

  const allStars: number[] = [];
  const gaps: number[] = [];
  const abandonSeasons: number[] = [];
  let ratedSeries = 0;
  let episodeRatings = 0;
  let completed = 0;
  let abandoned = 0;

  for (const entry of entries) {
    const stars = starsOf(entry);
    if (stars.length > 0) ratedSeries += 1;
    allStars.push(...stars);
    episodeRatings += Object.keys(entry.episodeRatings ?? {}).length;

    const mine = average(stars);
    const theirs = freshSnapshot(entry, now)?.publicStars;
    if (mine !== undefined && theirs !== undefined) gaps.push(mine - theirs);

    const decision = entry.decision;
    if (decision?.kind === 'completed') completed += 1;
    if (decision?.kind === 'abandoned') {
      abandoned += 1;
      // Le point exact de l'abandon est ce qui a de la valeur : c'est lui qui fera la
      // carte des abandons quand il y aura plusieurs personnes (`RATING-MODEL` §7.4).
      if (decision.atSeason !== undefined) abandonSeasons.push(decision.atSeason);
    }
  }

  const decided = completed + abandoned;
  const averageStars = average(allStars);
  const gapToPublic = average(gaps);
  const medianAbandonSeason = median(abandonSeasons);

  return {
    ratedSeries,
    seasonRatings: allStars.length,
    episodeRatings,
    comparedSeries: gaps.length,
    completed,
    abandoned,
    speaks: ratedSeries >= MIN_SERIES_FOR_TASTE,
    ...(averageStars !== undefined ? { averageStars } : {}),
    ...(gapToPublic !== undefined ? { gapToPublic } : {}),
    ...(medianAbandonSeason !== undefined ? { medianAbandonSeason } : {}),
    ...(decided > 0 ? { completionRate: completed / decided } : {}),
  };
}

/** Comment se situe une note face a celle du public. */
export type Severity = 'severe' | 'aligned' | 'generous';

/**
 * Traduit un ecart en trait de caractere — ou en rien.
 *
 * `undefined` quand l'ecart est trop faible pour signifier quoi que ce soit : deux
 * dixiemes d'etoile sur une echelle a dix crans, ce n'est pas un gout, c'est du bruit
 * de mesure.
 */
export function severityOf(gap: number | undefined): Severity | undefined {
  if (gap === undefined) return undefined;
  if (Math.abs(gap) < NEUTRAL_GAP) return 'aligned';
  return gap > 0 ? 'generous' : 'severe';
}

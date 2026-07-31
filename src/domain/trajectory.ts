/**
 * Moteur de trajectoire.
 *
 * Le fait central du domaine (`docs/RATING-MODEL.md` §2.3) : **la qualite d'une
 * serie est une fonction du temps, pas une constante.** Un scalaire ne peut pas la
 * representer ; toute note unique de serie est une perte d'information par
 * construction, et c'est ce qui produit les incoherences d'IMDb.
 *
 * Ce module transforme une suite de notes de saisons en une **forme** : un pic, une
 * constance, une tendance, et un point de rupture. C'est le livrable du produit —
 * pas un nombre.
 *
 * Module pur et deterministe : aucune date implicite, aucun acces externe.
 */

import type { SeriesId, Stars } from './types';
import { MAX_STARS, MIN_STARS } from './types';

/**
 * Ecart-type maximal atteignable sur l'echelle 0,5–5.
 *
 * Pour une variable bornee sur [a, b], l'ecart-type maximal vaut (b − a) / 2 —
 * atteint quand la moitie des valeurs est a chaque borne. Sert a normaliser la
 * constance sur [0, 1].
 */
export const MAX_STANDARD_DEVIATION = (MAX_STARS - MIN_STARS) / 2;

/**
 * Nombre minimal de saisons notees pour qu'une constance ait un sens.
 *
 * En deca, on n'affiche que le pic. Publier un ecart-type calcule sur deux points
 * serait malhonnete (`docs/RATING-MODEL.md` §4).
 */
export const MIN_SEASONS_FOR_CONSISTENCY = 3;

/** Au-dela de ce seuil, la constance est dite « haute ». Calibre en tests. */
export const HIGH_CONSISTENCY_THRESHOLD = 0.8;

/** Pente, en etoiles par saison, au-dela de laquelle une tendance est nette. */
export const SIGNIFICANT_SLOPE = 0.3;

/**
 * Chute minimale entre deux saisons consecutives pour qu'un point de rupture soit
 * digne d'etre signale — et donc pour suggerer un « arrete-toi apres la saison N ».
 *
 * Une etoile pleine : en deca, c'est du bruit de notation, pas un decrochage.
 */
export const BREAK_POINT_MIN_DROP = 1;

/** Une note de saison, reduite au strict necessaire pour le calcul. */
export interface SeasonScore {
  readonly seasonNumber: number;
  readonly stars: Stars;
}

/** Tendance generale de la serie dans le temps. */
export type Trend = 'rising' | 'falling' | 'flat' | 'unknown';

/**
 * Forme de la trajectoire — la typologie lisible sans explication
 * (`docs/RATING-MODEL.md` §4).
 */
export type TrajectoryShape =
  /** Pic eleve tenu jusqu'au bout. */
  | 'masterpiece'
  /** Constante, sans sommet — le confort fiable. */
  | 'steady'
  /** Bien partie, puis decrochage. */
  | 'decline'
  /** Demarrage moyen, puis montee. */
  | 'grower'
  /** Ni tendance ni constance : en dents de scie. */
  | 'erratic'
  /** Moins de deux saisons notees : on ne dit rien. */
  | 'insufficient_data';

/** Une chute entre deux saisons notees. */
export interface BreakPoint {
  /** Derniere saison avant la chute — celle apres laquelle on conseille d'arreter. */
  readonly afterSeason: number;
  /** Premiere saison apres la chute. */
  readonly beforeSeason: number;
  /** Amplitude de la chute, en etoiles, toujours positive. */
  readonly drop: number;
  /**
   * Les deux saisons sont-elles adjacentes ?
   * Si non, la chute enjambe une ou plusieurs saisons non notees et vaut moins.
   */
  readonly contiguous: boolean;
}

export interface Trajectory {
  readonly seriesId: SeriesId;
  /** Notes retenues, triees par numero de saison croissant. */
  readonly scores: readonly SeasonScore[];
  /** Meilleure note de saison. `undefined` si aucune note. */
  readonly peak?: Stars;
  /** Saison ayant atteint le pic. */
  readonly peakSeason?: number;
  /** Note moyenne. Presente a titre indicatif, **jamais** comme note de la serie. */
  readonly mean?: number;
  /**
   * Constance sur [0, 1] : 1 = toutes les saisons identiques.
   * Absente sous {@link MIN_SEASONS_FOR_CONSISTENCY} saisons notees.
   */
  readonly consistency?: number;
  /** Pente de la regression lineaire, en etoiles par saison. */
  readonly slope?: number;
  readonly trend: Trend;
  readonly shape: TrajectoryShape;
  /** La plus grande chute entre deux saisons notees, si elle est significative. */
  readonly breakPoint?: BreakPoint;
  /**
   * Saison apres laquelle le calcul suggere d'arreter.
   *
   * Alimente le verdict `stop_after` (`docs/RATING-MODEL.md` §3 couche 3) — mais
   * **ne le remplace pas** : c'est une suggestion derivee de notes personnelles, pas
   * un jugement. Seul l'utilisateur emet un verdict.
   */
  readonly suggestedStopAfter?: number;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Ecart-type de **population** : les saisons notees constituent l'ensemble
 * complet de ce qui est juge, pas un echantillon tire d'une population plus large.
 */
function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mu = mean(values);
  const variance = mean(values.map((v) => (v - mu) ** 2));
  return Math.sqrt(variance);
}

/**
 * Pente des moindres carres de la note en fonction du **numero de saison**.
 *
 * On utilise le numero reel et non le rang : si les saisons 1, 2 et 6 sont notees,
 * l'ecart temporel compte. Renvoie `undefined` si la pente n'est pas definie
 * (moins de deux points, ou tous les points sur la meme abscisse).
 */
function linearSlope(scores: readonly SeasonScore[]): number | undefined {
  if (scores.length < 2) return undefined;
  const xs = scores.map((s) => s.seasonNumber);
  const ys = scores.map((s) => s.stars);
  const xBar = mean(xs);
  const yBar = mean(ys);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const x = xs[i];
    const y = ys[i];
    if (x === undefined || y === undefined) continue;
    numerator += (x - xBar) * (y - yBar);
    denominator += (x - xBar) ** 2;
  }
  if (denominator === 0) return undefined;
  return numerator / denominator;
}

function trendFromSlope(slope: number | undefined): Trend {
  if (slope === undefined) return 'unknown';
  if (slope > SIGNIFICANT_SLOPE) return 'rising';
  if (slope < -SIGNIFICANT_SLOPE) return 'falling';
  return 'flat';
}

function findBreakPoint(scores: readonly SeasonScore[]): BreakPoint | undefined {
  let worst: BreakPoint | undefined;
  for (let i = 1; i < scores.length; i += 1) {
    const previous = scores[i - 1];
    const current = scores[i];
    if (previous === undefined || current === undefined) continue;
    const drop = previous.stars - current.stars;
    if (drop < BREAK_POINT_MIN_DROP) continue;
    if (worst !== undefined && drop <= worst.drop) continue;
    worst = {
      afterSeason: previous.seasonNumber,
      beforeSeason: current.seasonNumber,
      drop,
      contiguous: current.seasonNumber - previous.seasonNumber === 1,
    };
  }
  return worst;
}

function classify(
  peak: Stars,
  consistency: number | undefined,
  trend: Trend,
): TrajectoryShape {
  const isConsistent = consistency !== undefined && consistency >= HIGH_CONSISTENCY_THRESHOLD;

  // Une serie constamment excellente reste un chef-d'oeuvre meme si elle progresse
  // encore : la constance haute prime sur la tendance.
  if (isConsistent && peak >= 4) return 'masterpiece';
  if (trend === 'falling') return 'decline';
  if (trend === 'rising') return 'grower';
  if (isConsistent) return 'steady';
  return 'erratic';
}

/**
 * Calcule la trajectoire d'une serie a partir de ses notes de saisons.
 *
 * Les doublons sont resolus en gardant la **derniere** occurrence de chaque numero
 * de saison — une renotation ecrase la precedente. Les saisons non notees sont
 * simplement absentes : la trajectoire ne les invente pas.
 */
export function computeTrajectory(
  seriesId: SeriesId,
  rawScores: readonly SeasonScore[],
): Trajectory {
  const deduped = new Map<number, SeasonScore>();
  for (const score of rawScores) {
    deduped.set(score.seasonNumber, score);
  }
  const scores = [...deduped.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);

  if (scores.length === 0) {
    return { seriesId, scores, trend: 'unknown', shape: 'insufficient_data' };
  }

  const starValues = scores.map((s) => s.stars);
  const peakScore = scores.reduce((best, s) => (s.stars > best.stars ? s : best));
  const peak = peakScore.stars;
  const average = mean(starValues);

  const consistency =
    scores.length >= MIN_SEASONS_FOR_CONSISTENCY
      ? Math.max(0, Math.min(1, 1 - standardDeviation(starValues) / MAX_STANDARD_DEVIATION))
      : undefined;

  const slope = linearSlope(scores);
  const trend = trendFromSlope(slope);

  const shape: TrajectoryShape =
    scores.length < 2 ? 'insufficient_data' : classify(peak, consistency, trend);

  const breakPoint = findBreakPoint(scores);

  return {
    seriesId,
    scores,
    peak,
    peakSeason: peakScore.seasonNumber,
    mean: average,
    trend,
    shape,
    ...(consistency !== undefined ? { consistency } : {}),
    ...(slope !== undefined ? { slope } : {}),
    ...(breakPoint !== undefined
      ? { breakPoint, suggestedStopAfter: breakPoint.afterSeason }
      : {}),
  };
}

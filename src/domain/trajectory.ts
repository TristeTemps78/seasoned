/**
 * Moteur de trajectoire.
 *
 * Le fait central du domaine : **la qualite d'une
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

import type { SeriesId } from './types';
import { MAX_STARS, MIN_STARS } from './types';

/**
 * Ecart-type maximal atteignable sur l'echelle 0,5–5.
 *
 * Pour une variable bornee sur [a, b], l'ecart-type maximal vaut (b − a) / 2 —
 * atteint quand la moitie des valeurs est a chaque borne. Sert a normaliser la
 * constance sur [0, 1].
 */
const MAX_STANDARD_DEVIATION = (MAX_STARS - MIN_STARS) / 2;

/**
 * Nombre minimal de saisons notees pour qu'une constance ait un sens.
 *
 * En deca, on n'affiche que le pic. Publier un ecart-type calcule sur deux points
 * serait malhonnete.
 */
export const MIN_SEASONS_FOR_CONSISTENCY = 3;

/** Au-dela de ce seuil, la constance est dite « haute ». Calibre en tests. */
export const HIGH_CONSISTENCY_THRESHOLD = 0.8;

/** Pente, en etoiles par saison, au-dela de laquelle une tendance est nette. */
const SIGNIFICANT_SLOPE = 0.3;

/**
 * Chute minimale entre deux saisons consecutives pour qu'un point de rupture soit
 * digne d'etre signale — et donc pour suggerer un « arrete-toi apres la saison N ».
 *
 * Une etoile pleine : en deca, c'est du bruit de notation, pas un decrochage.
 */
export const BREAK_POINT_MIN_DROP = 1;

/**
 * Dispersion minimale, en etoiles, pour qu'une forme soit nommee — **par defaut, aucune**.
 *
 * Une note humaine identique sur cinq saisons est une information : quelqu'un a
 * delibarement mis quatre etoiles partout. Une moyenne de foule identique sur cinq
 * saisons n'en est pas une : elle refuse simplement de discriminer.
 *
 * Le moteur ne peut pas distinguer les deux — seul l'appelant sait d'ou viennent ses
 * notes. D'ou un garde-fou desactive par defaut, que la couche des notes publiques
 * active pour son compte.
 */
const DEFAULT_MIN_SPREAD_FOR_SHAPE = 0;

/**
 * Une note de saison, reduite au strict necessaire pour le calcul.
 *
 * `stars` est un **nombre** sur [0,5 ; 5] et non le type `Stars` : le modele produit
 * n'emet que des demi-etoiles, mais le moteur, lui, est un
 * calcul et doit accepter des valeurs continues.
 *
 * Ce n'est pas un detail. Arrondir des notes de foule au demi-point les detruit : sur
 * TMDB, les notes d'episode d'une meme serie tiennent dans une bande d'environ un point
 * sur dix. Ramenees a des demi-etoiles, toutes les saisons de *Dexter* valaient 4,0 et
 * la serie ressortait « tenue de bout en bout » — l'exact contraire de sa reputation
 * (constate en production le 2026-08-01).
 */
export interface SeasonScore {
  readonly seasonNumber: number;
  readonly stars: number;
}

/** Tendance generale de la serie dans le temps. */
export type Trend = 'rising' | 'falling' | 'flat' | 'unknown';

/**
 * Forme de la trajectoire — la typologie lisible sans explication.
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
  /**
   * Les saisons sont trop proches pour qu'on puisse conclure quoi que ce soit.
   *
   * Cas frequent avec des notes de foule, qui s'agglutinent : ceux qui notent un
   * episode l'ont regarde, donc l'aiment. Se taire est alors la seule reponse
   * honnete.
   */
  | 'undifferentiated'
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
  readonly peak?: number;
  /** Ecart entre la meilleure et la moins bonne saison notee. */
  readonly spread?: number;
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
   * Alimente le verdict `stop_after` — mais
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

function findBreakPoint(
  scores: readonly SeasonScore[],
  minDrop: number,
): BreakPoint | undefined {
  let worst: BreakPoint | undefined;
  for (let i = 1; i < scores.length; i += 1) {
    const previous = scores[i - 1];
    const current = scores[i];
    if (previous === undefined || current === undefined) continue;
    const drop = previous.stars - current.stars;
    if (drop < minDrop) continue;
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
  peak: number,
  spread: number,
  minSpread: number,
  consistency: number | undefined,
  trend: Trend,
): TrajectoryShape {
  // Avant toute chose : y a-t-il seulement de quoi conclure ? Sur des notes de foule,
  // des saisons separees par un dixieme d'etoile ne dessinent aucune forme — elles
  // dessinent du bruit. Sur des notes humaines, ce garde-fou est desactive.
  if (minSpread > 0 && spread < minSpread) return 'undifferentiated';

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
  options: {
    /**
     * Chute minimale, en etoiles, pour signaler un decrochage.
     *
     * Une etoile pleine pour des notes humaines : en deca, c'est du bruit de notation.
     * Mais une moyenne de foule ne bouge jamais d'une etoile entiere — il faut un seuil
     * bien plus fin pour que le decrochage de *Dexter* soit seulement visible. Le seuil
     * appartient donc a l'appelant, qui sait d'ou viennent ses notes.
     */
    readonly minDrop?: number;
    /**
     * Dispersion en deca de laquelle on refuse de nommer une forme.
     *
     * Zero par defaut : une note humaine constante est un jugement, pas une absence de
     * jugement. A activer pour des notes agregees, qui s'agglutinent naturellement.
     */
    readonly minSpread?: number;
  } = {},
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
  const spread = peak - Math.min(...starValues);

  const consistency =
    scores.length >= MIN_SEASONS_FOR_CONSISTENCY
      ? Math.max(0, Math.min(1, 1 - standardDeviation(starValues) / MAX_STANDARD_DEVIATION))
      : undefined;

  const slope = linearSlope(scores);
  const trend = trendFromSlope(slope);

  const shape: TrajectoryShape =
    scores.length < 2
      ? 'insufficient_data'
      : classify(
          peak,
          spread,
          options.minSpread ?? DEFAULT_MIN_SPREAD_FOR_SHAPE,
          consistency,
          trend,
        );

  const breakPoint = findBreakPoint(scores, options.minDrop ?? BREAK_POINT_MIN_DROP);

  return {
    seriesId,
    scores,
    peak,
    spread,
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

/**
 * L'amplitude minimale qu'un axe de trajectoire montre, en etoiles.
 *
 * Une serie dont toutes les saisons tiennent dans moins d'une etoile n'a pas de forme, et
 * l'axe le dit en la dessinant plate au milieu de sa piste. Au-dela, c'est l'ecart reel qui
 * decide de la hauteur des barres.
 */
export const MIN_CHART_SPAN = 1;

/** La part de la piste qu'occupe toujours la plus petite barre, pour qu'elle reste visible. */
const CHART_FLOOR = 0.08;

/**
 * Les bornes de l'axe, et la hauteur de chaque barre.
 *
 * ## 🔴 Le defaut que cette fonction repare
 *
 * `TrajectoryChart` calculait `(stars / MAX_STARS) * 100` : une echelle absolue de 0 a 5.
 * Mesure au navigateur le 2026-08-15 sur *Breaking Bad*, piste de 96 px, notes de foule
 * 4,2 / 4,2 / 4,1 / 4,2 / 4,5 :
 *
 *     S1  80 px      S2  81 px      S3  79 px      S4  81 px      S5  86 px
 *
 * **Deux pixels entre la meilleure et la pire saison.** Le livrable annonce par le README
 * est « une trajectoire », la phrase imprimee sous le graphe dit *« les ecarts comptent plus
 * que les valeurs »*, et le dessin montrait l'inverse des deux : un mur plat.
 *
 * La cause est arithmetique. Les notes de foule d'une serie tiennent dans une bande etroite
 * — c'est deja ecrit vingt lignes plus haut, a propos de l'arrondi qui detruisait *Dexter* —
 * donc les rapporter a l'echelle complete les ecrase toutes dans le dernier sixieme.
 *
 * ## ⚠️ Ce qui empeche de fabriquer du relief
 *
 * Cadrer sur l'ecart reel, seul, ferait l'erreur symetrique : une serie dont les saisons ne
 * different que de 0,05 ressortirait aussi contrastee qu'une serie qui s'effondre. D'ou
 * {@link MIN_CHART_SPAN} — sous une etoile d'ecart, l'axe garde une etoile, et la serie se
 * dessine plate parce qu'elle **est** plate.
 *
 * Et l'axe ne part plus de zero : c'est un fait que le lecteur doit savoir, donc les bornes
 * sont rendues avec le graphe. Un axe tronque qui ne se declare pas est un mensonge.
 */
export function chartScale(scores: readonly SeasonScore[]): {
  readonly lo: number;
  readonly hi: number;
  /** La hauteur d'une barre, en pourcentage de la piste. */
  readonly heightOf: (stars: number) => number;
} {
  const values = scores.map((s) => s.stars);
  const low = values.length > 0 ? Math.min(...values) : 0;
  const high = values.length > 0 ? Math.max(...values) : MAX_STARS;

  // L'elargissement est **symetrique autour du milieu** : cadrer sur la seule borne basse
  // collerait toutes les barres en haut de la piste des que la serie est bonne.
  const middle = (low + high) / 2;
  const half = Math.max(high - low, MIN_CHART_SPAN) / 2;

  // Borne dure a droite, jamais a gauche : une note ne depasse pas cinq etoiles, et un axe
  // qui commencerait sous zero rendrait la barre du bas plus courte que le plancher.
  const hi = Math.min(MAX_STARS, middle + half);
  const lo = Math.max(0, hi - half * 2);

  const span = hi - lo;
  return {
    lo,
    hi,
    heightOf: (stars) => {
      if (span <= 0) return 100 * (CHART_FLOOR + (1 - CHART_FLOOR) / 2);
      const part = Math.min(1, Math.max(0, (stars - lo) / span));
      // Le plancher : une saison au fond de l'axe reste une barre, pas un trait absent.
      return 100 * (CHART_FLOOR + part * (1 - CHART_FLOOR));
    },
  };
}

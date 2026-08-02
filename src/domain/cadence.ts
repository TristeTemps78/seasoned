/**
 * Rythme de production d'une serie.
 *
 * Corrige un defaut de conception de `status.ts`, constate en production le
 * 2026-08-01 : le seuil de « sans nouvelle » etait **absolu** (dix-huit mois) alors
 * que le rythme d'une serie ne l'est pas.
 *
 *   - *Les Griffin* revient chaque automne. Trois mois de silence est son etat normal ;
 *     l'afficher comme « en attente » n'apprend rien.
 *   - *Stranger Things* sortait une saison tous les deux ou trois ans. Dix-huit mois de
 *     silence n'y a jamais rien signifie.
 *   - Une serie annuelle muette depuis deux ans, en revanche, est un vrai signal.
 *
 * **Le meme nombre de mois ne veut pas dire la meme chose selon la serie.** D'ou une
 * mesure du rythme observe, a comparer a l'attente en cours.
 *
 * Module pur.
 */

import type { Season } from './types';

const MS_PER_DAY = 86_400_000;

/**
 * Multiplicateur applique au rythme observe pour juger une attente anormale.
 *
 * Deux fois l'intervalle habituel : une saison qui aurait deja du sortir, et dont on
 * attend encore autant. En deca, on decrit l'attente sans la qualifier d'anormale.
 */
export const CADENCE_ANOMALY_FACTOR = 2;

/**
 * Bornes du seuil derive, en jours.
 *
 * Le rythme observe ne doit pas produire d'aberration : une serie sortie deux fois en
 * trois mois ne devient pas suspecte apres six mois, et une serie tres espacee ne
 * merite pas un sursis indefini.
 */
export const MIN_DERIVED_LIMBO_DAYS = 365;
export const MAX_DERIVED_LIMBO_DAYS = 1_460;

/**
 * Multiplicateur applique quand un **seul** intervalle a ete observe.
 *
 * Une mesure unique ne distingue pas un rythme d'un accident, mais l'ignorer est pire :
 * on retombe alors sur le seuil fixe, qui condamne les series lentes. Constate en
 * production le 2026-08-02 — *Les Anneaux de Pouvoir*, deux saisons espacees de deux
 * ans, etait declaree « sans nouvelle » apres vingt mois de silence, ce qui est son
 * rythme normal.
 *
 * Plus prudent que {@link CADENCE_ANOMALY_FACTOR}, et jamais en dessous du seuil fixe :
 * une mesure fragile peut allonger le delai, jamais le raccourcir.
 */
export const SINGLE_SAMPLE_FACTOR = 1.5;

export interface Cadence {
  /** Intervalle median entre deux saisons consecutives, en jours. */
  readonly medianGapDays: number;
  /**
   * Nombre d'intervalles observes.
   *
   * Un seul ne fait pas un rythme, mais en dit assez pour ne pas condamner une serie
   * lente — voir {@link SINGLE_SAMPLE_FACTOR}.
   */
  readonly samples: number;
}

/**
 * Rythme observe entre les saisons diffusees.
 *
 * **Mediane et non moyenne** : une longue interruption — greve, pandemie, changement de
 * diffuseur — ne doit pas redefinir le rythme d'une serie par ailleurs reguliere.
 *
 * Un seul intervalle suffit a produire une cadence — `samples` vaudra 1 et le seuil
 * derive sera plus prudent. L'ecarter reviendrait a retomber sur le seuil fixe, qui
 * condamne les series lentes.
 */
export function seasonCadence(seasons: readonly Season[]): Cadence | undefined {
  const dates = seasons
    .map((s) => s.airedFrom)
    .filter((d): d is Date => d !== undefined)
    .map((d) => d.getTime())
    .sort((a, b) => a - b);

  if (dates.length < 2) return undefined;

  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i += 1) {
    const previous = dates[i - 1];
    const current = dates[i];
    if (previous === undefined || current === undefined) continue;
    gaps.push((current - previous) / MS_PER_DAY);
  }
  if (gaps.length === 0) return undefined;

  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 1
      ? gaps[middle]
      : ((gaps[middle - 1] ?? 0) + (gaps[middle] ?? 0)) / 2;

  if (median === undefined || median <= 0) return undefined;
  return { medianGapDays: median, samples: gaps.length };
}

/**
 * Delai au-dela duquel le silence devient anormal **pour cette serie-la**.
 *
 * @param fallbackDays seuil a utiliser quand le rythme est inconnu — une serie de deux
 *   saisons n'a pas d'habitude etablie.
 */
export function limboThresholdDays(
  cadence: Cadence | undefined,
  fallbackDays: number,
): number {
  if (cadence === undefined) return fallbackDays;

  if (cadence.samples < 2) {
    // Une seule mesure : elle peut allonger le delai, jamais le raccourcir. Sans quoi
    // une serie ayant sorti deux saisons a trois mois d'ecart deviendrait suspecte
    // avant meme la fin de l'annee.
    const cautious = cadence.medianGapDays * SINGLE_SAMPLE_FACTOR;
    return Math.min(MAX_DERIVED_LIMBO_DAYS, Math.max(fallbackDays, cautious));
  }

  const derived = cadence.medianGapDays * CADENCE_ANOMALY_FACTOR;
  return Math.min(MAX_DERIVED_LIMBO_DAYS, Math.max(MIN_DERIVED_LIMBO_DAYS, derived));
}

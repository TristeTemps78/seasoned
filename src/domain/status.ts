/**
 * Statut *reel* d'une serie, derive des dates de diffusion.
 *
 * Les fournisseurs annoncent `returning` pour des series mortes depuis trois ans.
 * Les trackers affichent « running », ce qui ne distingue pas « diffusion en cours »
 * de « entre deux saisons » de « probablement morte mais pas encore annulee »
 * (`RESEARCH.md` §3.4). L'utilisateur ne sait donc pas s'il attend ou s'il abandonne.
 *
 * Rien de tout cela n'exige de donnee nouvelle : c'est entierement derivable.
 * Module pur — l'instant de reference est toujours injecte.
 */

import type { ProductionStatus } from './types';
import { limboThresholdDays, type Cadence } from './cadence';

/**
 * Fenetre, en jours, pendant laquelle une serie reste « en diffusion » apres son
 * dernier episode. Couvre confortablement un rythme hebdomadaire et ses pauses
 * courtes (jours feries, evenements sportifs).
 */
const AIRING_RECENCY_DAYS = 21;

/**
 * Horizon, en jours, en deca duquel un prochain episode date suffit a considerer
 * la serie comme active. Un trimestre : la saison est annoncee et programmee.
 */
const UPCOMING_HORIZON_DAYS = 90;

/**
 * Delai par defaut, en jours, au-dela duquel une serie declaree `returning` sans
 * nouvel episode est traitee comme en sursis.
 *
 * 18 mois. **Ce n'est qu'un repli** : des que le rythme de la serie est etabli, il
 * remplace cette constante (`cadence.ts`). Un seuil fixe traitait *Les Griffin* — qui
 * revient chaque automne — comme *Stranger Things*, qui sortait tous les deux ou trois
 * ans, ce qui n'a pas de sens.
 */
export const RENEWAL_LIMBO_DAYS = 548;

/** Statut reel, tel qu'on l'affiche a l'utilisateur. */
export type RealStatus =
  /** Rien n'a encore ete diffuse. */
  | 'upcoming'
  /** Des episodes sortent en ce moment, ou le prochain est date et proche. */
  | 'airing'
  /** Saison terminee, serie vivante, suite attendue. */
  | 'between_seasons'
  /** Declaree vivante, mais sans signe de vie depuis longtemps. */
  | 'awaiting_renewal'
  /** Terminee, avec une fin. */
  | 'ended'
  /** Annulee. */
  | 'cancelled'
  /** Donnees insuffisantes pour trancher. */
  | 'unknown';

/**
 * Les sept statuts, en table exhaustive.
 *
 * `Record<RealStatus, true>` et non un tableau : **ajouter un statut au type sans
 * l'ajouter ici ne compile plus.** Une liste de lecture incomplete rendrait `undefined`
 * pour un statut parfaitement valide, et le journal l'oublierait en silence.
 */
const REAL_STATUSES: Readonly<Record<RealStatus, true>> = {
  upcoming: true,
  airing: true,
  between_seasons: true,
  awaiting_renewal: true,
  ended: true,
  cancelled: true,
  unknown: true,
};

/**
 * Lit un statut venu d'ailleurs — un journal, un autre appareil, une version future.
 *
 * Parsing tolerant (`AGENTS.md` regle 4) : une valeur inconnue rend `undefined` au lieu
 * de casser. Un journal ecrit par une version plus recente du produit, qui connaitrait un
 * huitieme statut, doit rester lisible par celle-ci.
 */
export function parseRealStatus(raw: unknown): RealStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  return Object.hasOwn(REAL_STATUSES, raw) ? (raw as RealStatus) : undefined;
}

export interface StatusInput {
  readonly production: ProductionStatus;
  /** Diffusion du dernier episode paru, si connue. */
  readonly lastAiredAt?: Date;
  /** Diffusion du prochain episode, si elle est datee. */
  readonly nextAiringAt?: Date;
  /**
   * Rythme observe entre les saisons, s'il est etabli.
   *
   * Quand il est fourni, il **remplace** le seuil fixe : le meme nombre de mois ne
   * veut pas dire la meme chose pour une serie annuelle et pour une serie triennale
   * (`cadence.ts`).
   */
  readonly cadence?: Cadence;
}

export interface StatusResult {
  readonly status: RealStatus;
  /** Jours ecoules depuis le dernier episode, si calculable. */
  readonly daysSinceLastAired?: number;
  /** Jours restants avant le prochain episode, si date. */
  readonly daysUntilNext?: number;
  /**
   * La serie est-elle un « zombie » : declaree vivante par le fournisseur, mais
   * silencieuse au-dela de ce qui est normal **pour elle** ?
   */
  readonly zombie: boolean;
  /**
   * Seuil effectivement applique, en jours.
   *
   * Expose parce qu'il n'est plus constant : il vaut {@link RENEWAL_LIMBO_DAYS} par
   * defaut, mais suit le rythme de la serie des qu'il est etabli. Sans cette valeur,
   * un resultat serait impossible a expliquer.
   */
  readonly limboThresholdDays: number;
}

const MS_PER_DAY = 86_400_000;

function daysFrom(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

/**
 * Derive le statut reel.
 *
 * L'ordre des tests compte : une serie terminee ou annulee l'emporte toujours sur
 * les heuristiques de recence, faute de quoi une serie finie la semaine derniere
 * serait affichee « en diffusion ».
 */
export function deriveStatus(input: StatusInput, now: Date): StatusResult {
  const daysSinceLastAired =
    input.lastAiredAt !== undefined ? daysFrom(input.lastAiredAt, now) : undefined;
  const daysUntilNext =
    input.nextAiringAt !== undefined ? daysFrom(now, input.nextAiringAt) : undefined;

  // Le seuil suit le rythme de la serie quand il est etabli. Une serie annuelle
  // muette depuis deux ans est un signal ; une serie triennale, non.
  const threshold = limboThresholdDays(input.cadence, RENEWAL_LIMBO_DAYS);

  const base = {
    limboThresholdDays: threshold,
    ...(daysSinceLastAired !== undefined ? { daysSinceLastAired } : {}),
    ...(daysUntilNext !== undefined ? { daysUntilNext } : {}),
  };

  if (input.production === 'ended') {
    return { ...base, status: 'ended', zombie: false };
  }
  if (input.production === 'canceled') {
    return { ...base, status: 'cancelled', zombie: false };
  }

  const nothingAiredYet = daysSinceLastAired === undefined;
  if (nothingAiredYet) {
    if (input.production === 'planned' || input.production === 'in_production' || input.production === 'pilot') {
      return { ...base, status: 'upcoming', zombie: false };
    }
    return { ...base, status: 'unknown', zombie: false };
  }

  const airedRecently = daysSinceLastAired <= AIRING_RECENCY_DAYS;
  const nextIsClose =
    daysUntilNext !== undefined && daysUntilNext >= 0 && daysUntilNext <= UPCOMING_HORIZON_DAYS;
  if (airedRecently || nextIsClose) {
    return { ...base, status: 'airing', zombie: false };
  }

  const zombie = daysSinceLastAired > threshold;
  return {
    ...base,
    status: zombie ? 'awaiting_renewal' : 'between_seasons',
    zombie,
  };
}

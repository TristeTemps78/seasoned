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

/**
 * Fenetre, en jours, pendant laquelle une serie reste « en diffusion » apres son
 * dernier episode. Couvre confortablement un rythme hebdomadaire et ses pauses
 * courtes (jours feries, evenements sportifs).
 */
export const AIRING_RECENCY_DAYS = 21;

/**
 * Horizon, en jours, en deca duquel un prochain episode date suffit a considerer
 * la serie comme active. Un trimestre : la saison est annoncee et programmee.
 */
export const UPCOMING_HORIZON_DAYS = 90;

/**
 * Delai, en jours, au-dela duquel une serie declaree `returning` sans nouvel
 * episode est traitee comme en sursis.
 *
 * 18 mois : au-dela, une serie « qui revient » sans date n'est presque jamais
 * renouvelee. C'est le cas que tous les trackers affichent a tort comme actif.
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

export interface StatusInput {
  readonly production: ProductionStatus;
  /** Diffusion du dernier episode paru, si connue. */
  readonly lastAiredAt?: Date;
  /** Diffusion du prochain episode, si elle est datee. */
  readonly nextAiringAt?: Date;
}

export interface StatusResult {
  readonly status: RealStatus;
  /** Jours ecoules depuis le dernier episode, si calculable. */
  readonly daysSinceLastAired?: number;
  /** Jours restants avant le prochain episode, si date. */
  readonly daysUntilNext?: number;
  /**
   * La serie est-elle un « zombie » : declaree vivante par le fournisseur, mais
   * sans episode depuis plus de {@link RENEWAL_LIMBO_DAYS} jours ?
   */
  readonly zombie: boolean;
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

  const base = {
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

  const zombie = daysSinceLastAired > RENEWAL_LIMBO_DAYS;
  return {
    ...base,
    status: zombie ? 'awaiting_renewal' : 'between_seasons',
    zombie,
  };
}

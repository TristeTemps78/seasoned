/**
 * Le plan de rattrapage : « 14 episodes en 12 jours, soit 55 min par jour ».
 *
 * ## Ce que ce module ajoute a ce qui existait deja
 *
 * Le produit savait dire ce qu'il reste (`remaining.ts`) et connaissait la date du
 * prochain episode. Les deux cotes a cote ne repondent pourtant pas a la question qu'on
 * se pose reellement devant une saison qui arrive : **est-ce que j'y arrive ?**
 *
 * Croiser les deux transforme une bibliotheque en **plan**. Et c'est gratuit : tout est
 * deja dans le navigateur, `/moi` ne fait aucun appel.
 *
 * ## Le chiffre qui compte est le TEMPS, pas le nombre d'episodes
 *
 * Le reflexe serait d'annoncer « 1,2 episode par jour ». Ca ne veut rien dire : un
 * episode peut faire 22 minutes ou 70. Personne n'organise sa semaine en episodes, tout
 * le monde l'organise en **minutes disponibles le soir**.
 *
 * > « 55 minutes par jour » est une phrase sur laquelle on peut decider. « 1,2 episode
 * > par jour » demande une conversion mentale que le produit est justement la pour faire.
 *
 * C'est exactement le meme raisonnement que le differenciateur d'origine : *le chiffre est
 * la valeur*. « En attente » ne dit rien, « en attente · 11 mois » repond.
 *
 * ## Pourquoi on annonce aussi les plans irrealisables
 *
 * Un plan a quatre heures par jour n'est pas un plan. Le reflexe serait de se taire — et
 * ce serait une erreur ici, parce que **l'information « tu ne rattraperas pas » est
 * exactement celle qu'on cherche**. Elle evite de commencer un marathon perdu d'avance,
 * ou fait choisir de regarder la nouvelle saison plus tard.
 *
 * Le module rend donc les chiffres dans tous les cas et signale simplement, par
 * {@link CatchUpPlan.withinReach}, de quel cote du raisonnable on se trouve. C'est
 * l'affichage qui choisit la formulation — le domaine ne porte pas de jugement.
 *
 * Module pur : ni reseau, ni horloge implicite.
 */

import type { Remaining } from './remaining';

const MS_PER_DAY = 86_400_000;

/**
 * Charge quotidienne au-dela de laquelle un rattrapage n'en est plus un.
 *
 * Deux heures par jour, tous les jours, jusqu'a la date : c'est deja beaucoup pour
 * quelqu'un qui travaille. Le seuil est un **parametre** et non une verite — comme tous
 * les seuils de ce projet depuis la lecon de `trajectory.ts`.
 */
export const COMFORTABLE_MINUTES_PER_DAY = 120;

export interface CatchUpPlan {
  /** Episodes a voir avant la date. */
  readonly episodes: number;
  /** Jours restants, au moins 1 — voir le commentaire dans {@link catchUpPlan}. */
  readonly days: number;
  /** Episodes par jour, non arrondi : c'est l'affichage qui arrondit. */
  readonly perDay: number;
  /** Minutes par jour, absent si l'on ignore la duree d'un episode. */
  readonly minutesPerDay?: number;
  /**
   * Le rythme tient-il dans une soiree ordinaire ?
   *
   * `true` par defaut quand la duree est inconnue : on ne declare pas un plan
   * irrealisable sur une donnee qu'on n'a pas.
   */
  readonly withinReach: boolean;
}

/**
 * Le rythme a tenir pour etre a jour le jour de la sortie.
 *
 * @param remaining ce qu'il reste a voir, tel que `remainingAfter` le rend.
 * @param nextAt date du prochain episode.
 * @param now instant de reference, injecte.
 * @param episodeMinutes duree mediane d'un episode.
 * @returns `undefined` quand la question ne se pose pas : rien a rattraper, pas de date
 *   connue, ou date deja passee. Un plan pour un evenement passe serait un mensonge poli.
 */
export function catchUpPlan(
  remaining: Remaining | undefined,
  nextAt: Date | undefined,
  now: Date,
  episodeMinutes?: number,
): CatchUpPlan | undefined {
  if (remaining === undefined || remaining.done || remaining.episodes <= 0) return undefined;
  if (nextAt === undefined || Number.isNaN(nextAt.getTime())) return undefined;

  const msLeft = nextAt.getTime() - now.getTime();
  if (msLeft <= 0) return undefined;

  // Arrondi au **superieur**, et jamais en dessous de 1. Un episode qui sort dans huit
  // heures laisse « aujourd'hui » pour le voir, pas « zero jour » — et une division par
  // zero produirait un rythme infini, donc un affichage absurde.
  const days = Math.max(1, Math.ceil(msLeft / MS_PER_DAY));
  const perDay = remaining.episodes / days;

  const minutesPerDay =
    episodeMinutes !== undefined && episodeMinutes > 0
      ? Math.round(perDay * episodeMinutes)
      : undefined;

  return {
    episodes: remaining.episodes,
    days,
    perDay,
    ...(minutesPerDay !== undefined ? { minutesPerDay } : {}),
    withinReach: minutesPerDay === undefined || minutesPerDay <= COMFORTABLE_MINUTES_PER_DAY,
  };
}

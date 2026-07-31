/**
 * Horizon de spoiler.
 *
 * Correction issue de `docs/ROADMAP-AUDIT.md` §2 — l'angle mort du modele de
 * notation.
 *
 * Sur Letterboxd, l'etat d'un utilisateur face a une oeuvre est **binaire** : vu ou
 * pas vu. Une case « contient des spoilers » suffit. Pour une serie, l'etat est un
 * **point sur un axe** : le spectateur est *au milieu*. Alors :
 *
 *   - une critique de la saison 5 spoile la saison 4 ;
 *   - la simple existence d'une saison 7 dit que les personnages survivent ;
 *   - **la trajectoire elle-meme est un spoiler** : montrer que la courbe
 *     s'effondre en saison 5 est une information que quelqu'un en saison 2 n'a pas
 *     demandee ;
 *   - le « point d'arret recommande » — le coeur du produit — dit a quelqu'un qui
 *     commence qu'il va etre decu, et quand.
 *
 * D'ou la regle, de niveau 1 : **rien qui depasse ma position sans un geste
 * explicite.** Ce n'est pas une preference d'interface, c'est une contrainte qui
 * traverse chaque requete, chaque page et chaque agregat — donc elle vit dans le
 * domaine, pas dans la couche de rendu.
 *
 * Module pur.
 */

import type { EpisodeRef, Position, RatingTarget, SeasonRef } from './types';
import type { SeasonScore, Trajectory } from './trajectory';
import { computeTrajectory } from './trajectory';

/**
 * Ordonne deux references d'episode.
 *
 * @returns un nombre negatif si `a` precede `b`, positif si `a` suit `b`, 0 si egaux.
 */
export function compareEpisodes(a: EpisodeRef, b: EpisodeRef): number {
  if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
  return a.episodeNumber - b.episodeNumber;
}

/**
 * La cible depasse-t-elle la position du spectateur ?
 *
 * Un spectateur sans position declaree n'a **rien** vu : tout le depasse. C'est le
 * defaut sur : mieux vaut masquer a tort que spoiler.
 */
export function isBeyondPosition(target: EpisodeRef, position: Position | undefined): boolean {
  if (position === undefined) return true;
  return compareEpisodes(target, position.at) > 0;
}

/**
 * Une saison depasse-t-elle la position du spectateur ?
 *
 * Une saison est consideree atteinte des le premier episode vu : quelqu'un en
 * S03E01 sait que la saison 3 existe et peut voir les jugements portes sur elle
 * — mais pas ceux portes sur la saison 4.
 */
export function isSeasonBeyondPosition(
  target: SeasonRef,
  position: Position | undefined,
): boolean {
  if (position === undefined) return true;
  return target.seasonNumber > position.at.seasonNumber;
}

/**
 * Un contenu portant sur `target` doit-il etre masque a un spectateur situe en
 * `position` ?
 *
 * Une cible `series` n'est jamais masquee par elle-meme : c'est le contenu qui
 * l'accompagne (verdict, trajectoire) qui doit l'etre, via les fonctions dediees.
 */
export function isSpoiler(target: RatingTarget, position: Position | undefined): boolean {
  switch (target.kind) {
    case 'episode':
      return isBeyondPosition(target.ref, position);
    case 'season':
      return isSeasonBeyondPosition(target.ref, position);
    case 'series':
      return false;
  }
}

/**
 * Ne conserve que les notes de saisons que le spectateur a le droit de voir.
 *
 * C'est la fonction qui rend la trajectoire affichable sans spoiler : un spectateur
 * en saison 2 voit sa courbe s'arreter a la saison 2.
 */
export function visibleScores(
  scores: readonly SeasonScore[],
  position: Position | undefined,
): readonly SeasonScore[] {
  if (position === undefined) return [];
  return scores.filter((s) => s.seasonNumber <= position.at.seasonNumber);
}

/** Une trajectoire tronquee, accompagnee de ce qui a ete retire. */
export interface RedactedTrajectory {
  readonly trajectory: Trajectory;
  /** Nombre de saisons notees masquees. */
  readonly hiddenSeasons: number;
  /**
   * Existe-t-il, au-dela de la position, une information que le spectateur pourrait
   * vouloir reveler volontairement (un decrochage, un pic) ?
   *
   * Permet d'afficher « il se passe quelque chose plus loin — voir quand meme ? »
   * sans dire quoi.
   */
  readonly hasHiddenSignal: boolean;
}

/**
 * Recalcule une trajectoire limitee a l'horizon du spectateur.
 *
 * On **recalcule** au lieu de masquer a l'affichage : un pic ou un point de rupture
 * derives de saisons non vues fuiteraient a travers les agregats, meme si la courbe
 * est coupee. C'est exactement le genre de fuite qu'un filtrage cote interface
 * laisse passer.
 */
export function redactTrajectory(
  full: Trajectory,
  position: Position | undefined,
): RedactedTrajectory {
  const visible = visibleScores(full.scores, position);
  const hiddenSeasons = full.scores.length - visible.length;
  return {
    trajectory: computeTrajectory(full.seriesId, visible),
    hiddenSeasons,
    hasHiddenSignal: hiddenSeasons > 0,
  };
}

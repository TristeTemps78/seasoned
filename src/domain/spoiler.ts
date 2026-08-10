/**
 * Horizon de spoiler.
 *
 * Correction d'un angle mort du modele de notation.
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

import type { EpisodeRef, Position, SeasonRef } from './types';
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

// ---------------------------------------------------------------------------
// Les critiques
// ---------------------------------------------------------------------------

/** Le minimum qu'il faut d'une critique pour decider si on peut la lire. */
export interface SpoilerBounded {
  /** Jusqu'ou le texte va. `0` = sans spoiler. */
  readonly throughSeason: number;
  readonly text: string;
}

/** Une critique dont le texte a ete mis de cote. */
export type Redacted<T extends SpoilerBounded> = Omit<T, 'text'> & {
  readonly text: string;
  /** Present quand le texte a ete retire ; il vit alors dans `hiddenText`. */
  readonly hidden?: true;
  readonly hiddenText?: string;
};

/**
 * Retire le texte des critiques qui depassent la position du lecteur.
 *
 * ## Pourquoi un texte ne se degrade pas
 *
 * `redactTrajectory` **recalcule** une courbe tronquee, et `redactActivity` **degrade** un
 * fait en retirant le numero de saison et les etoiles. Aucun des deux ne s'applique ici :
 * un texte dit ce qu'il dit, ou rien. La seule question possible est donc binaire.
 *
 * ## Trois exigences sur la forme, chacune pour un defaut precis
 *
 * 1. **Generique.** Le caviardage ne doit pas effacer l'auteur en meme temps que le
 *    spoiler — `activity.ts` porte deja cette lecon. Le typage l'impose, ce qui vaut mieux
 *    qu'un test.
 * 2. **Jamais retiree de la liste.** Un fil a trous est lui-meme un indice : « il y a
 *    quelque chose ici que je n'ai pas le droit de lire » est une information, et savoir
 *    QU'IL existe une critique de la saison 6 n'en revele pas le contenu.
 * 3. **Le texte est deplace, pas efface.** Il part dans `hiddenText`, que le composant ne
 *    rend pas — la revelation reste donc un geste local, sans aller-retour reseau, et la
 *    decision reste dans le domaine.
 *
 * ⚠️ Le lecteur sans position ne voit que les critiques **sans spoiler**. C'est le defaut
 * strict de `isBeyondPosition` (« mieux vaut masquer a tort que spoiler ») — et il ne coupe
 * pas l'audience qui compte, puisque c'est precisement pour elle qu'on ecrit sans spoiler.
 */
/**
 * Le meme caviardage, mais pour des critiques qui **ne portent pas sur la meme oeuvre**.
 *
 * ## Pourquoi cette fonction existe, et ce qu'elle empeche
 *
 * {@link redactReviews} ne prend qu'**une** position, et son commentaire le dit : elle est
 * ecrite pour une fiche serie, ou « toutes ces critiques portent deja sur la meme serie ».
 * Une page de profil melange les oeuvres. L'appeler telle quelle sur une liste melangee
 * appliquerait la position d'une serie aux critiques d'une autre — c'est-a-dire
 * **revelerait la saison 6 de l'une parce que le lecteur en est a la saison 6 de l'autre**.
 *
 * ⚠️ **Et c'est pour ca que la decision est ici et pas dans le composant.** « Quelle position
 * s'applique a quelle critique » est une decision de spoiler ; la laisser dans la couche de
 * rendu est exactement ce que la regle 7 interdit, et ce qu'aucun test de composant ne
 * garderait serieusement.
 *
 * @param positionOf rend la position du lecteur sur une oeuvre donnee, ou `undefined` s'il
 *   ne l'a pas commencee. Le defaut est donc le masquage — « mieux vaut masquer a tort que
 *   spoiler », comme partout dans ce module.
 */
export function redactReviewsAcross<T extends SpoilerBounded & { readonly subject: string }>(
  reviews: readonly T[],
  positionOf: (subject: string) => Position | undefined,
): readonly Redacted<T>[] {
  // Une par une, chacune avec SA position : `redactReviews` mappe 1:1, donc l'appeler sur un
  // singleton est exactement le meme calcul, applique au bon contexte.
  return reviews.flatMap((review) => redactReviews([review], positionOf(review.subject)));
}

export function redactReviews<T extends SpoilerBounded>(
  reviews: readonly T[],
  position: Position | undefined,
): readonly Redacted<T>[] {
  return reviews.map((review) => {
    // Une seule regle, pour les deux granularites : sans spoiler, ou bien le lecteur a
    // atteint la saison que le texte annonce. Une saison est atteinte des son premier
    // episode — meme convention que `isSeasonBeyondPosition`, a laquelle on ne peut pas
    // deleguer ici : elle exige un `SeasonRef` complet, donc un `seriesId` que chaque
    // appelant devrait inventer alors que toutes ces critiques portent deja sur la meme
    // serie.
    const readable =
      review.throughSeason === 0 ||
      (position !== undefined && review.throughSeason <= position.at.seasonNumber);
    if (readable) return review;
    return { ...review, text: '', hidden: true, hiddenText: review.text };
  });
}

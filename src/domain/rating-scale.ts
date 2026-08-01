/**
 * Conversion d'une note publique vers l'echelle du produit.
 *
 * Les fournisseurs notent sur 10 ; le modele de notation retient l'echelle Letterboxd,
 * 0,5 a 5 par pas de 0,5 (`docs/RATING-MODEL.md` §3). Assez grossiere pour rester
 * stable dans le temps — un utilisateur ne sait pas distinguer 7,3 de 7,6, il sait
 * distinguer 3,5 de 4.
 *
 * **Ces notes ne sont pas celles de ce produit.** Elles servent a amorcer : une page
 * serie doit valoir le detour avec zero critique (`ROADMAP.md` §0.1). Le jour ou de
 * vraies notes existent, elles ne se melangent pas a celles-ci — l'origine doit rester
 * visible partout ou une courbe est affichee.
 *
 * Module pur.
 */

import { MAX_STARS, MIN_STARS, type Stars } from './types';

/**
 * Nombre de votes minimal pour qu'une note soit prise au serieux.
 *
 * En deca, la note dit surtout qui a vote. Beaucoup de saisons anciennes ou de niche
 * n'ont qu'une poignee de votes chez TMDB : les inclure produirait une courbe
 * spectaculaire et fausse.
 */
export const MIN_VOTES_FOR_TRUST = 20;

/**
 * Convertit une note sur 10 en etoiles.
 *
 * Arrondi au demi-point le plus proche, borne sur l'echelle. Renvoie `undefined` pour
 * une note absente ou nulle — chez TMDB, `0` signifie « personne n'a vote », pas
 * « detestable ». Les confondre placerait les oeuvres inconnues au fond du classement.
 */
export function starsFromTen(voteAverage: number | undefined): Stars | undefined {
  if (voteAverage === undefined || !Number.isFinite(voteAverage) || voteAverage <= 0) {
    return undefined;
  }
  const halved = voteAverage / 2;
  const rounded = Math.round(halved * 2) / 2;
  const clamped = Math.min(MAX_STARS, Math.max(MIN_STARS, rounded));
  return clamped as Stars;
}

/** Une note publique accompagnee de son assise. */
export interface PublicRating {
  readonly voteAverage: number;
  readonly voteCount: number;
}

/**
 * Note representative d'un ensemble d'episodes.
 *
 * **Mediane, et non moyenne** — meme raison que pour la duree d'episode : un final
 * plebiscite ou un episode de transition mal note ne doit pas decider de la saison
 * entiere. On cherche ce que vaut la saison, pas ce que vaut son meilleur moment.
 *
 * Les episodes trop peu votes sont ecartes avant le calcul.
 */
export function representativeRating(
  ratings: readonly PublicRating[],
): number | undefined {
  const trusted = ratings
    .filter((r) => r.voteCount >= MIN_VOTES_FOR_TRUST && r.voteAverage > 0)
    .map((r) => r.voteAverage)
    .sort((a, b) => a - b);

  if (trusted.length === 0) return undefined;

  const middle = Math.floor(trusted.length / 2);
  if (trusted.length % 2 === 1) return trusted[middle];
  const lower = trusted[middle - 1];
  const upper = trusted[middle];
  if (lower === undefined || upper === undefined) return undefined;
  return (lower + upper) / 2;
}

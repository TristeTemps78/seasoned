/**
 * Conversion d'une note publique vers l'echelle du produit.
 *
 * Les fournisseurs notent sur 10 ; le modele de notation retient l'echelle Letterboxd,
 * 0,5 a 5 par pas de 0,5. Assez grossiere pour rester
 * stable dans le temps — un utilisateur ne sait pas distinguer 7,3 de 7,6, il sait
 * distinguer 3,5 de 4.
 *
 * **Ces notes ne sont pas celles de ce produit.** Elles servent a amorcer : une page
 * serie doit valoir le detour avec zero critique. Le jour ou de
 * vraies notes existent, elles ne se melangent pas a celles-ci — l'origine doit rester
 * visible partout ou une courbe est affichee.
 *
 * Module pur.
 */

import { MAX_STARS, MIN_STARS } from './types';

/**
 * Nombre de votes minimal pour qu'une note soit prise au serieux.
 *
 * En deca, la note dit surtout qui a vote. Beaucoup de saisons anciennes ou de niche
 * n'ont qu'une poignee de votes chez TMDB : les inclure produirait une courbe
 * spectaculaire et fausse.
 */
export const MIN_VOTES_FOR_TRUST = 20;

/**
 * Convertit une note sur 10 vers l'echelle du produit, **sans arrondir**.
 *
 * L'arrondi au demi-point est la bonne granularite pour une note humaine : personne ne
 * distingue 3,6 de 3,7. Il est desastreux pour une moyenne de foule, qui vit dans une
 * bande etroite — sur TMDB, les notes d'episode d'une meme serie tiennent dans environ
 * un point sur dix. Arrondies, toutes les saisons de *Dexter* valaient 4,0 et la serie
 * ressortait « tenue de bout en bout », l'exact contraire de sa reputation.
 *
 * La valeur rendue est donc continue. C'est l'**affichage** qui arrondit, pas le calcul.
 *
 * Renvoie `undefined` pour une note absente ou nulle : chez TMDB, `0` signifie
 * « personne n'a vote » et non « detestable ». Les confondre placerait toute oeuvre
 * inconnue au fond du classement.
 */
export function starsFromTen(voteAverage: number | undefined): number | undefined {
  if (voteAverage === undefined || !Number.isFinite(voteAverage) || voteAverage <= 0) {
    return undefined;
  }
  return Math.min(MAX_STARS, Math.max(MIN_STARS, voteAverage / 2));
}

/**
 * Chute minimale pour signaler un decrochage **sur des notes de foule**.
 *
 * Un quart d'etoile, la ou une note humaine demande une etoile pleine. Les moyennes de
 * foule ne bougent presque pas : ceux qui notent un episode l'ont regarde, donc l'aiment,
 * et les notes s'agglutinent vers le haut. L'ecart entre la meilleure et la pire saison
 * de *Dexter* est d'environ un point sur dix — un demi-point sur cette echelle.
 * Conserver le seuil des notes humaines revenait a ne jamais rien detecter.
 */
export const PUBLIC_BREAK_POINT_MIN_DROP = 0.25;

/**
 * Dispersion minimale pour qu'une forme soit nommee **sur des notes de foule**.
 *
 * Sous un quart d'etoile d'ecart entre la meilleure et la pire saison, la foule refuse
 * de discriminer et il n'y a rien a en tirer. Qualifier cela de « tenue de bout en
 * bout » serait presenter du bruit comme un jugement.
 */
export const PUBLIC_MIN_SPREAD_FOR_SHAPE = 0.25;

/**
 * Position d'une note sur l'echelle de couleur, dans [0, 1].
 *
 * **Bornee sur la plage reellement occupee par les notes de foule, pas sur 0–10.**
 * Meme raison que pour la trajectoire : les notes d'episode s'agglutinent entre 6 et
 * 9 — ceux qui notent un episode l'ont regarde, donc l'aiment. Etaler la couleur sur
 * l'echelle theorique donnerait une grille uniformement verte, ou l'on ne verrait rien.
 *
 * Les bornes ci-dessous sont celles ou l'oeil distingue quelque chose : en dessous de
 * {@link COLOR_FLOOR}, un episode est mauvais pour tout le monde ; au-dessus de
 * {@link COLOR_CEILING}, il est culte.
 */
export const COLOR_FLOOR = 6;
export const COLOR_CEILING = 9;

export function ratingHue(voteAverage: number): number {
  const span = COLOR_CEILING - COLOR_FLOOR;
  return Math.min(1, Math.max(0, (voteAverage - COLOR_FLOOR) / span));
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

/**
 * La dispersion des episodes — « regulière, ou en dents de scie ? »
 *
 * ## 🔴 Ce que ce module repond, et ce qu'il ne peut PAS repondre
 *
 * Le releve du 2026-08-16 demandait la distribution des notes du public : *« deux series a
 * 4,2, l'une consensuelle et l'autre clivante, restent indiscernables — alors que "clivant"
 * est exactement le verdict que ce produit pretend rendre »*.
 *
 * ⚠️ **Cette distribution-la n'existe pas et ne peut pas etre fabriquee.** TMDB sert un
 * `vote_average` et un `vote_count` : une moyenne et un effectif, jamais l'histogramme des
 * votants. Deriver « combien de gens ont mis 2 » d'une moyenne est impossible, et l'inventer
 * serait pire que de se taire. C'est le renoncement explicite que le releve proposait comme
 * seconde branche.
 *
 * Ce qui EST derivable, et que ce module calcule, est l'autre dispersion : celle **des
 * episodes entre eux**. Elle repond a une question differente et voisine — les episodes se
 * ressemblent-ils ? — et c'est celle que la page peut honnetement poser, a condition de la
 * nommer pour ce qu'elle est. Une phrase qui presenterait ceci comme « ce qu'en pensent les
 * gens » serait la cinquieme occurrence de la forme que ce depot connait bien : une phrase
 * restee vraie d'une version anterieure.
 *
 * ## Pourquoi elle n'est pas redondante avec la trajectoire
 *
 * `computeTrajectory` travaille sur des **moyennes de saison**. Cinq saisons a 4,2 peuvent
 * etre 62 episodes tous a 4,2, ou 31 a 3,2 et 31 a 5,2 : la courbe est identique dans les
 * deux cas. C'est precisement l'information qu'une moyenne detruit, et il y a 62 points ici
 * la ou la trajectoire n'en a que cinq — assez pour que le mot « clivant » ait un sens.
 *
 * ## ⚠️ Zero appel de plus
 *
 * `episodeRatings()` charge deja toutes les saisons pour la grille et pour la courbe. Ce
 * module ne fait que lire ce qui est deja paye — le motif que ce depot rencontre a chaque
 * lot, dans l'autre sens.
 *
 * Module pur : ni reseau, ni horloge.
 */

import { MIN_VOTES_FOR_TRUST } from './rating-scale';

/** Un episode note, tel que la grille le porte deja. */
export interface RatedEpisode {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly voteAverage: number;
  readonly voteCount: number;
}

/**
 * Le nombre d'episodes retenus en dessous duquel on ne dit rien.
 *
 * ⚠️ Ce n'est pas le seuil de `stop_map()` recycle. Une distribution sur huit points n'est
 * pas une distribution : chaque episode y pese plus d'un huitieme, donc un seul pilote mal
 * note ferait dire « en dents de scie » d'une mini-serie tenue. Douze est le premier compte
 * ou un histogramme en quatre tranches a plus d'un point par tranche en moyenne.
 */
export const MIN_EPISODES_FOR_SPREAD = 12;

/**
 * La largeur d'une tranche, sur l'echelle /10 du fournisseur.
 *
 * Un demi-point, soit un quart d'etoile — la meme granularite que
 * `PUBLIC_MIN_SPREAD_FOR_SHAPE`, et pour la meme raison : sous ce pas, les notes de foule
 * ne discriminent plus rien.
 */
const BUCKET = 0.5;

/**
 * Le nombre minimal de tranches affichees.
 *
 * ⚠️ Meme lecon que `MIN_CHART_SPAN` sur la trajectoire, et elle a coute une mesure au
 * navigateur : cadrer sur le seul ecart reel ferait ressortir une serie dont tous les
 * episodes tiennent dans un dixieme de point aussi contrastee qu'une serie qui s'effondre.
 * Sous deux points d'amplitude, l'histogramme garde quatre tranches et la serie se dessine
 * groupee parce qu'elle **est** groupee.
 */
const MIN_BUCKETS = 4;

/** Une tranche de l'histogramme. Bornes sur 10, incluses a gauche. */
export interface SpreadBucket {
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

export interface EpisodeSpread {
  /** Combien d'episodes ont ete retenus — ceux assez votes pour compter. */
  readonly counted: number;
  /** La note mediane des episodes retenus, sur 10. */
  readonly median: number;
  /** L'ecart entre le meilleur et le pire episode retenu, sur 10. */
  readonly span: number;
  readonly worst: RatedEpisode;
  readonly best: RatedEpisode;
  /**
   * Combien d'episodes s'ecartent de la mediane de plus d'un demi-point.
   *
   * C'est le chiffre qui repond a la question, et il est volontairement rendu **brut** :
   * « 4 episodes sur 62 » se lit, « constance 0,83 » non. Le produit refuse deja d'afficher
   * la constance normalisee de la trajectoire (`interpret={false}`), pour la meme raison —
   * un indice normalise sur une echelle que les notes de foule n'occupent pas.
   */
  readonly apart: number;
  readonly buckets: readonly SpreadBucket[];
}

/**
 * La dispersion des episodes d'une serie, ou `undefined` s'il n'y a pas de quoi conclure.
 *
 * ⚠️ **Les episodes trop peu votes sont ecartes avant tout calcul**, comme dans
 * `representativeRating` : chez TMDB, beaucoup d'episodes anciens ou de niche n'ont qu'une
 * poignee de votes, et les inclure fabriquerait une dispersion spectaculaire qui ne mesure
 * que l'affluence.
 */
export function episodeSpread(episodes: readonly RatedEpisode[]): EpisodeSpread | undefined {
  const trusted = episodes.filter(
    (one) => one.voteCount >= MIN_VOTES_FOR_TRUST && one.voteAverage > 0,
  );
  if (trusted.length < MIN_EPISODES_FOR_SPREAD) return undefined;

  const sorted = [...trusted].sort((a, b) => a.voteAverage - b.voteAverage);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  if (worst === undefined || best === undefined) return undefined;

  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle]?.voteAverage ?? 0)
      : ((sorted[middle - 1]?.voteAverage ?? 0) + (sorted[middle]?.voteAverage ?? 0)) / 2;

  // Les bornes de l'histogramme, alignees sur la grille des demi-points : une tranche qui
  // commencerait a 7,03 serait illisible, et deux series voisines n'auraient pas les memes
  // tranches — donc ne se compareraient pas.
  const lo = Math.floor(worst.voteAverage / BUCKET) * BUCKET;
  const hi = Math.ceil(best.voteAverage / BUCKET) * BUCKET;
  const wanted = Math.max(MIN_BUCKETS, Math.round((hi - lo) / BUCKET));

  // L'elargissement est symetrique, comme celui de `chartScale` : cadrer sur la seule borne
  // basse collerait toutes les tranches a droite des qu'une serie est bonne.
  const extra = wanted - Math.round((hi - lo) / BUCKET);
  const from = Math.max(0, lo - Math.floor(extra / 2) * BUCKET);
  const buckets: SpreadBucket[] = [];
  for (let i = 0; i < wanted; i += 1) {
    const start = from + i * BUCKET;
    const end = start + BUCKET;
    buckets.push({
      from: start,
      to: end,
      // ⚠️ La derniere tranche est fermee a droite, les autres ouvertes : sans ca, un
      // episode note exactement `hi` — le meilleur, donc toujours present — ne serait
      // compte nulle part, et la somme des tranches ne ferait jamais `counted`.
      count: trusted.filter((one) =>
        i === wanted - 1
          ? one.voteAverage >= start && one.voteAverage <= end
          : one.voteAverage >= start && one.voteAverage < end,
      ).length,
    });
  }

  return {
    counted: trusted.length,
    median,
    span: best.voteAverage - worst.voteAverage,
    worst,
    best,
    apart: trusted.filter((one) => Math.abs(one.voteAverage - median) > BUCKET).length,
    buckets,
  };
}

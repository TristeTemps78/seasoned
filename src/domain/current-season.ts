/**
 * La saison en cours vaut-elle celles d'avant ?
 *
 * ## Le seul moment ou la question se pose, et le seul ou personne ne repond
 *
 * Quand une saison est en cours de diffusion, aucun media ne dit encore si elle tient :
 * les critiques sortent au lancement — sur un ou deux episodes — et les retrospectives
 * des mois apres. Entre les deux, il y a huit a douze semaines pendant lesquelles des
 * millions de gens se demandent chaque jeudi si ca vaut encore le coup, et ou la seule
 * reponse disponible est l'humeur d'un fil de discussion.
 *
 * Or le produit possede, chaque semaine, exactement ce qu'il faut : les notes des episodes
 * deja sortis, et la reference historique de la serie. Le calcul est trivial. C'est le
 * **refus de parler** qui demande du soin.
 *
 * ## ⚠️ Le piege, et il a deja coute trois passes ailleurs
 *
 * `computeTrajectory` a demande trois corrections avant de dire quelque chose de vrai,
 * pour une raison qui vaut mot pour mot ici : **un instrument taille pour des notes
 * humaines ne s'applique pas a des moyennes de foule.** Les notes d'episode d'une meme
 * serie tiennent dans une bande d'environ un point sur dix. Sur trois episodes, un ecart
 * de 0,3 est du bruit — et l'annoncer comme un verdict serait presenter du hasard comme
 * un fait.
 *
 * D'ou trois refus, tous obligatoires :
 *
 * 1. **Assez d'episodes sortis.** Deux episodes ne font pas une saison. En dessous de
 *    {@link MIN_EPISODES_AIRED}, on se tait.
 * 2. **Assez de reference.** Comparer a une seule saison passee compare a un accident.
 * 3. **Un ecart qui depasse le bruit**, au meme seuil que partout ailleurs.
 *
 * En pratique, ce module se tait **la plupart du temps**, et c'est le comportement
 * nominal. Une saison qui se deroule normalement ne merite aucun commentaire.
 *
 * ## Ce qu'il ne fait pas : predire
 *
 * Il ne dit jamais « cette saison sera mauvaise ». Il dit ou en sont **les episodes deja
 * diffuses**, ce qui est un fait verifiable, et laisse la conclusion au lecteur. La
 * distinction n'est pas rhetorique : c'est celle qui a fait retirer « forme » et
 * « constance » de la trajectoire publique.
 *
 * Module pur : ni reseau, ni horloge, ni langue.
 */

import { MIN_VOTES_FOR_TRUST, PUBLIC_BREAK_POINT_MIN_DROP } from './rating-scale';
import type { RatedEpisode } from './entry-point';

/** Episodes diffuses en deca desquels une saison en cours ne dit rien. */
export const MIN_EPISODES_AIRED = 3;

/** Saisons de reference minimales. Comparer a une seule, c'est comparer a un accident. */
export const MIN_REFERENCE_SEASONS = 2;

/**
 * Ecart minimal, sur 10, pour qu'une saison en cours merite un commentaire.
 *
 * Meme valeur que le decrochage de trajectoire, transposee de l'echelle en etoiles vers
 * celle du fournisseur : `PUBLIC_BREAK_POINT_MIN_DROP` vaut 0,25 sur cinq, soit 0,5 sur
 * dix. Un seul seuil pour tout le produit — deux seuils differents pour la meme notion
 * seraient impossibles a defendre, et le premier a diverger serait oublie.
 */
export const MIN_SEASON_GAP = PUBLIC_BREAK_POINT_MIN_DROP * 2;

export interface CurrentSeasonVerdict {
  readonly seasonNumber: number;
  /** Episodes de cette saison deja notes de facon fiable. */
  readonly airedEpisodes: number;
  /** Mediane sur 10 des episodes deja sortis. */
  readonly current: number;
  /** Mediane sur 10 des saisons precedentes, toutes ensemble. */
  readonly reference: number;
  /** Positif : la saison fait mieux que d'habitude. */
  readonly gap: number;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Ou en est la saison en cours, par rapport a l'histoire de la serie.
 *
 * @param episodes tous les episodes notes de la serie, toutes saisons confondues.
 * @param currentSeason numero de la saison en cours de diffusion.
 * @returns `undefined` tant qu'il n'y a rien de solide a dire — c'est le cas courant.
 */
export function judgeCurrentSeason(
  episodes: readonly RatedEpisode[],
  currentSeason: number,
): CurrentSeasonVerdict | undefined {
  const trusted = episodes.filter(
    (e) => e.voteCount >= MIN_VOTES_FOR_TRUST && e.voteAverage > 0,
  );

  const current = trusted.filter((e) => e.seasonNumber === currentSeason);
  if (current.length < MIN_EPISODES_AIRED) return undefined;

  // Strictement anterieures : une saison posterieure n'existe pas encore, et si le
  // catalogue en annonce une, elle n'a pas de note a comparer.
  const past = trusted.filter((e) => e.seasonNumber < currentSeason);
  const pastSeasons = new Set(past.map((e) => e.seasonNumber));
  if (pastSeasons.size < MIN_REFERENCE_SEASONS) return undefined;

  const currentMedian = median(current.map((e) => e.voteAverage));
  const referenceMedian = median(past.map((e) => e.voteAverage));
  if (currentMedian === undefined || referenceMedian === undefined) return undefined;

  const gap = currentMedian - referenceMedian;
  if (Math.abs(gap) < MIN_SEASON_GAP) return undefined;

  return {
    seasonNumber: currentSeason,
    airedEpisodes: current.length,
    current: currentMedian,
    reference: referenceMedian,
    gap,
  };
}

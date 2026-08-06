/**
 * Ce que le produit peut demander, et quand.
 *
 * ## Le defaut repare
 *
 * `docs/RATING-MODEL.md` fait de la **note de saison** l'unite de jugement du produit :
 * c'est elle qui alimente la trajectoire, le point d'arret, le profil de gout — tout ce
 * qui distingue ce site d'un catalogue. Elle etait offerte, jamais demandee. Un
 * spectateur devait penser de lui-meme a remonter la page pour noter une saison qu'il
 * venait de finir.
 *
 * Or le moment ou une note a le plus de sens est **exactement** celui ou l'on vient de
 * terminer la saison : l'impression est fraiche, et la question « ca valait le coup ? »
 * est deja dans la tete. Le produit connaissait ce moment — la position le lui disait —
 * et n'en faisait rien.
 *
 * ## Pourquoi une seule saison, et pas la liste des manquantes
 *
 * Le reflexe serait de reclamer toutes les saisons vues et non notees. Ce serait
 * transformer un rappel en dette : quelqu'un qui a marque S6 en arrivant verrait six
 * demandes, et n'en satisferait aucune. Un seul rappel, sur **la saison la plus recente
 * entierement vue**, garde le geste a un tap et le message credible.
 *
 * C'est la meme regle que le bandeau de securite des donnees : un message qu'on affiche
 * a tort apprend a ignorer les suivants.
 *
 * ## Pourquoi pas « la saison qu'on vient JUSTE de finir »
 *
 * Ce serait plus precis, et inutilisable : la fenetre se refermerait des le premier
 * episode de la saison suivante, c'est-a-dire souvent avant la prochaine visite. Le
 * critere « entierement vue et non notee » reste vrai tant que le geste a du sens.
 *
 * Module pur : ni reseau, ni horloge, ni langue.
 */

import type { EpisodeMark, SeasonSize, WatchPosition } from './remaining';

/**
 * La saison a proposer a la notation, s'il y en a une.
 *
 * @param seasons saisons notables.
 * @param position position declaree — inclusive, comme partout ailleurs.
 * @param rated numeros de saison deja notes.
 * @returns le numero de saison, ou `undefined` s'il n'y a rien a demander.
 */
export function seasonToRate(
  seasons: readonly SeasonSize[],
  position: WatchPosition | undefined,
  rated: ReadonlySet<number>,
  /** Les exceptions. Absentes, le comportement est celui d'avant leur existence. */
  marks: readonly EpisodeMark[] = [],
): number | undefined {
  if (position === undefined) return undefined;

  const candidates = seasons
    .filter((season) => season.episodeCount > 0 && isFullyWatched(season, position, marks))
    .map((season) => season.seasonNumber)
    .filter((seasonNumber) => !rated.has(seasonNumber))
    .sort((a, b) => b - a);

  return candidates[0];
}

/**
 * Une saison est entierement vue si la position la depasse, ou l'atteint a son
 * dernier episode.
 *
 * ⚠️ `>=` et non `>` sur l'episode : la position est **inclusive**. Un `>` exigerait
 * d'avoir commence la saison suivante pour reconnaitre la precedente comme finie, ce
 * qui manquerait precisement le moment vise.
 */
/**
 * A-t-on fini cette saison ?
 *
 * ⚠️ Les episodes **sautes de fin de saison** comptent comme franchis. Sans cela, sauter
 * les deux derniers episodes d'une saison — un geste courant sur les series a remplissage —
 * ferait disparaitre DEFINITIVEMENT le rappel de la noter : la position ne les atteindrait
 * jamais, et rien ne le signalerait. Un rappel qu'on ne recoit pas est un rappel qui
 * n'existe pas.
 */
function isFullyWatched(
  season: SeasonSize,
  position: WatchPosition,
  marks: readonly EpisodeMark[],
): boolean {
  if (season.seasonNumber < position.seasonNumber) return true;
  if (season.seasonNumber > position.seasonNumber) return false;
  if (position.episodeNumber >= season.episodeCount) return true;

  // Tout ce qui suit la position dans cette saison est-il saute ?
  const skipped = new Set(
    marks
      .filter((m) => m.kind === 'skipped' && m.seasonNumber === season.seasonNumber)
      .map((m) => m.episodeNumber),
  );
  for (let episode = position.episodeNumber + 1; episode <= season.episodeCount; episode += 1) {
    if (!skipped.has(episode)) return false;
  }
  return true;
}

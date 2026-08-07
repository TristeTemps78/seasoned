/**
 * « Arretez-vous apres la saison N » — et seulement quand ca vaut la peine.
 *
 * ⚠️ **Ce module vivait dans `lib/catalog.ts`**, c'est-a-dire dans la couche qui parle au
 * reseau — la seule chose qu'il n'a jamais faite. Il ne touche ni cache, ni fournisseur, ni
 * horloge : c'est du domaine pur, et il avait deja son propre fichier de tests. Remis a sa
 * place le 2026-08-07.
 *
 * La regle qu'il encode, apprise en production sur *Dexter* : **un conseil exact mais sans
 * portee ne vaut pas mieux que pas de conseil.** La plus forte chute des notes publiques y
 * est entre les saisons 7 et 8 — s'arreter la epargne huit episodes sur quatre-vingt-seize.
 */

import { episodesThrough, type NormalizedSeasons } from './seasons';
import type { Trajectory } from './trajectory';

/**
 * Part de la serie qu'un point d'arret doit faire economiser pour meriter d'etre dit.
 *
 * Un tiers. Constate en production le 2026-08-01 : sur *Dexter*, la plus forte chute
 * de notes publiques se situe entre les saisons 7 et 8 — s'arreter la epargne huit
 * episodes sur quatre-vingt-seize. Exact, et parfaitement inutile : **conseiller
 * d'arreter juste avant la fin n'aide personne.**
 *
 * Ce n'est pas un cas isole. La derniere saison est frequemment la moins bien notee,
 * donc la plus forte chute tombe souvent a la fin.
 */
export const MIN_STOP_POINT_SAVING = 1 / 3;

/** Ce qu'un point d'arret ferait gagner, quand il vaut la peine d'etre mentionne. */
export interface StopPointAdvice {
  readonly afterSeason: number;
  readonly shortenedMinutes: number;
  readonly fullMinutes: number;
}

/**
 * Traduit un decrochage en conseil chiffre — ou en rien du tout.
 *
 * Renvoie `undefined` quand s'arreter ne changerait pas grand-chose : mieux vaut se
 * taire qu'enoncer un conseil exact et sans portee.
 *
 * ⚠️ **Limite connue et non resolue.** Ces points d'arret derivent de notes de foule,
 * qui souffrent d'un biais de survie : ceux qui ont vu la saison 6 de *Dexter* sont
 * ceux qui ont persevere, et ils la notent bien. Les notes publiques ne retrouvent donc
 * pas l'effondrement dont tout le monde parle. Le conseil est exact sur les donnees, et
 * les donnees ne disent pas ce que dit la reputation.
 */
export function stopPointAdvice(
  trajectory: Trajectory,
  seasons: NormalizedSeasons,
  totalRuntimeMinutes: number | undefined,
  episodeCount: number,
): StopPointAdvice | undefined {
  const afterSeason = trajectory.suggestedStopAfter;
  if (afterSeason === undefined || totalRuntimeMinutes === undefined || episodeCount <= 0) {
    return undefined;
  }

  const kept = episodesThrough(seasons.rateable, afterSeason);
  const saving = 1 - kept / episodeCount;
  if (saving < MIN_STOP_POINT_SAVING) return undefined;

  return {
    afterSeason,
    shortenedMinutes: (kept / episodeCount) * totalRuntimeMinutes,
    fullMinutes: totalRuntimeMinutes,
  };
}

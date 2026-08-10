/**
 * La carte des abandons — ou la foule decroche, et sur quel effectif.
 *
 * ## Le defaut que ce module repare, et il est ecrit dans le domaine depuis 2026-08-01
 *
 * {@link stopPointAdvice} conseille « arretez-vous apres la saison N » a partir des notes
 * publiques du catalogue, et nomme lui-meme sa faillite : **biais de survie**. Ceux qui ont
 * vu la saison 6 de *Dexter* sont ceux qui ont persevere ; ils la notent bien, et la courbe
 * publique ne retrouve donc jamais l'effondrement dont tout le monde parle. *Le conseil est
 * exact sur les donnees, et les donnees ne disent pas ce que dit la reputation.*
 *
 * **Un abandon est declare par celui qui part.** Le biais ne peut pas s'y former : c'est la
 * seule statistique de ce produit qu'aucun catalogue ne sait produire, et elle attendait
 * son agregat depuis que `setDecision` enregistre `atSeason`.
 *
 * ## Les deux moities, et pourquoi elles vivent dans le meme fichier
 *
 * {@link projectStops} dit ce qu'on publie, {@link readAttrition} ce qu'on lit. Elles
 * partagent la definition de ce qu'est « avoir atteint une saison » — la separer en deux
 * modules laisserait les deux definitions diverger sans que rien ne le signale.
 *
 * Module pur : ni reseau, ni horloge, ni langue.
 */

import { seriesEntries, type Journal, type JournalKey } from './journal';
import type { SeasonSize } from './remaining';
import { MIN_STOP_POINT_SAVING } from './stop-point';
import type { Position } from './types';

// ---------------------------------------------------------------------------
// Ce qu'on publie
// ---------------------------------------------------------------------------

/**
 * Ce qu'une personne apporte a la carte d'une serie : jusqu'ou elle est allee, et si elle
 * s'est arretee.
 *
 * ⚠️ **Aucune date, aucun numero d'episode.** La saison suffit a la courbe ; tout champ de
 * plus n'ajouterait rien a la mesure et elargirait la surface d'identification par
 * recoupement. C'est la meme discipline que le fil, qui ne porte jamais de titre d'episode.
 */
export interface StopRecord {
  readonly subject: JournalKey;
  /** Le denominateur : la saison la plus loin atteinte. */
  readonly reachedSeason: number;
  /** La saison ou l'on a declare s'arreter. Absente = encore en route, ou allee au bout. */
  readonly leftAtSeason?: number;
}

/**
 * Ce que le journal permet d'apporter a la carte.
 *
 * ## 🔴 Pourquoi un fait importe est ecarte, et ce n'est pas la raison de 9.0
 *
 * 9.0 ecarte les faits `origin` des agregats **temporels** : un import date tout du jour
 * meme, donc il fausserait un bilan annuel ou une fenetre glissante. Ici on ne lit aucune
 * date — l'argument ne s'applique pas, et il aurait ete faux de le recopier.
 *
 * La vraie raison est **plus grave, et propre a cette mesure** : au 2026-08-10,
 * `importForeign` ecrit une position et **jamais une decision** (constate en 10.4bis). Un
 * import n'apporte donc **que du denominateur, jamais de numerateur** — « il est arrive en
 * saison 4 » sans pouvoir dire « et il s'est arrete la ». Une vague d'imports gonflerait
 * `reached` sans toucher `leftHere`, et la courbe pencherait vers la survie.
 *
 * ⚠️ C'est-a-dire qu'elle **reintroduirait par la porte de derriere exactement le biais de
 * survie que ce module existe pour supprimer.** D'ou l'exclusion — a rouvrir le jour ou un
 * import saura lire un abandon, et pas avant.
 */
export function projectStops(journal: Journal): readonly StopRecord[] {
  const records: StopRecord[] = [];

  // A13 : la carte se lit en saisons, un film n'en a pas.
  for (const [key, entry] of seriesEntries(journal)) {
    const { position, decision } = entry;

    // Voir le bloc ci-dessus : un seul fait repris d'ailleurs suffit a fausser la ligne, et
    // une ligne a moitie vecue vaut moins que pas de ligne.
    if (position?.origin !== undefined || decision?.origin !== undefined) continue;

    const left = decision?.kind === 'abandoned' ? decision.atSeason : undefined;

    // ⚠️ `max` et non la seule position : une position se declare a la main, donc elle peut
    // **reculer**. Sans ce `max`, quelqu'un qui a abandonne en saison 5 puis remis son
    // pointeur en saison 2 produirait `left > reached` — une ligne que la base refuse
    // (`stops_left_within_reached`), donc une publication entiere qui echoue en silence.
    const reached = Math.max(position?.seasonNumber ?? 0, left ?? 0);
    if (reached < 1) continue;

    records.push({
      subject: key,
      reachedSeason: reached,
      ...(left !== undefined ? { leftAtSeason: left } : {}),
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Ce qu'on lit
// ---------------------------------------------------------------------------

/** Une saison de la courbe, telle que `stop_map()` la rend. */
export interface StopBucket {
  readonly season: number;
  /** Combien de gens ont atteint cette saison. Le denominateur. */
  readonly reached: number;
  /** Combien s'y sont arretes. */
  readonly leftHere: number;
}

/**
 * Effectif en dessous duquel un taux n'est pas enonce, saison par saison.
 *
 * ⚠️ **Ce n'est pas le plancher d'anonymat** — celui-la vit dans `stop_map()`, parce qu'une
 * garantie d'anonymat ne peut pas dependre du client. Celui-ci repond a une autre question :
 * *« deux personnes sur trois » est-il un fait ?* Non. C'est la lecon de
 * `MIN_SERIES_FOR_TASTE` : un chiffre calcule sur trois cas est du bruit presente comme un
 * fait, et le produit a deja paye pour l'avoir oublie une fois.
 */
export const MIN_REACHED_FOR_RATE = 5;

/**
 * Taux d'abandon en deca duquel il n'y a rien a dire.
 *
 * Un quart. Toute serie perd du monde a chaque saison — l'annoncer a chaque fois serait
 * dire « des gens arretent de regarder », ce que personne n'a demande. Le produit ne parle
 * que d'un **decrochage**, c'est-a-dire d'un endroit ou la perte cesse d'etre ordinaire.
 */
export const MIN_LEAVE_RATE = 0.25;

/** La saison ou la foule decroche, quand il y en a une. */
export interface CollectiveStop {
  readonly atSeason: number;
  /** Part de ceux qui ont atteint cette saison et s'y sont arretes. Entre 0 et 1. */
  readonly leaveRate: number;
  /**
   * L'effectif du calcul.
   *
   * ⚠️ **Toujours rendu avec le taux, et a afficher avec lui.** « 62 % » seul se lit comme
   * une verite ; « 62 % sur 34 personnes » se lit comme une mesure. C'est la difference
   * entre un chiffre et un fait, et c'est au lecteur d'en juger, pas a nous.
   */
  readonly reached: number;
}

/** La courbe telle qu'un lecteur donne a le droit de la voir. */
export interface RedactedAttrition {
  /** La courbe tronquee a l'horizon du lecteur. Vide s'il n'a pas commence. */
  readonly curve: readonly StopBucket[];
  /** Le decrochage, s'il y en a un **en deca** de la position. */
  readonly verdict?: CollectiveStop;
  /** Nombre de saisons retirees de la courbe. */
  readonly hiddenSeasons: number;
  /**
   * Existe-t-il, au-dela de la position, un decrochage que le lecteur pourrait vouloir
   * reveler volontairement ?
   *
   * Permet d'afficher « il se passe quelque chose plus loin — voir quand meme ? » sans dire
   * quoi. Meme geste que {@link RedactedTrajectory}, et pour la meme raison.
   */
  readonly hasHiddenSignal: boolean;
}

/**
 * Le decrochage d'une courbe, ou rien.
 *
 * On garde la saison au **plus fort** taux d'abandon, parmi celles dont l'effectif parle et
 * dont le taux depasse l'ordinaire.
 */
function worstDrop(curve: readonly StopBucket[]): CollectiveStop | undefined {
  let worst: CollectiveStop | undefined;
  for (const bucket of curve) {
    if (bucket.reached < MIN_REACHED_FOR_RATE) continue;
    const leaveRate = bucket.leftHere / bucket.reached;
    if (leaveRate < MIN_LEAVE_RATE) continue;
    // `>` et non `>=` : a egalite on garde la saison la plus tot, c'est-a-dire celle qui
    // epargne le plus. Et ca rend le resultat stable d'un rendu a l'autre.
    if (worst !== undefined && leaveRate <= worst.leaveRate) continue;
    worst = { atSeason: bucket.season, leaveRate, reached: bucket.reached };
  }
  return worst;
}

/**
 * Un decrochage merite-t-il d'etre dit ?
 *
 * ⚠️ Reutilise {@link MIN_STOP_POINT_SAVING} — la lecon apprise sur *Dexter* en production :
 * **un conseil exact mais sans portee ne vaut pas mieux que pas de conseil.** Elle vaut pour
 * la foule exactement comme pour les notes publiques : signaler un decrochage a l'avant
 * derniere saison n'epargne rien a personne.
 *
 * S'arreter **avant** la saison du decrochage, c'est garder tout ce qui la precede.
 *
 * ⚠️ La somme est refaite ici plutot que deleguee a `episodesThrough` : celle-la prend des
 * `Season` de catalogue, un objet qui ne traverse pas jusqu'au navigateur. {@link SeasonSize}
 * est la forme legere que la fiche serie envoie deja au client — deux champs, et c'est ce
 * que `remaining.ts` et `nudge.ts` consomment pour la meme raison.
 */
function worthSaying(
  stop: CollectiveStop,
  seasons: readonly SeasonSize[],
  episodeCount: number,
): boolean {
  if (episodeCount <= 0) return false;
  const kept = seasons
    .filter((season) => season.seasonNumber <= stop.atSeason - 1)
    .reduce((sum, season) => sum + season.episodeCount, 0);
  return 1 - kept / episodeCount >= MIN_STOP_POINT_SAVING;
}

/**
 * Recalcule la carte a l'horizon du lecteur.
 *
 * ⚠️ **On recalcule au lieu de masquer a l'affichage.** Un decrochage derive de saisons non
 * vues fuiterait a travers l'agregat meme si la courbe est coupee — c'est le defaut exact
 * que `redactTrajectory` documente, et c'est le genre de fuite qu'un filtrage cote interface
 * laisse passer.
 *
 * ⚠️ Un lecteur **sans position n'a rien vu** : tout le depasse, et la courbe est vide.
 * C'est le defaut strict de tout ce module de spoiler — *mieux vaut masquer a tort que
 * spoiler* — et il n'est pas negociable ici : la courbe d'abandon dit a quelqu'un qui
 * commence qu'il va etre decu, et quand.
 *
 * @param buckets la courbe entiere, telle que `stop_map()` la rend.
 * @param position ou en est le lecteur, s'il a commence.
 * @param seasons les saisons notables, pour peser ce qu'un arret epargnerait.
 * @param episodeCount le nombre total d'episodes de la serie.
 */
export function readAttrition(
  buckets: readonly StopBucket[],
  position: Position | undefined,
  seasons: readonly SeasonSize[],
  episodeCount: number,
): RedactedAttrition {
  const horizon = position?.at.seasonNumber;
  const visible = horizon === undefined ? [] : buckets.filter((b) => b.season <= horizon);
  const beyond = horizon === undefined ? buckets : buckets.filter((b) => b.season > horizon);

  const drop = worstDrop(visible);
  const verdict = drop !== undefined && worthSaying(drop, seasons, episodeCount) ? drop : undefined;

  // ⚠️ Le signal cache se mesure avec les **memes** seuils que le verdict visible. Un
  // signal annonce plus liberalement qu'il ne se revele produirait le pire des deux mondes :
  // « il se passe quelque chose plus loin », suivi de rien du tout au clic.
  const hiddenDrop = worstDrop(beyond);

  return {
    curve: visible,
    hiddenSeasons: beyond.length,
    hasHiddenSignal:
      hiddenDrop !== undefined && worthSaying(hiddenDrop, seasons, episodeCount),
    ...(verdict !== undefined ? { verdict } : {}),
  };
}

/**
 * Le journal — **ce qu'on en deduit sans rien y ecrire**.
 *
 * Deux lectures seulement, et elles ont en commun de ne jamais toucher au document :
 * l'instantane ampute de ce qui a vieilli, et la note qu'on suggere a partir des
 * episodes deja notes.
 */

import type { Stars } from '../types';
import {
  SNAPSHOT_IDENTITY_TTL_MS,
  SNAPSHOT_TTL_MS,
  type Journal,
  type JournalEntry,
  type JournalKey,
  type JournalSnapshot,
} from './types';

// ---------------------------------------------------------------------------
// Lectures derivees
// ---------------------------------------------------------------------------

/**
 * L'instantane d'une entree, ampute de ce qui a vieilli.
 *
 * Deux horizons, parce que deux natures de donnees (voir {@link SNAPSHOT_TTL_MS} et
 * {@link SNAPSHOT_IDENTITY_TTL_MS}) :
 *
 *   - au-dela de trente jours, le statut, la date du prochain episode et la note du
 *     public disparaissent — ils ont pu changer ;
 *   - au-dela de six mois, l'instantane entier disparait — c'est le plafond
 *     contractuel.
 *
 * L'expiration est appliquee **ici, a la lecture**, et pas au moment de l'ecriture :
 * un journal peut dormir des mois dans un navigateur ferme, et il n'existe aucune
 * tache de fond pour faire le menage.
 *
 * ## ⚠️ Ce qui a change le 2026-08-03, et pourquoi
 *
 * La **forme** d'une serie — duree d'un episode, taille de ses saisons — survit desormais
 * aux trente jours, dans la limite du plafond contractuel comme tout le reste.
 *
 * Le premier decoupage rangeait ces deux champs avec le mouvant, ce qui rendait le bilan
 * de temps passe aveugle a toute serie non revisitee depuis un mois — c'est-a-dire
 * **precisement les series terminees**, celles qui pesent le plus lourd dans un bilan. Le
 * chiffre aurait ete un minorant si severe qu'il n'aurait plus rien mesure.
 *
 * C'est le meme defaut que celui trouve en verifiant la bibliotheque au navigateur, quand
 * un delai unique faisait retomber toute serie finie sur « Serie 1405 » : **un titre ne se
 * perime pas, un statut si.** Une duree d'episode non plus, et une saison passee non plus.
 * Seule la saison en cours grossit — donc l'erreur va vers la sous-estimation, ce qui est
 * le sens qu'on veut.
 */
export function freshSnapshot(
  entry: JournalEntry | undefined,
  now: Date = new Date(),
): JournalSnapshot | undefined {
  const snapshot = entry?.snapshot;
  if (snapshot === undefined) return undefined;

  const age = now.getTime() - new Date(snapshot.cachedAt).getTime();
  if (Number.isNaN(age) || age > SNAPSHOT_IDENTITY_TTL_MS) return undefined;
  if (age <= SNAPSHOT_TTL_MS) return snapshot;

  // Ne reste que ce qui ne se perime pas : l'identite de la serie, et sa forme.
  return {
    title: snapshot.title,
    cachedAt: snapshot.cachedAt,
    ...(snapshot.posterPath !== undefined ? { posterPath: snapshot.posterPath } : {}),
    ...(snapshot.episodeMinutes !== undefined
      ? { episodeMinutes: snapshot.episodeMinutes }
      : {}),
    ...(snapshot.seasonSizes !== undefined ? { seasonSizes: snapshot.seasonSizes } : {}),
  };
}

/** Les notes de saison d'une serie, sous la forme qu'attend le moteur de trajectoire. */
export function seasonScoresOf(
  journal: Journal,
  key: JournalKey,
): readonly { seasonNumber: number; stars: number }[] {
  const ratings = journal.entries[key]?.seasonRatings ?? {};
  return Object.entries(ratings)
    .map(([season, rating]) => ({ seasonNumber: Number(season), stars: rating.stars }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

/**
 * Moyenne des notes d'episode d'une saison, arrondie au demi-point.
 *
 * **Une suggestion, jamais une ecriture** ( : on signale, on ne
 * repare pas en silence). Quelqu'un qui note six episodes d'une saison a manifestement
 * un avis sur la saison ; le lui proposer est utile, le decider a sa place ne l'est pas.
 */
export function suggestedSeasonRating(
  entry: JournalEntry | undefined,
  seasonNumber: number,
): Stars | undefined {
  const ratings = entry?.episodeRatings ?? {};
  const values = Object.entries(ratings)
    .filter(([cell]) => cell.startsWith(`${seasonNumber}:`))
    .map(([, rating]) => rating.stars);

  if (values.length === 0) return undefined;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const rounded = Math.round(mean * 2) / 2;
  return Math.min(5, Math.max(0.5, rounded)) as Stars;
}

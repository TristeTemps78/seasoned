/**
 * Le journal personnel : ce que le produit retient de vous.
 *
 * Quatre des cinq ressorts qui font revenir sur un site de ce genre — progression
 * visible, collection, comparaison, decouverte de soi — supposent que le produit se
 * souvienne. Aucun n'etait possible ici : le site ne stockait rien.
 *
 * **Ce module ne connait ni navigateur ni base de donnees.** Il decrit la forme des
 * donnees et sait la lire de facon tolerante ; ou elles sont rangees ne le regarde pas.
 * C'est ce qui permettra de passer du stockage local a une base sans le reecrire — la
 * forme retenue est exactement celle qu'attend `docs/RATING-MODEL.md` §7 :
 *
 *   - la position est **un pointeur**, pas une collection de booleens ;
 *   - la cible d'une note est **polymorphe** des le depart (saison, episode, serie) ;
 *   - la decision est une entree **de plein droit**, pas un champ `status`.
 *
 * Lecture **tolerante**, comme pour le catalogue : une entree corrompue est ecartee,
 * jamais l'ensemble. Perdre tout un journal parce qu'une ligne est illisible serait
 * la pire trahison possible pour un produit qui demande d'y investir du temps.
 */

import type { DecisionKind, SeriesId, Stars } from './types';

/** Version du format. Toute lecture d'une version inconnue repart de zero. */
export const JOURNAL_VERSION = 1;

/** Ou en est l'utilisateur dans une serie. */
export interface JournalPosition {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** ISO 8601. Une chaine et non une `Date` : c'est ce qui se serialise. */
  readonly declaredAt: string;
}

/** Une note posee par l'utilisateur. */
export interface JournalRating {
  readonly stars: Stars;
  readonly at: string;
}

/** Ce que l'utilisateur a decide de faire de la serie. */
export interface JournalDecision {
  readonly kind: DecisionKind;
  readonly at: string;
  readonly atSeason?: number;
  readonly atEpisode?: number;
}

/** Tout ce que l'on retient d'une serie. */
export interface JournalEntry {
  readonly position?: JournalPosition;
  /** Notes de saison, indexees par numero de saison. */
  readonly seasonRatings?: Readonly<Record<string, JournalRating>>;
  readonly decision?: JournalDecision;
}

export interface Journal {
  readonly version: number;
  readonly entries: Readonly<Record<SeriesId, JournalEntry>>;
}

export const EMPTY_JOURNAL: Journal = { version: JOURNAL_VERSION, entries: {} };

// ---------------------------------------------------------------------------
// Lecture tolerante
// ---------------------------------------------------------------------------

const VALID_STARS: ReadonlySet<number> = new Set([
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
]);

const VALID_DECISIONS: ReadonlySet<string> = new Set([
  'continuing',
  'paused',
  'abandoned',
  'completed',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPositiveInt(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/** Une date lisible, ou l'instant present : mieux vaut une date approximative que rien. */
function readInstant(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function parsePosition(raw: unknown, now: string): JournalPosition | undefined {
  const source = asRecord(raw);
  const seasonNumber = readPositiveInt(source, 'seasonNumber');
  const episodeNumber = readPositiveInt(source, 'episodeNumber');
  if (seasonNumber === undefined || episodeNumber === undefined) return undefined;
  return {
    seasonNumber,
    episodeNumber,
    declaredAt: readInstant(source, 'declaredAt', now),
  };
}

function parseRating(raw: unknown, now: string): JournalRating | undefined {
  const source = asRecord(raw);
  const stars = source['stars'];
  if (typeof stars !== 'number' || !VALID_STARS.has(stars)) return undefined;
  return { stars: stars as Stars, at: readInstant(source, 'at', now) };
}

function parseDecision(raw: unknown, now: string): JournalDecision | undefined {
  const source = asRecord(raw);
  const kind = source['kind'];
  if (typeof kind !== 'string' || !VALID_DECISIONS.has(kind)) return undefined;

  const atSeason = readPositiveInt(source, 'atSeason');
  const atEpisode = readPositiveInt(source, 'atEpisode');
  return {
    kind: kind as DecisionKind,
    at: readInstant(source, 'at', now),
    ...(atSeason !== undefined ? { atSeason } : {}),
    ...(atEpisode !== undefined ? { atEpisode } : {}),
  };
}

function parseEntry(raw: unknown, now: string): JournalEntry | undefined {
  const source = asRecord(raw);

  const position = parsePosition(source['position'], now);
  const decision = parseDecision(source['decision'], now);

  const seasonRatings: Record<string, JournalRating> = {};
  for (const [season, value] of Object.entries(asRecord(source['seasonRatings']))) {
    if (!/^[0-9]+$/.test(season)) continue;
    const rating = parseRating(value, now);
    if (rating !== undefined) seasonRatings[season] = rating;
  }

  const hasRatings = Object.keys(seasonRatings).length > 0;
  if (position === undefined && decision === undefined && !hasRatings) return undefined;

  return {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(hasRatings ? { seasonRatings } : {}),
  };
}

/**
 * Lit un journal serialise.
 *
 * Ne leve jamais. Une entree illisible est ecartee, les autres survivent : perdre tout
 * un journal parce qu'une ligne est corrompue serait indefendable.
 *
 * @param now instant de repli pour les dates manquantes, injecte pour les tests.
 */
export function parseJournal(raw: string | null | undefined, now = new Date()): Journal {
  if (raw === null || raw === undefined || raw.trim().length === 0) return EMPTY_JOURNAL;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return EMPTY_JOURNAL;
  }

  const source = asRecord(decoded);
  // Une version inconnue est plus dangereuse qu'un journal vide : on ne devine pas
  // la forme d'un format qu'on ne connait pas.
  if (source['version'] !== JOURNAL_VERSION) return EMPTY_JOURNAL;

  const stamp = now.toISOString();
  const entries: Record<SeriesId, JournalEntry> = {};
  for (const [seriesId, value] of Object.entries(asRecord(source['entries']))) {
    if (seriesId.length === 0) continue;
    const entry = parseEntry(value, stamp);
    if (entry !== undefined) entries[seriesId] = entry;
  }

  return { version: JOURNAL_VERSION, entries };
}

/** Serialise un journal. Format stable — c'est aussi le format d'export. */
export function serializeJournal(journal: Journal): string {
  return JSON.stringify({ version: JOURNAL_VERSION, entries: journal.entries });
}

// ---------------------------------------------------------------------------
// Ecritures
// ---------------------------------------------------------------------------

function withEntry(journal: Journal, seriesId: SeriesId, entry: JournalEntry): Journal {
  const hasContent =
    entry.position !== undefined ||
    entry.decision !== undefined ||
    (entry.seasonRatings !== undefined && Object.keys(entry.seasonRatings).length > 0);

  const entries = { ...journal.entries };
  if (hasContent) {
    entries[seriesId] = entry;
  } else {
    // Une entree vide n'a pas a encombrer le journal ni son export.
    delete entries[seriesId];
  }
  return { version: JOURNAL_VERSION, entries };
}

/**
 * Declare ou l'on en est.
 *
 * **Un pointeur, pas quarante-sept cases a cocher** (`docs/RATING-MODEL.md` §3,
 * couche 0) : tout ce qui precede est implicitement vu. C'est le seul remede realiste
 * a la friction qui tue les trackers.
 */
export function setPosition(
  journal: Journal,
  seriesId: SeriesId,
  seasonNumber: number,
  episodeNumber: number,
  now = new Date(),
): Journal {
  const entry = journal.entries[seriesId] ?? {};
  return withEntry(journal, seriesId, {
    ...entry,
    position: { seasonNumber, episodeNumber, declaredAt: now.toISOString() },
  });
}

/** Note une saison. `undefined` retire la note. */
export function setSeasonRating(
  journal: Journal,
  seriesId: SeriesId,
  seasonNumber: number,
  stars: Stars | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[seriesId] ?? {};
  const seasonRatings = { ...(entry.seasonRatings ?? {}) };

  if (stars === undefined) {
    delete seasonRatings[String(seasonNumber)];
  } else {
    seasonRatings[String(seasonNumber)] = { stars, at: now.toISOString() };
  }

  return withEntry(journal, seriesId, { ...entry, seasonRatings });
}

/** Enregistre une decision : continuer, mettre en pause, abandonner, avoir fini. */
export function setDecision(
  journal: Journal,
  seriesId: SeriesId,
  kind: DecisionKind | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[seriesId] ?? {};
  if (kind === undefined) {
    const { decision: _removed, ...rest } = entry;
    return withEntry(journal, seriesId, rest);
  }

  // Le point exact ou la decision est prise est ce qui a de la valeur : c'est lui qui
  // fera la carte des abandons (`docs/RATING-MODEL.md` §7.4).
  const at = entry.position;
  return withEntry(journal, seriesId, {
    ...entry,
    decision: {
      kind,
      at: now.toISOString(),
      ...(at !== undefined
        ? { atSeason: at.seasonNumber, atEpisode: at.episodeNumber }
        : {}),
    },
  });
}

/** Les notes de saison d'une serie, sous la forme qu'attend le moteur de trajectoire. */
export function seasonScoresOf(
  journal: Journal,
  seriesId: SeriesId,
): readonly { seasonNumber: number; stars: number }[] {
  const ratings = journal.entries[seriesId]?.seasonRatings ?? {};
  return Object.entries(ratings)
    .map(([season, rating]) => ({ seasonNumber: Number(season), stars: rating.stars }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

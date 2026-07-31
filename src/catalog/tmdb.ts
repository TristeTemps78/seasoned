/**
 * Fournisseur de catalogue : TMDB.
 *
 * Implemente {@link CatalogProvider}. **Aucun autre module ne doit connaitre la
 * forme des reponses TMDB** — c'est ce qui rend le fournisseur remplacable
 * (`ROADMAP.md` §1.3, arbitrage A5).
 *
 * Parsing **tolerant** : une cle inconnue est ignoree, un champ absent ou mal type
 * n'a jamais le droit de faire tomber l'application. Un catalogue tiers change sans
 * prevenir ; le code doit degrader, pas casser.
 *
 * Aucun secret dans ce fichier : la cle vient de l'environnement.
 */

import type {
  CatalogProvider,
  EpisodeDetail,
  SeasonDetail,
  SeriesDetail,
  SeriesSummary,
} from './provider.js';
import type { RawSeason } from '../domain/seasons.js';
import type { ExternalIds, ProductionStatus } from '../domain/types.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/** Erreur levee quand TMDB repond autre chose qu'un succes. */
export class TmdbError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

// ---------------------------------------------------------------------------
// Lecture tolerante
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * TMDB rend les dates en `YYYY-MM-DD`, mais aussi en chaine vide, en `null`, et
 * parfois en date invalide. Tout ce qui n'est pas une date exploitable devient
 * `undefined`.
 */
function readDate(source: Record<string, unknown>, key: string): Date | undefined {
  const raw = readString(source, key);
  if (raw === undefined) return undefined;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Duree d'episode : TMDB rend un tableau, parfois vide. On prend la premiere. */
function readRuntime(source: Record<string, unknown>): number | undefined {
  const direct = readNumber(source, 'runtime');
  if (direct !== undefined) return direct;
  const list = asArray(source['episode_run_time']);
  const first = list[0];
  return typeof first === 'number' && Number.isFinite(first) ? first : undefined;
}

const PRODUCTION_STATUS_BY_LABEL: Readonly<Record<string, ProductionStatus>> = {
  'returning series': 'returning',
  planned: 'planned',
  'in production': 'in_production',
  ended: 'ended',
  canceled: 'canceled',
  cancelled: 'canceled',
  pilot: 'pilot',
};

function readProductionStatus(source: Record<string, unknown>): ProductionStatus {
  const label = readString(source, 'status')?.toLowerCase();
  if (label === undefined) return 'unknown';
  return PRODUCTION_STATUS_BY_LABEL[label] ?? 'unknown';
}

function readExternalIds(source: Record<string, unknown>): ExternalIds {
  const tmdb = readNumber(source, 'id');
  const external = asRecord(source['external_ids']);
  const tvdb = readNumber(external, 'tvdb_id');
  const imdb = readString(external, 'imdb_id');
  return {
    ...(tmdb !== undefined ? { tmdb } : {}),
    ...(tvdb !== undefined ? { tvdb } : {}),
    ...(imdb !== undefined ? { imdb } : {}),
  };
}

// ---------------------------------------------------------------------------
// Correspondances
// ---------------------------------------------------------------------------

function toSummary(raw: unknown): SeriesSummary | undefined {
  const source = asRecord(raw);
  const id = readNumber(source, 'id');
  const title = readString(source, 'name') ?? readString(source, 'original_name');
  // Sans identifiant ni titre, l'entree est inexploitable : on la laisse tomber
  // plutot que de propager un objet a moitie vide.
  if (id === undefined || title === undefined) return undefined;

  const originalTitle = readString(source, 'original_name');
  const firstAirDate = readDate(source, 'first_air_date');
  const posterPath = readString(source, 'poster_path');
  const overview = readString(source, 'overview');

  return {
    providerId: String(id),
    title,
    ...(originalTitle !== undefined ? { originalTitle } : {}),
    ...(firstAirDate !== undefined ? { firstAirDate } : {}),
    ...(posterPath !== undefined ? { posterPath } : {}),
    ...(overview !== undefined ? { overview } : {}),
  };
}

function toRawSeason(raw: unknown): RawSeason | undefined {
  const source = asRecord(raw);
  const seasonNumber = readNumber(source, 'season_number');
  if (seasonNumber === undefined) return undefined;

  const name = readString(source, 'name');
  const airDate = readDate(source, 'air_date');

  return {
    seasonNumber,
    episodeCount: readNumber(source, 'episode_count') ?? 0,
    ...(name !== undefined ? { name } : {}),
    ...(airDate !== undefined ? { airDate } : {}),
  };
}

function toEpisodeDetail(raw: unknown): EpisodeDetail | undefined {
  const source = asRecord(raw);
  const seasonNumber = readNumber(source, 'season_number');
  const episodeNumber = readNumber(source, 'episode_number');
  if (seasonNumber === undefined || episodeNumber === undefined) return undefined;

  const title = readString(source, 'name');
  const airedAt = readDate(source, 'air_date');
  const runtimeMinutes = readNumber(source, 'runtime');
  const overview = readString(source, 'overview');

  return {
    seasonNumber,
    episodeNumber,
    ...(title !== undefined ? { title } : {}),
    ...(airedAt !== undefined ? { airedAt } : {}),
    ...(runtimeMinutes !== undefined ? { runtimeMinutes } : {}),
    ...(overview !== undefined ? { overview } : {}),
  };
}

/**
 * Convertit une fiche serie TMDB.
 *
 * Exporte pour etre testable contre des fixtures sans passer par le reseau : c'est
 * le decodeur, et c'est la partie qui casse quand le fournisseur bouge.
 */
export function mapSeriesDetail(raw: unknown): SeriesDetail | undefined {
  const source = asRecord(raw);
  const summary = toSummary(source);
  if (summary === undefined) return undefined;

  const seasons = asArray(source['seasons'])
    .map(toRawSeason)
    .filter((s): s is RawSeason => s !== undefined);

  const lastEpisode = asRecord(source['last_episode_to_air']);
  const nextEpisode = asRecord(source['next_episode_to_air']);
  const lastAiredAt = readDate(lastEpisode, 'air_date');
  const nextAiringAt = readDate(nextEpisode, 'air_date');
  const episodeRunTimeMinutes = readRuntime(source);

  return {
    ...summary,
    externalIds: readExternalIds(source),
    production: readProductionStatus(source),
    seasons,
    ...(lastAiredAt !== undefined ? { lastAiredAt } : {}),
    ...(nextAiringAt !== undefined ? { nextAiringAt } : {}),
    ...(episodeRunTimeMinutes !== undefined ? { episodeRunTimeMinutes } : {}),
  };
}

/** Convertit une fiche saison TMDB. Exporte pour la meme raison. */
export function mapSeasonDetail(raw: unknown, fallbackSeasonNumber: number): SeasonDetail {
  const source = asRecord(raw);
  const name = readString(source, 'name');
  const airDate = readDate(source, 'air_date');
  const episodes = asArray(source['episodes'])
    .map(toEpisodeDetail)
    .filter((e): e is EpisodeDetail => e !== undefined);

  return {
    seasonNumber: readNumber(source, 'season_number') ?? fallbackSeasonNumber,
    episodes,
    ...(name !== undefined ? { name } : {}),
    ...(airDate !== undefined ? { airDate } : {}),
  };
}

/** Convertit une reponse de recherche TMDB. */
export function mapSearchResults(raw: unknown): readonly SeriesSummary[] {
  return asArray(asRecord(raw)['results'])
    .map(toSummary)
    .filter((s): s is SeriesSummary => s !== undefined);
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface TmdbOptions {
  /** Jeton d'acces v4 (« Read Access Token »). Jamais code en dur. */
  readonly accessToken: string;
  /** Langue des metadonnees. */
  readonly language?: string;
  /** Injectable pour les tests. */
  readonly fetchImpl?: typeof fetch;
}

export class TmdbProvider implements CatalogProvider {
  readonly name = 'tmdb';
  readonly #accessToken: string;
  readonly #language: string;
  readonly #fetch: typeof fetch;

  constructor(options: TmdbOptions) {
    if (options.accessToken.trim().length === 0) {
      throw new Error('TmdbProvider : jeton d acces manquant.');
    }
    this.#accessToken = options.accessToken;
    this.#language = options.language ?? 'fr-FR';
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
  }

  async #get(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('language', this.#language);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await this.#fetch(url, {
      headers: {
        authorization: `Bearer ${this.#accessToken}`,
        accept: 'application/json',
      },
      ...(signal !== undefined ? { signal } : {}),
    });

    if (!response.ok) {
      // On journalise le statut et l'endpoint, jamais le jeton ni le corps :
      // un corps d'erreur peut contenir la requete complete.
      throw new TmdbError(`TMDB a repondu ${response.status}`, response.status, endpoint);
    }
    return response.json();
  }

  async search(
    query: string,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<readonly SeriesSummary[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const raw = await this.#get('/search/tv', { query: trimmed }, options.signal);
    return mapSearchResults(raw);
  }

  async getSeries(
    providerId: string,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<SeriesDetail> {
    const raw = await this.#get(
      `/tv/${encodeURIComponent(providerId)}`,
      { append_to_response: 'external_ids' },
      options.signal,
    );
    const mapped = mapSeriesDetail(raw);
    if (mapped === undefined) {
      throw new TmdbError('Fiche serie inexploitable', 200, `/tv/${providerId}`);
    }
    return mapped;
  }

  async getSeason(
    providerId: string,
    seasonNumber: number,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<SeasonDetail> {
    const raw = await this.#get(
      `/tv/${encodeURIComponent(providerId)}/season/${seasonNumber}`,
      {},
      options.signal,
    );
    return mapSeasonDetail(raw, seasonNumber);
  }
}

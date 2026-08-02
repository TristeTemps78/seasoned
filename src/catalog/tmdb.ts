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
  Creator,
  DiscoverKind,
  EpisodeDetail,
  SeasonDetail,
  SeriesDetail,
  SeriesSummary,
} from './provider';
import type { RawSeason } from '../domain/seasons';
import type { ExternalIds, ProductionStatus } from '../domain/types';
import { dominantKind, type ProgramKind } from '../domain/program';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Genres TMDB qui determinent la nature d'un programme.
 *
 * **Seul endroit du code ou ces identifiants existent** : le domaine raisonne sur
 * `ProgramKind`, pas sur des nombres propres a TMDB. C'est ce qui rend la regle
 * portable si le fournisseur change (`ROADMAP.md` §1.3).
 *
 * Les genres absents de cette table (drame, comedie, science-fiction…) ne disent rien
 * de la nature du programme : ils decrivent son sujet.
 */
const KIND_BY_TMDB_GENRE: Readonly<Record<number, ProgramKind>> = {
  10763: 'news',
  10767: 'talk',
  10764: 'reality',
  10766: 'soap',
  99: 'documentary',
  10759: 'scripted', // Action & Adventure
  16: 'scripted', // Animation
  35: 'scripted', // Comedy
  80: 'scripted', // Crime
  18: 'scripted', // Drama
  10751: 'scripted', // Family
  10762: 'scripted', // Kids
  9648: 'scripted', // Mystery
  10765: 'scripted', // Sci-Fi & Fantasy
  10768: 'scripted', // War & Politics
  37: 'scripted', // Western
};

/** Traduit les genres TMDB — quelle que soit leur forme — en nature de programme. */
function readProgramKind(source: Record<string, unknown>): ProgramKind {
  // `/search` et `/discover` rendent `genre_ids: number[]` ; `/tv/{id}` rend
  // `genres: [{ id, name }]`. Les deux formes menent au meme endroit.
  const ids = [
    ...asArray(source['genre_ids']),
    ...asArray(source['genres']).map((g) => asRecord(g)['id']),
  ].filter((id): id is number => typeof id === 'number');

  const kinds = ids
    .map((id) => KIND_BY_TMDB_GENRE[id])
    .filter((k): k is ProgramKind => k !== undefined);

  return dominantKind(kinds);
}

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

/**
 * Duree d'un episode, en minutes.
 *
 * `episode_run_time` est **de facto abandonne par TMDB** : le champ existe encore
 * mais revient vide sur la grande majorite des series, y compris les plus connues.
 * Constate en production le 2026-08-01 — nos fixtures le contenaient encore, ce
 * qu'aucun test hors ligne ne pouvait detecter.
 *
 * D'ou une cascade sur des champs **deja presents dans la meme reponse**, donc sans
 * appel supplementaire : c'est une contrainte de budget autant que de justesse
 * (`ROADMAP.md` §1.4).
 *
 * La duree du dernier episode paru est une approximation : un final est souvent plus
 * long que la moyenne. Elle vaut mieux que de ne rien afficher, puisque « combien de
 * temps ca me demande » est l'une des trois promesses de la page d'accueil.
 */
function readRuntime(source: Record<string, unknown>): number | undefined {
  const direct = readNumber(source, 'runtime');
  if (direct !== undefined) return direct;

  const declared = asArray(source['episode_run_time'])[0];
  if (typeof declared === 'number' && Number.isFinite(declared) && declared > 0) {
    return declared;
  }

  for (const key of ['last_episode_to_air', 'next_episode_to_air']) {
    const episode = readNumber(asRecord(source[key]), 'runtime');
    if (episode !== undefined && episode > 0) return episode;
  }
  return undefined;
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

function readCreators(source: Record<string, unknown>): readonly Creator[] {
  return asArray(source['created_by'])
    .map((raw) => {
      const person = asRecord(raw);
      const id = readNumber(person, 'id');
      const name = readString(person, 'name');
      return id !== undefined && name !== undefined
        ? { providerId: String(id), name }
        : undefined;
    })
    .filter((c): c is Creator => c !== undefined);
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
    kind: readProgramKind(source),
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
  const voteAverage = readNumber(source, 'vote_average');
  const voteCount = readNumber(source, 'vote_count');

  return {
    seasonNumber,
    episodeNumber,
    ...(title !== undefined ? { title } : {}),
    ...(airedAt !== undefined ? { airedAt } : {}),
    ...(runtimeMinutes !== undefined ? { runtimeMinutes } : {}),
    ...(overview !== undefined ? { overview } : {}),
    ...(voteAverage !== undefined ? { voteAverage } : {}),
    ...(voteCount !== undefined ? { voteCount } : {}),
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
  const creators = readCreators(source);

  return {
    ...summary,
    externalIds: readExternalIds(source),
    production: readProductionStatus(source),
    seasons,
    ...(creators.length > 0 ? { creators } : {}),
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
  /**
   * Options ajoutees a chaque requete.
   *
   * Sert a brancher le cache de donnees de l'hote — sous Next, `{ next: { revalidate } }`.
   * Le module reste agnostique : il transmet, il n'interprete pas.
   *
   * Ce n'est pas un raffinement. Constate en production le 2026-08-02 : les pages
   * serie repondaient `X-Vercel-Cache: MISS` et `Cache-Control: no-store` malgre un
   * `revalidate` de 24 h, donc **chaque visiteur declenchait tous les appels TMDB** —
   * jusqu'a dix pour une serie de huit saisons. Le cache en memoire ne rattrape rien :
   * il est propre a chaque instance sans etat.
   */
  readonly requestInit?: RequestInit;
}

export class TmdbProvider implements CatalogProvider {
  readonly name = 'tmdb';
  readonly #accessToken: string;
  readonly #language: string;
  readonly #fetch: typeof fetch;
  readonly #requestInit: RequestInit;

  constructor(options: TmdbOptions) {
    if (options.accessToken.trim().length === 0) {
      throw new Error('TmdbProvider : jeton d acces manquant.');
    }
    this.#accessToken = options.accessToken;
    this.#language = options.language ?? 'fr-FR';
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
    this.#requestInit = options.requestInit ?? {};
  }

  async #get(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('language', this.#language);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await this.#fetch(url, {
      ...this.#requestInit,
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

  async discover(
    kind: DiscoverKind,
    page = 1,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<readonly SeriesSummary[]> {
    const raw = await this.#get(
      DISCOVER_ENDPOINT[kind],
      { page: String(Math.max(1, Math.floor(page))) },
      options.signal,
    );
    return mapSearchResults(raw);
  }

  async seriesByCreator(
    personId: string,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<readonly SeriesSummary[]> {
    const raw = await this.#get(
      `/person/${encodeURIComponent(personId)}/tv_credits`,
      {},
      options.signal,
    );
    return mapPersonSeriesCredits(raw);
  }
}

/** Reponse de `/person/{id}/tv_credits` : les series sont sous `cast` et `crew`. */
export function mapPersonSeriesCredits(raw: unknown): readonly SeriesSummary[] {
  const source = asRecord(raw);
  const seen = new Set<string>();
  const out: SeriesSummary[] = [];

  for (const key of ['crew', 'cast']) {
    for (const entry of asArray(source[key])) {
      const summary = toSummary(entry);
      if (summary === undefined || seen.has(summary.providerId)) continue;
      seen.add(summary.providerId);
      out.push(summary);
    }
  }
  return out;
}

const DISCOVER_ENDPOINT: Readonly<Record<DiscoverKind, string>> = {
  trending: '/trending/tv/week',
  popular: '/tv/popular',
  on_the_air: '/tv/on_the_air',
};

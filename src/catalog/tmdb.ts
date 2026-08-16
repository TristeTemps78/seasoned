/**
 * Fournisseur de catalogue : TMDB.
 *
 * Implemente {@link CatalogProvider}. **Aucun autre module ne doit connaitre la
 * forme des reponses TMDB** — c'est ce qui rend le fournisseur remplacable
 * (arbitrage A5).
 *
 * Parsing **tolerant** : une cle inconnue est ignoree, un champ absent ou mal type
 * n'a jamais le droit de faire tomber l'application. Un catalogue tiers change sans
 * prevenir ; le code doit degrader, pas casser.
 *
 * Aucun secret dans ce fichier : la cle vient de l'environnement.
 */

import type {
  CastMember,
  CatalogProvider,
  BrowseGenre,
  BrowseQuery,
  BrowseSort,
  Creator,
  DiscoverKind,
  EpisodeDetail,
  EpisodeGrouping,
  PersonCredit,
  PersonCredits,
  PersonIdentity,
  SeasonDetail,
  SeriesDetail,
  SeriesSummary,
  SeriesArtwork,
  WatchByRegion,
  WatchOption,
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
 * portable si le fournisseur change.
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
 * appel supplementaire : c'est une contrainte de budget autant que de justesse.
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

/**
 * Le nombre de roles retenus.
 *
 * ⚠️ **Le tri est fait par TMDB (`order`), pas ici** : `aggregate_credits` rend deja le
 * generique par ordre d'importance. Le recouper cote client demanderait de charger les 400
 * lignes qu'on cherche justement a ne pas garder.
 *
 * Douze : deux rangees pleines sur un ecran large, et assez peu pour qu'un generique de
 * feuilleton quotidien ne devienne pas la moitie de la fiche.
 */
const CAST_KEPT = 12;

/**
 * Le generique, depuis `aggregate_credits`.
 *
 * ⚠️ **`aggregate_credits` et non `credits`**, et la difference compte pour une serie :
 * `credits` ne rend que le generique de la **derniere saison**, donc il oublie tout acteur
 * parti avant la fin — sur une serie de dix ans, il montre les arrivants et cache les
 * personnages principaux. `aggregate_credits` cumule les saisons, au prix d'une forme
 * differente : le personnage vit sous `roles[]` et non dans un champ `character`.
 *
 * ⚠️ On garde le **premier** role : un acteur qui a joue deux personnages en dix saisons en a
 * un principal, et c'est celui que TMDB place en tete. Les concatener rendrait « Untel /
 * Untel / Untel » sous un visage de 80 px.
 */
function readCast(source: Record<string, unknown>): readonly CastMember[] {
  const credits = asRecord(source['aggregate_credits']);
  return asArray(credits['cast'])
    .slice(0, CAST_KEPT)
    .map((raw) => {
      const person = asRecord(raw);
      const id = readNumber(person, 'id');
      const name = readString(person, 'name');
      if (id === undefined || name === undefined) return undefined;

      const character = readString(asRecord(asArray(person['roles'])[0]), 'character');
      const profilePath = readString(person, 'profile_path');
      return {
        providerId: String(id),
        name,
        ...(character !== undefined ? { character } : {}),
        ...(profilePath !== undefined ? { profilePath } : {}),
      };
    })
    .filter((member): member is CastMember => member !== undefined);
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
  // Presente dans **toutes** les reponses de liste comme sur la fiche : la lire ici la rend
  // disponible partout sans un appel de plus. Voir `SeriesSummary.backdropPath`.
  const backdropPath = readString(source, 'backdrop_path');
  const overview = readString(source, 'overview');
  // Presente partout ou `backdrop_path` l'est, et lue pour la meme raison : elle ne coute
  // aucun appel de plus. Voir `SeriesSummary.voteCount` — c'est ce qui tient la vitrine.
  const voteCount = readNumber(source, 'vote_count');

  return {
    providerId: String(id),
    title,
    kind: readProgramKind(source),
    ...(originalTitle !== undefined ? { originalTitle } : {}),
    ...(firstAirDate !== undefined ? { firstAirDate } : {}),
    ...(posterPath !== undefined ? { posterPath } : {}),
    ...(backdropPath !== undefined ? { backdropPath } : {}),
    ...(overview !== undefined ? { overview } : {}),
    ...(voteCount !== undefined ? { voteCount } : {}),
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
  const cast = readCast(source);

  const nextSeason = readNumber(nextEpisode, 'season_number');
  const nextNumber = readNumber(nextEpisode, 'episode_number');
  const nextTitle = readString(nextEpisode, 'name');
  const nextFull =
    nextAiringAt !== undefined && nextSeason !== undefined && nextNumber !== undefined
      ? {
          seasonNumber: nextSeason,
          episodeNumber: nextNumber,
          airsOn: nextAiringAt,
          ...(nextTitle !== undefined ? { title: nextTitle } : {}),
        }
      : undefined;

  // Note du public pour la serie entiere. Presente dans la meme reponse, donc
  // gratuite — et c'est la seule facon de dire « vous notez plus severement que le
  // public » dans la bibliotheque, qui ne fait aucun appel.
  const voteAverage = readNumber(source, 'vote_average');

  const trailerKey = toTrailerKey(source);

  return {
    ...summary,
    externalIds: readExternalIds(source),
    production: readProductionStatus(source),
    seasons,
    ...(voteAverage !== undefined && voteAverage > 0 ? { voteAverage } : {}),
    ...(creators.length > 0 ? { creators } : {}),
    ...(cast.length > 0 ? { cast } : {}),
    ...(lastAiredAt !== undefined ? { lastAiredAt } : {}),
    ...(nextAiringAt !== undefined ? { nextAiringAt } : {}),
    ...(nextFull !== undefined ? { nextEpisode: nextFull } : {}),
    ...(episodeRunTimeMinutes !== undefined ? { episodeRunTimeMinutes } : {}),
    ...(trailerKey !== undefined ? { trailerKey } : {}),
  };
}

/**
 * La bande-annonce, parmi les videos que TMDB attache a la fiche.
 *
 * ⚠️ **YouTube seulement, et c'est une contrainte, pas une preference** : les autres hotes
 * que TMDB reference n'ont pas d'adresse composable a partir d'une cle. Une entree Vimeo
 * gardee ici donnerait un lien casse.
 *
 * L'ordre de preference suit ce qu'on cherche vraiment : une bande-annonce officielle, sinon
 * n'importe quelle bande-annonce, sinon un teaser. Une featurette ou une scene coupee ne
 * repondent pas a « a quoi ca ressemble », donc elles ne sont jamais retenues.
 */
function toTrailerKey(source: Readonly<Record<string, unknown>>): string | undefined {
  const videos = asArray(asRecord(source['videos'])['results'])
    .map((entry) => asRecord(entry))
    .filter((one) => readString(one, 'site') === 'YouTube')
    .filter((one) => readString(one, 'key') !== undefined);

  const RANG = ['Trailer', 'Teaser'] as const;
  for (const officiel of [true, false]) {
    for (const type of RANG) {
      const found = videos.find(
        (one) => readString(one, 'type') === type && (one['official'] === true) === officiel,
      );
      if (found !== undefined) return readString(found, 'key');
    }
  }
  return undefined;
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
  ): Promise<readonly SeriesSummary[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const raw = await this.#get('/search/tv', { query: trimmed });
    return mapSearchResults(raw);
  }

  async getSeries(
    providerId: string,
  ): Promise<SeriesDetail> {
    const raw = await this.#get(
      `/tv/${encodeURIComponent(providerId)}`,
      // ⚠️ `aggregate_credits` voyage dans la **meme** reponse : le generique ne coute donc ni
      // une requete de plus, ni une entree de cache de plus, ni une ligne au budget TMDB.
      { append_to_response: 'external_ids,aggregate_credits,videos' },
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
  ): Promise<SeasonDetail> {
    const raw = await this.#get(
      `/tv/${encodeURIComponent(providerId)}/season/${seasonNumber}`,
      {},
    );
    return mapSeasonDetail(raw, seasonNumber);
  }

  async discover(
    kind: DiscoverKind,
    page = 1,
  ): Promise<readonly SeriesSummary[]> {
    const raw = await this.#get(
      DISCOVER_ENDPOINT[kind],
      { page: String(Math.max(1, Math.floor(page))) },
    );
    return mapSearchResults(raw);
  }

  /**
   * Parcourt le catalogue. **Seul endroit qui connaisse `/discover/tv` et ses parametres.**
   *
   * ## 🔴 Le plancher de votes n'est pas une precaution, c'est la condition
   *
   * `lib/catalog.ts` raconte comment `tv/popular` remontait *« Caresser les tetons de mon
   * ours hibernant »* (7 votes) sur la 404. Trier par note **aggrave** ce defaut au lieu de
   * le diluer : `vote_average.desc` sans plancher rend exclusivement des series a 10/10 sur
   * un ou deux votes, donc la premiere page entiere est du bruit. C'est le classement le
   * plus attendu du parcours, et sans `vote_count.gte` il serait le plus inutilisable.
   *
   * ⚠️ Le plancher est **plus haut** ici que celui de la vitrine (50) : la vitrine ecarte le
   * bruit d'une liste deja triee par popularite, alors qu'ici on demande explicitement a
   * remonter les mieux notes. Le meme chiffre laisserait passer les series a 9,8/10 sur
   * 51 votes, qui sont exactement ce que le classement doit ne pas montrer.
   *
   * Le filtre s'applique aux trois tris, et pas seulement au tri par note : une decennie
   * lointaine ou un genre rare renverraient sinon la meme grappe d'obscurites.
   */
  async browse(
    query: BrowseQuery,
    page = 1,
  ): Promise<readonly SeriesSummary[]> {
    const params: Record<string, string> = {
      page: String(Math.max(1, Math.floor(page))),
      sort_by: BROWSE_SORT[query.sort ?? 'popular'] ?? BROWSE_SORT.popular,
      'vote_count.gte': String(BROWSE_MIN_VOTES),
      // Les programmes adultes n'ont rien a faire dans une vitrine sans compte ni age
      // declare. TMDB les exclut par defaut, on le dit quand meme : un defaut du
      // fournisseur n'est pas une decision du produit.
      include_adult: 'false',
    };

    if (query.genre !== undefined) {
      params['with_genres'] = String(TMDB_GENRE[query.genre]);
    }

    // ⚠️ Les codes de `with_status` sont ceux de TMDB : 0 en cours, 1 prevue, 2 en
    // production, 3 terminee, 4 annulee, 5 pilote. « Terminee ou annulee » d'un cote, « en
    // cours ou en production » de l'autre — le pilote et la serie seulement prevue ne sont
    // ni l'un ni l'autre, et les ranger de force fausserait les deux reponses.
    if (query.run === 'ended') params['with_status'] = '3|4';
    if (query.run === 'running') params['with_status'] = '0|2';

    if (query.decade !== undefined) {
      // Bornes **inclusives des deux cotes**, sur la premiere diffusion : une serie
      // commencee en 1999 et finie en 2007 appartient aux annees 1990, parce que c'est la
      // decennie ou on l'a decouverte. Le classer sur sa derniere saison rendrait
      // *Friends* contemporain de *Lost*.
      params['first_air_date.gte'] = `${query.decade}-01-01`;
      params['first_air_date.lte'] = `${query.decade + 9}-12-31`;
    }

    const raw = await this.#get('/discover/tv', params);
    return mapSearchResults(raw);
  }

  async watchOptions(
    providerId: string,
    regions: readonly string[],
  ): Promise<WatchByRegion> {
    // ⚠️ **Un seul appel, quel que soit le nombre de pays.** L'endpoint n'en prend aucun :
    // il rend le monde entier. Boucler dessus par pays serait payer N fois la meme reponse.
    const raw = await this.#get(
      `/tv/${encodeURIComponent(providerId)}/watch/providers`,
      {},
    );
    const out: Record<string, { options: readonly WatchOption[]; link?: string }> = {};
    for (const region of regions) {
      const options = mapWatchOptions(raw, region);
      // Un pays sans aucune offre ne merite pas une ligne vide a l'ecran : on l'omet, et
      // c'est l'ecran qui decide s'il a quelque chose a dire.
      if (options.length === 0) continue;
      const link = mapWatchLink(raw, region);
      out[region.toUpperCase()] = { options, ...(link === undefined ? {} : { link }) };
    }
    return out;
  }

  async artwork(providerId: string): Promise<SeriesArtwork> {
    // ⚠️ `include_image_language=null` ramene les visuels **sans texte**, qui sont les
    // seuls utilisables dans une autre langue que celle ou ils ont ete faits. Sans lui on
    // proposerait des affiches portant un titre allemand a un lecteur francais.
    const raw = await this.#get(`/tv/${encodeURIComponent(providerId)}/images`, {
      include_image_language: 'null,en',
    });
    return mapArtwork(raw);
  }

  async episodeGroups(
    providerId: string,
  ): Promise<readonly EpisodeGrouping[]> {
    const raw = await this.#get(
      `/tv/${encodeURIComponent(providerId)}/episode_groups`,
      {},
    );
    return mapEpisodeGroups(raw);
  }

  async personName(personId: string): Promise<PersonIdentity | undefined> {
    try {
      const source = asRecord(await this.#get(`/person/${encodeURIComponent(personId)}`, {}));
      const name = readString(source, 'name');
      if (name === undefined) return undefined;
      const profilePath = readString(source, 'profile_path');
      const department = readString(source, 'known_for_department');
      return {
        name,
        ...(profilePath === undefined ? {} : { profilePath }),
        ...(department === undefined ? {} : { knownForDepartment: department }),
      };
    } catch {
      // Une page de personne sans son nom reste utile — elle porte ses series. Lever ici
      // rendrait une 404 pour une identite manquante, alors que le contenu est la.
      return undefined;
    }
  }

  async seriesByCreator(
    personId: string,
  ): Promise<readonly SeriesSummary[]> {
    const raw = await this.#get(
      `/person/${encodeURIComponent(personId)}/tv_credits`,
      {},
    );
    return mapPersonSeriesCredits(raw);
  }

  async personCredits(personId: string): Promise<PersonCredits> {
    try {
      const raw = await this.#get(`/person/${encodeURIComponent(personId)}/tv_credits`, {});
      return mapPersonCredits(raw);
    } catch {
      // Meme contrat que `personName` : une page de personne sans ses credits reste une page.
      return { cast: [], crew: [] };
    }
  }
}

/**
 * Noms des natures de decoupage codees par TMDB.
 *
 * ⚠️ **Capture depuis l'API reelle le 2026-08-03**, pas ecrite de memoire — c'est la dette
 * D10, dont la cause etait exactement une fixture inventee. Observes en conditions reelles :
 * `1` sur *Game of Thrones* (« Aired Order ») et sur trois decoupages de *One Piece*, `2` sur
 * ses ordres absolus, `3` sur le DVD de *Breaking Bad*, `4` sur les parts de *Money Heist*.
 * Les valeurs `5` a `7` sont documentees par TMDB mais **je ne les ai pas observees** : elles
 * sont ici pour ne pas se taire si elles arrivent, pas parce que je les ai vues.
 *
 * Une valeur inconnue ne casse rien : {@link mapEpisodeGroups} garde le numero brut et
 * laisse `kindName` absent. Le bareme appartient au fournisseur et peut s'etendre.
 */
const GROUP_KIND_NAMES: Readonly<Record<number, string>> = {
  1: 'original air date',
  2: 'absolute',
  3: 'DVD',
  4: 'digital',
  5: 'story arc',
  6: 'production',
  7: 'TV',
};

/**
 * Reponse de `/tv/{id}/episode_groups`.
 *
 * Parsing tolerant : une entree sans nom, sans compte ou mal typee est
 * **ecartee** plutot que de faire echouer la liste entiere. Un decoupage perdu vaut mieux
 * qu'une page perdue — et ici le cout d'une perte est nul, puisque la liste ne sert qu'a
 * **signaler**, jamais a calculer.
 */
export function mapEpisodeGroups(raw: unknown): readonly EpisodeGrouping[] {
  const out: EpisodeGrouping[] = [];

  for (const entry of asArray(asRecord(raw)['results'])) {
    const source = asRecord(entry);
    const id = readString(source, 'id');
    const name = readString(source, 'name');
    const kind = readNumber(source, 'type');
    const groupCount = readNumber(source, 'group_count');
    const episodeCount = readNumber(source, 'episode_count');

    // Sans identite ni chiffres, un decoupage ne peut ni s'afficher ni se comparer.
    if (id === undefined || name === undefined) continue;
    if (groupCount === undefined || episodeCount === undefined) continue;
    // Un decoupage vide n'est pas un decoupage : TMDB en heberge que personne n'a rempli.
    if (groupCount <= 0 || episodeCount <= 0) continue;

    const kindName = kind === undefined ? undefined : GROUP_KIND_NAMES[kind];
    out.push({
      id,
      name,
      kind: kind ?? 0,
      ...(kindName === undefined ? {} : { kindName }),
      groupCount,
      episodeCount,
    });
  }

  return out;
}

/**
 * Reponse de `/tv/{id}/watch/providers`, pour un pays.
 *
 * TMDB agrege ces donnees depuis JustWatch et impose de le mentionner partout ou
 * elles sont affichees — d'ou {@link JUSTWATCH_ATTRIBUTION}.
 */
export function mapWatchOptions(raw: unknown, region: string): readonly WatchOption[] {
  const forRegion = asRecord(asRecord(asRecord(raw)['results'])[region.toUpperCase()]);

  const out: WatchOption[] = [];
  const seen = new Set<string>();

  for (const kind of ['flatrate', 'free', 'ads', 'rent', 'buy'] as const) {
    for (const entry of asArray(forRegion[kind])) {
      const source = asRecord(entry);
      const providerName = readString(source, 'provider_name');
      if (providerName === undefined) continue;
      // Un service peut proposer a la fois l'abonnement et l'achat : on garde le
      // premier mode rencontre, l'ordre ci-dessus allant du plus au moins interessant.
      const key = providerName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const logoPath = readString(source, 'logo_path');
      out.push({ kind, providerName, ...(logoPath !== undefined ? { logoPath } : {}) });
    }
  }
  return out;
}

/**
 * Le lien JustWatch d'un pays — `results.<PAYS>.link`.
 *
 * Separe de {@link mapWatchOptions} et non ajoute a son retour : les deux repondent a deux
 * questions differentes (« quelles offres » / « ou les voir toutes »), et l'un peut manquer
 * sans l'autre. Les fusionner aurait aussi force a changer la forme que six tests ancrent.
 *
 * ⚠️ **`http` refuse.** Ce champ vient d'un tiers, il finit dans un `href`, et rien ne dit
 * qu'il restera une adresse : on n'accepte que `https:`. Un `javascript:` servi par une
 * reponse d'API est le scenario que cette ligne ferme, et il ne demande qu'une reponse
 * malformee pour arriver.
 */
export function mapWatchLink(raw: unknown, region: string): string | undefined {
  const link = readString(asRecord(asRecord(asRecord(raw)['results'])[region.toUpperCase()]), 'link');
  if (link === undefined) return undefined;
  try {
    return new URL(link).protocol === 'https:' ? link : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reponse de `/tv/{id}/images`.
 *
 * Parsing tolerant, comme tout le reste : une entree sans `file_path` est ecartee, une
 * liste absente devient vide. Une serie sans visuel est le cas courant, pas une erreur.
 *
 * ⚠️ **Bornees a douze.** TMDB en rend parfois plusieurs centaines ; les servir toutes
 * alourdirait la page pour un choix que personne ne fait au-dela des premieres. TMDB les
 * ordonne deja par vote, donc les douze premieres sont les meilleures.
 */
export function mapArtwork(raw: unknown): SeriesArtwork {
  const source = asRecord(raw);
  const paths = (key: string): readonly string[] => {
    const out: string[] = [];
    for (const entry of asArray(source[key])) {
      const path = readString(asRecord(entry), 'file_path');
      if (path !== undefined && !out.includes(path)) out.push(path);
      if (out.length >= 12) break;
    }
    return out;
  };
  return { posters: paths('posters'), backdrops: paths('backdrops') };
}

/**
 * Reponse de `/person/{id}/tv_credits`, **avec les roles et sans fondre les deux listes**.
 *
 * ## 🔴 Ce que {@link mapPersonSeriesCredits} jetait
 *
 * Il parcourt `crew` puis `cast` et dedoublonne **par serie** : quelqu'un qui a joue dans une
 * serie *et* ecrit un episode n'y figure qu'une fois, du cote lu en premier. Pour « du meme
 * createur » c'est sans consequence — on ne veut qu'une liste de suggestions. Pour une page
 * de personne, c'est la question meme qui disparait.
 *
 * Le `character` et le `job` arrivaient dans la **meme reponse** et n'etaient jamais lus.
 *
 * ⚠️ Le dedoublonnage reste, mais **par liste** : TMDB rend une ligne par episode credite,
 * donc un acteur recurrent apparait vingt fois pour la meme serie. On garde la premiere, qui
 * porte le role principal.
 *
 * ⚠️ Aucun tri ici : `mapPersonCredits` **transporte**, `lib/catalog.ts` decide de l'ordre.
 * C'est la meme frontiere que partout — le fournisseur ne range pas.
 */
export function mapPersonCredits(raw: unknown): PersonCredits {
  const source = asRecord(raw);

  const readSide = (key: 'cast' | 'crew', roleField: 'character' | 'job'): readonly PersonCredit[] => {
    const seen = new Set<string>();
    const out: PersonCredit[] = [];
    for (const entry of asArray(source[key])) {
      const summary = toSummary(entry);
      if (summary === undefined || seen.has(summary.providerId)) continue;
      seen.add(summary.providerId);
      const role = readString(asRecord(entry), roleField);
      // Une chaine vide est du bruit TMDB, pas un role : `readString` la laisse passer.
      out.push({ series: summary, ...(role === undefined || role.length === 0 ? {} : { role }) });
    }
    return out;
  };

  return { cast: readSide('cast', 'character'), crew: readSide('crew', 'job') };
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

/**
 * Les identifiants de genre TMDB, **second et dernier endroit ou ils existent**.
 *
 * Distinct de {@link KIND_BY_TMDB_GENRE}, qui traduit dans l'autre sens et pour une autre
 * question : celui-la dit *quelle nature de programme est-ce*, celui-ci dit *quel sujet
 * demande-t-on*. Les fondre obligerait a inverser une table faite pour etre lue dans un seul
 * sens, et a decider ce que devient « Action & Adventure » qui vaut `scripted` a l'aller.
 *
 * ⚠️ « Action » vaut 10759 chez TMDB (« Action & Adventure ») et non 28, qui est le genre
 * des **films**. L'endpoint est `/discover/tv` : lui passer un identifiant de film rend zero
 * resultat sans erreur, ce qui est la panne la plus difficile a voir.
 */
const TMDB_GENRE: Readonly<Record<BrowseGenre, number>> = {
  action: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  sci_fi: 10765,
  war: 10768,
  western: 37,
};

/** Les ordres de tri de TMDB, pour {@link BrowseSort}. */
const BROWSE_SORT: Readonly<Record<BrowseSort, string>> = {
  popular: 'popularity.desc',
  rating: 'vote_average.desc',
  recent: 'first_air_date.desc',
};

/**
 * Plancher de votes du parcours.
 *
 * Plus haut que le `MIN_SHOWCASE_VOTES` de la vitrine (50), et la raison est ecrite sur
 * {@link TmdbCatalog.browse} : trier explicitement par note fait remonter en tete ce que la
 * vitrine se contentait de noyer.
 */
const BROWSE_MIN_VOTES = 300;

const DISCOVER_ENDPOINT: Readonly<Record<DiscoverKind, string>> = {
  trending: '/trending/tv/week',
  popular: '/tv/popular',
  on_the_air: '/tv/on_the_air',
};

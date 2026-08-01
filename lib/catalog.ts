/**
 * Instanciation du catalogue, et composition catalogue + domaine.
 *
 * C'est ici que le travail utile se fabrique : le fournisseur rend des metadonnees
 * brutes, `src/domain` sait en tirer un statut reel et un decoupage en saisons
 * exploitable. Les pages ne parlent qu'a ce module.
 *
 * `ROADMAP.md` §0.1 — une page serie doit valoir le detour **avec zero critique**.
 * Tout ce que produit ce fichier est derive de donnees publiques : disponible le jour 1,
 * sans un seul utilisateur.
 */

import { TmdbProvider } from '../src/catalog/tmdb';
import type {
  CatalogProvider,
  SeasonDetail,
  SeriesDetail,
  SeriesSummary,
} from '../src/catalog/provider';
import { ExpiringCache, memoizeAsync } from '../src/catalog/cache';
import {
  normalizeSeasons,
  representativeSeason,
  type NormalizedSeasons,
} from '../src/domain/seasons';
import { deriveStatus, type StatusResult } from '../src/domain/status';

/** Duree de vie du cache serie : une journee. Les grilles de diffusion bougent peu. */
const SERIES_TTL_MS = 86_400_000;

/** Duree de vie du cache recherche : une heure. Requetes plus variees, moins de valeur. */
const SEARCH_TTL_MS = 3_600_000;

let providerInstance: CatalogProvider | undefined;

/**
 * Le fournisseur, cree a la demande.
 *
 * Le jeton n'est lu qu'a l'usage et jamais au chargement du module : sans cela, un
 * simple import ferait echouer les tests et le build en l'absence d'environnement.
 */
export function getProvider(): CatalogProvider {
  if (providerInstance !== undefined) return providerInstance;

  const accessToken = process.env['TMDB_ACCESS_TOKEN'];
  if (accessToken === undefined || accessToken.trim().length === 0) {
    throw new Error(
      'TMDB_ACCESS_TOKEN manquant. Copier .env.example en .env et renseigner le jeton v4.',
    );
  }

  const language = process.env['TMDB_LANGUAGE'] ?? 'fr-FR';
  providerInstance = new TmdbProvider({ accessToken, language });
  return providerInstance;
}

/** Remplace le fournisseur — reserve aux tests. */
export function setProvider(provider: CatalogProvider | undefined): void {
  providerInstance = provider;
  seriesCache.clear();
  searchCache.clear();
}

const seriesCache = new ExpiringCache<SeriesDetail>({ maxEntries: 2_000 });
const searchCache = new ExpiringCache<readonly SeriesSummary[]>({ maxEntries: 500 });
const seasonCache = new ExpiringCache<SeasonDetail>({ maxEntries: 2_000 });

const throughSeries = memoizeAsync(seriesCache, SERIES_TTL_MS);
const throughSearch = memoizeAsync(searchCache, SEARCH_TTL_MS);
const throughSeason = memoizeAsync(seasonCache, SERIES_TTL_MS);

/**
 * Duree mediane d'un episode d'une saison, en minutes.
 *
 * **Mediane et non moyenne** : un pilote rallonge ou un final de deux heures
 * suffisent a fausser une moyenne, et c'est exactement le piege dans lequel la
 * premiere version est tombee — Stranger Things affichait 90 heures au lieu de 45,
 * parce que la duree venait du seul dernier episode paru.
 */
export function medianRuntime(season: SeasonDetail): number | undefined {
  const runtimes = season.episodes
    .map((e) => e.runtimeMinutes)
    .filter((r): r is number => r !== undefined && r > 0)
    .sort((a, b) => a - b);

  if (runtimes.length === 0) return undefined;
  const middle = Math.floor(runtimes.length / 2);
  if (runtimes.length % 2 === 1) return runtimes[middle];
  const lower = runtimes[middle - 1];
  const upper = runtimes[middle];
  if (lower === undefined || upper === undefined) return undefined;
  return (lower + upper) / 2;
}

/**
 * Ce qu'une page serie a besoin de savoir.
 *
 * Aucun champ n'est destine a etre stocke : le catalogue est loue, pas possede
 * (`ROADMAP.md` §1.3).
 */
export interface SeriesPageData {
  readonly detail: SeriesDetail;
  readonly seasons: NormalizedSeasons;
  readonly status: StatusResult;
  /** Nombre d'episodes des saisons regulieres diffusees. */
  readonly episodeCount: number;
  /**
   * Engagement total demande, en minutes, si la duree d'episode est connue.
   *
   * C'est la reponse chiffree a « ca vaut mes 40 heures ? » — la question qu'on pose a
   * une serie et jamais a un film (`RESEARCH.md` §6).
   *
   * Toujours une **estimation** : duree mediane d'un episode d'une saison
   * representative, multipliee par le nombre total d'episodes.
   */
  readonly totalRuntimeMinutes?: number;
}

export async function searchSeries(query: string): Promise<readonly SeriesSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  return throughSearch(trimmed.toLowerCase(), () => getProvider().search(trimmed));
}

export async function getSeriesDetail(id: string): Promise<SeriesDetail> {
  return throughSeries(id, () => getProvider().getSeries(id));
}

/**
 * Compose tout ce qu'affiche une page serie.
 *
 * @param now instant de reference, injecte pour que le statut soit testable. Le domaine
 *   n'a pas d'horloge implicite : c'est ce qui rend `deriveStatus` verifiable.
 */
export async function getSeriesPageData(
  id: string,
  now: Date = new Date(),
): Promise<SeriesPageData> {
  const detail = await getSeriesDetail(id);

  const productionEnded = detail.production === 'ended' || detail.production === 'canceled';
  const seasons = normalizeSeasons(id, detail.seasons, { now, productionEnded });

  const status = deriveStatus(
    {
      production: detail.production,
      ...(detail.lastAiredAt !== undefined ? { lastAiredAt: detail.lastAiredAt } : {}),
      ...(detail.nextAiringAt !== undefined ? { nextAiringAt: detail.nextAiringAt } : {}),
    },
    now,
  );

  const episodeCount = seasons.rateable.reduce((sum, s) => sum + s.episodeCount, 0);
  const runtime = await estimateEpisodeRuntime(id, detail, seasons);

  return {
    detail,
    seasons,
    status,
    episodeCount,
    ...(runtime !== undefined && episodeCount > 0
      ? { totalRuntimeMinutes: episodeCount * runtime }
      : {}),
  };
}

/**
 * Estime la duree d'un episode, en minutes.
 *
 * Un appel supplementaire par serie, mis en cache 24 h comme la page elle-meme : le
 * cout est negligeable (`ROADMAP.md` §1.4) et c'est le seul moyen d'obtenir un
 * chiffre juste. TMDB ne renseigne plus `episode_run_time`, et se contenter du
 * dernier episode paru donne un resultat faux du simple au double sur les series
 * dont le final est un long-metrage.
 *
 * Degradation en cascade : mediane d'une saison representative, puis ce que la
 * fiche serie veut bien donner, puis rien. Ne jamais afficher un chiffre faux vaut
 * mieux que remplir la case.
 */
async function estimateEpisodeRuntime(
  id: string,
  detail: SeriesDetail,
  seasons: NormalizedSeasons,
): Promise<number | undefined> {
  const sample = representativeSeason(seasons);
  if (sample !== undefined) {
    try {
      const seasonNumber = sample.ref.seasonNumber;
      const full = await throughSeason(`${id}:${seasonNumber}`, () =>
        getProvider().getSeason(id, seasonNumber),
      );
      const median = medianRuntime(full);
      if (median !== undefined) return median;
    } catch {
      // Le catalogue peut tomber : on continue avec ce qu'on a deja.
    }
  }
  return detail.episodeRunTimeMinutes;
}

/** URL d'une affiche sur le CDN de TMDB. Jamais servie par nous — `next.config.ts`. */
export function posterUrl(path: string | undefined, size: 'w185' | 'w342' | 'w500' = 'w342'): string | undefined {
  if (path === undefined) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

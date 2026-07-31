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
import type { CatalogProvider, SeriesDetail, SeriesSummary } from '../src/catalog/provider';
import { ExpiringCache, memoizeAsync } from '../src/catalog/cache';
import { normalizeSeasons, type NormalizedSeasons } from '../src/domain/seasons';
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

const throughSeries = memoizeAsync(seriesCache, SERIES_TTL_MS);
const throughSearch = memoizeAsync(searchCache, SEARCH_TTL_MS);

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
  const runtime = detail.episodeRunTimeMinutes;

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

/** URL d'une affiche sur le CDN de TMDB. Jamais servie par nous — `next.config.ts`. */
export function posterUrl(path: string | undefined, size: 'w185' | 'w342' | 'w500' = 'w342'): string | undefined {
  if (path === undefined) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

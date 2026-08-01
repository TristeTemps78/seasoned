/**
 * Interface de fournisseur de catalogue.
 *
 * Applique la regle structurante de `ROADMAP.md` §1.3 : **le catalogue est loue,
 * pas possede.** Les formes definies ici sont **ephemeres** — elles transitent, se
 * mettent en cache avec expiration, et ne sont jamais la source de verite. Rien de
 * ce module ne doit atterrir tel quel dans une table.
 *
 * Deux raisons, l'une contractuelle et l'autre strategique :
 *   - TMDB interdit de conserver ses donnees au-dela de six mois ;
 *   - le barème de TheTVDB est plus previsible a long terme, donc un changement de
 *     fournisseur est probable. Il doit rester **un module a reecrire, pas une base
 *     a migrer**.
 */

import type { ExternalIds, ProductionStatus } from '../domain/types';
import type { RawSeason } from '../domain/seasons';

/** Resultat de recherche : le minimum pour choisir dans une liste. */
export interface SeriesSummary {
  readonly providerId: string;
  readonly title: string;
  readonly originalTitle?: string;
  readonly firstAirDate?: Date;
  readonly posterPath?: string;
  readonly overview?: string;
}

/** Fiche complete d'une serie, telle que rendue par un fournisseur. */
export interface SeriesDetail extends SeriesSummary {
  readonly externalIds: ExternalIds;
  readonly production: ProductionStatus;
  readonly seasons: readonly RawSeason[];
  readonly lastAiredAt?: Date;
  readonly nextAiringAt?: Date;
  readonly episodeRunTimeMinutes?: number;
}

/** Un episode tel que rendu par un fournisseur. */
export interface EpisodeDetail {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title?: string;
  readonly airedAt?: Date;
  readonly runtimeMinutes?: number;
  readonly overview?: string;
}

/** Detail d'une saison, episodes compris. */
export interface SeasonDetail {
  readonly seasonNumber: number;
  readonly name?: string;
  readonly airDate?: Date;
  readonly episodes: readonly EpisodeDetail[];
}

/**
 * Listes de decouverte.
 *
 * Ce ne sont pas des commodites : sans elles, **aucune page serie n'est atteignable**
 * depuis une page indexable, et le canal d'acquisition n°1 est un cul-de-sac. Constate
 * par l'audit du 2026-08-01 : sitemap a une seule URL, `/recherche` en `Disallow`,
 * zero lien sortant depuis l'accueil.
 */
export type DiscoverKind =
  /** Ce qui bouge cette semaine. Renouvelle la page d'accueil sans effort. */
  | 'trending'
  /** Le fond de catalogue populaire. Alimente le sitemap. */
  | 'popular'
  /** En cours de diffusion — la ou le statut reel a le plus de valeur. */
  | 'on_the_air';

/**
 * Ce que doit fournir n'importe quelle source de catalogue.
 *
 * Volontairement minimale. Toute methode ajoutee ici devra etre implementee par le
 * prochain fournisseur — c'est le prix de la portabilite, et il doit rester bas.
 */
export interface CatalogProvider {
  /** Nom court, pour les journaux de diagnostic et l'attribution. */
  readonly name: string;

  search(query: string, options?: { readonly signal?: AbortSignal }): Promise<readonly SeriesSummary[]>;

  getSeries(providerId: string, options?: { readonly signal?: AbortSignal }): Promise<SeriesDetail>;

  getSeason(
    providerId: string,
    seasonNumber: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<SeasonDetail>;

  /** @param page 1-indexee, comme chez tous les fournisseurs. */
  discover(
    kind: DiscoverKind,
    page?: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<readonly SeriesSummary[]>;
}

/**
 * Mention d'attribution exigee par les conditions d'utilisation de TMDB.
 *
 * Vit ici et non dans un composant d'interface : c'est une obligation
 * contractuelle liee au fournisseur, pas un choix de mise en page. Le logo TMDB
 * doit accompagner ce texte partout ou des donnees TMDB sont affichees.
 */
export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

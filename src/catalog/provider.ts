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
import type { ProgramKind } from '../domain/program';

/** Resultat de recherche : le minimum pour choisir dans une liste. */
export interface SeriesSummary {
  readonly providerId: string;
  readonly title: string;
  readonly originalTitle?: string;
  readonly firstAirDate?: Date;
  readonly posterPath?: string;
  readonly overview?: string;
  /**
   * Nature du programme, traduite depuis les genres du fournisseur.
   *
   * Vit sur le resume et pas seulement sur la fiche detaillee : c'est ce qui permet
   * de filtrer une liste **sans un appel par element**.
   */
  readonly kind?: ProgramKind;
}

/**
 * Comment une serie est mise a disposition.
 *
 * `flatrate` couvre l'abonnement — c'est le cas qui interesse la plupart des gens et
 * le seul affiche par defaut. Les autres existent mais repondent a une autre question
 * (« combien ca coute »), qui n'est pas celle du produit.
 */
export type WatchKind = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';

/** Un service ou regarder une serie, dans un pays donne. */
export interface WatchOption {
  readonly kind: WatchKind;
  readonly providerName: string;
  readonly logoPath?: string;
}

/**
 * Un decoupage **alternatif** d'une serie en saisons et episodes.
 *
 * ## Pourquoi ce type existe, avec des chiffres
 *
 * TMDB sert un decoupage par defaut (son `seasons`), et en connait d'autres : ordre DVD,
 * ordre d'une plateforme, ordre absolu, arcs narratifs. Mesure faite le 2026-08-03 contre
 * l'API reelle :
 *
 *   - **Money Heist** — defaut TMDB : **3 saisons, 41 episodes**. Netflix, c'est-a-dire la
 *     ou tout le monde la regarde : **5 parts, 48 episodes**. Quelqu'un qui dit « je suis
 *     saison 4 » designe donc une saison **qui n'existe pas** dans notre modele, et
 *     « il vous reste X episodes » se trompe de **17 %**.
 *   - **One Piece** — defaut : 23 saisons / 1181 episodes, dont une saison de **197
 *     episodes** ; l'ordre TVDB en compte 24 et 1210.
 *
 * ## Pourquoi c'est plus grave ici que chez un tracker
 *
 * Chez un tracker, un mauvais ordre donne une case cochee au mauvais endroit : **visible**,
 * et l'utilisateur corrige. Ici l'ordre est l'**entree de tous les calculs** — trajectoire,
 * point d'entree, point d'arret, temps restant, bilan d'heures. Le produit rendrait un
 * conseil **faux avec assurance**, et rien ne le montrerait : aucune case n'a l'air fausse,
 * le chiffre est juste faux.
 *
 * D'ou la reponse, qui est la regle 8 d'`AGENTS.md` : **on signale, on ne repare jamais en
 * silence.** Ce type ne sert pas a corriger un decoupage — il sert a savoir qu'il en existe
 * d'autres, et a le dire.
 */
export interface EpisodeGrouping {
  readonly id: string;
  readonly name: string;
  /**
   * Nature du decoupage telle que TMDB la code.
   *
   * Conserve **brut**, et accompagne de {@link kindName} : le bareme est celui du
   * fournisseur, il peut s'etendre, et un module de domaine n'a pas a connaitre ses
   * numeros (`AGENTS.md` regle 3).
   */
  readonly kind: number;
  /** Nom lisible de la nature, quand on sait la nommer. */
  readonly kindName?: string;
  /** Nombre de groupes — l'equivalent des saisons dans ce decoupage. */
  readonly groupCount: number;
  /** Nombre total d'episodes dans ce decoupage. */
  readonly episodeCount: number;
}

/** Une personne creditee a la creation d'une serie. */
export interface Creator {
  readonly providerId: string;
  readonly name: string;
}

/** Fiche complete d'une serie, telle que rendue par un fournisseur. */
export interface SeriesDetail extends SeriesSummary {
  readonly externalIds: ExternalIds;
  readonly production: ProductionStatus;
  readonly seasons: readonly RawSeason[];
  /** Note du public chez le fournisseur, sur 10. **Pas** une note de ce produit. */
  readonly voteAverage?: number;
  readonly lastAiredAt?: Date;
  readonly nextAiringAt?: Date;
  readonly episodeRunTimeMinutes?: number;
  /**
   * Le prochain episode, quand il est annonce.
   *
   * « Nouvel episode dans trois jours » laisse le lecteur calculer la date et ignorer
   * de quel episode il s'agit. C'est la seule information du site qui donne une raison
   * de revenir a une date precise.
   */
  readonly nextEpisode?: {
    readonly seasonNumber: number;
    readonly episodeNumber: number;
    readonly title?: string;
    readonly airsOn: Date;
  };
  /**
   * Createurs credites.
   *
   * Un **fait de production**, pas un calcul de similarite : c'est ce qui distingue ce
   * maillage d'une recommandation algorithmique, ecartee par `ROADMAP.md` §3. Souvent
   * absent hors des series americaines — degrader sans bruit.
   */
  readonly creators?: readonly Creator[];
}

/** Un episode tel que rendu par un fournisseur. */
export interface EpisodeDetail {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title?: string;
  readonly airedAt?: Date;
  readonly runtimeMinutes?: number;
  readonly overview?: string;
  /** Note du public chez le fournisseur, sur 10. **Pas** une note de ce produit. */
  readonly voteAverage?: number;
  /** Nombre de votes. Une note adossee a trois votes ne vaut rien. */
  readonly voteCount?: number;
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

  search(query: string): Promise<readonly SeriesSummary[]>;

  getSeries(providerId: string): Promise<SeriesDetail>;

  getSeason(
    providerId: string,
    seasonNumber: number,
  ): Promise<SeasonDetail>;

  /** @param page 1-indexee, comme chez tous les fournisseurs. */
  discover(
    kind: DiscoverKind,
    page?: number,
  ): Promise<readonly SeriesSummary[]>;

  /** Les autres series d'une personne creditee a la creation. */
  seriesByCreator(
    personId: string,
  ): Promise<readonly SeriesSummary[]>;

  /**
   * Ou regarder une serie, pour un pays donne.
   *
   * @param region code ISO 3166-1 a deux lettres. La disponibilite est **toujours**
   *   nationale : afficher celle d'un autre pays serait pire que ne rien afficher.
   */
  watchOptions(
    providerId: string,
    region: string,
  ): Promise<readonly WatchOption[]>;

  /**
   * Les decoupages alternatifs connus pour une serie. Voir {@link EpisodeGrouping}.
   *
   * @returns une liste eventuellement **vide** — c'est le cas courant, et ce n'est pas une
   *   absence de reponse. Jamais `undefined` : un fournisseur qui ne sait pas repondre rend
   *   une liste vide, ce qui se traite comme « aucun decoupage alternatif connu ».
   */
  episodeGroups(
    providerId: string,
  ): Promise<readonly EpisodeGrouping[]>;
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

/**
 * Mention exigee des que des donnees de disponibilite sont affichees.
 *
 * TMDB les agrege depuis JustWatch et impose de le citer — obligation contractuelle,
 * au meme titre que {@link TMDB_ATTRIBUTION}, et non un choix de mise en page.
 */
export const JUSTWATCH_ATTRIBUTION = 'Disponibilité fournie par JustWatch.';

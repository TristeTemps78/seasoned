/**
 * Types de domaine.
 *
 * Regle structurante : **le catalogue est loue, pas possede**.
 * Ces types ne decrivent que ce que nous produisons (positions, notes, decisions,
 * verdicts) plus des *references* vers le catalogue externe. Aucune metadonnee
 * (titre, affiche, resume) n'a sa place ici : elle transite par `src/catalog`,
 * derriere un cache a expiration.
 *
 * Ce module est volontairement pur : aucun import, aucun effet, aucune dependance
 * a un fournisseur. Il survit a tous les arbitrages en attente.
 */

// ---------------------------------------------------------------------------
// Identite
// ---------------------------------------------------------------------------

/**
 * Identifiants d'une serie chez les fournisseurs externes.
 *
 * On en conserve plusieurs deliberement : c'est ce qui rend un changement de
 * fournisseur possible sans migration de donnees utilisateur.
 */
export interface ExternalIds {
  readonly tmdb?: number;
  readonly tvdb?: number;
  readonly imdb?: string;
}

/**
 * Identifiant interne d'une serie, stable et independant du fournisseur.
 *
 * Toutes les donnees utilisateur pointent vers lui, jamais vers un id TMDB brut :
 * un id TMDB qui change ou disparait ne doit pas emporter l'historique de quelqu'un.
 */
export type SeriesId = string;

/** Reference a une saison. `seasonNumber` 0 designe les episodes speciaux. */
export interface SeasonRef {
  readonly seriesId: SeriesId;
  readonly seasonNumber: number;
}

/** Reference a un episode. */
export interface EpisodeRef {
  readonly seriesId: SeriesId;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
}

// ---------------------------------------------------------------------------
// Catalogue (formes minimales, hydratees depuis un fournisseur)
// ---------------------------------------------------------------------------

/**
 * Nature d'une saison telle que *nous* la classons, apres normalisation.
 *
 * Le fournisseur ne le dit pas : c'est `src/domain/seasons.ts` qui le derive.
 * Voir — l'instabilite du decoupage en saisons est le
 * risque n°1 du modele de notation.
 */
export type SeasonKind =
  /** Saison ordinaire, notable, comptee dans la trajectoire. */
  | 'regular'
  /** Episodes speciaux, hors-serie, recaps (typiquement la saison 0). */
  | 'specials';

/** Une saison telle que le domaine la manipule, apres normalisation. */
export interface Season {
  readonly ref: SeasonRef;
  readonly kind: SeasonKind;
  readonly episodeCount: number;
  /** Premiere diffusion, si connue. */
  readonly airedFrom?: Date;
  /** Derniere diffusion, si connue et passee. */
  readonly airedTo?: Date;
}

/** Un episode, reduit a ce dont le domaine a besoin. */
export interface Episode {
  readonly ref: EpisodeRef;
  readonly airedAt?: Date;
  /** Duree en minutes, si connue. Sert au calcul de l'engagement demande. */
  readonly runtimeMinutes?: number;
}

/**
 * Statut de production declare par le fournisseur.
 *
 * A ne pas confondre avec le statut *reel*, derive dans `src/domain/status.ts` :
 * TMDB laisse des series mortes depuis trois ans en `returning`.
 */
export type ProductionStatus =
  | 'returning'
  | 'planned'
  | 'in_production'
  | 'ended'
  | 'canceled'
  | 'pilot'
  | 'unknown';

// ---------------------------------------------------------------------------
// Notation
// ---------------------------------------------------------------------------

/**
 * Note sur l'echelle Letterboxd : 0,5 a 5,0 par pas de 0,5.
 *
 * Le type litteral rend les notes invalides inconstructibles. Le choix de
 * l'echelle est argumente dans (couche 1) : assez
 * grossiere pour rester stable dans le temps.
 */
export type Stars = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

/** Toutes les valeurs de `Stars`, dans l'ordre croissant. */
export const ALL_STARS: readonly Stars[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** Borne basse de l'echelle. */
export const MIN_STARS: Stars = 0.5;
/** Borne haute de l'echelle. */
export const MAX_STARS: Stars = 5;

/**
 * Cible d'une note.
 *
 * Polymorphe **des le depart**, meme si l'interface v1 n'expose que `season`.
 * Le cout de le prevoir maintenant est nul ;
 * celui de l'ajouter apres coup est une migration.
 */
export type RatingTarget =
  | { readonly kind: 'season'; readonly ref: SeasonRef }
  | { readonly kind: 'episode'; readonly ref: EpisodeRef }
  | { readonly kind: 'series'; readonly seriesId: SeriesId };

/** Une note portee par un utilisateur sur une cible. */
export interface Rating {
  readonly target: RatingTarget;
  readonly stars: Stars;
  readonly at: Date;
}

// ---------------------------------------------------------------------------
// Progression et decisions
// ---------------------------------------------------------------------------

/**
 * Ou en est un utilisateur dans une serie.
 *
 * **Un pointeur, pas une collection de booleens**.
 * Tout ce qui precede est implicitement vu ; c'est ce qui permet de mettre a jour
 * une progression en un geste au lieu de quarante-sept.
 */
export interface Position {
  readonly at: EpisodeRef;
  /** Date a laquelle cette position a ete declaree. */
  readonly declaredAt: Date;
}

/**
 * Ce que l'utilisateur a decide de faire de la serie.
 *
 * Table de plein droit, pas un champ `status`.
 * C'est la donnee propriete du produit : la carte des abandons.
 */
export type DecisionKind =
  /** Je continue. */
  | 'continuing'
  /** Je mets en pause — j'y reviendrai peut-etre. */
  | 'paused'
  /** J'arrete. Definitif. */
  | 'abandoned'
  /** J'ai fini ce qui existe. */
  | 'completed';

// ---------------------------------------------------------------------------
// Ce qui a ete retire d'ici le 2026-08-06, et ou vit l'intention
// ---------------------------------------------------------------------------

/*
 * Ce fichier portait quatre formes de plus — `Highlight`, `Decision`, `SeriesVerdict`
 * (avec `Verdict`) et `LogEntry` — ecrites a la phase 0.2, **avant** le journal, et que
 * rien n'a jamais construites : zero reference dans tout le depot, tests compris.
 *
 * Ce n'etait pas du bruit inoffensif. `types.ts` est l'un des premiers fichiers qu'on
 * ouvre en arrivant : il decrivait donc a tout arrivant un modele qui n'est pas
 * celui du code. Le journal (`journal.ts`) a construit le sien, et les deux ont vecu cote
 * a cote sans que rien ne signale lequel etait reel.
 *
 * Ou chaque intention vit reellement :
 *
 * - `Decision`      → `JournalDecision`, qui porte en plus `atSeason` / `atEpisode` ;
 * - `LogEntry`      → `JournalEntry` + `JournalCompletion` (le revisionnage est une liste
 *                     de dates, pas une entree par visionnage) ;
 * - `Highlight`     → **caduque par decision** : l'arbitrage A7 (2026-08-02) a tranche la
 *                     note d'episode complete, la ou le modele de notation d'origine
 *                     disait « on ne note pas les episodes, on les distingue » ;
 * - `Verdict`       → l'idee est vivante et le type ne l'etait pas. « Arrete-toi a la
 *                     saison 4 » est **calcule**, pas saisi : `trajectory.ts` (point de
 *                     rupture), `entry-point.ts`, `current-season.ts`. C'est mieux que ce
 *                     que le type prevoyait — il attendait une saisie que personne
 *                     n'aurait faite avant d'avoir fini la serie.
 *
 * ⚠️ `LogEntry` portait `text` et `liked`, c'est-a-dire exactement les deux champs du
 * lot 8. Ils arrivent sur `JournalEntry`, pas ici : garder la forme morte aurait donne
 * deux endroits ou les chercher.
 */

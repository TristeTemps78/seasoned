/**
 * Types de domaine.
 *
 * Regle structurante (`ROADMAP.md` §1.3) : **le catalogue est loue, pas possede**.
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
 * Voir `docs/RATING-MODEL.md` §8.1 — l'instabilite du decoupage en saisons est le
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
 * l'echelle est argumente dans `docs/RATING-MODEL.md` §3 (couche 1) : assez
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
 * Polymorphe **des le depart**, meme si l'interface v1 n'expose que `season`
 * (`docs/RATING-MODEL.md` §7.1). Le cout de le prevoir maintenant est nul ;
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

/**
 * Polarite d'un episode marquant.
 *
 * `docs/RATING-MODEL.md` §3 couche 2 : on ne note pas les episodes, on les
 * *distingue*. Zero a cinq par saison, en bien ou en mal.
 */
export type HighlightPolarity = 'high' | 'low';

/** Un episode signale comme marquant. */
export interface Highlight {
  readonly ref: EpisodeRef;
  readonly polarity: HighlightPolarity;
  readonly note?: string;
  readonly at: Date;
}

// ---------------------------------------------------------------------------
// Progression et decisions
// ---------------------------------------------------------------------------

/**
 * Ou en est un utilisateur dans une serie.
 *
 * **Un pointeur, pas une collection de booleens** (`docs/RATING-MODEL.md` §7.3).
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
 * Table de plein droit, pas un champ `status` (`docs/RATING-MODEL.md` §7.4).
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

export interface Decision {
  readonly seriesId: SeriesId;
  readonly kind: DecisionKind;
  /** Le point exact ou la decision a ete prise. C'est lui qui a de la valeur. */
  readonly point?: EpisodeRef;
  readonly reason?: string;
  readonly at: Date;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/**
 * Reponse a « je me lance ? » — la question qu'on pose reellement a propos d'une
 * serie, et qui n'est pas « c'est bien ? ».
 *
 * `docs/RATING-MODEL.md` §3 couche 3. `stopAfter` est le coeur de la proposition :
 * « regarde Dexter mais arrete-toi a la saison 4 » est la phrase archetypale de
 * toute conversation sur les series, et personne ne la capture.
 */
export type Verdict =
  | { readonly kind: 'go' }
  | { readonly kind: 'stop_after'; readonly seasonNumber: number }
  | { readonly kind: 'conditional'; readonly condition: string }
  | { readonly kind: 'no' };

/** Verdict rendu par un utilisateur sur une serie. */
export interface SeriesVerdict {
  readonly seriesId: SeriesId;
  readonly verdict: Verdict;
  readonly at: Date;
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

/**
 * Une entree de journal : un evenement date.
 *
 * **Distincte de la note** (`docs/RATING-MODEL.md` §7.2). Une entree date ce qui
 * est arrive ; une note exprime un jugement. On peut avoir l'une sans l'autre, et
 * une saison revisionnee produit plusieurs entrees pour une seule note courante.
 * Fusionner les deux rend le revisionnage impossible a modeliser ensuite.
 */
export interface LogEntry {
  readonly target: RatingTarget;
  /** Quand le visionnage s'est termine. */
  readonly watchedOn: Date;
  readonly stars?: Stars;
  readonly text?: string;
  readonly liked?: boolean;
  readonly rewatch?: boolean;
}

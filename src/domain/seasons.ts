/**
 * Normalisation des saisons.
 *
 * C'est le risque n°1 du modele de notation : si la
 * saison est l'unite canonique, alors l'instabilite du decoupage en saisons devient
 * un probleme de **produit**, pas d'integration.
 *
 * Les cas qui cassent :
 *   - la saison 0 (episodes speciaux, recaps, hors-serie) ;
 *   - les saisons annoncees mais pas encore diffusees ;
 *   - les saisons scindees en deux parties, que les fournisseurs traitent tantot
 *     comme une saison, tantot comme deux (*Better Call Saul*, *Stranger Things*) ;
 *   - les mini-series, ou saison = serie, et ou noter les deux est redondant ;
 *   - les numerotations a trous.
 *
 * **Principe directeur : on signale, on ne repare jamais en silence.**
 * Fusionner deux saisons automatiquement sur une heuristique fausse casserait les
 * notes deja posees par un utilisateur. Un avertissement remonte a l'interface est
 * recuperable ; une fusion erronee ne l'est pas.
 *
 * Module pur : aucun acces reseau, aucune dependance a un fournisseur.
 */

import type { Season, SeasonKind, SeriesId } from './types';

/** Numero de saison reserve aux episodes speciaux par TMDB et TheTVDB. */
export const SPECIALS_SEASON_NUMBER = 0;

/**
 * Ecart maximal, en jours, entre deux saisons consecutives en deca duquel on
 * soupconne une saison scindee plutot que deux saisons distinctes.
 *
 * 90 jours : au-dela, c'est un rythme de production normal entre deux saisons.
 * En deca, c'est presque toujours une meme commande diffusee en deux blocs.
 * Seuil heuristique — il produit un avertissement, jamais une fusion.
 */
const SPLIT_SEASON_PROXIMITY_DAYS = 90;

/** Une saison telle que la rend un fournisseur, avant tout traitement. */
export interface RawSeason {
  readonly seasonNumber: number;
  readonly name?: string;
  readonly episodeCount: number;
  /** Date de premiere diffusion annoncee pour la saison. */
  readonly airDate?: Date;
}

/** Forme generale de la serie, deduite du decoupage. */
export type SeriesShape =
  /** Une seule saison reguliere sur une serie terminee : saison = serie. */
  | 'miniseries'
  /** Plusieurs saisons regulieres. */
  | 'multi_season'
  /** Rien de diffuse : on ne peut rien en dire. */
  | 'unknown';

/** Motif d'avertissement remonte a l'interface. */
export type SeasonWarningCode =
  /** Des episodes speciaux existent — exclus du canon notable. */
  | 'specials_present'
  /** Au moins une saison annoncee mais pas encore diffusee. */
  | 'unaired_season'
  /** Une saison sans aucun episode : donnee incomplete chez le fournisseur. */
  | 'empty_season'
  /** Trou dans la numerotation (S1, S2, S4). */
  | 'non_contiguous_numbering'
  /** Deux saisons trop proches dans le temps : probable saison scindee. */
  | 'possible_split_season'
  /** Une seule saison reguliere : noter la saison ET la serie serait redondant. */
  | 'single_season';

export interface SeasonWarning {
  readonly code: SeasonWarningCode;
  /** Saisons concernees, par numero. */
  readonly seasonNumbers: readonly number[];
  /** Message lisible, destine a l'interface et aux journaux de diagnostic. */
  readonly detail: string;
}

export interface NormalizedSeasons {
  /** Toutes les saisons, speciaux compris, triees par numero croissant. */
  readonly all: readonly Season[];
  /**
   * Les saisons que l'on peut proposer a la notation : regulieres et au moins
   * partiellement diffusees. C'est **la** liste que consomme la trajectoire.
   */
  readonly rateable: readonly Season[];
  /** Les saisons d'episodes speciaux, isolees. */
  readonly specials: readonly Season[];
  readonly shape: SeriesShape;
  readonly warnings: readonly SeasonWarning[];
}

/** Motifs de nom trahissant une saison scindee, en anglais et en francais. */
const SPLIT_NAME_PATTERN = /\b(?:part|partie|vol\.?|volume)\s*(?:[0-9]+|one|two|un|deux|i{1,3})\b/i;

const MS_PER_DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

function classify(raw: RawSeason): SeasonKind {
  return raw.seasonNumber === SPECIALS_SEASON_NUMBER ? 'specials' : 'regular';
}

/**
 * Une saison est consideree diffusee des lors que sa date de premiere diffusion
 * est passee. Une saison sans date est traitee comme **non diffusee** : mieux vaut
 * ne pas proposer de noter que proposer de noter du vide.
 */
function hasAired(raw: RawSeason, now: Date): boolean {
  return raw.airDate !== undefined && raw.airDate.getTime() <= now.getTime();
}

function toSeason(seriesId: SeriesId, raw: RawSeason): Season {
  return {
    ref: { seriesId, seasonNumber: raw.seasonNumber },
    kind: classify(raw),
    episodeCount: raw.episodeCount,
    ...(raw.airDate !== undefined ? { airedFrom: raw.airDate } : {}),
  };
}

/**
 * Normalise le decoupage en saisons rendu par un fournisseur.
 *
 * @param seriesId  identifiant interne de la serie
 * @param rawSeasons  saisons brutes, dans n'importe quel ordre
 * @param options.now  instant de reference — injecte pour rendre les tests deterministes
 * @param options.productionEnded  la serie est-elle terminee ou annulee ? Necessaire
 *   pour distinguer une mini-serie d'une serie qui n'a qu'une saison *pour l'instant*.
 */
/**
 * Nombre d'episodes des saisons notables jusqu'a `throughSeason` incluse.
 *
 * Sert a chiffrer ce que coute une serie **si l'on s'arrete la** : « regarde Dexter
 * mais arrete-toi a la saison 4 » est la phrase archetypale de toute conversation sur
 * les series (couche 3), et personne ne la chiffre.
 *
 * Les speciaux et les saisons non diffusees sont exclus, comme partout ailleurs.
 */
export function episodesThrough(
  seasons: readonly Season[],
  throughSeason: number,
): number {
  return seasons
    .filter((s) => s.ref.seasonNumber <= throughSeason)
    .reduce((sum, s) => sum + s.episodeCount, 0);
}

/**
 * Choisit la saison la plus representative pour estimer une duree d'episode.
 *
 * Ni la premiere (le pilote est souvent rallonge), ni la derniere (le final aussi) :
 * on prend celle du milieu. Avec une seule saison notable, on n'a pas le choix.
 *
 * Renvoie `undefined` si rien n'est diffuse.
 */
export function representativeSeason(seasons: NormalizedSeasons): Season | undefined {
  const { rateable } = seasons;
  if (rateable.length === 0) return undefined;
  return rateable[Math.floor((rateable.length - 1) / 2)];
}

export function normalizeSeasons(
  seriesId: SeriesId,
  rawSeasons: readonly RawSeason[],
  options: { readonly now?: Date; readonly productionEnded?: boolean } = {},
): NormalizedSeasons {
  const now = options.now ?? new Date();
  const productionEnded = options.productionEnded ?? false;

  const sorted = [...rawSeasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const all = sorted.map((raw) => toSeason(seriesId, raw));

  const specials = all.filter((s) => s.kind === 'specials');
  const regularRaw = sorted.filter((raw) => classify(raw) === 'regular');

  const rateable = regularRaw
    .filter((raw) => hasAired(raw, now) && raw.episodeCount > 0)
    .map((raw) => toSeason(seriesId, raw));

  const warnings: SeasonWarning[] = [];

  if (specials.length > 0) {
    warnings.push({
      code: 'specials_present',
      seasonNumbers: specials.map((s) => s.ref.seasonNumber),
      detail:
        'Episodes speciaux presents : exclus du canon notable et de la trajectoire.',
    });
  }

  const unaired = regularRaw.filter((raw) => !hasAired(raw, now));
  if (unaired.length > 0) {
    warnings.push({
      code: 'unaired_season',
      seasonNumbers: unaired.map((r) => r.seasonNumber),
      detail:
        'Saison(s) annoncee(s) mais pas encore diffusee(s) : non proposee(s) a la notation.',
    });
  }

  const empty = regularRaw.filter((raw) => raw.episodeCount === 0);
  if (empty.length > 0) {
    warnings.push({
      code: 'empty_season',
      seasonNumbers: empty.map((r) => r.seasonNumber),
      detail: 'Saison sans episode : donnee incomplete chez le fournisseur.',
    });
  }

  // Trous dans la numerotation des saisons regulieres.
  const gaps: number[] = [];
  for (let i = 1; i < regularRaw.length; i += 1) {
    const previous = regularRaw[i - 1];
    const current = regularRaw[i];
    if (previous === undefined || current === undefined) continue;
    if (current.seasonNumber - previous.seasonNumber > 1) {
      gaps.push(current.seasonNumber);
    }
  }
  if (gaps.length > 0) {
    warnings.push({
      code: 'non_contiguous_numbering',
      seasonNumbers: gaps,
      detail:
        'Numerotation a trous : le decoupage du fournisseur diverge probablement de celui du diffuseur.',
    });
  }

  // Saisons scindees : detectees par le nom, ou par proximite temporelle.
  // Signalees uniquement — jamais fusionnees. Voir l'en-tete du module.
  const splitCandidates = new Set<number>();
  for (const raw of regularRaw) {
    if (raw.name !== undefined && SPLIT_NAME_PATTERN.test(raw.name)) {
      splitCandidates.add(raw.seasonNumber);
    }
  }
  for (let i = 1; i < regularRaw.length; i += 1) {
    const previous = regularRaw[i - 1];
    const current = regularRaw[i];
    if (previous?.airDate === undefined || current?.airDate === undefined) continue;
    if (daysBetween(previous.airDate, current.airDate) < SPLIT_SEASON_PROXIMITY_DAYS) {
      splitCandidates.add(previous.seasonNumber);
      splitCandidates.add(current.seasonNumber);
    }
  }
  if (splitCandidates.size > 0) {
    warnings.push({
      code: 'possible_split_season',
      seasonNumbers: [...splitCandidates].sort((a, b) => a - b),
      detail:
        'Saison probablement scindee en deux blocs. A confirmer avant de la traiter comme deux saisons distinctes.',
    });
  }

  let shape: SeriesShape;
  if (rateable.length === 0) {
    shape = 'unknown';
  } else if (rateable.length === 1 && productionEnded && unaired.length === 0) {
    shape = 'miniseries';
    warnings.push({
      code: 'single_season',
      seasonNumbers: rateable.map((s) => s.ref.seasonNumber),
      detail:
        'Mini-serie : saison = serie. Ne pas demander a la fois une note de saison et un verdict de serie.',
    });
  } else {
    shape = 'multi_season';
  }

  return { all, rateable, specials, shape, warnings };
}

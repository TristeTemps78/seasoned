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
  DiscoverKind,
  EpisodeGrouping,
  SeasonDetail,
  SeriesDetail,
  SeriesSummary,
  WatchOption,
} from '../src/catalog/provider';
import { ExpiringCache, memoizeAsync } from '../src/catalog/cache';
import {
  episodesThrough,
  normalizeSeasons,
  representativeSeason,
  type NormalizedSeasons,
} from '../src/domain/seasons';
import { deriveStatus, type StatusResult } from '../src/domain/status';
import { isShowcased } from '../src/domain/program';
import { seasonCadence } from '../src/domain/cadence';
import {
  PUBLIC_BREAK_POINT_MIN_DROP,
  PUBLIC_MIN_SPREAD_FOR_SHAPE,
  representativeRating,
  starsFromTen,
} from '../src/domain/rating-scale';
import { computeTrajectory, type SeasonScore, type Trajectory } from '../src/domain/trajectory';
import { DEFAULT_LOCALE, localeTag, watchRegion, type Locale } from './i18n';

/** Duree de vie du cache serie : une journee. Les grilles de diffusion bougent peu. */
const SERIES_TTL_MS = 86_400_000;

/** Duree de vie du cache recherche : une heure. Requetes plus variees, moins de valeur. */
const SEARCH_TTL_MS = 3_600_000;

/**
 * Duree de vie des reponses TMDB dans le cache de donnees de l'hote, en secondes.
 *
 * Vingt-quatre heures, comme les pages : une grille de diffusion ne bouge pas plus
 * souvent. C'est ce cache-la qui tient le budget, pas celui en memoire.
 */
const TMDB_FETCH_REVALIDATE_SECONDS = 86_400;

let providerInstance: CatalogProvider | undefined;

/**
 * Un fournisseur par langue.
 *
 * Ils ne different que par l'etiquette envoyee a TMDB, mais ils doivent etre distincts :
 * une seule instance servirait la meme langue de metadonnees a toutes les pages.
 */
const providersByLocale = new Map<Locale, CatalogProvider>();

/**
 * La langue demandee au catalogue pour une page.
 *
 * Extraite pour une seule raison : **elle est testable**, alors qu'une lecture
 * d'environnement enfouie dans une fabrique ne l'est pas. Voir le defaut documente
 * a son appel.
 */
export function catalogLanguage(
  locale: Locale,
  forced: string | undefined = process.env['TMDB_LANGUAGE'],
): string {
  const trimmed = forced?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : localeTag(locale);
}

/**
 * Le fournisseur, cree a la demande.
 *
 * Le jeton n'est lu qu'a l'usage et jamais au chargement du module : sans cela, un
 * simple import ferait echouer les tests et le build en l'absence d'environnement.
 */
function getProvider(locale: Locale = DEFAULT_LOCALE): CatalogProvider {
  // Un fournisseur force par un test l'emporte sur tout : c'est le point d'injection.
  if (providerInstance !== undefined) return providerInstance;

  const cached = providersByLocale.get(locale);
  if (cached !== undefined) return cached;

  const accessToken = process.env['TMDB_ACCESS_TOKEN'];
  if (accessToken === undefined || accessToken.trim().length === 0) {
    throw new Error(
      'TMDB_ACCESS_TOKEN manquant. Copier .env.example en .env et renseigner le jeton v4.',
    );
  }

  // ⚠️ La langue du catalogue suit desormais celle de la PAGE, et non une variable
  // d'environnement globale.
  //
  // Le commentaire qui etait ici disait deja la regle — « servir une page anglaise avec
  // des synopsis francais serait pire que ne pas traduire du tout » — et le code faisait
  // exactement l'inverse : `TMDB_LANGUAGE` valait une seule langue pour tout le site,
  // donc `/serie/1396` et `/fr/serie/1396` recevaient le meme synopsis. Avec un
  // `TMDB_LANGUAGE=fr-FR` oublie dans l'environnement, ce sont les pages ANGLAISES —
  // celles que les moteurs indexent, le canal d'acquisition n°1 — qui servaient du
  // francais. L'intention etait ecrite, l'effet etait nul : la forme d'echec propre a ce
  // projet, rencontree ici pour la quatrieme fois.
  //
  // `TMDB_LANGUAGE` reste lu, mais **uniquement** comme forcage de diagnostic : il
  // ecrase toutes les langues, ce qui n'a de sens que pour reproduire un bogue.
  //
  // 🔴 **Et le forcage se declenchait sur une variable VIDE.** `??` ne retombe que sur
  // `null` ou `undefined` : `TMDB_LANGUAGE=` — la ligne telle qu'elle figure dans
  // `.env.example`, donc dans le `.env` de quiconque part de l'exemple — rendait la chaine
  // vide, qui **est** une valeur. Le catalogue etait alors interroge sans langue, c'est-a-dire
  // en anglais, et `/fr/serie/1396` servait un synopsis anglais.
  //
  // Le defaut ne se voyait qu'en local : la variable n'existe pas chez Vercel, donc la
  // production etait juste. Constate au navigateur, jamais par un test — d'ou celui qui
  // accompagne cette ligne.
  const language = catalogLanguage(locale);
  const provider = new TmdbProvider({
    accessToken,
    language,
    // Le cache de donnees de Next, partage entre toutes les instances et persistant —
    // contrairement au cache memoire, propre a chaque instance sans etat.
    //
    // C'est LUI qui tient le budget. Verifie en production le 2026-08-02 : les pages
    // serie repondaient `X-Vercel-Cache: MISS` malgre leur `revalidate`, donc chaque
    // visite rejouait tous les appels TMDB.
    requestInit: { next: { revalidate: TMDB_FETCH_REVALIDATE_SECONDS } } as RequestInit,
  });
  providersByLocale.set(locale, provider);
  return provider;
}

/**
 * Remplace le fournisseur — reserve aux tests.
 *
 * ⚠️ **Vider TOUS les caches, sans exception.** Un cache oublie ici survit au changement de
 * fournisseur : le double injecte par un test recoit alors la reponse du **fournisseur
 * precedent**, ce qui fait passer un test qui devrait echouer — ou echouer un test selon
 * l'ordre d'execution des fichiers, le pire des deux.
 *
 * `creatorCache` et `watchCache` manquaient depuis leur creation ; le defaut est reste
 * invisible parce qu'aucun test n'injectait deux fournisseurs de suite en s'appuyant sur eux.
 * Corrige le 2026-08-03 en ajoutant `groupingCache`, qui aurait ete le troisieme oubli.
 */
export function setProvider(provider: CatalogProvider | undefined): void {
  providerInstance = provider;
  providersByLocale.clear();
  seriesCache.clear();
  searchCache.clear();
  seasonCache.clear();
  discoverCache.clear();
  creatorCache.clear();
  watchCache.clear();
  groupingCache.clear();
}

const seriesCache = new ExpiringCache<SeriesDetail>({ maxEntries: 2_000 });
const searchCache = new ExpiringCache<readonly SeriesSummary[]>({ maxEntries: 500 });
const seasonCache = new ExpiringCache<SeasonDetail>({ maxEntries: 2_000 });
const discoverCache = new ExpiringCache<readonly SeriesSummary[]>({ maxEntries: 100 });

const throughSeries = memoizeAsync(seriesCache, SERIES_TTL_MS);
const throughSearch = memoizeAsync(searchCache, SEARCH_TTL_MS);
const throughSeason = memoizeAsync(seasonCache, SERIES_TTL_MS);
const throughDiscover = memoizeAsync(discoverCache, SERIES_TTL_MS);

const creatorCache = new ExpiringCache<readonly SeriesSummary[]>({ maxEntries: 1_000 });
const throughCreator = memoizeAsync(creatorCache, SERIES_TTL_MS);

const watchCache = new ExpiringCache<readonly WatchOption[]>({ maxEntries: 2_000 });
const throughWatch = memoizeAsync(watchCache, SERIES_TTL_MS);

const groupingCache = new ExpiringCache<readonly EpisodeGrouping[]>({ maxEntries: 2_000 });
const throughGroupings = memoizeAsync(groupingCache, SERIES_TTL_MS);

/**
 * Les decoupages concurrents d'une serie, prets a comparer.
 *
 * ## Ce que ca coute, et pourquoi c'est acceptable
 *
 * **Un appel de plus par serie et par cycle de cache.** La page serie en fait deja
 * plusieurs, la route est `force-static` avec un `revalidate` de 24 h, et la reponse est
 * minuscule (quelques lignes par decoupage). Le budget tient.
 *
 * **Pas de langue dans la cle** : les noms de decoupages sont saisis par les contributeurs
 * TMDB (« Netflix Seasons », « German DVD Release ») et ne sont pas traduits. Y mettre la
 * locale doublerait le cache pour un contenu identique — meme raisonnement que
 * {@link watchOptions}.
 *
 * Degrade en liste vide : n'avoir aucun decoupage alternatif est le **cas courant**, pas une
 * erreur, et une serie dont on ne sait pas repondre doit s'afficher comme les autres.
 */
export async function episodeGroupings(id: string): Promise<readonly EpisodeGrouping[]> {
  try {
    return await throughGroupings(id, () => getProvider().episodeGroups(id));
  } catch {
    return [];
  }
}

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

/**
 * ⚠️ **La langue fait partie de la cle de cache.**
 *
 * Sans elle, la premiere requete d'une serie fixerait la langue de son synopsis pour
 * toutes les autres : `/serie/1396` et `/fr/serie/1396` se serviraient mutuellement leur
 * contenu selon qui arrive en premier. C'est le genre de defaut qui ne se reproduit pas
 * a la demande et qu'on ne trouve jamais en relisant le code.
 */
function keyIn(locale: Locale, key: string): string {
  return `${locale}:${key}`;
}

export async function searchSeries(
  query: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly SeriesSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  return throughSearch(keyIn(locale, trimmed.toLowerCase()), () =>
    getProvider(locale).search(trimmed),
  );
}

export async function getSeriesDetail(
  id: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<SeriesDetail> {
  return throughSeries(keyIn(locale, id), () => getProvider(locale).getSeries(id));
}

/**
 * Listes de decouverte.
 *
 * Sans elles, **aucune page serie n'est atteignable** depuis une page indexable
 * (audit du 2026-08-01). Ce sont donc les liens qui rendent le canal d'acquisition
 * n°1 possible, pas un ornement de la page d'accueil.
 *
 * Degrade en liste vide plutot que de lever : l'accueil est la porte d'entree, il
 * doit s'afficher meme quand le catalogue est en panne.
 */
export async function discover(
  kind: DiscoverKind,
  page = 1,
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly SeriesSummary[]> {
  try {
    const all = await throughDiscover(keyIn(locale, `${kind}:${page}`), () =>
      getProvider(locale).discover(kind, page),
    );
    // Filtre la **vitrine**, pas le catalogue : une page serie reste accessible pour
    // n'importe quel programme si quelqu'un la cherche. Sans ce filtre, la rangee
    // « En attente » remontait le journal televise allemand et de la telerealite
    // (constate en production le 2026-08-01).
    return all.filter((s) => s.kind === undefined || isShowcased(s.kind));
  } catch {
    return [];
  }
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
  locale: Locale = DEFAULT_LOCALE,
): Promise<SeriesPageData> {
  const detail = await getSeriesDetail(id, locale);

  const productionEnded = detail.production === 'ended' || detail.production === 'canceled';
  const seasons = normalizeSeasons(id, detail.seasons, { now, productionEnded });

  // Le rythme se lit sur les saisons deja diffusees : c'est ce qui rend le seuil de
  // « sans nouvelle » propre a chaque serie plutot qu'arbitraire (`cadence.ts`).
  const cadence = seasonCadence(seasons.rateable);

  const status = deriveStatus(
    {
      production: detail.production,
      ...(detail.lastAiredAt !== undefined ? { lastAiredAt: detail.lastAiredAt } : {}),
      ...(detail.nextAiringAt !== undefined ? { nextAiringAt: detail.nextAiringAt } : {}),
      ...(cadence !== undefined ? { cadence } : {}),
    },
    now,
  );

  const episodeCount = seasons.rateable.reduce((sum, s) => sum + s.episodeCount, 0);
  const runtime = await estimateEpisodeRuntime(id, detail, seasons, locale);

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
  locale: Locale = DEFAULT_LOCALE,
): Promise<number | undefined> {
  const sample = representativeSeason(seasons);
  if (sample !== undefined) {
    try {
      const seasonNumber = sample.ref.seasonNumber;
      const full = await throughSeason(keyIn(locale, `${id}:${seasonNumber}`), () =>
        getProvider(locale).getSeason(id, seasonNumber),
      );
      const median = medianRuntime(full);
      if (median !== undefined) return median;
    } catch {
      // Le catalogue peut tomber : on continue avec ce qu'on a deja.
    }
  }
  return detail.episodeRunTimeMinutes;
}

/** Un resultat de liste, enrichi de son statut reel quand il a pu etre calcule. */
export interface SeriesWithStatus {
  readonly summary: SeriesSummary;
  readonly status?: StatusResult;
}

/**
 * Hydrate une liste avec le statut reel de chaque serie.
 *
 * **Un appel par serie** — a ne faire que sur une page mise en cache. L'accueil est
 * en ISR quotidien : douze series hydratees coutent douze appels par jour, quel que
 * soit le trafic. La recherche, elle, est dynamique : l'y appliquer couterait un
 * appel par resultat et par requete, ce que le budget interdit (`ROADMAP.md` §1.4).
 *
 * Chaque serie degrade independamment : une fiche indisponible perd son statut, pas
 * sa vignette.
 */
export async function withStatus(
  summaries: readonly SeriesSummary[],
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly SeriesWithStatus[]> {
  return Promise.all(
    summaries.map(async (summary) => {
      try {
        const detail = await getSeriesDetail(summary.providerId, locale);
        const seasons = normalizeSeasons(summary.providerId, detail.seasons, { now });
        const cadence = seasonCadence(seasons.rateable);
        return {
          summary,
          status: deriveStatus(
            {
              production: detail.production,
              ...(detail.lastAiredAt !== undefined ? { lastAiredAt: detail.lastAiredAt } : {}),
              ...(detail.nextAiringAt !== undefined ? { nextAiringAt: detail.nextAiringAt } : {}),
              ...(cadence !== undefined ? { cadence } : {}),
            },
            now,
          ),
        };
      } catch {
        return { summary };
      }
    }),
  );
}

/**
 * Nombre maximal de saisons interrogees pour tracer une courbe.
 *
 * Chaque saison coute un appel. Au-dela d'une quinzaine, la courbe n'apprend plus
 * grand-chose et la facture grimpe pour rien — le cas *Les Simpson* ne doit pas couter
 * trente-six appels (`ROADMAP.md` §1.4).
 */
const MAX_SEASONS_FOR_TRAJECTORY = 15;

/**
 * Trajectoire etablie a partir des notes **du public TMDB**.
 *
 * Ce ne sont pas les notes de ce produit, et ce module ne pretend pas le contraire :
 * l'origine remonte jusqu'a l'affichage. Elles servent a amorcer — une page serie doit
 * valoir le detour avec zero critique (`ROADMAP.md` §0.1) — et elles activent enfin
 * `computeTrajectory`, ecrit et teste des le premier jour sans jamais servir.
 *
 * Les saisons trop peu votees sont absentes de la courbe plutot qu'inventees.
 */
export async function publicTrajectory(
  id: string,
  seasons: NormalizedSeasons,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Trajectory | undefined> {
  const candidates = seasons.rateable.slice(0, MAX_SEASONS_FOR_TRAJECTORY);
  if (candidates.length < 2) return undefined;

  const scores = await Promise.all(
    candidates.map(async (season) => {
      const seasonNumber = season.ref.seasonNumber;
      try {
        const full = await throughSeason(keyIn(locale, `${id}:${seasonNumber}`), () =>
          getProvider(locale).getSeason(id, seasonNumber),
        );
        const median = representativeRating(
          full.episodes
            .filter((e) => e.voteAverage !== undefined && e.voteCount !== undefined)
            .map((e) => ({ voteAverage: e.voteAverage!, voteCount: e.voteCount! })),
        );
        const stars = starsFromTen(median);
        return stars !== undefined ? { seasonNumber, stars } : undefined;
      } catch {
        return undefined;
      }
    }),
  );

  const usable = scores.filter((s): s is SeasonScore => s !== undefined);
  if (usable.length < 2) return undefined;

  // Seuil de decrochage adapte a des notes de foule, qui ne bougent presque pas
  // (`rating-scale.ts`). Avec le seuil des notes humaines, le decrochage de *Dexter*
  // etait invisible.
  return computeTrajectory(id, usable, {
    minDrop: PUBLIC_BREAK_POINT_MIN_DROP,
    minSpread: PUBLIC_MIN_SPREAD_FOR_SHAPE,
  });
}

/**
 * Part de la serie qu'un point d'arret doit faire economiser pour meriter d'etre dit.
 *
 * Un tiers. Constate en production le 2026-08-01 : sur *Dexter*, la plus forte chute
 * de notes publiques se situe entre les saisons 7 et 8 — s'arreter la epargne huit
 * episodes sur quatre-vingt-seize. Exact, et parfaitement inutile : **conseiller
 * d'arreter juste avant la fin n'aide personne.**
 *
 * Ce n'est pas un cas isole. La derniere saison est frequemment la moins bien notee,
 * donc la plus forte chute tombe souvent a la fin.
 */
export const MIN_STOP_POINT_SAVING = 1 / 3;

/** Ce qu'un point d'arret ferait gagner, quand il vaut la peine d'etre mentionne. */
export interface StopPointAdvice {
  readonly afterSeason: number;
  readonly shortenedMinutes: number;
  readonly fullMinutes: number;
}

/**
 * Traduit un decrochage en conseil chiffre — ou en rien du tout.
 *
 * Renvoie `undefined` quand s'arreter ne changerait pas grand-chose : mieux vaut se
 * taire qu'enoncer un conseil exact et sans portee.
 *
 * ⚠️ **Limite connue et non resolue.** Ces points d'arret derivent de notes de foule,
 * qui souffrent d'un biais de survie : ceux qui ont vu la saison 6 de *Dexter* sont
 * ceux qui ont persevere, et ils la notent bien. Les notes publiques ne retrouvent donc
 * pas l'effondrement dont tout le monde parle. Le conseil est exact sur les donnees, et
 * les donnees ne disent pas ce que dit la reputation.
 */
export function stopPointAdvice(
  trajectory: Trajectory,
  seasons: NormalizedSeasons,
  totalRuntimeMinutes: number | undefined,
  episodeCount: number,
): StopPointAdvice | undefined {
  const afterSeason = trajectory.suggestedStopAfter;
  if (afterSeason === undefined || totalRuntimeMinutes === undefined || episodeCount <= 0) {
    return undefined;
  }

  const kept = episodesThrough(seasons.rateable, afterSeason);
  const saving = 1 - kept / episodeCount;
  if (saving < MIN_STOP_POINT_SAVING) return undefined;

  return {
    afterSeason,
    shortenedMinutes: (kept / episodeCount) * totalRuntimeMinutes,
    fullMinutes: totalRuntimeMinutes,
  };
}

/**
 * Pays pour lequel la disponibilite est demandee.
 *
 * La disponibilite est **toujours** nationale : afficher celle d'un autre pays serait
 * pire que ne rien afficher.
 *
 * ⚠️ **C'est le repli le plus fragile du produit, et il faut le dire.** Deduire le pays
 * de la langue est faux par construction : un anglophone n'est pas americain, un
 * francophone n'est ni belge ni canadien par defaut. Tant qu'il n'y a ni compte ni
 * preference, ce repli sert a ne pas afficher une page vide — il ne sert pas a etre
 * juste. La preference explicite (`MyPlatforms`, puis le compte) est ce qui le remplace.
 */
const DEFAULT_WATCH_REGION = watchRegion(DEFAULT_LOCALE);

/**
 * Ou regarder une serie.
 *
 * Complete la decision que le reste de la page prepare : « 62 h, decroche en saison 5,
 * et c'est sur Netflix » repond a la question entiere. Sans ce dernier element, le
 * visiteur doit aller ailleurs pour agir.
 *
 * Degrade en liste vide : une serie indisponible dans le pays est le cas courant, pas
 * une erreur.
 */
export async function watchOptions(
  id: string,
  region: string = DEFAULT_WATCH_REGION,
): Promise<readonly WatchOption[]> {
  try {
    // Pas de langue dans la cle : ce que renvoie cet appel est une liste de marques,
    // que TMDB ne traduit pas. Y ajouter la locale doublerait le cache pour rien.
    return await throughWatch(`${id}:${region}`, () =>
      getProvider().watchOptions(id, region),
    );
  } catch {
    return [];
  }
}

/** Une note d'episode destinee a la grille. */
export interface EpisodeRating {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title?: string;
  readonly voteAverage: number;
  readonly voteCount: number;
}

/** Une saison et ses episodes notes. */
export interface SeasonRatings {
  readonly seasonNumber: number;
  readonly episodes: readonly EpisodeRating[];
}

/**
 * Plafond d'episodes charges pour la grille.
 *
 * *Detective Conan* compte plus de mille episodes : une grille de cette taille est
 * illisible **et** hors budget. On s'arrete aux saisons qui tiennent a l'ecran.
 */
const MAX_SEASONS_FOR_GRID = 15;

/**
 * Notes episode par episode, pour la grille.
 *
 * Reutilise exactement le meme cache que la trajectoire — `throughSeason` —, donc
 * afficher les deux sur une page ne coute pas un appel de plus.
 */
export async function episodeRatings(
  id: string,
  seasons: NormalizedSeasons,
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly SeasonRatings[]> {
  const candidates = seasons.rateable.slice(0, MAX_SEASONS_FOR_GRID);

  const rows = await Promise.all(
    candidates.map(async (season) => {
      const seasonNumber = season.ref.seasonNumber;
      try {
        const full = await throughSeason(keyIn(locale, `${id}:${seasonNumber}`), () =>
          getProvider(locale).getSeason(id, seasonNumber),
        );
        const episodes = full.episodes
          .filter(
            (e): e is typeof e & { voteAverage: number; voteCount: number } =>
              e.voteAverage !== undefined &&
              e.voteAverage > 0 &&
              e.voteCount !== undefined,
          )
          .map((e) => ({
            seasonNumber,
            episodeNumber: e.episodeNumber,
            voteAverage: e.voteAverage,
            voteCount: e.voteCount,
            ...(e.title !== undefined ? { title: e.title } : {}),
          }))
          .sort((a, b) => a.episodeNumber - b.episodeNumber);
        return { seasonNumber, episodes };
      } catch {
        return { seasonNumber, episodes: [] };
      }
    }),
  );

  return rows.filter((r) => r.episodes.length > 0);
}

/**
 * Series populaires **en attente d'une suite**, les plus longues attentes d'abord.
 *
 * C'est la seule liste qui montre reellement ce que fait le produit. Les listes
 * « tendances » et « en cours de diffusion » ne contiennent, par construction, que
 * des series actives : verifie en ligne le 2026-08-01, les vingt-quatre vignettes
 * affichaient « en cours » ou « ep. dans N j », et pas une seule « en attente ·
 * N mois ». Le differenciateur etait invisible la ou les gens arrivent.
 *
 * Trier par attente decroissante n'est pas cosmetique : une serie muette depuis deux
 * ans est plus parlante qu'une autre en pause depuis trois mois.
 */
export async function waitingSeries(
  limit = 12,
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly SeriesWithStatus[]> {
  // Trois pages, pas deux : le filtrage de la vitrine retire une part des resultats,
  // et le tri par attente n'a d'interet que s'il a de quoi choisir.
  const pages = await Promise.all([
    discover('popular', 1, locale),
    discover('popular', 2, locale),
    discover('popular', 3, locale),
  ]);
  const hydrated = await withStatus(pages.flat(), now, locale);

  return hydrated
    .filter(
      (s) =>
        s.status?.status === 'between_seasons' || s.status?.status === 'awaiting_renewal',
    )
    .sort((a, b) => (b.status?.daysSinceLastAired ?? 0) - (a.status?.daysSinceLastAired ?? 0))
    .slice(0, limit);
}

/**
 * Les autres series des createurs d'une serie.
 *
 * Seul maillage interne du site, et il est **factuel** : « du meme createur » est un
 * credit de production, pas un calcul de similarite — ce qui le distingue de la
 * recommandation algorithmique, ecartee par `ROADMAP.md` §3.
 *
 * Repond aussi au dernier trou du canal d'acquisition : une page serie ne renvoyait
 * vers aucune autre, ce qui en faisait un cul-de-sac pour le visiteur comme pour le
 * crawl.
 *
 * Un appel par createur, mis en cache 24 h — et la plupart des series n'en declarent
 * qu'un, quand elles en declarent. Degrade en liste vide sans bruit : beaucoup de
 * series, surtout hors des Etats-Unis, n'ont aucun credit de creation.
 */
export async function alsoByCreators(
  detail: SeriesDetail,
  limit = 6,
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly SeriesSummary[]> {
  const creators = detail.creators ?? [];
  if (creators.length === 0) return [];

  const lists = await Promise.all(
    creators.slice(0, 2).map(async (creator) => {
      try {
        return await throughCreator(keyIn(locale, creator.providerId), () =>
          getProvider(locale).seriesByCreator(creator.providerId),
        );
      } catch {
        return [];
      }
    }),
  );

  const seen = new Set<string>([detail.providerId]);
  const out: SeriesSummary[] = [];
  for (const series of lists.flat()) {
    if (seen.has(series.providerId)) continue;
    // Meme regle de vitrine qu'ailleurs : on ne met pas en avant un journal televise.
    if (series.kind !== undefined && !isShowcased(series.kind)) continue;
    seen.add(series.providerId);
    out.push(series);
  }
  return out.slice(0, limit);
}

/** Tailles d'affiche proposees par le CDN de TMDB, avec leur largeur en pixels. */
const POSTER_SIZES = { w185: 185, w342: 342, w500: 500 } as const;
export type PosterSize = keyof typeof POSTER_SIZES;

/**
 * Rapport hauteur/largeur d'une affiche de serie : 3 pour 2.
 *
 * Constant chez TMDB, ce qui permet de **declarer les dimensions sans charger
 * l'image**. Sans elles, le navigateur ne reserve pas la place et la page saute quand
 * les affiches arrivent — un decalage de mise en page, l'un des trois indicateurs
 * que Google mesure, et donc une perte seche sur le canal d'acquisition n°1.
 */
const POSTER_ASPECT = 3 / 2;

/** URL d'une affiche sur le CDN de TMDB. Jamais servie par nous — `next.config.ts`. */
export function posterUrl(
  path: string | undefined,
  size: PosterSize = 'w342',
): string | undefined {
  if (path === undefined) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Dimensions a declarer pour une affiche, afin que le navigateur reserve la place. */
export function posterDimensions(size: PosterSize): { width: number; height: number } {
  const width = POSTER_SIZES[size];
  return { width, height: Math.round(width * POSTER_ASPECT) };
}

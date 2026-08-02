/**
 * Le journal personnel : ce que le produit retient de vous.
 *
 * Quatre des cinq ressorts qui font revenir sur un site de ce genre — progression
 * visible, collection, comparaison, decouverte de soi — supposent que le produit se
 * souvienne. Aucun n'etait possible : le site ne stockait rien.
 *
 * **Ce module ne connait ni navigateur ni base de donnees.** Il decrit la forme des
 * donnees et sait la lire de facon tolerante ; ou elles sont rangees ne le regarde pas
 * — c'est le role du port `src/journal/store.ts`. C'est ce qui permettra de passer du
 * stockage local a une base sans le reecrire. La forme retenue est exactement celle
 * qu'attend `docs/RATING-MODEL.md` §7 :
 *
 *   - la position est **un pointeur**, pas une collection de booleens ;
 *   - la cible d'une note est **polymorphe** (saison, episode, serie) ;
 *   - la decision est une entree **de plein droit**, pas un champ `status`.
 *
 * Lecture **tolerante**, comme pour le catalogue : une entree corrompue est ecartee,
 * jamais l'ensemble. Perdre tout un journal parce qu'une ligne est illisible serait la
 * pire trahison possible pour un produit qui demande d'y investir du temps.
 *
 * ---
 *
 * ## Version 2 — les trois decisions irreparables (2026-08-02)
 *
 * Prises sous la contrainte « multiplateforme, et de 1 a 100 000 utilisateurs » (A8).
 * Elles ne coutent rien aujourd'hui et sont impossibles a rattraper une fois qu'il
 * existe des journaux a preserver.
 *
 * 1. **Les entrees sont indexees par une cle prefixee du fournisseur** (`tmdb:1396`).
 *    La v1 utilisait l'identifiant TMDB nu, alors que `types.ts` ecrit noir sur blanc
 *    que les donnees utilisateur ne doivent jamais pointer un identifiant fournisseur.
 *    Un changement de catalogue — probable, `ROADMAP.md` §4.1 — devient un remappage
 *    au lieu d'une perte totale.
 * 2. **Chaque fait porte sa propre date, et la fusion se fait au niveau du champ.**
 *    Cinq appareils, c'est cinq journaux qui divergent. Fusionner document contre
 *    document perd le travail de l'un des deux ; fusionner champ par champ ne perd
 *    rien. Il faut pour cela que la date vive sur le fait, pas sur le document — et
 *    c'est ce qui ne peut pas s'ajouter apres coup : les dates manquantes des faits
 *    deja ecrits ne se devinent pas.
 * 3. **Une suppression laisse une trace datee** (`removed`). Sans elle, l'appareil qui
 *    a efface une note la voit revenir a la premiere synchronisation, ressuscitee par
 *    l'appareil qui l'ignorait. C'est le defaut classique des fusions naives, et il
 *    est indetectable sans jeu de donnees a deux appareils.
 */

import type { DecisionKind, SeriesId, Stars } from './types';

/** Version du format. Toute lecture d'une version inconnue repart de zero. */
export const JOURNAL_VERSION = 2;

/**
 * Fournisseur de catalogue dont proviennent les identifiants ecrits aujourd'hui.
 *
 * Vit ici, en un seul endroit, precisement pour que le jour ou il change on sache quoi
 * remapper (`ROADMAP.md` §4.1 — le barème de TheTVDB est plus previsible).
 */
export const CURRENT_PROVIDER = 'tmdb';

/**
 * Cle d'une entree de journal : `<fournisseur>:<identifiant>`.
 *
 * Jamais un identifiant nu. Voir la decision n°1 en tete de module.
 */
export type JournalKey = string;

/** Fabrique la cle d'une serie. Le seul endroit ou l'on colle un prefixe. */
export function journalKey(providerId: SeriesId, provider = CURRENT_PROVIDER): JournalKey {
  return `${provider}:${providerId}`;
}

/** Decompose une cle. Rend `undefined` si elle n'a pas la forme attendue. */
export function parseJournalKey(
  key: JournalKey,
): { readonly provider: string; readonly providerId: string } | undefined {
  const at = key.indexOf(':');
  if (at <= 0 || at === key.length - 1) return undefined;
  return { provider: key.slice(0, at), providerId: key.slice(at + 1) };
}

/** Ou en est l'utilisateur dans une serie. */
export interface JournalPosition {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** ISO 8601. Une chaine et non une `Date` : c'est ce qui se serialise. */
  readonly declaredAt: string;
}

/** Une note posee par l'utilisateur. */
export interface JournalRating {
  readonly stars: Stars;
  readonly at: string;
}

/** Ce que l'utilisateur a decide de faire de la serie. */
export interface JournalDecision {
  readonly kind: DecisionKind;
  readonly at: string;
  readonly atSeason?: number;
  readonly atEpisode?: number;
}

/** « Je veux la voir » — le premier geste possible, et le seul qui ne suppose rien. */
export interface JournalWanted {
  readonly at: string;
}

/**
 * Ce qu'il faut pour dessiner une vignette **sans un seul appel reseau**.
 *
 * ⚠️ Ce sont des **metadonnees du catalogue**, et le plafond contractuel de six mois
 * (`AGENTS.md` regle 1) ne connait pas la frontiere entre serveur et navigateur. Elles
 * sont donc datees et **expirees a la lecture** par {@link SNAPSHOT_TTL_MS}, exactement
 * comme `src/catalog/cache.ts` le fait cote serveur : le plafond est applique **par le
 * code**, jamais par une consigne.
 *
 * C'est aussi ce qui rend `/moi` tenable a 100 000 utilisateurs : rafraichir trente
 * series a chaque visite couterait des millions d'appels par jour, lire un instantane
 * local en coute zero.
 */
export interface JournalSnapshot {
  readonly title: string;
  readonly posterPath?: string;
  /** Statut reel, deja mis en forme — le domaine n'a pas a le recalculer sans donnees. */
  readonly statusLabel?: string;
  /** Date du prochain episode annonce, ISO 8601. C'est elle qui fait « Ca revient ». */
  readonly nextEpisodeAt?: string;
  readonly cachedAt: string;
}

/**
 * Duree de vie d'un instantane : trente jours.
 *
 * Tres en deca du plafond contractuel de six mois — un titre ne change pas, mais un
 * statut et une date de diffusion, si. Passe ce delai l'instantane est ignore : la
 * vignette disparait de `/moi` jusqu'a la prochaine visite de la page serie, ce qui est
 * preferable a l'affichage d'une information peremptoire.
 */
export const SNAPSHOT_TTL_MS = 30 * 86_400_000;

/**
 * Ce qui a ete supprime, et quand.
 *
 * Cles canoniques : `season:3`, `episode:3:7`, `decision`, `wanted`. Voir la decision
 * n°3 en tete de module — sans ces traces, une suppression ne survit pas a une fusion.
 */
export type JournalTombstones = Readonly<Record<string, string>>;

/**
 * Duree de vie d'une trace de suppression : quatre-vingt-dix jours.
 *
 * Il faut bien qu'elles disparaissent, sans quoi le journal grossit de tout ce qu'il
 * n'a plus. Passe ce delai, l'appareil qui portait la valeur effacee l'a forcement
 * synchronisee ou abandonnee — et le pire cas restant, une note qui revient apres trois
 * mois de silence, ne vaut pas de conserver eternellement des entrees vides.
 */
export const TOMBSTONE_TTL_MS = 90 * 86_400_000;

/** Tout ce que l'on retient d'une serie. */
export interface JournalEntry {
  readonly position?: JournalPosition;
  /** Notes de saison, indexees par numero de saison. */
  readonly seasonRatings?: Readonly<Record<string, JournalRating>>;
  /**
   * Notes d'episode, indexees par `saison:episode`.
   *
   * Arbitrage A7 (2026-08-02), contraire a `docs/RATING-MODEL.md` §3 couche 2 et
   * assume comme tel : la note d'episode est **strictement facultative**, et la saison
   * reste l'unite de trajectoire — une note d'episode ne deforme jamais la courbe.
   */
  readonly episodeRatings?: Readonly<Record<string, JournalRating>>;
  readonly decision?: JournalDecision;
  readonly wanted?: JournalWanted;
  readonly snapshot?: JournalSnapshot;
  readonly removed?: JournalTombstones;
}

export interface Journal {
  readonly version: number;
  /**
   * Identifiant local de l'appareil, anonyme et jamais envoye nulle part aujourd'hui.
   *
   * Il ne sert a rien tant qu'il n'y a qu'un appareil — c'est justement pour cela
   * qu'il faut l'ecrire maintenant : le jour ou deux journaux fusionnent, savoir d'ou
   * vient quoi n'est plus reconstituable.
   */
  readonly deviceId?: string;
  /** Services auxquels l'utilisateur est abonne, pour « dispo chez vous ». */
  readonly platforms?: readonly string[];
  readonly entries: Readonly<Record<JournalKey, JournalEntry>>;
}

export const EMPTY_JOURNAL: Journal = { version: JOURNAL_VERSION, entries: {} };

/** Cle canonique d'une note d'episode. */
export function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}:${episodeNumber}`;
}

// ---------------------------------------------------------------------------
// Lecture tolerante
// ---------------------------------------------------------------------------

const VALID_STARS: ReadonlySet<number> = new Set([
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
]);

const VALID_DECISIONS: ReadonlySet<string> = new Set([
  'continuing',
  'paused',
  'abandoned',
  'completed',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPositiveInt(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/** Une date lisible, ou l'instant present : mieux vaut une date approximative que rien. */
function readInstant(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function readText(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePosition(raw: unknown, now: string): JournalPosition | undefined {
  const source = asRecord(raw);
  const seasonNumber = readPositiveInt(source, 'seasonNumber');
  const episodeNumber = readPositiveInt(source, 'episodeNumber');
  if (seasonNumber === undefined || episodeNumber === undefined) return undefined;
  return {
    seasonNumber,
    episodeNumber,
    declaredAt: readInstant(source, 'declaredAt', now),
  };
}

function parseRating(raw: unknown, now: string): JournalRating | undefined {
  const source = asRecord(raw);
  const stars = source['stars'];
  if (typeof stars !== 'number' || !VALID_STARS.has(stars)) return undefined;
  return { stars: stars as Stars, at: readInstant(source, 'at', now) };
}

function parseDecision(raw: unknown, now: string): JournalDecision | undefined {
  const source = asRecord(raw);
  const kind = source['kind'];
  if (typeof kind !== 'string' || !VALID_DECISIONS.has(kind)) return undefined;

  const atSeason = readPositiveInt(source, 'atSeason');
  const atEpisode = readPositiveInt(source, 'atEpisode');
  return {
    kind: kind as DecisionKind,
    at: readInstant(source, 'at', now),
    ...(atSeason !== undefined ? { atSeason } : {}),
    ...(atEpisode !== undefined ? { atEpisode } : {}),
  };
}

function parseSnapshot(raw: unknown, now: string): JournalSnapshot | undefined {
  const source = asRecord(raw);
  const title = readText(source, 'title');
  if (title === undefined) return undefined;

  const posterPath = readText(source, 'posterPath');
  const statusLabel = readText(source, 'statusLabel');
  const nextEpisodeAt = readText(source, 'nextEpisodeAt');
  return {
    title,
    cachedAt: readInstant(source, 'cachedAt', now),
    ...(posterPath !== undefined ? { posterPath } : {}),
    ...(statusLabel !== undefined ? { statusLabel } : {}),
    ...(nextEpisodeAt !== undefined ? { nextEpisodeAt } : {}),
  };
}

function parseRatings(
  raw: unknown,
  now: string,
  keyPattern: RegExp,
): Record<string, JournalRating> {
  const out: Record<string, JournalRating> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!keyPattern.test(key)) continue;
    const rating = parseRating(value, now);
    if (rating !== undefined) out[key] = rating;
  }
  return out;
}

const SEASON_KEY = /^[0-9]+$/;
const EPISODE_KEY = /^[0-9]+:[0-9]+$/;

/**
 * Lit les traces de suppression, en **purgeant celles qui ont fait leur temps**.
 *
 * La purge vit ici, a la lecture, pour la meme raison que l'expiration des
 * instantanes : un journal peut dormir des mois dans un navigateur ferme, et il n'y a
 * aucune tache de fond pour faire le menage.
 */
function parseTombstones(raw: unknown, now: Date): JournalTombstones {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (typeof value !== 'string') continue;
    const age = now.getTime() - new Date(value).getTime();
    if (Number.isNaN(age) || age > TOMBSTONE_TTL_MS) continue;
    out[key] = value;
  }
  return out;
}

function parseEntry(raw: unknown, now: string, at: Date): JournalEntry | undefined {
  const source = asRecord(raw);

  const position = parsePosition(source['position'], now);
  const decision = parseDecision(source['decision'], now);
  const snapshot = parseSnapshot(source['snapshot'], now);
  const seasonRatings = parseRatings(source['seasonRatings'], now, SEASON_KEY);
  const episodeRatings = parseRatings(source['episodeRatings'], now, EPISODE_KEY);
  const removed = parseTombstones(source['removed'], at);

  const wantedSource = source['wanted'];
  const wanted =
    wantedSource !== undefined && wantedSource !== null
      ? { at: readInstant(asRecord(wantedSource), 'at', now) }
      : undefined;

  const entry: JournalEntry = {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(wanted !== undefined ? { wanted } : {}),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(Object.keys(seasonRatings).length > 0 ? { seasonRatings } : {}),
    ...(Object.keys(episodeRatings).length > 0 ? { episodeRatings } : {}),
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
  };

  return worthKeeping(entry) ? entry : undefined;
}

/**
 * Une entree porte-t-elle quelque chose que l'utilisateur reconnaitrait comme sien ?
 *
 * Un instantane seul ne compte pas : ce n'est qu'un cache de vignette. Une trace de
 * suppression non plus — elle dit ce qui n'est **plus** la.
 *
 * C'est ce predicat qui gouverne l'**affichage** et les derivations.
 */
export function hasContent(entry: JournalEntry | undefined): boolean {
  if (entry === undefined) return false;
  return (
    entry.position !== undefined ||
    entry.decision !== undefined ||
    entry.wanted !== undefined ||
    Object.keys(entry.seasonRatings ?? {}).length > 0 ||
    Object.keys(entry.episodeRatings ?? {}).length > 0
  );
}

/**
 * Faut-il conserver cette entree dans le journal ?
 *
 * Distinct de {@link hasContent}, et la distinction n'est pas cosmetique : **une
 * entree reduite a sa trace de suppression doit survivre**. Sans elle, retirer sa
 * derniere note effacerait l'entree — donc la trace avec — et la note reviendrait
 * telle quelle a la premiere fusion avec un appareil qui l'ignorait. La suppression
 * serait annulee par la synchronisation, ce qui est exactement le defaut que les
 * traces existent pour empecher.
 *
 * Les traces finissent par expirer ({@link TOMBSTONE_TTL_MS}), et l'entree vide
 * disparait alors d'elle-meme a la lecture suivante.
 */
function worthKeeping(entry: JournalEntry): boolean {
  return hasContent(entry) || Object.keys(entry.removed ?? {}).length > 0;
}

/**
 * Migration v1 → v2 : les cles nues deviennent des cles prefixees.
 *
 * La v1 indexait par identifiant TMDB brut. On ne peut pas deviner autre chose que
 * TMDB — c'etait le seul fournisseur — donc la migration est sure.
 */
function migrateKey(key: string): JournalKey {
  return parseJournalKey(key) !== undefined ? key : journalKey(key);
}

/**
 * Lit un journal serialise.
 *
 * Ne leve jamais. Une entree illisible est ecartee, les autres survivent : perdre tout
 * un journal parce qu'une ligne est corrompue serait indefendable.
 *
 * @param now instant de repli pour les dates manquantes, injecte pour les tests.
 */
export function parseJournal(raw: string | null | undefined, now = new Date()): Journal {
  if (raw === null || raw === undefined || raw.trim().length === 0) return EMPTY_JOURNAL;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return EMPTY_JOURNAL;
  }

  const source = asRecord(decoded);
  const version = source['version'];
  // Une version future est plus dangereuse qu'un journal vide : on ne devine pas la
  // forme d'un format qu'on ne connait pas. Une version passee, en revanche, se migre.
  if (typeof version !== 'number' || version < 1 || version > JOURNAL_VERSION) {
    return EMPTY_JOURNAL;
  }

  const stamp = now.toISOString();
  const entries: Record<JournalKey, JournalEntry> = {};
  for (const [key, value] of Object.entries(asRecord(source['entries']))) {
    if (key.length === 0) continue;
    const entry = parseEntry(value, stamp, now);
    if (entry !== undefined) entries[migrateKey(key)] = entry;
  }

  const deviceId = readText(source, 'deviceId');
  const rawPlatforms = source['platforms'];
  const platforms = Array.isArray(rawPlatforms)
    ? rawPlatforms.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];

  return {
    version: JOURNAL_VERSION,
    entries,
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(platforms.length > 0 ? { platforms } : {}),
  };
}

/** Serialise un journal. Format stable — c'est aussi le format d'export. */
export function serializeJournal(journal: Journal): string {
  return JSON.stringify({
    version: JOURNAL_VERSION,
    ...(journal.deviceId !== undefined ? { deviceId: journal.deviceId } : {}),
    ...(journal.platforms !== undefined && journal.platforms.length > 0
      ? { platforms: journal.platforms }
      : {}),
    entries: journal.entries,
  });
}

// ---------------------------------------------------------------------------
// Ecritures
// ---------------------------------------------------------------------------

function withEntry(journal: Journal, key: JournalKey, entry: JournalEntry): Journal {
  const entries = { ...journal.entries };
  if (worthKeeping(entry)) {
    entries[key] = entry;
  } else {
    // Une entree vide n'a pas a encombrer le journal ni son export.
    delete entries[key];
  }
  return { ...journal, version: JOURNAL_VERSION, entries };
}

/** Marque un champ comme supprime a une date donnee. Voir la decision n°3. */
function withTombstone(entry: JournalEntry, field: string, at: string): JournalTombstones {
  return { ...(entry.removed ?? {}), [field]: at };
}

/** Retire une pierre tombale devenue caduque — le champ vient d'etre re-ecrit. */
function withoutTombstone(entry: JournalEntry, field: string): JournalTombstones | undefined {
  if (entry.removed === undefined || !(field in entry.removed)) return entry.removed;
  const { [field]: _dropped, ...rest } = entry.removed;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function reviseTombstone(
  entry: JournalEntry,
  field: string,
): { readonly removed?: JournalTombstones } {
  const removed = withoutTombstone(entry, field);
  return removed !== undefined ? { removed } : {};
}

/**
 * Declare ou l'on en est.
 *
 * **Un pointeur, pas quarante-sept cases a cocher** (`docs/RATING-MODEL.md` §3,
 * couche 0) : tout ce qui precede est implicitement vu. C'est le seul remede realiste
 * a la friction qui tue les trackers.
 */
export function setPosition(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  episodeNumber: number,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  return withEntry(journal, key, {
    ...entry,
    position: { seasonNumber, episodeNumber, declaredAt: now.toISOString() },
  });
}

/** Note une saison. `undefined` retire la note. */
export function setSeasonRating(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  stars: Stars | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const field = `season:${seasonNumber}`;
  const seasonRatings = { ...(entry.seasonRatings ?? {}) };

  if (stars === undefined) {
    delete seasonRatings[String(seasonNumber)];
    return withEntry(journal, key, {
      ...entry,
      seasonRatings,
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  seasonRatings[String(seasonNumber)] = { stars, at: now.toISOString() };
  return withEntry(journal, key, {
    ...entry,
    seasonRatings,
    ...reviseTombstone(entry, field),
  });
}

/**
 * Note un episode. `undefined` retire la note.
 *
 * Arbitrage A7 : contraire a la recommandation de `docs/RATING-MODEL.md` §3 couche 2,
 * et acte. La contrepartie exigee est tenue ailleurs — le geste coute un tap depuis la
 * grille, rien ne reclame la completude, et la trajectoire continue de se calculer sur
 * les seules notes de saison.
 */
export function setEpisodeRating(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  episodeNumber: number,
  stars: Stars | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const cell = episodeKey(seasonNumber, episodeNumber);
  const field = `episode:${cell}`;
  const episodeRatings = { ...(entry.episodeRatings ?? {}) };

  if (stars === undefined) {
    delete episodeRatings[cell];
    return withEntry(journal, key, {
      ...entry,
      episodeRatings,
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  episodeRatings[cell] = { stars, at: now.toISOString() };
  return withEntry(journal, key, {
    ...entry,
    episodeRatings,
    ...reviseTombstone(entry, field),
  });
}

/** Enregistre une decision : continuer, mettre en pause, abandonner, avoir fini. */
export function setDecision(
  journal: Journal,
  key: JournalKey,
  kind: DecisionKind | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  if (kind === undefined) {
    const { decision: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, 'decision', now.toISOString()),
    });
  }

  // Le point exact ou la decision est prise est ce qui a de la valeur : c'est lui qui
  // fera la carte des abandons (`docs/RATING-MODEL.md` §7.4).
  const at = entry.position;
  return withEntry(journal, key, {
    ...entry,
    decision: {
      kind,
      at: now.toISOString(),
      ...(at !== undefined
        ? { atSeason: at.seasonNumber, atEpisode: at.episodeNumber }
        : {}),
    },
    ...reviseTombstone(entry, 'decision'),
  });
}

/**
 * « Je veux la voir. »
 *
 * Le premier geste possible, et le seul qui ne suppose **rien** — ni d'avoir commence,
 * ni d'avoir un avis. Il manquait : le produit n'offrait aucune prise a qui decouvre
 * une serie, c'est-a-dire a la quasi-totalite des arrivants.
 */
export function setWanted(
  journal: Journal,
  key: JournalKey,
  wanted: boolean,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  if (!wanted) {
    const { wanted: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, 'wanted', now.toISOString()),
    });
  }
  return withEntry(journal, key, {
    ...entry,
    wanted: { at: now.toISOString() },
    ...reviseTombstone(entry, 'wanted'),
  });
}

/**
 * Memorise de quoi dessiner la vignette, si l'entree existe deja.
 *
 * **N'en cree jamais une** : sans cela, visiter une page serie suffirait a remplir le
 * journal de series auxquelles on n'a pas touche — et a constituer, page apres page,
 * une base de metadonnees TMDB que le contrat interdit.
 */
export function setSnapshot(
  journal: Journal,
  key: JournalKey,
  snapshot: Omit<JournalSnapshot, 'cachedAt'>,
  now = new Date(),
): Journal {
  const entry = journal.entries[key];
  if (entry === undefined) return journal;
  return withEntry(journal, key, {
    ...entry,
    snapshot: { ...snapshot, cachedAt: now.toISOString() },
  });
}

/** Declare les services auxquels on est abonne. */
export function setPlatforms(
  journal: Journal,
  platforms: readonly string[],
): Journal {
  return { ...journal, version: JOURNAL_VERSION, platforms: [...platforms] };
}

/** Attache un identifiant d'appareil s'il n'y en a pas encore. */
export function withDeviceId(journal: Journal, deviceId: string): Journal {
  if (journal.deviceId !== undefined) return journal;
  return { ...journal, deviceId };
}

// ---------------------------------------------------------------------------
// Lectures derivees
// ---------------------------------------------------------------------------

/**
 * L'instantane d'une entree, s'il est encore valable.
 *
 * L'expiration est appliquee **ici**, a la lecture, et pas au moment de l'ecriture :
 * un journal peut dormir des mois dans un navigateur ferme. C'est la seule facon de
 * garantir le plafond contractuel sans tache de fond.
 */
export function freshSnapshot(
  entry: JournalEntry | undefined,
  now: Date = new Date(),
): JournalSnapshot | undefined {
  const snapshot = entry?.snapshot;
  if (snapshot === undefined) return undefined;
  const age = now.getTime() - new Date(snapshot.cachedAt).getTime();
  if (Number.isNaN(age) || age > SNAPSHOT_TTL_MS) return undefined;
  return snapshot;
}

/** Les notes de saison d'une serie, sous la forme qu'attend le moteur de trajectoire. */
export function seasonScoresOf(
  journal: Journal,
  key: JournalKey,
): readonly { seasonNumber: number; stars: number }[] {
  const ratings = journal.entries[key]?.seasonRatings ?? {};
  return Object.entries(ratings)
    .map(([season, rating]) => ({ seasonNumber: Number(season), stars: rating.stars }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

/**
 * Moyenne des notes d'episode d'une saison, arrondie au demi-point.
 *
 * **Une suggestion, jamais une ecriture** (`AGENTS.md` regle 8 : on signale, on ne
 * repare pas en silence). Quelqu'un qui note six episodes d'une saison a manifestement
 * un avis sur la saison ; le lui proposer est utile, le decider a sa place ne l'est pas.
 */
export function suggestedSeasonRating(
  entry: JournalEntry | undefined,
  seasonNumber: number,
): Stars | undefined {
  const ratings = entry?.episodeRatings ?? {};
  const values = Object.entries(ratings)
    .filter(([cell]) => cell.startsWith(`${seasonNumber}:`))
    .map(([, rating]) => rating.stars);

  if (values.length === 0) return undefined;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const rounded = Math.round(mean * 2) / 2;
  return Math.min(5, Math.max(0.5, rounded)) as Stars;
}

// ---------------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------------

function laterOf<T>(
  a: T | undefined,
  b: T | undefined,
  dateOf: (value: T) => string,
): T | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return new Date(dateOf(b)).getTime() > new Date(dateOf(a)).getTime() ? b : a;
}

/** Une valeur datee survit-elle a la pierre tombale qui la vise ? */
function survives(at: string | undefined, tombstone: string | undefined): boolean {
  if (at === undefined) return false;
  if (tombstone === undefined) return true;
  return new Date(at).getTime() >= new Date(tombstone).getTime();
}

function mergeRatings(
  a: Readonly<Record<string, JournalRating>> | undefined,
  b: Readonly<Record<string, JournalRating>> | undefined,
  removed: JournalTombstones,
  field: (key: string) => string,
): Record<string, JournalRating> {
  const out: Record<string, JournalRating> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const winner = laterOf(a?.[key], b?.[key], (r) => r.at);
    if (winner !== undefined && survives(winner.at, removed[field(key)])) {
      out[key] = winner;
    }
  }
  return out;
}

function mergeTombstones(a: JournalTombstones, b: JournalTombstones): JournalTombstones {
  const out: Record<string, string> = { ...a };
  for (const [field, at] of Object.entries(b)) {
    const current = out[field];
    if (current === undefined || new Date(at).getTime() > new Date(current).getTime()) {
      out[field] = at;
    }
  }
  return out;
}

function mergeEntries(a: JournalEntry, b: JournalEntry): JournalEntry {
  const removed = mergeTombstones(a.removed ?? {}, b.removed ?? {});

  const position = laterOf(a.position, b.position, (p) => p.declaredAt);
  const decisionWinner = laterOf(a.decision, b.decision, (d) => d.at);
  const decision = survives(decisionWinner?.at, removed['decision'])
    ? decisionWinner
    : undefined;
  const wantedWinner = laterOf(a.wanted, b.wanted, (w) => w.at);
  const wanted = survives(wantedWinner?.at, removed['wanted']) ? wantedWinner : undefined;
  const snapshot = laterOf(a.snapshot, b.snapshot, (s) => s.cachedAt);

  const seasonRatings = mergeRatings(
    a.seasonRatings,
    b.seasonRatings,
    removed,
    (k) => `season:${k}`,
  );
  const episodeRatings = mergeRatings(
    a.episodeRatings,
    b.episodeRatings,
    removed,
    (k) => `episode:${k}`,
  );

  return {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(wanted !== undefined ? { wanted } : {}),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(Object.keys(seasonRatings).length > 0 ? { seasonRatings } : {}),
    ...(Object.keys(episodeRatings).length > 0 ? { episodeRatings } : {}),
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
  };
}

/**
 * Fusionne deux journaux, **champ par champ**.
 *
 * C'est la decision n°2 en tete de module, et la raison d'etre des dates portees par
 * chaque fait. Fusionner document contre document — « le plus recent gagne » applique
 * au journal entier — perdrait tout le travail de l'appareil le moins recemment
 * touche : noter une saison sur le telephone effacerait la position posee sur
 * l'ordinateur le matin meme.
 *
 * Sert deja aujourd'hui, sans aucun compte : c'est l'import de fichier qui **complete**
 * un journal existant au lieu de l'ecraser. Servira tel quel a la synchronisation.
 */
export function mergeJournals(a: Journal, b: Journal): Journal {
  const entries: Record<JournalKey, JournalEntry> = {};
  const keys = new Set([...Object.keys(a.entries), ...Object.keys(b.entries)]);

  for (const key of keys) {
    const left = a.entries[key];
    const right = b.entries[key];
    const merged =
      left === undefined ? right : right === undefined ? left : mergeEntries(left, right);
    if (merged !== undefined && worthKeeping(merged)) entries[key] = merged;
  }

  // Les plateformes ne sont pas datees : on garde la liste la plus fournie plutot que
  // d'en perdre. Une preference declaree deux fois n'a jamais fait de mal.
  const platforms = [
    ...new Set([...(a.platforms ?? []), ...(b.platforms ?? [])]),
  ];

  return {
    version: JOURNAL_VERSION,
    entries,
    // L'appareil local garde son identite : c'est *son* journal qui accueille l'autre.
    ...(a.deviceId !== undefined ? { deviceId: a.deviceId } : {}),
    ...(platforms.length > 0 ? { platforms } : {}),
  };
}

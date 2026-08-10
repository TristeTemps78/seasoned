/**
 * Le journal — **la lecture tolerante et l'ecriture du document**.
 *
 * Son contrat tient en deux phrases, et elles sont testables comme telles :
 *
 *   1. `parseJournal(serializeJournal(j))` rend `j` — **rien ne se perd a l'aller-retour**,
 *      y compris ce que cette version du code ne sait pas lire ;
 *   2. **aucune entree ne fait lever**, quelle que soit sa forme.
 *
 * Tant que ces deux phrases tiennent, le detail de chaque champ est une consequence.
 */

import { parseRealStatus } from '../status';
import type { SeasonSize } from '../remaining';
import type { DecisionKind, Stars } from '../types';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  journalKey,
  parseJournalKey,
  TOMBSTONE_TTL_MS,
  type FactOrigin,
  type Journal,
  type JournalCompletion,
  type JournalDecision,
  type JournalEntry,
  type JournalEpisodeMark,
  type JournalKey,
  type JournalPosition,
  type JournalRating,
  type JournalReview,
  type JournalSnapshot,
  type JournalTombstones,
} from './types';
import { dedupeByDay, worthKeeping } from './entry';

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

/**
 * Date de repli d'un **fait** dont la date est absente ou illisible.
 *
 * ## Pourquoi l'epoch et surtout pas l'instant present
 *
 * C'etait `new Date()` — l'horloge de **celui qui lit**. Tant qu'il n'y a qu'un
 * appareil, cela ne se voit pas. Des qu'il y en a deux, c'est une corruption
 * silencieuse : deux appareils lisant **le meme** journal donnent au meme fait deux
 * dates differentes, et la fusion tranche alors au hasard de qui a ouvert l'application
 * en dernier. Un fait sans date ne devient pas plus recent parce qu'on le relit.
 *
 * L'epoch dit la seule chose vraie : « ce fait existe, on ne sait pas quand ». Il perd
 * donc contre n'importe quelle date connue — ce qui est le bon arbitrage, puisqu'une
 * date connue est une information et son absence n'en est pas une.
 *
 * L'horloge de lecture reste legitime pour l'**expiration** (pierres tombales,
 * instantanes) : la question n'y est pas « quand est-ce arrive » mais « est-ce encore
 * valable maintenant ».
 */
const UNDATED = new Date(0).toISOString();

/** Une date lisible, ou la date de repli. */
function readInstant(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function readText(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * La provenance d'un fait (9.0).
 *
 * 🔴 **Sans cette lecture, la marque serait ecrite puis effacee a la premiere
 * sauvegarde** : {@link parseEntry} reconstruit un objet neuf champ par champ, et le
 * pass-through de la decision n°4 protege les champs **d'entree** inconnus, pas ceux
 * niches dans un champ connu. C'est la quatrieme occurrence de « un champ qui existe n'est
 * pas un champ qui est ecrit », et la loi d'aller-retour de `tests/journal-origin.test.ts`
 * est ce qui la rend impossible a refaire ici.
 *
 * ⚠️ Une valeur inconnue est **ecartee** (regle 4) : le fait redevient « pose a la main »
 * pour ce client-ci. C'est un arbitrage, pas une evidence — la conserver comme « import »
 * ferait disparaitre des agregats les faits qu'ecrira un jour notre extension (5.20),
 * lesquels sont **vecus**. On prefere donc l'erreur qui compte un fait vecu que celle qui
 * en efface un.
 */
function readOrigin(source: Record<string, unknown>): FactOrigin | undefined {
  return source['origin'] === 'import' ? 'import' : undefined;
}

function parsePosition(raw: unknown): JournalPosition | undefined {
  const source = asRecord(raw);
  const seasonNumber = readPositiveInt(source, 'seasonNumber');
  const episodeNumber = readPositiveInt(source, 'episodeNumber');
  if (seasonNumber === undefined || episodeNumber === undefined) return undefined;
  const origin = readOrigin(source);
  return {
    seasonNumber,
    episodeNumber,
    declaredAt: readInstant(source, 'declaredAt', UNDATED),
    ...(origin !== undefined ? { origin } : {}),
  };
}

function parseRating(raw: unknown): JournalRating | undefined {
  const source = asRecord(raw);
  const stars = source['stars'];
  if (typeof stars !== 'number' || !VALID_STARS.has(stars)) return undefined;
  const origin = readOrigin(source);
  return {
    stars: stars as Stars,
    at: readInstant(source, 'at', UNDATED),
    ...(origin !== undefined ? { origin } : {}),
  };
}

function parseDecision(raw: unknown): JournalDecision | undefined {
  const source = asRecord(raw);
  const kind = source['kind'];
  if (typeof kind !== 'string' || !VALID_DECISIONS.has(kind)) return undefined;

  const atSeason = readPositiveInt(source, 'atSeason');
  const atEpisode = readPositiveInt(source, 'atEpisode');
  const origin = readOrigin(source);
  return {
    kind: kind as DecisionKind,
    at: readInstant(source, 'at', UNDATED),
    ...(atSeason !== undefined ? { atSeason } : {}),
    ...(atEpisode !== undefined ? { atEpisode } : {}),
    ...(origin !== undefined ? { origin } : {}),
  };
}

function parseSnapshot(raw: unknown): JournalSnapshot | undefined {
  const source = asRecord(raw);
  const title = readText(source, 'title');
  if (title === undefined) return undefined;

  const posterPath = readText(source, 'posterPath');
  const status = parseRealStatus(source['status']);
  const statusLabel = readText(source, 'statusLabel');
  const nextEpisodeAt = readText(source, 'nextEpisodeAt');
  const rawEpisodeMinutes = source['episodeMinutes'];
  const episodeMinutes =
    typeof rawEpisodeMinutes === 'number' &&
    Number.isFinite(rawEpisodeMinutes) &&
    rawEpisodeMinutes > 0
      ? rawEpisodeMinutes
      : undefined;
  const rawPublic = source['publicStars'];
  const publicStars =
    typeof rawPublic === 'number' && rawPublic > 0 && rawPublic <= 5 ? rawPublic : undefined;
  const seasonSizes = parseSeasonSizes(source['seasonSizes']);
  return {
    title,
    // Un instantane sans date lisible est traite comme perime, donc jete a la premiere
    // lecture. C'est volontairement severe : le considerer frais reviendrait a garder
    // une metadonnee du catalogue sans savoir depuis quand — soit exactement ce que le
    // plafond contractuel de six mois interdit. Il se redepose
    // seul a la visite suivante.
    cachedAt: readInstant(source, 'cachedAt', UNDATED),
    ...(posterPath !== undefined ? { posterPath } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(statusLabel !== undefined ? { statusLabel } : {}),
    ...(nextEpisodeAt !== undefined ? { nextEpisodeAt } : {}),
    ...(episodeMinutes !== undefined ? { episodeMinutes } : {}),
    ...(seasonSizes !== undefined ? { seasonSizes } : {}),
    ...(publicStars !== undefined ? { publicStars } : {}),
  };
}

/**
 * Les tailles de saisons, lues sans jamais lever.
 *
 * Une saison mal formee est **ecartee seule** : perdre le decoupage entier parce qu'une
 * ligne sur douze est illisible couterait bien plus que la ligne.
 * Une liste qui ne contient rien d'exploitable rend `undefined` plutot qu'un tableau vide,
 * pour que « je n'ai pas l'information » reste distinct de « la serie n'a aucune saison ».
 */
function parseSeasonSizes(raw: unknown): readonly SeasonSize[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const sizes: SeasonSize[] = [];
  for (const item of raw) {
    const source = asRecord(item);
    const seasonNumber = readPositiveInt(source, 'seasonNumber');
    const episodeCount = readPositiveInt(source, 'episodeCount');
    // Une saison a zero episode n'apporte rien a un compte et brouille la distinction
    // ci-dessus : elle est ecartee comme une ligne illisible.
    if (seasonNumber === undefined || episodeCount === undefined || episodeCount === 0) {
      continue;
    }
    sizes.push({ seasonNumber, episodeCount });
  }

  return sizes.length > 0 ? sizes : undefined;
}

function parseRatings(raw: unknown, keyPattern: RegExp): Record<string, JournalRating> {
  const out: Record<string, JournalRating> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!keyPattern.test(key)) continue;
    const rating = parseRating(value);
    if (rating !== undefined) out[key] = rating;
  }
  return out;
}

function parseEpisodeMarks(raw: unknown): Record<string, JournalEpisodeMark> {
  const out: Record<string, JournalEpisodeMark> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!EPISODE_KEY.test(key)) continue;
    const source = asRecord(value);
    const kind = source['kind'];
    // Regle 4 : un genre inconnu est ecarte, pas devine. Le jour ou une version future
    // ajoute 'rewatched', cet ancien client l'ignore — et le pass-through de la decision
    // n°4 ne le sauve pas ici, puisque la cle `episodeMarks` est connue de nous.
    if (kind !== 'skipped' && kind !== 'watched') continue;
    out[key] = { kind, at: readInstant(source, 'at', UNDATED) };
  }
  return out;
}

const REVIEW_KEY = /^(series|season:[0-9]+)$/;

function parseReviews(raw: unknown): Record<string, JournalReview> {
  const out: Record<string, JournalReview> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!REVIEW_KEY.test(key)) continue;
    const source = asRecord(value);
    const text = source['text'];
    if (typeof text !== 'string' || text.trim().length === 0) continue;
    const through = source['throughSeason'];
    const lang = source['lang'];
    out[key] = {
      // Tolerant a la lecture, strict a l'ecriture : un texte deja ecrit ne doit pas
      // disparaitre parce qu'il depasse un plafond que nous avons change depuis.
      text,
      at: readInstant(source, 'at', UNDATED),
      throughSeason: typeof through === 'number' && through >= 0 ? Math.floor(through) : 0,
      ...(typeof lang === 'string' && lang.length > 0 ? { lang } : {}),
    };
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

/**
 * Lit la liste des visionnages acheves, de facon tolerante.
 *
 * Une entree illisible est **ecartee**, jamais fatale. Les dates
 * sont normalisees et dedupliquees des la lecture : un journal ecrit par une version
 * fautive ne doit pas propager ses doublons.
 */
function parseCompletions(raw: unknown): readonly JournalCompletion[] {
  if (!Array.isArray(raw)) return [];
  // Une **carte** et non un ensemble de dates : un visionnage porte desormais sa provenance,
  // et la lire est ce qui l'empeche d'etre effacee a la premiere sauvegarde (9.0).
  const byInstant = new Map<string, JournalCompletion>();
  for (const item of raw) {
    const source = asRecord(item);
    const at = readInstant(source, 'at', '');
    if (at.length === 0) continue;
    const origin = readOrigin(source);
    const kept = byInstant.get(at);
    // A instant strictement egal, le fait **non marque** l'emporte : la marque dit « cette
    // date n'est pas celle du visionnage », et si un geste pose a la main porte le meme
    // instant, alors elle l'est. Meme direction que `readOrigin` — on prefere l'erreur qui
    // compte un fait vecu a celle qui en efface un.
    if (kept !== undefined && origin !== undefined) continue;
    byInstant.set(at, { at, ...(origin !== undefined ? { origin } : {}) });
  }
  return dedupeByDay([...byInstant.values()]);
}


/**
 * Ce que {@link parseEntry} sait lire. Toute autre cle part dans `unknownFields`.
 *
 * ⚠️ Ajouter un champ a {@link JournalEntry} **sans l'ajouter ici** le ferait recopier
 * dans le seau des inconnus en plus d'etre lu comme champ propre — donc reecrit deux fois,
 * et fusionne selon deux regles differentes.
 *
 * La coherence des deux listes est verifiee **a la compilation**, plus bas
 * ({@link ExhaustiveEntryFields}) : c'est preferable a un test, parce qu'un test se lance
 * alors que le typage, lui, barre la route au moment ou l'on ecrit le champ.
 */
const KNOWN_ENTRY_FIELDS = [
  'position',
  'decision',
  'wanted',
  'liked',
  'episodeMarks',
  'reviews',
  'completions',
  'poster',
  'backdrop',
  'snapshot',
  'seasonRatings',
  'episodeRatings',
  'removed',
] as const;

/** Idem au niveau du document. */
const KNOWN_JOURNAL_FIELDS = ['version', 'deviceId', 'platforms', 'regions', 'entries'] as const;

/**
 * Le filet qui empeche les deux listes ci-dessus de deriver de leurs interfaces.
 *
 * `Exclude<…>` rend `never` quand la liste couvre tous les champs. Sinon il rend l'union
 * des champs **oublies**, et l'affectation echoue en nommant precisement lesquels — donc
 * `npm run typecheck` refuse le commit au lieu de laisser le champ voyager dans les deux
 * seaux a la fois.
 *
 * `unknownFields` est exclu des deux cotes : c'est le seau lui-meme, pas un champ du
 * format serialise.
 */
type ExhaustiveEntryFields = Exclude<
  Exclude<keyof JournalEntry, 'unknownFields'>,
  (typeof KNOWN_ENTRY_FIELDS)[number]
>;
type ExhaustiveJournalFields = Exclude<
  Exclude<keyof Journal, 'unknownFields'>,
  (typeof KNOWN_JOURNAL_FIELDS)[number]
>;

function assertAllFieldsListed<_Forgotten extends never>(): void {}
assertAllFieldsListed<ExhaustiveEntryFields>();
assertAllFieldsListed<ExhaustiveJournalFields>();

/**
 * Les clefs d'un objet brut que la liste des connues ne couvre pas.
 *
 * `undefined` plutot qu'un objet vide : un seau vide ferait exister `unknownFields` sur
 * toutes les entrees du monde, donc grossirait chaque export d'une accolade par serie.
 */
function unknownFieldsOf(
  source: Readonly<Record<string, unknown>>,
  known: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  const out = Object.fromEntries(
    Object.entries(source).filter(([key, value]) => !known.includes(key) && value !== undefined),
  );
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseEntry(raw: unknown, at: Date): JournalEntry | undefined {
  const source = asRecord(raw);

  const position = parsePosition(source['position']);
  const decision = parseDecision(source['decision']);
  const snapshot = parseSnapshot(source['snapshot']);
  const seasonRatings = parseRatings(source['seasonRatings'], SEASON_KEY);
  const episodeRatings = parseRatings(source['episodeRatings'], EPISODE_KEY);
  // `at` — l'horloge de lecture — ne sert qu'ici, a l'expiration. Voir `UNDATED`.
  const removed = parseTombstones(source['removed'], at);

  const wantedSource = source['wanted'];
  const wanted =
    wantedSource !== undefined && wantedSource !== null
      ? {
          at: readInstant(asRecord(wantedSource), 'at', UNDATED),
          ...(readOrigin(asRecord(wantedSource)) !== undefined
            ? { origin: 'import' as const }
            : {}),
        }
      : undefined;

  const likedSource = source['liked'];
  const liked =
    likedSource !== undefined && likedSource !== null
      ? { at: readInstant(asRecord(likedSource), 'at', UNDATED) }
      : undefined;

  const episodeMarks = parseEpisodeMarks(source['episodeMarks']);
  const reviews = parseReviews(source['reviews']);
  const completions = parseCompletions(source['completions']);
  // ⚠️ Relus ici, sinon ils seraient **ecrits puis effaces a la premiere sauvegarde** —
  // le defaut de 10.4bis. Un chemin TMDB commence toujours par `/` : une valeur d'une
  // autre forme vient d'ailleurs et ne se relit pas.
  const poster = readText(source, 'poster');
  const backdrop = readText(source, 'backdrop');
  const unknownFields = unknownFieldsOf(source, KNOWN_ENTRY_FIELDS);

  const entry: JournalEntry = {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(wanted !== undefined ? { wanted } : {}),
    ...(liked !== undefined ? { liked } : {}),
    ...(Object.keys(episodeMarks).length > 0 ? { episodeMarks } : {}),
    ...(Object.keys(reviews).length > 0 ? { reviews } : {}),
    ...(completions.length > 0 ? { completions } : {}),
    ...(poster !== undefined && poster.startsWith('/') ? { poster } : {}),
    ...(backdrop !== undefined && backdrop.startsWith('/') ? { backdrop } : {}),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(Object.keys(seasonRatings).length > 0 ? { seasonRatings } : {}),
    ...(Object.keys(episodeRatings).length > 0 ? { episodeRatings } : {}),
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };

  return worthKeeping(entry) ? entry : undefined;
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
 * @param now instant de reference pour l'**expiration** (pierres tombales, instantanes),
 *   injecte pour les tests. Ce n'est **pas** la date de repli des faits sans date : voir
 *   {@link UNDATED}, et la raison pour laquelle ce fut un defaut.
 */
export function parseJournal(raw: string | null | undefined, now = new Date()): Journal {
  const read = tryParseJournal(raw, now);
  return read.kind === 'ok' ? read.journal : EMPTY_JOURNAL;
}

/**
 * Lit un journal serialise, **en distinguant « vide » de « illisible »**.
 *
 * ## Pourquoi cette fonction existe, et pas seulement {@link parseJournal}
 *
 * 🔴 Rendre un journal vide pour un document qu'on n'a pas su lire est sur **en local** —
 * on relit son propre stockage — et destructeur **a distance**. `src/journal/remote.ts`
 * en faisait un `kind: 'found'` avec zero entree, ce que la synchronisation lit comme
 * « le compte n'a rien », donc comme une invitation a pousser le local par-dessus. Le
 * document distant etait alors remplace en entier, par un `POST merge-duplicates`, apres
 * **un seul geste**.
 *
 * Le type `RemoteRead` distinguait deja `absent` de `unavailable` pour cette raison
 * exacte. Ce qui manquait n'etait pas le concept, c'etait le moyen de le decider ici.
 *
 * `unreadable` couvre ce qui n'est pas un journal du tout : JSON invalide, racine qui
 * n'est pas un objet, `version` absente ou non numerique. Une version **future**, elle,
 * n'est pas illisible — voir la decision n°4.
 */
export function tryParseJournal(
  raw: string | null | undefined,
  now = new Date(),
): { readonly kind: 'ok'; readonly journal: Journal } | { readonly kind: 'unreadable' } {
  if (raw === null || raw === undefined || raw.trim().length === 0) {
    return { kind: 'ok', journal: EMPTY_JOURNAL };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable' };
  }

  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return { kind: 'unreadable' };
  }

  const source = asRecord(decoded);
  const version = source['version'];
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    return { kind: 'unreadable' };
  }

  return { kind: 'ok', journal: readJournal(source, version, now) };
}

function readJournal(
  source: Readonly<Record<string, unknown>>,
  version: number,
  now: Date,
): Journal {
  const entries: Record<JournalKey, JournalEntry> = {};
  for (const [key, value] of Object.entries(asRecord(source['entries']))) {
    if (key.length === 0) continue;
    const entry = parseEntry(value, now);
    if (entry !== undefined) entries[migrateKey(key)] = entry;
  }

  const deviceId = readText(source, 'deviceId');
  const rawPlatforms = source['platforms'];
  const platforms = Array.isArray(rawPlatforms)
    ? rawPlatforms.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];

  // ⚠️ Relu ici, sinon le champ serait **ecrit puis efface a la premiere sauvegarde** —
  // le defaut de 10.4bis, mot pour mot. Les codes pays sont normalises en majuscules a la
  // lecture : deux ecritures du meme pays ne doivent pas donner deux entrees.
  const rawRegions = source['regions'];
  const regions = Array.isArray(rawRegions)
    ? [
        ...new Set(
          rawRegions
            .filter((r): r is string => typeof r === 'string' && /^[A-Za-z]{2}$/.test(r))
            .map((r) => r.toUpperCase()),
        ),
      ]
    : [];

  const unknownFields = unknownFieldsOf(source, KNOWN_JOURNAL_FIELDS);

  return {
    // Le maximum, jamais le notre : voir la decision n°4.
    version: Math.max(version, JOURNAL_VERSION),
    entries,
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(platforms.length > 0 ? { platforms } : {}),
    ...(regions.length > 0 ? { regions } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };
}

/**
 * Serialise un journal. Format stable — c'est aussi le format d'export.
 *
 * ⚠️ Les entrees sont reserialisees une par une, et non recopiees en bloc : elles portent
 * un seau `unknownFields` qu'il faut **reetaler a plat**. Le recopier tel quel ecrirait un
 * champ litteralement nomme `unknownFields`, que le client d'a cote relirait comme un
 * inconnu de plus — un seau dans un seau, a chaque aller-retour.
 *
 * Le seau est etale **avant** les champs connus : si jamais les deux portaient le meme nom
 * — ce qui ne peut venir que d'un oubli dans {@link KNOWN_ENTRY_FIELDS}, et le typage
 * l'interdit — c'est la valeur que nous savons lire qui doit gagner.
 */
export function serializeJournal(journal: Journal): string {
  const entries: Record<string, unknown> = {};
  for (const [key, { unknownFields, ...known }] of Object.entries(journal.entries)) {
    entries[key] = { ...unknownFields, ...known };
  }

  return JSON.stringify({
    ...journal.unknownFields,
    version: journal.version,
    ...(journal.deviceId !== undefined ? { deviceId: journal.deviceId } : {}),
    ...(journal.platforms !== undefined && journal.platforms.length > 0
      ? { platforms: journal.platforms }
      : {}),
    ...(journal.regions !== undefined && journal.regions.length > 0
      ? { regions: journal.regions }
      : {}),
    entries,
  });
}
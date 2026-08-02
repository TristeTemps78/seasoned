/**
 * Reprendre ce qu'on a ailleurs.
 *
 * ## Le fait qui rend ce module urgent
 *
 * `RESEARCH.md` §0.4 : **la saisie manuelle est la cause n°1 d'abandon** des trackers.
 * Et §0.1 : TV Time est mort le 2026-07-15 avec 26,4 millions d'installations. Il y a
 * donc, en ce moment meme, une population qui cherche ou remettre son historique, et a
 * qui l'on demanderait sinon de ressaisir dix ans de series a la main.
 *
 * ## ⚠️ Pourquoi ce module ne connait AUCUN format nommement
 *
 * Le reflexe serait d'ecrire un lecteur « Trakt », un lecteur « Simkl », un lecteur
 * « TV Time ». C'est refuse ici, pour une raison que ce projet a deja payee :
 *
 * > **Une fixture ecrite de memoire decrit l'API dont on se souvient, pas celle qui
 * > existe** (`TASKS.md` §1.10, dette D10). C'est ce qui a fait afficher « Engagement »
 * > sur zero serie pendant des semaines.
 *
 * Or je n'ai vu aucun de ces exports. TV Time a **ferme** — on ne peut plus en obtenir
 * un. Ecrire `readTraktExport()` reviendrait a inventer un format, a le tester contre
 * ma propre invention, et a annoncer un import qui echouerait au premier fichier reel.
 * Annoncer un format qu'on ne sait pas lire est la meme faute que promettre une langue
 * qu'on ne sert pas.
 *
 * **La sortie est structurelle plutot que nominale** : on ne cherche pas *un format*, on
 * cherche **des identifiants TMDB** la ou ils se trouvent, quelle que soit la forme du
 * document. Cela marche sur des exports qu'on n'a jamais vus — ce qui est precisement le
 * probleme a resoudre — et cela ne peut pas mentir sur ce qu'on sait faire.
 *
 * ## Et ce qu'on ne sait pas faire, on le dit
 *
 * Une ligne sans identifiant TMDB n'est **pas** reprise. La resoudre demanderait une
 * recherche par titre, donc un appel reseau par serie : a deux cents series et cent
 * mille utilisateurs, c'est le cout par utilisateur que `ROADMAP.md` §1.4 interdit — et
 * la resolution par titre se trompe (les remakes portent le meme nom). {@link
 * ImportOutcome} compte donc explicitement ce qui n'est pas passe : un import muet sur
 * la moitie du fichier serait pire qu'un refus.
 *
 * Module pur : ni reseau, ni horloge implicite.
 */

import {
  EMPTY_JOURNAL,
  journalKey,
  mergeJournals,
  parseJournal,
  setPosition,
  setSeasonRating,
  setWanted,
  type Journal,
} from './journal';
import { ALL_STARS, type Stars } from './types';

/** D'ou vient ce que l'on vient de lire. */
export type ImportSource =
  /**
   * Notre propre export : le seul format dont on garantisse tout.
   *
   * Discriminant **interne** : il n'est jamais ecrit dans le fichier exporte
   * (`serializeJournal` ne serialise que la version et les entrees). Le renommer avec le
   * produit ne rend donc illisible aucun export deja telecharge.
   */
  | 'voltface'
  /** Un JSON tiers dans lequel on a trouve des identifiants. */
  | 'json'
  /** Un tableau a colonnes. */
  | 'csv'
  /** Rien d'exploitable. */
  | 'unreadable';

export interface ImportOutcome {
  readonly journal: Journal;
  readonly source: ImportSource;
  /** Series effectivement reprises. */
  readonly imported: number;
  /**
   * Entrees reconnues comme des series mais **sans identifiant TMDB**.
   *
   * Ce chiffre est la partie honnete du rapport : c'est ce que l'on n'a pas su
   * reprendre, et l'interface doit le dire.
   */
  readonly skipped: number;
}

/** Les cles ou un identifiant TMDB se cache, tous exports confondus. */
const TMDB_KEYS = ['tmdb', 'tmdb_id', 'tmdbid', 'themoviedb', 'themoviedb_id'];

/**
 * Indices qu'un noeud parle d'une **serie** et non d'un film.
 *
 * Sans ce filtre, l'export d'un service qui melange les deux deposerait cinq cents
 * films dans une bibliotheque de series. Un identifiant TMDB de film et de serie sont
 * indistinguables — seul le contexte tranche, et quand il ne tranche pas, on s'abstient.
 */
const SHOW_HINTS = ['show', 'serie', 'series', 'tv', 'season', 'episode'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Un entier positif, quelle que soit la facon dont il a ete ecrit. */
function toPositiveInt(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.trunc(parsed);
}

/**
 * Une note ramenee sur notre echelle en demi-etoiles.
 *
 * Les services notent sur 10 (Trakt, IMDb), sur 5 (Letterboxd), parfois sur 100. On
 * deduit l'echelle de la valeur elle-meme, faute de la connaitre : au-dessus de 5, c'est
 * forcement une echelle plus large. Une note douteuse est **ecartee** — inventer un
 * jugement serait pire que ne pas en avoir.
 */
export function toStars(value: unknown, scaleHint?: number): Stars | undefined {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(raw) || raw <= 0) return undefined;

  const scale = scaleHint ?? (raw > 10 ? 100 : raw > 5 ? 10 : 5);
  const onFive = (raw / scale) * 5;
  // Au demi-cran le plus proche, qui est l'unite de notre echelle.
  const snapped = Math.round(onFive * 2) / 2;
  return ALL_STARS.find((star) => star === snapped);
}

/** Le titre d'un noeud, sous l'un ou l'autre de ses noms usuels. */
function titleOf(node: Record<string, unknown>): string | undefined {
  for (const key of ['title', 'name', 'series_title', 'show_title']) {
    const value = node[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/** L'identifiant TMDB d'un noeud, directement ou dans un sous-objet `ids`. */
function tmdbIdOf(node: Record<string, unknown>): number | undefined {
  for (const key of TMDB_KEYS) {
    const found = toPositiveInt(node[key]);
    if (found !== undefined) return found;
  }
  const ids = node['ids'];
  if (isRecord(ids)) {
    for (const key of TMDB_KEYS) {
      const found = toPositiveInt(ids[key]);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Ce noeud, ou son contexte, parle-t-il d'une serie ? */
function looksLikeShow(node: Record<string, unknown>, path: string): boolean {
  const haystack = `${path} ${Object.keys(node).join(' ')}`.toLowerCase();
  if (SHOW_HINTS.some((hint) => haystack.includes(hint))) return true;
  const type = node['type'];
  return typeof type === 'string' && SHOW_HINTS.includes(type.toLowerCase());
}

/** Une serie reconnue dans un document, quelle qu'en soit la forme. */
interface Found {
  readonly tmdbId?: number;
  readonly title?: string;
  readonly seasonNumber?: number;
  readonly episodeNumber?: number;
  readonly stars?: Stars;
}

/**
 * Parcourt un document JSON quelconque et releve tout ce qui ressemble a une serie.
 *
 * La profondeur est bornee : un document circulaire ou absurdement imbrique ne doit pas
 * faire tourner le navigateur indefiniment sur un fichier qu'on n'a pas ecrit.
 */
function scan(value: unknown, path: string, found: Found[], depth = 0): void {
  if (depth > 8 || found.length > 5000) return;

  if (Array.isArray(value)) {
    for (const item of value) scan(item, path, found, depth + 1);
    return;
  }
  if (!isRecord(value)) return;

  // Un noeud « show » imbrique porte souvent l'identifiant, le parent portant la note
  // et la position. On fusionne donc les deux niveaux plutot que de choisir.
  const nested = isRecord(value['show']) ? (value['show'] as Record<string, unknown>) : undefined;
  const merged: Record<string, unknown> = nested !== undefined ? { ...nested, ...value } : value;

  const tmdbId = tmdbIdOf(merged) ?? (nested !== undefined ? tmdbIdOf(nested) : undefined);
  const title = titleOf(merged) ?? (nested !== undefined ? titleOf(nested) : undefined);

  if ((tmdbId !== undefined || title !== undefined) && looksLikeShow(merged, path)) {
    found.push({
      ...(tmdbId !== undefined ? { tmdbId } : {}),
      ...(title !== undefined ? { title } : {}),
      ...pickPosition(merged),
      ...pickRating(merged),
    });
    // On ne redescend pas dans un noeud deja pris : ses sous-objets decriraient la
    // meme serie, et on la compterait deux fois.
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    scan(child, `${path}.${key}`, found, depth + 1);
  }
}

function pickPosition(node: Record<string, unknown>): Partial<Found> {
  const seasonNumber = toPositiveInt(node['season'] ?? node['season_number'] ?? node['seasonNumber']);
  const episodeNumber = toPositiveInt(node['episode'] ?? node['episode_number'] ?? node['episodeNumber']);
  return {
    ...(seasonNumber !== undefined ? { seasonNumber } : {}),
    ...(episodeNumber !== undefined ? { episodeNumber } : {}),
  };
}

function pickRating(node: Record<string, unknown>): Partial<Found> {
  const stars = toStars(node['rating'] ?? node['score'] ?? node['user_rating'] ?? node['my_rating']);
  return stars !== undefined ? { stars } : {};
}

/**
 * Lit un tableau a colonnes.
 *
 * Analyseur volontairement minimal, mais qui traite le cas qui casse tout : **les
 * champs entre guillemets contenant une virgule**. Un titre comme « Truth, Justice »
 * decalerait sinon toutes les colonnes suivantes, et l'import serait faux sans etre
 * vide — le pire des deux mondes.
 */
export function parseCsvLine(line: string): readonly string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        // Deux guillemets de suite : un guillemet litteral, pas une fermeture.
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',' || char === ';' || char === '\t') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function fromCsv(raw: string): readonly Found[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0];
  if (headerLine === undefined || lines.length < 2) return [];

  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const columnOf = (...names: readonly string[]): number =>
    headers.findIndex((header) => names.includes(header));

  const idColumn = columnOf(...TMDB_KEYS.map((k) => k.replace(/[^a-z0-9]/g, '')));
  const titleColumn = columnOf('title', 'name', 'seriestitle', 'showtitle');
  if (idColumn < 0 && titleColumn < 0) return [];

  const seasonColumn = columnOf('season', 'seasonnumber');
  const episodeColumn = columnOf('episode', 'episodenumber');
  const ratingColumn = columnOf('rating', 'score', 'userrating', 'myrating');

  const found: Found[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const at = (index: number): string | undefined => (index >= 0 ? cells[index] : undefined);

    const tmdbId = toPositiveInt(at(idColumn));
    const title = at(titleColumn);
    if (tmdbId === undefined && (title === undefined || title.length === 0)) continue;

    const seasonNumber = toPositiveInt(at(seasonColumn));
    const episodeNumber = toPositiveInt(at(episodeColumn));
    const stars = toStars(at(ratingColumn));

    found.push({
      ...(tmdbId !== undefined ? { tmdbId } : {}),
      ...(title !== undefined && title.length > 0 ? { title } : {}),
      ...(seasonNumber !== undefined ? { seasonNumber } : {}),
      ...(episodeNumber !== undefined ? { episodeNumber } : {}),
      ...(stars !== undefined ? { stars } : {}),
    });
  }
  return found;
}

/** Transforme ce qui a ete releve en journal, et compte ce qui n'a pas pu l'etre. */
function toJournal(found: readonly Found[], now: Date): { journal: Journal; imported: number; skipped: number } {
  let journal = EMPTY_JOURNAL;
  let imported = 0;
  let skipped = 0;
  const seen = new Set<number>();

  for (const item of found) {
    if (item.tmdbId === undefined) {
      skipped += 1;
      continue;
    }
    const key = journalKey(String(item.tmdbId));

    // Une meme serie revient souvent une fois par episode dans ces exports. On ne la
    // compte qu'une fois, mais on continue d'appliquer ses faits : le dernier episode
    // vu doit gagner, et c'est `setPosition` qui tranche.
    if (!seen.has(item.tmdbId)) {
      seen.add(item.tmdbId);
      imported += 1;
      journal = setWanted(journal, key, true, now);
    }

    if (item.seasonNumber !== undefined) {
      const episodeNumber = item.episodeNumber ?? 1;
      const current = journal.entries[key]?.position;
      const isLater =
        current === undefined ||
        item.seasonNumber > current.seasonNumber ||
        (item.seasonNumber === current.seasonNumber && episodeNumber > current.episodeNumber);
      if (isLater) {
        journal = setPosition(journal, key, item.seasonNumber, episodeNumber, now);
      }
      if (item.stars !== undefined) {
        journal = setSeasonRating(journal, key, item.seasonNumber, item.stars, now);
      }
    }
  }

  return { journal, imported, skipped };
}

/**
 * Lit n'importe quel export et le fusionne dans un journal existant.
 *
 * **Fusionne, jamais ne remplace** : importer sur un appareil deja utilise ne doit rien
 * effacer de ce qu'on y a fait. `mergeJournals` tranche champ par champ, donc les deux
 * apports survivent (`TASKS.md` lot 0).
 *
 * @param into journal existant. `EMPTY_JOURNAL` pour un premier import.
 * @param now instant de reference, injecte : ce module n'a pas d'horloge.
 */
export function importForeign(raw: string, into: Journal, now: Date): ImportOutcome {
  // Notre propre format d'abord : c'est le seul dont on garantisse la fidelite, et le
  // deviner par le scan generique perdrait les decisions et les notes d'episode.
  const native = parseJournal(raw, now);
  if (Object.keys(native.entries).length > 0) {
    return {
      journal: mergeJournals(into, native),
      source: 'voltface',
      imported: Object.keys(native.entries).length,
      skipped: 0,
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    decoded = undefined;
  }

  if (decoded !== undefined) {
    const found: Found[] = [];
    scan(decoded, 'root', found);
    if (found.length > 0) {
      const built = toJournal(found, now);
      return {
        journal: mergeJournals(into, built.journal),
        source: 'json',
        imported: built.imported,
        skipped: built.skipped,
      };
    }
  }

  const rows = fromCsv(raw);
  if (rows.length > 0) {
    const built = toJournal(rows, now);
    return {
      journal: mergeJournals(into, built.journal),
      source: 'csv',
      imported: built.imported,
      skipped: built.skipped,
    };
  }

  // Rien compris : on rend le journal **inchange**. Un import rate ne doit jamais
  // laisser l'utilisateur avec moins qu'avant.
  return { journal: into, source: 'unreadable', imported: 0, skipped: 0 };
}

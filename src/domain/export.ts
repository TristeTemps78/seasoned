/**
 * **Partir avec ce qu'on a ecrit** — F6, la porte de sortie qui manquait.
 *
 * ## Le manque, dit par le releve du 2026-08-17
 *
 * *« `/convertir` sait **lire** un export TV Time, Trakt ou Simkl. L'export interne est un
 * fichier a soi. Un produit dont on ne peut pas partir est un produit dans lequel on hesite
 * a entrer. »* Le sens unique etait mesure : trois formats en lecture, zero en ecriture.
 *
 * `JournalTransfer` exporte deja le journal entier en JSON — c'est la regle 9, et c'est un
 * **pont entre appareils**, pas une porte de sortie : personne d'autre que ce produit ne
 * sait le lire. Emporter ses dix ans ailleurs demandait de reecrire a la main.
 *
 * ## ⚠️ Pourquoi ce module ne connait AUCUN service nommement
 *
 * C'est le raisonnement de `import.ts`, applique dans l'autre sens, et il vaut d'etre
 * rappele parce qu'il est contre-intuitif :
 *
 * > *« Une fixture ecrite de memoire decrit l'API dont on se souvient, pas celle qui
 * > existe. »*
 *
 * Ecrire `versTrakt()` supposerait de connaitre le format qu'attend l'importeur de Trakt.
 * Je ne l'ai pas vu, et Letterboxd — la reference du produit — **ne prend que des films** :
 * un « export Letterboxd » depuis un produit de series serait un fichier que le service
 * refuse, annonce par un bouton qui promet. Annoncer un format qu'on ne sait pas ecrire est
 * la meme faute que promettre une langue qu'on ne sert pas.
 *
 * La sortie est donc **structurelle plutot que nominale**, exactement comme a l'import : un
 * tableau a colonnes, avec l'identifiant TMDB en premiere colonne. C'est ce que tout
 * importeur sait mapper, c'est lisible par un tableur, et ca ne peut pas mentir sur ce qu'on
 * sait faire.
 *
 * ⚠️ **Et il se relit ici.** `importForeign` cherche des identifiants TMDB dans n'importe
 * quel CSV : notre propre export en est un cas particulier. La porte de sortie est donc
 * aussi une porte d'entree, sans une ligne de code de plus.
 *
 * Module pur : ni reseau, ni horloge implicite.
 */

import { seriesEntries, type Journal, type JournalEntry, type JournalKey } from './journal';

/**
 * Les colonnes, dans l'ordre — **et ce sont elles, l'interface publique de ce module**.
 *
 * ⚠️ En anglais et en `snake_case`, contrairement a tout le reste du produit. Ce fichier
 * n'est pas lu par une personne francaise : il est **mappe** par un importeur tiers ou par
 * un tableur, et `tmdb_id` est le nom que ces outils reconnaissent. Le traduire ferait un
 * fichier joli que rien ne saurait lire.
 */
const COLUMNS = [
  /** L'identifiant TMDB, nu : `1396`. La seule colonne qui permette de retrouver l'oeuvre. */
  'tmdb_id',
  /** Le titre au moment ou on l'a vu, tel que l'instantane l'a garde. Peut manquer. */
  'title',
  /** Vide pour une ligne de serie, le numero pour une ligne de saison. */
  'season',
  /** `watching`, `finished`, `abandoned`, `paused`, `wanted` — ou vide. */
  'status',
  /** La note, sur cinq et par demi-points : `4.5`. Vide si rien n'est note. */
  'rating',
  /** Ou l'on en est, en clair : `S2E4`. Ligne de serie uniquement. */
  'position',
  /** Le texte qu'on a ecrit sur cette cible. */
  'review',
  /**
   * `yes` quand on a pose un coeur, vide sinon.
   *
   * ⚠️ Une colonne a part et non une valeur de `status` : aimer et regarder sont deux faits
   * independants dans ce journal — on peut aimer une serie qu'on a abandonnee, et c'est
   * meme un cas frequent. Les fondre perdrait l'un des deux.
   */
  'liked',
  /** Ses mots, separes par `; ` — la virgule est prise par le format. */
  'tags',
  /** La date du fait le plus recent de cette ligne, en ISO court : `2026-08-17`. */
  'updated_on',
] as const;

/**
 * La fin de ligne du RFC 4180 — nommee une fois, pour les deux exports.
 *
 * ⚠️ Litterale et non `\r\n` recopie a chaque appel : ce fichier a ete casse trois fois de
 * suite le 2026-08-18 par des reecritures automatiques qui transformaient l'echappement en
 * vraie coupure de ligne. Une constante ne peut pas se faire ca.
 */
const CRLF = String.fromCharCode(13, 10);

/**
 * Un champ CSV, echappe.
 *
 * ⚠️ Les trois cas qui cassent un CSV et **rien d'autre** : la virgule, le guillemet, le
 * saut de ligne. Une critique en contient tous les trois — c'est du texte libre de 2000
 * caracteres, et c'est precisement la colonne qu'un export naif casse. Le guillemet se
 * double, comme le veut le RFC 4180 ; l'echapper avec une barre oblique inverse est la
 * faute classique, et aucun tableur ne la lit.
 */
function field(value: string | number | undefined): string {
  if (value === undefined) return '';
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

/** L'etat d'une serie, en un mot que n'importe quel importeur sait ranger. */
function statusOf(entry: JournalEntry): string {
  // ⚠️ Les quatre mots du domaine (`DecisionKind`), traduits **une fois** vers un vocabulaire
  // que d'autres outils emploient : `abandoned` et `paused` s'ecrivent pareil, `completed`
  // devient `finished`, `continuing` se dit `watching` comme une position en cours.
  const decision = entry.decision?.kind;
  if (decision === 'abandoned') return 'abandoned';
  if (decision === 'paused') return 'paused';
  if (decision === 'completed') return 'finished';
  if (decision === 'continuing') return 'watching';
  if (entry.position !== undefined) return 'watching';
  if (entry.wanted !== undefined) return 'wanted';
  return '';
}

/** La date la plus recente d'un lot d'instants, ou rien. Les vides ne comptent pas. */
function latest(...instants: readonly (string | undefined)[]): string | undefined {
  const kept = instants.filter((one): one is string => typeof one === 'string' && one !== '');
  if (kept.length === 0) return undefined;
  // ⚠️ Comparaison de chaines : l'ISO 8601 est concu pour ca, et `new Date()` sur une
  // valeur douteuse rendrait `Invalid Date` — donc `NaN` jusqu'a la colonne.
  return kept.reduce((a, b) => (a > b ? a : b)).slice(0, 10);
}

/** L'identifiant TMDB d'une cle de journal, ou rien si la cle vient d'ailleurs. */
function tmdbOf(key: JournalKey): string | undefined {
  const found = /^tmdb:(\d+)$/.exec(key);
  return found?.[1];
}

/**
 * Le journal entier, en un tableau a colonnes.
 *
 * ## La granularite, et pourquoi elle n'est pas « une ligne par serie »
 *
 * Une seule ligne par serie perdrait ce que ce produit sait de plus precis : la note **de
 * chaque saison** et le texte ecrit **sur chaque saison**. C'est la moitie du differenciateur
 * — Serializd existe pour ca. Une ligne par episode, a l'inverse, ferait un fichier de
 * plusieurs milliers de lignes dont personne ne ferait rien : le journal ne garde des
 * episodes que des marques, sans note ni texte.
 *
 * On rend donc **une ligne par serie** (etat, position, mots, critique de serie) **plus une
 * ligne par saison qui porte quelque chose** — une note ou un texte. Une saison muette
 * n'occupe aucune ligne.
 *
 * ⚠️ Les series sans identifiant TMDB sont ecartees, comme a l'import et pour la meme
 * raison : une ligne qu'aucun outil ne peut resoudre est une ligne qui ne sert a personne.
 * Le cas n'existe pas aujourd'hui — toutes les cles viennent de TMDB — et ce filtre est ce
 * qui rend cette phrase vraie demain.
 *
 * ⚠️ **Aucun en-tete BOM.** Excel ouvre mieux un CSV qui en porte un ; `parseCsvLine`, notre
 * propre lecteur, verrait alors `﻿tmdb_id` comme nom de colonne. Entre l'ergonomie d'un
 * tableur et la relecture par le produit qui l'ecrit, on garde la seconde.
 */
export function toPortableCsv(journal: Journal): string {
  const lines: string[] = [COLUMNS.join(',')];

  for (const [key, entry] of seriesEntries(journal)) {
    const id = tmdbOf(key);
    if (id === undefined) continue;

    const title = entry.snapshot?.title;
    const tags = Object.keys(entry.tags ?? {}).join('; ');
    const seriesReview = entry.reviews?.['series'];

    lines.push(
      [
        field(id),
        field(title),
        field(''),
        field(statusOf(entry)),
        field(''),
        field(
          entry.position === undefined
            ? ''
            : `S${entry.position.seasonNumber}E${entry.position.episodeNumber}`,
        ),
        field(seriesReview?.text),
        field(entry.liked === undefined ? '' : 'yes'),
        field(tags),
        field(
          latest(
            entry.position?.declaredAt,
            entry.decision?.at,
            entry.wanted?.at,
            entry.liked?.at,
            seriesReview?.at,
          ),
        ),
      ].join(','),
    );

    // Les saisons qui portent quelque chose — une note, un texte, ou les deux. L'union des
    // deux tables plutot que l'une ou l'autre : noter sans ecrire et ecrire sans noter sont
    // deux gestes courants, et n'en suivre qu'un perdrait la moitie des lignes.
    const seasons = new Set<string>([
      ...Object.keys(entry.seasonRatings ?? {}),
      ...Object.keys(entry.reviews ?? {})
        .map((target) => /^season:(\d+)$/.exec(target)?.[1])
        .filter((one): one is string => one !== undefined),
    ]);

    for (const season of [...seasons].sort((a, b) => Number(a) - Number(b))) {
      const rating = entry.seasonRatings?.[season];
      const review = entry.reviews?.[`season:${season}`];
      lines.push(
        [
          field(id),
          field(title),
          field(season),
          field(''),
          field(rating?.stars),
          field(''),
          field(review?.text),
          field(''),
          field(''),
          field(latest(rating?.at, review?.at)),
        ].join(','),
      );
    }
  }

  // ⚠️ `\r\n` et non `\n` : c'est ce que le RFC 4180 demande, et c'est la seule difference
  // qui fasse ouvrir ou non le fichier correctement dans les tableurs de Windows.
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Les colonnes d'un export de listes. Meme discipline que celles du journal : anglais,
 * `snake_case`, l'identifiant TMDB en tete de ce qui identifie une oeuvre.
 */
const LIST_COLUMNS = [
  /** L'identifiant d'URL de la liste — stable, c'est lui qui la designe. */
  'list_slug',
  /** Son titre au moment de l'export. */
  'list_title',
  /** Le rang choisi a la main (032), vide si la liste n'a jamais ete classee. */
  'rank',
  'tmdb_id',
  'title',
] as const;

/**
 * **Les listes, en tableau** — la seconde moitie de la porte de sortie.
 *
 * ## 🔴 Ce que l'export du journal ne pouvait pas contenir
 *
 * La regle 9 promet l'export integral, et {@link toPortableCsv} la tient **pour le journal**
 * — positions, notes, textes, mots. Les listes, elles, ne vivent pas dans le journal : elles
 * sont la seule partie du produit qui **exige un compte pour exister et vit sur le serveur**
 * (`007`). Elles ne partaient donc dans aucun fichier, et quelqu'un qui s'en va les perdait
 * — alors que ce sont precisement celles qu'on a fabriquees pour quelqu'un d'autre.
 *
 * ⚠️ Une ligne par **(liste, serie)** : c'est la forme qu'un tableur pivote et qu'un
 * importeur regroupe. Une ligne par liste avec les series en colonne serait illisible des la
 * onzieme.
 *
 * ⚠️ Une liste **vide** occupe quand meme une ligne, sans identifiant de serie : elle existe,
 * elle a un titre, et un export qui l'oublierait ferait disparaitre le travail de la nommer.
 */
export function listsToCsv(
  lists: readonly { readonly slug: string; readonly title: string }[],
  items: readonly {
    readonly slug: string;
    readonly subject: string;
    readonly title?: string;
    readonly ordinal?: number;
  }[],
): string {
  const lines: string[] = [LIST_COLUMNS.join(',')];

  for (const list of lists) {
    const dedans = items.filter((one) => one.slug === list.slug);
    if (dedans.length === 0) {
      lines.push([field(list.slug), field(list.title), field(''), field(''), field('')].join(','));
      continue;
    }
    for (const one of dedans) {
      lines.push(
        [
          field(list.slug),
          field(list.title),
          field(one.ordinal),
          field(tmdbOf(one.subject)),
          field(one.title),
        ].join(','),
      );
    }
  }

  // Meme fin de ligne que l'autre export : RFC 4180, et c'est ce qui fait ouvrir le fichier
  // correctement dans les tableurs de Windows.
  return `${lines.join(CRLF)}${CRLF}`;
}

/** Combien de lignes le fichier portera — l'en-tete ne compte pas. */
export function csvRowCount(journal: Journal): number {
  return toPortableCsv(journal).trimEnd().split('\r\n').length - 1;
}

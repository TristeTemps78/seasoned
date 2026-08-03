/**
 * Les prochains episodes, dans le calendrier que l'on a deja.
 *
 * ## Le probleme que ca resout, et pourquoi cette solution-la
 *
 * La dette D9 — le trou d'engagement — dit qu'une saison sort tous les trimestres et que
 * personne ne revient spontanement entre-temps. La reponse evidente est la notification.
 * Elle est ecartee, et pas par gout : **son cout croit avec le nombre d'utilisateurs**
 * (serveur de push, jetons a maintenir, permission a demander), ce qui est exactement le
 * mecanisme qui a tue TV Time avec 26 millions d'installations (`ROADMAP.md` §1.4).
 *
 * Le contre-sens utile : **le rappel existe deja, et quelqu'un d'autre le paie.** Tout le
 * monde a un calendrier qui sonne. Un fichier `.ics` genere dans le navigateur y depose
 * les dates une fois pour toutes — cout serveur nul, aucune permission a demander, aucun
 * jeton a garder, et le rappel arrive meme si l'on n'a pas rouvert le site depuis un mois.
 *
 * ## Quatre details du format qui cassent en silence si on les ignore
 *
 * Ce module est pur, mais il n'est pas trivial : iCalendar (RFC 5545) est un format que
 * les clients rejettent **entierement** a la moindre faute, sans dire laquelle.
 *
 * 1. **`CRLF`, jamais `LF`.** Le retour a la ligne est normatif. Un fichier en `LF`
 *    s'ouvre chez certains et pas chez d'autres — le pire genre de bogue.
 * 2. **L'echappement.** Une virgule, un point-virgule ou une barre oblique inverse dans
 *    un titre coupe la valeur en deux champs. « Fear the Walking Dead: Flight 462 » ou
 *    n'importe quel titre a virgule suffit.
 * 3. **Le pliage a 75 octets.** Au-dela, la ligne doit se poursuivre par `CRLF` + espace.
 *    Et la limite est en **octets**, pas en caracteres : un titre accentue ou japonais
 *    depasse bien avant ce que la longueur de la chaine laisse croire.
 * 4. **`UID` stable.** Sans identifiant deterministe, chaque reimport cree des doublons
 *    au lieu de mettre a jour — le calendrier devient inutilisable en trois visites.
 *
 * Module pur : ni reseau, ni horloge implicite. L'instant de generation est injecte.
 */

import { freshSnapshot, type Journal } from './journal';

/** Un episode a venir, tel que la bibliotheque le connait. */
export interface UpcomingEpisode {
  /** Cle de journal, qui rend l'`UID` stable d'une generation a l'autre. */
  readonly key: string;
  readonly title: string;
  readonly airsOn: Date;
  readonly seasonNumber?: number;
  readonly episodeNumber?: number;
}

/** Nom du produit dans l'en-tete, tel que les clients l'afficheront. */
const PRODID = '-//Voltface//Upcoming episodes//EN';

/**
 * Domaine des identifiants d'evenement — **volontairement inchange par le renommage**.
 *
 * Un `UID` est l'identite d'un evenement pour l'agenda qui l'a recu. Le changer ne renomme
 * rien : il fabrique un **second** evenement a cote du premier, en double, dans un agenda
 * que nous ne controlons pas et que nous ne pouvons pas reparer.
 *
 * D'ou la regle appliquee au renommage `seasoned` → `Voltface` : **on migre ce qu'on
 * controle, on ne touche pas a ce qui est deja parti ailleurs.** Le journal est chez nous
 * et a ete migre (`src/journal/local.ts`) ; ceci est parti et reste.
 */
const UID_DOMAIN = 'seasoned';

/** RFC 5545 : les lignes se plient a 75 octets, hors le `CRLF` lui-meme. */
const MAX_OCTETS = 75;

/**
 * Echappe une valeur texte.
 *
 * L'ordre compte : la barre oblique inverse doit passer **en premier**, sinon on
 * echappe les echappements que l'on vient d'ecrire.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Plie une ligne a 75 octets, en comptant en **octets** et non en caracteres.
 *
 * Couper au milieu d'un caractere multi-octets produirait un fichier invalide en UTF-8 :
 * on avance donc caractere par caractere en surveillant la taille encodee. C'est plus
 * lent qu'un `slice`, sur des lignes de quelques dizaines de caracteres.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_OCTETS) return line;

  const parts: string[] = [];
  let current = '';
  let budget = MAX_OCTETS;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (encoder.encode(current).length + size > budget) {
      parts.push(current);
      current = char;
      // Les lignes de continuation commencent par une espace, qui compte dans la limite.
      budget = MAX_OCTETS - 1;
    } else {
      current += char;
    }
  }
  parts.push(current);

  return parts.join('\r\n ');
}

/** `20260805` — la forme des dates sans heure. */
function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** `20260805T120000Z` — la forme horodatee, toujours en UTC. */
function toDateTimeStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/** Le lendemain, en UTC. `DTEND` est **exclusif** pour un evenement d'une journee. */
function nextDay(date: Date): Date {
  return new Date(date.getTime() + 86_400_000);
}

/**
 * Un identifiant deterministe, pour qu'un reimport mette a jour au lieu de dupliquer.
 *
 * Construit sur la cle de serie et la date, et **pas** sur un tirage aleatoire : c'est
 * la seule facon qu'un client reconnaisse un evenement deja connu.
 */
function uidFor(episode: UpcomingEpisode): string {
  const slot =
    episode.seasonNumber !== undefined && episode.episodeNumber !== undefined
      ? `s${episode.seasonNumber}e${episode.episodeNumber}`
      : toDateStamp(episode.airsOn);
  return `${episode.key.replace(/[^a-z0-9:.-]/gi, '')}-${slot}@${UID_DOMAIN}`;
}

/** « Breaking Bad — S5E14 », ou juste le titre si l'on ignore le numero. */
function summaryFor(episode: UpcomingEpisode): string {
  if (episode.seasonNumber === undefined || episode.episodeNumber === undefined) {
    return episode.title;
  }
  return `${episode.title} — S${episode.seasonNumber}E${episode.episodeNumber}`;
}

/**
 * Le calendrier des prochains episodes.
 *
 * @param episodes episodes a venir. Les dates invalides sont **ecartees** plutot que de
 *   produire un `DTSTART` illisible qui ferait rejeter le fichier entier — un episode
 *   perdu vaut mieux qu'un calendrier perdu (`AGENTS.md` regle 4).
 * @param now instant de generation, injecte. Il remplit `DTSTAMP`, que la RFC exige.
 * @returns le fichier, ou `undefined` s'il n'y a rien a mettre dedans : proposer le
 *   telechargement d'un calendrier vide serait une promesse non tenue.
 */
export function buildCalendar(
  episodes: readonly UpcomingEpisode[],
  now: Date,
): string | undefined {
  const valid = episodes
    .filter((episode) => !Number.isNaN(episode.airsOn.getTime()))
    .sort((a, b) => a.airsOn.getTime() - b.airsOn.getTime());
  if (valid.length === 0) return undefined;

  const stamp = toDateTimeStamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const episode of valid) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidFor(episode)}`,
      `DTSTAMP:${stamp}`,
      // Journee entiere : personne ne connait l'heure locale de diffusion, et en
      // inventer une poserait un rappel a 3 h du matin chez la moitie des gens.
      `DTSTART;VALUE=DATE:${toDateStamp(episode.airsOn)}`,
      `DTEND;VALUE=DATE:${toDateStamp(nextDay(episode.airsOn))}`,
      `SUMMARY:${escapeText(summaryFor(episode))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  // Le `CRLF` final n'est pas decoratif : la RFC veut que chaque ligne soit terminee.
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/**
 * Les episodes a venir que le journal connait, tries du plus proche au plus lointain.
 *
 * ## Pourquoi cette fonction vit ici et pas dans un composant
 *
 * Elle y a d'abord vecu — dans `CalendarExport`, un `useMemo` de quinze lignes. Le jour ou
 * une **face du cube** a eu besoin de la meme liste, la choisir entre « dupliquer » et
 * « exporter depuis un composant client » etait un faux choix : les deux ecrans doivent
 * lire **exactement** la meme chose, sans quoi le calendrier affiche et le calendrier
 * exporte finissent par diverger sans que personne ne le voie.
 *
 * Module pur : l'instant est injecte, `freshSnapshot` applique le plafond contractuel de
 * six mois — une metadonnee perimee ne ressort pas plus par cette porte que par une autre.
 *
 * @returns une liste eventuellement vide. Jamais `undefined` : « aucune date connue » est
 *   un etat normal, pas une absence de reponse.
 */
export function upcomingFrom(journal: Journal, now: Date): readonly UpcomingEpisode[] {
  const found: UpcomingEpisode[] = [];

  for (const [key, entry] of Object.entries(journal.entries)) {
    const snapshot = freshSnapshot(entry, now);
    const airsAt = snapshot?.nextEpisodeAt;
    if (snapshot === undefined || airsAt === undefined) continue;

    const airsOn = new Date(airsAt);
    // Une date passee ne rappellera rien, et donne l'impression d'un produit perime.
    if (Number.isNaN(airsOn.getTime()) || airsOn.getTime() < now.getTime()) continue;

    found.push({ key, title: snapshot.title, airsOn });
  }

  return found.sort((a, b) => a.airsOn.getTime() - b.airsOn.getTime());
}

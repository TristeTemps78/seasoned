/**
 * Le journal — **la fusion**, et c'est la brique la mieux tenue du depot.
 *
 * Elle est la preuve de ce que vaut une frontiere nette : ~90 lignes de code, **six lois**
 * jouees sur 120 graines, et zero exemple recopie. Avant qu'elle soit isolee, la meme
 * garantie occupait 410 lignes d'exemples qui ne prouvaient qu'eux-memes.
 *
 * Les lois : commutative, associative, idempotente, absorbe le vide, converge, et
 * departage les ex aequo de facon stable.
 */

import {
  type Journal,
  type JournalEntry,
  type JournalKey,
  type JournalTombstones,
} from './types';
import { dedupeByDay, worthKeeping } from './entry';

// ---------------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------------

/**
 * Une forme canonique et stable d'une valeur, pour departager deux faits ex aequo.
 *
 * Les cles sont triees : deux objets identiques ecrits dans un ordre different doivent
 * rendre la **meme** chaine, sans quoi le departage dependrait de l'ordre d'insertion —
 * c'est-a-dire, encore une fois, de l'appareil.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(',')}}`;
}

/**
 * Le plus recent de deux faits — et, a date egale, **toujours le meme des deux**.
 *
 * ## Le defaut que cette fonction a porte
 *
 * C'etait `dateOf(b) > dateOf(a) ? b : a` : un `>` strict, donc a date egale c'est la
 * **position des arguments** qui tranchait. `mergeJournals(A, B)` et
 * `mergeJournals(B, A)` rendaient alors deux resultats differents. Consequence sur deux
 * appareils : chacun fusionne la paire dans son propre ordre, chacun obtient un journal
 * different, chacun le renvoie a l'autre comme etant le bon — **un battement qui ne se
 * stabilise jamais**. Le pire des symptomes : une note qui change toute seule, par
 * intermittence, sans que rien dans l'interface ne l'explique.
 *
 * On croit volontiers l'egalite de date impossible « en pratique », a la milliseconde
 * pres. Elle ne l'est pas : c'est le cas **nominal** d'un import, ou de nombreux faits
 * recoivent la meme date de repli (voir {@link UNDATED}), et d'un geste qui ecrit
 * plusieurs champs dans le meme tour de boucle.
 *
 * Le departage par forme canonique est arbitraire — c'est assume, et c'est le point :
 * il n'existe aucune raison de preferer l'un des deux. Ce qu'on exige de lui n'est pas
 * d'avoir raison, c'est d'etre **total, deterministe et identique partout**, pour que la
 * fusion soit commutative et que les appareils convergent.
 */
function laterOf<T>(
  a: T | undefined,
  b: T | undefined,
  dateOf: (value: T) => string,
): T | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;

  const ta = new Date(dateOf(a)).getTime();
  const tb = new Date(dateOf(b)).getTime();
  // Une date illisible perd contre une date lisible ; si les deux le sont, on retombe
  // sur le departage canonique, jamais sur l'ordre des arguments.
  if (!Number.isNaN(ta) && Number.isNaN(tb)) return a;
  if (Number.isNaN(ta) && !Number.isNaN(tb)) return b;
  if (tb > ta) return b;
  if (ta > tb) return a;

  return canonical(b) > canonical(a) ? b : a;
}

/** Une valeur datee survit-elle a la pierre tombale qui la vise ? */
function survives(at: string | undefined, tombstone: string | undefined): boolean {
  if (at === undefined) return false;
  if (tombstone === undefined) return true;
  return new Date(at).getTime() >= new Date(tombstone).getTime();
}

/**
 * Fusionne deux tables de faits dates, indexees par cle.
 *
 * Une seule fonction pour les notes de saison, les notes d'episode et les marques : c'est
 * le seul endroit ou le `survives` peut se tromper, donc il ne doit exister qu'une fois.
 */
function mergeDated<T extends { readonly at: string }>(
  a: Readonly<Record<string, T>> | undefined,
  b: Readonly<Record<string, T>> | undefined,
  removed: JournalTombstones,
  field: (key: string) => string,
): Record<string, T> {
  const out: Record<string, T> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const winner = laterOf(a?.[key], b?.[key], (r) => r.at);
    if (winner !== undefined && survives(winner.at, removed[field(key)])) {
      out[key] = winner;
    }
  }
  return out;
}

/**
 * Union de deux seaux de champs inconnus.
 *
 * On ne peut pas departager par date : un champ dont on ignore la forme n'a pas de date
 * qu'on sache lire. Le conflit se tranche donc par {@link canonical}, exactement comme
 * `laterOf` tranche deux faits ex aequo — et pour la meme raison. Ce qu'on exige ici n'est
 * pas d'avoir raison sur le vainqueur, c'est d'etre **total, deterministe et identique sur
 * tous les appareils**, sans quoi deux telephones fusionnant la meme paire divergeraient
 * et se renverraient indefiniment des journaux differents.
 *
 * Ces trois proprietes suffisent a preserver les huit lois de `journal-merge.test.ts`.
 */
function mergeUnknown(
  a: Readonly<Record<string, unknown>> | undefined,
  b: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;

  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[key];
    const right = b[key];
    if (!(key in a)) out[key] = right;
    else if (!(key in b)) out[key] = left;
    else out[key] = canonical(right) > canonical(left) ? right : left;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
  // ⚠️ Pierre tombale `liked`, surtout pas `wanted` : retirer un coeur retirerait sinon
  // « je veux la voir » du meme geste.
  const likedWinner = laterOf(a.liked, b.liked, (l) => l.at);
  const liked = survives(likedWinner?.at, removed['liked']) ? likedWinner : undefined;
  const snapshot = laterOf(a.snapshot, b.snapshot, (s) => s.cachedAt);

  // Union, et non « le plus recent gagne » : un visionnage acheve sur un appareil ne
  // peut pas etre invalide par un autre. C'est un ensemble, donc la fusion est
  // commutative, associative et idempotente sans rien faire de plus.
  const completions = dedupeByDay([...(a.completions ?? []), ...(b.completions ?? [])]);

  const seasonRatings = mergeDated(a.seasonRatings, b.seasonRatings, removed, (k) => `season:${k}`);
  const episodeRatings = mergeDated(
    a.episodeRatings,
    b.episodeRatings,
    removed,
    (k) => `episode:${k}`,
  );
  // ⚠️ Prefixe `mark:` et surtout pas `episode:`, deja pris par la note d'episode :
  // effacer une note effacerait sinon la marque du meme episode, du meme geste.
  const episodeMarks = mergeDated(a.episodeMarks, b.episodeMarks, removed, (k) => `mark:${k}`);
  const reviews = mergeDated(a.reviews, b.reviews, removed, (k) => `review:${k}`);
  const unknownFields = mergeUnknown(a.unknownFields, b.unknownFields);

  return {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(wanted !== undefined ? { wanted } : {}),
    ...(liked !== undefined ? { liked } : {}),
    ...(completions.length > 0 ? { completions } : {}),
    // ⚠️ Le visuel choisi n'est **pas date**, donc on ne peut pas savoir lequel est le plus
    // recent : on garde celui qui existe, `a` d'abord — c'est *son* journal qui accueille
    // l'autre, comme pour `deviceId`. Sans cette ligne, brancher un second appareil
    // effacerait une affiche choisie a la main, en silence.
    ...(a.poster ?? b.poster ? { poster: (a.poster ?? b.poster) as string } : {}),
    ...(a.backdrop ?? b.backdrop ? { backdrop: (a.backdrop ?? b.backdrop) as string } : {}),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(Object.keys(seasonRatings).length > 0 ? { seasonRatings } : {}),
    ...(Object.keys(episodeRatings).length > 0 ? { episodeRatings } : {}),
    ...(Object.keys(episodeMarks).length > 0 ? { episodeMarks } : {}),
    ...(Object.keys(reviews).length > 0 ? { reviews } : {}),
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
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

  // ⚠️ Les pays suivent exactement la meme regle, et il fallait y penser **ici** : sans
  // cette ligne, brancher un second appareil effacerait en silence les pays choisis sur le
  // premier — une preference perdue sans qu'aucun geste ne l'ait demandee.
  const regions = [...new Set([...(a.regions ?? []), ...(b.regions ?? [])])];

  const unknownFields = mergeUnknown(a.unknownFields, b.unknownFields);

  return {
    // Le maximum des deux, pour la meme raison qu'a la lecture : le resultat porte les
    // champs des deux versions, donc annoncer la plus basse serait faux.
    version: Math.max(a.version, b.version),
    entries,
    // L'appareil local garde son identite : c'est *son* journal qui accueille l'autre.
    ...(a.deviceId !== undefined ? { deviceId: a.deviceId } : {}),
    ...(platforms.length > 0 ? { platforms } : {}),
    ...(regions.length > 0 ? { regions } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };
}

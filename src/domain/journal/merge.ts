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
  type FaceAnnouncement,
  type JournalFavorites,
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
  // ⚠️ Prefixe `tag:` : un tag est une chaine libre, donc il peut valoir « series » ou
  // « decision » et entrer en collision avec une pierre tombale existante. Chaque famille de
  // cles a la sienne dans ce fichier, et c'est ici que ca compte le plus — les autres cles
  // sont fabriquees par le code, celle-ci est tapee par quelqu'un.
  const tags = mergeDated(a.tags, b.tags, removed, (k) => `tag:${k}`);
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
    ...(Object.keys(tags).length > 0 ? { tags } : {}),
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
/**
 * Ce qui se fusionne **hors** des entrees, et comment — un champ par ligne.
 *
 * ## 🔴 Pourquoi une table indexee plutot que des lignes ecrites a la main
 *
 * Rien n'obligeait a traiter un nouveau champ de document ici. Ajouter `regions` puis
 * `hideHours` a demande d'y penser **deux fois**, et un oubli n'aurait rien casse de
 * visible : brancher un second appareil aurait simplement efface une preference, en
 * silence, sans qu'aucun geste ne l'ait demandee.
 *
 * Le type indexe rend l'oubli **impossible** : ajouter un champ a {@link Journal} oblige a
 * dire ici comment il fusionne, ou a le ranger dans {@link MERGED_ELSEWHERE} avec sa
 * raison. `npm run typecheck` refuse tout le reste, et il le refuse **au moment ou l'on
 * ecrit le champ**.
 *
 * Meme procede que `GESTURE_DATES` dans `library.ts` et `KNOWN_ENTRY_FIELDS` dans
 * `parse.ts` : le filet existait deja deux fois dans ce depot, il n'avait pas ete tendu
 * ici.
 */
const MERGED_ELSEWHERE = ['version', 'entries', 'deviceId', 'unknownFields'] as const;

const DOCUMENT_MERGE: {
  readonly [K in Exclude<keyof Journal, (typeof MERGED_ELSEWHERE)[number]>]: (
    a: Journal,
    b: Journal,
  ) => Journal[K];
} = {
  // Les plateformes ne sont pas datees : on garde la liste la plus fournie plutot que
  // d'en perdre. Une preference declaree deux fois n'a jamais fait de mal.
  platforms: (a, b) => unite(a.platforms, b.platforms),
  // Les pays suivent exactement la meme regle.
  regions: (a, b) => unite(a.regions, b.regions),
  // ⚠️ **Le masquage gagne des qu'un cote le demande.** Ce n'est pas symetrique, et ce
  // n'est pas un oubli : un appareil qui affiche encore le chiffre n'a pas « choisi » de
  // l'afficher, il n'a simplement pas ete regle. Se tromper vers le silence est
  // rattrapable en un clic ; l'inverse remet sous les yeux un chiffre que quelqu'un
  // avait explicitement demande a ne plus voir.
  hideHours: (a, b) => (a.hideHours === true || b.hideHours === true ? true : undefined),
  // ⚠️ **Le refus gagne**, exactement comme le masquage — et ici l'asymetrie compte plus
  // encore : se tromper vers le retrait ne coute qu'une ligne d'agregat, se tromper vers la
  // publication remet dans une carte quelqu'un qui en etait sorti. Le premier se repare en
  // un clic, le second a deja eu lieu.
  keepStopsPrivate: (a, b) =>
    a.keepStopsPrivate === true || b.keepStopsPrivate === true ? true : undefined,
  // ⚠️ **La plus recente gagne** — et c'est pour ca que l'annonce porte une date. Prendre
  // « celle de `a` » trancherait par l'ordre des arguments, exactement le defaut du
  // `deviceId` de `sameJournal`. Ici la consequence serait visible : rejouer sur le
  // telephone une bascule deja vue sur l'ordinateur, ou pire, taire la seule qui comptait.
  announcedFace: (a, b) => derniere(a.announcedFace, b.announcedFace),
  // ⚠️ **Le plus recent gagne EN ENTIER**, et surtout pas l'union — qui est pourtant la
  // regle des deux listes juste au-dessus. La difference tient a ce qu'est cette liste :
  // elle est **plafonnee et ordonnee**, donc en retirer une est un geste aussi ordinaire
  // que d'en ajouter une. Une union ferait revenir la serie qu'on vient de decrocher sur
  // l'autre appareil, et depasserait quatre par-dessus le marche.
  //
  // C'est la meme forme que `announcedFace`, y compris le departage a egalite de date :
  // par le contenu, jamais par l'ordre des arguments. Le battement infini que ce fichier
  // raconte deux paragraphes plus bas est arrive **le jour ou la regle a ete ecrite**.
  favorites: (a, b) => dernierChoix(a.favorites, b.favorites),
};

/**
 * Le plus recent des deux choix de favoris.
 *
 * A egalite de date, on departage sur les cles jointes — un ordre lexical qui n'a aucun sens
 * metier, et c'est exactement sa qualite : il n'en faut pas. Il doit seulement rendre le
 * **meme** verdict des deux cotes, sans quoi deux appareils se renvoient leurs journaux
 * indefiniment ({@link derniere} raconte cette histoire-la).
 */
function dernierChoix(
  a: JournalFavorites | undefined,
  b: JournalFavorites | undefined,
): JournalFavorites | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const parDate = b.at.localeCompare(a.at);
  if (parDate !== 0) return parDate > 0 ? b : a;
  return b.keys.join(' ').localeCompare(a.keys.join(' ')) < 0 ? b : a;
}

/**
 * La plus recente des deux annonces. `at` est une chaine ISO : l'ordre lexical suffit.
 *
 * 🔴 **A egalite de date, on departage par le nom de la face — pas par l'ordre des
 * arguments.** La premiere version rendait `a` quand les deux dates etaient identiques,
 * donc `merge(x, y)` annoncait `finisher` et `merge(y, x)` `cutter` : deux appareils
 * divergeaient, se renvoyaient leurs journaux, et le battement ne s'arretait jamais.
 *
 * C'est **exactement** le defaut contre lequel le commentaire de `announcedFace` met en
 * garde — le `deviceId` de `sameJournal` — commis dans la ligne d'a cote, le jour meme ou
 * il etait ecrit. Il n'a pas ete vu parce que les lois comparaient `shape(journal)`, qui ne
 * regardait **que les entrees** : aucun champ de document n'etait couvert.
 *
 * Le departage lexical n'a aucun sens metier, et c'est sa qualite : il n'en faut pas. Il
 * doit seulement rendre le **meme** verdict des deux cotes — meme procede que
 * {@link mergeUnknown} et {@link laterOf}.
 */
function derniere(
  a: FaceAnnouncement | undefined,
  b: FaceAnnouncement | undefined,
): FaceAnnouncement | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const parDate = b.at.localeCompare(a.at);
  if (parDate !== 0) return parDate > 0 ? b : a;
  return b.id.localeCompare(a.id) < 0 ? b : a;
}

/**
 * L'union de deux ensembles non dates, sans doublon. Vide devient `undefined`.
 *
 * 🔴 **Trie, et ce tri corrige un defaut mesure le 2026-08-11.** Sans lui, l'union rendait
 * les elements de `a` puis ceux de `b` : `merge(x, y)` donnait `["netflix","max"]` et
 * `merge(y, x)` `["max","netflix"]`. Le **contenu** convergeait, le **document** non.
 *
 * L'en-tete de `journal-merge.test.ts` traitait le cas comme contractuel — *« c'est un
 * ensemble ; son ordre ne porte pas de sens »* — et c'est vrai de la lecture : les quatre
 * lecteurs de `platforms` en font un `Set`. Ce n'est pas vrai de l'**ecriture** : deux
 * appareils qui aboutissent a deux serialisations du meme ensemble se les renvoient
 * indefiniment, chacun croyant avoir du neuf a pousser. Un ordre canonique coute un `sort`
 * et **supprime** l'exception au lieu de la documenter.
 */
function unite(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): readonly string[] | undefined {
  const all = [...new Set([...(a ?? []), ...(b ?? [])])].sort();
  return all.length > 0 ? all : undefined;
}

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

  const preferences: Record<string, unknown> = {};
  for (const [field, merge] of Object.entries(DOCUMENT_MERGE)) {
    const value = merge(a, b);
    // ⚠️ On n'ecrit que ce qui a une valeur : poser `platforms: undefined` ferait
    // apparaitre la cle a la serialisation, et un client d'a cote la relirait comme un
    // champ present et vide.
    if (value !== undefined) preferences[field] = value;
  }

  const unknownFields = mergeUnknown(a.unknownFields, b.unknownFields);

  return {
    // Le maximum des deux, pour la meme raison qu'a la lecture : le resultat porte les
    // champs des deux versions, donc annoncer la plus basse serait faux.
    version: Math.max(a.version, b.version),
    entries,
    // L'appareil local garde son identite : c'est *son* journal qui accueille l'autre.
    ...(a.deviceId !== undefined ? { deviceId: a.deviceId } : {}),
    ...preferences,
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };
}

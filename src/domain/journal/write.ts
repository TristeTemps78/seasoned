/**
 * Le journal — **les gestes**. Douze fonctions, un seul contrat.
 *
 * Chacune prend un journal et en rend un autre : *rien n'est mute*. Et toutes partagent
 * la meme loi, qui est ce qu'il faut tester une fois plutot que douze :
 *
 *   - **rejouer un geste l'annule** (le coeur, « je veux la voir », une critique vide) ;
 *   - **un geste retire laisse une pierre tombale**, sans quoi la fusion le ferait revenir.
 */

import type { DecisionKind, Stars } from '../types';
import type { EpisodeMark } from '../remaining';
// Type seul : voir `types.ts`, un import de valeur depuis `face.ts` ferait un cycle.
import type { FaceId } from '../face';
import {
  episodeKey,
  type FactOrigin,
  type Journal,
  type JournalEntry,
  type JournalEpisodeMark,
  type JournalKey,
  type JournalSnapshot,
  type JournalTombstones,
} from './types';
import { dedupeByDay, worthKeeping } from './entry';

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
  // ⚠️ La version n'est PAS ramenee a `JOURNAL_VERSION` ici. Ecrire dans un document
  // qu'une version plus recente a touche ne le ramene pas a la notre : ses champs
  // inconnus sont toujours la, preserves. Voir la decision n°4.
  return { ...journal, entries };
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
 * **Un pointeur, pas quarante-sept cases a cocher** : tout ce qui precede est
 * implicitement vu. C'est le seul remede realiste a la friction qui tue les trackers.
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
 * Arbitrage A7 : contraire a la recommandation du modele de notation d'origine,
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
  // fera la carte des abandons.
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
 * Enregistre que la serie vient d'etre menee au bout.
 *
 * ## Pourquoi ce geste est distinct de la decision « terminee »
 *
 * `setDecision(key, 'completed')` decrit un **etat courant**, et il se retire : on peut
 * l'avoir clique par erreur. Un visionnage acheve est un **evenement**, et il ne se
 * retire pas — c'est arrive. Confondre les deux ferait disparaitre un fait a chaque
 * changement d'avis, ce qui est exactement le defaut que la v3 repare.
 *
 * D'ou l'appel des deux cotes : l'interface pose la decision **et** enregistre le
 * passage. Le second est idempotent dans la journee, donc une bascule repetee ne compte
 * jamais deux fois.
 */
export function markCompleted(
  journal: Journal,
  key: JournalKey,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const completions = dedupeByDay([
    ...(entry.completions ?? []),
    { at: now.toISOString() },
  ]);
  // Rien de neuf : on rend le journal **tel quel**, pour qu'un rendu React ne se
  // declenche pas sur une egalite de reference perdue pour rien.
  if (completions.length === (entry.completions ?? []).length) return journal;
  return withEntry(journal, key, { ...entry, completions });
}

/**
 * Combien de fois la serie a ete menee au bout.
 *
 * Zero pour une serie en cours : c'est le nombre de **passages acheves**, pas le nombre
 * de fois qu'on l'a ouverte.
 */
export function completionCount(entry: JournalEntry | undefined): number {
  return entry?.completions?.length ?? 0;
}

/**
 * Est-on en train de la revoir ?
 *
 * Vrai quand la serie a deja ete achevee **et** qu'une position courante existe. C'est
 * la definition la plus simple qui ne se trompe pas : reposer une position apres avoir
 * fini, c'est recommencer.
 */
export function isRewatching(entry: JournalEntry | undefined): boolean {
  return completionCount(entry) > 0 && entry?.position !== undefined;
}

/**
 * Poser ou retirer un **drapeau daté** : « je veux la voir », le cœur.
 *
 * Ces gestes n'ont pas de valeur, seulement une date — on les a faits ou pas. La mecanique
 * est donc entierement partagee, y compris la **pierre tombale** : sans elle, retirer un
 * coeur sur le telephone le verrait revenir a la premiere synchronisation avec l'ordinateur
 * qui l'ignorait — la suppression annulee par la synchronisation, decision n°3.
 *
 * ⚠️ **`setWanted` et `setLiked` etaient identiques au nom du champ pres**, verifie par
 * normalisation le 2026-08-07 : vingt lignes en double. Le prix n'etait pas la longueur,
 * c'est qu'un troisieme drapeau en aurait produit une troisieme copie — et que toute
 * correction du jeu de pierres tombales devait etre faite deux fois, sans que rien ne le
 * rappelle.
 */
function setDatedFlag(
  journal: Journal,
  key: JournalKey,
  field: 'wanted' | 'liked',
  on: boolean,
  now: Date,
): Journal {
  const entry = journal.entries[key] ?? {};
  if (!on) {
    const { [field]: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }
  return withEntry(journal, key, {
    ...entry,
    [field]: { at: now.toISOString() },
    ...reviseTombstone(entry, field),
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
  return setDatedFlag(journal, key, 'wanted', wanted, now);
}

/**
 * Ecrire, reecrire ou effacer une critique.
 *
 * `text` vide efface — le meme geste rejoue annule, comme partout ailleurs ici.
 */
export function setReview(
  journal: Journal,
  key: JournalKey,
  target: string,
  review: { readonly text: string; readonly throughSeason: number; readonly lang?: string },
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const field = `review:${target}`;
  const { [target]: _current, ...rest } = entry.reviews ?? {};

  if (review.text.trim().length === 0) {
    const { reviews: _dropped, ...withoutReviews } = entry;
    return withEntry(journal, key, {
      ...withoutReviews,
      ...(Object.keys(rest).length > 0 ? { reviews: rest } : {}),
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  return withEntry(journal, key, {
    ...entry,
    reviews: {
      ...rest,
      [target]: {
        text: review.text.trim(),
        at: now.toISOString(),
        throughSeason: review.throughSeason,
        ...(review.lang !== undefined ? { lang: review.lang } : {}),
      },
    },
    ...reviseTombstone(entry, field),
  });
}

/**
 * Les marques d'une entree, dans la forme qu'attend le domaine du calcul.
 *
 * La table du journal est indexee par `saison:episode` — pratique pour fusionner, illisible
 * pour compter. Cette traduction vit **ici**, en un seul endroit : chaque appelant qui
 * refendrait la cle lui-meme finirait par le faire un peu differemment.
 */
export function marksOf(entry: JournalEntry | undefined): readonly EpisodeMark[] {
  return Object.entries(entry?.episodeMarks ?? {}).flatMap(([key, mark]) => {
    const [season, episode] = key.split(':').map(Number);
    if (season === undefined || episode === undefined) return [];
    if (!Number.isFinite(season) || !Number.isFinite(episode)) return [];
    return [{ seasonNumber: season, episodeNumber: episode, kind: mark.kind }];
  });
}

/**
 * Marquer un episode saute ou vu en avance — ou retirer la marque.
 *
 * `kind` a `undefined` retire, comme partout ailleurs ici : c'est le meme geste rejoue qui
 * annule, plutot qu'un second mutateur a tenir d'accord avec le premier.
 */
export function setEpisodeMark(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  episodeNumber: number,
  kind: JournalEpisodeMark['kind'] | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const at = episodeKey(seasonNumber, episodeNumber);
  const field = `mark:${at}`;
  const { [at]: _current, ...rest } = entry.episodeMarks ?? {};

  if (kind === undefined) {
    // ⚠️ La cle est **retiree**, jamais posee a `undefined` : `exactOptionalPropertyTypes`
    // distingue les deux, et une table vide qui traine reapparaitrait dans l'export.
    const { episodeMarks: _dropped, ...withoutMarks } = entry;
    return withEntry(journal, key, {
      ...withoutMarks,
      ...(Object.keys(rest).length > 0 ? { episodeMarks: rest } : {}),
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  return withEntry(journal, key, {
    ...entry,
    episodeMarks: { ...rest, [at]: { kind, at: now.toISOString() } },
    ...reviseTombstone(entry, field),
  });
}

/**
 * Poser ou retirer le coeur. Voir {@link setDatedFlag}, dont c'est le second emploi.
 *
 * ⚠️ **Le coeur n'est pas la note.** Une note dit la qualite, un coeur dit l'attachement :
 * on met cinq etoiles a une serie qu'on ne reverra jamais, et on revoit chaque annee une
 * serie qu'on sait imparfaite.
 */
export function setLiked(
  journal: Journal,
  key: JournalKey,
  liked: boolean,
  now = new Date(),
): Journal {
  return setDatedFlag(journal, key, 'liked', liked, now);
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
  return { ...journal, platforms: [...platforms] };
}

/**
 * Choisit l'affiche ou la banniere d'une serie. `undefined` revient au visuel du catalogue.
 *
 * ⚠️ **Cree l'entree si elle n'existe pas**, contrairement a `setSnapshot` : choisir une
 * affiche est un geste explicite, alors qu'un instantane n'est qu'un effet de bord d'une
 * visite. Quelqu'un qui choisit une affiche sur une serie qu'il n'a pas commencee doit la
 * retrouver — c'est meme un des usages : preparer sa bibliotheque avant de regarder.
 */
export function setArtwork(
  journal: Journal,
  key: JournalKey,
  which: 'poster' | 'backdrop',
  path: string | undefined,
): Journal {
  const entry = journal.entries[key] ?? {};
  // Un chemin TMDB commence par `/`. Refuser le reste evite qu'une URL complete entre
  // dans le journal — elle y vieillirait mal, le CDN pouvant changer de forme.
  const clean = path !== undefined && path.startsWith('/') ? path : undefined;
  const { [which]: _drop, ...rest } = entry;
  return withEntry(journal, key, {
    ...rest,
    ...(clean !== undefined ? { [which]: clean } : {}),
  });
}

/**
 * Declare les pays dont on veut connaitre la disponibilite.
 *
 * ⚠️ **Normalise et dedoublonne ici**, une fois, plutot qu'a chaque lecture : `fr` et `FR`
 * sont le meme pays, et deux entrees pour un pays donneraient deux fois la meme ligne a
 * l'ecran. Le domaine tranche la forme, l'ecran n'a pas a s'en occuper.
 */
/**
 * Afficher ou masquer le temps passe.
 *
 * ⚠️ **Le calcul continue** : seul l'affichage se tait. `buildTally` alimente aussi le
 * bilan annuel et le plan de rattrapage, et rien de tout cela ne doit disparaitre parce
 * qu'on ne veut plus voir un total.
 */
export function setHideHours(journal: Journal, hide: boolean): Journal {
  if (hide) return { ...journal, hideHours: true };
  const { hideHours: _drop, ...rest } = journal;
  return rest;
}

/**
 * Entrer dans la carte des abandons, ou en sortir.
 *
 * ⚠️ **Sortir ne suffit pas a effacer.** Ce champ arrete de publier ; il ne retire pas la
 * ligne deja posee, parce qu'un journal ne sait pas ce que le serveur porte. C'est
 * `PublishActivity` qui doit demander la suppression au moment ou le refus apparait — et
 * c'est ecrit ici parce que c'est ici qu'on le lira.
 */
export function setKeepStopsPrivate(journal: Journal, keepPrivate: boolean): Journal {
  if (keepPrivate) return { ...journal, keepStopsPrivate: true };
  const { keepStopsPrivate: _drop, ...rest } = journal;
  return rest;
}

/**
 * Retenir qu'on vient de montrer cette face-la.
 *
 * ⚠️ **Rend le journal tel quel si la face est deja celle annoncee.** Sans ce garde, chaque
 * rendu ecrirait une date neuve : le journal changerait de reference a chaque page, ce qui
 * relancerait la sauvegarde, la synchronisation, et — puisque `PublishActivity` se declenche
 * sur un changement de journal — un envoi reseau. Une annonce est un evenement, pas un
 * battement de coeur.
 */
export function announceFace(journal: Journal, id: FaceId, now = new Date()): Journal {
  if (journal.announcedFace?.id === id) return journal;
  return { ...journal, announcedFace: { id, at: now.toISOString() } };
}

export function setRegions(journal: Journal, regions: readonly string[]): Journal {
  const clean = [
    ...new Set(regions.filter((one) => /^[A-Za-z]{2}$/.test(one)).map((one) => one.toUpperCase())),
  ];
  return { ...journal, regions: clean };
}

// ---------------------------------------------------------------------------
// 9.0 — marquer ce qui vient d'un import
// ---------------------------------------------------------------------------

/**
 * Un fait, au sens de ce format : **un enregistrement qui porte sa propre date**.
 *
 * C'est la definition qui gouverne tout le reste du journal — la decision n°2 de la v2
 * (« chaque fait porte sa date, la fusion se fait au niveau du champ »). La reutiliser ici
 * plutot qu'en inventer une autre est ce qui garantit que les deux ne divergeront pas.
 *
 * `snapshot` n'en est pas un : il porte `cachedAt`, qui date une **metadonnee de
 * catalogue** et non un geste. `removed` non plus : ses valeurs sont des chaines.
 */
function isDatedFact(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record['at'] === 'string' || typeof record['declaredAt'] === 'string';
}

function stampDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stampDeep);
  if (typeof value !== 'object' || value === null) return value;
  if (isDatedFact(value)) return { ...value, origin: 'import' satisfies FactOrigin };
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stampDeep(v)]),
  );
}

/**
 * Marque **tous** les faits d'un journal comme venant d'un import.
 *
 * S'applique a un journal fraichement construit par {@link importForeign}, dont chaque
 * fait vient de l'import **par construction** — il part de `EMPTY_JOURNAL`. C'est ce qui
 * permet de marquer en bloc plutot que de passer une provenance a travers douze
 * signatures d'ecriture dont onze n'en ont que faire.
 *
 * ## 🔴 Pourquoi un parcours et pas une liste de champs
 *
 * Le reflexe serait d'enumerer `position`, `wanted`, `seasonRatings` — les trois que
 * l'import ecrit aujourd'hui. Ce depot a paye trois fois cette forme-la : `lastTouch`
 * enumerait les champs et il en manquait **deux** (tout le lot 8), `no-journal-on-server`
 * enumerait des fichiers, `KNOWN_ENTRY_FIELDS` a du etre protege par le typage. Une liste
 * ecrite a la main se perime au premier champ ajoute, **en silence**, et ici le silence est
 * definitif : un fait importe sans marque ne se distinguera plus jamais d'un fait vecu.
 *
 * Le parcours, lui, se trompe dans l'autre sens — il marquerait un jour un enregistrement
 * date qui ne serait pas un geste. C'est le sens qu'on veut, et c'est la meme regle que
 * {@link isSeriesKey} : **omettre n'est qu'un oubli, inclure corrompt.** Un fait marque a
 * tort sort d'un agregat ; un fait non marque le fausse.
 *
 * ⚠️ **`unknownFields` est laisse intact** : il appartient a une version du code qui n'est
 * pas celle-ci, et son contrat est de traverser sans etre touche (decision n°4). Y ecrire
 * une provenance serait modifier une donnee dont on ignore la forme.
 */
export function asImported(journal: Journal): Journal {
  const entries: Record<JournalKey, JournalEntry> = {};
  for (const [key, { unknownFields, ...known }] of Object.entries(journal.entries)) {
    // Le parcours n'ajoute que `origin` et ne touche aucune cle : la forme est celle
    // d'entree, ce que la loi d'aller-retour de `tests/journal-origin.test.ts` verifie.
    const stamped = Object.fromEntries(
      Object.entries(known).map(([field, value]) => [field, stampDeep(value)]),
    ) as JournalEntry;
    entries[key] = unknownFields !== undefined ? { ...stamped, unknownFields } : stamped;
  }
  return { ...journal, entries };
}

/** Attache un identifiant d'appareil s'il n'y en a pas encore. */
export function withDeviceId(journal: Journal, deviceId: string): Journal {
  if (journal.deviceId !== undefined) return journal;
  return { ...journal, deviceId };
}

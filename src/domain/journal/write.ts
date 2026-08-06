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
import {
  episodeKey,
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
 * Poser ou retirer le coeur. Voir {@link JournalLiked}.
 *
 * Meme mecanique que {@link setWanted}, y compris la pierre tombale : sans elle, retirer un
 * coeur sur le telephone le verrait revenir a la premiere synchronisation avec l'ordinateur
 * qui l'ignorait — la suppression annulee par la synchronisation, decision n°3.
 */
export function setLiked(
  journal: Journal,
  key: JournalKey,
  liked: boolean,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  if (!liked) {
    const { liked: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, 'liked', now.toISOString()),
    });
  }
  return withEntry(journal, key, {
    ...entry,
    liked: { at: now.toISOString() },
    ...reviseTombstone(entry, 'liked'),
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
  return { ...journal, platforms: [...platforms] };
}

/** Attache un identifiant d'appareil s'il n'y en a pas encore. */
export function withDeviceId(journal: Journal, deviceId: string): Journal {
  if (journal.deviceId !== undefined) return journal;
  return { ...journal, deviceId };
}

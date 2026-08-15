/**
 * Le journal date — **tout ce qui vous est arrive, dans l'ordre ou c'est arrive**.
 *
 * ## Ce que le produit savait deja, et ce qui manquait
 *
 * Chaque fait du journal porte sa propre date : c'est la decision n°2 du format, prise pour
 * que deux appareils fusionnent champ par champ. Elle a un effet de bord que personne
 * n'avait recolte : **le journal est deja une chronologie**, il n'existait simplement aucun
 * lecteur qui la lise dans ce sens. `/moi` range par serie, `/bilan` agrege, le calendrier
 * regarde devant. Rien ne regardait derriere.
 *
 * Or c'est la surface centrale de Letterboxd (le *Diary*), et celle que TV Time appelle le
 * suivi. Elle ne demande aucune donnee nouvelle : uniquement de relire ce qui est ecrit.
 *
 * ## ⚠️ Pourquoi ce module n'est PAS `projectActivity`
 *
 * `src/domain/activity.ts` aplatit lui aussi des faits dates, et la tentation de le
 * reutiliser est forte (regle 3). Elle serait fausse, pour trois raisons qui tiennent
 * toutes a ce qu'il **publie** :
 *
 *   1. **Son jeu de genres est ferme et volontairement pauvre** — cinq valeurs, choisies
 *      parce qu'elles s'agregent et se traduisent. Le journal personnel doit montrer une
 *      critique, une position, un episode saute : precisement ce que le fil s'interdit.
 *   2. **Sa fenetre est de 90 jours.** C'est la retention du fil social. Un journal qui
 *      oublie ce qu'on a fait il y a quatre mois n'est pas un journal.
 *   3. **Il caviarde** ({@link redactActivity}), parce que son lecteur est quelqu'un
 *      d'autre. Ici le lecteur est l'auteur : il n'y a rien a lui cacher de ce qu'il a
 *      lui-meme ecrit.
 *
 * Les deux modules lisent la meme source et repondent a deux questions differentes. Les
 * fondre reviendrait a faire porter au fil social des contraintes de journal intime, ou
 * l'inverse — et c'est l'inverse qui serait une fuite.
 *
 * ## 🔴 Le fait irreparable que ce module doit dire, et pas taire
 *
 * `origin: 'import'` ne veut pas dire « ce fait vient d'un fichier ». Il veut dire **« la
 * date de ce fait est celle ou il est entre ici, pas celle ou il a eu lieu »**
 * ({@link FactOrigin}). C'est exactement pour un ecran comme celui-ci que la marque a ete
 * posee le 2026-08-09 : `importForeign` date **chaque** fait a l'instant de l'import, donc
 * reprendre dix ans de TV Time depose deux cents series portant toutes la meme date.
 *
 * Un journal date qui ignorerait la marque afficherait donc une journee ou l'on aurait
 * pretendument regarde deux cents series, et neuf annees vides avant. Ce n'est pas un
 * defaut d'affichage : c'est le produit qui raconte une vie qui n'a pas eu lieu.
 *
 * D'ou {@link TimelineEvent.imported}, porte par **chaque** evenement et non deduit a
 * l'affichage. Le module qui sait ne doit pas laisser deviner celui qui montre.
 *
 * Module pur : aucun import de navigateur, aucune horloge implicite, aucun reseau.
 */

import type { DecisionKind, Stars } from './types';
import type {
  Journal,
  JournalEntry,
  JournalKey,
} from './journal/types';

/**
 * Le genre d'un evenement du journal.
 *
 * ## Pourquoi celui-ci est ouvert la ou celui du fil est ferme
 *
 * {@link ActivityKind} est ferme parce que chaque valeur doit s'agreger cote serveur et se
 * traduire pour un tiers. Ici, chaque valeur n'a qu'a se lire — donc le jeu suit le
 * **format**, et il grandit avec lui. La regle qui le tient : un genre par champ date du
 * journal, aucun genre invente a l'affichage.
 *
 * `position` merite un mot : c'est le seul genre qui **s'ecrase**. Le journal ne retient
 * qu'une position courante par serie ({@link JournalPosition} est un pointeur, pas une
 * liste), donc la chronologie n'en portera jamais qu'une par serie — la derniere. C'est une
 * limite du format, pas de ce lecteur, et la dire ici evite qu'on cherche le bug ailleurs.
 */
export type TimelineKind =
  /** « Je veux la voir ». */
  | 'wanted'
  /** Le coeur. */
  | 'liked'
  /** Ou l'on en est — voir la note sur l'ecrasement ci-dessus. */
  | 'position'
  /** Une note de saison. */
  | 'rated_season'
  /** Une note d'episode. */
  | 'rated_episode'
  /** Continuer, mettre en pause, abandonner, terminer. */
  | 'decided'
  /** Un passage acheve. Plusieurs par serie, c'est tout l'interet. */
  | 'completed'
  /** Une critique, sur la serie ou sur une saison. */
  | 'reviewed'
  /** Un episode saute, ou vu en avance. */
  | 'episode_mark';

/** Un fait du journal, remis a sa date. */
export interface TimelineEvent {
  readonly kind: TimelineKind;
  readonly subject: JournalKey;
  /** L'instant tel qu'il est ecrit, ISO 8601. C'est lui qui trie. */
  readonly at: string;
  /** `YYYY-MM-DD`, derive de {@link at}. C'est lui qui groupe. */
  readonly on: string;
  readonly season?: number;
  readonly episode?: number;
  readonly stars?: Stars;
  readonly decision?: DecisionKind;
  readonly mark?: 'skipped' | 'watched';
  /**
   * La date de ce fait est-elle celle d'un import plutot que celle du geste ?
   *
   * ⚠️ Voir l'avertissement en tete de module. **A ne jamais omettre a l'affichage** : une
   * ligne importee et une ligne vecue se ressemblent trait pour trait, et seule celle-ci
   * les distingue.
   */
  readonly imported: boolean;
  /** Ce que l'instantane retenait. Absent si l'entree n'en porte pas ou s'il a expire. */
  readonly title?: string;
  readonly posterPath?: string;
}

/** Le jour d'un instant ISO, ou `undefined` si la date est illisible. */
function dayOf(iso: string): string | undefined {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Decompose une cle `saison:episode` ({@link episodeKey}).
 *
 * ⚠️ Rend un objet plutot qu'un couple : sous `exactOptionalPropertyTypes`, un
 * `const [a, b] = …split().map(Number)` type les deux membres `number | undefined` et
 * **aucun `Number.isFinite` ne les restreint** — le compilateur ne suit pas la narrowing a
 * travers un destructuring de tableau. Le detour n'est pas cosmetique : c'est lui qui rend
 * la garde verifiable au lieu de simplement presente.
 */
function parseEpisodeKey(
  key: string,
): { readonly season: number; readonly episode: number } | undefined {
  const at = key.indexOf(':');
  if (at <= 0) return undefined;
  const season = Number(key.slice(0, at));
  const episode = Number(key.slice(at + 1));
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return undefined;
  return { season, episode };
}

/**
 * De quoi filtrer la chronologie.
 *
 * Tout est facultatif : sans option, on rend l'histoire entiere. C'est le defaut correct —
 * un journal qui cache par defaut demanderait a la personne de deviner ce qu'elle ne voit
 * pas.
 */
export interface TimelineFilter {
  /** Annee civile, `2026`. */
  readonly year?: number;
  /** N'garder que ces genres. Vide ou absent = tous. */
  readonly kinds?: readonly TimelineKind[];
  /** Ne garder que les faits portant une note au moins egale. */
  readonly minStars?: Stars;
  /** Ne garder qu'une serie. */
  readonly subject?: JournalKey;
}

/** Les evenements d'une seule entree, non tries. */
function eventsOf(subject: JournalKey, entry: JournalEntry): readonly TimelineEvent[] {
  const out: TimelineEvent[] = [];

  /* Le titre et l'affiche sont lus **une fois par entree** et non par fait. Recopier la
     lecture a chaque genre inviterait a ce qu'un des neuf soit oublie — c'est ainsi que
     `SeriesCard` et `LibraryCard` avaient diverge, et que le fil social a affiche
     « tmdb:94997 » pendant des semaines. */
  const art = {
    ...(entry.snapshot?.title !== undefined ? { title: entry.snapshot.title } : {}),
    ...(entry.snapshot?.posterPath !== undefined
      ? { posterPath: entry.snapshot.posterPath }
      : {}),
  };

  const push = (
    kind: TimelineKind,
    at: string,
    imported: boolean,
    extra: Partial<TimelineEvent> = {},
  ) => {
    const on = dayOf(at);
    // Une date illisible ecarte le fait, jamais l'entree : meme tolerance que la lecture du
    // journal, ou une ligne corrompue ne doit pas emporter l'histoire de quelqu'un.
    if (on === undefined) return;
    out.push({ kind, subject, at, on, imported, ...art, ...extra });
  };

  if (entry.wanted !== undefined) {
    push('wanted', entry.wanted.at, entry.wanted.origin === 'import');
  }
  if (entry.liked !== undefined) {
    // Le coeur n'a pas de provenance dans le format : il n'est jamais importe aujourd'hui.
    push('liked', entry.liked.at, false);
  }
  if (entry.position !== undefined) {
    push('position', entry.position.declaredAt, entry.position.origin === 'import', {
      season: entry.position.seasonNumber,
      episode: entry.position.episodeNumber,
    });
  }
  if (entry.decision !== undefined) {
    push('decided', entry.decision.at, entry.decision.origin === 'import', {
      decision: entry.decision.kind,
      ...(entry.decision.atSeason !== undefined ? { season: entry.decision.atSeason } : {}),
      ...(entry.decision.atEpisode !== undefined ? { episode: entry.decision.atEpisode } : {}),
    });
  }

  for (const [season, rating] of Object.entries(entry.seasonRatings ?? {})) {
    const n = Number(season);
    if (!Number.isFinite(n)) continue;
    push('rated_season', rating.at, rating.origin === 'import', { season: n, stars: rating.stars });
  }

  for (const [key, rating] of Object.entries(entry.episodeRatings ?? {})) {
    const ref = parseEpisodeKey(key);
    if (ref === undefined) continue;
    push('rated_episode', rating.at, rating.origin === 'import', {
      season: ref.season,
      episode: ref.episode,
      stars: rating.stars,
    });
  }

  for (const completion of entry.completions ?? []) {
    push('completed', completion.at, completion.origin === 'import');
  }

  for (const [target, review] of Object.entries(entry.reviews ?? {})) {
    // `series` ou `season:3` — la cle canonique de {@link reviewKey}. On ne relit pas la
    // forme a la main ailleurs : c'est ici, et une seule fois.
    const season = target.startsWith('season:') ? Number(target.slice('season:'.length)) : undefined;
    push('reviewed', review.at, false, {
      ...(season !== undefined && Number.isFinite(season) ? { season } : {}),
    });
  }

  for (const [key, mark] of Object.entries(entry.episodeMarks ?? {})) {
    const ref = parseEpisodeKey(key);
    if (ref === undefined) continue;
    push('episode_mark', mark.at, false, {
      season: ref.season,
      episode: ref.episode,
      mark: mark.kind,
    });
  }

  return out;
}

/**
 * Toute l'histoire, du plus recent au plus ancien.
 *
 * ## Pourquoi le tri est ici et pas dans l'ecran
 *
 * {@link projectActivity} ne trie pas, et le dit : sa liste repart aussitot vers un serveur
 * qui la reordonnera. Ici la liste **est** le resultat — un journal non trie n'est pas un
 * journal, c'est un tas. Le laisser a l'appelant garantirait qu'un second appelant l'oublie.
 *
 * ⚠️ Tri sur {@link TimelineEvent.at}, l'instant, et non sur `on`, le jour : deux notes
 * posees le meme soir doivent ressortir dans l'ordre ou elles ont ete posees. A instant
 * egal, l'ordre est celui des entrees du journal — stable pour un meme document, et sans
 * signification qu'on puisse promettre.
 *
 * ## Toutes les entrees, y compris les films
 *
 * Pas de {@link seriesEntries} ici, et c'est deliberement l'inverse des quatre agregats.
 * Le filtre existe parce que `calendar`, `library`, `tally` et `taste` **supposent des
 * saisons** et fabriqueraient des chiffres faux sur une entree film. Ce module ne suppose
 * rien : il recopie des dates. Une entree d'un type inconnu y produit ses faits communs
 * (voulu, coeur, decision) et rien de plus — ce qui est exactement ce qu'on veut d'un
 * journal, et ce qui evite qu'il faille penser a lui le jour ou les films arrivent.
 */
export function buildTimeline(
  journal: Journal,
  filter: TimelineFilter = {},
): readonly TimelineEvent[] {
  const kinds = filter.kinds !== undefined && filter.kinds.length > 0
    ? new Set(filter.kinds)
    : undefined;

  const out: TimelineEvent[] = [];
  for (const [key, entry] of Object.entries(journal.entries)) {
    if (filter.subject !== undefined && key !== filter.subject) continue;
    for (const event of eventsOf(key as JournalKey, entry)) {
      if (kinds !== undefined && !kinds.has(event.kind)) continue;
      if (filter.year !== undefined && !event.on.startsWith(`${filter.year}-`)) continue;
      if (filter.minStars !== undefined && (event.stars ?? 0) < filter.minStars) continue;
      out.push(event);
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Un jour de journal, et ce qui s'y est passe. */
export interface TimelineDay {
  /** `YYYY-MM-DD`. */
  readonly on: string;
  readonly events: readonly TimelineEvent[];
}

/**
 * Regroupe par jour, en preservant l'ordre recu.
 *
 * Le *Diary* de Letterboxd affiche le mois une fois puis les jours dessous ; c'est cette
 * forme-la qui rend une chronologie lisible, parce qu'elle transforme cinquante lignes
 * identiques en quelques blocs dates. Le regroupement est **de la mise en forme**, donc il
 * n'appartient pas a {@link buildTimeline} — mais il est pur et testable, donc il n'a rien
 * a faire dans un composant non plus.
 */
export function groupByDay(events: readonly TimelineEvent[]): readonly TimelineDay[] {
  const days: TimelineDay[] = [];
  let current: { on: string; events: TimelineEvent[] } | undefined;

  for (const event of events) {
    if (current === undefined || current.on !== event.on) {
      current = { on: event.on, events: [] };
      days.push(current);
    }
    current.events.push(event);
  }

  return days;
}

/**
 * Les annees ou il s'est passe quelque chose, de la plus recente a la plus ancienne.
 *
 * Sert a construire le filtre par annee **sans le deviner** : proposer 2019 a quelqu'un qui
 * n'a rien note cette annee-la est une porte qui ne mene nulle part, et proposer une liste
 * fixe des dix dernieres annees en fabriquerait neuf.
 */
export function yearsInTimeline(events: readonly TimelineEvent[]): readonly number[] {
  const years = new Set<number>();
  for (const event of events) {
    const year = Number(event.on.slice(0, 4));
    if (Number.isFinite(year)) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

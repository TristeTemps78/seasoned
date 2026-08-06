/**
 * Le fil, derive du journal — et **caviarde** avant d'etre lu.
 *
 * Module pur : ni reseau, ni horloge, ni stockage. L'instant de reference est injecte.
 *
 * ## Ce qui est publie, et ce qui ne l'est jamais
 *
 * Le journal contient tout ; le fil ne porte que **la serie, la nature du fait, et pour une
 * note de saison son numero**. Aucun titre d'episode, aucun agregat, aucune position
 * exacte. Ce n'est pas de la prudence : c'est ce qui permet a la position d'un lecteur de
 * ne rien demander au serveur, donc de ne pas pouvoir fuir par cette table.
 *
 * ## 🔴 Ce que la conception initiale du fil laissait passer
 *
 * Il avait ete ecrit — et je l'avais valide — que « Marie a note *Breaking Bad* ★★★★ ne
 * revele rien ». C'est vrai **au niveau de la serie**. Ca ne l'est pas au niveau de la
 * saison : *« Marie a note la saison 6 ★☆☆☆☆ »* apprend a quelqu'un qui en est a la
 * saison 2 qu'il **existe** une saison 6, et qu'elle est mauvaise. C'est exactement le
 * spoiler de trajectoire pour lequel `redactTrajectory` a ete ecrit, entre par une autre
 * porte.
 *
 * > Le caviardage vit donc **ici**, dans le domaine, et pas a l'affichage
 * > (`AGENTS.md` regle 7 : un filtre de rendu laisse fuir les agregats).
 */

import type { Journal, JournalKey } from './journal';
import type { Stars } from './types';

/** Combien de temps un fait reste dans le fil. Q9 : le meme horizon que les purges. */
const ACTIVITY_WINDOW_DAYS = 90;

/**
 * Le jeu **ferme** des faits publiables.
 *
 * Ferme et non libre : un fil de types arbitraires ne s'agrege pas et ne se traduit pas —
 * or le produit vise l'international, ou le texte libre fragmente par langue.
 */
export type ActivityKind = 'rated_season' | 'finished' | 'started' | 'wanted' | 'liked';

export interface ActivityItem {
  readonly kind: ActivityKind;
  readonly subject: JournalKey;
  /** Uniquement pour `rated_season`. */
  readonly season?: number;
  readonly stars?: Stars;
  /** `YYYY-MM-DD`. Au jour : c'est la granularite des faits du journal. */
  readonly happenedOn: string;
}

function day(iso: string): string | undefined {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Ce que le journal permet de publier, dans la fenetre de retention.
 *
 * ⚠️ **Aucun ordre garanti** : le fil est trie a la lecture, par le serveur qui le rend.
 * Trier ici serait un tri de plus a maintenir, pour une liste qui repart aussitot.
 */
export function projectActivity(
  journal: Journal,
  now: Date,
  windowDays: number = ACTIVITY_WINDOW_DAYS,
): readonly ActivityItem[] {
  const floor = new Date(now.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const items: ActivityItem[] = [];

  const keep = (item: ActivityItem | undefined) => {
    // ⚠️ La borne haute compte autant que la basse : une horloge deregle de trois jours
    // publierait un fait **date du futur**, qui resterait en tete du fil jusqu'a ce que le
    // temps le rattrape. La base refuse aussi, mais on ne compte pas sur une seule serrure.
    if (item === undefined) return;
    if (item.happenedOn < floor || item.happenedOn > today) return;
    items.push(item);
  };

  for (const [key, entry] of Object.entries(journal.entries)) {
    const subject = key as JournalKey;

    for (const [season, rating] of Object.entries(entry.seasonRatings ?? {})) {
      const on = day(rating.at);
      if (on === undefined) continue;
      keep({ kind: 'rated_season', subject, season: Number(season), stars: rating.stars, happenedOn: on });
    }

    // Un visionnage acheve est un evenement, pas un etat : c'est `completions` qui le porte,
    // et non la decision — laquelle se retire, alors qu'un passage a bien eu lieu.
    for (const completion of entry.completions ?? []) {
      const on = day(completion.at);
      if (on !== undefined) keep({ kind: 'finished', subject, happenedOn: on });
    }

    const started = entry.position === undefined ? undefined : day(entry.position.declaredAt);
    // ⚠️ La position **exacte** n'est jamais publiee : « a commence » suffit a nourrir un
    // fil, et « en est a S4E2 » dirait a un ami ou en est quelqu'un sans qu'il l'ait choisi.
    if (started !== undefined) keep({ kind: 'started', subject, happenedOn: started });

    const wanted = entry.wanted === undefined ? undefined : day(entry.wanted.at);
    if (wanted !== undefined) keep({ kind: 'wanted', subject, happenedOn: wanted });

    // Le coeur se publie, et il est le fait le moins spoilant du fil : il ne dit ni ou en
    // est la personne, ni ce qu'elle en pense saison par saison. « Marie aime Breaking
    // Bad » n'apprend rien a qui n'a pas commence.
    const liked = entry.liked === undefined ? undefined : day(entry.liked.at);
    if (liked !== undefined) keep({ kind: 'liked', subject, happenedOn: liked });
  }

  return items;
}

/**
 * Retire du fil ce qui depasse la position du **lecteur**.
 *
 * @param items le fil tel qu'il arrive du serveur.
 * @param viewerSeasonOf la saison ou en est le lecteur pour une serie donnee, s'il l'a
 *   commencee. Rendre `undefined` pour une serie qu'il n'a pas commencee : dans ce cas
 *   **rien** n'est masque, parce qu'il n'a pas de position a proteger — le fait que la
 *   serie existe et qu'elle a des saisons est public.
 *
 * Le fait n'est pas supprime, il est **degrade** : « Marie a note une saison » reste, sans
 * le numero ni les etoiles. Supprimer la ligne dirait, par son absence, qu'il s'est passe
 * quelque chose plus loin — un fil a trous est lui-meme un indice.
 */
export function redactActivity<T extends ActivityItem>(
  items: readonly T[],
  viewerSeasonOf: (subject: JournalKey) => number | undefined,
): readonly T[] {
  return items.map((item) => {
    if (item.kind !== 'rated_season' || item.season === undefined) return item;
    const reached = viewerSeasonOf(item.subject);
    if (reached === undefined || item.season <= reached) return item;
    // ⚠️ Generique, et ce n'est pas de la coquetterie : le fil qui arrive du serveur porte
    // aussi l'auteur du fait. Un retour fige a `ActivityItem` l'aurait efface, donc le
    // caviardage aurait supprime le nom de la personne en meme temps que le spoiler.
    const { season: _season, stars: _stars, ...rest } = item;
    return rest as T;
  });
}

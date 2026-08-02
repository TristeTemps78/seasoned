/**
 * Le point d'entree : « ca commence vraiment a l'episode 8 ».
 *
 * ## Le symetrique exact du point d'arret, et il manquait
 *
 * Le produit savait dire « arretez-vous apres la saison 6 ». Il ne savait pas dire
 * l'inverse, qui est pourtant **la question la plus posee sur une serie** : *est-ce que ca
 * s'ameliore ?* La formulation revient partout — « la premiere saison etait une epreuve de
 * devotion », *BoJack Horseman* qui « devient un chef-d'oeuvre vers l'episode 8 ».
 *
 * ## Le renversement qui rend cette mesure plus solide que le point d'arret
 *
 * Le **biais de survie** est la limite consignee et non resolue du produit : ceux qui ont
 * vu la saison 6 de *Dexter* sont ceux qui ont persevere, et ils la notent bien. Les notes
 * publiques ne retrouvent donc jamais les effondrements dont tout le monde parle.
 *
 * > **Sur le debut d'une serie, ce biais joue dans l'autre sens.** Ceux qui notent
 * > l'episode 3 incluent **tous ceux qui ont abandonne apres**. La note du debut est donc
 * > structurellement *plus honnete* que celle de la fin.
 *
 * Autrement dit : la donnee la moins fiable du produit devient la plus fiable des qu'on la
 * lit par l'autre bout. C'est la meme asymetrie que `SINGLE_SAMPLE_FACTOR` dans
 * `cadence.ts` — une mesure fragile peut servir dans un sens et pas dans l'autre.
 *
 * ## Les quatre garde-fous, et pourquoi aucun n'est negociable
 *
 * La lecon la plus chere du projet est qu'**un conseil exact mais sans portee ne vaut pas
 * mieux que pas de conseil** (`TASKS.md` §1.22 : *Dexter* conseillait de s'arreter avant
 * le dernier huitieme). Transposee ici, elle donne quatre refus :
 *
 * 1. **Passer moins de trois episodes n'est pas un conseil.** « Le pilote est faible » ne
 *    fait renoncer personne : tout le monde regarde le pilote.
 * 2. **Le point doit tomber dans le premier tiers.** « Ca devient bon a la moitie » n'est
 *    pas un demarrage lent, c'est une autre serie — et le dire serait un spoiler deguise
 *    en service.
 * 3. **Il faut assez d'episodes apres** pour que la mediane veuille dire quelque chose.
 * 4. **L'ecart doit depasser le bruit.** Les notes d'episode d'une meme serie tiennent
 *    dans une bande d'environ un point sur dix : un ecart de 0,2 n'est pas un signal.
 *
 * ## Mediane et non moyenne, et « apres » = tout le reste
 *
 * Mediane, pour la meme raison que partout ailleurs ici : un episode culte isole ou un
 * pilote rallonge suffisent a deplacer une moyenne.
 *
 * Et la comparaison porte sur **toute la suite**, jamais sur la fenetre suivante. Comparer
 * a une fenetre trouverait un pic local et annoncerait un decollage la ou il n'y a qu'une
 * bonne passe. Prendre tout le reste rend le conseil litteral : *passez les k premiers, ce
 * qui suit est meilleur.* Effet de bord souhaitable : une serie qui remonte puis
 * s'effondre n'a **pas** de point d'entree, et c'est correct.
 *
 * ## ⚠️ La cinquieme regle, trouvee par les tests : l'episode d'arrivee doit deja etre bon
 *
 * La premiere version maximisait le seul ecart de medianes. Elle conseillait de commencer
 * a un episode **encore mauvais** : la mediane de « tout le reste » est si robuste qu'un
 * episode faible juste apres la coupure ne la deplace pas, et le module gagnait un
 * centieme de point en coupant un episode trop tot.
 *
 * Or le conseil dit litteralement « **a partir d'ici**, c'est bon ». Quelqu'un qui le suit
 * tombe sur cet episode-la en premier ; s'il est mauvais, le conseil est dementi dans la
 * minute. D'ou l'exigence : le premier episode de la partie « apres » doit lui-meme
 * depasser le creux d'au moins {@link MIN_ENTRY_LIFT}.
 *
 * Elle a corrige **deux** cas de test d'un coup — le signe qu'elle decrit une propriete
 * reelle et non un rustine sur un exemple.
 *
 * Module pur : ni reseau, ni horloge, ni langue.
 */

import { MIN_VOTES_FOR_TRUST } from './rating-scale';

/** Une note d'episode du public, telle que le catalogue la rend. */
export interface RatedEpisode {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** Sur 10, comme chez le fournisseur. */
  readonly voteAverage: number;
  readonly voteCount: number;
}

export interface EntryPoint {
  /** Le dernier episode a passer. */
  readonly afterSeason: number;
  readonly afterEpisode: number;
  /**
   * L'episode ou commencer — **c'est lui que l'interface affiche**.
   *
   * Expose plutot que deduit de `afterEpisode + 1` : l'episode suivant peut appartenir a
   * la saison d'apres, et faire cette arithmetique dans la couche de rendu produirait un
   * « S1E11 » sur une saison qui en compte dix.
   */
  readonly startSeason: number;
  readonly startEpisode: number;
  /** Combien d'episodes sont passes. */
  readonly skipped: number;
  /** Mediane sur 10 avant le point. */
  readonly before: number;
  /** Mediane sur 10 de tout ce qui suit. */
  readonly after: number;
}

/** Minimum d'episodes a passer pour que le conseil ait une portee. Voir garde-fou n°1. */
export const MIN_SKIPPED_EPISODES = 3;

/** Minimum d'episodes apres le point, pour que la mediane soit autre chose qu'un hasard. */
export const MIN_EPISODES_AFTER = 6;

/** Part de la serie au-dela de laquelle ce n'est plus un demarrage lent. Garde-fou n°2. */
export const MAX_ENTRY_FRACTION = 1 / 3;

/**
 * Plafond **absolu** d'episodes qu'on peut demander de passer.
 *
 * L'ordre de grandeur d'une saison entiere. Au-dela, « passez les deux premieres
 * saisons » n'est plus un conseil d'entree : c'est une invitation a regarder autre chose,
 * et le produit n'a pas a la formuler a la place du lecteur.
 *
 * ⚠️ **Cette borne est aussi ce qui rend la fonction sure sur les series-fleuves.** Sans
 * elle, la boucle parcourt le tiers de la serie en triant a chaque pas : sur *Detective
 * Conan* et ses ~1100 episodes, cela fait 366 iterations et de l'ordre de huit millions
 * d'operations **a chaque regeneration de page**. La fraction seule ne borne rien, parce
 * qu'elle grandit avec la serie. Trouve a l'audit, et c'est le meme correctif qui
 * repond aux deux problemes — le signe habituel qu'une borne manquait vraiment.
 */
export const MAX_SKIPPED_EPISODES = 25;

/**
 * Ecart minimal, **sur 10**, pour qu'un decollage soit autre chose que du bruit.
 *
 * Un demi-point sur dix, soit exactement `PUBLIC_BREAK_POINT_MIN_DROP` (0,25 etoile sur
 * cinq) transpose sur l'echelle du fournisseur. Le meme seuil des deux cotes : ce qui
 * compte comme une chute doit compter comme une remontee, sinon le produit serait plus
 * severe que genereux sans raison.
 */
export const MIN_ENTRY_LIFT = 0.5;

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Le point ou la serie decolle, s'il y en a un.
 *
 * @param episodes episodes notes, dans n'importe quel ordre.
 * @returns `undefined` quand la serie demarre deja bien, quand le decollage est trop
 *   tardif pour etre un conseil, ou quand les donnees ne permettent pas de trancher.
 *   **Se taire est la reponse la plus frequente, et c'est voulu.**
 */
export function findEntryPoint(episodes: readonly RatedEpisode[]): EntryPoint | undefined {
  // Meme filtre de confiance que partout : un episode a trois votes ne dit rien, et le
  // debut d'une serie obscure en est plein.
  const trusted = [...episodes]
    .filter((e) => e.voteCount >= MIN_VOTES_FOR_TRUST && e.voteAverage > 0)
    .sort((a, b) =>
      a.seasonNumber !== b.seasonNumber
        ? a.seasonNumber - b.seasonNumber
        : a.episodeNumber - b.episodeNumber,
    );

  const total = trusted.length;
  if (total < MIN_SKIPPED_EPISODES + MIN_EPISODES_AFTER) return undefined;

  const latest = Math.min(Math.floor(total * MAX_ENTRY_FRACTION), MAX_SKIPPED_EPISODES);
  let best: EntryPoint | undefined;
  let bestLift = MIN_ENTRY_LIFT;

  for (let cut = MIN_SKIPPED_EPISODES; cut <= latest; cut += 1) {
    if (total - cut < MIN_EPISODES_AFTER) break;

    const before = median(trusted.slice(0, cut).map((e) => e.voteAverage));
    const after = median(trusted.slice(cut).map((e) => e.voteAverage));
    if (before === undefined || after === undefined) continue;

    // L'episode ou l'on demande a quelqu'un de commencer doit deja etre bon : c'est le
    // premier qu'il verra, et un conseil dementi dans la minute est pire que pas de
    // conseil. Voir la cinquieme regle en tete de module.
    const arrival = trusted[cut];
    if (arrival === undefined || arrival.voteAverage - before < MIN_ENTRY_LIFT) continue;

    const lift = after - before;
    // `>` strict : a egalite on garde le point le plus **precoce**, parce qu'un conseil
    // qui fait passer moins d'episodes est toujours le meilleur des deux.
    if (lift > bestLift) {
      bestLift = lift;
      const last = trusted[cut - 1];
      if (last === undefined) continue;
      best = {
        afterSeason: last.seasonNumber,
        afterEpisode: last.episodeNumber,
        startSeason: arrival.seasonNumber,
        startEpisode: arrival.episodeNumber,
        skipped: cut,
        before,
        after,
      };
    }
  }

  return best;
}

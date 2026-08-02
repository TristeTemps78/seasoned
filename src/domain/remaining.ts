/**
 * Ce qu'il reste a voir, chiffre.
 *
 * ## Le trou que ce module comble
 *
 * Le differenciateur du produit est le **chiffre** : « ~62 h », « en attente · 11 mois ».
 * Il ne parlait pourtant qu'aux arrivants — quelqu'un qui n'a jamais vu la serie. Des
 * qu'on en a regarde la moitie, l'engagement total (`Engagement`, en tete de page)
 * devient faux pour soi : il annonce un cout deja paye.
 *
 * Or c'est precisement au milieu d'une serie qu'on se pose la question. « Est-ce que je
 * finis *The Walking Dead* ? » n'est pas « combien fait-elle en tout », c'est **combien
 * il m'en reste**. Le produit avait le chiffre et ne savait pas le soustraire.
 *
 * ## Trois decisions, et leurs motifs
 *
 * 1. **La position est inclusive.** « J'en suis a S3E5 » veut dire que S3E5 est vu ;
 *    le reste commence a S3E6. C'est le contrat pose par `RATING-MODEL.md` §7 (« la
 *    position est un pointeur, tout ce qui precede est implicitement vu »), et s'en
 *    ecarter ici decalerait tous les comptes d'un episode.
 *
 * 2. **On ne compte que les saisons donnees.** L'appelant transmet `rateable`, d'ou
 *    les saisons annoncees mais non diffusees sont **deja** exclues
 *    (`seasons.ts` : « mieux vaut ne pas proposer de noter que proposer de noter du
 *    vide »). Ce module n'a donc pas a redecider ce que le domaine a deja tranche —
 *    et ne doit surtout pas le refaire differemment.
 *
 *    ⚠️ Reste un cas assume : une saison **en cours** de diffusion compte tous ses
 *    episodes annonces. « Il vous reste 4 episodes » est vrai, « 3 h 20 » suppose
 *    qu'on peut les regarder tout de suite. C'est le statut affiche juste au-dessus qui
 *    porte cette nuance ; la repeter ici encombrerait le seul chiffre qui compte.
 *
 * 3. **Une position hors catalogue ne fait rien exploser.** Les decoupages en saisons
 *    changent (`seasons.ts` en entier existe pour ca) : une position peut pointer une
 *    saison disparue ou un episode au-dela du compte connu. On degrade, on ne casse
 *    pas (`AGENTS.md` regle 4).
 *
 * Module pur : ni reseau, ni horloge, ni langue.
 */

/** Le minimum qu'il faut savoir d'une saison pour compter ce qui reste. */
export interface SeasonSize {
  readonly seasonNumber: number;
  readonly episodeCount: number;
}

/** Ou en est le spectateur. Inclusif : cet episode-la est vu. */
export interface WatchPosition {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
}

export interface Remaining {
  /** Episodes restants, jamais negatif. */
  readonly episodes: number;
  /** Duree restante estimee, absente si l'on ignore la duree d'un episode. */
  readonly minutes?: number;
  /** Plus rien devant : le dernier episode connu est derriere nous. */
  readonly done: boolean;
}

/**
 * Ce qu'il reste apres la position.
 *
 * @param seasons saisons notables, dans n'importe quel ordre.
 * @param position position declaree. Absente, la question n'a pas de sens : on rend
 *   `undefined` plutot que le total, qui est deja affiche ailleurs et repondrait a une
 *   autre question.
 * @param episodeMinutes duree mediane d'un episode. Absente, on rend le compte sans la
 *   duree — la moitie d'une reponse vaut mieux qu'un chiffre invente.
 */
export function remainingAfter(
  seasons: readonly SeasonSize[],
  position: WatchPosition | undefined,
  episodeMinutes?: number,
): Remaining | undefined {
  if (position === undefined) return undefined;

  const known = [...seasons]
    .filter((s) => Number.isFinite(s.seasonNumber) && s.episodeCount > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  if (known.length === 0) return undefined;

  let episodes = 0;
  for (const season of known) {
    if (season.seasonNumber < position.seasonNumber) continue;
    if (season.seasonNumber > position.seasonNumber) {
      episodes += season.episodeCount;
      continue;
    }
    // La saison courante : ce qui suit l'episode declare. `Math.max` protege du cas
    // ou la position depasse le compte connu — decoupage revise chez le fournisseur,
    // ou episode declare a la main.
    episodes += Math.max(0, season.episodeCount - position.episodeNumber);
  }

  return {
    episodes,
    done: episodes === 0,
    ...(episodeMinutes !== undefined && episodeMinutes > 0
      ? { minutes: Math.round(episodes * episodeMinutes) }
      : {}),
  };
}

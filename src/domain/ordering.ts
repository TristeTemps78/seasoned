/**
 * Les decoupages concurrents d'une serie, et quand il faut le dire.
 *
 * ## Le probleme, mesure et non suppose
 *
 * Une serie n'a pas **un** decoupage en saisons. TMDB en sert un par defaut et en connait
 * d'autres. Chiffres releves contre l'API reelle le 2026-08-03 :
 *
 * | Serie | Defaut TMDB | Ailleurs |
 * |---|---|---|
 * | *Money Heist* | **3 saisons, 41 episodes** | Netflix : **5 parts, 48 episodes** |
 * | *One Piece* | 23 saisons, 1181 ep. (une de **197**) | TVDB : 24 groupes, 1210 ep. |
 * | *Breaking Bad* | 5 saisons, 62 ep. | DVD : 6 groupes, 62 ep. |
 *
 * Quelqu'un qui dit « je suis saison 4 » de *Money Heist* designe une saison **qui n'existe
 * pas** dans notre modele. Et « il vous reste X episodes · Y heures » se trompe de **17 %**.
 *
 * ## Pourquoi ce module signale au lieu de corriger
 *
 * Le reflexe serait de proposer un selecteur d'ordre et de recalculer. C'est faire compliqué
 * avant de savoir, et surtout ce serait **reparer en silence** —. Un
 * decoupage choisi a notre place deplacerait des notes deja posees par saison, ce qui est
 * irrattrapable ; un avertissement, non.
 *
 * Donc : ce module ne convertit **rien**. Il repond a une seule question — *« existe-t-il un
 * decoupage assez different de celui qu'on affiche pour que nos chiffres induisent en
 * erreur ? »* — et laisse l'interface le dire.
 *
 * ## Ce que le silence signifie
 *
 * Rendre `undefined` est le cas courant et **c'est voulu** : la plupart des series n'ont
 * aucun decoupage concurrent, et un avertissement qui s'affiche partout n'apprend plus rien.
 * Meme regle que le point d'arret, le verdict de saison et le bilan — *la feature se tait
 * quand elle n'a rien a dire.*
 *
 * Module pur : aucun import de fournisseur, aucun acces reseau, aucune horloge.
 */

/** La forme que **nous** affichons : celle du decoupage par defaut du fournisseur. */
export interface DefaultShape {
  /** Saisons regulieres, saison 0 exclue — c'est ce que les calculs utilisent. */
  readonly seasonCount: number;
  readonly episodeCount: number;
}

/** Un decoupage concurrent, tel qu'un fournisseur le decrit. */
export interface CandidateOrdering {
  readonly id: string;
  readonly name: string;
  /** Nature codee par le fournisseur. Voir {@link AIRED_ORDER_KIND}. */
  readonly kind?: number;
  readonly kindName?: string;
  readonly groupCount: number;
  readonly episodeCount: number;
}

/** Un decoupage juge assez different pour meriter d'etre signale. */
export interface DivergentOrdering extends CandidateOrdering {
  /** `episodeCount` du candidat moins celui du defaut. Signe : negatif = il en compte moins. */
  readonly episodeGap: number;
  /** `groupCount` moins le nombre de saisons du defaut. */
  readonly groupGap: number;
}

/**
 * Ecart relatif d'episodes en deca duquel on se tait.
 *
 * 5 % : au-dela, la difference se voit dans un chiffre que le produit affiche — « il vous
 * reste 15 episodes » contre 16, « 11 h 15 » contre 13 h. En deca, c'est presque toujours
 * un episode special ou un recapitulatif compte d'un cote et pas de l'autre, ce qui ne
 * change aucun conseil.
 *
 * Seuil heuristique, comme tous ceux du projet : il produit un **avertissement**, jamais une
 * conversion. Se tromper vers le silence coute un avertissement manque ; se tromper vers le
 * bruit apprend a ne plus lire les avertissements.
 */
export const MIN_EPISODE_DIVERGENCE = 0.05;

/**
 * Nature « ordre de diffusion d'origine » chez le fournisseur — donc **le meme axe que le
 * defaut**, et pas un decoupage concurrent.
 *
 * ## Pourquoi cette exclusion existe, et comment elle a ete trouvee
 *
 * Elle n'etait pas dans la premiere version. En faisant tourner la vraie chaine contre
 * l'API, *Game of Thrones* a produit un avertissement : « Aired Order, +29 episodes,
 * +1 saison » — 102 contre 73. Or c'est **l'ordre de diffusion**, celui qu'on affiche deja ;
 * les 29 episodes de plus sont des speciaux et des recapitulatifs comptes d'un cote et pas
 * de l'autre. Annoncer un « autre decoupage » a quelqu'un qui regarde *Game of Thrones*
 * serait faux.
 *
 * Le prix de l'exclusion est connu et accepte : l'« ordre TVDB » de *One Piece*, qui est un
 * vrai redecoupage, porte aussi cette nature et disparait donc. Mais *One Piece* remonte
 * **quatorze autres** decoupages, donc rien n'est perdu la ou ca compte — et l'exclusion
 * supprime une classe entiere de faux positifs.
 *
 * > Ce que ce reglage illustre : **les captures ne suffisent pas.** Mes fixtures venaient de
 * > l'API reelle et etaient justes ; c'est le *comportement d'ensemble* sur quatre series qui
 * > a montre le defaut. Auditer le resultat, jamais l'intention.
 */
export const AIRED_ORDER_KIND = 1;

/**
 * Nombre de decoupages nommes dans l'avertissement.
 *
 * ## Pourquoi une limite
 *
 * Egalement trouve en faisant tourner la vraie chaine : *One Piece* remonte **dix-huit**
 * decoupages, dont dix-sept divergents — Funimation, Hulu, Netflix Seasons, Crunchyroll,
 * arcs, sagas, DVD allemand… Un bandeau qui les liste tous n'apprend rien et n'est pas
 * lisible. Or l'anime est **precisement** la categorie ou l'avertissement est le plus utile :
 * le rendre illisible la ou il sert le plus serait le pire des deux mondes.
 *
 * Trois : de quoi montrer qu'il existe plusieurs conventions et nommer les plus ecartees,
 * sans transformer une mise en garde en catalogue. {@link OrderingNotice.total} porte le
 * compte reel, pour que l'interface puisse dire « et onze autres » sans mentir.
 */
export const MAX_NAMED_ORDERINGS = 3;

/** Ce qu'il y a a dire sur les decoupages concurrents d'une serie. */
export interface OrderingNotice {
  /**
   * Les plus ecartes, au plus {@link MAX_NAMED_ORDERINGS}. Jamais vide — quand il n'y a rien
   * a signaler, c'est l'avertissement entier qui vaut `undefined`.
   */
  readonly named: readonly DivergentOrdering[];
  /** Combien divergent en tout, y compris ceux qui ne sont pas nommes. */
  readonly total: number;
}

/**
 * Les decoupages qui contredisent celui qu'on affiche.
 *
 * Un candidat est retenu s'il diverge sur **l'un** des deux axes, parce que les deux cassent
 * des choses differentes :
 *
 *   - **le nombre d'episodes** fausse les totaux — temps restant, plan de rattrapage, bilan ;
 *   - **le nombre de groupes** fausse l'**axe** des conseils par saison : « arrete-toi apres
 *     la saison 3 » ne veut rien dire si l'interlocuteur en compte cinq. L'ecart d'episodes
 *     peut y etre nul — *Breaking Bad* a 62 episodes dans les deux cas et 5 saisons contre 6.
 *
 * Les decoupages de nature {@link AIRED_ORDER_KIND} sont ignores : ils decrivent le meme axe
 * que le defaut.
 *
 * @param shape la forme affichee. Un `seasonCount` ou `episodeCount` non positif rend
 *   `undefined` : sans reference, il n'y a rien a comparer, et inventer une base ferait
 *   diverger tout le monde.
 * @returns l'avertissement, ou `undefined` s'il n'y a rien a signaler — le cas courant.
 *   Jamais un avertissement a liste vide : « rien a dire » et « voici une liste vide » se
 *   traitent differemment a l'appel.
 */
export function findDivergentOrderings(
  shape: DefaultShape,
  candidates: readonly CandidateOrdering[],
): OrderingNotice | undefined {
  if (!Number.isFinite(shape.episodeCount) || shape.episodeCount <= 0) return undefined;
  if (!Number.isFinite(shape.seasonCount) || shape.seasonCount <= 0) return undefined;

  const divergent: DivergentOrdering[] = [];

  for (const candidate of candidates) {
    if (candidate.kind === AIRED_ORDER_KIND) continue;
    if (!Number.isFinite(candidate.episodeCount) || candidate.episodeCount <= 0) continue;
    if (!Number.isFinite(candidate.groupCount) || candidate.groupCount <= 0) continue;

    const episodeGap = candidate.episodeCount - shape.episodeCount;
    const groupGap = candidate.groupCount - shape.seasonCount;

    const episodesDiverge =
      Math.abs(episodeGap) / shape.episodeCount > MIN_EPISODE_DIVERGENCE;
    const groupsDiverge = groupGap !== 0;
    if (!episodesDiverge && !groupsDiverge) continue;

    divergent.push({ ...candidate, episodeGap, groupGap });
  }

  if (divergent.length === 0) return undefined;

  // Le plus gros ecart d'abord : c'est celui dont la mention est la plus utile, et
  // `id` departage pour que deux rendus donnent le meme ordre.
  divergent.sort(
    (a, b) =>
      Math.abs(b.episodeGap) - Math.abs(a.episodeGap) ||
      Math.abs(b.groupGap) - Math.abs(a.groupGap) ||
      a.id.localeCompare(b.id),
  );

  return { named: divergent.slice(0, MAX_NAMED_ORDERINGS), total: divergent.length };
}

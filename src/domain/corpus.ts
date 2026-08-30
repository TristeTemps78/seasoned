/**
 * Ce qui a le droit d'entrer dans le corpus d'un quiz **sur les series**.
 *
 * ## Pourquoi cette regle sort du script
 *
 * Elle vivait dans `scripts/build-round.mjs`, sous la forme d'un `filter` de trois lignes —
 * donc sans un seul test, alors qu'elle decide de **tout** ce qu'un joueur voit. C'est le
 * meme mouvement que `draw.ts` et `handles.ts` : le domaine tranche, l'outillage execute.
 *
 * ## Deux bornes, et elles ne disent pas la meme chose
 *
 * ### Ce qui n'est pas une serie (genres)
 *
 * 🔴 Constate a la premiere manche construite : elle portait sur *Secret Story*, *Paradise
 * Hotel* et *The Late Show*. TMDB range la tele-realite, les talk-shows et les journaux
 * televises parmi les « TV shows » — ce produit, lui, parle de **series** (arbitrage A13).
 *
 * Mesure du 2026-08-30, sur les trois premieres pages de `/tv/popular` : **14 des 60**
 * entrees tombent ici, et les 46 qui restent sont **toutes** de type `Scripted` selon la
 * fiche detaillee. Ce filtre-la fait donc exactement son travail — verifie, parce que je
 * m'appretais a ecrire le contraire en lisant une liste non filtree.
 *
 * ### Ce que personne n'a vu (votes)
 *
 * 🔴 Ce qui manquait, et qui se lit dans les manches construites le 2026-08-30 : *Capitão
 * Furacão* (**0** vote), *Ninaithen Vandhai* (0), *The Daily Fable* (5), *Souryo to Majiwaru
 * Shikiyoku no Yoru ni...* (15), *Among Friends* (20), *Gute Zeiten, schlechte Zeiten* (49).
 * Six series sur 46, et elles cassent le quiz de trois facons a la fois :
 *
 * - **comme reponse**, la question n'est devinable par personne ;
 * - **comme leurre** — et c'est le plus couteux, parce qu'un leurre est tire dans le meme
 *   vivier : trois titres inconnus autour d'une reponse connue **donnent** la reponse. Le
 *   script dit vouloir des leurres « credibles et varies » ; il n'en avait que la moitie ;
 * - **comme note**, la famille `rating` demande la note globale d'une serie. Celle d'un
 *   titre a 1 vote (« 9.0 ») ou a 5 votes n'est pas une note, c'est un bruit.
 *
 * Le seuil est a 100 parce que le vivier a **un trou reel a cet endroit** : le titre suivant
 * est *Kamen Rider* a 105 votes, puis *Lanterns* a 188. Rien entre 49 et 105 — on ne coupe
 * donc pas dans une pente. Il reste 40 series, tres au-dessus des 8 qu'une manche demande.
 *
 * ## ⚠️ Ce n'est PAS un filtre de contenu adulte, et ce n'est pas faute d'avoir cherche
 *
 * Le titre a 15 votes ci-dessus est un hentai, et il est sorti dans trois des quatorze
 * manches construites le 2026-08-30. Le plancher l'ecarte **par accident** — un porno
 * populaire passerait. Les trois axes qui auraient dit « adulte » ont ete mesures le meme
 * jour, et aucun ne separe :
 *
 * - `adult` de TMDB vaut **`false`** sur cette fiche (et sur les 60 du vivier) ;
 * - le mot-cle `erotic` le marque, **et marque aussi** *Mushoku Tensei* ; `adult animation`
 *   marque *Les Simpson*, *Rick et Morty*, *American Dad* ; `sex*` marque *New York Unite
 *   Speciale* ;
 * - la classification par pays le marque `DE=18`, **et marque aussi** *The Walking Dead*,
 *   *Dexter*, *FROM* ; sur `US=TV-MA` elle emporte *Breaking Bad*, *Game of Thrones*,
 *   *House of the Dragon* et jusqu'a *Ted Lasso*.
 *
 * Filtrer la-dessus supprimerait le coeur d'un produit sur les series pour attraper un
 * titre. La piste est donc **ecartee, pas oubliee** : le jour ou elle se repose, la reponse
 * sera une liste d'identifiants tenue a la main, comme les genres ci-dessus — pas un axe
 * TMDB qui n'existe pas.
 *
 * Module pur : ni reseau, ni horloge.
 */

/** Ce que `/tv/popular` rend et qui n'est pas une serie : journaux, tele-realite, talk-shows. */
export const NOT_A_SERIES: ReadonlySet<number> = new Set([10763, 10764, 10767]);

/** Le plancher de votes — voir l'en-tete pour le trou de 49 a 105 qui le place ici. */
export const ENOUGH_EYES = 100;

/** Ce que le corpus lit d'une entree TMDB. Le reste ne le regarde pas. */
export type Candidate = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly genre_ids?: readonly number[];
  readonly vote_count?: unknown;
};

/**
 * Cette serie peut-elle porter une question — ou servir de leurre a une autre ?
 *
 * ⚠️ **La meme regle pour les deux**, et c'est voulu : un leurre invraisemblable est une
 * reponse offerte. Le vivier est unique, la borne aussi.
 */
export function eligible(one: Candidate | undefined): boolean {
  if (one === undefined) return false;
  if (typeof one.name !== 'string' || one.name.trim() === '') return false;
  if (typeof one.id !== 'number') return false;
  if ((one.genre_ids ?? []).some((genre) => NOT_A_SERIES.has(genre))) return false;
  return typeof one.vote_count === 'number' && one.vote_count >= ENOUGH_EYES;
}

/**
 * Le temps passe, chiffre — le differenciateur du produit retourne vers soi.
 *
 * ## Ce que ce module repond
 *
 * Le produit sait dire ce qu'une serie **demande** (« ~62 h ») et ce qu'il vous en
 * **reste** (`remaining.ts`). Il ne savait pas dire ce que vous avez **deja donne**. C'est
 * pourtant la meme grandeur, et la seule que personne ne vous rend gratuitement : chez le
 * leader du domaine voisin, ces statistiques sont derriere un abonnement, au point que des
 * tiers ecrivent leurs propres outils pour les remplacer.
 *
 * Ici le calcul ne coute rien a personne : il se fait dans le navigateur, sur des donnees
 * qui n'ont jamais quitte l'appareil. C'est le seul endroit du produit ou etre gratuit est
 * un argument **structurel** et non une generosite.
 *
 * ## Les deux regles qui font toute la difficulte
 *
 * 1. **Ne jamais compter un episode deux fois.** La position n'est pas effacee quand on
 *    marque une serie terminee : elle reste au dernier episode. Naivement, « les passages
 *    acheves + la position » compterait donc la derniere saison en double sur toute serie
 *    finie. La position n'est prise en compte que si elle est **posterieure** au dernier
 *    passage acheve — c'est-a-dire si elle appartient a un nouveau visionnage. C'est
 *    exactement l'usage pour lequel la v2 a rendu la date obligatoire sur chaque fait.
 * 2. **Le chiffre est un minorant, et le module doit le prouver.** Il rend donc ce qu'il
 *    n'a **pas** pu compter, pour que la couche d'affichage puisse etre honnete au lieu de
 *    faire passer un minorant pour un total.
 *
 * Module **pur** : ni reseau, ni horloge implicite (`AGENTS.md` regle 2). L'instant de
 * reference est injecte, comme pour `buildLibrary` et `buildTasteProfile`.
 */

import {
  completionCount,
  freshSnapshot,
  marksOf,
  seriesEntries,
  type Journal,
  type JournalEntry,
  type JournalKey,
} from './journal';
import {
  classifyMarks,
  remainingAfter,
  type EpisodeMark,
  type SeasonSize,
  type WatchPosition,
} from './remaining';

/**
 * Part des series vues qu'il faut avoir pu chiffrer pour oser annoncer un total.
 *
 * La moitie. En dessous, « au moins 3 heures » annonce a quelqu'un qui a vu quarante
 * series n'est plus un minorant prudent : c'est un mensonge par omission, et le produit
 * s'interdit ailleurs exactement cela (`MIN_STOP_POINT_SAVING` — un conseil exact mais
 * sans portee ne vaut pas mieux que pas de conseil).
 */
export const MIN_TALLY_COVERAGE = 0.5;

/**
 * Total en deca duquel il n'y a rien a annoncer : une heure.
 *
 * La couverture seule ne suffit pas — une unique serie chiffree sur une seule donne 100 %
 * de couverture pour un chiffre qui n'apprend rien.
 */
export const MIN_TALLY_MINUTES = 60;

/** La serie qui pese le plus lourd dans le total. */
export interface HeaviestSeries {
  readonly key: JournalKey;
  readonly title: string;
  readonly minutes: number;
  /** Nombre de visionnages complets — ce qui explique un total inhabituel. */
  readonly passes: number;
}

export interface Tally {
  /** Episodes vus, tous passages confondus, sur les series chiffrables. */
  readonly episodes: number;
  /** Minutes correspondantes. Zero n'est pas une absence : c'est zero. */
  readonly minutes: number;
  /** Series qui ont contribue au total. */
  readonly counted: number;
  /**
   * Series ou l'on a regarde quelque chose sans pouvoir le chiffrer.
   *
   * Trois causes, toutes normales : l'instantane a expire (plafond contractuel), la serie
   * n'a pas ete revisitee depuis que le journal memorise sa forme, ou le catalogue ignore
   * la duree de ses episodes — le cas courant, pas l'exception.
   */
  readonly uncounted: number;
  /** Part chiffree des series vues, entre 0 et 1. Vaut 0 quand rien n'a ete vu. */
  readonly coverage: number;
  /** Vrai quand le total merite d'etre annonce. Voir les deux seuils ci-dessus. */
  readonly worthShowing: boolean;
  readonly heaviest?: HeaviestSeries;
}

/** Un instant lisible, ou `undefined`. Jamais une exception sur une date cassee. */
function instant(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? undefined : at;
}

/**
 * A-t-on regarde quelque chose de cette serie ?
 *
 * « Je veux la voir » n'en fait pas partie : ne pas pouvoir chiffrer une serie qu'on n'a
 * jamais commencee n'est pas un manque, et la compter au denominateur ferait baisser la
 * couverture pour rien.
 */
function wasWatched(entry: JournalEntry): boolean {
  if (entry.position !== undefined) return true;
  if (completionCount(entry) > 0) return true;
  const kind = entry.decision?.kind;
  return kind === 'completed' || kind === 'abandoned';
}

/**
 * Ou en etait-on quand on s'est arrete.
 *
 * La position d'abord ; a defaut, le point ou la decision a ete prise — `setDecision`
 * l'enregistre precisement pour ne pas perdre cette information quand la position est
 * ensuite effacee.
 */
function stoppedAt(entry: JournalEntry): WatchPosition | undefined {
  if (entry.position !== undefined) return entry.position;
  const { atSeason, atEpisode } = entry.decision ?? {};
  if (atSeason === undefined || atEpisode === undefined) return undefined;
  return { seasonNumber: atSeason, episodeNumber: atEpisode };
}

/**
 * Nombre de visionnages menes au bout.
 *
 * Un journal v2 migre n'a pas de liste de passages : une decision « terminee » y vaut un
 * passage, sans quoi tout ce qui a ete fini avant la v3 compterait pour rien.
 */
function passesOf(entry: JournalEntry): number {
  const recorded = completionCount(entry);
  if (recorded > 0) return recorded;
  return entry.decision?.kind === 'completed' ? 1 : 0;
}

/**
 * La position appartient-elle a un passage en cours, ou n'est-elle qu'un vestige ?
 *
 * Voir la regle n°1 en tete de module. Une position sans date lisible est traitee comme
 * un vestige : l'erreur va vers la sous-estimation, ce qui est le sens qu'on veut.
 */
function positionIsNewPass(entry: JournalEntry, passes: number): boolean {
  if (passes === 0) return true;
  const declaredAt = instant(entry.position?.declaredAt);
  if (declaredAt === undefined) return false;

  const completedAt = [
    ...(entry.completions ?? []).map((c) => instant(c.at)),
    // Le journal v2 n'a pas de passage enregistre : c'est la decision qui date la fin.
    ...(completionCount(entry) === 0 ? [instant(entry.decision?.at)] : []),
  ].filter((at): at is number => at !== undefined);

  if (completedAt.length === 0) return true;
  return declaredAt > Math.max(...completedAt);
}

/**
 * Episodes vus dans une serie, tous passages confondus.
 *
 * ## 🔴 Pourquoi les marques n'entrent PAS par `remainingAfter`
 *
 * Ce compte procede par soustraction : `vus = total − restant`. C'est ce qui rend le piege
 * des exceptions non evident — passer les marques a `remainingAfter` ferait baisser le
 * restant, donc **monter les episodes vus**, y compris pour un episode explicitement
 * SAUTE. On compterait comme regarde ce que la personne vient de declarer ne pas avoir
 * regarde, et le symptome serait un bilan legerement flatteur que rien ne contredit.
 *
 * Les deux sens sont donc appliques ici, separement et nommement :
 *
 *   + `aheadAfter`    vu en avance, au-dela du pointeur → **en plus**
 *   − `skippedBefore` saute en deca, donc compte a tort par le pointeur → **en moins**
 *   ∅ `skippedAfter`  saute devant : jamais vu, et pas encore compte → sans effet
 */
function episodesOf(
  entry: JournalEntry,
  sizes: readonly SeasonSize[],
  marks: readonly EpisodeMark[],
): number {
  const total = sizes.reduce((sum, s) => sum + s.episodeCount, 0);
  const passes = passesOf(entry);

  let episodes = passes * total;
  if (positionIsNewPass(entry, passes)) {
    const position = stoppedAt(entry);
    // ⚠️ Sans marques : le restant brut, exactement comme avant.
    const left = remainingAfter(sizes, position);
    if (left !== undefined) {
      const { aheadAfter, skippedBefore } = classifyMarks(marks, position);
      const seen = total - left.episodes + aheadAfter.length - skippedBefore.length;
      episodes += Math.max(0, Math.min(total, seen));
    }
  }
  return episodes;
}

/**
 * Ce que vous avez donne, en episodes et en minutes.
 *
 * Ne lit que le journal : aucun appel, donc utilisable dans une page statique et hors
 * ligne. Une serie dont l'instantane a expire, ou qui n'a pas ete revisitee depuis que le
 * journal memorise la forme des series, est comptee comme **non chiffrable** — jamais
 * estimee au jugé.
 */
export function buildTally(journal: Journal, now: Date = new Date()): Tally {
  let episodes = 0;
  let minutes = 0;
  let counted = 0;
  let uncounted = 0;
  let heaviest: HeaviestSeries | undefined;

  // A13 : un film n'a ni saison ni `seasonSizes`. Sans ce filtre il serait compte
  // comme « non comptable » et ferait chuter le taux de couverture, donc silencieusement
  // taire le bilan sous 50 %. Faire compter les films est une decision separee.
  for (const [key, entry] of seriesEntries(journal)) {
    if (!wasWatched(entry)) continue;

    const snapshot = freshSnapshot(entry, now);
    const sizes = snapshot?.seasonSizes;
    const perEpisode = snapshot?.episodeMinutes;
    if (snapshot === undefined || sizes === undefined || perEpisode === undefined) {
      uncounted += 1;
      continue;
    }

    const seen = episodesOf(entry, sizes, marksOf(entry));
    if (seen === 0) {
      // Vue, mais rien de comptable : une decision « abandonnee » sans position connue.
      // Elle n'est pas un manque de donnees — la compter comme tel ferait chuter la
      // couverture sans qu'aucun instantane soit en cause.
      counted += 1;
      continue;
    }

    const spent = seen * perEpisode;
    episodes += seen;
    minutes += spent;
    counted += 1;

    if (heaviest === undefined || spent > heaviest.minutes) {
      heaviest = {
        key,
        title: snapshot.title,
        minutes: Math.round(spent),
        passes: passesOf(entry),
      };
    }
  }

  const watched = counted + uncounted;
  const coverage = watched === 0 ? 0 : counted / watched;

  return {
    episodes,
    minutes: Math.round(minutes),
    counted,
    uncounted,
    coverage,
    worthShowing: coverage >= MIN_TALLY_COVERAGE && minutes >= MIN_TALLY_MINUTES,
    ...(heaviest !== undefined ? { heaviest } : {}),
  };
}

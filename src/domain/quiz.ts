/**
 * Le quiz personnel : « que regardiez-vous le 7 janvier ? »
 *
 * ## Pourquoi cette feature-la, et pas une autre
 *
 * Elle se calcule **entierement sur le journal local**. Zero appel reseau, zero compte,
 * zero moderation, et elle marche hors ligne. C'est la seule chose que ce produit puisse
 * offrir qui donne envie de revenir **sans coute par utilisateur** — le cout marginal
 * etant precisement ce qui a tue TV Time.
 *
 * Et elle est structurellement incopiable : il faut *votre* journal. Un concurrent peut
 * copier une page serie, pas votre memoire.
 *
 * ## 🔴 Les faits importes sont ecartes, et c'est le coeur du module
 *
 * Un import depose des series avec la date **de l'import**, pas celle du visionnage. Une
 * question batie dessus serait fausse au sens fort : elle affirmerait « le 3 aout vous
 * regardiez Dark » alors que le 3 aout on a clique sur « importer ».
 *
 * C'est le meme raisonnement que `face.ts`, et c'est le seul qui tienne : **on choisit la
 * matiere plutot que d'ajouter une heuristique**. `origin: 'import'` marque ces faits ; on
 * ne garde que ce qui n'en porte pas.
 *
 * ## Deux pieges qui rendraient le quiz faux, pas seulement moche
 *
 * 1. **Un jour ou deux series ont un fait a deux bonnes reponses.** La question serait
 *    injuste et le joueur aurait raison de se sentir vole. Ces jours sont ecartes.
 * 2. **Un titre inconnu.** Le journal ne porte le titre que si un instantane a ete depose
 *    en visitant la fiche. Sans lui on afficherait `tmdb:1396`. Ces entrees ne peuvent etre
 *    ni reponse ni leurre.
 *
 * ## Le hasard est **injecte**, jamais tire ici
 *
 * Un `Math.random()` rendrait le module intestable et la question changerait a chaque
 * rendu — donc a chaque frappe au clavier dans React. La graine vient de l'appelant, et
 * l'usage prevu est **le jour courant** : la question est alors stable toute la journee et
 * change demain. C'est ce qui en fait un rendez-vous plutot qu'un gadget.
 *
 * Module pur : ni reseau, ni horloge implicite — l'instant de reference est injecte.
 */

import { seriesEntries, type Journal, type JournalKey } from './journal';

/** Un choix propose : la cle sert de reponse, le titre est ce qu'on lit. */
export interface QuizChoice {
  readonly key: JournalKey;
  readonly title: string;
}

/** Un point de la courbe montree par une question `byCurve`. */
export interface CurvePoint {
  readonly season: number;
  readonly stars: number;
}

/**
 * Une question posee.
 *
 * ## Pourquoi un type discrimine plutot qu'une question unique
 *
 * Les variantes n'ont pas la meme **matiere** : l'une part d'un jour, l'autre d'une forme.
 * Les fondre dans un seul objet a champs optionnels obligerait chaque appelant a deviner
 * laquelle il tient, et le jour ou une troisieme arrive, c'est l'ecran qui se trompe en
 * silence. Le discriminant force le compilateur a poser la question.
 *
 * ⚠️ **Ce qui n'est PAS ici, et pourquoi** : les questions baties sur le casting ou sur
 * les notes des autres exigent le reseau — la premiere un appel catalogue par question, la
 * seconde des donnees sociales que la base ne porte pas encore. Elles ne peuvent pas vivre
 * dans ce module, qui est pur **par construction** et c'est ce qui le rend gratuit et
 * hors ligne. Elles viendront par-dessus, jamais dedans.
 */
export type QuizQuestion =
  | {
      readonly kind: 'onDay';
      /** Le jour sur lequel porte la question, `YYYY-MM-DD`. */
      readonly on: string;
      readonly answer: JournalKey;
      /** Quatre propositions, deja melangees. */
      readonly choices: readonly QuizChoice[];
    }
  | {
      readonly kind: 'byCurve';
      /** La trajectoire, saison par saison — le differenciateur du produit, retourne en jeu. */
      readonly curve: readonly CurvePoint[];
      readonly answer: JournalKey;
      readonly choices: readonly QuizChoice[];
    }
  | {
      readonly kind: 'byEpisodes';
      /** Les notes d'une **seule** saison, episode par episode. */
      readonly episodes: readonly CurvePoint[];
      readonly answer: JournalKey;
      readonly choices: readonly QuizChoice[];
    };

/** Combien de series titrees il faut avant qu'une question ait un sens. */
const ENOUGH_SERIES = 4;

/**
 * Combien de saisons notees il faut pour qu'une courbe soit reconnaissable.
 *
 * ⚠️ A deux points une trajectoire n'est qu'un segment : monte ou descend. Tous les
 * segments se ressemblent, donc la question serait un tirage au sort deguise. C'est le
 * meme seuil que `trajectory.ts` applique pour parler de « constance » — on ne juge pas
 * une forme sur deux points.
 */
const ENOUGH_SEASONS = 3;

/**
 * Combien d'episodes notes il faut dans une **meme** saison pour la reconnaitre.
 *
 * Plus haut que le seuil des saisons, et pour une raison : une note d'episode est
 * **facultative** (arbitrage A7), donc trois notes eparses ne dessinent pas une saison,
 * elles dessinent trois humeurs. A cinq, la forme commence a dire quelque chose.
 */
const ENOUGH_EPISODES = 5;

/**
 * L'age minimal d'un souvenir, en jours.
 *
 * ⚠️ Une question sur hier n'est pas fausse, elle est **sans interet** : personne n'a
 * oublie ce qu'il regardait hier, et une question dont la reponse est evidente apprend a
 * ne plus jouer. Le plaisir est dans le souvenir, donc on laisse le souvenir se former.
 */
const OLD_ENOUGH_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * Un generateur deterministe, parce qu'un test doit pouvoir predire la question.
 *
 * Le detail des constantes importe peu — ce qui compte est qu'une meme graine rende
 * toujours la meme suite, et que deux graines voisines ne rendent pas la meme.
 */
function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le jour d'un instant ISO. Les faits du journal sont dates a la seconde ; on compare au jour. */
function dayOf(instant: string): string {
  return instant.slice(0, 10);
}

/**
 * Les jours ou l'on a **vecu** quelque chose sur cette serie.
 *
 * Ne retient que les gestes qui disent « je la regardais » : declarer sa position, noter
 * une saison, decider, revoir. `wanted` en est exclu — vouloir voir une serie n'est pas la
 * regarder, et une question batie dessus se tromperait de verbe.
 */
function livedDays(entry: {
  readonly position?: { readonly declaredAt: string; readonly origin?: string };
  readonly seasonRatings?: Readonly<Record<string, { readonly at: string; readonly origin?: string }>>;
  readonly decision?: { readonly at: string; readonly origin?: string };
  readonly completions?: readonly { readonly at: string; readonly origin?: string }[];
}): readonly string[] {
  const days: string[] = [];
  const keep = (fact: { readonly at?: string; readonly declaredAt?: string; readonly origin?: string } | undefined) => {
    if (fact === undefined) return;
    // 🔴 La marque d'import ecarte le fait. Voir l'en-tete : la date d'un import n'est pas
    // la date d'un visionnage, et une question batie dessus serait fausse.
    if (fact.origin !== undefined) return;
    const instant = fact.at ?? fact.declaredAt;
    if (typeof instant === 'string' && instant.length >= 10) days.push(dayOf(instant));
  };

  keep(entry.position);
  keep(entry.decision);
  for (const rating of Object.values(entry.seasonRatings ?? {})) keep(rating);
  for (const completion of entry.completions ?? []) keep(completion);
  return days;
}

/**
 * Une question, ou rien.
 *
 * ⚠️ **Rend `undefined` plutot qu'une question bancale.** Au demarrage a froid il n'y a pas
 * d'histoire, donc pas de question — et c'est la doctrine de tout le produit : *mieux vaut
 * se taire que compter zero*. Un quiz qui demanderait « quelle serie regardiez-vous ? »
 * avec deux titres au choix serait pire qu'absent.
 */
export function buildQuiz(journal: Journal, now: Date, seed: number): QuizQuestion | undefined {
  const entries = seriesEntries(journal);

  // Seules les series dont on connait le titre peuvent etre lues par un joueur.
  const titled = new Map<JournalKey, string>();
  for (const [key, entry] of entries) {
    const title = entry.snapshot?.title;
    if (typeof title === 'string' && title.length > 0) titled.set(key, title);
  }
  if (titled.size < ENOUGH_SERIES) return undefined;

  // Un jour -> les series qui y ont un fait vecu. Plusieurs series = deux bonnes reponses.
  const byDay = new Map<string, Set<JournalKey>>();
  const latest = new Date(now.getTime() - OLD_ENOUGH_DAYS * DAY_MS).toISOString().slice(0, 10);

  for (const [key, entry] of entries) {
    if (!titled.has(key)) continue;
    for (const day of livedDays(entry)) {
      if (day > latest) continue;
      const holders = byDay.get(day) ?? new Set<JournalKey>();
      holders.add(key);
      byDay.set(day, holders);
    }
  }

  const days = [...byDay.entries()]
    .filter(([, holders]) => holders.size === 1)
    .map(([day, holders]) => ({ day, key: [...holders][0] as JournalKey }))
    // Trie pour que la suite ne depende pas de l'ordre d'insertion d'une Map, qui suit
    // l'ordre des cles du journal : la meme graine doit rendre la meme question.
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  // Les courbes reconnaissables : au moins trois saisons notees a la main.
  const curves = entries
    .filter(([key]) => titled.has(key))
    .map(([key, entry]) => ({ key, curve: curveOf(entry) }))
    .filter((held) => held.curve.length >= ENOUGH_SEASONS)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  // Les saisons notees episode par episode : la granularite la plus fine du produit (A7).
  const runs = entries
    .filter(([key]) => titled.has(key))
    .flatMap(([key, entry]) =>
      episodeRunsOf(entry)
        .filter((run) => run.length >= ENOUGH_EPISODES)
        .map((run) => ({ key, run })),
    )
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const random = randomFrom(seed);

  // Les familles disponibles, dans un ordre fixe : la graine choisit, jamais l'ordre des
  // cles du journal.
  const families: ('onDay' | 'byCurve' | 'byEpisodes')[] = [
    ...(days.length > 0 ? (['onDay'] as const) : []),
    ...(curves.length > 0 ? (['byCurve'] as const) : []),
    ...(runs.length > 0 ? (['byEpisodes'] as const) : []),
  ];
  if (families.length === 0) return undefined;

  const family = families[Math.floor(random() * families.length)] ?? families[0];

  const held =
    family === 'onDay'
      ? (days[Math.floor(random() * days.length)] ?? days[0])
      : family === 'byCurve'
        ? (curves[Math.floor(random() * curves.length)] ?? curves[0])
        : (runs[Math.floor(random() * runs.length)] ?? runs[0]);
  const answer = held?.key;
  if (answer === undefined) return undefined;

  const answerTitle = titled.get(answer);
  if (answerTitle === undefined) return undefined;

  const choices = withDecoys(answer, answerTitle, titled, random);
  if (choices === undefined) return undefined;

  if (family === 'byCurve') {
    const curve = curves.find((one) => one.key === answer)?.curve;
    if (curve === undefined) return undefined;
    return { kind: 'byCurve', curve, answer, choices };
  }

  if (family === 'byEpisodes') {
    const run = 'run' in (held ?? {}) ? (held as { run: readonly CurvePoint[] }).run : undefined;
    if (run === undefined) return undefined;
    return { kind: 'byEpisodes', episodes: run, answer, choices };
  }

  const on = days.find((one) => one.key === answer)?.day;
  if (on === undefined) return undefined;
  return { kind: 'onDay', on, answer, choices };
}

/**
 * Les notes d'episode, regroupees **par saison**.
 *
 * ⚠️ Une saison par question, jamais un melange : les numeros d'episode repartent a 1 a
 * chaque saison, donc coller S1E1..S1E8 et S2E1..S2E6 dessinerait une courbe qui remonte
 * au milieu sans que rien ne se soit passe. C'est le meme piege que les decoupages
 * concurrents — un axe qui ment est pire qu'un axe absent.
 *
 * Les notes importees sont ecartees, comme partout dans ce module.
 */
function episodeRunsOf(entry: {
  readonly episodeRatings?: Readonly<
    Record<string, { readonly stars: number; readonly at: string; readonly origin?: string }>
  >;
}): readonly (readonly CurvePoint[])[] {
  const bySeason = new Map<number, CurvePoint[]>();

  for (const [key, rating] of Object.entries(entry.episodeRatings ?? {})) {
    if (rating.origin !== undefined) continue;
    const [season, episode] = key.split(':').map(Number);
    if (!Number.isFinite(season) || !Number.isFinite(episode)) continue;
    const run = bySeason.get(season as number) ?? [];
    run.push({ season: episode as number, stars: rating.stars });
    bySeason.set(season as number, run);
  }

  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, run]) => run.sort((a, b) => a.season - b.season));
}

/**
 * La trajectoire vecue d'une serie : ses notes de saison, dans l'ordre.
 *
 * ⚠️ Les notes portant une marque d'import sont ecartees, comme partout ici. Une note
 * reprise d'ailleurs est un jugement qu'on n'a pas pose dans ce produit ; batir une
 * question dessus reviendrait a demander « vous souvenez-vous de ce que vous n'avez pas
 * fait ? ».
 */
function curveOf(entry: {
  readonly seasonRatings?: Readonly<
    Record<string, { readonly stars: number; readonly at: string; readonly origin?: string }>
  >;
}): readonly CurvePoint[] {
  return Object.entries(entry.seasonRatings ?? {})
    .filter(([, rating]) => rating.origin === undefined)
    .map(([season, rating]) => ({ season: Number(season), stars: rating.stars }))
    .filter((point) => Number.isFinite(point.season))
    .sort((a, b) => a.season - b.season);
}

/**
 * La bonne reponse, trois leurres, et le tout melange.
 *
 * ⚠️ **Le melange n'est pas cosmetique** : sans lui la bonne reponse serait toujours la
 * premiere, ce qu'un joueur remarque au deuxieme tour — et le quiz devient un bouton.
 */
function withDecoys(
  answer: JournalKey,
  answerTitle: string,
  titled: ReadonlyMap<JournalKey, string>,
  random: () => number,
): readonly QuizChoice[] | undefined {
  const pool = [...titled.entries()]
    .filter(([key]) => key !== answer)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const choices: QuizChoice[] = [{ key: answer, title: answerTitle }];
  while (choices.length < ENOUGH_SERIES && pool.length > 0) {
    const [key, title] = pool.splice(Math.floor(random() * pool.length), 1)[0] as [
      JournalKey,
      string,
    ];
    choices.push({ key, title });
  }
  if (choices.length < ENOUGH_SERIES) return undefined;

  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = choices[index] as QuizChoice;
    choices[index] = choices[swap] as QuizChoice;
    choices[swap] = held;
  }
  return choices;
}

/**
 * Le generateur de journaux, et ce qu'il faut pour comparer deux journaux.
 *
 * Partage entre les lois de la **fusion** et celles de la **lecture** : les deux ont
 * besoin de la meme chose — beaucoup de journaux plausibles, reproductibles, et pleins
 * d'ex aequo. Ecrire un second generateur aurait produit deux idees differentes de ce
 * qu'est « un journal plausible », donc deux couvertures qu'on croit identiques.
 *
 * ⚠️ **Le jeu de dates est minuscule, et c'est deliberé.** Un jeu large rendrait les ex
 * aequo improbables — c'est-a-dire qu'il eviterait soigneusement le seul cas que ces
 * lois doivent couvrir, et qui est le cas nominal d'un import.
 */

import {
  EMPTY_JOURNAL,
  type Journal,
  type JournalKey,
  parseJournal,
  serializeJournal,
  setDecision,
  setEpisodeRating,
  setPosition,
  setPlatforms,
  setSeasonRating,
  setWanted,
  announceFace,
} from '../src/domain/journal';
import type { FaceId } from '../src/domain/face';
import type { DecisionKind, Stars } from '../src/domain/types';


/** Forme canonique : cles triees, pour que l'egalite ne depende pas de l'ordre d'ecriture. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(source[k])}`)
    .join(',')}}`;
}

/**
 * Ce que les lois comparent : la donnee de l'utilisateur, hors identite d'appareil.
 *
 * 🔴 **Cette fonction ne rendait que `journal.entries`, et ca a coute deux defauts.**
 * Les champs de **document** — plateformes, pays, masquages, face annoncee — echappaient
 * donc aux huit lois : la commutativite etait prouvee sur la moitie du journal, et cette
 * moitie-la etait la seule qu'on regardait.
 *
 * Mesure du 2026-08-11 : `announcedFace` rendait `finisher` dans un sens et `cutter` dans
 * l'autre a egalite de date ; `platforms` rendait `["netflix","max"]` contre
 * `["max","netflix"]`. Deux appareils divergeaient et se renvoyaient leurs journaux
 * indefiniment — exactement le battement que ces lois existent pour interdire.
 *
 * ⚠️ **`deviceId` reste exclu, et c'est la seule exception qui survit** : par contrat celui
 * de `a` gagne, un appareil garde son identite en absorbant un journal venu d'ailleurs. Ce
 * n'est pas une donnee de l'utilisateur. L'autre exception que l'en-tete de
 * `journal-merge.test.ts` revendiquait — l'ordre des plateformes — a ete **supprimee**
 * plutot que documentee : `unite` trie desormais.
 */
export function shape(journal: Journal): string {
  const { deviceId: _identiteDeLAppareil, ...document } = journal;
  return canonical(document);
}

/** Generateur congruentiel : reproductible, donc un echec se rejoue a l'identique. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const KEYS: readonly JournalKey[] = ['tmdb:1396', 'tmdb:66732', 'tmdb:1399'];
export const STARS: readonly Stars[] = [1, 2.5, 3, 4, 5] as readonly Stars[];
export const KINDS: readonly DecisionKind[] = ['continuing', 'paused', 'abandoned', 'completed'];
/** Deux suffisent : ce qu'on veut produire est le **conflit**, pas la variete. */
export const PLATFORMS: readonly string[] = ['netflix', 'max', 'arte'];
export const FACES: readonly FaceId[] = ['finisher', 'cutter', 'rewatcher'];

/**
 * Trois dates seulement, et volontairement.
 *
 * Un jeu large rendrait les ex aequo improbables — c'est-a-dire qu'il eviterait
 * soigneusement le seul cas que ces lois doivent couvrir.
 */
export const DATES: readonly Date[] = [
  new Date('2026-01-01T00:00:00.000Z'),
  new Date('2026-06-15T12:00:00.000Z'),
  new Date('2026-08-02T09:30:00.000Z'),
];

/**
 * Ce qu'une version plus recente du produit aurait ecrit et que nous ne savons pas lire.
 *
 * ⚠️ Il n'existe **aucun** mutateur pour ce champ, et c'est voulu : ce code n'ecrit jamais
 * `unknownFields`, il ne fait que le traverser. On passe donc par le seul chemin reel —
 * serialiser, injecter, relire — ce qui a l'avantage d'exercer aussi le pass-through de
 * `parseEntry` et de `serializeJournal` a chaque graine.
 *
 * Sans ce cas, les huit lois ne prouveraient la convergence que sur les champs **connus**,
 * en laissant hors de leur portee le seul champ dont la fusion n'a pas de date pour
 * departager — c'est-a-dire precisement celui qui risquait de la casser.
 */
export function withUnknown(journal: Journal, key: JournalKey, value: unknown): Journal {
  const document = JSON.parse(serializeJournal(journal)) as {
    entries: Record<string, Record<string, unknown>>;
  };
  document.entries[key] = { ...(document.entries[key] ?? {}), futureField: value };
  return parseJournal(JSON.stringify(document));
}

export const FUTURE_VALUES: readonly unknown[] = [
  'un texte',
  { text: 'une critique', through: 3 },
  [1, 2, 3],
];

export function journalOf(seed: number): Journal {
  const next = random(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;

  let journal = EMPTY_JOURNAL;
  const gestures = 1 + Math.floor(next() * 6);

  for (let i = 0; i < gestures; i += 1) {
    const key = pick(KEYS);
    const at = pick(DATES);
    switch (Math.floor(next() * 8)) {
      // ⚠️ **Les champs de DOCUMENT, ajoutes le 2026-08-11.** Sans eux, les huit lois
      // n'exercaient que les entrees : `announcedFace` et `platforms` ont diverge sous
      // leur nez pendant que tout etait vert. Un generateur qui ne produit pas un champ
      // ne prouve rien de sa fusion — c'est le cinquieme faux negatif de fixture de ce
      // depot, et le premier a avoir laisse passer un vrai defaut.
      case 6:
        journal = setPlatforms(journal, [...(journal.platforms ?? []), pick(PLATFORMS)]);
        break;
      case 7:
        // La face annoncee : le cas interessant est l'**egalite de date** avec deux faces
        // differentes, et le jeu de dates minuscule le rend frequent.
        journal = announceFace(journal, pick(FACES), at);
        break;
      case 5:
        journal = withUnknown(journal, key, pick(FUTURE_VALUES));
        break;
      case 0:
        journal = setPosition(journal, key, 1 + Math.floor(next() * 5), 1 + Math.floor(next() * 9), at);
        break;
      case 1:
        journal = setSeasonRating(journal, key, 1 + Math.floor(next() * 4), pick(STARS), at);
        break;
      case 2:
        journal = setEpisodeRating(journal, key, 1 + Math.floor(next() * 3), 1 + Math.floor(next() * 6), pick(STARS), at);
        break;
      case 3:
        journal = setDecision(journal, key, pick(KINDS), at);
        break;
      default:
        journal = setWanted(journal, key, next() > 0.35, at);
        break;
    }
  }
  return journal;
}

export const CASES = 120;

/**
 * Les lois de `mergeJournals`.
 *
 * ## Pourquoi ce fichier existe, alors que la fusion etait deja testee
 *
 * `tests/journal.test.ts` couvre la fusion par des **exemples** : deux journaux precis,
 * un resultat attendu. C'est necessaire et ce n'est pas suffisant. Un exemple prouve un
 * cas ; une **loi** prouve la classe. Et c'est exactement la ou le defaut s'est loge :
 * `laterOf` departageait les ex aequo par l'ordre des arguments, donc
 * `merge(a, b) !== merge(b, a)`. Aucun exemple ne le montrait, parce qu'aucun exemple
 * n'avait de raison de rejouer la meme paire dans l'autre sens.
 *
 * `mergeJournals` n'est pas une fonction utilitaire : c'est **la** primitive sur
 * laquelle repose la synchronisation multi-appareils. Si elle n'est pas commutative,
 * deux appareils qui fusionnent la meme paire dans leur propre ordre obtiennent deux
 * journaux differents, se les renvoient, et le battement ne s'arrete jamais.
 *
 * ## Le generateur
 *
 * Deterministe (les echecs se rejouent), et surtout **il pioche dans un tres petit jeu
 * de dates**. C'est deliberé : les ex aequo sont le cas interessant, et c'est le cas
 * nominal d'un import, ou de nombreux faits recoivent la meme date de repli.
 *
 * ## Les deux exceptions, qui sont contractuelles et non des defauts
 *
 * - `deviceId` : par contrat, celui de `a` gagne. Un appareil garde son identite en
 *   absorbant un journal venu d'ailleurs.
 * - `platforms` : c'est un ensemble ; son ordre ne porte pas de sens.
 *
 * Les lois sont donc enoncees sur les **entrees**, qui sont la donnee de l'utilisateur.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  type Journal,
  type JournalKey,
  mergeJournals,
  setDecision,
  setEpisodeRating,
  setPosition,
  setSeasonRating,
  setWanted,
} from '../src/domain/journal';
import type { DecisionKind, Stars } from '../src/domain/types';

// ---------------------------------------------------------------------------
// Outillage
// ---------------------------------------------------------------------------

/** Forme canonique : cles triees, pour que l'egalite ne depende pas de l'ordre d'ecriture. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(source[k])}`)
    .join(',')}}`;
}

/** Ce que les lois comparent : la donnee de l'utilisateur, hors identite d'appareil. */
function shape(journal: Journal): string {
  return canonical(journal.entries);
}

/** Generateur congruentiel : reproductible, donc un echec se rejoue a l'identique. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const KEYS: readonly JournalKey[] = ['tmdb:1396', 'tmdb:66732', 'tmdb:1399'];
const STARS: readonly Stars[] = [1, 2.5, 3, 4, 5] as readonly Stars[];
const KINDS: readonly DecisionKind[] = ['continuing', 'paused', 'abandoned', 'completed'];

/**
 * Trois dates seulement, et volontairement.
 *
 * Un jeu large rendrait les ex aequo improbables — c'est-a-dire qu'il eviterait
 * soigneusement le seul cas que ces lois doivent couvrir.
 */
const DATES: readonly Date[] = [
  new Date('2026-01-01T00:00:00.000Z'),
  new Date('2026-06-15T12:00:00.000Z'),
  new Date('2026-08-02T09:30:00.000Z'),
];

function journalOf(seed: number): Journal {
  const next = random(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;

  let journal = EMPTY_JOURNAL;
  const gestures = 1 + Math.floor(next() * 6);

  for (let i = 0; i < gestures; i += 1) {
    const key = pick(KEYS);
    const at = pick(DATES);
    switch (Math.floor(next() * 5)) {
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

const CASES = 120;

// ---------------------------------------------------------------------------
// Les lois
// ---------------------------------------------------------------------------

describe('mergeJournals — les lois qui rendent la synchronisation possible', () => {
  it('est idempotente : fusionner un journal avec lui-meme ne le change pas', () => {
    for (let seed = 1; seed <= CASES; seed += 1) {
      const a = journalOf(seed);
      expect(shape(mergeJournals(a, a)), `graine ${seed}`).toBe(shape(a));
    }
  });

  it('est commutative : l ordre des deux appareils ne change pas le resultat', () => {
    for (let seed = 1; seed <= CASES; seed += 1) {
      const a = journalOf(seed);
      const b = journalOf(seed + 10_000);
      expect(shape(mergeJournals(a, b)), `graine ${seed}`).toBe(shape(mergeJournals(b, a)));
    }
  });

  it('est associative : l ordre des rencontres entre trois appareils est sans effet', () => {
    for (let seed = 1; seed <= CASES; seed += 1) {
      const a = journalOf(seed);
      const b = journalOf(seed + 10_000);
      const c = journalOf(seed + 20_000);
      expect(shape(mergeJournals(mergeJournals(a, b), c)), `graine ${seed}`).toBe(
        shape(mergeJournals(a, mergeJournals(b, c))),
      );
    }
  });

  it('absorbe le journal vide sans rien perdre, des deux cotes', () => {
    for (let seed = 1; seed <= CASES; seed += 1) {
      const a = journalOf(seed);
      expect(shape(mergeJournals(a, EMPTY_JOURNAL)), `graine ${seed}`).toBe(shape(a));
      expect(shape(mergeJournals(EMPTY_JOURNAL, a)), `graine ${seed}`).toBe(shape(a));
    }
  });

  it('converge : deux appareils qui fusionnent dans leur propre ordre finissent identiques', () => {
    for (let seed = 1; seed <= CASES; seed += 1) {
      const mine = journalOf(seed);
      const yours = journalOf(seed + 30_000);

      // Chacun fusionne ce qu'il recoit avec ce qu'il a, dans l'ordre qui est le sien.
      const onMyPhone = mergeJournals(mine, yours);
      const onYourLaptop = mergeJournals(yours, mine);

      // Puis ils se resynchronisent une fois de plus. C'est ce second tour qui, avec un
      // departage instable, ne s'arretait jamais.
      expect(shape(mergeJournals(onMyPhone, onYourLaptop)), `graine ${seed}`).toBe(
        shape(mergeJournals(onYourLaptop, onMyPhone)),
      );
      expect(shape(onMyPhone), `graine ${seed}`).toBe(shape(onYourLaptop));
    }
  });
});

describe('mergeJournals — le cas qui a revele le defaut', () => {
  const AT = new Date('2026-05-05T10:00:00.000Z');
  const KEY = 'tmdb:1396';

  it('departage deux notes portant exactement la meme date, toujours pareil', () => {
    const a = setSeasonRating(EMPTY_JOURNAL, KEY, 3, 2 as Stars, AT);
    const b = setSeasonRating(EMPTY_JOURNAL, KEY, 3, 5 as Stars, AT);

    const left = mergeJournals(a, b).entries[KEY]?.seasonRatings?.['3']?.stars;
    const right = mergeJournals(b, a).entries[KEY]?.seasonRatings?.['3']?.stars;

    // Laquelle des deux gagne n'a aucune importance — il n'existe aucune raison de
    // preferer l'une. Ce qui compte, et ce qui manquait, c'est que ce soit **la meme**.
    expect(left).toBe(right);
  });

  it('departage aussi deux positions ex aequo', () => {
    const a = setPosition(EMPTY_JOURNAL, KEY, 1, 4, AT);
    const b = setPosition(EMPTY_JOURNAL, KEY, 6, 2, AT);
    expect(mergeJournals(a, b).entries[KEY]?.position).toEqual(
      mergeJournals(b, a).entries[KEY]?.position,
    );
  });

  it('une suppression et une ecriture a la meme date se departagent de facon stable', () => {
    const written = setSeasonRating(EMPTY_JOURNAL, KEY, 2, 4 as Stars, AT);
    const erased = setSeasonRating(written, KEY, 2, undefined, AT);

    expect(mergeJournals(written, erased).entries[KEY]?.seasonRatings?.['2']).toEqual(
      mergeJournals(erased, written).entries[KEY]?.seasonRatings?.['2'],
    );
  });
});

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
 * ## La seule exception qui reste, et celle qui a disparu
 *
 * - `deviceId` : par contrat, celui de `a` gagne. Un appareil garde son identite en
 *   absorbant un journal venu d'ailleurs.
 * - ⚠️ **L'exception « platforms » a disparu le 2026-08-11**, et pas par indulgence : son
 *   ordre ne portait pas de sens a la LECTURE, mais deux serialisations differentes du meme
 *   ensemble se renvoyaient indefiniment entre deux appareils. `unite` trie desormais, et
 *   `shape` couvre tout le document — seul `deviceId` reste hors des lois.
 *
 * Les lois portent donc sur **tout le document sauf `deviceId`**. Elles ne portaient que sur
 * les entrees jusqu'au 2026-08-11, et cette moitie manquante a laisse passer deux vrais
 * defauts — dont un ecrit le matin meme, a cote du commentaire qui met en garde contre lui.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  type Journal,
  type JournalKey,
  mergeJournals,
  setPosition,
  setSeasonRating,
} from '../src/domain/journal';
import type { Stars } from '../src/domain/types';

import { CASES, KEYS, journalOf, shape, withUnknown } from './journal-fixtures';
// ---------------------------------------------------------------------------
// Les lois
// ---------------------------------------------------------------------------

describe('mergeJournals — les lois qui rendent la synchronisation possible', () => {
  it('le generateur produit bien des champs inconnus, et des conflits sur eux', () => {
    // ⚠️ Ancrage, et il n'est pas decoratif. Les huit lois ci-dessous passeraient tout
    // aussi bien si `withUnknown` n'ecrivait jamais rien : elles compareraient alors deux
    // journaux sans champ inconnu et ne prouveraient rien de la fusion de ces champs.
    //
    // C'est le **quatrieme faux negatif de fixture** que ce depot aurait pu commettre :
    // `setSnapshot` appele avant le geste n'ecrivait aucun instantane, et quatre egalites
    // passaient en comparant deux agregats vides.
    let withField = 0;
    let conflicting = 0;
    for (let seed = 1; seed <= CASES; seed += 1) {
      const a = journalOf(seed);
      const b = journalOf(seed + 10_000);
      const fieldsOf = (j: Journal): Set<string> =>
        new Set(
          Object.entries(j.entries)
            .filter(([, entry]) => entry.unknownFields?.['futureField'] !== undefined)
            .map(([key]) => key),
        );
      const left = fieldsOf(a);
      const right = fieldsOf(b);
      if (left.size > 0) withField += 1;
      // Le cas qui compte vraiment : la MEME serie porte un champ inconnu des deux cotes,
      // donc `mergeUnknown` doit departager sans date.
      if ([...left].some((key) => right.has(key))) conflicting += 1;
    }

    expect(withField).toBeGreaterThan(20);
    // ⚠️ Le tirage produit des champs inconnus en quantite, mais le cas ou les DEUX
    // appareils en portent un sur la **meme** serie est rare — mesure : 1 fois sur 120.
    // Les huit lois ne le couvrent donc quasiment pas, et c'est pourtant le seul cas ou
    // `mergeUnknown` doit reellement departager. D'ou la loi dediee ci-dessous, qui le
    // construit au lieu de l'esperer. On garde tout de meme la mesure ici : si elle tombait
    // a zero, le generateur aurait cesse de produire ce qu'il croit produire.
    expect(conflicting).toBeGreaterThan(0);
  });

  it('departage deux champs inconnus concurrents sans dependre de l ordre', () => {
    // Le defaut vise : `mergeUnknown` qui prendrait « b gagne » (ou « a gagne »). Ni l'un
    // ni l'autre n'a de date qu'on sache lire, donc rien ne les departage — sauf une forme
    // canonique, qui a le seul merite qui compte ici : elle rend le **meme** verdict sur
    // les deux appareils. Sans elle, chacun garde sa version, se la renvoie, et le
    // battement ne s'arrete jamais. C'est exactement le defaut que `laterOf` a deja porte.
    const KEY = KEYS[0] as JournalKey;

    for (let seed = 1; seed <= CASES; seed += 1) {
      const a = withUnknown(journalOf(seed), KEY, { text: 'ecrit sur le telephone' });
      const b = withUnknown(journalOf(seed + 10_000), KEY, { text: 'ecrit sur le portable' });

      // Les deux le portent vraiment — sinon la loi ne comparerait rien.
      expect(a.entries[KEY]?.unknownFields?.['futureField'], `graine ${seed}`).toBeDefined();
      expect(b.entries[KEY]?.unknownFields?.['futureField'], `graine ${seed}`).toBeDefined();

      const ab = mergeJournals(a, b);
      expect(shape(ab), `graine ${seed}`).toBe(shape(mergeJournals(b, a)));
      // Et le vainqueur est l'un des deux, jamais une fusion des deux textes.
      expect(
        ['ecrit sur le telephone', 'ecrit sur le portable'],
        `graine ${seed}`,
      ).toContainEqual(
        (ab.entries[KEY]?.unknownFields?.['futureField'] as { text: string }).text,
      );
      // Idempotence sur ce cas precis : une seconde rencontre ne rebascule pas le choix.
      expect(shape(mergeJournals(ab, b)), `graine ${seed}`).toBe(shape(ab));
      expect(shape(mergeJournals(ab, a)), `graine ${seed}`).toBe(shape(ab));
    }
  });

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

import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  MAX_TAG_CHARS,
  mergeJournals,
  normalizeTag,
  parseJournal,
  serializeJournal,
  setTag,
  setWanted,
  tagCounts,
  tagsOf,
} from '../src/domain/journal';
import { buildLibrary } from '../src/domain/library';

/**
 * Les tags — **vos mots**, et la seule chose qui les rende utiles.
 *
 * ## Ce que ces tests protegent
 *
 * La **normalisation**, avant tout le reste. `Comfort`, `comfort` et ` comfort ` doivent
 * etre un seul tag : sans ca, le filtre par tag rend trois listes disjointes et la
 * fonctionnalite entiere ne sert a rien. Le defaut est invisible pour quiconque ne tape
 * jamais de majuscule — c'est-a-dire invisible a l'auteur, et pas aux autres.
 *
 * Puis la **fusion** : retirer un tag sur le telephone ne doit pas le voir revenir depuis
 * l'ordinateur. C'est la decision n°3 du format, et elle vaut ici comme partout.
 */

const BB = 'tmdb:1396';
const GOT = 'tmdb:1399';

const TOT = new Date('2026-01-01T10:00:00.000Z');
const TARD = new Date('2026-06-01T10:00:00.000Z');

describe('normalizeTag', () => {
  it('met en minuscules', () => {
    expect(normalizeTag('Comfort')).toBe('comfort');
  });

  it('rogne et reduit les espaces', () => {
    expect(normalizeTag('  a   revoir  ')).toBe('a revoir');
  });

  it('preserve les espaces internes et les accents', () => {
    // On ne mutile pas le vocabulaire de quelqu'un : « à revoir » et « science-fiction »
    // sont des tags legitimes.
    expect(normalizeTag('À Revoir')).toBe('à revoir');
    expect(normalizeTag('science-fiction')).toBe('science-fiction');
  });

  it('ecarte le vide', () => {
    expect(normalizeTag('')).toBeUndefined();
    expect(normalizeTag('   ')).toBeUndefined();
  });

  it('ecarte ce qui depasse le plafond', () => {
    expect(normalizeTag('x'.repeat(MAX_TAG_CHARS))).toHaveLength(MAX_TAG_CHARS);
    expect(normalizeTag('x'.repeat(MAX_TAG_CHARS + 1))).toBeUndefined();
  });
});

describe('setTag', () => {
  it('pose un mot', () => {
    expect(tagsOf(setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT).entries[BB])).toEqual(['comfort']);
  });

  it('🔴 deux graphies du meme mot ne font qu un tag', () => {
    // L'ancrage principal du fichier. Sans normalisation, le filtre rendrait deux listes.
    let j = setTag(EMPTY_JOURNAL, BB, 'Comfort', true, TOT);
    j = setTag(j, BB, '  comfort ', true, TARD);

    expect(tagsOf(j.entries[BB])).toEqual(['comfort']);
  });

  it('retire un mot', () => {
    let j = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    j = setTag(j, BB, 'comfort', false, TARD);

    expect(tagsOf(j.entries[BB])).toEqual([]);
  });

  it('retirer laisse une pierre tombale prefixee tag:', () => {
    // ⚠️ Le prefixe compte plus ici qu'ailleurs : un tag est une chaine **tapee par
    // quelqu'un**, donc il peut valoir « decision » ou « series » et ecraser la pierre
    // tombale d'un autre champ. Les autres cles sont fabriquees par le code.
    let j = setTag(EMPTY_JOURNAL, BB, 'decision', true, TOT);
    j = setTag(j, BB, 'decision', false, TARD);

    expect(Object.keys(j.entries[BB]?.removed ?? {})).toEqual(['tag:decision']);
  });

  it('reposer un mot retire annule la pierre tombale', () => {
    let j = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    j = setTag(j, BB, 'comfort', false, TARD);
    j = setTag(j, BB, 'comfort', true, new Date('2026-07-01T10:00:00.000Z'));

    expect(tagsOf(j.entries[BB])).toEqual(['comfort']);
    expect(j.entries[BB]?.removed?.['tag:comfort']).toBeUndefined();
  });

  it('une saisie vide ne change rien', () => {
    expect(setTag(EMPTY_JOURNAL, BB, '   ', true, TOT)).toBe(EMPTY_JOURNAL);
  });

  it('n ecrase pas les autres mots de la serie', () => {
    let j = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    j = setTag(j, BB, 'le dimanche', true, TARD);

    expect(tagsOf(j.entries[BB])).toEqual(['comfort', 'le dimanche']);
  });

  it('rend un ordre stable — sinon la rangee danserait au rendu', () => {
    let j = setTag(EMPTY_JOURNAL, BB, 'zeta', true, TOT);
    j = setTag(j, BB, 'alpha', true, TARD);

    expect(tagsOf(j.entries[BB])).toEqual(['alpha', 'zeta']);
  });
});

describe('tagCounts', () => {
  it('ne rend rien sur un journal vierge', () => {
    expect(tagCounts(EMPTY_JOURNAL)).toEqual([]);
  });

  it('compte les series par mot, du plus employe au moins employe', () => {
    let j = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    j = setTag(j, GOT, 'comfort', true, TOT);
    j = setTag(j, BB, 'le dimanche', true, TOT);

    expect(tagCounts(j)).toEqual([
      { tag: 'comfort', count: 2 },
      { tag: 'le dimanche', count: 1 },
    ]);
  });

  it('a egalite, l ordre est alphabetique — il doit seulement etre STABLE', () => {
    let j = setTag(EMPTY_JOURNAL, BB, 'zeta', true, TOT);
    j = setTag(j, GOT, 'alpha', true, TOT);

    expect(tagCounts(j).map((c) => c.tag)).toEqual(['alpha', 'zeta']);
  });
});

describe('la fusion', () => {
  it('reunit les mots des deux appareils', () => {
    const a = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    const b = setTag(EMPTY_JOURNAL, BB, 'le dimanche', true, TOT);

    expect(tagsOf(mergeJournals(a, b).entries[BB])).toEqual(['comfort', 'le dimanche']);
  });

  it('🔴 un mot retire ne revient pas par l autre appareil', () => {
    // Decision n°3 du format : sans pierre tombale, l'appareil qui ignorait le retrait
    // ressusciterait le tag a la premiere synchronisation.
    const avecLeTag = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    const apresRetrait = setTag(avecLeTag, BB, 'comfort', false, TARD);

    expect(tagsOf(mergeJournals(avecLeTag, apresRetrait).entries[BB])).toEqual([]);
    expect(tagsOf(mergeJournals(apresRetrait, avecLeTag).entries[BB])).toEqual([]);
  });

  it('l ancrage : sans le retrait, le mot survit bien a la fusion', () => {
    const a = setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT);
    const b = setWanted(EMPTY_JOURNAL, BB, true, TARD);

    expect(tagsOf(mergeJournals(a, b).entries[BB])).toEqual(['comfort']);
  });

  it('est commutative', () => {
    const a = setTag(EMPTY_JOURNAL, BB, 'alpha', true, TOT);
    const b = setTag(EMPTY_JOURNAL, BB, 'zeta', true, TARD);

    expect(tagsOf(mergeJournals(a, b).entries[BB])).toEqual(
      tagsOf(mergeJournals(b, a).entries[BB]),
    );
  });
});

describe('la lecture et l ecriture', () => {
  it('survit a un aller-retour', () => {
    const j = setTag(EMPTY_JOURNAL, BB, 'le dimanche', true, TOT);

    expect(tagsOf(parseJournal(serializeJournal(j)).entries[BB])).toEqual(['le dimanche']);
  });

  it('🔴 est RELU — sans quoi les mots seraient effaces a la premiere sauvegarde', () => {
    const relu = parseJournal(serializeJournal(setTag(EMPTY_JOURNAL, BB, 'comfort', true, TOT)));

    expect(tagsOf(parseJournal(serializeJournal(relu)).entries[BB])).toEqual(['comfort']);
  });

  it('renormalise un document ecrit avant la normalisation', () => {
    // Un journal ecrit par une version anterieure, une extension tierce ou a la main peut
    // porter les deux graphies cote a cote. Les laisser passer rendrait le filtre inutile
    // precisement chez les gens qui ont le plus de tags.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          wanted: { at: TOT.toISOString() },
          tags: { Comfort: { at: TOT.toISOString() }, comfort: { at: TARD.toISOString() } },
        },
      },
    });

    expect(tagsOf(parseJournal(raw).entries[BB])).toEqual(['comfort']);
  });

  it('a collision de graphies, garde la date la plus recente', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          wanted: { at: TOT.toISOString() },
          tags: { Comfort: { at: TOT.toISOString() }, comfort: { at: TARD.toISOString() } },
        },
      },
    });

    expect(parseJournal(raw).entries[BB]?.tags?.['comfort']?.at).toBe(TARD.toISOString());
  });

  it('ecarte un mot illisible sans jeter les autres', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          wanted: { at: TOT.toISOString() },
          tags: { '   ': { at: TOT.toISOString() }, comfort: { at: TOT.toISOString() } },
        },
      },
    });

    expect(tagsOf(parseJournal(raw).entries[BB])).toEqual(['comfort']);
  });
});

describe('taguer est un geste', () => {
  it('fait remonter la serie dans « Reprendre »', () => {
    // Sans la ligne `tags` de `GESTURE_DATES`, une serie qu'on vient de ranger ne
    // remonterait pas — le rangement EST ce qu'on fait quand on s'occupe de sa
    // bibliotheque.
    let j = setWanted(EMPTY_JOURNAL, BB, true, TOT);
    j = setWanted(j, GOT, true, TOT);
    j = setTag(j, BB, 'comfort', true, TARD);

    const item = buildLibrary(j).wanted[0];
    expect(item?.key).toBe(BB);
  });
});

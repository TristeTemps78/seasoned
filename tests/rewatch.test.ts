import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  completionCount,
  isRewatching,
  markCompleted,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setDecision,
  setPosition,
  type Journal,
} from '../src/domain/journal';
import { buildTasteProfile } from '../src/domain/taste';

const KEY = 'tmdb:1396';
const DAY_ONE = new Date('2026-03-01T21:00:00Z');
const SAME_DAY = new Date('2026-03-01T23:30:00Z');
const DAY_TWO = new Date('2027-01-15T20:00:00Z');

/**
 * Le revisionnage — version 3 du journal.
 *
 * ## Ce que ces tests protegent
 *
 * La v3 ajoute un fait **irreparable** : les visionnages passes qu'on n'enregistre pas ne
 * se devinent pas. Comme les trois decisions de la v2, l'erreur ne se rattrape pas apres
 * coup, et elle est invisible tant qu'il n'y a qu'un appareil et qu'une seule vision.
 *
 * D'ou deux exigences testees ici et nulle part ailleurs : **les journaux v2 se lisent
 * sans perte**, et **la fusion des visionnages est une union** — un visionnage acheve sur
 * un appareil ne peut pas etre invalide par un autre.
 */
describe('markCompleted', () => {
  it('enregistre un visionnage acheve', () => {
    const journal = markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE);
    expect(completionCount(journal.entries[KEY])).toBe(1);
  });

  it('ne compte qu’une fois par jour', () => {
    // La decision « terminee » se bascule ; l'interface appelle donc ce geste plusieurs
    // fois. Compter chaque clic ferait de « vu 4 fois » un compteur de clics.
    const once = markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE);
    const twice = markCompleted(once, KEY, SAME_DAY);
    expect(completionCount(twice.entries[KEY])).toBe(1);
  });

  it('rend le journal inchange quand il n’y a rien de neuf', () => {
    // Egalite de **reference** : sans elle, chaque rendu React repartirait sur un nouvel
    // objet et declencherait une ecriture dans le stockage pour rien.
    const once = markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE);
    expect(markCompleted(once, KEY, SAME_DAY)).toBe(once);
  });

  it('compte deux visionnages a des jours differents', () => {
    const twice = markCompleted(markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE), KEY, DAY_TWO);
    expect(completionCount(twice.entries[KEY])).toBe(2);
  });

  it('garde une entree qui n’a QUE des visionnages', () => {
    // `hasContent` gouverne l'affichage et la conservation : oublier les visionnages
    // dedans effacerait l'entree au premier nettoyage.
    const journal = markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE);
    expect(serializeJournal(journal)).toContain('completions');
    expect(parseJournal(serializeJournal(journal)).entries[KEY]).toBeDefined();
  });
});

describe('isRewatching', () => {
  it('est faux avant le premier achevement', () => {
    expect(isRewatching(setPosition(EMPTY_JOURNAL, KEY, 2, 3).entries[KEY])).toBe(false);
  });

  it('est faux juste apres avoir fini, sans nouvelle position', () => {
    const done = markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE);
    expect(isRewatching(done.entries[KEY])).toBe(false);
  });

  it('devient vrai quand on repose une position apres avoir fini', () => {
    const again = setPosition(markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE), KEY, 1, 1, DAY_TWO);
    expect(isRewatching(again.entries[KEY])).toBe(true);
  });
});

describe('la fusion des visionnages est une union', () => {
  const left = markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE);
  const right = markCompleted(EMPTY_JOURNAL, KEY, DAY_TWO);

  it('ne perd aucun visionnage', () => {
    // Le point de la v3 : un fait acheve sur le telephone ne peut pas etre invalide par
    // l'ordinateur, quelle que soit la fraicheur des deux journaux.
    expect(completionCount(mergeJournals(left, right).entries[KEY])).toBe(2);
  });

  it('est commutative', () => {
    expect(mergeJournals(left, right)).toEqual(mergeJournals(right, left));
  });

  it('est idempotente', () => {
    expect(mergeJournals(left, left)).toEqual(left);
  });

  it('est associative', () => {
    const third = markCompleted(EMPTY_JOURNAL, KEY, new Date('2028-06-02T10:00:00Z'));
    expect(mergeJournals(mergeJournals(left, right), third)).toEqual(
      mergeJournals(left, mergeJournals(right, third)),
    );
  });

  it('ne recompte pas le meme visionnage venu de deux appareils', () => {
    // Le cas reel : deux appareils synchronisent le meme achevement a quelques
    // millisecondes d'ecart. Dedupliquer sur l'horodatage exact laisserait passer le
    // doublon, et « vu 3 fois » compterait des synchronisations.
    const a = markCompleted(EMPTY_JOURNAL, KEY, new Date('2026-03-01T21:00:00.000Z'));
    const b = markCompleted(EMPTY_JOURNAL, KEY, new Date('2026-03-01T21:00:00.450Z'));
    expect(completionCount(mergeJournals(a, b).entries[KEY])).toBe(1);
  });
});

describe('compatibilite avec les journaux deja ecrits', () => {
  it('lit un journal v2 sans rien perdre', () => {
    // ⚠️ Le vrai risque de tout changement de version. Un journal v2 en circulation
    // n'a pas de `completions` — il doit se lire tel quel, et surtout pas repartir de
    // zero, ce que fait `parseJournal` sur une version **inconnue**.
    const v2 = JSON.stringify({
      version: 2,
      entries: {
        [KEY]: {
          position: { seasonNumber: 3, episodeNumber: 7, declaredAt: '2026-02-01T00:00:00.000Z' },
          seasonRatings: { '1': { stars: 4.5, at: '2026-02-01T00:00:00.000Z' } },
        },
      },
    });
    const read = parseJournal(v2);
    expect(read.version).toBe(JOURNAL_VERSION);
    expect(read.entries[KEY]?.position?.seasonNumber).toBe(3);
    expect(read.entries[KEY]?.seasonRatings?.['1']?.stars).toBe(4.5);
    expect(completionCount(read.entries[KEY])).toBe(0);
  });

  it('refuse toujours une version future', () => {
    const future = JSON.stringify({ version: JOURNAL_VERSION + 1, entries: { [KEY]: {} } });
    expect(parseJournal(future)).toEqual(EMPTY_JOURNAL);
  });

  it('ecarte une liste de visionnages illisible sans perdre le reste', () => {
    const broken = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [KEY]: {
          completions: 'pas une liste',
          wanted: { at: '2026-02-01T00:00:00.000Z' },
        },
      },
    });
    const read = parseJournal(broken);
    expect(read.entries[KEY]?.wanted).toBeDefined();
    expect(completionCount(read.entries[KEY])).toBe(0);
  });

  it('survit a un aller-retour de serialisation', () => {
    const journal: Journal = setDecision(
      markCompleted(markCompleted(EMPTY_JOURNAL, KEY, DAY_ONE), KEY, DAY_TWO),
      KEY,
      'completed',
      DAY_TWO,
    );
    expect(parseJournal(serializeJournal(journal))).toEqual(journal);
  });
});

describe('la serie-refuge', () => {
  const OTHER = 'tmdb:1399';

  function watched(journal: Journal, key: string, times: number): Journal {
    let out = journal;
    for (let i = 0; i < times; i += 1) {
      out = markCompleted(out, key, new Date(Date.UTC(2020 + i, 0, 1)));
    }
    return out;
  }

  it('se tait tant qu’aucune serie n’a ete revue', () => {
    // « Vue une fois » n'est pas un refuge, c'est une serie finie. Le mot ne doit pas
    // etre vide de son sens des la premiere occasion.
    const once = watched(EMPTY_JOURNAL, KEY, 1);
    expect(buildTasteProfile(once).comfortSeries).toBeUndefined();
  });

  it('designe la serie revue le plus souvent', () => {
    const journal = watched(watched(EMPTY_JOURNAL, KEY, 3), OTHER, 2);
    expect(buildTasteProfile(journal).comfortSeries).toEqual({ key: KEY, times: 3 });
  });

  it('reste stable a egalite', () => {
    // Deux series revues autant de fois : le resultat ne doit pas changer d'un rendu a
    // l'autre, sinon la carte clignote entre deux titres sans que rien n'ait bouge.
    const journal = watched(watched(EMPTY_JOURNAL, KEY, 2), OTHER, 2);
    const first = buildTasteProfile(journal).comfortSeries;
    expect(buildTasteProfile(journal).comfortSeries).toEqual(first);
  });
});

import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  journalKey,
  markCompleted,
  reviewKey,
  setDecision,
  setPosition,
  setReview,
  setSeasonRating,
  setSnapshot,
  setWanted,
  type Journal,
} from '../src/domain/journal';
import { buildLibrary, nextToResume } from '../src/domain/library';

const NOW = new Date('2026-08-02T12:00:00Z');
const BB = journalKey('1396');
const DEXTER = journalKey('1405');
const SEVERANCE = journalKey('95396');

function inDays(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

function withSnapshot(
  journal: Journal,
  key: string,
  title: string,
  nextEpisodeAt?: string,
): Journal {
  return setSnapshot(
    journal,
    key,
    { title, ...(nextEpisodeAt !== undefined ? { nextEpisodeAt } : {}) },
    NOW,
  );
}

describe('buildLibrary — une serie n apparait que dans une section', () => {
  it('range ce qui est commence dans « reprendre »', () => {
    const j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const library = buildLibrary(j, NOW);

    expect(library.resuming.map((i) => i.key)).toEqual([BB]);
    expect(library.wanted).toEqual([]);
    expect(library.total).toBe(1);
  });

  it('range ce qui n est pas commence dans « a voir »', () => {
    // Le geste qui manquait : 99 % des arrivants n'ont pas commence la serie.
    const j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    expect(buildLibrary(j, NOW).wanted.map((i) => i.key)).toEqual([BB]);
  });

  it('sort une serie commencee ET attendue de « reprendre »', () => {
    // C'est la seule information que personne d'autre ne donne : « vous en etes la,
    // et la suite arrive dans N jours ». La diluer dans « reprendre » la perdrait.
    let j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    j = withSnapshot(j, BB, 'Breaking Bad', inDays(12));

    const library = buildLibrary(j, NOW);
    expect(library.returning.map((i) => i.key)).toEqual([BB]);
    expect(library.resuming).toEqual([]);
    expect(library.returning[0]?.daysUntilNext).toBe(12);
  });

  it('trie « ca revient » par proximite, pas par recence', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, new Date(NOW.getTime() - 86_400_000));
    j = withSnapshot(j, BB, 'Breaking Bad', inDays(3));
    j = setPosition(j, DEXTER, 1, 1, NOW);
    j = withSnapshot(j, DEXTER, 'Dexter', inDays(40));

    expect(buildLibrary(j, NOW).returning.map((i) => i.key)).toEqual([BB, DEXTER]);
  });

  it('une date de diffusion passee n est plus une attente', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    j = withSnapshot(j, BB, 'Breaking Bad', inDays(-2));

    const library = buildLibrary(j, NOW);
    expect(library.returning).toEqual([]);
    expect(library.resuming.map((i) => i.key)).toEqual([BB]);
  });

  it('une decision explicite prime sur tout le reste', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 16, NOW);
    j = withSnapshot(j, BB, 'Breaking Bad', inDays(5));
    j = setDecision(j, BB, 'abandoned', NOW);

    const library = buildLibrary(j, NOW);
    expect(library.finished.map((i) => i.key)).toEqual([BB]);
    expect(library.returning).toEqual([]);
  });

  it('« je continue » ne sort pas une serie de « reprendre »', () => {
    // Continuer n'est pas une conclusion : la serie reste a reprendre.
    let j = setPosition(EMPTY_JOURNAL, BB, 2, 1, NOW);
    j = setDecision(j, BB, 'continuing', NOW);
    expect(buildLibrary(j, NOW).resuming.map((i) => i.key)).toEqual([BB]);
  });

  it('classe « reprendre » du geste le plus recent au plus ancien', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, new Date(NOW.getTime() - 7 * 86_400_000));
    j = setPosition(j, DEXTER, 1, 1, new Date(NOW.getTime() - 86_400_000));
    j = setPosition(j, SEVERANCE, 1, 1, new Date(NOW.getTime() - 30 * 86_400_000));

    expect(buildLibrary(j, NOW).resuming.map((i) => i.key)).toEqual([DEXTER, BB, SEVERANCE]);
  });

  it('une visite ne fait pas remonter une serie', () => {
    // L'instantane se depose en visitant la page ; s'il comptait comme un geste,
    // consulter une fiche suffirait a la remettre en tete de bibliotheque.
    const old = new Date(NOW.getTime() - 30 * 86_400_000);
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, old);
    j = setPosition(j, DEXTER, 1, 1, new Date(NOW.getTime() - 86_400_000));
    j = setSnapshot(j, BB, { title: 'Breaking Bad' }, NOW);

    expect(buildLibrary(j, NOW).resuming.map((i) => i.key)).toEqual([DEXTER, BB]);
  });

  it('ignore une entree qui ne porte plus qu une trace de suppression', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW);
    j = setSeasonRating(j, BB, 1, undefined, NOW);
    expect(buildLibrary(j, NOW).total).toBe(0);
  });

  it('oublie un instantane expire sans perdre la serie', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    j = withSnapshot(j, BB, 'Breaking Bad', inDays(400));

    const bienPlusTard = new Date(NOW.getTime() + 200 * 86_400_000);
    const library = buildLibrary(j, bienPlusTard);
    expect(library.resuming[0]?.snapshot).toBeUndefined();
    expect(library.resuming[0]?.key).toBe(BB);
  });
});

describe('nextToResume — le rappel que le produit s interdit d envoyer', () => {
  it('privilegie ce qui revient sur ce qui attend', () => {
    let j = setPosition(EMPTY_JOURNAL, DEXTER, 4, 1, NOW);
    j = setPosition(j, BB, 1, 1, new Date(NOW.getTime() - 86_400_000));
    j = withSnapshot(j, BB, 'Breaking Bad', inDays(2));

    expect(nextToResume(buildLibrary(j, NOW))?.key).toBe(BB);
  });

  it('retombe sur la serie touchee le plus recemment', () => {
    const j = setPosition(EMPTY_JOURNAL, DEXTER, 4, 1, NOW);
    expect(nextToResume(buildLibrary(j, NOW))?.key).toBe(DEXTER);
  });

  it('ne propose rien quand il n y a rien', () => {
    expect(nextToResume(buildLibrary(EMPTY_JOURNAL, NOW))).toBeUndefined();
  });

  it('ne propose pas de reprendre une serie abandonnee', () => {
    let j = setPosition(EMPTY_JOURNAL, DEXTER, 6, 1, NOW);
    j = setDecision(j, DEXTER, 'abandoned', NOW);
    expect(nextToResume(buildLibrary(j, NOW))).toBeUndefined();
  });
});

/**
 * 🔴 Le defaut repare le 2026-08-06 : `lastTouch` enumerait les champs a la main et
 * **il en manquait deux**. Ecrire une critique — la fonctionnalite entiere du lot 8 —
 * ne faisait pas remonter la serie, ni finir un revisionnage.
 *
 * Les deux tests construisent le meme piege : une serie touchee il y a longtemps, puis
 * un seul geste **aujourd'hui**. Si ce geste ne compte pas, c'est l'autre serie qui
 * ressort — et c'est exactement ce que faisait le code d'avant.
 */
describe('lastTouch — tout geste compte, y compris ceux du lot 8', () => {
  const LONGTEMPS = new Date(NOW.getTime() - 10 * 86_400_000);
  const HIER = new Date(NOW.getTime() - 86_400_000);

  it('ecrire une critique fait remonter la serie', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, LONGTEMPS);
    j = setPosition(j, DEXTER, 1, 1, HIER);
    j = setReview(j, BB, reviewKey(), { text: 'Tenue de bout en bout.', throughSeason: 5 }, NOW);

    expect(nextToResume(buildLibrary(j, NOW))?.key).toBe(BB);
  });

  it('mener une serie au bout fait remonter la serie', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, LONGTEMPS);
    j = setPosition(j, DEXTER, 1, 1, HIER);
    j = markCompleted(j, BB, NOW);

    expect(nextToResume(buildLibrary(j, NOW))?.key).toBe(BB);
  });

  it('l ancrage : sans ce geste, c est bien l autre serie qui sort', () => {
    // Sans cette ligne, les deux tests ci-dessus passeraient aussi avec un `lastTouch`
    // qui rendrait n'importe quoi de constant — ils ne prouveraient que l'ordre des cles.
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, LONGTEMPS);
    j = setPosition(j, DEXTER, 1, 1, HIER);

    expect(nextToResume(buildLibrary(j, NOW))?.key).toBe(DEXTER);
  });
});

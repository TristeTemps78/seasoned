import { describe, expect, it } from 'vitest';
import { ENOUGH_EYES, NOT_A_SERIES, eligible } from '@/src/domain/corpus';

/**
 * Le corpus du quiz.
 *
 * Cette regle vivait dans `scripts/build-round.mjs`, donc sous zero test — alors qu'elle
 * decide de tout ce qu'un joueur voit. Ce fichier est la moitie qui manquait.
 */

/** Une entree TMDB plausible, qu'on abime ensuite champ par champ. */
const une = (over: Record<string, unknown> = {}) => ({
  id: 1399,
  name: 'Game of Thrones',
  genre_ids: [18, 10765],
  vote_count: 24000,
  ...over,
});

describe('ce qui n est pas une serie', () => {
  it('🔴 ecarte les journaux, la tele-realite et les talk-shows', () => {
    // La premiere manche construite portait sur *Secret Story*, *Paradise Hotel* et *The
    // Late Show* : TMDB les range parmi les « TV shows », ce produit parle de series.
    for (const genre of [...NOT_A_SERIES]) {
      expect(eligible(une({ genre_ids: [18, genre] }))).toBe(false);
    }
  });

  it('garde une serie qui porte plusieurs genres ordinaires', () => {
    expect(eligible(une({ genre_ids: [18, 10765, 10759] }))).toBe(true);
    expect(eligible(une({ genre_ids: [] }))).toBe(true);
    expect(eligible(une({ genre_ids: undefined }))).toBe(true);
  });
});

describe('ce que personne n a vu', () => {
  it('🔴 ecarte une serie sous le plancher de votes', () => {
    // Mesure du 2026-08-30 : six titres du vivier sont sous 100 votes, dont un a **zero**.
    // Comme reponse ils sont indevinables ; comme leurres ils **donnent** la bonne reponse.
    expect(eligible(une({ name: 'Capitão Furacão', vote_count: 0 }))).toBe(false);
    expect(eligible(une({ name: 'The Daily Fable', vote_count: 5 }))).toBe(false);
    expect(eligible(une({ name: 'Gute Zeiten, schlechte Zeiten', vote_count: 49 }))).toBe(false);
  });

  it('le plancher est une borne inferieure inclusive', () => {
    expect(eligible(une({ vote_count: ENOUGH_EYES - 1 }))).toBe(false);
    expect(eligible(une({ vote_count: ENOUGH_EYES }))).toBe(true);
  });

  it('🔴 un champ absent n est pas un champ au-dessus du plancher', () => {
    // `vote_count` manquant valait `0 >= 100` faux par accident dans le script ; ici c'est
    // dit. Une entree qu'on ne sait pas lire ne rentre pas dans un quiz.
    expect(eligible(une({ vote_count: undefined }))).toBe(false);
    expect(eligible(une({ vote_count: '5000' }))).toBe(false);
  });
});

describe('ce qui n est pas lisible', () => {
  it('ecarte une entree sans nom ou sans identifiant', () => {
    expect(eligible(une({ name: undefined }))).toBe(false);
    expect(eligible(une({ name: '   ' }))).toBe(false);
    expect(eligible(une({ id: undefined }))).toBe(false);
    expect(eligible(une({ id: '1399' }))).toBe(false);
    expect(eligible(undefined)).toBe(false);
  });
});

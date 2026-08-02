import { describe, expect, it } from 'vitest';
import { seasonToRate } from '../src/domain/nudge';

const SEASONS = [
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 12 },
  { seasonNumber: 3, episodeCount: 8 },
];

const NONE: ReadonlySet<number> = new Set();

describe('seasonToRate', () => {
  it('ne demande rien sans position', () => {
    expect(seasonToRate(SEASONS, undefined, NONE)).toBeUndefined();
  });

  it('ne demande rien au milieu d’une saison', () => {
    // Reclamer une note sur une saison a moitie vue serait demander un jugement que
    // le spectateur n'a pas encore.
    expect(seasonToRate(SEASONS, { seasonNumber: 1, episodeNumber: 4 }, NONE)).toBeUndefined();
  });

  it('demande la saison des le dernier episode, sans attendre la suivante', () => {
    // Le point du module : `>=` et non `>`. Exiger d'avoir commence la saison 2
    // manquerait le seul moment ou la question se pose d'elle-meme.
    expect(seasonToRate(SEASONS, { seasonNumber: 1, episodeNumber: 10 }, NONE)).toBe(1);
  });

  it('demande la plus recente entierement vue, et elle seule', () => {
    // Trois saisons vues, zero note : on ne reclame pas trois fois. Un rappel qu'on
    // ne peut pas satisfaire d'un geste devient une dette, pas une invitation.
    expect(seasonToRate(SEASONS, { seasonNumber: 3, episodeNumber: 8 }, NONE)).toBe(3);
  });

  it('redescend a la precedente une fois la plus recente notee', () => {
    expect(seasonToRate(SEASONS, { seasonNumber: 3, episodeNumber: 8 }, new Set([3]))).toBe(2);
    expect(seasonToRate(SEASONS, { seasonNumber: 3, episodeNumber: 8 }, new Set([3, 2]))).toBe(1);
  });

  it('se tait quand tout ce qui est vu est note', () => {
    expect(
      seasonToRate(SEASONS, { seasonNumber: 3, episodeNumber: 8 }, new Set([1, 2, 3])),
    ).toBeUndefined();
  });

  it('ne reclame jamais une saison non atteinte', () => {
    // La regle de spoiler vaut aussi pour la saisie : proposer de noter la saison 3
    // dirait a quelqu'un en saison 1 qu'elle existe (`AGENTS.md` regle 7).
    expect(seasonToRate(SEASONS, { seasonNumber: 1, episodeNumber: 10 }, new Set([1]))).toBeUndefined();
  });

  it('ignore les saisons vides', () => {
    const withHole = [{ seasonNumber: 1, episodeCount: 0 }, ...SEASONS];
    expect(seasonToRate(withHole, { seasonNumber: 2, episodeNumber: 12 }, new Set([2]))).toBe(1);
  });

  it('survit a une position au-dela du catalogue connu', () => {
    expect(seasonToRate(SEASONS, { seasonNumber: 9, episodeNumber: 1 }, NONE)).toBe(3);
  });
});

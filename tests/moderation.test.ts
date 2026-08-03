import { describe, expect, it } from 'vitest';
import { REPORT_GROUNDS, REVIEW_DEADLINE_HOURS } from '../src/domain/moderation';

/**
 * La politique publiee.
 *
 * Un seul test, parce qu'il n'y a qu'une chose que le code peut se tromper ici : oublier
 * un motif dans la liste que `/regles` publie. Le reste — le texte, le delai — est une
 * valeur, et tester une valeur contre elle-meme ne prouve rien.
 */
describe('les motifs de retrait', () => {
  it('sont tous dans la liste que la page publie', () => {
    // Un motif present dans le type mais absent d'ici serait un motif qu'on peut appliquer
    // sans l'avoir annonce. C'est le seul defaut possible, et il est silencieux.
    expect([...REPORT_GROUNDS].sort()).toEqual(
      ['abuse', 'illegal', 'privacy', 'spam', 'spoiler'].sort(),
    );
    expect(REVIEW_DEADLINE_HOURS).toBeGreaterThan(0);
  });
});

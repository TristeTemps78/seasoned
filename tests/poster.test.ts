import { expect, it } from 'vitest';
import { monogram } from '../app/components/Poster';

it('ignore les articles, sinon la moitie du catalogue porte les memes lettres', () => {
  // Le bug : `The Rookie`, `The Wire`, `The Bear` et `The Office` donneraient tous « TH ».
  // Un monogramme qui ne distingue rien ne vaut pas mieux qu'une case vide.
  expect(monogram('The Rookie')).toBe('R');
  expect(monogram('The Walking Dead')).toBe('WD');
  expect(monogram('Les Revenants')).toBe('R');
});

it('coupe aussi sur les deux-points et les tirets', () => {
  // « Star Trek : La Nouvelle Generation » — le titre reel des series longues.
  expect(monogram('Star Trek : La Nouvelle Generation')).toBe('ST');
});

it('rend quelque chose meme pour un titre d un seul mot', () => {
  // Le repli compte : c'est le cas ou la case redeviendrait vide.
  expect(monogram('Dexter')).toBe('D');
});

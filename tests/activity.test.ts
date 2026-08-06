import { expect, it } from 'vitest';
import { projectActivity, redactActivity } from '../src/domain/activity';
import {
  EMPTY_JOURNAL,
  journalKey,
  markCompleted,
  setLiked,
  setPosition,
  setSeasonRating,
  setWanted,
} from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00Z');
const BB = journalKey('1396');

it('publie la nature du fait, jamais la position exacte', () => {
  // Le bug : « en est a S4E2 » dit a un ami ou en est quelqu'un sans qu'il l'ait choisi.
  // Le fil a besoin de savoir qu'on a commence, pas jusqu'ou.
  const journal = setPosition(EMPTY_JOURNAL, BB, 4, 2, NOW);

  const [item] = projectActivity(journal, NOW);

  // `toEqual` est exact : la moindre cle en plus — `season`, `episode` — fait echouer.
  expect(item).toEqual({ kind: 'started', subject: BB, happenedOn: '2026-08-03' });
});

it('ignore ce qui sort de la fenetre de retention', () => {
  // Q9 : 90 jours. Sans cette borne, le fil d'un import massif remonterait des annees en
  // arriere le jour de l'import — l'inondation decrite au §4.2.
  const vieux = new Date('2026-01-01T12:00:00Z');
  const journal = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, vieux);

  expect(projectActivity(journal, NOW)).toHaveLength(0);
});

it('ignore un fait date du futur', () => {
  // Une horloge dereglee de trois jours placerait un fait en tete du fil jusqu'a ce que le
  // temps le rattrape. La base refuse aussi : on ne compte pas sur une seule serrure.
  const demain = new Date('2026-08-10T12:00:00Z');
  const journal = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, demain);

  expect(projectActivity(journal, NOW)).toHaveLength(0);
});

it('un visionnage acheve reste au fil meme si la decision est retiree', () => {
  const journal = markCompleted(setWanted(EMPTY_JOURNAL, BB, true, NOW), BB, NOW);

  const kinds = projectActivity(journal, NOW).map((item) => item.kind);

  expect(kinds).toContain('finished');
  expect(kinds).toContain('wanted');
});

it('🔴 masque la note d une saison que le lecteur n a pas atteinte', () => {
  // Le defaut que la conception initiale laissait passer : « Marie a note la saison 6
  // ★☆☆☆☆ » apprend a quelqu'un qui en est a la saison 2 qu'il EXISTE une saison 6, et
  // qu'elle est mauvaise. C'est le spoiler de trajectoire, entre par une autre porte.
  const fil = projectActivity(setSeasonRating(EMPTY_JOURNAL, BB, 6, 1, NOW), NOW);

  const [vu] = redactActivity(fil, () => 2);

  expect(vu).toEqual({ kind: 'rated_season', subject: BB, happenedOn: '2026-08-03' });
});

it('degrade au lieu de supprimer — un fil a trous est lui-meme un indice', () => {
  const fil = projectActivity(setSeasonRating(EMPTY_JOURNAL, BB, 6, 1, NOW), NOW);

  expect(redactActivity(fil, () => 2)).toHaveLength(1);
});

it('ne masque rien pour une serie que le lecteur n a pas commencee', () => {
  // Il n'a pas de position a proteger, et le nombre de saisons est une donnee publique.
  const fil = projectActivity(setSeasonRating(EMPTY_JOURNAL, BB, 6, 1, NOW), NOW);

  const [vu] = redactActivity(fil, () => undefined);

  expect(vu?.stars).toBe(1);
  expect(vu?.season).toBe(6);
});

it('publie le coeur, et c est le fait le moins spoilant du fil', () => {
  // « Marie aime Breaking Bad » n'apprend a personne ou elle en est ni ce qu'elle pense de
  // la saison 6 — contrairement a une note de saison, que `redactActivity` doit degrader.
  const journal = setLiked(EMPTY_JOURNAL, BB, true, NOW);

  const [item] = projectActivity(journal, NOW);

  expect(item).toEqual({ kind: 'liked', subject: BB, happenedOn: '2026-08-03' });
});

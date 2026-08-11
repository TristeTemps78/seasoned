import { expect, it } from 'vitest';
import { projectActivity } from '../src/domain/activity';
import {
  EMPTY_JOURNAL,
  journalKey,
  setLiked,
  setSeasonRating,
  setSnapshot,
} from '../src/domain/journal';

/**
 * Le fait voyage avec le titre de sa serie (018, 2026-08-11).
 *
 * 🔴 **Le defaut que ca corrige n'etait visible qu'a l'ecran** : le fil affichait
 * « @test wrote about tmdb:94997 », et le bloc des faits ne nommait pas la serie du tout.
 * Deux passes de mesures — couleurs, icones, crans typographiques — sont passees a cote,
 * parce que le HTML rendu contient bien *un* texte a cet endroit. Il a fallu une capture.
 */

const NOW = new Date('2026-08-11T12:00:00Z');
const BB = journalKey('1396');

function avecInstantane(titre: string, affiche?: string) {
  const journal = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW);
  return setSnapshot(
    journal,
    BB,
    { title: titre, ...(affiche !== undefined ? { posterPath: affiche } : {}) },
    NOW,
  );
}

it('emporte le titre et l affiche de l instantane', () => {
  const [item] = projectActivity(avecInstantane('Breaking Bad', '/abc.jpg'), NOW);
  expect(item?.title).toBe('Breaking Bad');
  expect(item?.posterPath).toBe('/abc.jpg');
});

it('n invente rien quand l entree n a pas d instantane', () => {
  // Une serie ajoutee sans avoir jamais ete ouverte n'a pas d'instantane. Publier une chaine
  // vide ferait echouer la contrainte `activity_titre_borne` (>= 1 caractere) et donc
  // l'envoi ENTIER du compte — la classe de panne que 017 a coute une base vide a trouver.
  const [item] = projectActivity(setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW), NOW);
  expect(item).not.toHaveProperty('title');
  expect(item).not.toHaveProperty('posterPath');
});

it('emporte le titre sans l affiche quand seule l affiche manque', () => {
  const [item] = projectActivity(avecInstantane('Breaking Bad'), NOW);
  expect(item?.title).toBe('Breaking Bad');
  expect(item).not.toHaveProperty('posterPath');
});

it('donne le meme instantane a tous les faits d une meme serie', () => {
  // Calcule une fois par entree, pas par fait : cinq genres de la meme serie portent
  // forcement le meme titre, et le recopier cinq fois invite a en oublier un.
  const journal = setSnapshot(
    setLiked(setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW), BB, true, NOW),
    BB,
    { title: 'Breaking Bad', posterPath: '/abc.jpg' },
    NOW,
  );
  const items = projectActivity(journal, NOW);
  expect(items.length).toBeGreaterThan(1);
  for (const item of items) expect(item.title).toBe('Breaking Bad');
});

it('⚠️ le titre n entre PAS dans l identite d un fait', () => {
  // Sinon une serie renommee chez TMDB se dedoublerait dans le fil, et le
  // `merge-duplicates` de `publish` echouerait en 21000 — c'est-a-dire que le compte ne
  // publierait PLUS RIEN, ni ses coeurs ni ses series terminees. Exactement 017.
  const avant = projectActivity(avecInstantane('Breaking Bad'), NOW);
  const apres = projectActivity(avecInstantane('Breaking Bad (2008)'), NOW);

  expect(avant).toHaveLength(1);
  expect(apres).toHaveLength(1);
  // Meme fait, meme identite : seul l'habillage a change.
  expect(apres[0]?.kind).toBe(avant[0]?.kind);
  expect(apres[0]?.subject).toBe(avant[0]?.subject);
  expect(apres[0]?.happenedOn).toBe(avant[0]?.happenedOn);
});

it('le titre respecte la borne de la base', () => {
  // `activity_titre_borne` refuse au-dela de 200 caracteres, et un refus fait echouer
  // l'envoi entier. Le journal ne borne rien : c'est TMDB qui fournit le titre, et aucun
  // titre de serie n'approche cette limite — on verifie donc que le cas reste theorique.
  const [item] = projectActivity(avecInstantane('Breaking Bad'), NOW);
  expect((item?.title ?? '').length).toBeLessThanOrEqual(200);
});

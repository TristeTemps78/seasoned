/**
 * A13 — le garde-fou des films.
 *
 * Tristan a tranché le 2026-08-03 : le produit suit les films, pas seulement les séries.
 * Ce fichier ne teste **aucune fonctionnalité film**. Il teste la seule chose qui devait
 * exister *avant* la première entrée film : qu'une telle entrée ne fausse **rien**.
 *
 * ## Pourquoi ces tests-là, et pas des tests de feature
 *
 * Quatre modules du domaine parcourent le journal entier en supposant que chaque entrée a
 * des saisons : `calendar`, `library`, `tally`, `taste`. Une entrée film non filtrée **ne
 * plante pas** — elle empoisonne *silencieusement* chaque agrégat, et le typage ne dit
 * rien puisqu'une clé de journal est une chaîne.
 *
 * > **Un module qui compile n'est pas un module qui filtre.**
 *
 * La forme de chaque test est donc toujours la même : calculer l'agrégat **sans** le film,
 * ajouter le film, recalculer, et exiger l'**égalité**. C'est ce qui distingue un test de
 * régression d'un test qui décrit une intention — il compare deux résultats réels au lieu
 * de vérifier une valeur écrite à la main.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  isMovieKey,
  isSeriesKey,
  journalKey,
  markCompleted,
  MOVIE_PROVIDER,
  movieKey,
  parseJournalKey,
  seriesEntries,
  setDecision,
  setPosition,
  setSnapshot,
  type Journal,
} from '../src/domain/journal';
import { buildTally } from '../src/domain/tally';
import { buildLibrary } from '../src/domain/library';
import { buildTasteProfile } from '../src/domain/taste';
import { upcomingFrom } from '../src/domain/calendar';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const SOON = new Date('2026-08-20T00:00:00.000Z');

const BREAKING_BAD = journalKey('1396');
const FIGHT_CLUB = movieKey('550');

/**
 * Une série suivie, notée, avec sa forme mémorisée — de quoi alimenter les quatre agrégats.
 *
 * ⚠️ **L'ordre des appels est le sujet, et il a déjà piégé ce fichier.** `setSnapshot`
 * ignore une entrée qui n'existe pas encore (`if (entry === undefined) return journal`) :
 * un instantané s'**attache** à un geste, il ne le crée pas — le catalogue est loué, donc
 * regarder une page n'écrit rien. Écrit dans le mauvais ordre, ce fixture ne produisait
 * **aucun** instantané, ni pour la série ni pour le film, et les quatre tests d'égalité
 * passaient en comparant deux agrégats **vides**.
 *
 * > **Quatrième faux négatif de fixture du projet.** D'où le `describe` d'ancrage plus bas :
 * > une égalité ne prouve quelque chose que si l'on a d'abord montré qu'il y a quelque chose
 * > à fausser.
 */
function withSeries(journal: Journal): Journal {
  // Le geste d'abord — c'est lui qui fait exister l'entrée.
  let next = setPosition(journal, BREAKING_BAD, 2, 5, NOW);
  next = setDecision(next, BREAKING_BAD, 'continuing', NOW);
  return setSnapshot(
    next,
    BREAKING_BAD,
    {
      title: 'Breaking Bad',
      episodeMinutes: 45,
      nextEpisodeAt: SOON.toISOString(),
      seasonSizes: [
        { seasonNumber: 1, episodeCount: 7 },
        { seasonNumber: 2, episodeCount: 13 },
      ],
    },
    NOW,
  );
}

/**
 * Le même journal, plus un film — et un film aussi « riche » que possible.
 *
 * ⚠️ Le piège que ce fixture tend volontairement : il porte une **date de prochain
 * épisode** et une **position**, deux champs qui n'ont aucun sens pour un film. Un fixture
 * timide (un film sans rien dedans) passerait les tests même sans le garde-fou — c'est
 * exactement le faux négatif de fixture qui a coûté trois défauts au projet.
 */
function plusMovie(journal: Journal): Journal {
  let next = setPosition(journal, FIGHT_CLUB, 1, 1, NOW);
  next = markCompleted(next, FIGHT_CLUB, NOW);
  next = setDecision(next, FIGHT_CLUB, 'completed', NOW);
  return setSnapshot(
    next,
    FIGHT_CLUB,
    {
      title: 'Fight Club',
      episodeMinutes: 139,
      nextEpisodeAt: SOON.toISOString(),
      seasonSizes: [{ seasonNumber: 1, episodeCount: 1 }],
    },
    NOW,
  );
}

describe('les clés — un espace d’identifiants, pas seulement un fournisseur', () => {
  it('donne aux films un espace distinct, et laisse les séries intactes', () => {
    // Le point de toute la décision : aucune migration. La clé série ne bouge pas.
    expect(BREAKING_BAD).toBe('tmdb:1396');
    expect(FIGHT_CLUB).toBe('tmdb-movie:550');
    expect(MOVIE_PROVIDER).toBe('tmdb-movie');
  });

  it('reste lisible par le parseur existant, qui coupe au PREMIER deux-points', () => {
    // C'est ce détail-là qui rend la décision gratuite. S'il coupait au dernier, ou s'il
    // refusait un tiret, il faudrait migrer tous les journaux.
    expect(parseJournalKey(FIGHT_CLUB)).toEqual({
      provider: 'tmdb-movie',
      providerId: '550',
    });
  });

  it('sépare film et série', () => {
    expect(isMovieKey(FIGHT_CLUB)).toBe(true);
    expect(isSeriesKey(FIGHT_CLUB)).toBe(false);
    expect(isMovieKey(BREAKING_BAD)).toBe(false);
    expect(isSeriesKey(BREAKING_BAD)).toBe(true);
  });

  it('traite une clé illisible comme une série', () => {
    // Elle ne peut venir que d'avant A13, époque où tout était une série. Ne rien changer
    // pour elle est le seul choix qui préserve le comportement existant.
    expect(isSeriesKey('nimportequoi')).toBe(true);
    expect(isSeriesKey('')).toBe(true);
    expect(isMovieKey('nimportequoi')).toBe(false);
  });

  it('EXCLUT un type inconnu des séries, au lieu de l’y inclure', () => {
    // 🔴 Le test qui justifie `isSeriesKey` plutôt que `!isMovieKey`. Le jour où un livre
    // ou un album arrive — le concurrent Achriom en fait déjà — il ne doit PAS être compté
    // comme une série : ses saisons absentes fausseraient chaque agrégat, en silence.
    // Le garde-fou doit échouer vers l'exclusion : omettre ne coûte qu'un oubli, inclure
    // corrompt.
    expect(isSeriesKey('tmdb-book:12')).toBe(false);
    expect(isSeriesKey('tmdb-album:12')).toBe(false);
    expect(isMovieKey('tmdb-book:12')).toBe(false);
  });

  it('garde les films hors de seriesEntries', () => {
    const journal = plusMovie(withSeries(EMPTY_JOURNAL));
    // Les deux entrées sont bien dans le journal — on ne les perd pas, on les filtre.
    expect(Object.keys(journal.entries)).toHaveLength(2);
    expect(seriesEntries(journal).map(([key]) => key)).toEqual([BREAKING_BAD]);
  });
});

/**
 * 🔴 L'ancrage — ce qui empêche les égalités suivantes d'être creuses.
 *
 * Comparer deux résultats vides donne toujours l'égalité. Avant de prouver qu'un film ne
 * change rien, il faut donc prouver que **la série, elle, produit bien quelque chose**.
 * Sans ce `describe`, la première version de ce fichier était verte alors qu'elle ne
 * mesurait rien.
 */
describe('l’ancrage : la série produit bien un agrégat non vide', () => {
  const journal = withSeries(EMPTY_JOURNAL);

  it('l’instantané est réellement écrit', () => {
    // Le test qui aurait attrapé le faux négatif de fixture. Il n'existait pas.
    expect(journal.entries[BREAKING_BAD]?.snapshot?.title).toBe('Breaking Bad');
    expect(journal.entries[BREAKING_BAD]?.snapshot?.seasonSizes).toHaveLength(2);
  });

  it('le bilan compte de vraies minutes', () => {
    const tally = buildTally(journal, NOW);
    expect(tally.counted).toBe(1);
    expect(tally.minutes).toBeGreaterThan(0);
  });

  it('la bibliothèque et le calendrier ne sont pas vides', () => {
    const library = buildLibrary(journal, NOW);
    expect(library.total).toBe(1);
    // `returning` et non `resuming` : la série porte une date de diffusion à venir, et
    // « revient bientôt » prime sur « reprendre ». Constaté, pas supposé — ma première
    // assertion disait `resuming` et avait tort.
    expect(library.returning).toHaveLength(1);
    expect(upcomingFrom(journal, NOW)).toHaveLength(1);
  });
});

describe('un film ne fausse aucun agrégat de séries', () => {
  const withoutMovie = withSeries(EMPTY_JOURNAL);
  const withMovie = plusMovie(withoutMovie);

  it('le bilan d’heures est identique', () => {
    // 🔴 Sans le filtre, `tally` compterait le film. Comme il n'a pas de vraie forme de
    // série, il tomberait soit dans `uncounted` — faisant chuter le taux de couverture,
    // donc faisant TAIRE le bilan sous 50 % — soit dans les minutes, avec un chiffre faux.
    // Les deux échecs sont invisibles : le bilan se contente de dire autre chose.
    expect(buildTally(withMovie, NOW)).toEqual(buildTally(withoutMovie, NOW));
  });

  it('la bibliothèque est identique', () => {
    expect(buildLibrary(withMovie, NOW)).toEqual(buildLibrary(withoutMovie, NOW));
  });

  it('le profil de goût est identique', () => {
    // Le goût se lit sur des saisons et des abandons. Le film du fixture est « terminé »
    // et « complété » : sans filtre il gonflerait le compte de séries finies et pourrait
    // même devenir la série-refuge.
    expect(buildTasteProfile(withMovie, NOW)).toEqual(buildTasteProfile(withoutMovie, NOW));
  });

  it('le calendrier est identique — malgré une date de diffusion sur le film', () => {
    // Le fixture donne exprès un `nextEpisodeAt` au film. Sans filtre, l'agenda de
    // l'utilisateur recevrait un « prochain épisode » pour Fight Club.
    expect(upcomingFrom(withMovie, NOW)).toEqual(upcomingFrom(withoutMovie, NOW));
    expect(upcomingFrom(withMovie, NOW).map((e) => e.title)).toEqual(['Breaking Bad']);
  });

  it('et le journal n’a rien perdu au passage', () => {
    // Le garde-fou filtre à la lecture ; il ne doit rien effacer. Un film écarté d'un
    // agrégat doit rester exportable (règle 9) et récupérable par la feature à venir.
    expect(withMovie.entries[FIGHT_CLUB]?.snapshot?.title).toBe('Fight Club');
  });
});

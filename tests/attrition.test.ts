import { describe, expect, it } from 'vitest';

import {
  MIN_LEAVE_RATE,
  MIN_REACHED_FOR_RATE,
  projectStops,
  readAttrition,
  type StopBucket,
} from '../src/domain/attrition';
import { asImported, EMPTY_JOURNAL, setDecision, setPosition } from '../src/domain/journal';
import type { Position } from '../src/domain/types';

/**
 * La carte des abandons.
 *
 * Ce que ces tests protegent tient en une phrase : **le module existe pour supprimer un
 * biais de survie, et trois de ses regles le reintroduiraient si on les retirait.** Chacune
 * a donc son cas nomme, et non un `expect` de plus dans un cas voisin.
 */

const NOW = new Date('2026-08-10T12:00:00Z');
const KEY = 'tmdb:1396';

/** Douze saisons de dix episodes : de quoi peser un arret sans arithmetique dans le test. */
const SEASONS = Array.from({ length: 12 }, (_, i) => ({
  seasonNumber: i + 1,
  episodeCount: 10,
}));
const EPISODES = 120;

function at(seasonNumber: number): Position {
  return { at: { seriesId: '1396', seasonNumber, episodeNumber: 1 }, declaredAt: NOW };
}

/** Une courbe ou tout le monde arrive, et ou `leaving` personnes lachent en `season`. */
function curve(reached: number, season: number, leaving: number): readonly StopBucket[] {
  return SEASONS.map((s) => ({
    season: s.seasonNumber,
    reached,
    leftHere: s.seasonNumber === season ? leaving : 0,
  }));
}

describe('projectStops — ce qu on apporte a la carte', () => {
  it('porte la position comme denominateur, et l abandon comme numerateur', () => {
    let journal = setPosition(EMPTY_JOURNAL, KEY, 4, 3, NOW);
    journal = setDecision(journal, KEY, 'abandoned', NOW);

    expect(projectStops(journal)).toEqual([
      { subject: KEY, reachedSeason: 4, leftAtSeason: 4 },
    ]);
  });

  it('compte celui qui avance sans avoir rien decide — le denominateur seul', () => {
    const journal = setPosition(EMPTY_JOURNAL, KEY, 6, 2, NOW);
    expect(projectStops(journal)).toEqual([{ subject: KEY, reachedSeason: 6 }]);
  });

  it('ne compte pas une pause ni une serie terminee comme un abandon', () => {
    for (const kind of ['continuing', 'paused', 'completed'] as const) {
      let journal = setPosition(EMPTY_JOURNAL, KEY, 5, 1, NOW);
      journal = setDecision(journal, KEY, kind, NOW);
      expect(projectStops(journal)[0]?.leftAtSeason).toBeUndefined();
    }
  });

  /**
   * 🔴 **La regle qui protege la mesure d'elle-meme.**
   *
   * `importForeign` ecrit une position et **jamais** une decision. Un import n'apporte donc
   * que du denominateur : il gonfle `reached` sans jamais pouvoir toucher `leftHere`, et la
   * courbe pencherait vers la survie — c'est-a-dire qu'elle **reintroduirait le biais que ce
   * module existe pour supprimer**.
   */
  it('ecarte entierement une entree reprise d ailleurs', () => {
    let journal = setPosition(EMPTY_JOURNAL, KEY, 4, 3, NOW);
    journal = setDecision(journal, KEY, 'abandoned', NOW);
    const imported = asImported(journal);

    // L'ancrage : sans lui, un fixture qui n'aurait rien marque rendrait ce test vert pour
    // la mauvaise raison.
    expect(imported.entries[KEY]?.position?.origin).toBe('import');
    expect(projectStops(imported)).toEqual([]);
  });

  it('ecarte un film — la carte se lit en saisons (A13)', () => {
    const journal = setPosition(EMPTY_JOURNAL, 'tmdb-movie:603', 1, 1, NOW);
    expect(projectStops(journal)).toEqual([]);
  });

  /**
   * ⚠️ Une position se declare a la main, donc elle peut **reculer**. Sans le `max`, la
   * ligne porterait `left > reached`, que `stops_left_within_reached` refuse — et le
   * `POST` entier echouerait, emportant les series des autres lignes du meme envoi.
   */
  it('ne produit jamais un arret plus loin que le point atteint', () => {
    let journal = setPosition(EMPTY_JOURNAL, KEY, 5, 4, NOW);
    journal = setDecision(journal, KEY, 'abandoned', NOW);
    journal = setPosition(journal, KEY, 2, 1, NOW);

    const record = projectStops(journal)[0];
    expect(record?.leftAtSeason).toBe(5);
    expect(record?.reachedSeason).toBe(5);
  });
});

describe('readAttrition — ce qu on ose en dire', () => {
  it('nomme la saison ou l on decroche, avec son effectif', () => {
    const read = readAttrition(curve(40, 4, 25), at(12), SEASONS, EPISODES);
    expect(read.verdict).toEqual({ atSeason: 4, leaveRate: 25 / 40, reached: 40 });
  });

  /** La lecon de `MIN_SERIES_FOR_TASTE` : un taux sur trois cas est du bruit. */
  it('se tait sous l effectif minimal, meme quand tout le monde lache', () => {
    const thin = MIN_REACHED_FOR_RATE - 1;
    const read = readAttrition(curve(thin, 4, thin), at(12), SEASONS, EPISODES);
    expect(read.verdict).toBeUndefined();
  });

  it('se tait sur une perte ordinaire', () => {
    // Juste sous le seuil : toute serie perd du monde, ce n'est pas un decrochage.
    const leaving = Math.floor(100 * MIN_LEAVE_RATE) - 1;
    expect(readAttrition(curve(100, 4, leaving), at(12), SEASONS, EPISODES).verdict)
      .toBeUndefined();
    expect(readAttrition(curve(100, 4, leaving + 1), at(12), SEASONS, EPISODES).verdict)
      .toBeDefined();
  });

  /**
   * La lecon *Dexter*, reprise de `stop-point.ts` : **un conseil exact mais sans portee ne
   * vaut pas mieux que pas de conseil.** Elle vaut pour la foule comme pour les notes.
   */
  it('se tait sur un decrochage a la toute fin, qui n epargnerait rien', () => {
    const read = readAttrition(curve(40, 12, 30), at(12), SEASONS, EPISODES);
    expect(read.verdict).toBeUndefined();
  });

  it('coupe la courbe a la position, et ne juge que sur ce qui reste', () => {
    const read = readAttrition(curve(40, 8, 30), at(3), SEASONS, EPISODES);

    expect(read.curve.map((b) => b.season)).toEqual([1, 2, 3]);
    expect(read.hiddenSeasons).toBe(9);
    // Le decrochage est en saison 8 : il ne doit pas etre enonce a quelqu'un en saison 3…
    expect(read.verdict).toBeUndefined();
    // …mais son existence, elle, se signale — sans dire ou ni combien.
    expect(read.hasHiddenSignal).toBe(true);
  });

  /**
   * ⚠️ Le signal cache doit suivre **les memes seuils** que le verdict visible. Plus
   * liberal, il promettrait « il se passe quelque chose plus loin » suivi de rien au clic.
   */
  it('ne signale rien au-dela quand ce qui s y trouve ne serait pas dit non plus', () => {
    const read = readAttrition(curve(40, 12, 30), at(3), SEASONS, EPISODES);
    expect(read.hiddenSeasons).toBe(9);
    expect(read.hasHiddenSignal).toBe(false);
  });

  /** *Mieux vaut masquer a tort que spoiler* — le defaut strict de tout le module. */
  it('ne montre rien a qui n a pas commence', () => {
    const read = readAttrition(curve(40, 4, 25), undefined, SEASONS, EPISODES);
    expect(read.curve).toEqual([]);
    expect(read.verdict).toBeUndefined();
    expect(read.hasHiddenSignal).toBe(true);
  });

  it('garde le decrochage le plus tot a egalite — celui qui epargne le plus', () => {
    const buckets: readonly StopBucket[] = SEASONS.map((s) => ({
      season: s.seasonNumber,
      reached: 40,
      leftHere: s.seasonNumber === 3 || s.seasonNumber === 5 ? 20 : 0,
    }));
    expect(readAttrition(buckets, at(12), SEASONS, EPISODES).verdict?.atSeason).toBe(3);
  });

  it('se tait sur une serie vide plutot que de diviser par zero', () => {
    const read = readAttrition(curve(40, 4, 25), at(12), [], 0);
    expect(read.verdict).toBeUndefined();
    expect(Number.isNaN(read.curve.length)).toBe(false);
  });
});

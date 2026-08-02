import { describe, expect, it } from 'vitest';
import {
  buildTally,
  MIN_TALLY_COVERAGE,
  MIN_TALLY_MINUTES,
} from '../src/domain/tally';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  journalKey,
  markCompleted,
  setDecision,
  setPosition,
  setSnapshot,
  setWanted,
  SNAPSHOT_TTL_MS,
  type Journal,
  type JournalSnapshot,
} from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const BB = journalKey('1396');
const DEXTER = journalKey('1405');

/** Cinq saisons de dix episodes : cinquante episodes, quarante minutes chacun. */
const SHAPE: Omit<JournalSnapshot, 'cachedAt'> = {
  title: 'Breaking Bad',
  episodeMinutes: 40,
  seasonSizes: [
    { seasonNumber: 1, episodeCount: 10 },
    { seasonNumber: 2, episodeCount: 10 },
    { seasonNumber: 3, episodeCount: 10 },
    { seasonNumber: 4, episodeCount: 10 },
    { seasonNumber: 5, episodeCount: 10 },
  ],
};

const TOTAL_EPISODES = 50;
const TOTAL_MINUTES = TOTAL_EPISODES * 40;

/** Une serie suivie, avec sa forme memorisee. */
function withShape(
  journal: Journal,
  key: string,
  shape: Omit<JournalSnapshot, 'cachedAt'> = SHAPE,
  at: Date = NOW,
): Journal {
  return setSnapshot(journal, key, shape, at);
}

describe('buildTally — ce que vous avez donne', () => {
  it('ne dit rien d un journal vide', () => {
    const tally = buildTally(EMPTY_JOURNAL, NOW);
    expect(tally.minutes).toBe(0);
    expect(tally.counted).toBe(0);
    expect(tally.coverage).toBe(0);
    expect(tally.worthShowing).toBe(false);
  });

  it('compte ce qui precede la position, celle-ci comprise', () => {
    // S3E7 : les deux premieres saisons entieres, plus sept episodes. La position est
    // inclusive — meme contrat que `remainingAfter`, dont ce module reutilise le calcul.
    let j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    j = withShape(j, BB);

    const tally = buildTally(j, NOW);
    expect(tally.episodes).toBe(27);
    expect(tally.minutes).toBe(27 * 40);
    expect(tally.counted).toBe(1);
    expect(tally.uncounted).toBe(0);
  });

  it('compte une serie terminee en entier', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 10, NOW);
    j = setDecision(j, BB, 'completed', NOW);
    j = markCompleted(j, BB, NOW);
    j = withShape(j, BB);

    expect(buildTally(j, NOW).episodes).toBe(TOTAL_EPISODES);
  });

  it('⚠️ ne compte jamais deux fois la fin d une serie finie', () => {
    // Le piege central de ce module : `setDecision` n efface pas la position, donc
    // « les passages acheves + la position » compterait la derniere saison en double sur
    // **toute** serie terminee. La position posee AVANT la fin est un vestige.
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 10, new Date(NOW.getTime() - 3_600_000));
    j = setDecision(j, BB, 'completed', NOW);
    j = markCompleted(j, BB, NOW);
    j = withShape(j, BB);

    const tally = buildTally(j, NOW);
    expect(tally.episodes).toBe(TOTAL_EPISODES);
    expect(tally.minutes).toBe(TOTAL_MINUTES);
  });

  it('ajoute le passage en cours quand il suit la derniere fin', () => {
    // Fini une fois, puis recommence : la position est POSTERIEURE au passage acheve,
    // donc elle decrit un nouveau visionnage et s ajoute.
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 10, new Date(NOW.getTime() - 86_400_000));
    j = markCompleted(j, BB, new Date(NOW.getTime() - 86_400_000));
    j = setPosition(j, BB, 2, 3, NOW);
    j = withShape(j, BB);

    // Un passage complet (50) plus treize episodes du second.
    expect(buildTally(j, NOW).episodes).toBe(TOTAL_EPISODES + 13);
  });

  it('le revisionnage multiplie le total', () => {
    // La position est posee en regardant, donc **avant** que le passage soit acheve :
    // c est celle du troisieme visionnage, deja compte par `markCompleted`.
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 10, new Date('2026-07-09T10:00:00.000Z'));
    j = markCompleted(j, BB, new Date('2026-01-10T10:00:00.000Z'));
    j = markCompleted(j, BB, new Date('2026-04-10T10:00:00.000Z'));
    j = markCompleted(j, BB, new Date('2026-07-10T10:00:00.000Z'));
    j = withShape(j, BB);

    const tally = buildTally(j, NOW);
    expect(tally.episodes).toBe(3 * TOTAL_EPISODES);
    expect(tally.heaviest?.passes).toBe(3);
  });

  it('un quatrieme passage entame apres trois fins s ajoute aux trois', () => {
    // Le symetrique du test precedent, sur les memes donnees : ce qui distingue les deux
    // est **la date**, et rien d autre. C est toute la regle n°1 du module.
    let j = EMPTY_JOURNAL;
    for (const at of ['2026-01-10', '2026-04-10', '2026-07-10']) {
      j = markCompleted(j, BB, new Date(`${at}T10:00:00.000Z`));
    }
    j = setPosition(j, BB, 2, 3, NOW);
    j = withShape(j, BB);

    expect(buildTally(j, NOW).episodes).toBe(3 * TOTAL_EPISODES + 13);
  });

  it('un journal v2 migre compte sa serie terminee', () => {
    // Pas de liste de passages avant la v3 : sans ce repli, tout ce qui a ete fini avant
    // le 2026-08-03 compterait pour rien.
    const j: Journal = {
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          decision: { kind: 'completed', at: NOW.toISOString() },
          snapshot: { ...SHAPE, cachedAt: NOW.toISOString() },
        },
      },
    };
    expect(buildTally(j, NOW).episodes).toBe(TOTAL_EPISODES);
  });

  it('une serie abandonnee ne compte que jusqu au point d abandon', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 2, 4, NOW);
    j = setDecision(j, BB, 'abandoned', NOW);
    j = withShape(j, BB);

    expect(buildTally(j, NOW).episodes).toBe(14);
  });

  it('retrouve le point d abandon meme sans position', () => {
    // `setDecision` memorise ou la decision a ete prise, precisement pour cela.
    const j: Journal = {
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          decision: { kind: 'abandoned', at: NOW.toISOString(), atSeason: 2, atEpisode: 4 },
          snapshot: { ...SHAPE, cachedAt: NOW.toISOString() },
        },
      },
    };
    expect(buildTally(j, NOW).episodes).toBe(14);
  });

  it('« je veux la voir » ne compte ni au numerateur ni au denominateur', () => {
    // Ne pas pouvoir chiffrer une serie jamais commencee n est pas un manque.
    let j = setWanted(EMPTY_JOURNAL, DEXTER, true, NOW);
    j = setPosition(j, BB, 3, 7, NOW);
    j = withShape(j, BB);

    const tally = buildTally(j, NOW);
    expect(tally.counted).toBe(1);
    expect(tally.uncounted).toBe(0);
    expect(tally.coverage).toBe(1);
  });
});

describe('ce que le module avoue ne pas savoir', () => {
  it('compte comme non chiffrable une serie sans forme memorisee', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    j = withShape(j, BB, { title: 'Breaking Bad', episodeMinutes: 40 });

    const tally = buildTally(j, NOW);
    expect(tally.counted).toBe(0);
    expect(tally.uncounted).toBe(1);
    expect(tally.minutes).toBe(0);
  });

  it('compte comme non chiffrable une serie sans duree d episode', () => {
    // Le cas courant, pas l exception : TMDB abandonne `episode_run_time`.
    let j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    j = withShape(j, BB, { title: 'Breaking Bad', seasonSizes: SHAPE.seasonSizes! });

    expect(buildTally(j, NOW).uncounted).toBe(1);
  });

  it('un instantane expire au plafond contractuel rend la serie non chiffrable', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    j = withShape(j, BB, SHAPE, new Date('2026-01-01T00:00:00.000Z'));

    // Sept mois plus tard : au-dela des six mois du contrat, l instantane a disparu.
    const later = new Date('2026-08-03T12:00:00.000Z');
    expect(buildTally(j, later).uncounted).toBe(1);
  });

  it('mais la forme survit aux trente jours, sans quoi le bilan ne mesurerait rien', () => {
    // Les series terminees ne sont jamais revisitees : les ranger avec le mouvant aurait
    // exclu du bilan exactement celles qui y pesent le plus lourd.
    let j = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    j = withShape(j, BB);

    const later = new Date(NOW.getTime() + SNAPSHOT_TTL_MS + 86_400_000);
    const tally = buildTally(j, later);
    expect(tally.counted).toBe(1);
    expect(tally.episodes).toBe(27);
  });

  it('se tait sous le seuil de couverture', () => {
    // Trois series vues, une seule chiffrable : « au moins 18 heures » ferait passer un
    // tiers de la verite pour un total.
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 10, NOW);
    j = withShape(j, BB);
    for (const id of ['1405', '1402']) {
      const key = journalKey(id);
      j = setPosition(j, key, 3, 7, NOW);
      j = withShape(j, key, { title: `Serie ${id}` });
    }

    const tally = buildTally(j, NOW);
    expect(tally.coverage).toBeLessThan(MIN_TALLY_COVERAGE);
    expect(tally.worthShowing).toBe(false);
    // Le chiffre existe : c est son affichage qu on refuse, pas son calcul.
    expect(tally.minutes).toBeGreaterThan(0);
  });

  it('se tait sous le seuil de duree, meme a couverture parfaite', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    j = withShape(j, BB, { ...SHAPE, episodeMinutes: 20 });

    const tally = buildTally(j, NOW);
    expect(tally.coverage).toBe(1);
    expect(tally.minutes).toBeLessThan(MIN_TALLY_MINUTES);
    expect(tally.worthShowing).toBe(false);
  });

  it('parle des que les deux seuils sont franchis', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 5, 10, NOW);
    j = withShape(j, BB);

    const tally = buildTally(j, NOW);
    expect(tally.worthShowing).toBe(true);
    expect(tally.heaviest?.title).toBe('Breaking Bad');
  });
});

describe('les lois — un exemple prouve un cas, une loi prouve la classe', () => {
  /** Un journal de n series, chacune vue jusqu a S3E7. */
  function journalOf(ids: readonly string[]): Journal {
    let j = EMPTY_JOURNAL;
    for (const id of ids) {
      const key = journalKey(id);
      j = setPosition(j, key, 3, 7, NOW);
      j = withShape(j, key, { ...SHAPE, title: `Serie ${id}` });
    }
    return j;
  }

  it('le total ne depend pas de l ordre des entrees', () => {
    const ids = ['1396', '1405', '1402', '1399'];
    const forward = buildTally(journalOf(ids), NOW);
    const backward = buildTally(journalOf([...ids].reverse()), NOW);

    expect(forward.minutes).toBe(backward.minutes);
    expect(forward.episodes).toBe(backward.episodes);
    expect(forward.counted).toBe(backward.counted);
  });

  it('ajouter un visionnage ne fait jamais baisser le total', () => {
    // Monotonie : c est la propriete qui rendrait visible une soustraction accidentelle.
    let j = withShape(setPosition(EMPTY_JOURNAL, BB, 2, 5, NOW), BB);
    let previous = buildTally(j, NOW).minutes;

    for (let pass = 1; pass <= 4; pass += 1) {
      j = markCompleted(j, BB, new Date(NOW.getTime() + pass * 86_400_000));
      const current = buildTally(j, new Date(NOW.getTime() + pass * 86_400_000)).minutes;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('avancer dans une serie ne fait jamais baisser le total', () => {
    let previous = 0;
    for (const [season, episode] of [[1, 1], [1, 10], [3, 4], [5, 9], [5, 10]] as const) {
      const j = withShape(setPosition(EMPTY_JOURNAL, BB, season, episode, NOW), BB);
      const current = buildTally(j, NOW).minutes;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('le total d un journal est la somme de ses series prises seules', () => {
    // Aucune interaction entre entrees : ce qui garantit qu ajouter une serie n en
    // modifie aucune autre.
    const ids = ['1396', '1405', '1402'];
    const whole = buildTally(journalOf(ids), NOW);
    const parts = ids
      .map((id) => buildTally(journalOf([id]), NOW).minutes)
      .reduce((sum, m) => sum + m, 0);

    expect(whole.minutes).toBe(parts);
  });

  it('la couverture reste dans [0, 1] quoi qu on lui donne', () => {
    const cases: readonly Journal[] = [
      EMPTY_JOURNAL,
      journalOf(['1396']),
      journalOf(['1396', '1405', '1402']),
      withShape(setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW), BB, { title: 'Sans forme' }),
      setWanted(EMPTY_JOURNAL, BB, true, NOW),
    ];

    for (const journal of cases) {
      const { coverage } = buildTally(journal, NOW);
      expect(coverage).toBeGreaterThanOrEqual(0);
      expect(coverage).toBeLessThanOrEqual(1);
    }
  });

  it('ne leve jamais sur un journal abime', () => {
    const broken: Journal = {
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          position: { seasonNumber: 9, episodeNumber: 99, declaredAt: 'pas une date' },
          completions: [{ at: 'pas une date' }],
          snapshot: { ...SHAPE, cachedAt: 'pas une date' },
        },
        [DEXTER]: {
          decision: { kind: 'abandoned', at: NOW.toISOString() },
          snapshot: { title: 'Dexter', seasonSizes: [], cachedAt: NOW.toISOString() },
        },
      },
    };

    expect(() => buildTally(broken, NOW)).not.toThrow();
    const tally = buildTally(broken, NOW);
    expect(Number.isFinite(tally.minutes)).toBe(true);
    expect(tally.minutes).toBeGreaterThanOrEqual(0);
  });
});

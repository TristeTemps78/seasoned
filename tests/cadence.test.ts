import { describe, expect, it } from 'vitest';
import {
  MAX_DERIVED_LIMBO_DAYS,
  MIN_DERIVED_LIMBO_DAYS,
  limboThresholdDays,
  seasonCadence,
} from '../src/domain/cadence';
import { RENEWAL_LIMBO_DAYS, deriveStatus } from '../src/domain/status';
import type { Season } from '../src/domain/types';

/**
 * Correctif du 2026-08-01, motive par la production.
 *
 * La rangee « En attente » affichait *Les Griffin* — qui revient chaque automne —
 * a cote de series reellement en sursis. Le seuil de « sans nouvelle » etait absolu
 * (18 mois) alors que le rythme d'une serie ne l'est pas.
 */

const NOW = new Date('2026-08-01T00:00:00Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

/** Saisons diffusees a intervalle regulier, la plus recente il y a `lastAgo` jours. */
function seasonsEvery(gapDays: number, count: number, lastAgo: number): Season[] {
  return Array.from({ length: count }, (_, i) => ({
    ref: { seriesId: 's', seasonNumber: i + 1 },
    kind: 'regular' as const,
    episodeCount: 10,
    airedFrom: daysAgo(lastAgo + (count - 1 - i) * gapDays),
  }));
}

describe('seasonCadence', () => {
  it('mesure un rythme annuel', () => {
    const cadence = seasonCadence(seasonsEvery(365, 5, 100));
    expect(cadence?.medianGapDays).toBeCloseTo(365, 0);
    expect(cadence?.samples).toBe(4);
  });

  /**
   * 🔴 **Trouve par mutation le 2026-08-07.** La garde `median <= 0` pouvait devenir
   * `median < 0` sans qu'aucun test ne bouge : **rien n'exercait le rythme nul**.
   *
   * Ce n'est pas theorique. Deux saisons diffusees **le meme jour** — une plateforme qui
   * publie deux saisons d'un coup, ce que Netflix fait — donnent un ecart median de zero.
   * Le rythme partirait alors dans `limboThresholdDays`, ou il **divise** : un seuil
   * infini, donc une serie qu'on ne declarerait jamais sans nouvelle.
   */
  it('refuse un rythme nul plutot que de le propager', () => {
    const memeJour: Season[] = [
      { ref: { seriesId: 's', seasonNumber: 1 }, kind: 'regular', episodeCount: 10, airedFrom: daysAgo(100) },
      { ref: { seriesId: 's', seasonNumber: 2 }, kind: 'regular', episodeCount: 10, airedFrom: daysAgo(100) },
    ];
    expect(seasonCadence(memeJour)).toBeUndefined();
  });

  it('resiste a une interruption exceptionnelle', () => {
    // Greve, pandemie, changement de diffuseur : une seule longue coupure ne doit pas
    // redefinir le rythme d'une serie par ailleurs reguliere. D'ou la mediane.
    const seasons: Season[] = [
      { ref: { seriesId: 's', seasonNumber: 1 }, kind: 'regular', episodeCount: 10, airedFrom: daysAgo(2000) },
      { ref: { seriesId: 's', seasonNumber: 2 }, kind: 'regular', episodeCount: 10, airedFrom: daysAgo(1635) },
      { ref: { seriesId: 's', seasonNumber: 3 }, kind: 'regular', episodeCount: 10, airedFrom: daysAgo(400) },
      { ref: { seriesId: 's', seasonNumber: 4 }, kind: 'regular', episodeCount: 10, airedFrom: daysAgo(35) },
    ];
    // Intervalles : 365, 1235, 365 -> mediane 365, et non la moyenne de 655.
    expect(seasonCadence(seasons)?.medianGapDays).toBeCloseTo(365, 0);
  });

  it('accepte un seul intervalle, en le marquant comme tel', () => {
    // Une mesure unique ne fait pas un rythme, mais l'ignorer est pire : on retombe
    // sur le seuil fixe, qui condamne les series lentes.
    const cadence = seasonCadence(seasonsEvery(730, 2, 100));
    expect(cadence?.samples).toBe(1);
    expect(cadence?.medianGapDays).toBeCloseTo(730, 0);
  });

  it('ne conclut rien sans au moins deux saisons datees', () => {
    expect(seasonCadence(seasonsEvery(365, 1, 100))).toBeUndefined();
    expect(seasonCadence([])).toBeUndefined();
  });

  it('ignore les saisons sans date', () => {
    const seasons: Season[] = [
      ...seasonsEvery(365, 3, 100),
      { ref: { seriesId: 's', seasonNumber: 9 }, kind: 'regular', episodeCount: 10 },
    ];
    expect(seasonCadence(seasons)?.samples).toBe(2);
  });
});

describe('limboThresholdDays', () => {
  it('retombe sur le seuil fixe quand le rythme est inconnu', () => {
    expect(limboThresholdDays(undefined, RENEWAL_LIMBO_DAYS)).toBe(RENEWAL_LIMBO_DAYS);
  });

  it('avec un seul intervalle, allonge le delai mais ne le raccourcit jamais', () => {
    // Le cas *Les Anneaux de Pouvoir* : deux saisons a deux ans d'ecart, vingt mois
    // de silence. Le seuil fixe la declarait « sans nouvelle » a tort.
    const slow = { medianGapDays: 730, samples: 1 };
    expect(limboThresholdDays(slow, RENEWAL_LIMBO_DAYS)).toBeCloseTo(1095, 0);

    // A l'inverse, deux saisons sorties a trois mois d'ecart ne doivent pas rendre
    // la serie suspecte avant meme la fin de l'annee.
    const fast = { medianGapDays: 90, samples: 1 };
    expect(limboThresholdDays(fast, RENEWAL_LIMBO_DAYS)).toBe(RENEWAL_LIMBO_DAYS);
  });

  it('borne le seuil derive', () => {
    // Une serie sortie deux fois en trois mois ne devient pas suspecte apres six mois…
    expect(limboThresholdDays({ medianGapDays: 45, samples: 3 }, RENEWAL_LIMBO_DAYS))
      .toBe(MIN_DERIVED_LIMBO_DAYS);
    // …et une serie tres espacee ne merite pas un sursis indefini.
    expect(limboThresholdDays({ medianGapDays: 2000, samples: 3 }, RENEWAL_LIMBO_DAYS))
      .toBe(MAX_DERIVED_LIMBO_DAYS);
  });
});

describe('deriveStatus avec rythme — le cas qui a motive le correctif', () => {
  it('ne declare pas en sursis une serie annuelle en pause normale', () => {
    // *Les Griffin* : chaque automne. Trois mois de silence est son etat normal.
    const cadence = seasonCadence(seasonsEvery(365, 6, 90))!;
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(90), cadence },
      NOW,
    );
    expect(status.status).toBe('between_seasons');
    expect(status.zombie).toBe(false);
  });

  it('declare en sursis la meme serie apres deux cycles manques', () => {
    const cadence = seasonCadence(seasonsEvery(365, 6, 800))!;
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(800), cadence },
      NOW,
    );
    expect(status.status).toBe('awaiting_renewal');
    expect(status.limboThresholdDays).toBe(730);
  });

  it('laisse respirer une serie a rythme lent la ou le seuil fixe la condamnait', () => {
    // Trois ans entre saisons : vingt mois de silence n'y signifie rien. Le seuil
    // fixe de dix-huit mois l'aurait declaree en sursis a tort.
    const cadence = seasonCadence(seasonsEvery(1095, 4, 600))!;
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(600), cadence },
      NOW,
    );
    expect(status.status).toBe('between_seasons');
    expect(status.limboThresholdDays).toBeGreaterThan(RENEWAL_LIMBO_DAYS);

    // Sans le rythme, le verdict s'inverse — c'est exactement le defaut corrige.
    const naive = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(600) }, NOW);
    expect(naive.status).toBe('awaiting_renewal');
  });

  it('expose le seuil applique, pour que le verdict soit explicable', () => {
    const status = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(10) }, NOW);
    expect(status.limboThresholdDays).toBe(RENEWAL_LIMBO_DAYS);
  });
});

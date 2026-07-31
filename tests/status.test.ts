import { describe, expect, it } from 'vitest';
import { RENEWAL_LIMBO_DAYS, deriveStatus } from '../src/domain/status';

const NOW = new Date('2026-07-31T00:00:00Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

function inDays(n: number): Date {
  return new Date(NOW.getTime() + n * 86_400_000);
}

describe('deriveStatus — les statuts declares priment', () => {
  it('rend « terminee » meme si le dernier episode est recent', () => {
    // Sans cette priorite, un final diffuse la semaine derniere afficherait
    // « en diffusion » — le bug que font tous les trackers.
    const result = deriveStatus(
      { production: 'ended', lastAiredAt: daysAgo(3) },
      NOW,
    );
    expect(result.status).toBe('ended');
    expect(result.zombie).toBe(false);
  });

  it('rend « annulee »', () => {
    const result = deriveStatus({ production: 'canceled', lastAiredAt: daysAgo(400) }, NOW);
    expect(result.status).toBe('cancelled');
  });
});

describe('deriveStatus — en diffusion', () => {
  it('reconnait un episode diffuse cette semaine', () => {
    const result = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(5) }, NOW);
    expect(result.status).toBe('airing');
  });

  it('reconnait une saison programmee meme apres une longue pause', () => {
    const result = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(300), nextAiringAt: inDays(20) },
      NOW,
    );
    expect(result.status).toBe('airing');
    expect(result.daysUntilNext).toBeCloseTo(20, 5);
  });

  it('ne compte pas une date de diffusion tres lointaine', () => {
    const result = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(200), nextAiringAt: inDays(300) },
      NOW,
    );
    expect(result.status).toBe('between_seasons');
  });
});

describe('deriveStatus — entre deux saisons et zombies', () => {
  it('distingue une pause normale', () => {
    const result = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(200) }, NOW);
    expect(result.status).toBe('between_seasons');
    expect(result.zombie).toBe(false);
  });

  it('demasque une serie declaree vivante mais sans signe de vie', () => {
    // Le cas que le produit doit rendre lisible : l'utilisateur ne sait pas s'il
    // attend ou s'il abandonne.
    const result = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(RENEWAL_LIMBO_DAYS + 30) },
      NOW,
    );
    expect(result.status).toBe('awaiting_renewal');
    expect(result.zombie).toBe(true);
  });

  it('place la bascule exactement au seuil', () => {
    const justBefore = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(RENEWAL_LIMBO_DAYS) },
      NOW,
    );
    const justAfter = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(RENEWAL_LIMBO_DAYS + 1) },
      NOW,
    );
    expect(justBefore.status).toBe('between_seasons');
    expect(justAfter.status).toBe('awaiting_renewal');
  });
});

describe('deriveStatus — rien de diffuse', () => {
  it('rend « a venir » pour une serie en production', () => {
    expect(deriveStatus({ production: 'in_production' }, NOW).status).toBe('upcoming');
    expect(deriveStatus({ production: 'planned' }, NOW).status).toBe('upcoming');
    expect(deriveStatus({ production: 'pilot' }, NOW).status).toBe('upcoming');
  });

  it('avoue son ignorance plutot que de deviner', () => {
    expect(deriveStatus({ production: 'unknown' }, NOW).status).toBe('unknown');
    expect(deriveStatus({ production: 'returning' }, NOW).status).toBe('unknown');
  });
});

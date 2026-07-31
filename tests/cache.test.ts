import { describe, expect, it, vi } from 'vitest';
import {
  CONTRACTUAL_MAX_TTL_MS,
  ExpiringCache,
  clampTtl,
  memoizeAsync,
} from '../src/catalog/cache';

/** Horloge manuelle : le temps ne doit jamais dependre de la vitesse des tests. */
function manualClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe('clampTtl — la garantie contractuelle', () => {
  it('plafonne toute duree au maximum autorise par TMDB', () => {
    // Six mois. Le plafond est applique par le code, pas par la discipline :
    // une regle qui depend de la vigilance humaine finit par etre violee.
    const tenYears = 10 * 365 * 86_400_000;
    expect(clampTtl(tenYears)).toBe(CONTRACTUAL_MAX_TTL_MS);
    expect(clampTtl(CONTRACTUAL_MAX_TTL_MS + 1)).toBe(CONTRACTUAL_MAX_TTL_MS);
  });

  it('laisse passer les durees normales', () => {
    const oneDay = 86_400_000;
    expect(clampTtl(oneDay)).toBe(oneDay);
  });

  it('traite les durees absurdes comme nulles', () => {
    expect(clampTtl(0)).toBe(0);
    expect(clampTtl(-1)).toBe(0);
    expect(clampTtl(Number.NaN)).toBe(0);
    expect(clampTtl(Number.POSITIVE_INFINITY)).toBe(CONTRACTUAL_MAX_TTL_MS);
  });
});

describe('ExpiringCache', () => {
  it('rend une valeur avant expiration et l oublie apres', () => {
    const clock = manualClock();
    const cache = new ExpiringCache<string>({ now: clock.now });

    cache.set('k', 'v', 1_000);
    expect(cache.get('k')).toBe('v');

    clock.advance(999);
    expect(cache.get('k')).toBe('v');

    clock.advance(2);
    expect(cache.get('k')).toBeUndefined();
  });

  it('n enregistre rien pour une duree nulle', () => {
    const cache = new ExpiringCache<string>();
    cache.set('k', 'v', 0);
    expect(cache.get('k')).toBeUndefined();
  });

  it('applique le plafond contractuel a l ecriture', () => {
    const clock = manualClock();
    const cache = new ExpiringCache<string>({ now: clock.now });

    cache.set('k', 'v', CONTRACTUAL_MAX_TTL_MS * 100);
    clock.advance(CONTRACTUAL_MAX_TTL_MS + 1);

    expect(cache.get('k')).toBeUndefined();
  });

  it('evince la plus ancienne entree a saturation', () => {
    const cache = new ExpiringCache<number>({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.stats().evictions).toBe(1);
  });

  it('rafraichit la position d une cle reecrite', () => {
    const cache = new ExpiringCache<number>({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);
    cache.set('c', 3);

    // 'b' est desormais la plus ancienne, pas 'a'.
    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBeUndefined();
  });

  it('purge les entrees expirees', () => {
    const clock = manualClock();
    const cache = new ExpiringCache<number>({ now: clock.now });
    cache.set('a', 1, 100);
    cache.set('b', 2, 10_000);

    clock.advance(200);
    expect(cache.prune()).toBe(1);
    expect(cache.stats().size).toBe(1);
  });

  it('compte succes et echecs', () => {
    const cache = new ExpiringCache<number>();
    cache.set('a', 1);
    cache.get('a');
    cache.get('b');

    expect(cache.stats()).toMatchObject({ hits: 1, misses: 1 });
  });
});

describe('memoizeAsync', () => {
  it('n appelle la source qu une fois par cle', async () => {
    const cache = new ExpiringCache<number>();
    const through = memoizeAsync(cache, 10_000);
    const produce = vi.fn(async () => 42);

    expect(await through('k', produce)).toBe(42);
    expect(await through('k', produce)).toBe(42);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('fusionne les appels concurrents sur la meme cle', async () => {
    // Sans cela, dix requetes simultanees sur une serie populaire declenchent dix
    // appels reseau identiques — exactement ce que le budget interdit.
    const cache = new ExpiringCache<number>();
    const through = memoizeAsync(cache);
    let resolve!: (v: number) => void;
    const produce = vi.fn(() => new Promise<number>((r) => { resolve = r; }));

    const all = Promise.all([through('k', produce), through('k', produce), through('k', produce)]);
    resolve(7);

    expect(await all).toEqual([7, 7, 7]);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('ne met pas un echec en cache', async () => {
    const cache = new ExpiringCache<number>();
    const through = memoizeAsync(cache);
    const failing = vi.fn(async () => {
      throw new Error('reseau');
    });

    await expect(through('k', failing)).rejects.toThrow('reseau');
    await expect(through('k', failing)).rejects.toThrow('reseau');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

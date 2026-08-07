/**
 * Cache a expiration pour les metadonnees de catalogue.
 *
 * Le point capital de ce module n'est pas la performance : c'est le **plafond
 * contractuel**. Les conditions d'utilisation de TMDB interdisent de conserver
 * leurs donnees plus de six mois (`RESEARCH.md` §4.2).
 *
 * Ce plafond est applique **par le code** et non par la discipline : toute duree de
 * vie demandee au-dela est silencieusement ramenee a la limite. Une regle qui
 * depend de la vigilance humaine finit toujours par etre violee, et celle-ci n'est
 * pas rattrapable apres coup.
 *
 * L'implementation est en memoire, deliberement : le stockage durable est un
 * arbitrage encore ouvert (`ROADMAP.md` §4), et l'interface suffit a le remplacer
 * sans toucher aux appelants.
 */

/** Six mois, en millisecondes. Plafond contractuel TMDB. Ne pas relever. */
export const CONTRACTUAL_MAX_TTL_MS = 180 * 86_400_000;

/** Duree de vie par defaut : sept jours. Compromis fraicheur / nombre d'appels. */
const DEFAULT_TTL_MS = 7 * 86_400_000;

export interface CacheEntry<T> {
  readonly value: T;
  /** Instant d'expiration, en millisecondes depuis l'epoque. */
  readonly expiresAt: number;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
}

/** Horloge injectable, pour rendre les tests deterministes. */
export type Clock = () => number;

/**
 * Ramene une duree de vie demandee dans les bornes autorisees.
 *
 * Exporte pour etre testable directement : c'est la garantie contractuelle du
 * module, elle merite son propre test.
 */
export function clampTtl(requestedMs: number): number {
  // `NaN` n'est pas une duree : on n'enregistre rien. `Infinity` en est une —
  // « pour toujours » — et tombe donc sous le plafond comme n'importe quelle
  // duree excessive, plutot que d'etre rejetee.
  if (Number.isNaN(requestedMs) || requestedMs <= 0) return 0;
  return Math.min(requestedMs, CONTRACTUAL_MAX_TTL_MS);
}

/**
 * Cache cle-valeur a expiration, avec eviction du plus ancien insere quand la
 * capacite est atteinte.
 */
export class ExpiringCache<T> {
  readonly #entries = new Map<string, CacheEntry<T>>();
  readonly #maxEntries: number;
  readonly #now: Clock;

  constructor(options: { readonly maxEntries?: number; readonly now?: Clock } = {}) {
    this.#maxEntries = options.maxEntries ?? 5_000;
    this.#now = options.now ?? Date.now;
  }

  get(key: string): T | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    // L'expiration est **paresseuse** : on la constate a la lecture. C'est ce qui rend
    // une purge periodique inutile — et ce qui a permis de retirer `prune()`, que rien
    // n'appelait, le 2026-08-07.
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * @param ttlMs duree de vie souhaitee. Toujours ramenee sous
   *   {@link CONTRACTUAL_MAX_TTL_MS} — une valeur superieure n'est pas une erreur,
   *   elle est simplement plafonnee.
   */
  set(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    const ttl = clampTtl(ttlMs);
    if (ttl === 0) return;

    // Re-inserer deplace la cle en fin de Map : l'eviction suit bien l'ordre
    // d'insertion la plus recente.
    this.#entries.delete(key);

    if (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
    this.#entries.set(key, { value, expiresAt: this.#now() + ttl });
  }

  clear(): void {
    this.#entries.clear();
  }

  /**
   * ⚠️ **Ici vivaient `delete()`, `prune()` et `stats()`, retires le 2026-08-07.**
   *
   * `delete()` n'avait aucun appelant. `prune()` et `stats()` n'en avaient que dans les
   * tests — et `stats()` etait la seule raison d'exister de trois compteurs incrementes a
   * quatre endroits, c'est-a-dire d'une instrumentation dont la production ne lisait
   * jamais le resultat.
   *
   * *Un compteur que personne ne lit n'est pas une mesure, c'est une ligne a maintenir.*
   * Et les tests qui l'exercaient ne prouvaient rien du produit : ils verifiaient qu'un
   * accesseur rend ce qu'on vient d'y mettre.
   */
}

/**
 * Enveloppe une fonction couteuse d'un cache.
 *
 * Les appels concurrents portant sur la meme cle partagent une seule promesse : sans
 * cela, dix requetes simultanees sur une serie populaire declenchent dix appels
 * reseau identiques — exactement le comportement que le budget interdit
 * (`RESEARCH.md` §5.3).
 */
export function memoizeAsync<T>(
  cache: ExpiringCache<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): (key: string, produce: () => Promise<T>) => Promise<T> {
  const inFlight = new Map<string, Promise<T>>();

  return async function through(key: string, produce: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const pending = inFlight.get(key);
    if (pending !== undefined) return pending;

    const promise = produce()
      .then((value) => {
        cache.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  };
}

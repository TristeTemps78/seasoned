/**
 * Le journal range dans le navigateur.
 *
 * Premiere — et pour l'instant seule — implementation du port {@link JournalStore}.
 * Coût zero, aucun compte a creer, aucune donnee personnelle hebergee, aucune
 * obligation RGPD, et surtout : **cela valide l'usage avant d'investir dans une base.**
 *
 * ## Ce qui est injecte, et pourquoi
 *
 * Le stockage lui-meme est un parametre. Ce n'est pas de la ceremonie : c'est ce qui
 * rend cette classe testable **sans jsdom ni bibliotheque de test de composants**, donc
 * ce qui permet de couvrir la partie la plus fragile du produit — l'etat personnel —
 * avec les memes tests purs que le reste. Le trou de couverture etait reel : les
 * 115 tests verts ne touchaient pas une ligne de cette couche.
 *
 * Le generateur d'identifiant l'est aussi, pour la meme raison et parce que le domaine
 * n'a pas d'horloge ni de source d'alea implicites.
 */

import {
  EMPTY_JOURNAL,
  parseJournal,
  serializeJournal,
  withDeviceId,
  type Journal,
} from '../domain/journal';
import type { JournalStore } from './store';

/** Le minimum d'un `Storage` : ce dont on se sert, et rien de plus. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = 'seasoned.journal.v1';

export interface LocalJournalStoreOptions {
  readonly storage: StorageLike;
  /** Identifiant d'appareil, cree a la premiere ecriture. */
  readonly makeDeviceId?: () => string;
  /**
   * S'abonne aux ecritures faites par **un autre onglet**.
   *
   * Optionnel : hors navigateur il n'y a pas d'autre onglet, et les abonnes locaux
   * sont de toute facon notifies en memoire.
   */
  readonly onExternalChange?: (listener: () => void) => () => void;
}

function randomId(): string {
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (globalCrypto?.randomUUID !== undefined) return globalCrypto.randomUUID();
  // Repli suffisant : cet identifiant n'a aucune valeur de securite, il sert a
  // distinguer deux appareils lors d'une fusion.
  return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export class LocalJournalStore implements JournalStore {
  readonly name = 'local';

  readonly #storage: StorageLike;
  readonly #makeDeviceId: () => string;
  readonly #listeners = new Set<(journal: Journal) => void>();
  readonly #onExternalChange: ((listener: () => void) => () => void) | undefined;

  constructor(options: LocalJournalStoreOptions) {
    this.#storage = options.storage;
    this.#makeDeviceId = options.makeDeviceId ?? randomId;
    this.#onExternalChange = options.onExternalChange;
  }

  async load(): Promise<Journal> {
    return this.#read();
  }

  async save(journal: Journal): Promise<void> {
    const stamped = withDeviceId(journal, this.#makeDeviceId());
    try {
      this.#storage.setItem(STORAGE_KEY, serializeJournal(stamped));
    } catch {
      // Stockage refuse : navigation privee, quota plein, parametres restrictifs.
      // On notifie quand meme : l'etat vit en memoire pour la session en cours,
      // ce qui vaut mieux qu'une interaction qui ne repond pas.
    }
    for (const listener of this.#listeners) listener(stamped);
  }

  subscribe(listener: (journal: Journal) => void): () => void {
    this.#listeners.add(listener);
    const stopExternal = this.#onExternalChange?.(() => listener(this.#read()));
    return () => {
      this.#listeners.delete(listener);
      stopExternal?.();
    };
  }

  #read(): Journal {
    try {
      return parseJournal(this.#storage.getItem(STORAGE_KEY));
    } catch {
      return EMPTY_JOURNAL;
    }
  }
}

/**
 * Le store du navigateur courant, ou `undefined` cote serveur.
 *
 * ⚠️ Rend `undefined` hors navigateur **a dessein**. Le journal ne doit jamais
 * traverser un composant serveur : le HTML des pages est mis en cache au bord et
 * **partage entre tous les visiteurs** — le jour ou le serveur lit un journal, il sert
 * celui de quelqu'un a quelqu'un d'autre. Ce `undefined` est la forme executable de
 * cette regle, pas une precaution de typage.
 */
export function browserJournalStore(): LocalJournalStore | undefined {
  if (typeof window === 'undefined') return undefined;
  return new LocalJournalStore({
    storage: window.localStorage,
    onExternalChange: (listener) => {
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
  });
}

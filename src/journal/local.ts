/**
 * Le journal range dans le navigateur.
 *
 * Premiere implementation du port {@link JournalStore}. Il y en a **trois** depuis le
 * lot 6.3 — celle-ci, {@link RemoteJournalStore} et {@link SyncingJournalStore} — et ce
 * commentaire disait « pour l'instant seule » jusqu'au 2026-08-07.
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
  tryParseJournal,
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

/**
 * Ou le journal est range, sous le nom du produit.
 *
 * ## La regle du renommage (2026-08-03, `seasoned` → `Voltface`)
 *
 * Renommer une cle de stockage **efface les donnees de tout le monde** : le navigateur ne
 * sait pas que l'ancienne et la nouvelle designent la meme chose. Ce n'est pas un detail
 * cosmetique, c'est la donnee du produit.
 *
 * Deux cas, et la regle qui les separe : **on migre ce qu'on controle, on ne touche pas a
 * ce qui est deja parti ailleurs.** Ici le journal est chez nous, dans un stockage qu'on
 * lit a chaque demarrage — donc migrable sans risque. L'UID des evenements de calendrier,
 * lui, est parti dans l'agenda de quelqu'un et **reste** (`src/domain/calendar.ts`).
 */
export const STORAGE_KEY = 'voltface.journal.v1';

/**
 * L'ancien nom, lu une derniere fois.
 *
 * Conserve **indefiniment** en lecture : un journal peut dormir des mois dans un navigateur
 * ferme, et il n'existe aucune tache de fond pour faire le menage. Le supprimer un jour
 * effacerait le journal de qui n'est pas revenu d'ici la — exactement ce que le produit
 * promet de ne jamais faire.
 */
const LEGACY_STORAGE_KEYS = ['seasoned.journal.v1'] as const;

/**
 * Suffixe de la copie de sauvegarde d'un journal illisible.
 *
 * Voir `LocalJournalStore.#parse`. Exporte pour que les tests nomment la meme cle que le
 * code — un test qui reecrit la chaine a la main verifierait sa propre constante.
 */
export const RESCUE_SUFFIX = '.rescue';

/**
 * Le journal d'un compte, range a part de celui de l'appareil.
 *
 * ## 🔴 Pourquoi une cle par compte, et pas une seule
 *
 * `decideAdoption` permet de **refuser** que le journal trouve sur cet appareil rejoigne le
 * compte qui se connecte — le cas de l'ordinateur familial. Ce refus n'a de valeur que s'il
 * y a **deux endroits** : une seule cle, et le compte se met a lire, ecrire et **pousser
 * vers le serveur** le journal de quelqu'un d'autre, exactement ce que le refus venait
 * d'interdire. La porte de derriere serait plus large que la porte.
 */
export function accountStorageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

export interface LocalJournalStoreOptions {
  readonly storage: StorageLike;
  /**
   * Ou ranger ce journal. Defaut : {@link STORAGE_KEY}, celui de l'appareil.
   *
   * ⚠️ Le repli sur les anciens noms ne vaut **que** pour la cle par defaut : un journal de
   * compte n'a pas d'ancetre, et y replier l'anonyme reviendrait a l'adopter en silence.
   */
  readonly key?: string;
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
  readonly #key: string;
  readonly #legacyKeys: readonly string[];
  readonly #makeDeviceId: () => string;
  readonly #listeners = new Set<(journal: Journal) => void>();
  readonly #onExternalChange: ((listener: () => void) => () => void) | undefined;

  constructor(options: LocalJournalStoreOptions) {
    this.#storage = options.storage;
    this.#key = options.key ?? STORAGE_KEY;
    this.#legacyKeys = this.#key === STORAGE_KEY ? LEGACY_STORAGE_KEYS : [];
    this.#makeDeviceId = options.makeDeviceId ?? randomId;
    this.#onExternalChange = options.onExternalChange;
  }

  async load(): Promise<Journal> {
    return this.#read();
  }

  async save(journal: Journal): Promise<void> {
    const stamped = withDeviceId(journal, this.#makeDeviceId());
    try {
      this.#storage.setItem(this.#key, serializeJournal(stamped));
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

  /**
   * Lit le journal, en repliant sur les noms de cle abandonnes.
   *
   * L'ancienne cle n'est jamais **effacee** : la premiere ecriture depose le journal sous
   * le nom courant, et l'ancienne copie reste ou elle est. C'est volontaire — supprimer
   * l'original pour economiser quelques kilo-octets ferait de chaque bogue de migration
   * une perte definitive, alors qu'une copie oubliee ne coute rien a personne.
   */
  #read(): Journal {
    try {
      const current = this.#storage.getItem(this.#key);
      if (current !== null) return this.#parse(current, this.#key);

      for (const legacy of this.#legacyKeys) {
        const raw = this.#storage.getItem(legacy);
        if (raw !== null) return this.#parse(raw, legacy);
      }
      return EMPTY_JOURNAL;
    } catch {
      return EMPTY_JOURNAL;
    }
  }

  /**
   * Lit une valeur stockee, et **met de cote ce qu'on n'a pas su lire**.
   *
   * Ici, contrairement au distant, repartir a vide est le seul comportement possible :
   * c'est notre propre stockage, il n'y a pas d'autre source. Mais la premiere ecriture
   * ecrasera l'illisible, et avec lui toute chance de recuperer a la main un journal de
   * plusieurs annees. D'ou la copie, posee **avant** cette ecriture et jamais remplacee —
   * le premier sauvetage est celui qui a precede le degat. Meme doctrine que
   * {@link LEGACY_STORAGE_KEYS}.
   */
  #parse(raw: string, from: string): Journal {
    const read = tryParseJournal(raw);
    if (read.kind === 'ok') return read.journal;

    try {
      const rescue = `${from}${RESCUE_SUFFIX}`;
      if (this.#storage.getItem(rescue) === null) this.#storage.setItem(rescue, raw);
    } catch {
      // Quota plein, mode prive : ne pas empecher le produit de demarrer pour autant.
    }
    return EMPTY_JOURNAL;
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
export function browserJournalStore(key?: string): LocalJournalStore | undefined {
  if (typeof window === 'undefined') return undefined;
  return new LocalJournalStore({
    storage: window.localStorage,
    ...(key === undefined ? {} : { key }),
    onExternalChange: (listener) => {
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
  });
}

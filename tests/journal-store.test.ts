import { describe, expect, it } from 'vitest';
import { LocalJournalStore, STORAGE_KEY, type StorageLike } from '../src/journal/local';
import {
  EMPTY_JOURNAL,
  journalKey,
  parseJournal,
  serializeJournal,
  setPosition,
} from '../src/domain/journal';

const NOW = new Date('2026-08-02T12:00:00Z');
const BB = journalKey('1396');

/**
 * Un stockage en memoire.
 *
 * C'est tout l'interet d'avoir injecte le stockage : la couche la plus fragile du
 * produit — l'etat personnel — se teste ici sans jsdom ni bibliotheque de test de
 * composants. Les 115 tests precedents ne touchaient pas une ligne de ce code.
 */
class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/** Un stockage qui refuse d'ecrire : navigation privee, quota plein. */
class HostileStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('acces refuse');
  }
  setItem(): void {
    throw new Error('quota depasse');
  }
}

function makeStore(storage: StorageLike = new FakeStorage()) {
  let n = 0;
  return new LocalJournalStore({ storage, makeDeviceId: () => `appareil-${++n}` });
}

describe('LocalJournalStore', () => {
  it('relit ce qu il a ecrit', async () => {
    const store = makeStore();
    await store.save(setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW));

    const back = await store.load();
    expect(back.entries[BB]?.position).toMatchObject({ seasonNumber: 3, episodeNumber: 7 });
  });

  it('rend un journal vide quand il n y a rien', async () => {
    expect((await makeStore().load()).entries).toEqual({});
  });

  it('attribue un identifiant d appareil, une seule fois', async () => {
    // Il ne sert a rien tant qu'il n'y a qu'un appareil — c'est justement pour cela
    // qu'il faut l'ecrire maintenant : il n'est pas reconstituable apres coup.
    const store = makeStore();
    await store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));
    const first = (await store.load()).deviceId;
    expect(first).toBe('appareil-1');

    await store.save(setPosition(await store.load(), BB, 2, 1, NOW));
    expect((await store.load()).deviceId).toBe('appareil-1');
  });

  it('reste utilisable quand le stockage refuse tout', async () => {
    // Navigation privee ou quota plein : le site fonctionne, simplement sans memoire.
    const store = makeStore(new HostileStorage());
    await expect(store.load()).resolves.toEqual(EMPTY_JOURNAL);
    await expect(store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW))).resolves.toBeUndefined();
  });

  it('survit a un contenu illisible', async () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, '{ ceci n est pas du json');
    expect((await makeStore(storage).load()).entries).toEqual({});
  });

  it('lit un journal v1 laisse par la version precedente', async () => {
    const storage = new FakeStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: {
          '1396': { position: { seasonNumber: 2, episodeNumber: 3, declaredAt: NOW.toISOString() } },
        },
      }),
    );

    const journal = await makeStore(storage).load();
    expect(journal.entries[BB]?.position?.seasonNumber).toBe(2);
  });

  it('previent ses abonnes a chaque ecriture', async () => {
    const store = makeStore();
    const seen: number[] = [];
    const stop = store.subscribe((j) => seen.push(Object.keys(j.entries).length));

    await store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));
    stop();
    await store.save(setPosition(EMPTY_JOURNAL, journalKey('1405'), 1, 1, NOW));

    expect(seen).toEqual([1]);
  });

  it('relaie un changement venu d un autre onglet', async () => {
    const storage = new FakeStorage();
    let external: (() => void) | undefined;
    const store = new LocalJournalStore({
      storage,
      makeDeviceId: () => 'appareil-1',
      onExternalChange: (listener) => {
        external = listener;
        return () => {
          external = undefined;
        };
      },
    });

    let received = EMPTY_JOURNAL;
    const stop = store.subscribe((j) => {
      received = j;
    });

    storage.setItem(STORAGE_KEY, serializeJournal(setPosition(EMPTY_JOURNAL, BB, 4, 1, NOW)));
    external?.();
    expect(received.entries[BB]?.position?.seasonNumber).toBe(4);

    stop();
    expect(external).toBeUndefined();
  });

  it('ecrit exactement le format d export', async () => {
    // Le format serialise est aussi celui du fichier exporte : s'ils divergeaient,
    // un import ne relirait pas ce qu'un export a produit.
    const storage = new FakeStorage();
    const store = makeStore(storage);
    const journal = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    await store.save(journal);

    const raw = storage.getItem(STORAGE_KEY) ?? '';
    expect(parseJournal(raw, NOW).entries).toEqual(journal.entries);
  });
});

describe('le renommage du produit ne coute pas le journal de l utilisateur', () => {
  // Renommer une cle de stockage efface les donnees de tout le monde : le navigateur ne
  // sait pas que l'ancienne et la nouvelle designent la meme chose. C'est la seule partie
  // du renommage `seasoned` -> `Voltface` qui pouvait detruire quelque chose.
  const LEGACY = 'seasoned.journal.v1';

  it('relit un journal range sous l ancien nom', async () => {
    const storage = new FakeStorage();
    storage.setItem(LEGACY, serializeJournal(setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW)));

    const store = new LocalJournalStore({ storage });
    expect((await store.load()).entries[BB]?.position?.seasonNumber).toBe(3);
  });

  it('ecrit desormais sous le nouveau nom, sans effacer l ancien', async () => {
    // L'original reste ou il est : supprimer pour economiser quelques kilo-octets ferait
    // de tout defaut de migration une perte definitive.
    const storage = new FakeStorage();
    storage.setItem(LEGACY, serializeJournal(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW)));

    const store = new LocalJournalStore({ storage });
    await store.save(setPosition(await store.load(), BB, 4, 2, NOW));

    expect(parseJournal(storage.getItem(STORAGE_KEY)).entries[BB]?.position?.seasonNumber).toBe(4);
    expect(storage.getItem(LEGACY)).not.toBeNull();
  });

  it('le nom courant l emporte sur l ancien', async () => {
    // Quelqu'un qui a utilise les deux versions ne doit pas revenir en arriere.
    const storage = new FakeStorage();
    storage.setItem(LEGACY, serializeJournal(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW)));
    storage.setItem(STORAGE_KEY, serializeJournal(setPosition(EMPTY_JOURNAL, BB, 6, 9, NOW)));

    const store = new LocalJournalStore({ storage });
    expect((await store.load()).entries[BB]?.position?.seasonNumber).toBe(6);
  });

  it('la cle courante porte le nom du produit, et pas l ancien', () => {
    expect(STORAGE_KEY).toContain('voltface');
    expect(STORAGE_KEY).not.toContain('seasoned');
  });
});

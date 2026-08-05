import { expect, it, vi } from 'vitest';
import { LocalJournalStore, type StorageLike } from '../src/journal/local';
import { RemoteJournalStore } from '../src/journal/remote';
import { SyncingJournalStore, type RemoteJournal } from '../src/journal/syncing';
import type { RemoteRead } from '../src/journal/sync';
import {
  EMPTY_JOURNAL,
  journalKey,
  setPosition,
  setSeasonRating,
  withDeviceId,
  type Journal,
} from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00Z');
const LATER = new Date('2026-08-03T13:00:00Z');
const BB = journalKey('1396');
const DEXTER = journalKey('1405');

class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/**
 * Le cote distant, reduit a ce que la synchronisation lui demande.
 *
 * Il compte ses appels : c'est la seule facon de prouver un debat d'ecriture — regarder le
 * contenu final ne distingue pas une requete de dix.
 */
class FakeRemote implements RemoteJournal {
  reads = 0;
  writes: Journal[] = [];
  constructor(private outcome: RemoteRead) {}

  async read(): Promise<RemoteRead> {
    this.reads += 1;
    return this.outcome;
  }

  async save(journal: Journal): Promise<void> {
    this.writes.push(journal);
    this.outcome = { kind: 'found', journal };
  }
}

/** Une minuterie que le test declenche a la main : attendre deux secondes n'est pas un test. */
function manualClock() {
  const pending: (() => void)[] = [];
  return {
    schedule: (run: () => void) => {
      pending.push(run);
      return () => {
        const index = pending.indexOf(run);
        if (index >= 0) pending.splice(index, 1);
      };
    },
    get waiting() {
      return pending.length;
    },
    async fire() {
      const due = [...pending];
      pending.length = 0;
      for (const run of due) run();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

function storeWith(remote: RemoteJournal) {
  const clock = manualClock();
  const storage = new FakeStorage();
  const local = new LocalJournalStore({ storage, makeDeviceId: () => 'ici' });
  const store = new SyncingJournalStore({ local, remote, schedule: clock.schedule });
  return { store, local, clock };
}

it('Q12 — load() ne fait AUCUN appel reseau', async () => {
  // Le bug : rendre le demarrage dependant du serveur. La panne d'un tiers deviendrait
  // visible sur chaque page, alors que le navigateur a deja le journal.
  const remote = new FakeRemote({ kind: 'absent' });
  const { store, local } = storeWith(remote);
  await local.save(setPosition(EMPTY_JOURNAL, BB, 2, 4, NOW));

  const loaded = await store.load();

  expect(remote.reads).toBe(0);
  expect(loaded.entries[BB]?.position).toMatchObject({ seasonNumber: 2, episodeNumber: 4 });
});

it('dix gestes rapproches font UNE synchronisation, pas dix', async () => {
  // Le bug : une requete par etoile cliquee. Noter une saison en fait une dizaine en
  // quelques secondes.
  const remote = new FakeRemote({ kind: 'absent' });
  const { store, clock } = storeWith(remote);

  let journal = EMPTY_JOURNAL;
  for (let episode = 1; episode <= 10; episode += 1) {
    journal = setPosition(journal, BB, 1, episode, NOW);
    await store.save(journal);
  }

  expect(clock.waiting).toBe(1);
  await clock.fire();

  expect(remote.writes).toHaveLength(1);
  expect(remote.writes[0]?.entries[BB]?.position).toMatchObject({ seasonNumber: 1, episodeNumber: 10 });
});

it('flush() pousse ce qui attendait — sinon les deux dernieres secondes sont perdues', async () => {
  const remote = new FakeRemote({ kind: 'absent' });
  const { store } = storeWith(remote);

  await store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));
  await store.flush();

  expect(remote.writes).toHaveLength(1);
});

it('🔴 n ecrit NULLE PART quand la lecture distante a echoue', async () => {
  // Le cas mixte, et il est banal : un GET rate suivi d'un POST qui passe ecraserait un
  // journal distant qu'on n'a pas pu fusionner. Seule perte de donnees possible ici.
  const remote = new FakeRemote({ kind: 'unavailable' });
  const { store, local } = storeWith(remote);
  await local.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));

  await store.sync();

  expect(remote.writes).toHaveLength(0);
});

it('fusionne les deux cotes au lieu de remplacer', async () => {
  // Le bug : POST remplace la ligne entiere, donc pousser sans avoir lu efface ce qu'un
  // autre appareil avait ecrit entre-temps.
  const distant = withDeviceId(setSeasonRating(EMPTY_JOURNAL, DEXTER, 1, 4, NOW), 'ailleurs');
  const remote = new FakeRemote({ kind: 'found', journal: distant });
  const { store, local } = storeWith(remote);
  await local.save(setPosition(EMPTY_JOURNAL, BB, 3, 7, LATER));

  const merged = await store.sync();

  expect(Object.keys(merged.entries).sort()).toEqual([BB, DEXTER].sort());
  expect(Object.keys((await store.load()).entries).sort()).toEqual([BB, DEXTER].sort());
});

it('stop() annule la poussee qui attendait', async () => {
  // Le bug : le dernier geste part vers le compte qu'on vient de quitter — sur un appareil
  // partage, c'est le geste du suivant qui atterrit chez le precedent.
  const remote = new FakeRemote({ kind: 'absent' });
  const { store, clock } = storeWith(remote);

  await store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));
  store.stop();
  await clock.fire();

  expect(remote.writes).toHaveLength(0);
});

/**
 * 🔴 La chaine de destruction, rejouee de bout en bout.
 *
 * Les tests ci-dessus injectent un `RemoteRead` deja decide, donc ils ne peuvent pas voir
 * le defaut : il naissait **dans la traduction** d'une reponse HTTP en `RemoteRead`. Celui-ci
 * part donc d'un vrai `RemoteJournalStore` branche sur un `fetch` factice, et traverse
 * reponse HTTP → read() → syncJournals() → save().
 *
 * Le scenario est celui qui detruisait les deux cotes en un clic : le compte a un journal
 * la-haut, ce journal est illisible pour ce client, et l'utilisateur pose un geste.
 */
it('🔴 un document distant illisible n entraine AUCUNE ecriture', async () => {
  const responses: unknown[] = [];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      responses.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => [] } as unknown as Response;
    }
    // Ce que le compte a la-haut : un document qu'on ne sait pas lire.
    return {
      ok: true,
      json: async () => [{ document: { pasUnJournal: true } }],
    } as unknown as Response;
  });

  const remote = new RemoteJournalStore({
    url: 'https://projet.supabase.co',
    anonKey: 'cle-publique',
    accessToken: () => 'jeton',
    userId: '11111111-1111-1111-1111-111111111111',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  const clock = manualClock();
  const storage = new FakeStorage();
  const local = new LocalJournalStore({ storage, makeDeviceId: () => 'ici' });
  const store = new SyncingJournalStore({ local, remote, schedule: clock.schedule });

  await store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));
  await clock.fire();
  await store.flush();

  // Le POST qui remplacait la ligne entiere n'est jamais parti.
  expect(responses).toEqual([]);
  // Et le local n'a rien perdu : il reste la source de verite.
  const kept = await local.load();
  expect(kept.entries[BB]?.position).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });
});

/**
 * L'ancrage du test precedent — sans lui, il verifierait un silence.
 *
 * Un `expect(responses).toEqual([])` passe aussi bien si la synchronisation n'ecrit
 * **jamais**, si le montage est casse, ou si `flush()` ne fait rien. Ce depot a deja
 * ecrit un test creux exactement ainsi (le bandeau `DataSafety`) : on prouve d'abord que
 * le meme montage ECRIT quand le distant est lisible.
 */
it('ancrage : le meme montage ecrit bien quand le document distant est lisible', async () => {
  const posts: unknown[] = [];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => [] } as unknown as Response;
    }
    return { ok: true, json: async () => [] } as unknown as Response;
  });

  const remote = new RemoteJournalStore({
    url: 'https://projet.supabase.co',
    anonKey: 'cle-publique',
    accessToken: () => 'jeton',
    userId: '11111111-1111-1111-1111-111111111111',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  const clock = manualClock();
  const storage = new FakeStorage();
  const local = new LocalJournalStore({ storage, makeDeviceId: () => 'ici' });
  const store = new SyncingJournalStore({ local, remote, schedule: clock.schedule });

  await store.save(setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW));
  await clock.fire();
  await store.flush();

  expect(posts).toHaveLength(1);
});

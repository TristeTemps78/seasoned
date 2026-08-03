import { expect, it } from 'vitest';
import { adopt, adoptionFor, decline } from '../src/journal/account';
import { LocalJournalStore, accountStorageKey, type StorageLike } from '../src/journal/local';
import { OWNER_KEY } from '../src/journal/sync';
import { EMPTY_JOURNAL, journalKey, setPosition } from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00Z');
const BB = journalKey('1396');
const ME = 'user-a';

class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

async function deviceWithAJournal() {
  const storage = new FakeStorage();
  const device = new LocalJournalStore({ storage, makeDeviceId: () => 'ici' });
  await device.save(setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW));
  return storage;
}

it('un refus tient — la question n est pas reposee a la page suivante', async () => {
  // Le bug : `decideAdoption` repose la question a chaque ouverture. Une question qui
  // revient s'apprend a fermer, et la reponse qui fait disparaitre une invitation est
  // « oui » — le garde-fou de l'appareil partage serait defait par l'usure.
  const storage = await deviceWithAJournal();
  expect((await adoptionFor(storage, ME)).kind).toBe('ask');

  decline(storage, ME);

  expect((await adoptionFor(storage, ME)).kind).toBe('nothing_to_adopt');
});

it('un refus laisse le journal de l appareil intact et hors du compte', async () => {
  // C'est ce qui rend le refus reparable la ou une fusion par erreur ne l'est pas.
  const storage = await deviceWithAJournal();
  decline(storage, ME);

  const account = new LocalJournalStore({ storage, key: accountStorageKey(ME) });
  const device = new LocalJournalStore({ storage });

  expect(Object.keys((await account.load()).entries)).toEqual([]);
  expect(Object.keys((await device.load()).entries)).toEqual([BB]);
});

it('adopter fusionne, et note que ce journal appartient desormais a ce compte', async () => {
  const storage = await deviceWithAJournal();
  await adopt(storage, ME);

  const account = new LocalJournalStore({ storage, key: accountStorageKey(ME) });
  expect((await account.load()).entries[BB]?.position).toMatchObject({ seasonNumber: 3, episodeNumber: 7 });
  expect(storage.getItem(OWNER_KEY)).toBe(ME);
  // Et la fois suivante, plus rien a demander.
  expect((await adoptionFor(storage, ME)).kind).toBe('adopt');
});

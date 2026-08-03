import { describe, expect, it, vi } from 'vitest';
import { RemoteJournalStore } from '../src/journal/remote';
import { EMPTY_JOURNAL, journalKey, setPosition } from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00Z');
const BB = journalKey('1396');
const USER = '11111111-1111-1111-1111-111111111111';

function store(fetchImpl: typeof fetch, token: string | undefined = 'jeton') {
  return new RemoteJournalStore({
    url: 'https://projet.supabase.co',
    anonKey: 'cle-publique',
    accessToken: () => token,
    userId: USER,
    fetchImpl,
  });
}

/** Une reponse HTTP minimale. */
function reply(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe('lecture', () => {
  it('rend le journal du compte', async () => {
    const journal = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply([{ document: JSON.parse(JSON.stringify(journal)) }]));

    const remote = await store(fetchImpl as unknown as typeof fetch).fetchDocument();
    expect(remote?.entries[BB]?.position?.seasonNumber).toBe(3);
  });

  it('filtre sur le compte, et ne demande que le document', async () => {
    // Sans le filtre, on compterait sur RLS seule pour restreindre — ce qui marche, mais
    // ferait transiter toute la table si une policy etait un jour relachee.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply([]));
    await store(fetchImpl as unknown as typeof fetch).fetchDocument();

    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toContain(`user_id=eq.${USER}`);
    expect(url).toContain('select=document');
  });

  it('envoie le jeton du compte, relu a chaque appel', async () => {
    // ⚠️ Un jeton se rafraichit. Le capturer une fois ferait echouer toutes les requetes
    // suivant le premier rafraichissement, avec une erreur d'autorisation trompeuse.
    let token = 'premier';
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply([]));
    const remote = new RemoteJournalStore({
      url: 'https://projet.supabase.co',
      anonKey: 'cle-publique',
      accessToken: () => token,
      userId: USER,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await remote.fetchDocument();
    token = 'renouvele';
    await remote.fetchDocument();

    const headersOf = (i: number) =>
      (fetchImpl.mock.calls[i]?.[1] as RequestInit | undefined)?.headers as Record<
        string,
        string
      >;
    expect(headersOf(0)['Authorization']).toBe('Bearer premier');
    expect(headersOf(1)['Authorization']).toBe('Bearer renouvele');
  });

  it('distingue « rien la-haut » de « appel echoue »', async () => {
    // La distinction commande la suite : `syncJournals(local, undefined)` pousse le
    // local. Les deux cas rendent `undefined` ici, et c'est **sur** — une ecriture qui
    // echoue ne detruit rien.
    const empty = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply([]));
    const failed = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply(null, false));

    expect(await store(empty as unknown as typeof fetch).fetchDocument()).toBeUndefined();
    expect(await store(failed as unknown as typeof fetch).fetchDocument()).toBeUndefined();
  });

  it('⚠️ ne leve jamais, meme hors ligne', async () => {
    // Le contrat du port. C'est ce qui rend vraie la promesse « si la base tombe, le
    // produit continue » : le journal local reste la source de verite.
    const offline = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError('Failed to fetch');
    });
    const remote = store(offline as unknown as typeof fetch);

    await expect(remote.fetchDocument()).resolves.toBeUndefined();
    await expect(remote.load()).resolves.toEqual(EMPTY_JOURNAL);
  });

  it('lit un document abime sans casser', async () => {
    // Le parsing tolerant vaut **aussi** pour ce qui vient de notre serveur : un document
    // ecrit par une version plus recente, depuis un autre appareil, ne doit pas casser
    // celui-ci.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply([{ document: { version: 3, entries: 'casse' } }]));
    const out = await store(fetchImpl as unknown as typeof fetch).fetchDocument();
    expect(out?.entries).toEqual({});
  });
});

describe('ecriture', () => {
  it('fait un upsert, et n envoie jamais updated_at', async () => {
    // ⚠️ La date appartient au serveur : un client peut mentir sur l'heure, et une
    // horloge deregle de trois jours ferait passer une ecriture ancienne pour la
    // plus recente.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply(null));
    await store(fetchImpl as unknown as typeof fetch).save(
      setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW),
    );

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Prefer']).toContain(
      'resolution=merge-duplicates',
    );

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body['user_id']).toBe(USER);
    expect(body['updated_at']).toBeUndefined();
    expect(body['document']).toBeDefined();
  });

  it('⚠️ ne leve jamais non plus', async () => {
    const offline = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      store(offline as unknown as typeof fetch).save(EMPTY_JOURNAL),
    ).resolves.toBeUndefined();
  });
});

describe('temps reel', () => {
  it('ne s abonne a rien', async () => {
    // Une connexion permanente par visiteur est exactement le cout marginal qui a tue
    // TV Time. Les changements d'un autre appareil arrivent a la synchronisation
    // suivante — c'est-a-dire a l'ouverture d'une page.
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply([]));
    const remote = store(fetchImpl as unknown as typeof fetch);
    const unsubscribe = remote.subscribe(() => {
      throw new Error('ne doit jamais etre appele');
    });
    expect(() => unsubscribe()).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

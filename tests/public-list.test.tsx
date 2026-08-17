import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICTIONARIES } from '../lib/i18n';
import { SocialClient } from '../src/social/client';

/**
 * Une liste, seule, a son adresse — F9.
 *
 * `DiscoverLists.tsx` documentait la decision inverse : une liste n'existe que groupee, sous
 * un onglet de profil. Le raisonnement tenait pour la LECTURE et interdisait le partage —
 * on envoyait un profil en disant « c'est la troisieme ».
 *
 * ⚠️ Ce fichier garde deux choses de nature differente : **la forme de l'appel** (un seul
 * aller-retour, le nom en filtre) et **le silence** (« inconnue » et « invisible » se disent
 * pareil, sans quoi l'adresse devient un oracle a listes).
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

function spying(body: unknown) {
  const seen: string[] = [];
  const fetchImpl = (async (input: string) => {
    seen.push(String(input));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { seen, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

const LIGNE = {
  slug: 'a-voir-cet-hiver',
  title: 'À voir cet hiver',
  note: null,
  updated_at: '2026-08-16T10:00:00Z',
  list_items: [{ count: 3 }],
  preview: [],
  profiles: { handle: 'marie', user_id: 'elle', face: null },
};

describe('listBy — un seul aller-retour, et le nom sert de filtre', () => {
  it('demande la liste par son slug ET par le nom de son auteur', async () => {
    const { seen, client } = spying([LIGNE]);

    const found = await client.listBy('Marie', 'a-voir-cet-hiver');

    // ⚠️ UN appel. La reponse evidente — `findByHandle` puis `listsBy` puis chercher le bon
    // slug — en ferait deux et ramenerait toutes les listes pour n'en afficher qu'une.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('slug=eq.a-voir-cet-hiver');
    // Le nom est mis en minuscules : les handles le sont en base, et `/u/Marie` doit ouvrir
    // la meme liste que `/u/marie`.
    expect(seen[0]).toContain('profiles.handle=eq.marie');
    expect(seen[0]).toContain('profiles!inner');
    expect(found?.title).toBe('À voir cet hiver');
    expect(found?.authorId).toBe('elle');
  });

  it('rend `undefined` quand la base ne renvoie rien', async () => {
    // ⚠️ Le meme `undefined` pour « ce slug n'existe pas » et pour « RLS ne vous la montre
    // pas » : la base ne distingue pas les deux, et c'est precisement ce qu'on veut.
    const { client } = spying([]);
    await expect(client.listBy('marie', 'inconnue')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// L'ecran
// ---------------------------------------------------------------------------

const base = vi.hoisted(() => ({
  liste: undefined as unknown,
  items: [] as unknown[],
}));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({ configured: true, ready: true, account: undefined, providers: new Set() }),
}));

vi.mock('@/app/social/socialFrom', () => ({
  socialFrom: () => ({
    listBy: async () => base.liste,
    listItems: async () => base.items,
  }),
}));

const { LocaleProvider } = await import('@/app/i18n/LocaleProvider');
const { PublicList } = await import('@/app/components/PublicList');

function mount(handle = 'marie', slug = 'a-voir-cet-hiver') {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <PublicList handle={handle} slug={slug} />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  base.liste = undefined;
  base.items = [];
  window.localStorage.clear();
});

describe('PublicList — le silence qui refuse d’etre un oracle', () => {
  it('🔴 dit la meme chose pour une liste inconnue et pour une liste cachee', async () => {
    // Les deux cas arrivent ici sous la MEME forme — `listBy` rend `undefined` — et c'est
    // toute la garantie : rien dans l'ecran ne permet de tester des identifiants un par un
    // pour apprendre lesquels existent chez quelqu'un dont on ne voit rien.
    mount();
    expect(await screen.findByText(/ne s’ouvre pas/)).toBeDefined();
    expect(screen.getByText(/Soit elle n’existe pas/)).toBeDefined();
    // Regle 4 : un ecran qui n'a rien a montrer dit quoi faire. Vers `/listes` et jamais vers
    // le profil — proposer « voir son profil » affirmerait que ce nom existe.
    const sortie = screen.getByRole('link', { name: /listes publiques/i });
    expect(sortie.getAttribute('href')).toBe('/fr/listes');
  });
});

describe('PublicList — ce qu’une liste montre', () => {
  it('rend le titre, l’auteur cliquable et les series de la liste', async () => {
    base.liste = {
      slug: 'a-voir-cet-hiver',
      title: 'À voir cet hiver',
      note: 'Trois séries pour janvier.',
      count: 2,
      updatedAt: '2026-08-16T10:00:00Z',
      preview: [],
      handle: 'marie',
      authorId: 'elle',
    };
    // ⚠️ Avec leur instantane (020) : le journal du lecteur est vide ici, et c'est le cas
    // normal — une liste qu'on decouvre est faite de ce qu'on ne connait pas.
    base.items = [
      { subject: 'tmdb:1396', title: 'Breaking Bad', posterPath: '/a.jpg' },
      { subject: 'tmdb:1399', title: 'Game of Thrones' },
    ];

    mount();

    await waitFor(() => expect(screen.getByText('À voir cet hiver')).toBeDefined());
    expect(screen.getByText('Trois séries pour janvier.')).toBeDefined();
    expect(screen.getByRole('link', { name: '@marie' }).getAttribute('href')).toBe('/fr/u/marie');
    expect(screen.getByText('Breaking Bad')).toBeDefined();
    // 🔴 Jamais la cle brute : `tmdb:94997` a ete constate en production le 2026-08-16.
    expect(screen.queryByText(/tmdb:/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Breaking Bad' }).getAttribute('href')).toBe(
      '/fr/serie/1396',
    );
  });

  it('une liste vide le dit, sans bouton', async () => {
    base.liste = {
      slug: 'vide',
      title: 'Rien dedans',
      count: 0,
      updatedAt: '2026-08-16T10:00:00Z',
      preview: [],
      handle: 'marie',
      authorId: 'elle',
    };

    mount('marie', 'vide');

    await waitFor(() => expect(screen.getByText(/Cette liste est vide/)).toBeDefined());
    // Sans action : le lecteur ne peut rien pour la liste de quelqu'un d'autre, et le lien
    // vers son profil est deja dans l'en-tete juste au-dessus.
    expect(screen.queryByRole('link', { name: /listes publiques/i })).toBeNull();
  });
});

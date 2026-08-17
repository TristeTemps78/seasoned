import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICTIONARIES } from '../lib/i18n';
import { SocialClient } from '../src/social/client';

/**
 * Le journal public — F10.
 *
 * ## ⚠️ Ce que ce fichier garde en priorite : que RIEN de neuf ne soit publie
 *
 * `activity` est la projection **deja envoyee** du journal ; les memes lignes alimentent le
 * fil d'amis depuis le lot 6, sous `activity_select_visible` qui porte `can_see(user_id)`.
 * L'onglet ne fait que les ranger par personne. Si un jour quelqu'un « enrichissait » cette
 * lecture avec le journal du navigateur, ce serait une fuite — et elle serait invisible a
 * l'ecran, puisque le lecteur qui teste est souvent celui dont c'est le journal.
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

describe('journalBy — tous les genres, une seule personne', () => {
  it('🔴 ne filtre PAS sur le genre, contrairement a lovedBy', async () => {
    // C'est toute la difference entre « ce qu'il aime » et « ce qu'il fait ». Un
    // `kind=eq.liked` recopie ici rendrait les deux onglets identiques, et personne ne le
    // verrait tant que la base ne porte que des coeurs.
    const { seen, client } = spying([]);
    await client.journalBy('elle');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('user_id=eq.elle');
    expect(seen[0]).not.toContain('kind=eq.');
  });

  it('lovedBy, lui, filtre bien — l’ancrage', async () => {
    // Sans cet ancrage, le test ci-dessus passerait aussi avec un client qui ne filtre
    // jamais rien : il comparerait deux fois la meme absence.
    const { seen, client } = spying([]);
    await client.lovedBy('elle');
    expect(seen[0]).toContain('kind=eq.liked');
  });
});

// ---------------------------------------------------------------------------
// L'onglet
// ---------------------------------------------------------------------------

const base = vi.hoisted(() => ({ journal: [] as unknown[] }));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({ configured: true, ready: true, account: undefined, providers: new Set() }),
}));

vi.mock('@/app/social/socialFrom', () => ({
  socialFrom: () => ({
    findByHandle: async () => ({ userId: 'elle', handle: 'marie' }),
    reviewsBy: async () => [],
    lovedBy: async () => [],
    favoritesBy: async () => [],
    journalBy: async () => base.journal,
    tagsBy: async () => [],
    listsBy: async () => [],
    reviewLikesAcross: async () => [],
  }),
}));

const { LocaleProvider } = await import('@/app/i18n/LocaleProvider');
const { PublicProfile } = await import('@/app/components/PublicProfile');

function mount() {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <PublicProfile handle="marie" />
    </LocaleProvider>,
  );
}

async function openJournal() {
  fireEvent.click(await screen.findByRole('tab', { name: /regarde/i }));
}

beforeEach(() => {
  base.journal = [];
  window.localStorage.clear();
});

describe('l’onglet du journal', () => {
  it('rend chaque fait avec sa serie et sa date, jamais la cle', async () => {
    base.journal = [
      {
        kind: 'finished',
        subject: 'tmdb:1396',
        happenedOn: '2026-08-14',
        handle: 'marie',
        authorId: 'elle',
        title: 'Breaking Bad',
        posterPath: '/a.jpg',
      },
      {
        kind: 'rated_season',
        subject: 'tmdb:1399',
        season: 2,
        stars: 4.5,
        happenedOn: '2026-08-12',
        handle: 'marie',
        authorId: 'elle',
        title: 'Game of Thrones',
      },
    ];

    mount();
    await openJournal();

    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeDefined());
    expect(screen.getByRole('link', { name: 'Breaking Bad' }).getAttribute('href')).toBe(
      '/fr/serie/1396',
    );
    // 🔴 La cle brute est le defaut constate en production le 2026-08-16, cinq fois.
    expect(screen.queryByText(/tmdb:/)).toBeNull();
    // La date : c'est elle qui distingue un journal d'une liste — sans elle, on ne sait pas
    // si la personne regarde encore.
    expect(document.querySelector('time[datetime="2026-08-14"]')).not.toBeNull();
  });

  it('un journal vide le dit, sans bouton', async () => {
    mount();
    await openJournal();
    await waitFor(() => expect(screen.getByText(/Rien de publié/)).toBeDefined());
  });

  it('la barre boucle au clavier, quel que soit le nombre d’onglets', async () => {
    // Le motif ARIA sort les onglets non actifs du parcours de tabulation : sans les fleches
    // ils deviennent inatteignables. La barre a grandi deux fois en un jour (journal, puis
    // mots), et c'est exactement le genre de detail qu'un ajout casse en silence.
    //
    // ⚠️ La propriete testee est **le bouclage**, pas le compte : une assertion sur « quatre
    // onglets » est tombee au premier ajout suivant sans rien apprendre. On vise donc le
    // DERNIER, quel qu'il soit.
    mount();
    const onglets = await screen.findAllByRole('tab');
    expect(onglets.length).toBeGreaterThan(1);
    const dernier = onglets[onglets.length - 1] as HTMLElement;

    fireEvent.keyDown(onglets[0] as HTMLElement, { key: 'ArrowLeft' });
    await waitFor(() => expect(dernier.getAttribute('aria-selected')).toBe('true'));
  });
});

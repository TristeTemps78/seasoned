import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICTIONARIES } from '../lib/i18n';
import { SocialClient, type PublishedReview } from '../src/social/client';

/**
 * Le coeur, la ou l'on decouvre une critique — F4.
 *
 * ## 🔴 Ce que ce fichier garde
 *
 * `likeReview` et le tri « les plus aimees » existent depuis `015`, et ils n'etaient montes
 * qu'a **un** endroit du depot : la fiche serie. On pouvait donc lire quelqu'un sur son
 * profil ou sur la vitrine de l'accueil sans pouvoir le lui dire — c'est-a-dire nulle part
 * ou l'on decouvre, et partout ou l'on savait deja quoi chercher.
 *
 * ⚠️ **Deux moities, et une seule est du rendu.** L'autre est `022` : `review_like_counts`
 * prend UN sujet, parce qu'elle a ete ecrite pour une fiche. Un profil melange les oeuvres.
 * La boucle cote client etait la reponse facile et `015` l'interdit dans sa propre
 * documentation ; les trois premiers tests gardent la forme de l'appel, qui est la seule
 * chose qu'un test puisse garder ici — ils doublent `fetch`.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

/** Un `fetch` qui retient ce qui a ete demande, et sert le corps donne. */
function spying(body: unknown, status = 200) {
  const seen: { url: string; body: string }[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    seen.push({ url: String(input), body: String(init?.body ?? '') });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { seen, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

describe('reviewLikesAcross — un appel, quel que soit le nombre de series', () => {
  it('demande la fonction tableau, et rend le sujet avec le compte', async () => {
    const { seen, client } = spying([
      { subject: 'tmdb:1396', author_id: 'u1', target: 'series', likes: 3, mine: true },
      { subject: 'tmdb:94605', author_id: 'u1', target: 'season:2', likes: 1, mine: false },
    ]);

    const rows = await client.reviewLikesAcross(['tmdb:1396', 'tmdb:94605']);

    // ⚠️ UN appel pour deux series : c'est tout l'objet de `022`. Une boucle rendrait le
    // meme resultat et couterait un aller-retour par serie.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toContain('rpc/review_like_counts_across');
    expect(JSON.parse(seen[0]?.body ?? '{}')).toEqual({
      for_subjects: ['tmdb:1396', 'tmdb:94605'],
    });
    expect(rows).toEqual([
      { subject: 'tmdb:1396', authorId: 'u1', target: 'series', likes: 3, mine: true },
      { subject: 'tmdb:94605', authorId: 'u1', target: 'season:2', likes: 1, mine: false },
    ]);
  });

  it('sans sujet, ne demande rien du tout', async () => {
    // Le cas frequent : une page sans critique. Un aller-retour pour un tableau vide est
    // un aller-retour de trop.
    const { seen, client } = spying([]);
    await expect(client.reviewLikesAcross([])).resolves.toEqual([]);
    expect(seen).toHaveLength(0);
  });

  it('🔴 sans 022 appliquee, rend une liste vide au lieu de casser', async () => {
    // C'est la difference avec `020`, et elle est deliberee : la un client qui emettait des
    // colonnes absentes faisait refuser l'ecriture entiere. Ici la fonction manque, PostgREST
    // rend 404, `#rpc` ne leve jamais — les coeurs affichent zero et restent cliquables, et
    // la fiche serie n'est pas touchee puisqu'elle garde `review_like_counts`.
    const { client } = spying({ message: 'function does not exist' }, 404);
    await expect(client.reviewLikesAcross(['tmdb:1396'])).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Le cablage : le coeur est-il monte la ou il manquait ?
// ---------------------------------------------------------------------------

const session = vi.hoisted(() => ({
  account: { userId: 'moi', accessToken: 'jeton' } as
    | { userId: string; accessToken: string }
    | undefined,
}));

const base = vi.hoisted(() => ({
  reviews: [] as unknown[],
  likes: [] as unknown[],
  liked: [] as { author: string; subject: string; target: string; on: boolean }[],
}));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: session.account,
    providers: new Set<string>(),
  }),
}));

vi.mock('@/app/social/socialFrom', () => ({
  socialFrom: () => ({
    feedReviews: async () => base.reviews,
    // F3 : la vitrine demande d'abord la fenetre de la semaine, et se replie sur
    // `feedReviews` quand elle est vide. Le double rend la meme matiere aux deux, sans quoi
    // ces tests mesureraient le repli en croyant mesurer le classement.
    popularReviews: async () => base.reviews,
    reviewsBy: async () => base.reviews,
    reviewLikesAcross: async () => base.likes,
    likeReview: async (_me: string, author: string, subject: string, target: string, on: boolean) => {
      base.liked.push({ author, subject, target, on });
      return true;
    },
    findByHandle: async () => ({ userId: 'elle', handle: 'marie' }),
    lovedBy: async () => [],
    favoritesBy: async () => [],
    journalBy: async () => [],
    tagsBy: async () => [],
    listsBy: async () => [],
    following: async () => [],
    followers: async () => [],
    myProfile: async () => ({ handle: 'moi' }),
    // ⚠️ Ajoutee avec F2 : le `Promise.all` de `PublicProfile` rejette sans elle, et la page
    // entiere cesse de rendre. Ces doubles disent, negativement, tout ce que la page appelle.
    followCounts: async () => undefined,
  }),
}));

const { LocaleProvider } = await import('@/app/i18n/LocaleProvider');
const { DiscoverReviews } = await import('@/app/components/DiscoverReviews');
const { PublicProfile } = await import('@/app/components/PublicProfile');

/** Une critique publiee, reduite a ce dont ces tests ont besoin. */
function written(subject: string, text: string, publishedAt: string): PublishedReview {
  return {
    subject,
    target: 'series',
    text,
    throughSeason: 0,
    lang: 'fr',
    publishedAt,
    handle: 'marie',
    authorId: 'elle',
    title: `serie ${subject}`,
  };
}

function mount(node: React.ReactNode) {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      {node}
    </LocaleProvider>,
  );
}

/**
 * Les coeurs rendus, dans l'ordre du DOM.
 *
 * ⚠️ Les deux libelles, parce que le bouton **change de nom** en changeant d'etat :
 * « J'aime cette critique » devient « Retirer mon coeur ». Une recherche sur le seul
 * premier libelle rendrait une liste vide juste apres le clic — et le test aurait accuse
 * le coeur de disparaitre.
 */
function hearts(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: /aime cette critique|retirer mon/i });
}

beforeEach(() => {
  base.reviews = [];
  base.likes = [];
  base.liked = [];
  session.account = { userId: 'moi', accessToken: 'jeton' };
  window.localStorage.clear();
});

describe('la vitrine de l’accueil porte le coeur', () => {
  it('🔴 on peut aimer une critique la ou on la decouvre', async () => {
    base.reviews = [written('tmdb:1396', 'excellent', '2026-08-10T10:00:00Z')];
    base.likes = [{ subject: 'tmdb:1396', authorId: 'elle', target: 'series', likes: 2, mine: false }];

    mount(<DiscoverReviews />);

    // ⚠️ Le compte est attendu, jamais lu au premier rendu : les critiques arrivent avant
    // les coeurs (deux lectures, la seconde etant declenchee par la premiere). Une
    // assertion seche ici mesurerait l'etat transitoire — le piege exact que
    // `trajectory-section.test.tsx` documente pour la position du journal.
    await waitFor(() => expect(hearts()[0]?.textContent).toContain('2'));

    fireEvent.click(hearts()[0] as HTMLElement);

    // ⚠️ Le `subject` DOIT voyager : c'est la moitie de la cle d'un coeur, et sur cette page
    // il change d'une ligne a l'autre. Un appel qui l'oublierait aimerait la mauvaise
    // critique sans que rien ne le dise.
    await waitFor(() =>
      expect(base.liked).toEqual([
        { author: 'elle', subject: 'tmdb:1396', target: 'series', on: true },
      ]),
    );
    await waitFor(() => expect(hearts()[0]?.textContent).toContain('3'));
  });

  it('sans compte, aucun coeur — un bouton qui ne peut pas marcher ne s’affiche pas', async () => {
    session.account = undefined;
    base.reviews = [written('tmdb:1396', 'excellent', '2026-08-10T10:00:00Z')];

    mount(<DiscoverReviews />);

    await screen.findByText('excellent');
    expect(hearts()).toHaveLength(0);
  });
});

describe('le profil public porte le coeur et le tri', () => {
  /** Ouvre l'onglet des critiques : le defaut est « ce qu'il aime ». */
  async function openReviews() {
    fireEvent.click(await screen.findByRole('tab', { name: /a écrit/i }));
  }

  it('🔴 le coeur manquait sur la page faite pour lire quelqu’un', async () => {
    base.reviews = [written('tmdb:1396', 'excellent', '2026-08-10T10:00:00Z')];
    base.likes = [{ subject: 'tmdb:1396', authorId: 'elle', target: 'series', likes: 0, mine: false }];

    mount(<PublicProfile handle="marie" />);
    await openReviews();

    await waitFor(() => expect(hearts()).toHaveLength(1));
    fireEvent.click(hearts()[0] as HTMLElement);
    await waitFor(() =>
      expect(base.liked).toEqual([
        { author: 'elle', subject: 'tmdb:1396', target: 'series', on: true },
      ]),
    );
  });

  it('le tri n’apparait qu’a partir de cinq critiques, et range par coeurs', async () => {
    base.reviews = [
      written('tmdb:1', 'un', '2026-08-15T10:00:00Z'),
      written('tmdb:2', 'deux', '2026-08-14T10:00:00Z'),
      written('tmdb:3', 'trois', '2026-08-13T10:00:00Z'),
      written('tmdb:4', 'quatre', '2026-08-12T10:00:00Z'),
      written('tmdb:5', 'cinq', '2026-08-11T10:00:00Z'),
    ];
    // La plus ANCIENNE est la plus aimee : sans tri elle est derniere, avec elle passe
    // premiere. Deux ordres qui coincideraient ne prouveraient rien.
    base.likes = [
      { subject: 'tmdb:5', authorId: 'elle', target: 'series', likes: 9, mine: false },
    ];

    mount(<PublicProfile handle="marie" />);
    await openReviews();

    const menu = await screen.findByLabelText(/trier/i);
    const textes = () =>
      screen.getAllByRole('listitem').map((li) => li.textContent ?? '');

    await waitFor(() => expect(textes()[0]).toContain('un'));

    fireEvent.change(menu, { target: { value: 'liked' } });
    await waitFor(() => expect(textes()[0]).toContain('cinq'));
  });

  it('sous cinq critiques, pas de commande — la regle 4 lue a l’endroit', async () => {
    base.reviews = [
      written('tmdb:1', 'un', '2026-08-15T10:00:00Z'),
      written('tmdb:2', 'deux', '2026-08-14T10:00:00Z'),
    ];

    mount(<PublicProfile handle="marie" />);
    await openReviews();

    await screen.findByText('un');
    expect(screen.queryByLabelText(/trier/i)).toBeNull();
  });
});

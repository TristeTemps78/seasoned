import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICTIONARIES } from '../lib/i18n';
import { SocialClient } from '../src/social/client';

/**
 * Repondre a une critique — F5.
 *
 * Le releve du 2026-08-16 hesitait a raison : *« c'est aussi une surface de moderation
 * entiere »*. Ce que ce lot **refuse** est garde par les scenarios 69 a 72 contre la vraie
 * base — on ne repond pas sous une critique invisible, et l'auteur d'une critique n'efface
 * pas les reponses des autres. Ici on garde ce qui se voit a l'ecran.
 *
 * ⚠️ Le test qui compte est le premier : **un fil ne s'affiche pas sous un texte masque**.
 * Une reponse parle de ce qu'elle commente ; « il se passe quelque chose a la saison 6 »
 * suffit a gacher, et le caviardage du texte ne servirait plus a rien.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

describe('commentsOn — un appel pour toute la fiche', () => {
  it('filtre sur le sujet et joint l’auteur', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (input: string) => {
      seen.push(String(input));
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;

    await new SocialClient({ ...OPTIONS, fetchImpl }).commentsOn('tmdb:1396');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('subject=eq.tmdb%3A1396');
    // ⚠️ `!inner` : sans lui PostgREST rend les lignes dont le profil ne correspond pas, avec
    // `profiles: null` — un commentaire sans auteur lisible n'est ni ouvrable ni signalable.
    expect(seen[0]).toContain('profiles!inner');
  });
});

// ---------------------------------------------------------------------------
// L'ecran
// ---------------------------------------------------------------------------

const session = vi.hoisted(() => ({
  account: undefined as { userId: string; accessToken: string } | undefined,
}));

const base = vi.hoisted(() => ({
  reviews: [] as unknown[],
  comments: [] as unknown[],
  envoyes: [] as { body: string }[],
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
    reviewsFor: async () => base.reviews,
    reviewLikes: async () => [],
    commentsOn: async () => base.comments,
    comment: async (
      _me: string,
      _review: unknown,
      body: string,
    ) => {
      base.envoyes.push({ body });
      return true;
    },
    removeComment: async () => true,
    report: async () => true,
    following: async () => [],
  }),
}));

const { LocaleProvider } = await import('@/app/i18n/LocaleProvider');
const { Reviews } = await import('@/app/components/Reviews');

/** Une critique publiee, avec le spoiler qu'on veut. */
function review(throughSeason: number, text = 'un texte') {
  return {
    subject: 'tmdb:1396',
    target: 'series',
    text,
    throughSeason,
    lang: 'fr',
    publishedAt: '2026-08-10T10:00:00Z',
    handle: 'marie',
    authorId: 'elle',
    title: 'Breaking Bad',
  };
}

function comment(authorId: string, handle: string, body: string) {
  return {
    id: `c-${authorId}-${body}`,
    reviewAuthorId: 'elle',
    subject: 'tmdb:1396',
    target: 'series',
    body,
    writtenAt: '2026-08-12T10:00:00Z',
    handle,
    authorId,
  };
}

function mount() {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <Reviews seriesId="1396" />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  base.reviews = [];
  base.comments = [];
  base.envoyes = [];
  session.account = undefined;
  window.localStorage.clear();
});

describe('le fil suit l’etat du texte', () => {
  it('🔴 aucune reponse visible sous une critique caviardee', async () => {
    // `throughSeason: 3` sans position declaree : `redactReviews` masque, defaut strict —
    // « mieux vaut masquer a tort ». Le fil doit disparaitre avec le texte.
    base.reviews = [review(3, 'le twist de la saison 3')];
    base.comments = [comment('lui', 'paul', 'Exactement ce que j’ai pensé')];

    mount();

    // ⚠️ `review.hiddenSeries` et non `review.hidden` : la cible est `series`, donc c'est la
    // phrase « Contient des révélations sur la suite. » qui s'affiche. Les deux existent.
    await waitFor(() =>
      expect(screen.getByText(/Contient des révélations sur la suite/)).toBeDefined(),
    );
    expect(screen.queryByText(/Exactement ce que j’ai pensé/)).toBeNull();
    // Et pas meme le compte : « 1 réponse » sous un texte masque dit deja qu'il y a de quoi
    // reagir, donc que quelque chose se passe.
    expect(screen.queryByText(/réponse/)).toBeNull();
  });

  it('le fil revient avec le texte, une fois revele', async () => {
    base.reviews = [review(3, 'le twist de la saison 3')];
    base.comments = [comment('lui', 'paul', 'Exactement ce que j’ai pensé')];

    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Afficher quand meme|Afficher quand même/i }));

    const depliant = await screen.findByRole('button', { name: /réponse/ });
    fireEvent.click(depliant);
    await waitFor(() => expect(screen.getByText(/Exactement ce que j’ai pensé/)).toBeDefined());
  });

  it('sans spoiler, le fil est la tout de suite', async () => {
    base.reviews = [review(0)];
    base.comments = [comment('lui', 'paul', 'Bien vu')];

    mount();
    expect(await screen.findByRole('button', { name: /1 réponse/ })).toBeDefined();
  });
});

describe('qui peut quoi', () => {
  it('sans compte : pas de champ, mais une porte nommee', async () => {
    // Regle 4 — un ecran sans issue, pas un ecran sans bouton.
    base.reviews = [review(0)];
    mount();

    await waitFor(() => expect(screen.getByText(/Répondre demande un compte/)).toBeDefined());
    expect(screen.getByRole('link', { name: /En ouvrir un/ }).getAttribute('href')).toBe(
      '/fr/compte',
    );
    expect(screen.queryByRole('button', { name: /^Répondre$/ })).toBeNull();
  });

  it('avec un compte : le champ envoie la reponse', async () => {
    session.account = { userId: 'moi', accessToken: 'jeton' };
    base.reviews = [review(0)];
    mount();

    const champ = await screen.findByLabelText(/Répondre à cette critique/);
    fireEvent.change(champ, { target: { value: '  Bien vu  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Répondre$/ }));

    // ⚠️ Rogne avant l'envoi : un message de trois espaces passerait la borne `length >= 1`
    // de la base et s'afficherait comme une ligne vide.
    await waitFor(() => expect(base.envoyes).toEqual([{ body: 'Bien vu' }]));
  });

  it('🔴 « Retirer » n’apparait QUE sur sa propre reponse', async () => {
    // C'est la decision de fond de `024` rendue visible : l'auteur de la critique n'a aucun
    // pouvoir sur les reponses des autres, et rien a l'ecran ne doit le laisser croire.
    session.account = { userId: 'moi', accessToken: 'jeton' };
    base.reviews = [review(0)];
    base.comments = [
      comment('moi', 'moi', 'La mienne'),
      comment('lui', 'paul', 'La sienne'),
    ];

    mount();
    fireEvent.click(await screen.findByRole('button', { name: /2 réponses/ }));

    await waitFor(() => expect(screen.getByText('La sienne')).toBeDefined());
    expect(screen.getAllByRole('button', { name: /Retirer ma réponse/ })).toHaveLength(1);
  });
});

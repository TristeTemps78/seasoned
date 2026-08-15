import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n';

/**
 * Le volet de l'en-tete.
 *
 * ## Ce qu'il faut garder, et ce que la mise en page ne peut pas garder
 *
 * Sa geometrie a ete mesuree au navigateur (224 px, cinq lignes de 44 px, contenu dans la
 * fenetre a 375 px), et **c'est la que ca se mesure** : jsdom n'a aucun moteur de rendu.
 * Ce qui se garde ici est ce qui se lit dans le rendu — les destinations et leur langue, et
 * la regle « aucun bouton qui ne peut pas marcher ».
 *
 * Le vrai risque de regression n'est pas le dessin : c'est qu'une des quatre destinations
 * reperde sa porte. Elles etaient toutes construites et toutes injoignables ; rien n'avait
 * signale l'ecart pendant dix lots.
 */

const pathname = vi.hoisted(() => ({ current: '/fr' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

/** La session simulee, et le profil que la base rendrait. */
const session = vi.hoisted(() => ({
  account: undefined as { userId: string; accessToken: string } | undefined,
  left: 0,
}));
const remote = vi.hoisted(() => ({ handle: undefined as string | undefined, calls: 0 }));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: session.account,
    providers: new Set<string>(),
    sendLink: async () => ({ kind: 'failed' as const }),
    submitCode: async () => false,
    withGoogle: async () => false,
    completeCallback: async () => ({ kind: 'nothing_to_do' as const }),
    leave: async () => {
      session.left += 1;
    },
    erase: async () => false,
  }),
}));

vi.mock('@/app/social/socialFrom', () => ({
  socialFrom: () => ({
    myProfile: async () => {
      remote.calls += 1;
      return remote.handle === undefined ? undefined : { handle: remote.handle };
    },
  }),
}));

function renderMenu(locale: Locale = 'fr') {
  return render(
    <LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
      <AccountMenu locale={locale} />
    </LocaleProvider>,
  );
}

function open() {
  fireEvent.click(screen.getByRole('button', { expanded: false }));
}

beforeEach(() => {
  session.account = undefined;
  session.left = 0;
  remote.handle = undefined;
  remote.calls = 0;
  pathname.current = '/fr';
});

describe('les destinations que rien n ouvrait', () => {
  it('🔴 ouvre le journal, le catalogue et le compte — sans compte', () => {
    // Les trois marchent sans session : le journal vit dans le navigateur, `/parcourir` est
    // une page statique, et `/compte` est justement la porte pour en ouvrir un.
    renderMenu();
    open();
    for (const [name, href] of [
      ['Mon journal', '/fr/journal'],
      ['Parcourir le catalogue', '/fr/parcourir'],
      ['Mon compte', '/fr/compte'],
    ] as const) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
  });

  it('mene au profil public une fois le pseudo connu', async () => {
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    renderMenu();
    open();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /tristetemps78/ }).getAttribute('href')).toBe(
        '/fr/u/tristetemps78',
      ),
    );
  });

  it('propose de choisir un pseudo quand le compte n en a pas', async () => {
    // ⚠️ Jamais un lien vers `/u/undefined` : un compte sans ligne dans `profiles` n'a pas
    // de page publique, et la porte est alors celle ou le pseudo se reclame.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    renderMenu();
    open();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Choisir mon pseudo' }).getAttribute('href')).toBe(
        '/fr/amis',
      ),
    );
    expect(screen.queryByRole('link', { name: /undefined/ })).toBeNull();
  });

  it('ne prefixe rien en anglais', () => {
    renderMenu('en');
    open();
    expect(screen.getByRole('link', { name: 'My journal' }).getAttribute('href')).toBe('/journal');
  });
});

describe('aucun bouton qui ne peut pas marcher', () => {
  it('🔴 pas de deconnexion sans session', () => {
    renderMenu();
    open();
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
  });

  it('deconnecte, et referme', async () => {
    session.account = { userId: 'u1', accessToken: 'jeton' };
    renderMenu();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(session.left).toBe(1));
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('le volet s ouvre et se referme', () => {
  it('annonce son etat, et ne rend rien tant qu il est ferme', () => {
    renderMenu();
    expect(screen.queryByRole('navigation')).toBeNull();
    open();
    expect(screen.getByRole('button', { expanded: true })).toBeDefined();
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('🔴 Echap referme et rend le focus au bouton', () => {
    // Sans le retour de focus, la tabulation suivante repart du tout debut de la page —
    // c'est la meme lecon que le lien d'evitement, qui deplacait la vue sans le focus.
    renderMenu();
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    const trigger = screen.getByRole('button', { expanded: false });
    expect(document.activeElement).toBe(trigger);
  });

  it('referme au clic dehors', () => {
    renderMenu();
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('🔴 referme en changeant de page', () => {
    // L'en-tete est le meme noeud d'une page a l'autre : sans cet effet, le volet resterait
    // ouvert par-dessus la page suivante.
    //
    // ⚠️ `rerender` et non un second `render` : le second **ajoute** un composant sans
    // demonter le premier, donc le volet reste a l'ecran quoi qu'il arrive et le test passe
    // au vert sans rien prouver. C'est exactement la nature du defaut vise — un noeud qui
    // survit a la navigation.
    const { rerender } = renderMenu();
    open();
    pathname.current = '/fr/moi';
    rerender(
      <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
        <AccountMenu locale="fr" />
      </LocaleProvider>,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('le pseudo ne se demande pas au chargement', () => {
  it('🔴 ne lit rien tant que personne ne touche au bouton', () => {
    // Cet en-tete est sur **toutes** les pages : une lecture au rendu serait une requete par
    // page et par visiteur connecte. Meme discipline qu `AuthProvider`, qui ne charge pas le
    // SDK pour qui n'a pas de session.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    renderMenu();
    expect(remote.calls).toBe(0);
  });

  it('la demande une seule fois, meme rouverte', async () => {
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    renderMenu();
    open();
    await waitFor(() => expect(remote.calls).toBe(1));
    fireEvent.keyDown(document, { key: 'Escape' });
    open();
    await waitFor(() => expect(screen.getByRole('navigation')).toBeDefined());
    expect(remote.calls).toBe(1);
  });
});

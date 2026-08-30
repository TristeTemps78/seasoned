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
const remote = vi.hoisted(() => ({
  handle: undefined as string | undefined,
  calls: 0,
  /** Quand la lecture echoue : myProfile rend undefined **et** signale la panne. */
  fails: false,
}));

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
  // ⚠️ Le rappel d'echec est **pris**, pas ignore : `useSocialRead` ne sait distinguer une
  // panne d'une absence que par lui, et sans ca le double serait toujours un succes.
  socialFrom: (
    _token: unknown,
    onFailure?: (where: string, status?: number, kind?: 'read' | 'write') => void,
  ) => ({
    myProfile: async () => {
      remote.calls += 1;
      if (remote.fails) {
        onFailure?.('profiles', 500, 'read');
        return undefined;
      }
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
  remote.fails = false;
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

  it('🔴 le survol puis le clic ne font qu une lecture', async () => {
    // Le geste reel : la souris entre sur le bouton (la lecture part), et le clic suit dans
    // la foulee — **avant** la reponse. Le garde-fou comparait un etat qui n'arrive qu'avec
    // elle, donc l'en-tete lisait `profiles` deux fois a chaque ouverture. Le test qui
    // existait ne le voyait que sous charge, une fois sur dix.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    renderMenu();
    fireEvent.pointerEnter(screen.getByRole('button', { expanded: false }));
    open();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /tristetemps78/ })).toBeDefined(),
    );
    expect(remote.calls).toBe(1);
  });

  it('🔴 redemande apres un changement de compte', async () => {
    // La reference porte l'identifiant, pas un drapeau : sinon le menu pointerait vers le
    // profil du compte precedent — un lien juste, vers la mauvaise personne.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    const { rerender } = renderMenu();
    open();
    await waitFor(() => expect(remote.calls).toBe(1));
    session.account = { userId: 'u2', accessToken: 'jeton' };
    remote.handle = 'quelquun-dautre';
    fireEvent.keyDown(document, { key: 'Escape' });
    rerender(
      <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
        <AccountMenu locale="fr" />
      </LocaleProvider>,
    );
    open();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /quelquun-dautre/ })).toBeDefined(),
    );
    expect(screen.queryByRole('link', { name: /tristetemps78/ })).toBeNull();
  });
});

describe('une lecture ratee n est pas un compte sans nom', () => {
  it('🔴 n invite pas a choisir un pseudo tant que la reponse n est pas la', () => {
    // « Choisir mon pseudo » s'affichait pendant **toute** la lecture, donc a qui a un nom
    // depuis des semaines. Elle attend maintenant la reponse, sur une place tenue.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    renderMenu();
    open();
    expect(screen.queryByRole('link', { name: 'Choisir mon pseudo' })).toBeNull();
  });

  it('🔴 n invite pas a choisir un pseudo quand la lecture a echoue', async () => {
    // `myProfile()` rend `undefined` dans les deux cas. Sans `useSocialRead`, une panne
    // ressemblait trait pour trait a un compte sans profil — et cette ligne **invite a un
    // geste** qui n'a aucun sens pour qui a deja un nom. C'est le defaut du 2026-08-18, et
    // `no-false-empty` ne pouvait pas le voir : ce n'est pas une phrase de vide, c'est un
    // libelle de lien.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    remote.fails = true;
    renderMenu();
    open();
    await waitFor(() => expect(remote.calls).toBe(1));
    expect(screen.queryByRole('link', { name: 'Choisir mon pseudo' })).toBeNull();
    // Les autres destinations, elles, ne dependent d'aucune lecture.
    expect(screen.getByRole('link', { name: 'Mon journal' })).toBeDefined();
  });

  it('🔴 la prochaine ouverture redemande apres un echec', async () => {
    // L'echec se gardait : le menu restait sans profil jusqu'a la fin de la session, alors
    // qu'une panne du social dure quelques secondes.
    session.account = { userId: 'u1', accessToken: 'jeton' };
    remote.handle = 'tristetemps78';
    remote.fails = true;
    renderMenu();
    open();
    await waitFor(() => expect(remote.calls).toBe(1));
    // ⚠️ Referme au clic dehors et non par Echap : Echap **rend le focus au bouton**, donc
    // relance la lecture avant que le reseau ne soit revenu. C'est le bon comportement, mais
    // ce n'est pas ce que ce test mesure.
    fireEvent.pointerDown(document.body);
    remote.fails = false;
    open();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /tristetemps78/ }).getAttribute('href')).toBe(
        '/fr/u/tristetemps78',
      ),
    );
    expect(remote.calls).toBe(2);
  });
});

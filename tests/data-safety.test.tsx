import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataSafety } from '@/app/components/DataSafety';
import { AuthContext } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { EMPTY_JOURNAL, serializeJournal, setWanted } from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

/**
 * Le bandeau de securite des donnees, teste sur ce qui le rend acceptable : **son
 * silence**.
 *
 * Un bandeau qui s'affiche a tort n'est pas un petit defaut esthetique. C'est le message
 * qui annonce un risque de **perte de donnees** ; le montrer a quelqu'un qui n'a rien a
 * perdre, ou dont les donnees sont deja protegees, apprend a ignorer nos messages — et le
 * jour ou il compte, il ne sera plus lu. Les trois regles de silence sont donc la
 * fonctionnalite, pas une precaution autour d'elle.
 */

/** Un journal contenant un geste — donc quelque chose a perdre. */
function withOneGesture(): string {
  return serializeJournal(setWanted(EMPTY_JOURNAL, 'tmdb:1396', true));
}

function renderIn(locale: 'fr' | 'en') {
  return render(
    <LocaleProvider locale={locale}>
      <DataSafety />
    </LocaleProvider>,
  );
}

describe('DataSafety', () => {
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, withOneGesture());
  });

  it('se tait quand il n’y a rien a perdre', async () => {
    window.localStorage.clear();
    const { container } = renderIn('fr');
    // On attend volontairement : le composant ne decide qu'apres avoir lu le stockage,
    // et un test qui conclut avant la lecture verifierait l'ecran de chargement.
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('parle des qu’il y a quelque chose a perdre', async () => {
    renderIn('fr');
    expect(await screen.findByText(/ne vivent que dans ce navigateur/)).toBeDefined();
  });

  it('parle la langue de la PAGE, pas celle du navigateur', async () => {
    // Le defaut repare : le composant lisait `navigator.language`. Sur `/fr`, un
    // navigateur anglophone recevait donc un bandeau anglais **dans une page
    // francaise** — chaque moitie juste, l'ensemble faux.
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    renderIn('fr');
    expect(await screen.findByText(/ne vivent que dans ce navigateur/)).toBeDefined();
  });

  it('parle anglais sur une page anglaise, meme a un navigateur francais', async () => {
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
    renderIn('en');
    expect(await screen.findByText(/live in this browser only/)).toBeDefined();
  });

  it('« plus tard » le fait taire', async () => {
    renderIn('fr');
    fireEvent.click(await screen.findByRole('button', { name: /Plus tard/ }));
    await waitFor(() =>
      expect(screen.queryByText(/ne vivent que dans ce navigateur/)).toBeNull(),
    );
  });
});

/**
 * Une sonde branchee sur la **meme** source que le bandeau : le journal.
 *
 * Elle rend un marqueur des que la lecture du stockage est finie. C'est ce qui permet
 * d'attendre la decision du bandeau au lieu d'attendre une duree — un test qui dort est un
 * test qui echouera un jour sur une machine plus lente, ou passera a tort sur une plus
 * rapide.
 */
function Probe() {
  const { ready } = useJournal();
  return <span>{ready ? 'journal-lu' : ''}</span>;
}

describe('avec un compte, le bandeau se tait', () => {
  /** Un etat d'authentification minimal : seul `account` compte ici. */
  function signedIn(children: React.ReactNode) {
    return (
      <AuthContext.Provider
        value={{
          configured: true,
          ready: true,
          account: { userId: 'u1', accessToken: 'jeton' },
          sendLink: async () => ({ kind: 'failed' as const }),
          submitCode: async () => false,
          withGoogle: async () => undefined,
          completeCallback: async () => ({ kind: 'nothing_to_do' as const }),
          leave: async () => undefined,
          erase: async () => false,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  /**
   * ⚠️ **L'ancrage, et il est indispensable.** La premiere version de ce test verifiait un
   * silence — et le silence est l'etat par defaut de ce composant : il se tait aussi quand
   * il n'a rien lu, quand l'application est deja installee, quand le journal est vide.
   * Mutation verifiee : retirer la garde laissait le test **vert**.
   *
   * On prouve donc d'abord que le bandeau **parle** dans ce montage exact. Sans quoi
   * l'assertion suivante ne compare rien.
   */
  it('ancrage — sans compte, dans ce meme montage, le bandeau parle', async () => {
    window.localStorage.setItem(STORAGE_KEY, withOneGesture());
    render(
      <LocaleProvider locale="fr">
        <DataSafety />
      </LocaleProvider>,
    );

    expect(await screen.findByText(/ne vivent que dans ce navigateur/)).toBeDefined();
  });

  it('🔴 ne repete pas « ces notes ne vivent que dans ce navigateur » a qui synchronise', async () => {
    // Le bug, apparu avec le lot 6.3 : le titre de ce bandeau est **faux** des qu'un compte
    // existe — une copie part sur le serveur a chaque geste — et tout son propos, le risque
    // que Safari efface le stockage local, ne s'applique plus. Un avertissement qui ment
    // apprend a ignorer nos messages, ce que la regle n°2 de ce composant interdit.
    window.localStorage.setItem(STORAGE_KEY, withOneGesture());
    render(
      signedIn(
        <LocaleProvider locale="fr">
          <DataSafety />
          <Probe />
        </LocaleProvider>,
      ),
    );

    // ⚠️ On attend **la meme asynchronie que le composant**, pas un delai. Une assertion
    // d'absence posee tout de suite est vraie avant que le journal soit lu : c'est ainsi
    // que la premiere version de ce test restait verte quand on retirait la garde.
    await screen.findByText('journal-lu');

    expect(screen.queryByText(/ne vivent que dans ce navigateur/)).toBeNull();
  });
});

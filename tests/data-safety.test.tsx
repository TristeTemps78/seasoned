import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataSafety } from '@/app/components/DataSafety';
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

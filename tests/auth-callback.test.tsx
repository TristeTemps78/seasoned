import { render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it, vi } from 'vitest';
import { AuthCallback } from '@/app/components/AuthCallback';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { CallbackOutcome } from '@/src/auth/client';

/**
 * Le retour du lien de connexion.
 *
 * Deux defauts gardes ici, tous deux invisibles en typage et en relecture :
 * le jeton qui reste dans la barre d'adresse, et l'echec **normal** de PKCE rendu comme
 * une panne.
 */

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: undefined,
    completeCallback: mockComplete,
    sendLink: async () => ({ kind: 'failed' as const }),
    submitCode: async () => false,
    withGoogle: async () => undefined,
    leave: async () => undefined,
    erase: async () => false,
  }),
}));

let mockComplete: (href: string) => Promise<CallbackOutcome> = async () => ({
  kind: 'nothing_to_do',
});

function renderCallback(outcome: CallbackOutcome, href: string) {
  mockComplete = async () => outcome;
  window.history.replaceState(null, '', href);
  return render(
    <LocaleProvider locale="en" messages={DICTIONARIES.en}>
      <AuthCallback />
    </LocaleProvider>,
  );
}

describe('le retour du lien', () => {
  it('🔴 le jeton ne reste pas dans l URL apres la connexion', async () => {
    // Un `code` laisse dans la barre d'adresse part dans l'historique, dans le
    // presse-papier de qui partage le lien, et dans le `Referer` de la navigation
    // suivante. Aucune de ces fuites n'est visible en regardant l'ecran.
    renderCallback({ kind: 'signed_in' }, '/compte/retour?code=secret-abc123');

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    expect(window.location.href).not.toContain('secret-abc123');
  });

  it('🔴 nettoie l URL meme quand l echange echoue', async () => {
    // Un code brule reste un secret : le laisser en cas d'echec serait garder la fuite
    // pour tous les cas ou l'on n'a rien gagne en echange.
    renderCallback({ kind: 'expired' }, '/compte/retour?code=secret-def456');

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
  });

  it('🔴 un lien ouvert dans un autre navigateur explique pourquoi', async () => {
    // Le seul echec **normal** de PKCE : le verificateur est dans le `localStorage` de
    // l'onglet qui a demande le lien. Rendu comme « lien invalide », il pousse a
    // redemander un lien qui echouera exactement pareil — donc a boucler.
    renderCallback({ kind: 'wrong_browser' }, '/compte/retour?code=x');

    expect(await screen.findByText(/different browser/i)).toBeDefined();
  });

  it('un lien expire ne dit pas la meme chose qu un lien ouvert ailleurs', async () => {
    // Les deux cas appellent des gestes differents : redemander un lien, ou changer de
    // navigateur. Les confondre rend le message inutile dans les deux cas.
    renderCallback({ kind: 'expired' }, '/compte/retour?code=x');

    expect(await screen.findByText(/expired|already been used/i)).toBeDefined();
  });

  it('une page ouverte a la main ne pretend pas connecter quelqu un', async () => {
    renderCallback({ kind: 'nothing_to_do' }, '/compte/retour');

    expect(await screen.findByText(/nothing to confirm/i)).toBeDefined();
  });
});

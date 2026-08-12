import { render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it, vi } from 'vitest';
import { AuthCallback } from '@/app/components/AuthCallback';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { CallbackOutcome } from '@/src/auth/client';

/**
 * Le retour du lien de connexion.
 *
 * Trois defauts gardes ici, tous invisibles en typage et en relecture : le jeton qui reste
 * dans la barre d'adresse, l'echec **normal** de PKCE rendu comme une panne, et l'echange
 * rejoue sur une URL que la passe precedente venait de vider.
 */

/**
 * ⚠️ **`completeCallback` change d'identite a chaque rendu, et c'est fidele.**
 *
 * La premiere version de ce double le gardait stable, et c'est precisement pour ca qu'aucun
 * des cinq tests ci-dessous n'a vu le defaut du 2026-08-12 : `AuthProvider` reconstruit son
 * `value` — donc cette fonction — des que `ready`, `account` ou la liste des fournisseurs
 * bouge, et la liste des fournisseurs arrive **pendant** le retour, puisqu'elle vient d'un
 * `fetch` vers `/auth/v1/settings`. Un double plus stable que la vraie chose transforme le
 * test en tautologie.
 */
vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: undefined,
    completeCallback: (href: string) => mockComplete(href),
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

/** Les URL sur lesquelles l'echange a ete tente, dans l'ordre. */
let attempts: string[] = [];

function renderCallback(outcome: CallbackOutcome, href: string) {
  attempts = [];
  mockComplete = async (seen: string) => {
    attempts.push(seen);
    // Le vrai `finishSignIn` ne rend `nothing_to_do` que sur une URL sans `code` : le double
    // le reproduit, sans quoi une URL videe resterait indistinguable d'une bonne.
    return new URL(seen).searchParams.get('code') === null && outcome.kind !== 'nothing_to_do'
      ? { kind: 'nothing_to_do' }
      : outcome;
  };
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

  it('🔴 l echange n a lieu qu une fois, sur l URL d arrivee', async () => {
    /*
     * 🔴 Reproduit au navigateur le 2026-08-12 : `/fr/compte/retour?code=…` ouvert deux fois
     * de suite donnait **deux resultats differents pour la meme entree** — un echange puis
     * zero — et, dans les deux cas, le message reserve a « la page a ete ouverte a la main ».
     * Se connecter ne marchait pas, et le produit disait a la personne qu'elle n'avait rien
     * demande.
     *
     * L'effet dependait de `completeCallback`, dont l'identite change en cours de route ; a
     * la seconde passe il relisait `window.location.href`, que la premiere venait de vider
     * de son `code`. Selon l'ordre gagne par la course, on ecrasait l'issue par
     * `nothing_to_do` ou l'on rejouait l'echange avec un code deja brule.
     *
     * La loi : l'URL est lue **une fois**, au montage, et l'echange n'a lieu **qu'une fois**
     * — quel que soit le nombre de rendus. Les `rerender` ci-dessous jouent exactement ce que
     * faisait la reponse de `/auth/v1/settings`.
     */
    const view = renderCallback({ kind: 'signed_in' }, '/compte/retour?code=une-seule-fois');

    const again = (
      <LocaleProvider locale="en" messages={DICTIONARIES.en}>
        <AuthCallback />
      </LocaleProvider>
    );
    view.rerender(again);
    view.rerender(again);

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    view.rerender(again);

    expect(attempts.length, 'un code ne s echange qu une fois').toBe(1);
    expect(attempts[0], 'l URL lue doit encore porter le code').toContain('une-seule-fois');
  });

  it('🔴 l issue reelle survit aux rendus qui suivent', async () => {
    // Le meme defaut, vu du seul endroit ou quelqu'un le remarque : l'ecran. Une connexion
    // reussie s'annoncait « il n'y a rien a valider ici », parce que la seconde passe lisait
    // une URL videe. Ce test echoue sur l'ancienne version.
    const view = renderCallback({ kind: 'signed_in' }, '/compte/retour?code=abc');

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    view.rerender(
      <LocaleProvider locale="en" messages={DICTIONARIES.en}>
        <AuthCallback />
      </LocaleProvider>,
    );

    expect(await screen.findByText(/signed in|you are in|welcome/i)).toBeDefined();
    expect(screen.queryByText(/nothing to confirm/i)).toBeNull();
  });

  it('🔴 une fois entre, la page mene ailleurs que la ou l on vient de partir', async () => {
    /*
     * 🔴 Mesure au navigateur le 2026-08-12 : `/fr/compte/retour` rendait 34,9 % de surface
     * portant quelque chose, dont **528 px d'un seul tenant vides**, et son unique lien
     * renvoyait a `/compte` — la page d'ou l'on venait de partir. La derniere marche de
     * l'inscription ne menait nulle part.
     *
     * Les trois destinations sont les trois promesses de `/compte` : les listes, les amis, et
     * la bibliotheque qui suit desormais d'un appareil a l'autre.
     */
    renderCallback({ kind: 'signed_in' }, '/compte/retour?code=abc');

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });

    const cibles = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(cibles).toContain('/moi');
    expect(cibles).toContain('/listes');
    expect(cibles).toContain('/amis');
  });

  it('un echec ne propose pas trois portes, il renvoie la ou l on peut agir', async () => {
    // Un bouton qui ne peut pas marcher ne s'affiche pas — meme regle que le bouton Google
    // du 2026-08-09. Apres un echec, la seule chose utile est de redemander un lien.
    renderCallback({ kind: 'expired' }, '/compte/retour?code=x');

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });

    const cibles = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(cibles).toEqual(['/compte']);
  });
});

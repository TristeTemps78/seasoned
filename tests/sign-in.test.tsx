import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignIn } from '@/app/components/SignIn';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { MINIMUM_AGE } from '@/src/domain/handles';
import type { Locale } from '@/lib/i18n';

/**
 * Le formulaire de connexion.
 *
 * Un seul defaut garde : la case d'age qui ne conditionne rien. Q11 en fait une
 * declaration, et une declaration qui n'empeche rien n'est pas une declaration — c'est un
 * ornement, et il vaudrait mieux ne pas l'afficher que de faire semblant.
 */

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: undefined,
    sendLink: async () => ({ kind: 'sent' as const }),
    submitCode: async () => true,
    withGoogle: async () => undefined,
    completeCallback: async () => ({ kind: 'nothing_to_do' as const }),
    leave: async () => undefined,
    erase: async () => false,
  }),
}));

function renderIn(locale: Locale = 'en') {
  return render(
    <LocaleProvider locale={locale}>
      <SignIn />
    </LocaleProvider>,
  );
}

describe('la connexion', () => {
  it('🔴 le bouton reste inactif tant que l age n est pas declare', () => {
    // ⚠️ `fireEvent.change` et non une affectation de `.value` : React passe par son
    // propre setter, donc ecrire la valeur a la main ne met **pas** l'etat a jour. Le test
    // restait alors vert avec la garde retiree — creux, et pour la raison la plus
    // classique qui soit sur un composant controle.
    renderIn();
    const email = screen.getByLabelText(/email address/i);
    const send = screen.getByRole('button', { name: /sign-in link/i });

    fireEvent.change(email, { target: { value: 'moi@exemple.fr' } });

    // L'adresse est valide : seule la case manque.
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(new RegExp(`${MINIMUM_AGE} or older`)));
    expect((send as HTMLButtonElement).disabled).toBe(false);
  });

  it('⚠️ Google est ferme lui aussi tant que l age n est pas declare', () => {
    // Le defaut qu'on attend : garder la case sur le formulaire e-mail et oublier l'autre
    // chemin, qui aboutit pourtant au meme compte.
    renderIn();
    const google = screen.getByRole('button', { name: /google/i });
    expect((google as HTMLButtonElement).disabled).toBe(true);
  });

  it('l age annonce est celui du domaine, jamais un nombre recopie', () => {
    // Meme procede que les motifs de `/regles` : changer `MINIMUM_AGE` sans changer le
    // texte publie serait annoncer une regle qu'on n'applique pas.
    renderIn();
    expect(screen.getByText(new RegExp(`${MINIMUM_AGE}`))).toBeDefined();
  });

  it('⚠️ le champ de code n apparait qu apres l envoi', () => {
    // Avant l'envoi il n'y a aucun code a saisir : le montrer ferait croire qu'on en
    // attend un, et c'est le genre de champ ou les gens collent leur mot de passe.
    renderIn();
    expect(screen.queryByRole('button', { name: /check the code/i })).toBeNull();
  });
});

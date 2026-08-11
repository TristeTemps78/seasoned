import { fireEvent, render, screen } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it } from 'vitest';

import { ReviewBody } from '@/app/components/ReviewBody';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';

/**
 * Le corps d'une critique, teste sur ce qu'il **cache**.
 *
 * Ce composant est partage par la page de profil et par le fil, et c'est le seul morceau
 * commun aux deux — parce que c'est le seul dont une divergence ne se verrait pas a l'oeil :
 * elle se verrait en spoilant quelqu'un.
 */

function show(options: { readonly hidden: boolean; readonly throughSeason: number }) {
  render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <ReviewBody
        hidden={options.hidden}
        text="Le pere de Jon Snow est revele a la saison 6."
        hiddenText="Un texte qui va jusqu'a la saison 6."
        throughSeason={options.throughSeason}
      />
    </LocaleProvider>,
  );
}

describe('quand le domaine a tranche « visible »', () => {
  it('rend le texte, sans rien demander', () => {
    show({ hidden: false, throughSeason: 0 });
    expect(screen.getByText(/Le pere de Jon Snow/)).toBeTruthy();
  });
});

describe('quand le domaine a tranche « masque »', () => {
  it('🔴 ne rend PAS le texte, meme cache dans le DOM', () => {
    show({ hidden: true, throughSeason: 6 });
    // ⚠️ `queryByText` et non un test de visibilite CSS : un texte present dans le HTML
    // mais masque par une classe **a deja fuite** — il est dans la source de la page, dans
    // le cache du navigateur, et dans ce que lit un lecteur d'ecran.
    expect(screen.queryByText(/Le pere de Jon Snow/)).toBeNull();
  });

  it('dit jusqu ou le texte va, et propose de l ouvrir', () => {
    show({ hidden: true, throughSeason: 6 });
    expect(screen.getByRole('button')).toBeTruthy();
    expect(document.body.textContent).toContain('6');
  });

  /**
   * ⚠️ Apres le clic, c'est le texte **de repli** qui s'affiche, pas le texte entier — et
   * c'est la toute la mecanique : « afficher quand meme » ouvre ce que le domaine a juge
   * montrable, il ne desactive pas le caviardage. Un composant qui rendrait `text` ici
   * annulerait `redactReviews` d'un seul clic.
   */
  it('revele le texte de repli, et jamais le texte entier', async () => {
    show({ hidden: true, throughSeason: 6 });
    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/Un texte qui va jusqu/)).toBeTruthy();
    expect(screen.queryByText(/Le pere de Jon Snow/)).toBeNull();
  });
});



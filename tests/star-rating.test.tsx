import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from '@/app/components/StarRating';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n';
import type { Stars } from '@/src/domain/types';

/**
 * Le premier test de composant du projet.
 *
 * Il porte sur `StarRating` et pas sur un autre parce que c'est **le geste le plus
 * frequent du produit** : `docs/RATING-MODEL.md` §5 pose que noter une saison doit couter
 * un tap, la saisie manuelle etant la cause n°1 d'abandon des trackers. Un composant
 * qu'on utilise dix fois par session et qu'aucun test ne couvre est le pire rapport
 * risque / frequence du depot.
 *
 * Ce qui est verifie ici est ce qu'aucun typage ne peut voir : **la moitie gauche d'une
 * etoile pose le demi-cran**. C'est une regle de geometrie exprimee en classes CSS
 * (`left-0` / `right-0`), donc invisible au compilateur, et fausse silencieusement si
 * quelqu'un inverse l'ordre du tableau.
 *
 * ⚠️ **jsdom ne calcule aucune mise en page** : on ne peut pas cliquer « a gauche de »
 * quoi que ce soit. La classe est donc verifiee telle quelle. C'est du test
 * d'implementation, assume ici pour une raison precise : cette classe **est** le
 * comportement, et l'inversion qu'elle protege ne se voit ni au typage, ni a la lecture
 * du diff, ni sur une capture d'ecran — seulement au doigt, sur un telephone.
 */
describe('StarRating', () => {
  function setup(value?: Stars, locale: Locale = 'fr') {
    const onChange = vi.fn();
    render(
      <LocaleProvider locale={locale}>
        <StarRating value={value} onChange={onChange} label="la saison 3" />
      </LocaleProvider>,
    );
    return { onChange };
  }

  it('offre les dix demi-crans, et pas cinq', () => {
    setup();
    // Dix et non cinq : c'est toute la difference entre une echelle en demi-etoiles et
    // une echelle entiere. `RATING-MODEL.md` §4 fait reposer la granularite dessus.
    expect(screen.getAllByRole('radio')).toHaveLength(10);
  });

  it('nomme chaque cran pour un lecteur d’ecran', () => {
    setup();
    // Sans etiquette, une rangee d'icones est un mur pour qui n'a pas de souris.
    expect(screen.getByRole('radio', { name: '2,5 sur 5' })).toBeDefined();
    expect(screen.getByRole('radio', { name: '5 sur 5' })).toBeDefined();
  });

  it('la moitie gauche de la troisieme etoile vaut 2,5', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('radio', { name: '2,5 sur 5' }));
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('place le demi-cran a gauche et le cran plein a droite', () => {
    setup();
    // Inverser ces deux classes donnerait un composant qui rend juste, teste juste, et
    // dans lequel poser 3 etoiles en donne 2,5. Personne ne le verrait avant un usage
    // reel — donc ici, et pas ailleurs.
    expect(screen.getByRole('radio', { name: '2,5 sur 5' }).className).toContain('left-0');
    expect(screen.getByRole('radio', { name: '3 sur 5' }).className).toContain('right-0');
  });

  it('marque la note posee, et elle seule', () => {
    setup(3.5);
    const checked = screen
      .getAllByRole('radio')
      .filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]?.getAttribute('aria-label')).toBe('3,5 sur 5');
  });

  it('re-cliquer la note posee la retire', () => {
    // Sans cela une note donnee par erreur ne peut plus etre reprise — et une donnee
    // fausse qu'on ne peut pas corriger est pire qu'une donnee absente.
    const { onChange } = setup(4);
    fireEvent.click(screen.getByRole('radio', { name: '4 sur 5' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('affiche la valeur en clair, avec la virgule francaise', () => {
    setup(4.5);
    expect(screen.getByText('4,5')).toBeDefined();
  });

  it('n’affiche aucun chiffre tant que rien n’est note', () => {
    setup();
    expect(screen.getByText('—')).toBeDefined();
  });

  it('ecrit le nombre comme l’ecrit la langue de la page', () => {
    // `4.5` avec un point se lit « quarante-cinq » a un francophone, et `4,5` avec une
    // virgule se lit « quatre mille cinq cents » a un anglophone. Le code ecrivait la
    // virgule **en dur** — une note francaise sur une page anglaise.
    setup(4.5, 'en');
    expect(screen.getByText('4.5')).toBeDefined();
    expect(screen.getByRole('radio', { name: '2.5 out of 5' })).toBeDefined();
  });
});

import { render, screen } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it, vi } from 'vitest';
import { Faces } from '@/app/components/Faces';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n';

/**
 * La barre de faces.
 *
 * Ce qu'aucun test pur ne peut voir : que les liens **restent dans la langue de la page**.
 * C'est la forme d'echec la plus repetee de ce projet — le francais a eu une adresse
 * pendant une session entiere sans qu'aucun chemin n'y reste, parce que les liens etaient
 * ecrits en dur.
 */

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

function renderFaces(locale: Locale, at: string) {
  pathname.current = at;
  render(
    <LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
      <Faces locale={locale} />
    </LocaleProvider>,
  );
}

describe('les faces restent dans la langue de la page', () => {
  it('prefixe tous les liens en francais', () => {
    renderFaces('fr', '/fr');
    for (const [name, href] of [
      ['Découvrir', '/fr'],
      ['Ma bibliothèque', '/fr/moi'],
      ['Calendrier', '/fr/calendrier'],
      ['Mon bilan', '/fr/bilan'],
    ] as const) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
  });

  it('ne prefixe rien en anglais', () => {
    // L'anglais n'a pas de prefixe : prefixer casserait les URL deja indexees
    // (`lib/routes.ts`).
    renderFaces('en', '/');
    expect(screen.getByRole('link', { name: 'Calendar' }).getAttribute('href')).toBe(
      '/calendrier',
    );
    expect(screen.getByRole('link', { name: 'Discover' }).getAttribute('href')).toBe('/');
  });
});

describe('la face courante est designee, et une seule', () => {
  it('marque la face ou l on se trouve', () => {
    renderFaces('fr', '/fr/calendrier');
    expect(
      screen.getByRole('link', { name: 'Calendrier' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('⚠️ la racine ne s allume pas sur les autres faces', () => {
    // Le piege du `startsWith` : `/fr` prefixe `/fr/moi`, `/fr/bilan` et tout le reste.
    // Ecrit ainsi, « Decouvrir » resterait allume partout et la barre cesserait de dire
    // ou l'on est.
    renderFaces('fr', '/fr/bilan');
    const current = screen.getAllByRole('link').filter(
      (link) => link.getAttribute('aria-current') === 'page',
    );
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('Mon bilan');
  });

  it('aucune face n est marquee sur une page qui n en est pas une', () => {
    // `/convertir` est une porte d'entree indexable, pas une piece : la barre ne doit
    // pas pretendre qu'on est quelque part.
    renderFaces('fr', '/fr/convertir');
    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0);
  });
});

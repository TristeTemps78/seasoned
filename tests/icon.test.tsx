import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ICON_NAMES, Icon } from '@/app/components/Icon';

/**
 * Ce qu'une icone peut rater sans que rien ne le voie.
 *
 * Un SVG mal forme **ne casse rien** : il rend un blanc de la bonne taille, au bon endroit,
 * dans la bonne couleur. Le typage est vert, le montage est vert, la page s'affiche. C'est
 * exactement la forme de defaut que ce depot attrape ailleurs par une regle plutot que par
 * une relecture — d'ou ce fichier.
 */

it('les douze icones rendent un trace non vide', () => {
  for (const name of ICON_NAMES) {
    const { container, unmount } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg, name).not.toBeNull();

    // ⚠️ Le vrai defaut vise : un `<svg>` present et **sans enfant**, qui occupe sa place sans
    // rien dessiner. C'est ce qu'un caractere parasite dans un `d=` produit.
    expect(svg?.childElementCount ?? 0, name).toBeGreaterThan(0);
    unmount();
  }
});

it('aucun attribut de trace n est vide ou malforme', () => {
  for (const name of ICON_NAMES) {
    const { container, unmount } = render(<Icon name={name} />);
    for (const path of container.querySelectorAll('path')) {
      const d = path.getAttribute('d') ?? '';
      expect(d.length, `${name} : trace vide`).toBeGreaterThan(0);
      // Un `d` ne contient que des commandes, des nombres, des virgules et des espaces. Tout
      // le reste est une faute de frappe qui rend le chemin muet a partir de ce point.
      expect(d, `${name} : caractere illegal dans le trace`).toMatch(
        /^[MmLlHhVvCcSsQqTtAaZz0-9,.\-\s]+$/,
      );
    }
    unmount();
  }
});

it('elles sont muettes pour les lecteurs d ecran', () => {
  // Les douze accompagnent un libelle ecrit a cote : une icone qui s'annonce ferait entendre
  // la meme chose deux fois.
  for (const name of ICON_NAMES) {
    const { container, unmount } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden'), name).toBe('true');
    expect(svg?.getAttribute('focusable'), name).toBe('false');
    unmount();
  }
});

it('la classe de dimension est toujours posee, avec ou sans surcharge', () => {
  // `.icon` porte la taille relative au texte. Une surcharge qui l'ecraserait rendrait une
  // icone de 0 px — visible nulle part, et pas davantage dans un test qui ne regarderait que
  // la presence du SVG.
  const { container } = render(<Icon name="check" className="text-(--color-volt)" />);
  const svg = container.querySelector('svg');
  expect(svg?.getAttribute('class')).toContain('icon');
  expect(svg?.getAttribute('class')).toContain('text-(--color-volt)');
});

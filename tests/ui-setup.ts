import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * Ce qu'un navigateur fournit et que `jsdom` ne fournit pas.
 *
 * La regle est **de ne combler que ce que le produit utilise vraiment**. Un bouchon
 * ecrit « au cas ou » fait passer des tests sur une plateforme qui n'existe nulle part :
 * c'est la meme faute que la fixture ecrite de memoire, transposee au
 * navigateur.
 */

// `matchMedia` : lu par le manifeste PWA (`display-mode: standalone`) pour savoir si
// l'application est deja installee — c'est la condition qui fait **taire** le bandeau de
// securite des donnees. Sans bouchon, jsdom leve, et le composant ne rendrait jamais.
if (globalThis.matchMedia === undefined) {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  // Chaque test part d'un journal vide. Sans cela, l'ordre d'execution devient une
  // entree du test : celui qui ecrit une note la laisse au suivant, et le suivant passe
  // ou echoue selon qui a tourne avant lui.
  globalThis.localStorage?.clear();
});

// `cleanup` demonte ce que le test a rendu. Omis, les arbres s'empilent dans le meme
// `document` et `getByRole` trouve deux boutons la ou le test en attend un.
afterEach(cleanup);

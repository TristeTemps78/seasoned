import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Deux projets, et c'est le sujet de ce fichier.
 *
 * ## Pourquoi le domaine ne tourne pas dans un DOM
 *
 * Il serait plus court de mettre `environment: 'jsdom'` partout et de n'y plus penser.
 * Ce serait renoncer a une garantie : `AGENTS.md` regle 2 pose que **le domaine est
 * pur** — il n'importe rien, ne touche ni le reseau ni l'horloge. Un `document` global
 * disponible pendant ses tests rendrait une violation de cette regle **invisible** :
 * le jour ou un module de `src/domain/` lirait `window`, le test passerait quand meme,
 * et la casse n'apparaitrait qu'au premier appel serveur.
 *
 * Faire tourner le domaine sous `node` fait de cette regle une **verite executee** et
 * non un commentaire. Le cout d'un DOM sur toute la suite est accessoire — elle tourne en
 * cinq secondes ; la garantie, elle, ne se rachete pas. (Ce commentaire annoncait « 306
 * tests » : un chiffre dans un commentaire perime le jour ou on l'ecrit.)
 *
 * ## Ce que le second projet repare
 *
 * Seize modules `'use client'` etaient livres **sans un seul test** — toute la couche des
 * gestes, celle qui ecrit dans le journal. La cause n'etait pas la negligence : la
 * configuration precedente fixait `include: ['tests/**\/*.test.ts']`, donc un fichier
 * `.test.tsx` **n'aurait tout simplement pas ete execute**. On aurait pu en ecrire dix
 * sans que rien ne le signale : c'est la forme d'echec la plus chere de ce projet, celle
 * ou le dispositif est en place et l'effet nul.
 */
export default defineConfig({
  resolve: {
    // Meme alias que `tsconfig.json` : les tests doivent resoudre les imports
    // exactement comme le bundler, sinon ils valident un graphe qui n'existe pas.
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['tests/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/ui-setup.ts'],
        },
      },
    ],
  },
});

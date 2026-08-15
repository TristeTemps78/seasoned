import { describe, expect, it } from 'vitest';
import { codeIn, styleSheet } from './sources';

/**
 * La cible tactile d'un bouton — **la regle du 2026-08-13, et ce qui l'annulait**.
 *
 * ## 🔴 Ce que la mesure a trouve le 2026-08-16
 *
 * Sur `/fr/amis` en 375 px : « Ouvrir un compte » (`.btn btn-primary`) rendait **42 px** de
 * haut, « Chercher une serie » juste en dessous (`.btn`) **44**. Le bouton principal etait
 * le plus petit des deux, sur la page dont l'objet entier est d'ouvrir un compte.
 *
 * La cause n'etait ni la specificite ni une faute de frappe : `.btn` porte sa hauteur de
 * telephone dans un `@media (width < 40rem)`, et `.btn-primary` redeclare `min-height`
 * **plus bas dans le fichier**, a specificite egale. L'ordre source tranche, et la surcharge
 * mesuree est perdue en silence.
 *
 * ## Pourquoi aucune garde ne pouvait le voir
 *
 * 42 px passe WCAG 2.5.8 (24 px), donc `a11y-hidden-controls` et le reste n'avaient rien a
 * dire. Ce qui etait faux n'etait pas la norme, c'etait **la regle que le depot s'est
 * donnee** — et une regle qu'on se donne n'a de valeur que si quelque chose la relit.
 *
 * ⚠️ Ce test lit la **feuille servie** et non un rendu : jsdom ne compose pas les media
 * queries, et une assertion sur un `getComputedStyle` y serait verte quoi qu'il arrive.
 * C'est la meme mecanique que `contrast.test.ts`, et pour la meme raison.
 */

const SHEET = codeIn(styleSheet());

/**
 * Les blocs `@media (width < 40rem)` de la feuille, decoupes aux accolades.
 *
 * ⚠️ **Il y en a trois** — les boutons, le menu, la grille d'episodes — et une premiere
 * version de ce test lisait « le premier » sur 400 caracteres. Elle passait au vert, et elle
 * aurait continue si quelqu'un avait reordonne les `@import` de `globals.css` : elle aurait
 * alors verifie la cible tactile des boutons **dans le bloc de la grille**. Un test qui
 * regarde au mauvais endroit est plus dangereux qu'une absence de test, parce qu'il repond.
 */
function phoneBlocks(): readonly string[] {
  const blocks: string[] = [];
  const needle = '@media (width < 40rem)';
  for (let at = SHEET.indexOf(needle); at !== -1; at = SHEET.indexOf(needle, at + 1)) {
    const open = SHEET.indexOf('{', at);
    if (open === -1) continue;
    let depth = 0;
    for (let i = open; i < SHEET.length; i++) {
      if (SHEET[i] === '{') depth += 1;
      else if (SHEET[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(SHEET.slice(open, i + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

/** Le bloc qui porte la hauteur des boutons, trouve par son contenu et non par son rang. */
function buttonBlock(): string {
  const found = phoneBlocks().filter((block) => /(^|[\s,{])\.btn[\s,{]/.test(block));
  expect(found, 'la hauteur de bouton sur telephone a disparu de la feuille').toHaveLength(1);
  return found[0] ?? '';
}

describe('la hauteur de bouton sur un telephone', () => {
  it('les deux boutons atteignent 44 px', () => {
    const block = buttonBlock();
    expect(block).toContain('.btn-primary');
    expect(block).toContain('2.75rem');
  });

  it('🔴 et le bloc vient APRES la regle qu il surcharge', () => {
    // ⚠️ **C'est ce test-la qui compte, et l'autre seul etait vert sur un correctif faux.**
    // Elargir le selecteur ne suffit pas : une media query n'ajoute aucune specificite, donc
    // tant que `.btn-primary { min-height: var(--control-height) }` est declaree **plus bas**,
    // elle gagne par ordre source. Mesure au navigateur avec le premier « correctif » en
    // place : le bouton rendait toujours 42 px.
    //
    // L'invariant n'est donc pas une valeur, c'est une **position**. Il ne se lit pas dans un
    // rendu — jsdom n'a pas de moteur de cascade — mais il se lit dans la feuille.
    const declaration = SHEET.indexOf('min-height: var(--control-height)');
    expect(declaration, 'la hauteur du bouton principal ne vient plus du jeton').toBeGreaterThan(-1);
    expect(SHEET.indexOf(buttonBlock())).toBeGreaterThan(declaration);
  });

  it('le jeton reste la hauteur du bureau', () => {
    // 42 px et c'est juste : *« un bouton de 44 px de haut a la souris est simplement gros »*.
    // Le passer a 44 partout aurait supprime la distinction que le brief demande, au lieu de
    // corriger la cascade.
    expect(SHEET).toMatch(/--control-height:\s*42px/);
  });
});

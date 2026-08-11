import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT, codeOf, filesUnder, pathOf, styleSheet } from './sources';

/**
 * La voix editoriale — deux emplois, et pas un de plus (2026-08-11).
 *
 * ## Ce que ce fichier protege
 *
 * Un serif est ce qui separe un magazine d'un tableau de bord ; **un serif partout** est ce
 * qui separe un blog d'un produit. La regle n'est donc pas « on a un serif », c'est « on a un
 * serif a deux endroits precis » — et c'est exactement le genre de regle qu'un ecran neuf
 * defait sans le vouloir, en trouvant que ca rend bien sur son titre a lui.
 *
 * Aucun typage, aucun build et aucun montage ne verrait la derive : une interface en serif
 * s'affiche parfaitement.
 */

const CSS = styleSheet();

/** Les trois seuls crans autorises a porter `--font-serif`. */
const AUTORISES = ['.hero-title', '.review-prose', '.empty-state-title'] as const;

it('la police existe reellement, et son poids reste tenable', () => {
  // Une declaration `next/font/local` qui pointe un fichier absent casse le build — mais un
  // fichier **remplace** par une version complete ne casse rien et triple le paquet. Le
  // sous-ensemble latin variable pese 58 Ko ; l'axe optique complet en pesait 132.
  const octets = statSync(
    join(ROOT, 'app', 'fonts', 'Newsreader-Variable-latin.woff2'),
  ).size;
  expect(octets).toBeGreaterThan(20_000);
  expect(octets, 'le sous-ensemble a grossi — axe optique reintroduit ?').toBeLessThan(70_000);
});

it('elle est branchee sur le html, sinon la variable ne vaut rien', () => {
  // ⚠️ Le defaut vise : `fonts.ts` declare la police, `globals.css` la reference, et personne
  // ne pose la classe sur `<html>`. Tout est vert, et le site rend Georgia partout.
  const chrome = readFileSync(join(ROOT, 'app', 'components', 'SiteChrome.tsx'), 'utf8');
  expect(chrome).toContain('newsreader.variable');
  expect(CSS).toContain('--font-voltface-serif');
});

it('seuls trois crans portent le serif', () => {
  // On lit les blocs de declaration qui posent `font-family: var(--font-serif)`, et on verifie
  // que le selecteur qui les ouvre est l'un des deux autorises.
  const blocs = [...CSS.matchAll(/([^{}]+)\{([^{}]*font-family:\s*var\(--font-serif\)[^{}]*)\}/g)];

  // D'abord : il y en a bien, sinon ce test passe pour la pire des raisons.
  expect(blocs.length, 'aucun emploi du serif — la voix editoriale a disparu').toBe(3);

  for (const [, selecteur] of blocs) {
    const nom = (selecteur ?? '').trim().split(/\s+/).pop() ?? '';
    expect(AUTORISES, `${nom} ne devrait pas porter le serif`).toContain(nom);
  }
});

it('aucun composant ne rappelle le serif a la main', () => {
  // L'echappatoire de qui est presse : `style={{ fontFamily: … }}` ou `font-serif` de
  // Tailwind, qui contournent les deux crans sans toucher a la feuille.
  const fautes = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .flatMap((file) => {
      const code = codeOf(file);
      return /\bfont-serif\b|fontFamily/.test(code) ? [pathOf(file)] : [];
    });
  expect(fautes).toEqual([]);
});

it('l affiche est un objet, pas un rectangle', () => {
  // Les trois proprietes qui font la difference entre une vignette posee sur la page et un
  // trou decoupe dedans. ⚠️ L'anneau doit vivre sur un pseudo-element : en `box-shadow: inset`
  // sur le cadre, il se peindrait **sous** l'image et ne rendrait rien du tout.
  expect(CSS).toMatch(/\.poster-frame::after\s*\{[^}]*box-shadow:\s*inset/);
  expect(CSS).toMatch(/\.poster-frame\s*\{[^}]*transform|\.poster-frame:hover/);
  expect(CSS).toContain('--ease-out-expo');
});

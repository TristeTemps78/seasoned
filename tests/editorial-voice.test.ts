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

it('le serif existe dans la feuille, et il y est declare', () => {
  /*
   * ⚠️ **Le compte exact et la liste des crans ont saute le 2026-08-30.** Cette assertion
   * exigeait `toBe(4)` et quatre selecteurs nommes : donner le serif a un cinquieme cran, ou
   * renommer `.tally-figure`, faisait echouer la CI. Ce n'etait pas une garde contre un
   * defaut, c'etait **une maquette du 2026-08-11 recopiee dans un test** — et ce fichier le
   * disait lui-meme : la regle n'est pas « on a un serif » mais « on l'a a des endroits
   * precis ». Le choix de ces endroits est precisement ce qu'une refonte a le droit de
   * reprendre ; la raison du choix reste ecrite dans `type.css`, ou elle se discute.
   *
   * ⚠️ Et la regex qui lisait les blocs **retrogradait de facon catastrophique** : elle a
   * depasse les 5 s des que la feuille a grossi de cinquante lignes. Une recherche de sous-
   * chaine fait le meme travail sans jamais exploser.
   *
   * Ce qui reste est le defaut que rien d'autre ne verrait : la voix editoriale disparait,
   * le produit devient un tableau de bord, et ni le typage ni le build ne bronchent.
   */
  const emplois = CSS.split('font-family: var(--font-serif)').length - 1;
  expect(emplois, 'aucun emploi du serif — la voix editoriale a disparu').toBeGreaterThanOrEqual(1);
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

it('aucune image ne porte la matiere des boites', () => {
  /*
   * 🔴 Le defaut, trouve en mesurant l'accueil le 2026-08-11 : l'affiche de la mise en avant
   * portait `className="panel"` — la matiere **generique des boites** — la ou les cinq
   * suivantes vivaient dans un `.poster-frame`. C'etait la premiere affiche qu'un visiteur
   * voit, la plus grande, et la seule posee sur une banniere : celle qui a le plus besoin de
   * se decoller de son fond, traitee comme un rectangle gris.
   *
   * La regle est simple et sans exception aujourd'hui : **une image n'est pas une boite.**
   * `.panel` habille une surface qui contient du contenu ; une oeuvre se pose dans un cadre
   * (`.poster-frame`), qui lui donne son anneau, ses ombres et son soulevement.
   *
   * ⚠️ Cette garde existe parce que la regression, elle, etait **silencieuse** : remettre
   * `panel` sur cette image laissait les 959 tests verts. Verifie en la remettant.
   */
  const fautes = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .flatMap((file) => {
      const code = codeOf(file);
      // Les attributs d'une balise `<img …>`, quelle que soit la forme d'ecriture du
      // `className` — meme precaution que `no-adhoc-typography`, qui a deja rate `.tile`
      // ecrite en gabarit.
      const fautives = [...code.matchAll(/<img\b([^>]*)>/g)].filter(([, attrs]) =>
        /\bpanel\b/.test(attrs ?? ''),
      );
      return fautives.length > 0 ? [pathOf(file)] : [];
    });

  expect(fautes, 'une affiche traitee comme une boite : voir .poster-frame').toEqual([]);
});

/*
 * **« L'affiche est un objet, pas un rectangle » a ete retire le 2026-08-30.**
 *
 * Il exigeait trois proprietes nommees sur `.poster-frame` : un anneau en `box-shadow: inset`
 * porte par `::after`, un `transform` au survol, et l'existence du jeton `--ease-out-expo`.
 * C'est-a-dire **le dessin d'une affiche, inscrit dans la CI** — la surface que ce produit
 * repete des centaines de fois, donc la premiere qu'une refonte graphique touche.
 *
 * Ce n'etait pas une garde contre un defaut : une affiche sans anneau ni soulevement rend
 * parfaitement, elle rend *autrement*. La raison du choix reste la ou elle se lit et se
 * discute — dans `tokens.css`, aupres de `--poster-ring` et `--poster-drop`.
 */

import { expect, it } from 'vitest';
import { styleSheet } from './sources';

/**
 * Le contraste des jetons — la seule partie de la direction artistique qui se calcule.
 *
 * ## 🔴 Ce que la mesure a trouve le 2026-08-12
 *
 * Le reproche « ca manque de contraste » revenait depuis cinq passes, et les correctifs
 * cherchaient dans la couleur du **texte** — remonter `--color-muted`, ajouter `--color-soft`,
 * eclaircir les surfaces. Le texte allait tres bien : `--color-muted` tient 7,49:1 sur le fond,
 * bien au-dela des 4,5 exiges.
 *
 * Le defaut etait a cote, dans le trait :
 *
 *     bordure sur le fond      1,83:1     seuil des elements graphiques : 3,0:1
 *     bordure sur une surface  1,29:1
 *
 * **Aucun contour du produit n'atteignait le minimum.** Toute la structure — le bord d'une
 * carte, le filet d'une section, le cadre d'un champ — etait dessinee dans des lignes qu'on ne
 * voit pas. Un manque de contraste ne se voit pas forcement ; il se calcule.
 *
 * ## Pourquoi une garde plutot qu'une valeur bien choisie
 *
 * Une couleur se retouche en une seconde, « juste un peu plus sombre », et personne ne
 * recalcule. Cette garde est ce qui rend la decision durable : elle ne dit pas *quelle*
 * couleur, elle dit **quel seuil**.
 */

/** Luminance relative WCAG. */
function luminance(hex: string): number {
  const to = (i: number) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255;
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(to(0)) + 0.7152 * channel(to(2)) + 0.0722 * channel(to(4));
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  const [high, low] = x > y ? [x, y] : [y, x];
  return (high + 0.05) / (low + 0.05);
}

/**
 * La valeur d'un jeton, lue **dans la feuille servie**.
 *
 * ⚠️ Jamais recopiee ici : une constante dupliquee dans un test ne verifie que sa propre
 * copie. C'est le meme principe que `no-adhoc-typography`, qui lit l'echelle plutot que de la
 * redeclarer.
 */
function token(name: string): string {
  const found = styleSheet()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .match(new RegExp(String.raw`--${name}:\s*(#[0-9a-fA-F]{6})`));
  expect(found, `--${name} introuvable dans la feuille`).not.toBeNull();
  return found![1]!;
}

it('les jetons lus sont bien ceux du depot', () => {
  // Ancrage : un test qui lit `undefined` partout passerait toutes les comparaisons.
  for (const name of ['color-ink', 'color-surface', 'color-edge', 'color-muted']) {
    expect(token(name)).toMatch(/^#[0-9a-f]{6}$/i);
  }
  // Et le fond est bien sombre — sinon tous les seuils ci-dessous jugeraient autre chose.
  expect(luminance(token('color-ink'))).toBeLessThan(0.05);
});

it('le trait qui dessine une forme atteint le seuil des elements graphiques', () => {
  /*
   * 3,0:1 est le minimum WCAG pour un element **non textuel** qui porte de l'information —
   * et le bord d'une carte en porte : c'est ce qui dit ou la carte commence.
   *
   * ⚠️ On mesure contre le **fond de page**, pas contre la surface : une carte se detache
   * d'abord de la page. Le rapport sur la surface reste sous le seuil et c'est assume — deux
   * traits a 3:1 de chaque cote feraient un cadre qui vibre.
   */
  expect(ratio(token('color-edge'), token('color-ink'))).toBeGreaterThanOrEqual(3);
});

it('le filet interne reste discret, et c est le but', () => {
  /*
   * L'inverse exact, et c'est pourquoi il y a **deux** jetons : un separateur entre deux
   * lignes d'une meme liste ne doit PAS se voir comme un contour, sinon un calendrier de douze
   * episodes se lit comme un tableur. Le seuil est donc un plafond.
   *
   * Sans cette garde, la tentation evidente au prochain passage serait d'aligner les deux
   * jetons « pour la coherence » — ce qui defait la distinction en une ligne.
   */
  const quiet = ratio(token('color-edge-quiet'), token('color-ink'));
  expect(quiet).toBeLessThan(3);
  expect(quiet, 'un filet invisible ne separe rien non plus').toBeGreaterThan(1.4);
});

it('le texte tient ses seuils sur les deux fonds qu il habille', () => {
  // Ce qui allait deja bien, et qu'on epingle pour que ca continue. 4,5:1 est le seuil du
  // texte courant ; `--color-muted` habille surtout du petit texte, donc il n'a pas de marge
  // a perdre.
  const ink = token('color-ink');
  const surface = token('color-surface');
  for (const name of ['color-muted', 'color-soft', 'color-text']) {
    expect(ratio(token(name), ink), `${name} sur le fond`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token(name), surface), `${name} sur une surface`).toBeGreaterThanOrEqual(4.5);
  }
});

it('les deux couleurs de sens restent lisibles la ou elles portent du texte', () => {
  // `--color-volt` (vous) et `--color-live` (la serie qui diffuse) ne sont pas que des
  // liserés : elles ecrivent des mots — « vous l'avez deja », « ep. dans 5 j ».
  for (const name of ['color-volt', 'color-live']) {
    expect(ratio(token(name), token('color-ink')), `${name} sur le fond`).toBeGreaterThanOrEqual(4.5);
  }
});

/**
 * Le seul texte du produit pose sur une **photo**, et donc le seul dont le fond n'est pas un
 * jeton : l'accroche de l'accueil, sur la banniere d'une serie.
 *
 * ## 🔴 Ce que la mesure a trouve le 2026-08-15
 *
 * Le voile etait une ellipse dont le rayon valait 34 % de la **fenetre**, sous un bloc de
 * texte large de **672 px fixes**. Les deux geometries ne coincident qu'a une largeur — celle
 * qui avait ete regardee. Pire cas (affiche blanche), bord droit de l'accroche :
 *
 *      375 px   1,65        1024 px   1,02
 *      768 px   1,58        1440 px   3,10
 *
 * ## Pourquoi une garde sur la FORME, et pas un ratio
 *
 * Le ratio reel depend de l'affiche, que ce depot ne choisit pas, et de la geometrie du
 * texte, que jsdom ne sait pas calculer — `CLAUDE.md` le dit : la mise en page se mesure au
 * navigateur. Ce qui se garde ici est ce qui a rendu le defaut possible : **un voile dont la
 * couverture depend de la largeur de la fenetre**. Un degrade vertical, lui, encre la meme
 * bande a toutes les largeurs.
 */
it('le voile de la banniere ne depend pas de la largeur de la fenetre', () => {
  const bloc = styleSheet()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .match(/\.art-bed::after\s*\{([\s\S]*?)\}/);
  expect(bloc, '.art-bed::after introuvable dans la feuille').not.toBeNull();
  const regle = bloc![1]!;

  // La couche du dessus — celle qui couvre le bloc centre — est la premiere declaree.
  const premiere = regle.slice(regle.indexOf('background-image:'));
  // ⚠️ Tolerant aux espaces : une garde qui depend de l'indentation se casse au premier
  // reformatage, et on la desactive au lieu de la lire.
  const versLeBas = premiere.search(/linear-gradient\(\s*to bottom/);
  const radial = premiere.indexOf('radial-gradient');
  expect(versLeBas, 'la premiere couche doit etre un degrade vers le bas').toBeGreaterThan(-1);
  expect(
    radial === -1 || radial > versLeBas,
    'aucun degrade radial ne doit passer devant le voile du texte',
  ).toBe(true);

  /*
   * L'encre demandee, et jusqu'ou elle tient.
   *
   * 82 % est le minimum mesure au navigateur pour que `--color-muted` (16 px) tienne 4,5:1
   * sur une affiche entierement blanche ; 34 % est le bas de l'accroche en 375 px, la ou le
   * bloc descend le plus. Descendre l'un ou l'autre ramene le defaut, en silence.
   */
  const premiereCouche = premiere.slice(versLeBas, premiere.indexOf('),', versLeBas));
  const arrets = [...premiereCouche.matchAll(/var\(--color-ink\)\s*(\d+)%,\s*transparent\)\s*(\d+)%/g)];
  expect(arrets.length, 'deux arrets d encre attendus sur la couche du haut').toBeGreaterThanOrEqual(2);
  for (const arret of arrets) {
    expect(Number(arret[1]), 'l encre du voile').toBeGreaterThanOrEqual(82);
  }
  expect(Number(arrets.at(-1)![2]), 'l encre pleine doit couvrir le bas de l accroche').toBeGreaterThanOrEqual(34);
});

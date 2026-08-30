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
    .match(new RegExp(String.raw`--${name}:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))`));
  expect(found, `--${name} introuvable dans la feuille`).not.toBeNull();
  return normalise(found![1]!);
}

/**
 * Ramene une couleur a `#rrggbb`.
 *
 * ⚠️ **Trois notations et pas une seule**, depuis le 2026-08-30 : la version precedente
 * n'acceptait que `#rrggbb`, ce qui n'etait pas une exigence de contraste mais une exigence
 * de **syntaxe** — une palette ecrite en `rgb()` faisait tomber la garde sans qu'aucun texte
 * ne devienne illisible. Un seuil doit juger ce qu'il annonce.
 *
 * Ce qu'il reste comme limite est dit plutot que subi : `oklch()` et `color-mix()` ne sont pas
 * convertis ici, et un jeton ecrit ainsi fera echouer la lecture avec son nom — pas passer.
 */
function normalise(valeur: string): string {
  if (valeur.startsWith('#')) {
    const brut = valeur.slice(1);
    if (brut.length === 3) return '#' + [...brut].map((c) => c + c).join('');
    return '#' + brut.slice(0, 6);
  }
  const parts = valeur
    .replace(/rgba?\(|\)/g, '')
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))));
  return '#' + parts.map((n) => n.toString(16).padStart(2, '0')).join('');
}

it('les jetons lus sont bien ceux du depot', () => {
  // Ancrage : un test qui lit `undefined` partout passerait toutes les comparaisons.
  for (const name of ['color-ink', 'color-surface', 'color-edge', 'color-muted']) {
    expect(token(name)).toMatch(/^#[0-9a-f]{6}$/i);
  }
  // ⚠️ **Le fond n'a plus a etre sombre** (2026-08-30). Cette ligne exigeait une luminance
  // sous 0.05 : ce n'etait pas un seuil d'accessibilite, c'etait un theme sombre inscrit dans
  // la CI. Une refonte claire aurait echoue ici **sans qu'un seul texte devienne illisible**,
  // et les seuils ci-dessous — qui, eux, comparent des paires — jugent aussi bien dans les
  // deux sens. Ce qu'il faut ancrer est qu'on lit deux couleurs differentes, pas laquelle.
  expect(ratio(token('color-ink'), token('color-surface'))).toBeGreaterThan(1.05);
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
   * L'encre demandee, et jusqu'ou elle tient — **deux jeux, un par regime**.
   *
   * Mesure au navigateur le 2026-08-15, pire cas (affiche blanche), bord droit de
   * l'accroche en `--color-muted` 16 px, seuil 4,5 :
   *
   *      375 px   encre 0,85   accroche 5,27   titre 10,61
   *     1023 px   encre 0,85   accroche 5,80   titre 11,67   (dernier du regime etroit)
   *     1024 px   encre 0,78   accroche 4,92   titre  9,90   (pire cas du regime large)
   *     1440 px   encre 0,78   accroche 5,48   titre 11,03
   *
   * Les planchers sont sous ces valeurs, pas dessus : ils disent ce qui casse, pas ce qui
   * est joli. 75 / 28 pour le regime large, ou l'encre laterale aide ; 82 / 34 pour l'etroit,
   * ou le voile tient seul et ou l'accroche descend a 35 %.
   */
  const veils = (nom: string): number[] =>
    [...styleSheet().replace(/\/\*[\s\S]*?\*\//g, '').matchAll(new RegExp(String.raw`--${nom}:\s*(\d+)%`, 'g'))]
      .map((m) => Number(m[1]));

  const encres = veils('veil-ink');
  const couvertures = veils('veil-full');
  // Ancrage : sans lui, une variable renommee ferait passer toutes les comparaisons a vide.
  expect(encres.length, 'les deux regimes du voile').toBe(2);
  expect(couvertures.length, 'les deux couvertures du voile').toBe(2);

  expect(Math.min(...encres), 'l encre du regime large').toBeGreaterThanOrEqual(75);
  expect(Math.max(...encres), 'l encre du regime etroit').toBeGreaterThanOrEqual(82);
  expect(Math.min(...couvertures), 'la couverture du regime large').toBeGreaterThanOrEqual(28);
  expect(Math.max(...couvertures), 'la couverture du regime etroit').toBeGreaterThanOrEqual(34);
});

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT } from './sources';

/**
 * La feuille de style reste segmentee (2026-08-11).
 *
 * ## Ce que ce fichier empeche, et pourquoi il vaut la peine
 *
 * `globals.css` avait atteint **1812 lignes et 143 selecteurs** : jetons, base, marque,
 * typographie, surfaces, boutons, affiches et mise en page dans un seul document. Le cout
 * n'est pas l'esthetique du fichier, c'est qu'**on n'y retrouve plus une decision** — donc on
 * en reecrit une a cote au lieu de corriger celle qui existe. C'est ainsi qu'on se retrouve
 * avec `text-sm text-(--color-muted)` ecrit 79 fois.
 *
 * Une segmentation ne tient pas toute seule : le prochain ajout ira naturellement « juste
 * a la fin de globals.css ». Cette garde est ce qui l'en empeche.
 */

const STYLES = join(ROOT, 'app', 'styles');
const GLOBALS = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');

it('globals.css reste un point d entree, sans aucune regle', () => {
  // ⚠️ On lit **hors commentaires** : ce depot documente abondamment, et un exemple CSS cite
  // en prose ferait tomber la garde — le faux positif que `no-adhoc-typography` documente.
  const code = GLOBALS.replace(/\/\*[\s\S]*?\*\//g, '');

  // Aucune accolade : ni regle, ni `@theme`, ni `@layer`. Uniquement des `@import`.
  expect(code).not.toContain('{');

  const lignes = code.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  expect(lignes.every((l) => l.startsWith('@import'))).toBe(true);
});

it('les six fichiers de sujet existent et sont tous importes', () => {
  const attendus = ['tokens', 'base', 'type', 'surfaces', 'controls', 'media', 'brand'];
  const presents = readdirSync(STYLES).filter((f) => f.endsWith('.css')).map((f) => f.slice(0, -4));

  for (const nom of attendus) {
    expect(presents, `app/styles/${nom}.css manque`).toContain(nom);
    // Un fichier present mais non importe est du CSS mort : il ne rend rien, et personne ne
    // le remarque puisque la page s'affiche. Le meme defaut que `no-orphan-component`.
    expect(GLOBALS, `${nom}.css n'est pas importe`).toContain(`./styles/${nom}.css`);
  }

  // Et l'inverse : un fichier importe qui n'existe pas casserait le build, donc inutile a
  // tester — mais un fichier de trop signale que le decoupage a derive.
  expect(presents.sort()).toEqual([...attendus].sort());
});

it('les jetons vivent a un seul endroit', () => {
  // 🔴 Le defaut vise : un seul `@theme` par projet. Deux blocs se completent silencieusement
  // et l'on ne sait plus lequel decide — c'est exactement le doublon `--color-muted` commis
  // le matin meme du decoupage.
  // ⚠️ Hors commentaires : plusieurs fichiers **expliquent** `@theme` en prose, et les compter
  // ferait echouer la garde sur des documents qui ne declarent rien. Meme faux positif que
  // celui documente par `no-adhoc-typography`.
  const avecTheme = readdirSync(STYLES)
    .filter((f) => f.endsWith('.css'))
    .filter((f) =>
      readFileSync(join(STYLES, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .includes('@theme'),
    );

  expect(avecTheme).toEqual(['tokens.css']);
});

it('aucun fichier de sujet ne redeclare une couleur de la palette', () => {
  // Une valeur en dur (`#1a1f29`) dans `surfaces.css` reintroduirait exactement ce que les
  // jetons existent pour empecher : une decision prise deux fois, a deux endroits.
  //
  // ⚠️ Les couleurs **litterales de rendu** — le noir des ombres, le blanc d'un reflet — sont
  // tolerees : elles ne nomment rien, elles dosent une opacite.
  const fautes: string[] = [];
  for (const fichier of readdirSync(STYLES).filter((f) => f.endsWith('.css') && f !== 'tokens.css')) {
    const code = readFileSync(join(STYLES, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, hex] of code.matchAll(/(#[0-9a-fA-F]{6})\b/g)) {
      fautes.push(`${fichier} : ${hex}`);
    }
  }
  expect(fautes).toEqual([]);
});

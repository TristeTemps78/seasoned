import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/**
 * Tout titre de `app/` porte un cran de l'echelle. Aucun ne redecide sa taille sur place.
 *
 * La question est **« ce titre porte-t-il un cran ? »**, et non « ecrit-il une taille en
 * trop ? » : la seconde laisse passer le `h2` en `font-semibold` nu, c'est-a-dire un titre a
 * la taille exacte du corps de texte. C'est le defaut le plus courant ici, et le seul que ni
 * le typage, ni le build, ni un montage ne voient — un titre nu s'affiche parfaitement.
 *
 * **Aucune exception, et c'est plus simple qu'en justifier deux** : les deux titres qui
 * portaient leur taille a la main sont devenus des crans (`.hero-title`, `.label`). Une
 * contrainte absolue se lit d'un coup d'oeil ; une liste d'exemptions indexees sur une
 * chaine de classes se casse en ajoutant un attribut.
 *
 * Meme procede que `no-hardcoded-strings` : c'est une propriete du code ecrit, on lit la
 * source.
 */

/** ⚠️ Derive du fichier, pas du repertoire courant : `readdirSync('app')` cassait au premier
 *  deplacement. Meme motif que `ROOT` dans `no-hardcoded-strings`. */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Les crans nommes de `app/globals.css`, chacun range avec la forme qu'il habille. */
const SCALE = [
  'hero-title',
  'page-title',
  'section-heading',
  'empty-state-title',
  'card-title',
  'row-title',
  'label',
  'tally-figure',
] as const;

/**
 * Une taille ecrite a la main, sous ses trois formes — et il a fallu les trois : l'echelle
 * nommee, la **valeur arbitraire** (l'echappatoire de qui est presse), et le `style` en ligne
 * que rien d'autre ne verrait. L'unite est exigee dans les crochets : `text-[#fff]` est une
 * couleur.
 *
 * ⚠️ N'attrape ni `text-(--color-warn)` — la syntaxe couleur de Tailwind 4, qui vit dans ce
 * depot —, ni `text-balance`, ni `tracking-[-0.02em]`.
 */
const HARDCODED =
  /\btext-(?:xs|sm|base|lg|\d?xl)\b|\btext-\[[^\]]*(?:px|rem|em|%|ch|vw|vh)\]|fontSize/;

/** `sr-only` : un titre invisible n'a pas de taille. Exception de nature, pas de gout. */
const INVISIBLE = /\bsr-only\b/;

/**
 * ⚠️ Les commentaires d'abord, sinon un exemple JSX cite en prose fait tomber la garde — et
 * ce depot commente abondamment. `no-ssr-auth` documente avoir accuse un fichier « dont le
 * seul tort est d'expliquer l'interdiction ». Meme corps que `no-hardcoded-strings`.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

/**
 * ⚠️ Les attributs sont lus **quelle que soit leur forme d'ecriture** : exiger
 * `className="…"` entre guillemets rendait un template literal invisible. C'est le faux
 * negatif que ce depot a deja commis en ratant `.tile`, ecrite ainsi.
 */
function headingsOf(source: string): string[] {
  return [...withoutComments(source).matchAll(/<h[1-6]\b([^>]*)>/g)].map(([, raw]) =>
    (raw ?? '').replace(/\s+/g, ' ').trim(),
  );
}

function faults(path: string, source: string): string[] {
  return headingsOf(source).flatMap((attrs) => {
    if (INVISIBLE.test(attrs)) return [];
    if (HARDCODED.test(attrs)) return `${path} taille en dur : ${attrs}`;

    // Deux crans se contredisent : les deux posent `font-size`, et c'est l'**ordre de la
    // feuille** qui tranche — donc la taille rendue ne se lit plus sur le titre. Le cas est
    // rare et silencieux, ce qui est exactement pourquoi il vaut une ligne.
    const crans = SCALE.filter((cran) => new RegExp(String.raw`\b${cran}\b`).test(attrs));
    if (crans.length > 1) return `${path} porte ${crans.length} crans : ${crans.join(', ')}`;
    if (crans.length === 0) return `${path} sans cran : ${attrs || '(nu)'}`;
    return [];
  });
}

const FILES = sourceFiles(join(ROOT, 'app')).map((file) => ({
  path: relative(ROOT, file).split(sep).join('/'),
  source: readFileSync(file, 'utf8'),
}));

it('tout titre de app/ porte un cran de l echelle', () => {
  expect(FILES.flatMap(({ path, source }) => faults(path, source))).toEqual([]);
});

it('le motif attrape bien ce qu il vise', () => {
  // Sans cet ancrage, une expression cassee rendrait le test vert pour toujours — le defaut
  // le plus courant des tests qui verifient une absence. Chaque cas ci-dessous est un faux
  // negatif REEL d'une version precedente de ce fichier.
  const refused = (source: string) => faults('faux.tsx', source);

  expect(refused('<h2 className="font-semibold">B</h2>')).toHaveLength(1); // le defaut vise
  expect(refused('<h2>B</h2>')).toHaveLength(1);
  expect(refused('<h1 className="text-2xl font-semibold">A</h1>')).toHaveLength(1);
  expect(refused('<h1 className="text-[28px]">A</h1>')).toHaveLength(1);
  expect(refused("<h1 style={{ fontSize: '2rem' }}>A</h1>")).toHaveLength(1);
  expect(refused('<h3 className="mb-3 text-sm font-medium">C</h3>')).toHaveLength(1);
  expect(refused('<h2 className={`card-title ${x} text-lg`}>B</h2>')).toHaveLength(1);
  expect(refused('<h2 className="card-title section-heading">B</h2>')).toHaveLength(1);

  // Et il laisse passer ce qui est correct, y compris les pieges de syntaxe et un titre cite
  // dans un commentaire.
  expect(
    refused(
      '<h1 className="page-title">A</h1><h2 className="row-title">B</h2>' +
        '<h2 className="sr-only">C</h2><h2 className="card-title text-(--color-warn)">D</h2>' +
        '<h1 className="hero-title text-balance">E</h1>' +
        '{/* exemple : <h2 className="text-lg">a ne pas ecrire</h2> */}',
    ),
  ).toEqual([]);
});

it('l echelle lue est bien celle du depot', () => {
  // Un test qui parcourt zero fichier passe : on prouve d'abord qu'il y a de la matiere.
  //
  // ⚠️ On compte les **titres**, pas les fichiers. Compter les fichiers ne prouve que la
  // lecture du repertoire : le jour ou `<h[1-6]>` cesserait de correspondre a la facon dont
  // ce depot ecrit ses titres, la garde principale examinerait zero titre et resterait verte.
  expect(FILES.flatMap(({ source }) => headingsOf(source)).length).toBeGreaterThan(30);

  // Et que les crans existent reellement dans la feuille de style — sans quoi le test
  // protegerait une echelle qui n'est plus definie nulle part.
  const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  for (const cran of SCALE) expect(css).toContain(`.${cran} {`);
});

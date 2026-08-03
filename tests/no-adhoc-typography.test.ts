import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

/**
 * Aucun titre ne porte sa taille en dur.
 *
 * ## Le defaut que ce test attrape
 *
 * `text-2xl font-semibold tracking-tight` etait recopie **seize fois** pour un titre de
 * page, `text-lg font-semibold tracking-tight` **huit fois** pour un titre de section, et
 * `text-sm font-semibold` **huit fois** pour un titre de panneau. Aucune des copies ne
 * savait qu'elle en etait une : c'est la meme forme d'echec que le bouton secondaire du
 * 6.7, et que les deux blocs d'affiche qui avaient diverge sans bruit.
 *
 * Ce que la duplication produit ici n'est pas un probleme de longueur de ligne. Trois
 * ecrans — `Agenda`, `MyStats`, `Friends` — avaient fini par ecrire leur `h2` en
 * `font-semibold` **nu**, c'est-a-dire a la taille exacte du corps de texte : sur ces
 * pages la hierarchie visuelle n'existait plus du tout, et **rien ne le signalait**. Ni le
 * typage, ni les tests, ni le build ne voient qu'un titre a la taille d'un paragraphe.
 *
 * ⚠️ Et le corollaire, verifie le 2026-08-04 : `.section-title` avait ete extraite au 6.7
 * **d'apres l'ecran d'accueil**, et n'etait employee nulle part — l'original avait continue
 * sa vie de son cote. Une forme extraite que personne n'emploie ne protege de rien.
 *
 * ## Pourquoi la taille et non la classe
 *
 * Le test refuse une **taille de police ecrite a la main sur un titre**, et non l'absence
 * d'une classe precise. Un `<h2>` nu a l'interieur d'un `.section-title` est parfaitement
 * correct — c'est meme la forme voulue. Ce qui ne l'est pas, c'est de redecider la taille
 * sur place, parce que c'est exactement le geste qui fait diverger l'echelle.
 *
 * Meme procede que `no-hardcoded-strings` et `no-journal-on-server` : on lit la source.
 */

/** Les quatre crans nommes, dans `app/globals.css`. */
const SCALE = ['page-title', 'section-heading', 'card-title', 'empty-state-title'];

/**
 * Les utilitaires Tailwind qui fixent une taille de police.
 *
 * ⚠️ **Sans `g`, et c'est necessaire.** Avec le drapeau global, `RegExp.test` retient
 * `lastIndex` d'un appel a l'autre : le second fichier examine repartait du milieu et
 * repondait faux. L'ancrage ci-dessous a attrape ce defaut **dans ce test meme**, ce qui
 * est exactement ce pour quoi il existe.
 */
const HARDCODED_SIZE = /<h[12][^>]*className="[^"]*\btext-(xs|sm|base|lg|xl|\dxl)\b[^"]*"/;

/**
 * Les exceptions — **et chacune doit dire pourquoi**.
 *
 * C'est la valeur du test : il n'interdit pas la taille en dur, il oblige a la justifier.
 * Une exception sans raison ecrite est une exception que personne ne pourra reevaluer.
 */
const ALLOWED = new Map([
  // L'accroche du produit, pas une etiquette d'ecran. C'est le seul `h1` du site qui soit
  // une phrase ; il est deliberement au-dessus de l'echelle, et il est unique — donc pas
  // de classe, la regle du depot etant de n'extraire qu'a partir de trois repetitions.
  ['app/(site)/page.tsx', "l'accroche de l'accueil, seule de son espece"],
  // Une etiquette de groupe temporel (« Cette semaine »), en capitales et en `muted` :
  // elle ordonne une liste, elle ne titre pas une section. Forme distincte, usage unique.
  ['app/components/Agenda.tsx', 'etiquette de groupe temporel, pas un titre de section'],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') ? [path.replaceAll('\\', '/')] : [];
  });
}

function offenders(files: readonly { path: string; source: string }[]): string[] {
  return files
    .filter(({ path, source }) => !ALLOWED.has(path) && HARDCODED_SIZE.test(source))
    .map(({ path }) => path);
}

function readAll(): { path: string; source: string }[] {
  return sourceFiles('app').map((path) => ({ path, source: readFileSync(path, 'utf8') }));
}

it('aucun titre ne fixe sa taille de police a la main', () => {
  expect(offenders(readAll())).toEqual([]);
});

it('le motif attrape bien ce qu il vise', () => {
  // Sans cet ancrage, une expression cassee rendrait le test vert pour toujours — le
  // defaut le plus courant des tests qui verifient une absence, et ce depot l'a deja
  // rencontre deux fois.
  expect(
    offenders([{ path: 'faux.tsx', source: '<h1 className="text-2xl font-semibold">A</h1>' }]),
  ).toEqual(['faux.tsx']);
  expect(
    offenders([{ path: 'faux2.tsx', source: '<h2 className="text-lg font-semibold">B</h2>' }]),
  ).toEqual(['faux2.tsx']);
  // Et il laisse passer ce qui est correct : la classe nommee, et le titre nu.
  expect(
    offenders([{ path: 'bon.tsx', source: '<h1 className="page-title">A</h1><h2>B</h2>' }]),
  ).toEqual([]);
});

it('l echelle lue est bien celle du depot', () => {
  // Un test qui parcourt zero fichier passe : on prouve d'abord qu'il y a de la matiere.
  const files = readAll();
  expect(files.length).toBeGreaterThan(20);

  // Et que les quatre crans existent reellement dans la feuille de style — sans quoi le
  // test protegerait une echelle qui n'est plus definie nulle part.
  const css = readFileSync('app/globals.css', 'utf8');
  for (const cran of SCALE) expect(css).toContain(`.${cran} {`);
});

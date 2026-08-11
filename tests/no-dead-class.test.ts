import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT, codeOf, filesUnder, pathOf } from './sources';

/**
 * Aucune classe declaree n'est laissee sans emploi.
 *
 * ## Le defaut, constate le 2026-08-11
 *
 * Deux classes rendaient **zero pixel** : `.poster-grid-lead`, orpheline le jour ou l'accueil
 * est passe en rails et la bibliotheque en mosaique, et `.section-title`, orpheline le jour ou
 * `RowHeader` a pris `.row-head`. Ni l'une ni l'autre n'a casse quoi que ce soit — c'est bien
 * le probleme : **du CSS mort ne se signale jamais**. Il grossit la feuille, il apparait dans
 * les recherches, et il fait croire qu'une forme existe encore.
 *
 * C'est exactement le raisonnement de `no-orphan-component`, applique aux styles : *une chose
 * ecrite et jamais montee n'est pas une chose faite.* Ce depot a paye ce motif sept fois.
 *
 * ## ⚠️ Pourquoi la detection est volontairement grossiere
 *
 * On cherche le **nom de la classe** dans tout le JSX, sans essayer de comprendre comment il y
 * arrive : chaine litterale, template, concatenation. Un analyseur fin refuserait les formes
 * qu'il ne sait pas lire et casserait sur du code parfaitement valide — un test qui echoue
 * pour de mauvaises raisons apprend a etre ignore, ce que `no-hardcoded-strings` documente
 * deja. Ici le faux **negatif** (une classe morte citee dans un commentaire) coute une ligne
 * de CSS ; le faux positif couterait la confiance dans la garde.
 */

const STYLES = join(ROOT, 'app', 'styles');

/** Ce que le JSX du produit contient, commentaires retires. */
const CODE = filesUnder('app')
  .filter((file) => pathOf(file).endsWith('.tsx'))
  .map((file) => codeOf(file))
  .join('\n');

/**
 * Les classes declarees par la feuille, commentaires retires.
 *
 * ⚠️ Les commentaires **d'abord** : ce depot cite abondamment des noms de classes en prose, y
 * compris des classes retirees. Les compter ferait echouer la garde sur de la documentation.
 */
function declaredClasses(): readonly string[] {
  const noms = new Set<string>();
  for (const fichier of readdirSync(STYLES).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(STYLES, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, nom] of css.matchAll(/(?<![\w-])\.([a-z][a-z0-9-]*)/g)) noms.add(nom ?? '');
  }
  return [...noms].sort();
}

it('toute classe declaree est employee quelque part', () => {
  const mortes = declaredClasses().filter(
    // ⚠️ `$` fait partie des delimiteurs de fin : une classe suivie d'une interpolation —
    // `` `avatar${large ? ' avatar-lg' : ''}` `` — est employee, et la rater ferait de la garde
    // une source de faux positifs, c'est-a-dire une garde qu'on apprend a ignorer.
    (nom) => !new RegExp(String.raw`[\s"'\`{]${nom}[\s"'\`}$]`).test(CODE),
  );
  expect(mortes).toEqual([]);
});

it('la feuille lue est bien celle du depot', () => {
  // Un test qui parcourt zero classe passe : on prouve d'abord qu'il y a de la matiere.
  // C'est la meme precaution que `no-adhoc-typography`, qui compte ses titres avant de les
  // juger — sans elle, un jour ou le repertoire change de nom, la garde reste verte a vide.
  expect(declaredClasses().length).toBeGreaterThan(50);
  expect(CODE.length).toBeGreaterThan(100_000);
});

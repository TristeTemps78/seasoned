/**
 * Aucun composant n'est ecrit sans etre monte.
 *
 * ## Le defaut que cette garde attrape, et il s'est produit cinq fois
 *
 * *Une fonctionnalite ecrite n'est pas une fonctionnalite qui marche.* Ce depot a livre
 * `ordering.ts` et `episodeMinutes` **morts-nes** — testes, verts, appeles par rien — et a
 * porte `unfollow()` et `setVisibility()` sans appelant pendant deux lots, ce qui rendait
 * tout le social illisible sans que rien ne le signale.
 *
 * ## Pourquoi UNE regle plutot que N tests de montage
 *
 * La parade employee jusqu'ici etait un test par composant, qui lisait la source et exigeait
 * une balise precise :
 *
 *     expect(source).toMatch(/<Reviews\\s+seriesId=\\{id\\}/)
 *
 * Ca attrape le bon defaut et **ca coute cher** : reordonner une prop casse le test alors
 * que le produit marche. Un test qui echoue pour de mauvaises raisons apprend a etre ignore
 * — c'est ecrit dans `no-hardcoded-strings`, et c'est la vraie raison de preferer une regle
 * generale. Elle est moins precise sur *ou* le composant est monte, et elle couvre **tous**
 * les composants, y compris ceux qui n'existent pas encore.
 */

import { expect, it } from 'vitest';
import { codeOf, filesUnder, pathOf } from './sources';

/** Le nom exporte par un fichier de composant. */
function exportedNames(code: string): string[] {
  return [...code.matchAll(/^export (?:default )?function ([A-Z][\w]*)/gm)].map((m) => m[1] ?? '');
}

const FILES = filesUnder('app').map((file) => ({ path: pathOf(file), code: codeOf(file) }));

/**
 * ⚠️ Deux exemptions, et chacune dit pourquoi.
 *
 * Ce ne sont pas des oublis tolerés : ce sont des composants que **Next monte lui-meme**,
 * par convention de nom de fichier. Aucun code du depot ne les reference, et c'est normal.
 */
const MOUNTED_BY_THE_FRAMEWORK = /(^|\/)(page|layout|not-found|error|loading|template)\.tsx$/;

it('tout composant de app/ est monte quelque part', () => {
  const orphans = FILES.filter(({ path }) => !MOUNTED_BY_THE_FRAMEWORK.test(path)).flatMap(
    ({ path, code }) =>
      exportedNames(code)
        .filter((name) => {
          const used = new RegExp(String.raw`\b${name}\b`);
          return !FILES.some((other) => other.path !== path && used.test(other.code));
        })
        .map((name) => `${path} :: ${name}`),
  );

  expect(orphans).toEqual([]);
});

it('la garde voit bien ce qu elle vise', () => {
  // Sans cet ancrage, un parcours casse rendrait zero fichier et la garde serait verte pour
  // toujours — le defaut le plus courant des tests qui verifient une absence.
  expect(FILES.length).toBeGreaterThan(30);
  expect(FILES.filter(({ path }) => MOUNTED_BY_THE_FRAMEWORK.test(path)).length).toBeGreaterThan(
    10,
  );

  // Et elle sait reconnaitre un nom exporte, sinon elle n'examinerait rien.
  expect(exportedNames("export function Reviews() {}\nexport function helper() {}")).toEqual([
    'Reviews',
  ]);
});

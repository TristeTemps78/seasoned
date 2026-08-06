/**
 * Lire le code du depot depuis un test.
 *
 * ## Pourquoi ce fichier existe maintenant, et pas avant
 *
 * `TASKS.md` 7.17 avait recense trois copies du meme parcours de repertoire et **refuse**
 * de les extraire : elles different (`withFileTypes` contre `statSync`, filtres et racines
 * distincts), donc un helper commun aurait touche trois gardes vertes pour zero defaut. La
 * note disait « a faire le jour ou l'une doit changer ».
 *
 * C'est ce jour : une quatrieme garde arrive. Extraire trois copies « pendant qu'on y est »
 * etait du travail pour rien ; en ecrire une quatrieme a la main serait de la negligence.
 *
 * ⚠️ Les trois gardes existantes ne sont **pas** migrees. Leurs parcours different pour des
 * raisons qui leur appartiennent, et les reecrire ne corrigerait rien — ce depot s'interdit
 * de toucher du vert pour l'elegance.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** La racine du depot, derivee du fichier et **jamais** du repertoire courant. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Tous les fichiers TypeScript sous un dossier du depot, chemins absolus. */
export function filesUnder(dir: string): string[] {
  const walk = (at: string): string[] =>
    readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
      const path = join(at, entry.name);
      if (entry.isDirectory()) return walk(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  return walk(join(ROOT, dir));
}

/** Chemin relatif a la racine, en barres obliques — lisible dans un message d'echec. */
export function pathOf(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}

/**
 * Le code d'un fichier, **commentaires retires**.
 *
 * Sans cela, un exemple cite en prose compte comme un usage — et ce depot commente
 * abondamment. `no-ssr-auth` documente avoir accuse un fichier « dont le seul tort est
 * d'expliquer l'interdiction ».
 */
export function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

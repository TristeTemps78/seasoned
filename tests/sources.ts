/**
 * Lire le code du depot depuis un test.
 *
 * ## Pourquoi ce fichier existe maintenant, et pas avant
 *
 * avait recense trois copies du meme parcours de repertoire et **refuse**
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
 * Une source **commentaires retires**.
 *
 * Sans cela, un exemple cite en prose compte comme un usage — et ce depot commente
 * abondamment. `no-ssr-auth` documente avoir accuse un fichier « dont le seul tort est
 * d'expliquer l'interdiction ».
 *
 * ⚠️ Separee de {@link codeOf} pour une raison precise : une garde doit pouvoir
 * **prouver** qu'elle ne se fait pas piéger par un commentaire, et elle ne peut pas le
 * prouver sur un fichier — il faudrait en ecrire un. Avec une fonction qui prend une
 * chaine, le cas s'ancre en une ligne.
 */
export function codeIn(source: string): string {
  return source
    // 🔴 **Les commentaires de LIGNE partent en premier, et l'ordre est tout le defaut.**
    //
    // Il etait en dernier. Une ligne comme ``// le SEO vit sur `/serie/*` `` porte donc un
    // `/*` que le passage suivant prenait pour l'ouverture d'un bloc — et il mangeait tout
    // jusqu'au prochain `*/`, souvent des centaines de lignes plus bas.
    //
    // Mesure du 2026-08-15 sur `parcourir/page.tsx` : **9 622 caracteres reduits a 2 668**,
    // dont tout le corps de la page. La garde qui le lisait n'accusait pas a tort par exces
    // de zele — elle lisait un fichier amputé, et concluait que sept cles traduites
    // n'etaient appelees nulle part.
    //
    // ⚠️ Le piege est present dans **cinq fichiers** du depot, tous pour la meme raison :
    // ils citent la route `/serie/*` en prose. `AuthProvider.tsx` en fait partie — c'est-a-dire
    // le fichier meme que `no-ssr-auth` surveille. Onze gardes lisent par ici ; elles
    // travaillaient toutes sur du code tronque sans que rien ne le dise, et une garde qui
    // ne voit pas le code ne garde rien.
    //
    // ⚠️ L'inverse ne peut pas arriver : le motif est **ancre en debut de ligne**
    // (`^[ \t]*//`), donc un `http://` cite au milieu d'une phrase n'ouvre rien, et une
    // ligne `//` a l'interieur d'un bloc disparait avec le bloc de toute facon.
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Le code d'un fichier du depot, commentaires retires. */
export function codeOf(file: string): string {
  return codeIn(readFileSync(file, 'utf8'));
}

/**
 * Toute la feuille de style du produit, en une chaine.
 *
 * 🔴 **Cinq tests lisaient `app/globals.css` directement**, et les cinq sont tombes le jour ou
 * ce fichier est devenu un simple point d'entree (segmentation du 2026-08-11) : ils
 * cherchaient des regles dans un document qui n'en contient plus aucune.
 *
 * C'etait la bonne alerte — elle a vu le deplacement. Mais ce qu'ils protegent n'a jamais ete
 * « la regle vit dans ce fichier-la » : c'est **« la regle existe quelque part »**. Meme lecon
 * que `no-hardcoded-strings`, tombee quand le dictionnaire est passe de un fichier a trois.
 *
 * ⚠️ L'ordre est celui des `@import` de `globals.css` et non `readdirSync`, qui rendrait
 * l'alphabetique : un test sur la cascade lirait sinon les regles dans un ordre que le
 * navigateur ne voit jamais.
 */
export function styleSheet(): string {
  const entry = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  const parts = [...entry.matchAll(/@import\s+'\.\/(styles\/[a-z]+\.css)'/g)].map((m) => m[1] ?? '');
  return parts
    .map((relative) => readFileSync(join(ROOT, 'app', ...relative.split('/')), 'utf8'))
    .join('\n');
}

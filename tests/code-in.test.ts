import { expect, it } from 'vitest';

import { codeIn } from './sources';

/**
 * `codeIn` — le nettoyage sur lequel **onze gardes** appuient leur verdict.
 *
 * ## 🔴 Ce que le 2026-08-15 a trouve
 *
 * Les commentaires de ligne partaient en **dernier**. Une ligne de prose qui cite la route
 * des fiches — barre, « serie », barre, etoile — porte donc les deux caracteres qui ouvrent
 * un bloc, et le passage sur les blocs les prenait pour tels : il mangeait tout jusqu'a la
 * fermeture suivante, souvent des centaines de lignes plus bas.
 *
 * ⚠️ Cette phrase est ecrite en toutes lettres plutot qu'en exemple : le litteral fermerait
 * ce commentaire-ci. Le piege se reproduit jusque dans sa propre documentation, ce qui dit
 * assez qu'il n'a rien d'exotique.
 *
 * Sur `parcourir/page.tsx` : **9 622 caracteres reduits a 2 668**, tout le corps de la page
 * emporte. La garde des phrases mortes a alors accuse sept cles pourtant affichees — elle ne
 * se trompait pas de regle, elle lisait un fichier ampute.
 *
 * Le piege vit dans **cinq fichiers**, tous pour la meme raison : ils citent la route
 * `/serie/*` en prose. `AuthProvider.tsx` en fait partie, c'est-a-dire le fichier que
 * `no-ssr-auth` surveille. **Une garde qui ne voit pas le code ne garde rien**, et rien ne
 * le disait : elle passait.
 *
 * ## Pourquoi ce fichier existe
 *
 * L'en-tete de `codeIn` promet qu'une garde doit pouvoir **prouver** qu'elle ne se fait pas
 * piéger par un commentaire, et que la fonction prend une chaine precisement pour que le cas
 * s'ancre en une ligne. La promesse etait tenable et n'avait jamais ete tenue.
 */

it('ne se fait pas piéger par un chemin cite dans un commentaire de ligne', () => {
  // Le cas exact des cinq fichiers du depot.
  const source = [
    "// le SEO vit sur `/serie/*`, et le reste ne compte pas",
    "const cle = 'browse.genre';",
    "const autre = 'browse.apply';",
  ].join('\n');

  const code = codeIn(source);
  expect(code).toContain("'browse.genre'");
  expect(code).toContain("'browse.apply'");
});

it('retire bien les trois formes de commentaire', () => {
  const source = [
    '/** un bloc */',
    "const a = 'garde-a';",
    '{/* un commentaire JSX */}',
    "const b = 'garde-b';",
    '// une ligne',
    "const c = 'garde-c';",
  ].join('\n');

  const code = codeIn(source);
  expect(code).toContain("'garde-a'");
  expect(code).toContain("'garde-b'");
  expect(code).toContain("'garde-c'");
  expect(code).not.toContain('un bloc');
  expect(code).not.toContain('un commentaire JSX');
  expect(code).not.toContain('une ligne');
});

/**
 * L'inverse du defaut, et il faut le tenir aussi : un `//` **au milieu** d'une ligne n'est
 * pas un commentaire. Le motif est ancre en debut de ligne exactement pour ca.
 */
it('ne prend pas une URL au milieu d une ligne pour un commentaire', () => {
  const code = codeIn("const url = 'https://exemple.test/a'; const apres = 'garde';");
  expect(code).toContain("'garde'");
});

it('un bloc qui contient une ligne // disparait entierement', () => {
  const code = codeIn(['/**', ' * voir // ailleurs', ' */', "const a = 'garde';"].join('\n'));
  expect(code).toContain("'garde'");
  expect(code).not.toContain('ailleurs');
});

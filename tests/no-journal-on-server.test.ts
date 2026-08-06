import { expect, it } from 'vitest';
import { ROOT, codeIn, codeOf, filesUnder, pathOf } from './sources';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **Aucune donnee de journal ne traverse le serveur.**
 *
 * Ce test garde une regle qui n'a pas d'autre gardien, et dont la violation serait
 * silencieuse jusqu'a devenir un incident :
 *
 *   - le HTML des pages est **mis en cache au bord et partage entre tous les
 *     visiteurs**. Un composant serveur qui lirait un journal servirait celui de
 *     quelqu'un a quelqu'un d'autre — et a cent mille utilisateurs, a grande echelle ;
 *   - une page qui lit un etat personnel cesse d'etre mise en cache. Le budget entier
 *     du produit repose sur l'inverse (`ROADMAP.md` §1.4).
 *
 * Rien dans le code d'aujourd'hui ne fait cela. Tout l'interet du test est de le
 * verifier **demain**, quand quelqu'un — humain ou agent — voudra « juste » afficher
 * le titre d'une serie suivie cote serveur.
 *
 * Il lit les sources plutot que le HTML produit : une assertion sur du HTML rendu
 * exigerait un serveur, ne couvrirait que les pages effectivement visitees, et
 * passerait au vert par accident sur un journal vide — c'est-a-dire toujours, en
 * integration continue.
 *
 * ## 🔴 Ce que cette garde laissait passer jusqu'au 2026-08-06
 *
 * Elle portait une **liste noire de six chemins**. Or neuf modules donnent acces au
 * journal — `src/journal/{account,local,remote,store,sync,syncing}`,
 * `app/journal/{useJournal,journalStore}` et `src/domain/journal`. **Trois etaient
 * couverts.** `app/journal/journalStore` ne l'etait pas, alors qu'il importe `local`,
 * `remote` et `syncing` des sa premiere ligne : la porte etait fermee et la fenetre
 * d'a cote ouverte.
 *
 * Deux autres defauts venaient avec :
 *
 *   - **les chemins etaient relatifs au repertoire courant** (`readdirSync('app')`),
 *     alors que `no-adhoc-typography` ecrit noir sur blanc que « `readdirSync('app')`
 *     cassait au premier deplacement ». *La lecon etait ecrite dans un fichier et pas
 *     appliquee dans l'autre* ;
 *   - **les commentaires n'etaient pas retires** avant la recherche, donc un fichier
 *     dont le seul tort aurait ete d'expliquer l'interdiction se serait fait accuser —
 *     le faux positif que `no-ssr-auth` documente avoir commis.
 *
 * ## Ce que la garde ne fait pas, et il faut le savoir
 *
 * Elle regarde les imports **directs**, pas la fermeture transitive. Un module serveur
 * qui importerait un helper anodin qui, lui, lit le journal, passerait.
 *
 * C'est un choix : resoudre le graphe complet demanderait un resolveur d'alias et
 * d'extensions, c'est-a-dire un outil de diagnostic de plus — et ce depot a deja vu
 * deux des siens mentir (72 puis 210 faux positifs). *Un outil de diagnostic qui ment
 * est pire qu'aucun outil.* La regle couvre desormais **tous** les modules de journal
 * au premier niveau, ce qui est la faille reelle ; la transitivite s'ecrira le jour ou
 * un import indirect existera, pas « pendant qu'on y est ».
 */

const CLIENT_MARK = /^\s*['"]use client['"]/;

/**
 * Tout ce qui donne acces au journal, par **repertoire** et non par fichier.
 *
 * C'est le coeur de la correction : une liste de fichiers se perime des qu'on en ajoute
 * un — ce qui est arrive trois fois — alors qu'un repertoire couvre ce qui n'existe pas
 * encore. Les formes relatives sont la parce qu'un module de `app/` peut ecrire
 * `../journal/useJournal` aussi bien que `@/app/journal/useJournal`.
 */
const FORBIDDEN = [
  /['"]@\/src\/journal\//,
  /['"]@\/app\/journal\//,
  // ⚠️ Sans ancre de fin : depuis que `journal.ts` est devenu un repertoire de briques
  // (2026-08-07), `@/src/domain/journal/write` est un import parfaitement valide — et la
  // version exacte `…journal['"]` ne le voyait pas. Le decoupage aurait rouvert la faille
  // que ce fichier venait de fermer.
  /['"]@\/src\/domain\/journal(\/|['"])/,
  /['"][./]+\/?src\/journal\//,
  /['"][./]+\/?journal\//,
  /['"][./]+src\/domain\/journal(\/|['"])/,
];

function isClientModule(source: string): boolean {
  return CLIENT_MARK.test(source);
}

/** Les imports interdits d'un module, commentaires retires. */
function faults(code: string): readonly string[] {
  if (isClientModule(code)) return [];
  return FORBIDDEN.filter((needle) => needle.test(code)).map((needle) => String(needle));
}

const FILES = [...filesUnder('app'), ...filesUnder('lib')].map((file) => ({
  path: pathOf(file),
  code: codeOf(file),
}));

it('aucun module serveur n importe le journal', () => {
  expect(
    FILES.flatMap(({ path, code }) => faults(code).map((needle) => `${path} — ${needle}`)),
  ).toEqual([]);
});

it('la garde voit bien ce qu elle vise', () => {
  // Sans cet ancrage, un chemin casse rendrait zero fichier et la garde serait verte
  // pour toujours — le defaut le plus courant des tests qui verifient une absence.
  expect(FILES.length).toBeGreaterThan(10);
  expect(FILES.filter(({ code }) => isClientModule(code)).length).toBeGreaterThan(10);

  // Chaque cas ci-dessous est un import que la version precedente laissait passer.
  const refused = (code: string) => faults(code).length;
  expect(refused("import { x } from '@/src/journal/syncing';")).toBe(1);
  expect(refused("import { x } from '@/src/journal/remote';")).toBe(1);
  expect(refused("import { x } from '@/app/journal/journalStore';")).toBe(1);
  expect(refused("import { x } from '@/src/domain/journal';")).toBe(1);
  // Le faux negatif qu'aurait cree le decoupage en briques du 2026-08-07.
  expect(refused("import { x } from '@/src/domain/journal/write';")).toBe(1);
  expect(refused("import { x } from '../journal/useJournal';")).toBe(1);

  // Et elle laisse passer ce qui est correct : un module client, et — le faux positif
  // que `no-ssr-auth` documente avoir commis — un fichier dont le seul tort est
  // d'expliquer l'interdiction.
  expect(refused("'use client';\nimport { x } from '@/src/journal/local';")).toBe(0);
  expect(refused(codeIn("/* Ne jamais ecrire : import '@/src/journal/local' */"))).toBe(0);
  expect(refused(codeIn("// interdit : from '@/app/journal/journalStore'"))).toBe(0);
});

it('les composants qui touchent au journal sont bien des composants client', () => {
  // L'envers du meme controle : si `MyProgress` perdait sa directive, il basculerait
  // cote serveur sans bruit et le test precedent le rattraperait — mais en accusant
  // le mauvais fichier. Celui-ci nomme le vrai coupable.
  //
  // ⚠️ Les chemins partent de `ROOT`, pas du repertoire courant : `vitest` lance depuis
  // un sous-dossier ne doit pas faire echouer une garde qui n'a rien a voir.
  for (const file of [
    join('app', 'components', 'MyProgress.tsx'),
    join('app', 'components', 'EpisodeGrid.tsx'),
    join('app', 'components', 'ResumeStrip.tsx'),
    join('app', '(site)', 'moi', 'Library.tsx'),
    join('app', 'journal', 'useJournal.ts'),
    join('app', 'journal', 'journalStore.ts'),
  ]) {
    expect(isClientModule(readFileSync(join(ROOT, file), 'utf8')), file).toBe(true);
  }
});

it('la page de la bibliotheque reste statique', () => {
  // Une route personnelle rendue a la demande couterait une invocation par visite,
  // et ferait tomber la garantie de cout du produit.
  const page = readFileSync(join(ROOT, 'app', '(site)', 'moi', 'page.tsx'), 'utf8');
  expect(page).toContain("dynamic = 'force-static'");
  expect(isClientModule(page)).toBe(false);
});

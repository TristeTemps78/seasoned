import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT, codeOf, filesUnder, pathOf } from './sources';

/**
 * Aucune phrase francaise ne doit vivre ailleurs que dans le dictionnaire.
 *
 * ## Pourquoi ce test existe, et ce qu'il a coute de ne pas l'avoir
 *
 * La migration vers `lib/i18n.ts` a ete declaree faite le 2026-08-02 : le suivi disait
 * « ✅ accueil, page serie, metadonnees ». La verification a trouve, dans ces memes
 * fichiers, un badge de statut anglais sur les pages francaises, une date au format
 * anglais, « Disponibilite en France » servi a des lecteurs americains, et seize
 * composants entierement en francais en dur.
 *
 * Le probleme n'est pas qu'on ait oublie : c'est qu'**il n'existait aucun moyen de le
 * savoir**. Une chaine ecrite en dur compile, passe les tests, s'affiche parfaitement —
 * dans une langue. Le defaut n'apparait qu'a un lecteur de l'autre langue, c'est-a-dire
 * a personne dans l'equipe.
 *
 * C'est la troisieme forme du meme echec (`TASKS.md` : SEO en cul-de-sac, cache
 * inoperant, `lang` menteur). La regle du projet est **auditer le resultat, jamais
 * l'intention** ; ce fichier est cette regle rendue executable, pour que la prochaine
 * chaine en dur casse la CI au lieu d'atteindre la production.
 *
 * ## Ce qu'il ne pretend pas faire
 *
 * Il ne detecte que le **francais**, par ses accents. Une chaine anglaise ecrite en dur
 * lui echappe — mais elle est visible a la relecture par quiconque travaille ici, alors
 * que le francais y passe pour normal. On attrape la faute qu'on ne peut pas voir.
 */

/**
 * Le dictionnaire, et lui seul, a le droit de contenir des phrases.
 *
 * Nomme en constante plutot qu'ecrit dans le test : la meme lecon que
 * `no-journal-on-server`, dont les chemins en dur avaient casse a un simple
 * deplacement de fichiers. Un test de conformite qui casse pour de mauvaises raisons
 * apprend a etre ignore.
 */
const DICTIONARY = join(ROOT, 'lib', 'i18n.ts');

/**
 * Le repertoire des dictionnaires, un fichier par langue.
 *
 * ⚠️ **Cette garde encodait « le dictionnaire est UN fichier »**, et elle est tombee le jour
 * ou il en est devenu trois (2026-08-07) — en accusant 274 phrases parfaitement legitimes.
 * C'etait la bonne alerte : elle a vu le deplacement. Ce qu'elle protege est que les phrases
 * vivent **au meme endroit**, pas qu'elles vivent dans un fichier donne.
 */
const DICTIONARIES_DIR = join(ROOT, 'lib', 'i18n');

/** Caracteres qui n'existent pratiquement qu'en francais dans ce depot. */
const FRENCH = /[éèêëàâçôöûùîïœ]|«|»/i;

/**
 * Le parcours de repertoire et le retrait des commentaires viennent de `./sources`.
 *
 * ⚠️ Ils etaient recopies ici. `tests/sources.ts` assumait de ne pas migrer les copies
 * existantes — « ce depot s'interdit de toucher du vert pour l'elegance » — et ce refus
 * portait sur le **parcours**, dont les variantes different reellement (`withFileTypes`
 * contre `statSync`). Il ne portait pas sur le **dé-commentateur**, qui est le meme
 * enchainement de trois `replace` dans quatre fichiers. Celui-ci est migre parce qu'on y
 * touchait de toute facon.
 */
const FILES = [...filesUnder('app'), ...filesUnder('lib')]
  .filter((file) => file !== DICTIONARY && !file.startsWith(DICTIONARIES_DIR))
  .map((file) => ({ path: pathOf(file), code: codeOf(file) }));

/** Les lignes fautives d'un fichier, prefixees de son chemin. */
function faults({ path, code }: { readonly path: string; readonly code: string }): string[] {
  return code
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => FRENCH.test(line))
    .map(({ number, line }) => `${path}:${number} — ${line}`);
}

/**
 * ⚠️ **Un seul `it()`, et c'est une correction.**
 *
 * Ce fichier employait `it.each(files)`, donc **un test par fichier inspecte** : 87 des
 * 787 tests du depot, 11 % du total, pour **une seule propriete**. Le compte annonce
 * mesurait la taille du repertoire `app/`, pas la couverture.
 *
 * `no-adhoc-typography` garde la meme classe de propriete avec un seul `it()` qui rend la
 * **liste complete** des fautes. C'est aussi un meilleur message d'echec : `it.each`
 * s'arrete au premier fichier fautif, ici on les voit tous d'un coup. Le chemin est
 * desormais dans la ligne, donc rien n'est perdu du diagnostic.
 */
it('aucune chaine francaise en dur hors du dictionnaire', () => {
  expect(
    FILES.flatMap(faults),
    'Chaine francaise en dur : elle doit passer par lib/i18n.ts',
  ).toEqual([]);
});

it('la garde voit bien ce qu elle vise', () => {
  // Sans ce garde-fou, un chemin devenu faux rendrait le test vert pour la pire raison
  // qui soit : il n'inspecterait plus rien.
  expect(FILES.length).toBeGreaterThan(20);

  // Et le motif attrape bien une phrase francaise, sinon il n'examinerait que du vide.
  expect(faults({ path: 'faux.tsx', code: "const x = 'Déjà vu';" })).toHaveLength(1);
  // ⚠️ Y compris ce que ce depot ecrit vraiment : des guillemets francais sans accent.
  expect(faults({ path: 'faux.tsx', code: 'const x = "« ainsi »";' })).toHaveLength(1);
  // Mais pas un commentaire — ce depot documente abondamment en francais, et c'est voulu.
  expect(faults({ path: 'faux.tsx', code: codeOf(join(ROOT, 'tests', 'sources.ts')) })).toEqual(
    [],
  );
});

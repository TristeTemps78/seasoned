import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

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

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Le dictionnaire, et lui seul, a le droit de contenir des phrases.
 *
 * Nomme en constante plutot qu'ecrit dans le test : la meme lecon que
 * `no-journal-on-server`, dont les chemins en dur avaient casse a un simple
 * deplacement de fichiers. Un test de conformite qui casse pour de mauvaises raisons
 * apprend a etre ignore.
 */
const DICTIONARY = join(ROOT, 'lib', 'i18n.ts');

/** Caracteres qui n'existent pratiquement qu'en francais dans ce depot. */
const FRENCH = /[éèêëàâçôöûùîïœ]|«|»/i;

function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Retire tout ce qui ne sera jamais affiche : commentaires de bloc, de ligne, et
 * commentaires JSX. C'est la seule subtilite du fichier — ce depot documente
 * abondamment en francais, et c'est voulu.
 */
function strippedOfComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('aucune chaine francaise en dur hors du dictionnaire', () => {
  const files = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'lib'))].filter(
    (file) => file !== DICTIONARY,
  );

  it('trouve bien des fichiers a inspecter', () => {
    // Sans ce garde-fou, un chemin devenu faux rendrait le test vert pour la pire
    // raison qui soit : il n'inspecterait plus rien.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => relative(ROOT, file).split(sep).join('/')))(
    '%s',
    (relativePath) => {
      const source = strippedOfComments(readFileSync(join(ROOT, relativePath), 'utf8'));
      const offenders = source
        .split('\n')
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => FRENCH.test(line));

      expect(
        offenders.map(({ number, line }) => `l.${number} — ${line}`),
        'Chaine francaise en dur : elle doit passer par lib/i18n.ts',
      ).toEqual([]);
    },
  );
});

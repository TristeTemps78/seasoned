import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ROOT, codeOf, filesUnder, pathOf } from './sources';

/**
 * Aucune phrase traduite ne dort dans le dictionnaire.
 *
 * ## 🔴 Ce que l'audit du 2026-08-15 a trouve
 *
 * **Douze cles etaient ecrites dans les deux langues et appelees nulle part** — vingt-quatre
 * phrases, dont cinq familles de `year.*` qui doublaient les `year.stat.*` reellement
 * affichees, et `friends.following` remplacee par `friends.followingLabel` sans que
 * l'ancienne parte.
 *
 * Ce n'est pas de la poussiere. Ce depot a deja paye ce motif : `review.none` — « Personne
 * n'a encore ecrit sur cette serie. » — etait traduite deux fois **pour un ecran qui faisait
 * `return null`**. La chaine morte etait le symptome d'une fonctionnalite manquante, et
 * personne ne l'a vue pendant des semaines parce que rien ne regarde un dictionnaire.
 *
 * Une phrase orpheline dit l'une de deux choses, et les deux valent qu'on s'arrete :
 * l'ecran qui devait la porter n'existe pas, ou il a cesse de la porter.
 *
 * ## Les exemptions sont **prouvees**, jamais listees
 *
 * Beaucoup de cles sont construites : `t(\`status.${'${status}'}\`)`, `t(\`face.${'${id}'}\`)`.
 * Les inscrire dans une liste en dur ici ferait deux problemes — la liste se perime, et elle
 * couvrirait encore la famille le jour ou l'appel dynamique disparaitrait.
 *
 * La garde cherche donc les **prefixes reellement construits dans le code**. Si
 * `t(\`face.${'${face}'}\`)` etait retire demain, `face.finisher` redeviendrait morte et ce
 * test le dirait — ce qu'aucune liste d'exemptions ne sait faire.
 *
 * ⚠️ Le prix est connu et assume : un prefixe couvre toute sa famille, donc une cle
 * `status.*` reellement obsolete passerait. Une garde qui attrape douze cles sur douze
 * aujourd'hui vaut mieux qu'une garde parfaite qu'on n'ecrit pas.
 */

/** Les cles declarees, suffixe de pluriel retire — `year.rated.one` compte comme `year.rated`. */
function declaredKeys(): readonly string[] {
  const fr = readFileSync(join(ROOT, 'lib', 'i18n', 'fr.ts'), 'utf8');
  const keys = [...fr.matchAll(/^ {2}'([a-zA-Z][\w.]*)':/gm)].map((m) => m[1] ?? '');
  return [...new Set(keys.map((k) => k.replace(/\.(one|other|zero|two|few|many)$/, '')))];
}

/**
 * Tout le code du produit, commentaires retires et **dictionnaires exclus**.
 *
 * ⚠️ Sans `codeOf`, une cle citee en prose compterait comme un usage — et ce depot commente
 * abondamment, y compris en nommant des cles (`review.none` est discutee dans trois
 * fichiers). C'est le piege que `no-ssr-auth` documente avoir subi.
 */
function productCode(): string {
  return ['app', 'src', 'lib']
    .flatMap((dir) => filesUnder(dir))
    .filter((file) => !pathOf(file).startsWith('lib/i18n/'))
    .map((file) => codeOf(file))
    .join('\n');
}

/** Les prefixes qu'un gabarit construit vraiment : `` t(`face.${id}`) `` donne `face`. */
function dynamicPrefixes(code: string): readonly string[] {
  return [...new Set([...code.matchAll(/`([a-zA-Z][\w.]*)\.\$\{/g)].map((m) => m[1] ?? ''))];
}

const CODE = productCode();
const PREFIXES = dynamicPrefixes(CODE);

function isUsed(key: string): boolean {
  if (CODE.includes(`'${key}'`) || CODE.includes(`"${key}"`)) return true;
  return PREFIXES.some((prefix) => key.startsWith(`${prefix}.`));
}

describe('ancrage', () => {
  it('lit un vrai dictionnaire et du vrai code', () => {
    // Sans cela, un chemin casse rendrait zero cle et zero ligne — et la garde passerait
    // en ne verifiant rien, ce qui est le faux negatif que ce depot a attrape quatre fois.
    expect(declaredKeys().length).toBeGreaterThan(500);
    expect(CODE.length).toBeGreaterThan(100_000);
    // Et une cle qu'on sait affichee est bien vue comme telle.
    expect(isUsed('nav.library')).toBe(true);
  });

  it('verrait une cle morte, et connait les familles construites', () => {
    expect(isUsed('cette.cle.nexiste.pas')).toBe(false);
    // Les gabarits sont bien detectes : sans eux, `status.*` et `face.*` seraient accusees.
    expect(PREFIXES).toContain('status');
    expect(PREFIXES).toContain('face');
    expect(isUsed('status.airing')).toBe(true);
  });
});

it('aucune phrase traduite ne dort dans le dictionnaire', () => {
  const dead = declaredKeys().filter((key) => !isUsed(key));

  expect(
    dead,
    `Cles declarees et jamais affichees :\n  ${dead.join('\n  ')}\n\n` +
      'Soit l\'ecran qui devait les porter n\'existe pas — c\'est le cas `review.none`, ' +
      'une phrase ecrite pour un `return null` —, soit il a cesse de les porter et elles ' +
      'doivent partir des DEUX dictionnaires.',
  ).toEqual([]);
});

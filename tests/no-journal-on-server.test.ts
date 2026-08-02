import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
 */

const CLIENT_MARK = /^\s*['"]use client['"]/;

/** Ce qui n'a rien a faire dans un module rendu par le serveur. */
const FORBIDDEN = [
  '@/app/journal/useJournal',
  '../journal/useJournal',
  './journal/useJournal',
  '@/src/journal/local',
  '@/src/domain/journal',
  '../src/domain/journal',
];

function sourcesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (/\.tsx?$/.test(name)) out.push(path);
    }
  };
  walk(root);
  return out;
}

function isClientModule(source: string): boolean {
  return CLIENT_MARK.test(source);
}

describe('le journal ne traverse jamais le serveur', () => {
  const files = [...sourcesUnder('app'), ...sourcesUnder('lib')];

  it('trouve bien les sources a inspecter', () => {
    // Sans cette garde, un chemin casse rendrait le test vert pour de mauvaises
    // raisons — le pire etat possible pour un test de conformite.
    expect(files.length).toBeGreaterThan(10);
  });

  it('aucun module serveur n importe le journal', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (isClientModule(source)) continue;
      if (FORBIDDEN.some((needle) => source.includes(needle))) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('les composants qui touchent au journal sont bien des composants client', () => {
    // L'envers du meme controle : si `MyProgress` perdait sa directive, il basculerait
    // cote serveur sans bruit et le test precedent le rattraperait — mais en accusant
    // le mauvais fichier. Celui-ci nomme le vrai coupable.
    for (const file of [
      join('app', 'components', 'MyProgress.tsx'),
      join('app', 'components', 'EpisodeGrid.tsx'),
      join('app', 'components', 'ResumeStrip.tsx'),
      join('app', 'moi', 'Library.tsx'),
      join('app', 'journal', 'useJournal.ts'),
    ]) {
      expect(isClientModule(readFileSync(file, 'utf8')), file).toBe(true);
    }
  });

  it('la page de la bibliotheque reste statique', () => {
    // Une route personnelle rendue a la demande couterait une invocation par visite,
    // et ferait tomber la garantie de cout du produit.
    const page = readFileSync(join('app', 'moi', 'page.tsx'), 'utf8');
    expect(page).toContain("dynamic = 'force-static'");
    expect(isClientModule(page)).toBe(false);
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 8.10 — **une langue par paquet**, et la regle qui empeche d'y revenir sans le voir.
 *
 * ## Ce qui etait mesure avant
 *
 * Un seul chunk de **75 604 octets (24 620 gzip)** portait `fr` et `en`, et `/` comme `/fr`
 * le chargeaient. Un visiteur anglais telechargeait ~12 Ko gzip de francais qu'il ne lira
 * jamais. Le probleme n'etait pas ces 12 Ko : c'etait la **pente**. A cinq langues, le meme
 * chunk partage ferait ~60 Ko gzip dont 80 % que personne sur la page ne lit — et il
 * grossirait a chaque traduction ajoutee, c'est-a-dire au moment ou l'on croit avancer.
 *
 * ## Pourquoi un test de source et pas un test de paquet
 *
 * Mesurer le paquet demanderait un `next build` dans la suite de tests : deux minutes pour
 * une regle qui se casse a l'`import`. Ce test lit donc **la seule chose qui la casse** — un
 * chemin d'import — comme le font deja `no-journal-on-server` et `no-hardcoded-strings`.
 *
 * ⚠️ La mesure du paquet, elle, a bien ete faite, une fois, a la main (2026-08-11) : apres
 * coupure, **aucun** chunk ne porte les deux langues, `/` en charge un de 16 671 gzip et
 * `/fr` un de 13 308 gzip. C'est ce qui autorise ce fichier a se contenter des imports.
 */

const CLIENT_DIRS = ['app'];

/** Tous les fichiers de composants, avec leur source. */
function sources(): readonly { readonly path: string; readonly code: string }[] {
  const out: { path: string; code: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push({ path: full, code: readFileSync(full, 'utf8') });
    }
  };
  for (const dir of CLIENT_DIRS) walk(dir);
  return out;
}

const isClient = (code: string) => /^\s*['"]use client['"]/.test(code);

/** `@/lib/i18n` — le module qui connait les deux dictionnaires. Pas `@/lib/i18n/engine`. */
const IMPORTS_DICTIONARIES = /import\s+(?!type\b)[^;]*from\s+'@\/lib\/i18n'/;

describe('un composant client ne rapatrie pas toutes les langues', () => {
  /**
   * 🔴 **La regle centrale.** `@/lib/i18n` importe `fr.ts` ET `en.ts` ; tout composant client
   * qui l'importe remet les deux dans le paquet de sa route. Le moteur — pluriels,
   * interpolation, espaces insecables, formats — vit dans `@/lib/i18n/engine`, qui ne connait
   * aucune phrase et peut etre importe librement.
   *
   * ⚠️ Un `import type` est autorise : il s'efface a la compilation.
   */
  it('aucun composant client n importe @/lib/i18n pour ses valeurs', () => {
    const fautifs = sources()
      .filter(({ code }) => isClient(code) && IMPORTS_DICTIONARIES.test(code))
      .map(({ path }) => path);

    expect(fautifs).toEqual([]);
  });

  /**
   * Les modules partages que les composants client traversent. Ils avaient chacun leur porte
   * vers les dictionnaires : `routes.ts` par `localeTag`, `format.ts` par `t` et `tn`. Seize
   * composants passent par le premier, six par le second — c'etaient les deux vrais chemins,
   * bien plus larges que le fournisseur lui-meme.
   */
  it('les modules partages passent par le moteur, pas par les dictionnaires', () => {
    for (const path of ['lib/routes.ts', 'lib/format.ts']) {
      expect(IMPORTS_DICTIONARIES.test(readFileSync(path, 'utf8'))).toBe(false);
    }
  });

  /** Le fournisseur est sur toutes les pages : s'il retombe, tout retombe avec lui. */
  it('le fournisseur de langue ne connait aucune phrase', () => {
    const code = readFileSync('app/i18n/LocaleProvider.tsx', 'utf8');
    expect(IMPORTS_DICTIONARIES.test(code)).toBe(false);
    expect(code).not.toContain("from '@/lib/i18n/fr'");
    expect(code).not.toContain("from '@/lib/i18n/en'");
  });

  /**
   * ⚠️ **Chaque porte n'ouvre que sur une langue.** Un `MessagesFr` qui importerait aussi
   * l'anglais annulerait tout sans qu'aucun autre test ne bronche — et c'est exactement le
   * genre de detail qu'un copier-coller introduit.
   */
  it('chaque porte de langue n en importe qu une', () => {
    const fr = readFileSync('app/i18n/MessagesFr.tsx', 'utf8');
    const en = readFileSync('app/i18n/MessagesEn.tsx', 'utf8');

    expect(fr).toContain("from '@/lib/i18n/fr'");
    expect(fr).not.toContain("from '@/lib/i18n/en'");
    expect(en).toContain("from '@/lib/i18n/en'");
    expect(en).not.toContain("from '@/lib/i18n/fr'");
  });

  /**
   * 🔴 Et l'enveloppe **ne doit pas** les importer : elle est dans le paquet des deux routes.
   * Un `locale === 'fr' ? <MessagesFr/> : <MessagesEn/>` ecrit ici paraitrait raisonnable et
   * remettrait les deux langues partout — les deux branches d'un ternaire sont dans le
   * paquet, meme celle qui ne s'execute jamais.
   */
  it('l enveloppe partagee ne nomme aucune langue', () => {
    const chrome = readFileSync('app/components/SiteChrome.tsx', 'utf8');
    expect(chrome).not.toContain('MessagesFr');
    expect(chrome).not.toContain('MessagesEn');
  });

  it('et chaque disposition racine passe la sienne', () => {
    expect(readFileSync('app/(fr)/layout.tsx', 'utf8')).toContain('Messages={MessagesFr}');
    expect(readFileSync('app/(site)/layout.tsx', 'utf8')).toContain('Messages={MessagesEn}');
  });
});

/**
 * 🔴 L'espace insecable a disparu une fois, en recopiant `frenchSpacing` d'un fichier a
 * l'autre : le caractere etait litteral, donc invisible, et la regle est devenue « remplace
 * une espace par une espace ». Onze cles reglementaires sont passees au rouge d'un coup.
 * `i18n.test.ts` l'a attrape ; ce test-ci nomme la cause pour qu'on ne la reintroduise pas.
 */
it('l espace insecable du francais est echappee, jamais collee au clavier', () => {
  const engine = readFileSync('lib/i18n/engine.ts', 'utf8');
  const declaration = /const NBSP = '(.)';/.exec(engine);

  expect(declaration?.[1]?.codePointAt(0)).toBe(0x00a0);
});

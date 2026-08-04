import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/**
 * Tout titre porte un cran de l'echelle. Aucun ne redecide sa taille sur place.
 *
 * ## Le defaut que ce test attrape — et la version d'avant ne l'attrapait pas
 *
 * `text-2xl font-semibold tracking-tight` etait recopie **seize fois** pour un titre de
 * page, `text-lg font-semibold tracking-tight` **huit fois** pour un titre de section, et
 * `text-sm font-semibold` **huit fois** pour un titre de panneau. Aucune des copies ne
 * savait qu'elle en etait une : meme forme d'echec que le bouton secondaire du 6.7, et que
 * les deux blocs d'affiche qui avaient diverge sans bruit.
 *
 * Ce que la duplication produit ici n'est pas un probleme de longueur de ligne. Des ecrans
 * avaient fini par ecrire leur `h2` en `font-semibold` **nu**, c'est-a-dire a la taille
 * exacte du corps de texte : sur ces pages la hierarchie visuelle n'existait plus du tout,
 * et **rien ne le signalait**. Ni le typage, ni les tests, ni le build ne voient qu'un titre
 * a la taille d'un paragraphe.
 *
 * ## 🔴 Pourquoi ce fichier a ete reecrit le 2026-08-05
 *
 * La premiere version posait la question **« ce titre ecrit-il une taille en trop ? »**.
 * C'est la mauvaise question, et la relecture l'a montre en comptant : le lot qui a introduit
 * l'echelle annoncait avoir repare les `h2` sans cran, il en a repare **trois** et laisse
 * **sept** — plus deux `h3`, que son motif `<h[12]` ne regardait meme pas. Les 734 tests
 * etaient verts.
 *
 * > **Une garde qui ne voit pas le defaut pour lequel elle a ete ecrite est un test creux**,
 * > et c'est la quatrieme fois dans ce depot. Un titre **sans** taille passait, puisqu'il
 * > n'en ecrit aucune — or c'etait exactement le defaut a attraper.
 *
 * La question est donc devenue **« ce titre porte-t-il un cran ? »**, ce qui refuse d'un
 * seul coup la taille en dur *et* la taille absente. Corollaire : `<h2>` nu n'est plus une
 * forme legitime. Il l'etait tant que `.section-title > :first-child` habillait le titre par
 * sa **position** — un selecteur qu'un simple element insere avant suffisait a defaire, sans
 * erreur et sans test. Ce cran s'appelle desormais `.row-title` et se pose sur le titre.
 *
 * ## Pourquoi lire la source
 *
 * Meme procede que `no-hardcoded-strings` et `no-journal-on-server` : ce sont des proprietes
 * du **code ecrit**, pas du rendu. Aucun montage ne dirait qu'un titre est nu, puisqu'un
 * titre nu s'affiche parfaitement.
 */

/**
 * ⚠️ Derive du fichier, jamais du repertoire courant.
 *
 * `readdirSync('app')` supposait que vitest tourne depuis la racine. Les trois gardes
 * voisines derivent toutes leur `ROOT` d'`import.meta.url`, et `no-hardcoded-strings` dit
 * pourquoi : « un test de conformite qui casse pour de mauvaises raisons apprend a etre
 * ignore ».
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Les cinq crans nommes, dans `app/globals.css`. */
const SCALE = [
  'page-title',
  'section-heading',
  'card-title',
  'empty-state-title',
  'row-title',
] as const;

/**
 * Les trois facons d'ecrire une taille a la main — et il a fallu les trois.
 *
 * 1. l'echelle nommee de Tailwind ;
 * 2. la **valeur arbitraire**, qui est l'echappatoire la plus naturelle pour qui est presse.
 *    L'unite est exigee dans le motif : `text-[#fff]` est une couleur, pas une taille ;
 * 3. le `style` en ligne, que rien de tout cela ne verrait.
 *
 * ⚠️ Aucun ne doit attraper `text-(--color-warn)` — la syntaxe couleur de Tailwind 4, qui
 * vit dans ce depot (`/mentions`) — ni `text-balance`, ni `tracking-[-0.02em]`.
 */
const HARDCODED = [
  { name: 'echelle Tailwind', pattern: /\btext-(xs|sm|base|lg|xl|\d?xl)\b/ },
  { name: 'valeur arbitraire', pattern: /\btext-\[[^\]]*(px|rem|em|%|ch|vw|vh)\]/ },
  { name: 'style en ligne', pattern: /fontSize/ },
] as const;

/** Un titre invisible n'a pas de taille : `sr-only` est une exception de nature, pas de gout. */
const SCREEN_READER_ONLY = /\bsr-only\b/;

/**
 * Les exceptions — **et chacune doit dire pourquoi**.
 *
 * C'est la valeur de ce test : il n'interdit pas la taille en dur, il oblige a la justifier.
 * Une exception sans raison ecrite est une exception que personne ne pourra reevaluer.
 *
 * ⚠️ **La cle contient la classe, et ce n'est pas un detail.** Elle etait le seul chemin du
 * fichier jusqu'au 2026-08-05, ce qui exemptait `app/(site)/page.tsx` **en entier** — donc
 * aussi son titre de rangee — et `Agenda.tsx` avec ses trois autres titres. Une exception a
 * la granularite du fichier protege ce qu'on n'a pas examine. Avec la classe dans la cle,
 * l'exemption **s'invalide d'elle-meme** des qu'on reecrit le titre : c'est la granularite
 * que `no-false-privacy-claim` obtient en exemptant une cle de dictionnaire, et non un
 * fichier.
 */
const ALLOWED = new Map([
  [
    'app/(site)/page.tsx::className="text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl"',
    // L'accroche du produit, pas une etiquette d'ecran. C'est le seul `h1` du site qui soit
    // une phrase ; il est deliberement au-dessus de l'echelle, et il est unique — donc pas
    // de classe, la regle du depot etant de n'extraire qu'a partir de trois repetitions.
    "l'accroche de l'accueil, seule de son espece",
  ],
  [
    'app/components/Agenda.tsx::className="text-sm font-semibold tracking-wide text-(--color-muted) uppercase"',
    // Une etiquette de groupe temporel (« Cette semaine »), en capitales et en `muted` :
    // elle ordonne une liste, elle ne titre pas une section. Forme distincte, usage unique.
    'etiquette de groupe temporel, pas un titre de section',
  ],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

type Heading = { readonly path: string; readonly tag: string; readonly attributes: string };

/**
 * Les titres d'un fichier, avec leurs attributs **quelle que soit leur forme d'ecriture**.
 *
 * ⚠️ On ne cherche plus `className="…"` entre guillemets : un `className={`…`}` ou un
 * `className={cx(…)}` etait **invisible**. Ce depot a deja commis ce faux negatif — le
 * recensement des classes du 2026-08-04 ratait `.tile`, ecrite dans un template literal, et
 * a failli la declarer morte. *Une verification mal ancree est pire qu'aucune : elle
 * rassure.*
 */
function headingsOf(path: string, source: string): Heading[] {
  return [...source.matchAll(/<(h[1-3])\b([^>]*)>/g)].map(([, tag, attributes]) => ({
    path,
    tag: tag ?? 'h?',
    attributes: (attributes ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

/** Ce qui cloche sur un titre, en clair — le message doit suffire a le reparer. */
function faultOf(heading: Heading): string | undefined {
  const { path, tag, attributes } = heading;
  if (ALLOWED.has(`${path}::${attributes}`)) return undefined;

  const hardcoded = HARDCODED.find(({ pattern }) => pattern.test(attributes));
  if (hardcoded !== undefined) {
    return `${path} — <${tag}> fixe sa taille a la main (${hardcoded.name}) : ${attributes}`;
  }

  if (SCREEN_READER_ONLY.test(attributes)) return undefined;

  const crans = SCALE.filter((cran) => new RegExp(`\\b${cran}\\b`).test(attributes));
  if (crans.length === 0) {
    const seen = attributes === '' ? '(aucun attribut)' : attributes;
    return `${path} — <${tag}> ne porte aucun cran de l'echelle : ${seen}`;
  }
  if (crans.length > 1) {
    return `${path} — <${tag}> porte ${crans.length} crans a la fois (${crans.join(', ')})`;
  }
  return undefined;
}

function faults(headings: readonly Heading[]): string[] {
  return headings.flatMap((heading) => faultOf(heading) ?? []);
}

const HEADINGS: readonly Heading[] = sourceFiles(join(ROOT, 'app')).flatMap((file) =>
  headingsOf(relative(ROOT, file).split(sep).join('/'), readFileSync(file, 'utf8')),
);

it('tout titre de app/ porte un cran de l echelle', () => {
  expect(faults(HEADINGS)).toEqual([]);
});

it('le motif attrape bien ce qu il vise', () => {
  // Sans cet ancrage, une expression cassee rendrait le test vert pour toujours — le defaut
  // le plus courant des tests qui verifient une absence, et ce depot l'a deja rencontre
  // trois fois. Chaque cas ci-dessous correspond a un faux negatif REEL de la version
  // precedente de ce fichier.
  const refused = (source: string) => faults(headingsOf('faux.tsx', source));

  // Le defaut de la session : un titre a la taille du corps de texte.
  expect(refused('<h2 className="font-semibold">B</h2>')).toHaveLength(1);
  expect(refused('<h2>B</h2>')).toHaveLength(1);
  // La taille en dur, sous ses trois formes.
  expect(refused('<h1 className="text-2xl font-semibold">A</h1>')).toHaveLength(1);
  expect(refused('<h1 className="text-[28px]">A</h1>')).toHaveLength(1);
  expect(refused("<h1 style={{ fontSize: '2rem' }}>A</h1>")).toHaveLength(1);
  // `h3` : le motif d'avant s'arretait a `h2`, et laissait donc passer TrajectorySection.
  expect(refused('<h3 className="mb-3 text-sm font-medium">C</h3>')).toHaveLength(1);
  // Le template literal, invisible a un motif qui exige des guillemets.
  expect(refused('<h2 className={`card-title ${x} text-lg`}>B</h2>')).toHaveLength(1);
  // Deux crans a la fois : ils se contredisent, et c'est l'ordre de la feuille qui tranche.
  expect(refused('<h2 className="card-title section-heading">B</h2>')).toHaveLength(1);

  // Et il laisse passer ce qui est correct — y compris les deux pieges de syntaxe.
  expect(
    refused(
      '<h1 className="page-title">A</h1><h2 className="row-title">B</h2>' +
        '<h2 className="sr-only">C</h2><h2 className="card-title text-(--color-warn)">D</h2>' +
        '<h1 className="page-title text-balance">E</h1>',
    ),
  ).toEqual([]);
});

it('l echelle lue est bien celle du depot', () => {
  // Un test qui parcourt zero fichier passe : on prouve d'abord qu'il y a de la matiere.
  expect(HEADINGS.length).toBeGreaterThan(30);

  // Et que les cinq crans existent reellement dans la feuille de style — sans quoi le test
  // protegerait une echelle qui n'est plus definie nulle part.
  const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  for (const cran of SCALE) expect(css).toContain(`.${cran} {`);
});

it('aucune exception ne survit au titre qu elle justifiait', () => {
  // Une exemption devenue inutile est un `--color-pulse` de plus : elle ment sur l'intention
  // et couvre un cas que personne ne reexaminera. Puisque la cle contient la classe, il
  // suffit qu'elle ne corresponde plus a aucun titre pour qu'on le sache.
  const seen = new Set(HEADINGS.map(({ path, attributes }) => `${path}::${attributes}`));
  expect([...ALLOWED.keys()].filter((key) => !seen.has(key))).toEqual([]);
});

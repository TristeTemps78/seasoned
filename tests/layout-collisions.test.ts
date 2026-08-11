import { expect, it } from 'vitest';
import { codeOf, filesUnder, pathOf, styleSheet } from './sources';

/**
 * Les collisions de mise en page — celles qu'aucun test de ce depot ne pouvait voir.
 *
 * ## Pourquoi ce fichier existe, et ce qu'il ne remplace pas
 *
 * Le 2026-08-11, une mesure au DOM contre le serveur de developpement a trouve **trois
 * defauts de mise en page** sous une suite de 956 tests verte, un typage vert et un build
 * vert :
 *
 *   1. `.show-header-overlap` demande `margin-top: -9rem`. Valeur calculee : **`0px`**. Le
 *      parent porte `space-y-10`, et l'utilitaire de Tailwind 4 pose `margin-block-start: 0`
 *      sur chaque enfant suivant — meme propriete calculee, cascade plus tardive. Le
 *      chevauchement banniere/en-tete, decrit sur douze lignes de commentaire comme *« ce qui
 *      fait la difference entre une page de contenu et une fiche de film »*, n'avait jamais
 *      ete rendu une seule fois.
 *   2. Les quatre mesures de la serie — dont l'**engagement**, le chiffre qui porte tout le
 *      differenciateur — etaient rendues dans une colonne de 304 px avec `sm:grid-cols-4` :
 *      quatre tuiles de **64 px de large et 257 px de haut**, libelles tronques (`dt`
 *      « COMMITMENT » : `clientWidth` 30, `scrollWidth` 97). `sm:` regarde la fenetre, pas le
 *      conteneur.
 *   3. `.series-aside` etait `max-height: calc(100vh - 6rem)` + `overflow-y: auto` +
 *      `scrollbar-width: none` : **566 px de contenu hors de vue**, sans barre pour le dire.
 *
 * ⚠️ **Aucun de ces trois n'est detectable ici, et il faut l'ecrire.** jsdom n'a pas de moteur
 * de mise en page : `getBoundingClientRect()` y rend des zeros, `getComputedStyle()` ne
 * resout pas la cascade des feuilles. Un test qui pretendrait les attraper mentirait.
 *
 * Ce que ce fichier attrape est ce qui **se lit dans la source** : les deux formes qui ont
 * rendu ces defauts possibles. Le reste se mesure au navigateur, contre le serveur de
 * developpement — c'est la meme lecon que `db:scenarios` contre la vraie base : *vert ne veut
 * pas dire marche.*
 */

const CSS = styleSheet();

/**
 * Les blocs de declaration de la feuille — selecteur + corps.
 *
 * ⚠️ **Les commentaires sont retires d'abord**, et il a fallu le corriger : `styleSheet()`
 * rend la feuille brute, et ce fichier-ci documente ses propres defauts en citant du CSS et
 * du JavaScript en prose. La premiere version a accuse `ShareReview.tsx` de porter une classe
 * `margin` — extraite de `getComputedStyle().marginTop` ecrit dans un commentaire deux
 * paragraphes plus haut. C'est le faux positif exact que `no-adhoc-typography` et
 * `no-dead-class` documentent tous les deux : *dans ce depot, la prose contient du code.*
 */
function blocks(): readonly { readonly selector: string; readonly body: string }[] {
  const code = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: (selector ?? '').trim(),
    body: body ?? '',
  }));
}

it('aucune boite ne cache verticalement sa barre de defilement', () => {
  /*
   * 🔴 Le defaut n°3. Une barre masquee sur un rail **horizontal** est legitime : le
   * debordement y est le message, la rangee coupee dit « il y en a plus », et une barre
   * grise sous chaque rangee d'affiches serait du bruit.
   *
   * Verticalement, c'est l'inverse exact : rien dans la page ne suggere qu'une colonne
   * defile, donc le contenu au-dela du pli est **perdu**. C'est ce qui a rendu la moitie de
   * « Ou j'en suis » — les notes de saison, les decisions, l'espace d'ecriture —
   * inatteignable pour qui ne devine pas qu'une boite muette defile.
   *
   * La regle : `scrollbar-width: none` n'est permis que la ou le defilement est horizontal.
   */
  const masquees = blocks().filter(({ body }) => /scrollbar-width:\s*none/.test(body));

  // Ancrage : un test qui n'examine aucun bloc passe pour la pire des raisons. Il y a bien
  // une barre masquee dans cette feuille, et c'est celle du rail — la seule permise.
  expect(masquees.map(({ selector }) => selector)).toEqual(['.rail']);

  const fautes = masquees
    .filter(({ body }) => !/overflow-x:\s*(?:auto|scroll)/.test(body))
    .map(({ selector }) => selector);

  expect(fautes, 'une barre verticale masquee cache du contenu sans le dire').toEqual([]);
});

it('toute classe a marge superieure negative est isolee d un conteneur `space-y`', () => {
  /*
   * 🔴 Le defaut n°1, sous la seule forme qui se lise dans la source.
   *
   * On ne peut pas resoudre la cascade ici. Ce qu'on peut faire, c'est verifier que chaque
   * classe dont la feuille dit qu'elle **remonte** (`margin-top` negatif) est employee dans
   * un fichier qui porte aussi la classe d'isolement correspondante — c'est-a-dire qu'un
   * conteneur dedie existe entre elle et le `space-y-*` de la page.
   *
   * ⚠️ La garde est volontairement grossiere : elle ne prouve pas la parente, elle prouve
   * qu'on y a pense. Sans elle, la prochaine remontee sera reecrite en frere direct d'un
   * `space-y`, elle vaudra `0px`, et **rien ne le dira** — c'est exactement l'histoire de
   * `.show-header-overlap`, restee morte sans que personne ne s'en apercoive.
   */
  const remontantes = blocks()
    .filter(({ body }) => /margin-(?:top|block-start):\s*-/.test(body))
    .flatMap(({ selector }) => selector.match(/\.([a-z][a-z0-9-]*)/g) ?? [])
    .map((one) => one.slice(1));

  // Ancrage : sans classes remontantes, la loi ci-dessous ne compare rien.
  expect(remontantes.length, 'aucune marge negative — la garde examinerait le vide')
    .toBeGreaterThan(0);

  const fautes = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .flatMap((file) => {
      const code = codeOf(file);
      return remontantes.flatMap((classe) => {
        const employee = new RegExp(String.raw`[\s"'\`{]${classe}[\s"'\`}$]`).test(code);
        if (!employee) return [];
        // Le fichier qui remonte quelque chose doit nommer son conteneur d'isolement.
        return /show-hero/.test(code) ? [] : [`${pathOf(file)} :: ${classe}`];
      });
    });

  expect(fautes, 'une remontee sans conteneur isolant sera annulee par le `space-y` du parent')
    .toEqual([]);
});

it('les mesures de la serie ne dependent pas d un point de rupture de fenetre', () => {
  /*
   * 🔴 Le defaut n°2. `sm:`, `md:`, `lg:` interrogent la **fenetre**. Dans un conteneur
   * etroit — la colonne laterale de 19 rem — ils demandent quatre colonnes dans 304 px et
   * personne ne les contredit : le typage passe, le build passe, la page s'affiche.
   *
   * `auto-fit` + `minmax` regardent la place reellement disponible. C'est la seule forme qui
   * reste juste quand le bloc demenage — et il a demenage le jour meme.
   */
  expect(CSS).toMatch(/\.series-measures\s*\{[^}]*repeat\(\s*auto-fit/);

  // ⚠️ La route `(site)`, jamais `(fr)` : la seconde ne fait que reexporter `SeriesView`, donc
  // une garde qui tombe dessus lit trois lignes d'import et ne verifie rien. Faux negatif
  // trouve a l'ecriture de ce fichier.
  const page = codeOf(
    filesUnder('app').find((file) => pathOf(file) === 'app/(site)/serie/[id]/page.tsx')!,
  );
  expect(page).toContain('series-measures');
  expect(
    /grid-cols-\d[^"'`]*\bsm:grid-cols-/.test(page),
    'les mesures ne doivent plus fixer leurs colonnes a la fenetre',
  ).toBe(false);
});

it('aucune face ne redessine son en-tete a la main', () => {
  /*
   * 🔴 Le defaut, releve en comparant les six faces le 2026-08-11 :
   *
   *   face          ecart au contenu   phrase d'accroche        balise
   *   /moi          space-y-8          text-(--color-muted)     header
   *   /calendrier   space-y-10         text-(--color-muted)     header
   *   /bilan        space-y-8          text-(--color-muted)     header
   *   /amis         space-y-6          prose-note               header
   *   /listes       space-y-6          prose-note               div
   *   /recherche    space-y-8          text-(--color-muted)     — aucun titre —
   *
   * Trois ecarts, deux traitements de la phrase, une face sans `<h1>`. Et l'accroche courait
   * sur **1120 px** la ou elle n'etait pas `.prose-note` (mesure sur `/moi`,
   * `max-width: none`), alors que la feuille declare la regle : *une phrase sur 1248 px ne se
   * lit pas.*
   *
   * La loi : le cran `page-title` ne s'ecrit que dans les deux composants qui ont le droit de
   * dessiner une tete de page. Partout ailleurs, on passe par `PageHeader` — ce qui donne au
   * meme coup la meme accroche bornee et le meme rythme.
   */
  /*
   * ⚠️ **Les exemptions sont des familles, pas des oublis** — et la premiere version de cette
   * garde etait trop large : elle accusait sept fichiers dont aucun n'avait le defaut. Une
   * garde qui reclame une refonte sans rien corriger est une garde qu'on apprend a ignorer,
   * ce que `no-hardcoded-strings` documente deja.
   */
  const AUTORISES = [
    // Le patron commun des six faces.
    'app/components/PageHeader.tsx',
    // De nature : `/u/<nom>` porte un **bloc d'identite** — avatar, pseudo, face, bouton
    // suivre — et non un titre suivi d'une phrase.
    'app/components/PublicProfile.tsx',
    // Les quatre documents. Ils forment **deja** une famille coherente : `.text-page` les
    // borne tous a 42 rem et tient leur rythme a 2 rem. Le defaut mesure — une accroche sur
    // 1120 px — ne peut pas s'y produire.
    'app/(site)/mentions/page.tsx',
    'app/(site)/confidentialite/page.tsx',
    'app/(site)/convertir/page.tsx',
    'app/(site)/regles/page.tsx',
    // Les pages dont le corps entier **est** un ecran vide : leur `<h1>` est le titre de cet
    // ecran, pas la tete d'une face. Un `PageHeader` y ajouterait une seconde tete.
    'app/(site)/hors-ligne/page.tsx',
    'app/(site)/serie/[id]/page.tsx',
  ];

  /**
   * La 404 existe **en double**, une par disposition racine — un seul `<html>` peut exister par
   * page, donc les deux langues ne partagent pas le fichier. Les nommer une par une ferait
   * oublier la troisieme le jour ou une langue s'ajoute, et la garde accuserait alors une page
   * correcte. Meme raisonnement que `MOUNTED_BY_THE_FRAMEWORK` dans `no-orphan-component`.
   */
  const MEME_FAMILLE = /(^|\/)not-found\.tsx$/;

  const fautes = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .filter((file) => !AUTORISES.includes(pathOf(file)) && !MEME_FAMILLE.test(pathOf(file)))
    .filter((file) => /\bpage-title\b/.test(codeOf(file)))
    .map((file) => pathOf(file));

  expect(fautes, 'un en-tete de page ecrit a la main finira par deriver — voir PageHeader').toEqual(
    [],
  );

  // Ancrage : la loi ne vaut que si les deux autorises l'emploient vraiment. Sans ca, elle
  // resterait verte le jour ou `page-title` disparaitrait de tout le depot.
  for (const chemin of AUTORISES) {
    const file = filesUnder('app').find((one) => pathOf(one) === chemin);
    expect(file, `${chemin} a disparu`).toBeDefined();
    expect(codeOf(file!)).toMatch(/\bpage-title\b/);
  }
});

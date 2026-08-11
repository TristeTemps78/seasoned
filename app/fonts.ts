import localFont from 'next/font/local';

/**
 * Les deux caracteres du produit (lot 9.6, 2026-08-07).
 *
 * ## Ce que cette decision remplace
 *
 * Jusqu'ici **aucune police n'etait chargee** : le site s'affichait en Segoe UI chez
 * Tristan, San Francisco sur Mac, Roboto sur Android. Le commentaire de `globals.css`
 * defendait ce choix par la CSP (`font-src 'self'`, donc pas de Google Fonts) — et la
 * conclusion ne suivait pas la premisse. `next/font/local` sert depuis
 * `/_next/static/media/`, c'est-a-dire **depuis `'self'`** : la contrainte interdisait un
 * *fournisseur tiers*, jamais une police.
 *
 * > C'est la meme forme d'erreur que « pas de Mac, donc pas de natif » (A11) : une
 * > observation vraie, une inference fausse, et personne ne la revalide parce qu'elle est
 * > ecrite comme un fait.
 *
 * Pire, le differenciateur n'avait pas de dessin non plus : la « grille monospace
 * tabulaire » que `CLAUDE.md` designe comme *le* caractere du produit etait la pile
 * systeme `ui-monospace, 'SF Mono', …`, **recopiee trois fois**. « 537 h », « S5E3 »,
 * « 26 mois » etaient donc dessines differemment sur chaque machine.
 *
 * ## Pourquoi ces deux-la
 *
 * - **Instrument Sans** plutot qu'Inter : Inter est la police par defaut du web moderne
 *   (GitHub, Vercel, Linear). L'adopter revient a choisir de n'avoir aucune identite,
 *   alors que le diagnostic de depart est « le site est hyper moche » au sens de « ca ne
 *   ressemble a rien ». Instrument Sans est, des trois candidats libres du banc d'essai,
 *   la plus proche de **Graphik** — la police de Letterboxd, la reference choisie par
 *   Tristan : grotesque legerement etroit, terminaisons horizontales, dense sans secheresse.
 * - **IBM Plex Mono** plutot que JetBrains Mono : JetBrains est un caractere de terminal,
 *   et le lot 9 nomme precisement le cliche a fuir — « l'exact cliche du tableau de bord
 *   technique », pour un produit dont le sujet est ce qu'on aime regarder. Plex a un dessin
 *   habite, et ce sont **ces chiffres qui sont le heros**.
 *
 * ## Le cout, mesure
 *
 * **43 Ko** au total (30 + 14), sous-ensemble **latin** uniquement — il porte e, e, a, c
 * et l'oe lie (U+0152-0153), donc tout le francais. Un titre en japonais ou en cyrillique
 * retombe sur la pile systeme, ce qui est le comportement voulu : on ne paie pas 200 Ko
 * pour des alphabets qu'aucune de nos deux langues n'emploie.
 *
 * `display: 'swap'` et non `'block'` : la police est servie par notre propre origine, donc
 * elle arrive vite ; bloquer l'affichage du texte pour l'attendre couterait plus cher que
 * le bref changement de dessin qu'on evite.
 */
// ⚠️ Le nom de l'export **devient le nom de famille CSS** — `next/font` le derive de lui.
// Un export nomme `sans` produit `font-family: sans`, illisible dans un inspecteur trois
// mois plus tard. Les noms explicites coutent zero et se lisent la ou on cherche.
export const instrumentSans = localFont({
  src: './fonts/InstrumentSans-Variable-latin.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-voltface-sans',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/**
 * La troisieme voix — le serif editorial (2026-08-11).
 *
 * ## Pourquoi une police de plus, alors que deux suffisaient
 *
 * Deux polices sans empattement font un **produit**. Ce qui manquait pour faire un
 * *magazine* — la reference que Tristan poursuit depuis trois passes — est la seconde voix :
 * un serif pour ce qui se **lit** (un titre d'accroche, le corps d'une critique), pendant que
 * le sans porte ce qui s'**utilise** (boutons, etiquettes, navigation).
 *
 * C'est la seule regle du brief que rien d'autre ne pouvait remplacer : ni une couleur, ni
 * une ombre, ni une densite ne donnent a un ecran son air imprime.
 *
 * ⚠️ **Jamais sur toute l'interface.** Un produit entierement en serif se lit comme un blog.
 * Deux emplois, et ils sont exhaustifs : `.hero-title` et `.review-prose`.
 *
 * ## Le cout, mesure et pas estime
 *
 * **58 Ko**, sous-ensemble latin, axe de graisse 400→600. Trois variantes ont ete pesees
 * avant de choisir :
 *
 *   Newsreader:wght@400          22 Ko   un seul poids — pas de titre gras
 *   Newsreader:wght@400..600     58 Ko   ← retenu
 *   Newsreader:opsz,wght         132 Ko  l'axe optique triple le fichier pour un gain nul
 *                                        a nos deux tailles d'emploi
 *
 * Le budget police passe de 43 a 101 Ko. `display: 'swap'` : le texte s'affiche
 * immediatement dans le repli, donc rien n'attend jamais ce fichier.
 */
export const newsreader = localFont({
  src: './fonts/Newsreader-Variable-latin.woff2',
  weight: '400 600',
  style: 'normal',
  display: 'swap',
  variable: '--font-voltface-serif',
  // ⚠️ Georgia d'abord : c'est le seul serif d'ecran present sur Windows **et** macOS, donc
  // le repli reste un serif au lieu de retomber sur un Times de rendu different partout.
  fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
});

export const plexMono = localFont({
  src: './fonts/IBMPlexMono-Regular-latin.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-voltface-mono',
  fallback: ['ui-monospace', 'SF Mono', 'Cascadia Mono', 'Segoe UI Mono', 'monospace'],
});

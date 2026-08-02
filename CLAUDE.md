# CLAUDE.md — seasoned

@AGENTS.md

## Notes spécifiques Claude

- Réponds en français. Dates absolues.
- Avant d'écrire : réserver dans `TASKS.md` (protocole `C:\Git project\WORKFLOW.md`).
- `npm run check` = typecheck + tests. Doit être vert avant tout commit.

## État actuel (2026-08-03, après-midi)

- **⏱️ Bilan personnel livré — et trois défauts de la même famille trouvés en le posant.**
  508 → **546 tests verts**, typecheck strict vert, build vert, 13 routes `○ Static`.
  **+1,38 Ko gzip** sur `/moi`. ⚠️ **Quatre commits non poussés** : un push est un
  déploiement public, décision de Tristan.
  - **`src/domain/tally.ts`** — « au moins 537 heures — 22 jours et 9 h ». Le
    différenciateur du produit (le temps chiffré) retourné vers soi, là où ces
    statistiques sont **payantes** chez Letterboxd. Le calcul se fait dans le navigateur :
    être gratuit y est structurel, pas généreux.
  - **La décision de conception : ne jamais compter deux fois.** `setDecision` n'efface pas
    la position, donc « passages achevés + position » compterait la dernière saison en
    double sur **toute** série finie. La position ne compte que si elle est **postérieure**
    au dernier passage — c'est l'usage pour lequel la v2 a rendu la date obligatoire sur
    chaque fait, deux sessions avant qu'on en ait besoin.
  - **Le chiffre s'annonce comme un minorant, et le prouve** : « au moins », plus le nombre
    de séries non comptables, plus un **silence** sous 50 % de couverture ou sous une heure.
  - 🔴 **Trois défauts, tous invisibles au typage** :
    1. **`episodeMinutes` n'était jamais écrit** — prop *à côté* de `series`, pas dedans.
       La feature livrée le matin même était **morte-née**.
    2. **`freshSnapshot` jetait la forme des séries à trente jours**, donc le bilan aurait
       ignoré les séries **terminées** — celles qui y pèsent le plus.
    3. **`isFresh` ne comparait pas les champs neufs**, rendant leur écriture invisible 24 h.
    > **La leçon** : *un champ qui existe n'est pas un champ qui est écrit.* Et la
    > vérification au navigateur **ne pouvait pas** le voir — le journal de test, écrit à la
    > main, portait déjà la valeur qu'on croyait écrire. **Troisième faux négatif de
    > fixture**, dans sa variante la plus retorse. Seul un test qui lit `localStorage`
    > **après** le rendu regarde l'écriture elle-même.
  - ⚠️ **Réserve sur la mesure** : les 207 Ko que je mesure ne sont **pas** comparables aux
    166 Ko du 2026-08-02 (méthodes différentes). Seuls les deltas le sont, et ils
    concordent. À réconcilier avant de citer un absolu.

## État précédent (2026-08-03, matin)

- **🔁 Rewatch livré — journal v3, la quatrième décision irréparable.** Le journal ne
  connaissait aucune notion de revisionnage : la position étant un pointeur unique,
  recommencer une série **écrasait** la progression précédente. Une **liste de dates**
  (donc un ensemble : union commutative, associative, idempotente par construction),
  dédupliquée **par jour** — sinon « vu 4 fois » compterait des synchronisations. La
  **série-refuge** en découle : le trait de goût le plus difficile à falsifier.
  - ⚠️ **`episodeMinutes` ajouté à l'instantané dans la foulée** : sans lui, aucun bilan
    de temps passé n'est calculable ailleurs que sur la page série, et **le manque serait
    rétroactif** (`/moi` ne fait aucun appel). Même règle que le rewatch — ce qu'on
    n'enregistre pas aujourd'hui manque pour toujours.
  - **Vérifié au navigateur sur un journal v2 réel**, migration comprise. La première
    vérification n'a rien prouvé : fixture aux instantanés expirés et trop peu de séries
    notées. *Se méfier de sa propre vérification* — deuxième faux négatif de ce genre.


- **✅ Tout est en ligne et vérifié en production (2026-08-03).** 26 commits poussés,
  CI verte, déploiement passé. **La faille XSS n'est plus en ligne.** Vérifié sur
  https://seasoned-two.vercel.app, pas déduit du code : `hreflang` réciproques et
  auto-référents sur les pages série (**dette ouverte depuis trois sessions, levée**),
  cache `HIT`, cinq en-têtes de sécurité, `robots.txt` couvrant les deux langues,
  sitemap à 107 URLs / 214 alternates, `lang` correct sur les 8 routes testées.
  - **`TMDB_LANGUAGE` : rien à faire, la variable n'est pas définie chez Vercel.**
    ⚠️ J'avais affirmé le contraire le matin même — c'était une sur-interprétation, le
    code alors déployé était antérieur à la bascule A10 et `DEFAULT_LOCALE` y valait
    encore `fr`. Détail et leçon dans `TASKS.md`.
  - **Les features vues sur de vraies séries** : BoJack Horseman « ça décolle à S1E8 »
    (la source citée en écrivant la proposition disait *exactement* cet épisode — c'est
    une concordance externe), Star Trek TNG S1E5 + décrochage S6, House of the Dragon
    « saison 3, 0,6 sous la moyenne ». Le silence reste majoritaire, comme annoncé.
- **Session du matin : les trois features de `NEXT-FIVE` qui se calculent sans un seul
  utilisateur.** 436 → **486 tests verts**, typecheck strict vert, build vert, 13 routes
  `○ Static`. Trois commits.
  - **F1 point d'entrée** (`entry-point.ts`) — « ça commence vraiment à S1E8 ». Le
    symétrique du point d'arrêt, et **le biais de survie joue en sa faveur** : ceux qui
    notent l'épisode 3 incluent tous ceux qui ont abandonné après.
  - **F4 plan de rattrapage** (`catch-up.ts`) — le chiffre qui compte est le **temps**, pas
    le nombre d'épisodes. Les plans intenables sont annoncés aussi.
  - **F2 verdict de la saison en cours** (`current-season.ts`) — se tait la plupart du
    temps, et son **placement dépend de la position** (règle 7).
  - **Coût mesuré : +0,3 Ko gzip et zéro appel réseau.** Les modules sont importés
    `import type` par la couche client : le calcul reste serveur.
  - **Deux trouvailles d'audit** : une borne manquante (`MAX_ENTRY_FRACTION` *grandit avec
    la série* — 8 M d'opérations sur *Detective Conan*, et un « conseil » de passer
    300 épisodes), et surtout **un test creux** — six tests de placement restaient verts
    quand on supprimait le code qu'ils surveillaient.
    > **La leçon** : sur un composant dont l'état arrive de façon asynchrone,
    > `findByText` puis une assertion **ne prouve rien**. Il faut attendre la condition
    > finale elle-même.
  - **Cinq nouvelles propositions** : `docs/NEXT-FIVE-2.md`. ⚠️ **Letterboxd bloque
    l'accès automatisé** (403 sur `/talk/` et `/about/suggestions/`, domaine refusé par le
    navigateur), Reddit aussi — les sources sont donc autres et le document le dit.

## État précédent (2026-08-03, nuit)

- **Session du 2026-08-03 : le filet, la langue, cinq gestes, et un audit qui a trouvé une
  faille.** 306 → **436 tests verts**, typecheck strict vert, build vert, 13 routes
  `○ Static`. Quatre commits — détail et suites dans `TASKS.md`.
  - **🔴 Une XSS réelle**, dans le JSON-LD des pages série. `JSON.stringify` **n'échappe
    pas `<`** : un titre TMDB valant `</script><script>…` refermait la balise et faisait
    exécuter la suite, sur toutes les pages servies depuis le cache de bord, avec accès au
    journal dans `localStorage`. Réparé par `lib/jsonld.ts`.
    > **La leçon** : les titres viennent de contributeurs TMDB. Au sens de la sécurité,
    > c'est une **entrée non fiable**. Le parsing tolérant (`AGENTS.md` règle 4) protège du
    > **mal formé**, pas du **malveillant** — et le premier a masqué le second tout le projet.
  - **La langue du catalogue ne suivait pas la page** — quatrième occurrence de la forme
    d'échec du projet. Le commentaire disait la règle, le code lisait `TMDB_LANGUAGE`, une
    variable **globale** valant `fr-FR` : les pages **anglaises**, celles que les moteurs
    indexent, servaient des synopsis français. Corrigé par un fournisseur par langue **et
    la locale dans la clé de cache** — sans quoi la première visite fixe la langue pour
    toutes les suivantes, selon qui arrive en premier.
  - **1.61 le harnais de composants** (deux projets vitest ; le domaine reste sous `node`,
    pour qu'une violation de la règle 2 ne puisse pas passer inaperçue) et **1.59 l'i18n
    des 18 modules client** — six défauts trouvés dans des fichiers marqués ✅, dont le
    `StatusBadge` anglais sur les pages françaises et **tous** les liens internes en dur.
    > **La leçon de la bascule se prolonge** : il ne suffit pas qu'une langue ait une
    > adresse, il faut que **les chemins y restent**.
  - **Vague A** : `remaining.ts` (« il vous reste 15 épisodes · 11 h 15 »), `nudge.ts`
    (le rappel de noter la saison finie), `calendar.ts` (`.ics` — le rappel que quelqu'un
    d'autre paie), `import.ts` + `/convertir` (**aucun format tiers connu nommément** :
    écrire un lecteur « Trakt » de mémoire serait la dette D10, TV Time a fermé et on ne
    peut plus en obtenir d'export).
  - **Mesuré, pas supposé** : **162 Ko gzip** sur `/`, 166 sur `/moi` — D13 refermée, la
    couche des gestes coûte ~4 Ko. En-têtes de sécurité posés (CSP **sans nonce**, assumé :
    un nonce impose un rendu par requête, donc détruit le cache).
  - **Cinq features proposées** : `docs/NEXT-FIVE.md`. ⚠️ **Reddit est bloqué dans cet
    environnement** (recherche et navigateur) — les sources sont donc autres, et le dire
    fait partie du travail.

## État précédent (2026-08-01)

- **🌍 A9 tranché par Tristan (2026-08-02) : le produit vise l'international.** Ce n'est pas
  un élargissement, c'est le **multiplicateur du seul canal qui marche à froid** — une page
  en français ne capte pas « is X worth watching ». Et le projet est bien placé : le
  différenciateur est **language-agnostic** (statut, temps écoulé, trajectoire, abandons se
  calculent sans langue ; `src/domain/` est muet et doit le rester — rien de `lib/i18n.ts`
  n'y est importé). Conséquences : le social **structuré** devient encore plus juste (un jeu
  fermé de réactions s'agrège mondialement, le texte libre fragmente par langue) ; ⚠️ **le
  coût catalogue est multiplié par le nombre de langues** ; la négociation par en-tête
  n'existe pas sur une page statique, donc la langue se décide à la construction ou côté
  client. **A10 tranché : `en` par défaut** (2026-08-02). Sur un site statique, « par
  défaut » n'est pas une préférence : c'est la langue de la page que les moteurs indexent.
  Livré : `lib/i18n.ts` (dictionnaire typé sur le français, donc clé manquante = erreur de
  compilation ; pluriel par `Intl.PluralRules` parce que le désaccord commence à **zéro** —
  « 0 jour » contre « 0 days »), `lib/format.ts` internationalisé **en premier parce que
  c'est lui qui est indexé**, plus le layout, l'accueil, la page série, les métadonnées et
  la langue du catalogue.
  > ✅ **Réparé le 2026-08-02 (1.60)** : `/` en anglais, `/fr` en français. Deux décisions
  > contre-intuitives, motivées dans `lib/routes.ts` — **l'anglais n'a pas de préfixe**
  > (préfixer casserait toutes les URL déjà indexées) et **aucune redirection selon
  > `Accept-Language`** (un middleware s'exécute à chaque requête et casse le cache donc le
  > budget ; Googlebot explore depuis les États-Unis et ne verrait jamais le français ;
  > et atterrir dans une autre langue que le lien cliqué est un bug).
  > La leçon reste : **changer un défaut ne suffit pas à servir une alternative — il faut
  > d'abord qu'elle ait une adresse.**
- **⚠️ Un `lang` qui ment, trouvé par la vérification et par elle seule.** Typage vert,
  306 tests verts, build vert — et `/fr` servait du français en s'annonçant `lang="en"`.
  Une page ne porte qu'un seul `<html>` ; il vivait dans une disposition racine unique qui
  écrivait la langue par défaut en dur. Réparé par **deux dispositions racines**
  (`app/(site)`, `app/(fr)`) de trois lignes chacune, tout le commun étant dans
  `app/components/SiteChrome.tsx`.
  > **Troisième occurrence de la même forme d'échec** — après le SEO en cul-de-sac et le
  > cache inopérant. La règle ne bouge pas : **auditer le résultat, jamais l'intention.**
  > ⚠️ Reste à vérifier **en production** : les `hreflang` des pages série n'ont pas pu être
  > observés en local (catalogue indisponible, la page servait son repli).
- **A1 tranché par Tristan : produit à utilisateurs.** Contraire à la recommandation de
  l'audit, actée. Les objections de l'audit ne disparaissent pas — elles deviennent le
  cahier des charges (`docs/ROADMAP-AUDIT.md` §6bis).
- **Phase 1 livrée. 101 tests verts, typecheck strict vert, build Next vert.**
- **Le renversement à retenir** (`ROADMAP.md` §0.1) : le corpus de textes ne s'amorce
  pas, donc **une page série doit valoir le détour avec zéro critique**. Le contenu vient
  des données dérivées, puis des gestes à un tap, puis des agrégats — **les textes en
  dernier**, pas en premier.
- **Ce qui existe** :
  - `RESEARCH.md` — état du terrain sourcé au 2026-07-31
  - `docs/RATING-MODEL.md` — granularité de notation + §6bis, la contrainte de spoiler
  - `ROADMAP.md` + `docs/ROADMAP-AUDIT.md` — le plan révisé et sa contre-expertise
  - `src/domain/` — types, normalisation des saisons, trajectoire, statut réel, horizon
    de spoiler. Tout pur, tout testé, **rien réécrit quand A1 est tombé à l'inverse**.
  - `src/catalog/` — `CatalogProvider`, cache à plafond contractuel, fournisseur TMDB.
  - `app/` + `lib/` — Next 16 / React 19 / Tailwind 4. Accueil, recherche, page série,
    `robots.txt`, `sitemap.xml`. ISR 24 h ; le build ne touche aucune API.
- **En ligne : https://seasoned-two.vercel.app** — dépôt public
  https://github.com/TristeTemps78/seasoned, redéploiement automatique à chaque push.
  **276 tests verts** (2026-08-02).
- **⚠️ Deux défauts de fusion corrigés le 2026-08-02, avant qu'il existe deux appareils**
  (`TASKS.md` lot 0). Ils étaient invisibles à un seul appareil et corrompaient
  silencieusement les données dès qu'il y en aurait eu deux :
  1. `laterOf` départageait les dates **égales** par l'ordre des arguments, donc
     `merge(a,b) ≠ merge(b,a)` : deux appareils fusionnant la même paire dans leur propre
     ordre divergeaient et se renvoyaient indéfiniment des journaux différents.
  2. Un fait sans date lisible recevait l'horloge de **celui qui lit** — deux appareils
     lisant le même journal donnaient au même fait deux dates. Repli passé à l'epoch ;
     l'horloge de lecture ne sert plus qu'à l'**expiration**.
  > **La leçon** : les deux se composaient. Un import donne la même date de repli à
  > beaucoup de faits, donc fabrique en masse les ex aequo que le premier défaut traitait
  > mal. Et surtout : `tests/journal.test.ts` couvrait la fusion par 410 lignes
  > d'**exemples** sans jamais rejouer une paire dans l'autre sens. **Un exemple prouve un
  > cas, une loi prouve la classe** — d'où `tests/journal-merge.test.ts`.
- **Le premier contact avec l'API réelle a révélé deux défauts** que les fixtures ne
  pouvaient pas voir, tous deux sur la promesse « ce qu'elle vous demande » (`TASKS.md`
  §1.10) : `episode_run_time` est abandonné par TMDB, et le repli sur le dernier épisode
  paru donnait un chiffre **faux du simple au double** (Stranger Things : 90 h au lieu de
  37). Corrigé par une **médiane** sur une saison représentative.
  > **Leçon à appliquer** : une fixture écrite de mémoire décrit l'API dont on se
  > souvient, pas celle qui existe. Les prochaines doivent être **capturées** depuis une
  > réponse réelle.
- **Les cinq statuts sont observés en conditions réelles**, zombie compris (*Majhi
  Manasa*, 26 mois). Le zombie était introuvable en devinant des titres connus ; il est
  apparu dès qu'une liste a été construite pour le faire remonter — **c'était la méthode
  de recherche qui était mauvaise, pas l'hypothèse**.
- **Le différenciateur a été recentré, chiffres à l'appui.** Sur 36 vignettes : ~20 en
  diffusion, ~9 « en attente · 1 à 5 mois », 1 seul « sans nouvelle · 26 mois ». La
  valeur est le **temps écoulé chiffré**, pas le cas zombie — qui en est la forme
  extrême, rare, et située dans la longue traîne où le trafic SEO n'est pas.
- **Le seuil de « sans nouvelle » n'est plus absolu** (`src/domain/cadence.ts`) : il suit
  le rythme observé de chaque série. Un seuil fixe traitait *Les Griffin*, qui revient
  chaque automne, comme *Stranger Things*, qui sortait tous les deux ou trois ans.
- **La trajectoire et le point d'arrêt sont en ligne**, dérivés des notes du public TMDB,
  derrière un geste explicite (règle de spoiler). *The Walking Dead* → arrêt après S6,
  ce qui correspond à sa réputation.
- **⚠️ Le cache est ce qui tient le budget, et il ne se vérifie qu'en production.**
  Pendant tout le début du projet, les pages série répondaient `X-Vercel-Cache: MISS` et
  `no-store` malgré leur `revalidate` — chaque visiteur rejouait tous les appels TMDB.
  Deux choses sont nécessaires ensemble : `dynamic = 'force-static'` sur la route (sans
  quoi Next 16 ne met jamais en cache une route dynamique) **et** le cache de données de
  l'hôte sur les appels (`{ next: { revalidate } }`), le cache mémoire étant inutile en
  serverless. La colonne « Revalidate » du build décrit l'intention, pas le cache réel.
- **Trois règles apprises à la dure, à ne pas défaire** :
  1. **Un instrument taillé pour des notes humaines ne s'applique pas à des moyennes de
     foule.** L'échelle en demi-étoiles, le seuil de rupture à une étoile et la
     normalisation de la constance supposent une dispersion qui n'existe pas — les notes
     d'une même série tiennent dans un point sur dix. D'où : les seuils sont des
     **paramètres**, et on affiche les faits (courbe, pic, décrochage) sans les jugements
     (forme, constance) sur des données de foule.
  2. **Un conseil exact mais sans portée ne vaut pas mieux que pas de conseil.** Un point
     d'arrêt qui épargne 8 % de la série ne s'affiche pas.
  3. **Auditer le résultat, jamais l'intention.** Le SEO était un cul-de-sac alors que
     tout le dispositif était en place ; le cache était inopérant alors que le build
     affichait « 1d ». Dans les deux cas le code était juste et l'effet nul.
- ⚠️ **Biais de survie, non résolu** : ceux qui ont vu la saison 6 de *Dexter* sont ceux
  qui ont persévéré, et ils la notent bien. Les notes publiques ne retrouvent pas les
  effondrements dont tout le monde parle.
- **Le nom n'est pas tranché (A4).** `seasoned.vercel.app` était déjà pris par un tiers —
  le mot est trop commun. Six domaines vérifiés libres à 35 $/an ; recommandation
  **`peaked.tv`**, repli `howfar.tv`.
- **Cinq faits qui déterminent tout le reste** (détail et sources dans `RESEARCH.md` §0) :
  1. **TV Time est mort le 2026-07-15** avec 26,4 M d'installations — motif : *pas
     soutenable en gratuit, pas assez de demande pour du payant*. Meilleure et pire
     nouvelle à la fois.
  2. Letterboxd promet les séries **depuis septembre 2023** et n'a pas livré.
  3. Serializd occupe la place et **craque techniquement** (serveurs lents, logs perdus,
     recherche cassée). Sa faiblesse est opérationnelle, pas conceptuelle.
  4. **La saisie manuelle est la cause n°1 d'abandon** des trackers.
  5. Personne n'a résolu la granularité de notation — c'est le seul terrain original.
- **Bloquant : les arbitrages de `ROADMAP.md` §4.** A1 en particulier (« à quoi sert ce
  projet ? ») — tant qu'il n'est pas tranché, tout choix en aval est arbitraire.
  Recommandation de l'audit : **outil personnel d'abord**, et l'argument est asymétrique
  (ça ne change presque rien au code des phases 0 à 3, et ça fait tomber d'un coup toutes
  les objections de viabilité).
- **Corrections déjà intégrées, à ne pas défaire** :
  - L'horizon de spoiler (`src/domain/spoiler.ts`) est né de l'audit §2. Sur Letterboxd
    l'état est binaire (vu / pas vu) ; sur une série c'est **un point sur un axe**, donc
    la trajectoire elle-même est un spoiler. `redactTrajectory` **recalcule** au lieu de
    masquer — un filtrage à l'affichage laisserait fuir le pic et le point de rupture par
    les agrégats.
  - `clampTtl` traite `Infinity` comme une durée à plafonner, pas comme une entrée
    invalide ; seul `NaN` annule la mise en cache.
  - Sur la page série, `unavailable` **n'est pas** une 404 : renvoyer 404 quand le
    catalogue est en panne dirait à un moteur de désindexer une page valide — ce qui
    saborde le canal d'acquisition n°1.
  - Les imports relatifs de `src/` et `lib/` sont **sans extension** : Turbopack ne
    résout pas le `.js` des sources TypeScript. `app/` utilise l'alias `@/`.
- **À relire en priorité par un autre agent** : `docs/ROADMAP-AUDIT.md`. Il a été écrit
  par l'agent qui a écrit le plan — c'est le « rédacteur = relecteur » qu'`AGENTS.md`
  interdit. Il le signale lui-même en tête.

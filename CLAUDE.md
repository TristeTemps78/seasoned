# CLAUDE.md — seasoned

@AGENTS.md

## Notes spécifiques Claude

- Réponds en français. Dates absolues.
- Avant d'écrire : réserver dans `TASKS.md` (protocole `C:\Git project\WORKFLOW.md`).
- `npm run check` = typecheck + tests. Doit être vert avant tout commit.

## État actuel (2026-08-03, soir — convergence de deux rapports externes)

- **🔀 Deux rapports Gemini confrontés au dépôt. Verdict : on ne refait rien** — et le
  raisonnement est vérifiable, pas affaire de goût. Analyse complète :
  **`docs/CONVERGENCE-RAPPORTS.md`**. **610 tests verts**, typecheck strict vert.
  - **L'inversion à retenir, parce qu'elle est dans les rapports eux-mêmes** : les deux
    ouvrent sur « TV Time est mort avec 26,4 M d'installations » et concluent « donc la place
    est libre ». Mais 26,4 M d'installations **sont** la demande — il est mort parce que son
    coût par utilisateur ne se monétisait pas. Or leurs recommandations sont presque
    intégralement une liste de coûts par utilisateur (Kafka, Redis, push, hébergement de GIF,
    modération de médias, sync Plex, apps tablette).
    > **Les rapports prescrivent en détail la cause de mort du cas qu'ils citent en ouverture.**
  - Retire ce qui est (a) impossible ici, (b) **déjà livré** — sept de leurs recommandations
    « indispensables » le sont —, (c) un coût par utilisateur : il reste **trois** éléments,
    tous petits. Ce que les rapports apportent de plus utile n'est pas une feature, c'est la
    **confirmation externe** que le diagnostic de `RESEARCH.md` est bon, par quelqu'un qui ne
    l'avait pas lu.
- **🔴 A11 — la contrainte « aucune application native » était FAUSSE, et c'est le résultat le
  plus important de la session.** `AGENTS.md` observait « pas de Mac, pas de Xcode » (vrai) et
  en concluait « aucune application native » (faux). Le contre-exemple était dans la phrase :
  `Limits` a produit un **IPA en Release** depuis ce PC, en CI, sur un runner macOS hébergé.
  Il n'a **jamais** buté sur le build — il a buté sur le **sideload sans compte développeur**.
  Les quatre arguments alignés par `ROADMAP.md` §1.1 (*sans compte* · *sans signature* · *sans
  magasin* · *sans le cycle de sept jours*) décrivent **tous** les conséquences du *free
  provisioning*, aucun celles du natif.
  - **Tranché par Tristan : natif iOS + Android.** Le mur était **~99 $/an + 25 $**, pas une
    impossibilité matérielle. Corrigé dans `AGENTS.md`, `ROADMAP.md` §1.1 et `app/manifest.ts`.
  - ⛔ **D16 : l'achat intégré Apple ponctionne A6** (15–30 %). A6 a été tranché *le matin
    même*, sans Apple dans l'équation — **à rechiffrer**. Bloque la tâche 4.8.
  - ⚠️ **D17 : le natif rend le push obligatoire** (un webview nu se fait refuser, règle 4.2),
    et le push ramène le planificateur serveur, donc le coût par utilisateur.
  - **Le web reste premier**, mais pour la bonne raison : une application n'a pas de SEO, donc
    le natif est un canal de **rétention**, pas d'acquisition. Et `src/domain/` n'important
    **rien**, la règle 2 — écrite pour la testabilité — se révèle être de la **portabilité**.
  > **La leçon** : *auditer le résultat, jamais l'intention* — **y compris celui de sa propre
  > documentation**. « Pas de Mac » est un fait ; « donc pas de natif » est une **inférence**,
  > restée écrite comme un fait et marquée « non négociable » dans le fichier que tous les
  > agents lisent en premier. **Une contrainte fausse dans une source de vérité coûte plus
  > cher qu'une contrainte absente : elle est crue, et personne ne la revérifie.**
- **🔴 Le calendrier déposait un pense-bête muet.** `calendar.ts` écrivait des `VEVENT` et
  **aucun** `VALARM` : les dates arrivaient dans l'agenda et **rien ne sonnait**. La promesse
  de son propre en-tête — « le rappel arrive même si l'on n'a pas rouvert le site depuis un
  mois » — était fausse. **12 → 20 tests.**
  - **Le déclencheur est positif (`PT9H`)** et ça ressemble à une faute : sur un événement de
    journée entière `DTSTART` vaut minuit, donc `-PT1H` sonnerait **à 23 h la veille** —
    exactement le rappel nocturne que le choix de la journée entière évitait. Et un
    `DTSTART;VALUE=DATE` n'ayant pas de fuseau, le même fichier sonne à 9 h **locales**
    partout, **sans que nous sachions où est qui**.
  - **Deux mutations vérifiées** plutôt que crues : retirer le `VALARM` fait tomber 5 tests,
    inverser le signe en fait tomber 1.
  > **La leçon** : les 12 tests d'origine vérifiaient tous la **conformité** du fichier, aucun
  > son **effet**. Un `.ics` valide qui ne rappelle rien passe toutes les vérifications qu'on
  > avait pensé à écrire. Le défaut a été trouvé **en confrontant, pas en relisant**.
- **Trois arbitrages tranchés, un en attente** (`TASKS.md`, tableau des arbitrages) :
  - ✅ **A11** natif iOS/Android (ci-dessus) ;
  - ✅ **A12** médias riches : **sélecteur d'un catalogue tiers + copie proxifiée, jamais
    d'upload**. Le *hotlink* est écarté parce que **Tenor appartient à Google** : chaque
    affichage enverrait IP + referer, ce qui casse « pas de publicité donc pas de traçage » —
    l'argument même qui rend A6 cohérent. ⛔ Livraison après 5.0 (modération).
    🔴 **Ma première objection était fausse** : ce n'est pas le GIF qui crée l'obligation DSA,
    c'est la couche sociale, texte compris. Ce que le GIF change est le **plafond de nuisance**.
  - 🟡 **A13 — le produit suit-il les films ? EN ATTENTE DE TRISTAN.** Le seul arbitrage de la
    session qui touche `src/domain/types.ts`, donc le seul qu'il vaut mieux ne pas prendre en
    retard. Ma reco : **les listes acceptent les films, le produit ne les suit pas** — un film
    n'a ni saison, ni position, ni trajectoire, donc **aucun** des quatre différenciateurs ne
    s'y applique, et on se mesurerait à Letterboxd sur son seul terrain imbattable.
    Explication en clair : `docs/CONVERGENCE-RAPPORTS.md` §1.
- **Trois choses fermées avec un chiffre**, à ne pas rouvrir sans fait nouveau :
  - **Kafka / Redis** : le mécanisme d'effondrement décrit (contention de lignes chaudes) **ne
    peut pas se produire** — `user_id uuid primary key`, chaque compte écrit sa propre ligne.
    Structurel, pas « pas encore assez d'utilisateurs ». Et **le projet a déjà le motif
    write-behind, en mieux et pour 0 €** : le tampon est `localStorage`, chez l'utilisateur.
    Le vrai axe est **Q8 / tâche 4.5** (octets par écriture), pas le débit.
  - **Scrobbling par webhooks** : exigerait la **première route serveur** du projet (zéro
    aujourd'hui), un jeton par utilisateur, la `service_role`.
  - **D15 — Trakt** : 🔴 j'avais recommandé de le lire comme source de position ;
    **l'enquête dit non.** Un compte gratuit ne connecte qu'**une seule** application externe,
    donc quelqu'un ayant déjà branché son scrobbler Plex — la population visée — **ne peut pas
    brancher VOLTFACE**. VIP à 60 $/an, usage commercial soumis à approbation.
- **🔴 `episode_groups` — la vraie trouvaille des rapports, tâche 4.4 (libre).** Zéro occurrence
  dans le dépôt. Chez un tracker un mauvais ordre d'épisodes = une case mal cochée, **visible**.
  Ici l'ordre est **l'entrée de tous les calculs** (`trajectory`, `entry-point`, point d'arrêt,
  `remaining`, `tally`) : le produit rendrait un conseil **faux avec assurance** et **rien ne le
  montrerait**. Réponse = règle 8, **signaler d'abord** ; le sélecteur d'ordre seulement si
  l'avertissement se révèle fréquent.
  - ⚠️ **D18 : `TMDB_ACCESS_TOKEN` est vide dans `.env`** — `episode_groups` n'a été vérifié
    qu'**en documentation**, jamais contre une réponse réelle. C'est le prérequis de 4.4 (D10).
- ⚠️ **La dérive D14 s'était reformée** : `CLAUDE.md` annonçait 562 tests, il y en avait 602
  avant cette session. Remis à 610.
- ⚠️ **Sept commits non poussés** (4 antérieurs + 3 de cette session). Un push est un
  déploiement public — décision de Tristan.

## État précédent (2026-08-03, soir — la navigation par faces)

- **💰 A6 tranché : freemium cosmétique** (référence Riot Games). Le seul modèle qui ne
  contredise **aucune** promesse déjà faite — pas de paywall sur les statistiques, pas de
  publicité donc pas de traçage, pas d'affiliation donc « où regarder » reste factuel. Et
  les cosmétiques étant produits par nous, ils n'ajoutent **aucune** charge de modération.
  > **La règle : on vend l'apparence, jamais la réponse.**
  - ⛔ **D6 est désormais active** : le freemium **est** un usage commercial de TMDB, qui
    exige un **accord écrit**. Action de Tristan, **avant la première vente**.
  - ⚠️ **Le revenu ne peut pas précéder le social.** Chez Riot, le cosmétique vaut parce
    qu'il est **vu** ; ici les profils sont `followers` par défaut. Le meilleur véhicule est
    `ShareCard`, qui sort du produit et se voit par des non-utilisateurs.
- **🧭 La navigation par faces est livrée** — `/`, `/moi`, `/calendrier`, `/bilan`. **562
  tests**, 19 routes statiques. **Quatre faces et pas six** : *Mes amis* et *Les listes*
  n'ont aucun contenu sans comptes, et une barre dont un tiers mène à « bientôt » apprend à
  ne plus cliquer dessus. Le logo garde ses six faces.
  - **Le calendrier a enfin un écran.** `calendar.ts` existait avec 12 tests et ne servait
    qu'à fabriquer un `.ics` : il fallait télécharger un fichier et ouvrir une autre
    application pour lire ce que le produit avait déjà calculé.
  - **Le bilan quitte `/moi`** : `/moi` dit *où j'en suis*, `/bilan` dit *qui je suis*.
  - ⚠️ **Trois défauts trouvés en câblant** : `themeColor` resté sur l'ancien fond, le lien
    « Ma bibliothèque » en double avec la barre, et l'export `.ics` présent sur les deux
    écrans.
    > **La leçon** : une navigation neuve ne s'ajoute pas, elle **remplace**. Tout chemin qui
    > menait déjà quelque part est à re-examiner, sinon on livre deux vérités concurrentes.

## État précédent (2026-08-03, après-midi)

- **🏷️ A4 tranché : le produit s'appelle `VOLTFACE`.** Dernier arbitrage bloquant avant un
  lancement public, ouvert depuis cinq sessions. **Volte-face = un revirement d'opinion** —
  c'est la promesse même du produit, et le seul nom de la liste qui la dise. Il porte aussi
  la direction artistique choisie (**volt** : cyberpunk, éclairs) et le logo (**face** : le
  cube). Libre au RDAP en `.tv`, `.app`, `.io` et `.dev` ; `.com` enregistré mais mort.
  - ⚠️ **Le domaine n'est pas enregistré — action de Tristan.** Un nom tranché et non
    réservé est exactement ainsi que `seasoned` a été perdu.
  - ⚠️ **Le code, les métadonnées et le dictionnaire disent encore « seasoned » partout.**
    Le renommage n'est pas fait et n'est pas trivial : `lib/site.ts`, les métadonnées, le
    manifeste PWA, le JSON-LD, les deux dictionnaires, le dépôt GitHub, le projet Vercel.
- **🎨 Direction prise (2026-08-03) : passer d'une page à une application.** Onglets,
  comptes, social, DA **cyberpunk**, logo en **cube 3D** aux faces colorées (fabriqué
  ailleurs — ne pas s'en occuper). Animation : **le cube se déplie en patron, les faces
  deviennent les onglets.** Livré : le renommage, la DA, et `docs/ARCHITECTURE-APP.md`.
  - **La DA est posée sur le châssis, jamais sur les vignettes** — « l'affiche est
    l'interface » reste la règle. Aucune police chargée (`font-src 'self'`) : le caractère
    vient de la **grille monospace appliquée aux chiffres**, qui sont le différenciateur.
  - **Le renommage n'était pas mécanique.** Trois chaînes désignaient des données déjà
    écrites chez l'utilisateur. Règle appliquée : **on migre ce qu'on contrôle, on ne touche
    pas à ce qui est parti ailleurs** — clé du journal migrée (avec relecture indéfinie de
    l'ancienne), UID des `.ics` **inchangé** (le changer créerait des doublons dans un agenda
    qu'on ne peut pas réparer).
  - ⚠️ **`connect-src 'self'` devra s'ouvrir vers Supabase.** Cette ligne rendait
    « rien ne sort de ce navigateur » **vérifiable** ; après, c'est une déclaration. Le texte
    de l'interface devra être réécrit, pas conservé.
  - ⚠️ **Le prérequis n'est pas l'argent, c'est la modération** (5.0, ⛔ bloquant). Ça
    démarre gratuitement — Supabase et Vercel offrent de quoi. Le DSA, non.
  - **✅ Q4 tranché (2026-08-03) : tout le monde a un compte, mais on circule d'abord.**
    Les six faces sont libres ; **le compte est demandé au premier geste** — et le geste
    **s'applique avant** l'invitation (« gardé sur cet appareil, créez un compte pour le
    retrouver ailleurs »). Ça évite par construction le défaut classique du modèle, le geste
    perdu pendant l'inscription, **sans écrire une ligne de « geste en attente »** : le
    journal local est déjà le tampon, et `mergeJournals` fait la montée.
    - ⚠️ **Le RGPD devient un prérequis de mise en ligne**, pas une finition : le premier
      compte crée une donnée personnelle.
    - ⚠️ **Jamais de fusion silencieuse à la connexion.** Sur un appareil partagé, elle
      verserait le journal du propriétaire dans le compte du visiteur. On demande, et le
      défaut est **non**.
  - **Toutes les questions d'architecture sont tranchées** (`ARCHITECTURE-APP.md` §7),
    et huit nouvelles ont été trouvées en cherchant les failles des premières. Les plus
    coûteuses si ratées :
    - **Q1 — trois états de visibilité, pas deux.** `followers` par défaut : le fil marche
      dès le premier suivi, mais l'indexation et l'inconnu restent fermés. Un profil public
      par défaut irait contre la protection par défaut du RGPD (⚖️ à confirmer).
    - **Q7 — les handles réservés doivent exister *avant* la première inscription.** Un
      handle attribué ne se retire pas sans casser une URL, et `@admin` ou `@moi` entrerait
      en collision avec une route.
    - **Q9 — `activity` purgée à 90 jours**, le même horizon que les traces de suppression :
      un chiffre qui s'accorde à un existant plutôt qu'un seuil inventé.
    - **Q12 — si la base tombe, le produit continue.** Bénéfice inattendu du local-first, à
      annoncer comme une fonctionnalité.
  - **Correction actée : le fil d'activité des amis ne spoile pas.** J'avais affirmé le
    contraire ; c'était surdimensionné. « Marie a noté *Breaking Bad* ★★★★ » ne révèle rien,
    et le nombre de saisons est public. Ce qui spoile est plus étroit : **les titres
    d'épisodes** et **les agrégats calculés**. Le fil remonte donc de la place 5 à la 4.

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

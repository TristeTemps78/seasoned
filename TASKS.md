# TASKS.md — ordonnancement

> Protocole : `C:\Git project\WORKFLOW.md`. **Réserver avant d'écrire** — passer la ligne
> à `🔒 in-progress — @agent — date`, committer la réservation, puis travailler.
> Statuts : `🟢 libre` · `🔒 in-progress` · `✅ done` · `⛔ bloqué`

---

## Arbitrages

| # | Tâche | Statut | Note |
|---|---|---|---|
| A1 | **À quoi sert ce projet ?** | ✅ 2026-08-01 | **Produit à utilisateurs.** Contraire à la reco de l'audit, actée. Conséquences : `ROADMAP.md` §0.1-0.2, audit §6bis |
| A2 | Valider le modèle de notation | 🟡 par défaut | Réputé validé, réserves §8 en vigueur |
| A3 | Social en v1 ? | ✅ 2026-08-01 | **Non — phase 5**, et sous condition de modération |
| A4 | **Le nom — `VOLTFACE`** | ✅ **tranché par Tristan, 2026-08-03** — ⏳ **domaine à enregistrer en FIN de projet** (choix de Tristan, 2026-08-03 : « c'est pas du tout ma priorité ») | **Volte-face = un revirement d'opinion, c'est-à-dire le produit lui-même** (« garder la trace de ce qu'on a pensé d'une série *dans le temps* »). Contient **volt** (la DA cyberpunk, les éclairs du logo) et **face** (les faces du cube). Vérifié au RDAP : **libre en `.tv`, `.app`, `.io`, `.dev`** — le seul candidat cohérent sur tous. `.com` enregistré mais mort (404, aucun produit). ⚠️ **À enregistrer — action de Tristan, non faite.** L'ancienne reco `peaked.tv` est abandonnée. |
| A5 | TMDB ou TheTVDB ? | ✅ 2026-07-31 | TMDB, derrière `CatalogProvider` — réversible |
| A6 | **Monétisation** | 🟡 non fermée | Volontairement non décidée. ⚠️ L'usage TMDB reste **non commercial** : affiliation ou freemium = accord écrit requis (`ROADMAP.md` §4.1) |
| A7 | **Note complète par épisode ?** | ✅ 2026-08-02 | **Oui, tranché par Tristan.** Contraire à `RATING-MODEL.md` §3 couche 2 (« on ne note pas les épisodes, on les distingue »). Comme A1 : les objections deviennent le cahier des charges — `docs/RATING-MODEL.md` §6ter |
| A8 | **Multiplateforme et passage à l'échelle** | ✅ 2026-08-02 | **Cinq plateformes (web, iOS, Android, macOS, Windows) par PWA installable**, et chaque feature doit passer le test « et si 100 000 personnes le font ? ». ⚠️ **La dernière clause de cette ligne était fausse et a été retirée le 2026-08-03** : elle disait « le natif reste matériellement impossible ici ». Voir **A11** — c'était une conclusion, pas un fait, et elle était démentie par le projet voisin. La PWA reste juste ; ce qui était faux, c'est qu'elle soit le **seul** chemin |
| A9 | **Le produit vise l'international** | ✅ 2026-08-02 | Tranché par Tristan. Détail §« 🌍 A9 » plus bas |
| A10 | **Quelle langue par défaut ?** | ✅ 2026-08-02 | **`en`.** Détail §« 🌍 A9 » plus bas |
| **A11** | **Applications natives iOS / Android ?** | ✅ **tranché par Tristan, 2026-08-03** | **Oui.** Et la contrainte qui l'interdisait était **fausse** : `AGENTS.md` observait « pas de Mac, pas de Xcode » (vrai) et en concluait « aucune application native » (faux). Vérifié : **EAS Build compile iOS sur des runners macOS en nuage, EAS Submit dépose depuis Windows** — 15 builds iOS/mois en gratuit. **Preuve dans le projet voisin** : `Limits` a produit un **IPA en Release** depuis ce PC, en CI ; il n'a jamais buté sur le *build* mais sur le **sideload sans compte développeur** (WSL2, `usbipd`, Sideloadly). Le mur n'est donc pas matériel, c'est **99 $/an Apple + 25 $ Google** — une ligne budgétaire, donc une décision de Tristan, prise. ⚠️ Conséquences en chaîne : **D16** (l'achat intégré Apple ponctionne A6), **D17** (un webview nu se fait refuser → le natif rend le push obligatoire → coût marginal par utilisateur) |
| **A12** | **Médias riches (GIF, mèmes) dans les critiques ?** | ✅ **tranché par Tristan, 2026-08-03** | **Oui, mais par sélecteur d'un catalogue tiers + copie proxifiée, dédupliquée par hash. Jamais d'upload libre.** Les trois variantes sont chiffrées dans `docs/CONVERGENCE-RAPPORTS.md` §2. L'upload est écarté (stockage non borné, droit d'auteur à notre charge) ; le *hotlink* aussi (Tenor appartient à Google : chaque affichage enverrait IP + referer, ce qui casse « pas de publicité donc pas de traçage », l'argument même qui rend A6 cohérent). ⛔ **Livraison après 5.0** (modération, DSA) : ce n'est pas le GIF qui crée l'obligation, c'est la couche sociale — mais le **plafond de nuisance** d'une image n'est pas celui d'un texte |
| **A13** | **Le produit suit-il les films ?** | 🔁 **révisé par Tristan, 2026-08-03 : séries seulement pour le moment** | Tranché « suivi complet » quelques heures plus tôt, puis **ramené aux séries seules**. ✅ **Rien n'est perdu, et le garde-fou 5.10a devient exactement l'implémentation de cette décision** : `seriesEntries` *est* ce qui garde les films hors des agrégats. Ce qui était une préparation devient l'application. `movieKey` / `isMovieKey` restent — testés, à coût nul, et ils documentent la couture pour le jour où la décision rebasculera. ✅ **Et ça referme une question ouverte sans avoir à la trancher** : un film devait-il compter dans le bilan d'heures (« heures de séries » → « heures d'écran ») ? Sans films, la question ne se pose plus |

---

## 🔀 Lot 4 — convergence de deux rapports externes (2026-08-03, soir)

> Deux rapports Gemini sur « la plateforme ultime de suivi de séries », confrontés au dépôt.
> Analyse complète et motifs : **`docs/CONVERGENCE-RAPPORTS.md`**.
> **Verdict : on ne refait rien.** Retire des rapports ce qui est (a) impossible ici,
> (b) déjà livré, (c) un coût par utilisateur qui a tué TV Time — il reste trois éléments,
> tous petits. Ce que les rapports apportent de plus utile n'est pas une feature : c'est la
> **confirmation externe** que le diagnostic de `RESEARCH.md` est bon, par quelqu'un qui ne
> l'avait pas lu.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 4.1 | **`AGENTS.md` : la contrainte natif était fausse** | ✅ 2026-08-03 | A11. C'est la source de vérité lue par **tous** les agents : une contrainte fausse y est plus coûteuse qu'absente, elle est **crue** (D14) |
| 4.2 | **`docs/CONVERGENCE-RAPPORTS.md`** | ✅ 2026-08-03 | Les quatre arbitrages et leurs motifs, pour qu'aucune session ne les rejoue |
| 4.3 | **`VALARM` dans le `.ics`** | ✅ 2026-08-03 | 🔴 **Défaut réel réparé** : `calendar.ts` émettait des `VEVENT` et **aucun** `VALARM` — les dates arrivaient dans l'agenda et **rien ne sonnait**. La feature « le rappel que quelqu'un d'autre paie » ne rappelait rien. **Le déclencheur est positif (`PT9H`)** et ce n'est pas une faute : sur un événement de journée entière `DTSTART` vaut minuit, donc le réflexe `-PT1H` sonnerait **à 23 h la veille** — précisément le rappel nocturne que la journée entière cherchait à éviter. Et un `DTSTART;VALUE=DATE` n'ayant pas de fuseau, le même fichier sonne à 9 h **locales** partout, sans qu'on sache où est qui. `SEQUENCE:1` ajouté, sinon le rappel n'atteindrait **que les nouveaux** et jamais ceux qui ont déjà le fichier muet. **12 → 20 tests**, et **deux mutations vérifiées** (retirer le `VALARM` fait tomber 5 tests ; inverser le signe, 1) — les 12 tests d'origine vérifiaient tous la **conformité** du fichier, aucun son **effet** |
| 4.4a | **`episode_groups` : détecter les découpages concurrents** | ✅ 2026-08-03 | `EpisodeGrouping` + `episodeGroups()` sur `CatalogProvider`, `mapEpisodeGroups` (parsing tolérant), et **`src/domain/ordering.ts`** pur. **624 → 639 tests.** ✅ **Vérifié contre l'API réelle**, pas seulement en documentation — les fixtures sont des **captures** (dette D10). Mesures : *Money Heist* défaut TMDB **3 saisons / 41 épisodes** contre Netflix **5 parts / 48** → « il vous reste X épisodes » se trompait de **17 %**, et « saison 4 » désigne une saison **qui n'existe pas** chez nous. *One Piece* : 18 découpages, dont Funimation à **−414 épisodes**. |
| 4.4b | **Câbler l'avertissement sur la page série** | ✅ 2026-08-03 | `episodeGroupings` (cache 24 h), `OrderingNotice` + `SeriesOrderings` — **composants serveur, zéro octet de JS**. **639 → 655 tests. Vérifié en production, pas déduit** : *Money Heist* affiche « 3 saisons · 41 épisodes » puis « Parts (edited version) — 5 saisons, 48 épisodes » et « et 1 autre découpage » ; *One Piece* « et 12 autres découpages » ; **GoT et The Walking Dead se taisent**. 🔴 **Le maillon que rien ne couvrait** : ni le test du calcul ni celui du composant ne prouvaient que la page appelle quoi que ce soit — le trou exact d'`episodeMinutes`. D'où (a) la partie asynchrone extraite dans `SeriesOrderings` pour que `render(await …)` traverse fournisseur → cache → domaine → écran, et (b) un test qui **lit la source de la page** (procédé déjà employé par `no-hardcoded-strings`). **Mutation vérifiée** : retirer `<SeriesOrderings />` fait tomber un test — sans lui, 655 tests restaient verts. ⚠️ **Défaut latent réparé au passage** : `setProvider` ne vidait que 4 caches sur 7 — `creatorCache` et `watchCache` y échappaient depuis leur création, donc un double injecté pouvait recevoir la réponse du fournisseur précédent selon l'ordre des fichiers de test |
| 4.5 | **Q8 : mesurer la taille du journal** | 🟢 libre | À faire **avant** de livrer les listes. Un `UPSERT` de `jsonb` réécrit **tout** le document : 500 titres repartent quand on ajoute le 501ᵉ. Les listes sont la première donnée de **taille non bornée** que le produit offrira. Si la mesure est mauvaise → sync **par delta**, pas un broker |
| 4.6 | **Option de masquage des heures** | 🟢 libre | `tally.ts` annonce « au moins 537 heures » et n'a **aucune** option de masquage (vérifié). Les rapports notent, à raison, que la métrique est anxiogène pour une part réelle des gens |
| 4.7 | **Rapport des titres non appariés à l'import** | 🟢 libre | Ne jamais écarter en silence : lister, et laisser résoudre à la main. Règles 8 et 9. ⚠️ Ne pas investir dans la voie TV Time (`DioCache.db` par ADB sur Android rooté) : population minuscule, et le flux **se tarit** depuis la fermeture du 2026-07-15 |
| 4.8 | **Piste natif : Android TWA d'abord, iOS Expo ensuite** | 🟢 libre | ⛔ **Ne pas ouvrir avant D16** (l'achat intégré Apple change A6). `src/domain/` n'importe **rien** : la règle 2, écrite pour la testabilité, se révèle être de la **portabilité** — les 19 modules partent tels quels. Ce qui ne part pas : `app/`, Tailwind, la couche SEO. ⚠️ **Un second codebase est ce qui tue les projets d'une personne seule** → partager le domaine, ne pas réécrire |

---

## 🎬 Lot 5 — les idées de Tristan, triées (2026-08-03, soir)

> Liste apportée par Tristan : parité Serializd, VPN/pays, quiz, scrobbling.
> Tri complet, avec ce qui est déjà fait et ce qui coûte quoi : **`docs/IDEES-TRIEES.md`**.
> **Rien n'est écarté ici** — tout est soit fait, soit chiffré, soit ordonné derrière son
> prérequis. Ce qui bloque n'est presque jamais l'idée : c'est **5.0, la modération**.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 5.10a | **A13 — le garde-fou des films** | ✅ 2026-08-03 | `isSeriesKey` / `isMovieKey` / `movieKey` / `seriesEntries` dans `journal.ts`, et les **quatre** agrégats bordés (`calendar`, `library`, `tally`, `taste`). *(⚠️ J'avais annoncé « 8 modules » : faux — les six autres reçoivent une série en argument.)* **610 → 624 tests.** `isSeriesKey` teste l'**absence de qualificatif** au lieu de `!isMovieKey`, pour qu'un futur `tmdb-book:` soit **exclu** et non compté comme série : *le garde-fou doit échouer vers l'exclusion — omettre n'est qu'un oubli, inclure corrompt.* 🔴 **Et il a attrapé un quatrième faux négatif de fixture** : `setSnapshot` ignore une entrée qui n'existe pas encore, donc mon fixture écrivait l'instantané **avant** le geste — aucun instantané n'était posé, ni pour la série ni pour le film, et les quatre égalités passaient en comparant deux agrégats **vides**. D'où le `describe` d'**ancrage**. **Trois mutations vérifiées** (filtre retiré : 5 échecs ; `!isMovieKey` : 1) |
| 5.10b | **A13 — les fonctionnalités film** | ⏸️ **suspendu par Tristan, 2026-08-03** | « Les séries pour le moment, pas les films. » Rien à faire, et **rien à défaire** : le garde-fou 5.10a tient la décision dans les deux sens |
| 5.11 | **Disponibilité multi-pays — une option dans les paramètres** | 🟢 libre — ✅ **forme tranchée par Tristan, 2026-08-03** | **Tristan : « je veux juste que ce soit une option à intégrer dans les paramètres »** — c'est un besoin qu'il cherche dans les applis qu'il utilise. Ça **converge** avec la recommandation : on ne détecte rien, on laisse choisir ses pays. Détecter un VPN exigerait d'inspecter l'IP côté serveur — donc du **traçage**, ce qui casse l'argument qui rend A6 cohérent — et c'est **peu fiable**. Or `/watch/providers` renvoie **tous les pays d'un coup**, dans l'appel que `tmdb.ts:471` fait déjà : « sur Netflix 🇬🇧, pas 🇫🇷 » est donc quasi gratuit. **On ne devine pas l'utilisateur, on le laisse choisir.** ⚠️ La liste de pays est une **préférence**, donc elle vit dans le journal (elle doit suivre d'un appareil à l'autre), pas dans un état de composant |
| 5.12 | **Changer l'affiche et la bannière** | 🟢 libre | La fonctionnalité la plus aimée de Serializd, et gratuite chez lui. Version propre : choisir parmi **les images que TMDB porte déjà** (`/tv/{id}/images` en renvoie plusieurs) — **aucun upload, aucun hébergement, aucune modération, aucune surface de droit d'auteur**. Même ruse que A12 |
| 5.13 | **Le quiz personnel** — « quelle série avez-vous vue le 7 janvier ? » | 🟢 libre | 🔴 **La meilleure idée de la liste.** Se calcule sur le **journal local** : zéro serveur, zéro compte, zéro modération, marche hors ligne. Et **structurellement incopiable** — il faut *votre* journal. ⚠️ Démarrage à froid : sans historique il n'y a pas de question, donc il doit **se taire** au début, comme les autres features du produit |
| 5.14 | **Boutons Détails / Où la regarder / Casting** + « plus de stats » | 🟢 libre | Travail d'interface, peu coûteux. La matière existe déjà en grande partie (`trajectory`, données par saison) |
| 5.15 | **Cœurs, en plus des demi-étoiles** | 🟢 libre | Le « j'aime » séparé de la note (motif Letterboxd) : une note dit la qualité, un cœur dit l'attachement — et ce n'est pas la même information. Petit |
| 5.16 | **Quiz publics + classements + 1v1** | ⛔ après 5.0 | ⚠️ **Deux pièges, pas un.** (1) **Spoiler** (règle 7) : « devine la série d'après ses notes par épisode » **révèle une trajectoire**, et `spoiler.ts` existe précisément parce que la trajectoire *est* un spoiler → à limiter aux séries **finies** ou **déjà vues** par le joueur. (2) **Triche** : toute réponse vérifiable dans l'API publique de TMDB est triviale à trouver, donc un classement exige un score calculé **côté serveur** |
| 5.17 | **Parité sociale Serializd** (profils, séries préférées, activité récente, recherche d'utilisateurs, compteurs vus/critiques/watchlist) | ⛔ après 5.0 | Déjà conçu pour l'essentiel dans `ARCHITECTURE-APP.md` §3-4. ⚠️ **Le démarrage à froid est le vrai sujet** : « 0 vu · 0 critique » affiché sur chaque page **annonce le vide**. Mieux vaut se taire que compter zéro |
| 5.18 | **Écran d'accueil avec des critiques** | ✅ **tranché par Tristan, 2026-08-03 — et il a une raison que je n'avais pas** | J'objectais que le corpus de textes ne s'amorce pas, donc qu'un tel accueil serait vide le premier jour. **Réponse de Tristan : les premiers utilisateurs seront sa famille.** L'objection tombe — à l'échelle d'une famille, il y **aura** des critiques dès le premier jour, et mon raisonnement supposait un lancement à des inconnus. ⚠️ **Mais le risque n'est pas annulé, il est déplacé** : il réapparaît au passage au public, quand le rapport « visiteurs / critiques » s'effondre. Donc l'implémentation reste **« un accueil qui se remplit »** — les données dérivées (trajectoires, statuts, temps) d'abord, les critiques **par-dessus** quand il y en a. Ainsi le même écran marche à 5 et à 50 000 utilisateurs, sans réécriture |
| 5.19 | **« Correspondant à l'algo de ton profil »** | 🟡 à reformuler | La recommandation algorithmique est un **non-but** documenté (`ROADMAP.md` §3) : c'est la commodité par excellence, et le produit se positionne sur le goût humain. **Mais `taste.ts` existe** : « des gens dont le goût ressemble au vôtre » n'est pas un algorithme de recommandation, c'est une **similarité de goût assumée et explicable**. La nuance vaut d'être gardée |
| 5.20 | **Scrobbling par notre propre extension de navigateur** | ✅ **tranché par Tristan, 2026-08-03** — 🟢 libre, **pas prioritaire** | **« On va recréer un scrobbling de zéro en créant une extension. »** ✅ **Et c'est moins cher que les webhooks que j'avais chiffrés** : une extension que nous signons peut écrire **par le chemin de synchronisation existant** (Supabase + RLS, `src/journal/remote.ts`) — donc **aucune route serveur nouvelle**, contrairement à un récepteur de webhooks Plex. Et comme ce produit n'a besoin que de **la position** (un champ), l'extension est bien plus simple que celle d'un tracker classique. ⚠️ **Le coût réel est ailleurs, en trois points** : (1) c'est un **second produit** à distribuer (Chrome Web Store 5 $, Firefox AMO, cycles de revue) ; (2) **les sites de streaming changent leur DOM en permanence** — l'extension casse en silence, c'est une charge d'entretien *récurrente*, pas un coût de construction ; (3) **navigateurs de bureau uniquement** — ni téléviseur, ni application mobile, c'est-à-dire pas là où l'essentiel du streaming se regarde. ⚠️ **Et c'est la chose la plus intrusive que le projet livrerait jamais** : la permission demandée dira « lire vos données sur netflix.com ». Sur un produit qui promet l'absence de traçage, ça doit être **opt-in**, et la donnée ne doit aller **que** dans le journal de la personne. *(Note factuelle : Trakt repose surtout sur des greffons de serveurs médias et son API ; les extensions de navigateur de son écosystème sont majoritairement tierces. **Simkl** est celui dont l'extension officielle fait ça. Ça ne change pas la décision, ça corrige la référence.)* D15 (Trakt) reste fermé |

### Ce qui est **fermé** par le lot 4, et ne doit pas être rouvert sans fait nouveau

| Écarté | Motif chiffré |
|---|---|
| **Kafka / Redis write-behind** | Le mécanisme d'effondrement décrit (contention de lignes chaudes) **ne peut pas se produire** sur ce schéma : `user_id uuid primary key`, chaque compte écrit sa propre ligne. Ce n'est pas « pas encore assez d'utilisateurs », c'est structurel. Et le motif *write-behind* **perd des données** au crash du broker — à prescrire en dernier à un produit dont le traumatisme fondateur est 26 M d'historiques perdus. Le vrai axe est **4.5**, pas le débit |
| **Scrobbling — webhooks Plex/Jellyfin/Emby** | Exigerait la première route serveur du projet (`find app -name route.ts` : **zéro**), un jeton par utilisateur, la `service_role` côté serveur, donc la principale surface d'écriture authentifiée à défendre. Pour refaire ce que Trakt fait depuis dix ans |
| **Scrobbling — lire Trakt comme source de position** | 🔴 J'avais recommandé d'investiguer ; **l'investigation dit non**. Un compte Trakt gratuit ne connecte qu'**une seule** application externe — donc quelqu'un qui a déjà branché son scrobbler Plex, c'est-à-dire exactement la population visée, **ne peut pas brancher VOLTFACE**. VIP est passé de 30 à **60 $/an**. Et l'usage commercial de l'API **exige une approbation** (même forme que D6). Demander à quelqu'un de payer 60 $/an à un concurrent pour utiliser notre produit gratuit n'est pas une fonctionnalité |
| **Widgets** | Aucun accès utilisable depuis une PWA sur iOS ni Android |

---

## Phase 0 — Socle ✅

| # | Tâche | Statut | Agent |
|---|---|---|---|
| 0.1 | Dépôt, outillage, TypeScript strict, vitest, CI | ✅ 2026-07-31 | @claude-opus |
| 0.2 | Types de domaine (`src/domain/types.ts`) | ✅ 2026-07-31 | @claude-opus |
| 0.3 | Normalisation des saisons (`seasons.ts`) — le risque n°1 du modèle | ✅ 2026-07-31 | @claude-opus |
| 0.4 | Moteur de trajectoire (`trajectory.ts`) — pic, constance, point de rupture | ✅ 2026-07-31 | @claude-opus |
| 0.5 | Statut réel (`status.ts`) — démasque les séries zombies | ✅ 2026-07-31 | @claude-opus |
| 0.6 | Horizon de spoiler (`spoiler.ts`) — issu de l'audit §2 | ✅ 2026-07-31 | @claude-opus |
| 0.7 | `CatalogProvider` + cache à plafond contractuel + TMDB | ✅ 2026-07-31 | @claude-opus |
| 0.8 | Recherche, roadmap, audit | ✅ 2026-07-31 | @claude-opus |
| 0.9 | **Relecture par un autre agent** (`/code-review`) — rédacteur ≠ relecteur | 🟢 libre | ⚠️ prioritaire, et plus encore depuis A1 |
| 0.11 | Docs alignées sur A1 (roadmap, audit §6bis, modèle §6bis) | ✅ 2026-08-01 | @claude-opus |

---

## Phase 1 — Catalogue public, conçu pour le SEO

**Canal d'acquisition n°1** — le seul qui fonctionne sans aucun utilisateur. Ni compte,
ni base. C'est ce qui rend une page utile à zéro critique (`ROADMAP.md` §0.1).

| # | Tâche | Statut | Note |
|---|---|---|---|
| 1.1 | Application Next.js App Router + Tailwind | ✅ 2026-08-01 | Next 16 / React 19 / Tailwind 4. `src/` et `lib/` réutilisés sans modification |
| 1.2 | `lib/catalog.ts` — provider + cache partagé | ✅ 2026-08-01 | Compose catalogue + domaine ; calcule l'engagement total |
| 1.3 | Recherche de séries | ✅ 2026-08-01 | `<form method=GET>` sans JS — la requête devient une URL |
| 1.4 | Page série : saisons, épisodes, dates, durée totale | ✅ 2026-08-01 | |
| 1.5 | Affichage du **statut réel** | ✅ 2026-08-01 | Le différenciateur. `lib/format.ts` chiffre le silence d'une série zombie |
| 1.6 | SEO : métadonnées, JSON-LD, `robots.txt`, `sitemap.xml` | ✅ 2026-08-01 | Sitemap volontairement minimal — voir `app/sitemap.ts` |
| 1.7 | ISR 24 h — le trafic ne doit rien coûter | ✅ 2026-08-01 | Le build ne touche aucune API : vérifié en CI sans secret |
| 1.8 | Attribution TMDB | ✅ 2026-08-01 | Dans le pied de page, sur toutes les pages |
| 1.9 | Dégradation si le catalogue tombe | ✅ 2026-08-01 | Message lisible au lieu d'une 500. `unavailable` ≠ 404 : ne pas faire désindexer une page valide |
| 1.10 | **Vérifié contre l'API TMDB réelle** | ✅ 2026-08-01 | A révélé **deux défauts invisibles hors ligne** — voir ci-dessous |
| 1.11 | Dépôt GitHub public | ✅ 2026-08-01 | https://github.com/TristeTemps78/seasoned — CI verte au premier push |
| 1.12 | **Mise en ligne** | ✅ 2026-08-01 | **https://seasoned-two.vercel.app** — redéploiement automatique à chaque push |
| 1.13 | Chercher un cas « zombie » | ✅ 2026-08-01 | **Aucun sur 12 séries.** Résultat, pas échec — a produit un recentrage du différenciateur, voir plus bas |
| 1.14 | **Découvrabilité** — l'accueil et le sitemap ouvrent le chemin vers `/serie/*` | ✅ 2026-08-01 | 0 → 20 liens ; 1 → 147 URLs |
| 1.15 | Statut réel visible sur les vignettes | ✅ 2026-08-01 | Hydratation réservée aux pages en cache. Home restée `○ Static` / 1d — vérifié au build |
| 1.16 | Maillage interne entre pages série | 🟢 libre | Une page série ne renvoie vers aucune autre : cul-de-sac pour le crawl comme pour le visiteur |
| 1.17 | Fixtures **capturées** depuis de vraies réponses TMDB | 🟢 libre | Dette D10 — les fixtures actuelles sont écrites de mémoire |
| 1.18 | Filtre de vitrine par nature de programme | ✅ 2026-08-01 | `src/domain/program.ts`. Sitemap 146 → 110 pages série. Ne filtre que la vitrine, jamais le catalogue |
| 1.19 | **Seuil de « sans nouvelle » relatif au rythme de la série** | ✅ 2026-08-01 | `src/domain/cadence.ts`. Corrige *Les Griffin*, préserve *Majhi Manasa*. Calibrage du facteur ouvert → D12 |
| 1.20 | Calibrer `CADENCE_ANOMALY_FACTOR` sur un échantillon réel | 🟢 libre | D12. Mesurer, pas régler au jugé |
| 1.21 | **La trajectoire s'affiche**, sur les notes du public TMDB | ✅ 2026-08-01 | Derrière un geste explicite. `computeTrajectory` servait enfin — après trois corrections, voir ci-dessous |

### ✅ 1.35 → 1.56 — Bloc du 2026-08-02, sous contraintes A7 et A8

Vingt-six boucles à contre-sens ont fait apparaître trois failles de fond : le produit
**se souvenait sans lieu de restitution** ; le **seul geste offert supposait la série déjà
commencée** alors que les arrivants viennent du SEO ; et le **multiplateforme est un
problème d'identité et de fusion**, que le format d'alors rendait impossible sans perte.

> ⚠️ **Statuts remis en accord avec le code le 2026-08-03** — c'est la dette D14 : quinze
> lignes ci-dessous étaient encore `🟢 libre` alors que le code correspondant est en
> production depuis le 2026-08-02. Vérifié fichier par fichier, pas de mémoire.

| # | Tâche | Statut | Preuve dans le code |
|---|---|---|---|
| 1.35 | **Clés de journal préfixées par fournisseur** (`tmdb:1396`) | ✅ 2026-08-02 | `journalKey()` dans `src/domain/journal.ts` |
| 1.36 | **Fusion au niveau du champ** — deux appareils ne se perdent pas | ✅ 2026-08-02 | `mergeJournals`, 8 lois dans `tests/journal-merge.test.ts` |
| 1.37 | **Port `JournalStore`** — patron `CatalogProvider` | ✅ 2026-08-02 | `src/journal/store.ts` + `local.ts` |
| 1.38 | **Garantie anti-fuite** : aucun journal côté serveur | ✅ 2026-08-02 | `tests/no-journal-on-server.test.ts` |
| 1.39 | **Manifeste + icônes** — l'application devient installable | ✅ 2026-08-02 | `app/manifest.ts` |
| 1.40 | **Service worker minimal + page hors-ligne** | ✅ 2026-08-02 | `app/components/ServiceWorker.tsx`, `app/(site)/hors-ligne` |
| 1.41 | Journal v2 : watchlist, notes d'épisode, snapshot à TTL, plateformes | ✅ 2026-08-02 | `journal.ts` v2 |
| 1.42 | `src/domain/library.ts` et `taste.ts` — purs | ✅ 2026-08-02 | 27 tests |
| 1.43 | **« Je veux la voir »** — le premier geste possible | ✅ 2026-08-02 | `setWanted`, `MyProgress` |
| 1.44 | **Étoiles cliquables** au lieu du `<select>` | ✅ 2026-08-02 | `StarRating.tsx` |
| 1.45 | **Grille d'épisodes vivante** : position + mes notes + commutateur | ✅ 2026-08-02 | `EpisodeGrid.tsx` |
| 1.46 | `MyProgress` : suggestion de note de saison, placeholder correct | ✅ 2026-08-02 | `MyProgress.tsx` |
| 1.47 | **`/moi`** — le lieu qui manquait, zéro appel API | ✅ 2026-08-02 | `app/(site)/moi/` |
| 1.48 | **Export / import JSON** — règle 9 d'`AGENTS.md` | ✅ 2026-08-02 | `JournalTransfer.tsx` |
| 1.49 | Bande **« Reprendre »** sur l'accueil | ✅ 2026-08-02 | `ResumeStrip.tsx` |
| 1.50 | **`redactTrajectory` branché** — la courbe se révèle à mesure | ✅ 2026-08-02 | `TrajectorySection.tsx` |
| 1.51 | **Mes plateformes** — « dispo chez vous » | ✅ 2026-08-02 | `MyPlatforms.tsx` |
| 1.52 | **Profil de goût** | ✅ 2026-08-02 | `TasteCard.tsx`, `taste.ts` |
| 1.53 | **Trajectoire partageable en image** (canvas, côté client) | ✅ 2026-08-02 | `ShareCard.tsx` |
| 1.54 | `npm run check` + build `○ Static` + test anti-fuite | ✅ 2026-08-02 | 306 tests |
| 1.55 | Vérification au navigateur, PWA comprise (hors-ligne) | ✅ 2026-08-02 | |
| 1.56 | Mesures : poids JS, coût à 100 000, en-têtes en production | 🔒 in-progress — @claude-opus — 2026-08-03 | D13 rouvert : le chiffre de 194 Ko date d'avant la couche des gestes |

### 🔒 Bloc du 2026-08-03 — le filet, la langue, et les cinq gestes qui manquent

**Réservé — @claude-opus — 2026-08-03.** Motif, et non liste de tâches : le produit sait
**se souvenir** et sait **parler deux langues**, mais les deux ne se rencontrent pas —
seize modules `'use client'` sont en français en dur *et* sans un seul test. Migrer seize
fichiers sans filet est précisément le geste qui casse en silence. D'où l'ordre : le
harnais d'abord, la langue ensuite, les gestes après.

| # | Tâche | Statut | Motif |
|---|---|---|---|
| 1.61 | Harnais de test de composants (`jsdom`, `include` en `.tsx`) | ✅ 2026-08-03 | Deux projets vitest. **Le domaine reste sous `node`** : un `document` global rendrait invisible une violation de la règle 2 |
| 1.59 | Migrer les composants client vers le dictionnaire | ✅ 2026-08-03 | Contexte de langue + `tests/no-hardcoded-strings.test.ts`. Six défauts trouvés, voir ci-dessous |
| A4 | **« Il vous reste 15 épisodes · 11 h 15 »** | ✅ 2026-08-03 | `src/domain/remaining.ts`, 12 tests |
| A5 | Rappel de noter la saison qu'on vient de finir | ✅ 2026-08-03 | `src/domain/nudge.ts`, 9 tests. Un seul rappel à la fois |
| A2 | Import des exports concurrents | ✅ 2026-08-03 | `src/domain/import.ts`, 14 tests. **Aucun format connu nommément** — voir le motif |
| A3 | `/convertir` — la page qui capte les orphelins | ✅ 2026-08-03 | Indexable, au sitemap, liée depuis chaque pied de page |
| A6 | Calendrier `.ics` des prochains épisodes | ✅ 2026-08-03 | `src/domain/calendar.ts`, 12 tests |
| 1.62 | **Langue du catalogue par page** | ✅ 2026-08-03 | Un fournisseur par langue, la locale dans la clé de cache. Voir ci-dessous — c'était sévère |
| 1.63 | **Faille XSS dans le JSON-LD** | ✅ 2026-08-03 | `lib/jsonld.ts`. Voir ci-dessous |
| 1.64 | En-têtes de sécurité HTTP | ✅ 2026-08-03 | CSP sans nonce, assumé : un nonce détruirait le cache |
| 1.56 | Mesures : poids JS, en-têtes en production | ✅ 2026-08-03 | D13 refermée : **162 Ko gzip** sur `/`, 166 sur `/moi` |

### 🔴 Ce que l'audit du 2026-08-03 a trouvé, et que rien d'autre ne voyait

Quatre défauts, tous dans du code déclaré fait, tous invisibles au typage et aux tests.

**1. Une faille XSS réelle dans les données structurées.** La page série injectait
`JSON.stringify(jsonLd)` dans une balise `<script>`, avec en commentaire « contenu
construit par nous, jamais du HTML tiers ». Le raisonnement est faux sur un point :
**`JSON.stringify` n'échappe pas `<`**. Un titre valant `</script><script>…` refermait la
balise et faisait exécuter la suite — sur toutes les pages servies depuis le cache de
bord, donc pour tous les visiteurs, avec accès au journal rangé dans `localStorage`.

> **Ce que ça apprend** : *les titres viennent de TMDB, alimenté par des contributeurs.*
> Au sens de la sécurité, c'est une entrée non fiable, au même titre qu'un champ rempli
> par un visiteur. Le parsing tolérant (`AGENTS.md` règle 4) protège du **mal formé**,
> pas du **malveillant** — et le premier a masqué le second pendant tout le projet.
>
> Détail savoureux : la première version de `lib/jsonld.ts` écrivait `U+2028` en clair,
> et **le compilateur TypeScript a refusé de la lire**. La démonstration la plus courte
> possible de ce contre quoi la fonction protège.

**2. La langue du catalogue ne suivait pas la page — quatrième occurrence.**
`lib/catalog.ts` portait ce commentaire depuis le premier jour : « la langue du catalogue
doit suivre celle du site : servir une page anglaise avec des synopsis français serait
pire que ne pas traduire du tout ». Et le code lisait `TMDB_LANGUAGE`, **une variable
globale**, qui valait `fr-FR`. Donc les pages **anglaises** — celles que les moteurs
indexent, le canal d'acquisition n°1 — servaient des synopsis français.

Corrigé par un fournisseur par langue **et la locale dans la clé de cache**. Le second
point est le plus vicieux : sans lui, la première requête d'une série fixe la langue de
son synopsis pour toutes les suivantes, `/serie/1396` et `/fr/serie/1396` se servant
mutuellement leur contenu **selon qui arrive en premier**. Un défaut qui ne se reproduit
pas à la demande et disparaît à chaque redémarrage. `tests/catalog-locale.test.ts` le
mesure sur le **nombre d'appels**, seule façon de le rendre visible.

**3. `robots.txt` ne couvrait que l'anglais.** `/recherche`, `/moi`, `/hors-ligne` étaient
exclus ; `/fr/recherche`, `/fr/moi`, `/fr/hors-ligne` ne l'étaient pas. Le budget de crawl
partait sur des pages vides par construction. La liste est désormais **dérivée** des
langues servies.

**4. Six défauts d'i18n dans des fichiers marqués ✅.** Le bandeau de sécurité devinait sa
langue via `navigator.language` — sur `/fr`, un navigateur anglophone recevait un bandeau
anglais **au milieu d'une page française**. `StatusBadge` ne recevait pas la locale : le
différenciateur même du produit s'affichait en anglais sur les pages françaises.
« Disponibilité en France » était servi en dur à des lecteurs américains. La virgule
décimale était codée en dur. Et **tous** les liens internes étaient absolus : depuis `/fr`,
chaque clic ramenait en anglais — vers des adresses qui, pour `/fr/moi` et `/fr/recherche`,
n'existaient même pas.

> **La leçon de la bascule se prolonge d'un cran.** On savait qu'il ne suffit pas de
> changer un défaut pour servir une alternative — il faut qu'elle ait une adresse. Il
> faut aussi que **les chemins y restent**.

### Ce que l'audit a mesuré plutôt que supposé

| Sujet | Résultat |
|---|---|
| **Poids JS** (D13) | **162 Ko gzip** sur `/`, **166 Ko** sur `/moi`. La couche des gestes — 18 modules client — coûte donc **~4 Ko** : le reste est le socle Next/React. L'ancienne ligne « 194 Ko pour zéro composant client » était fausse **dans les deux sens**. |
| En-têtes servis | Aucun avant. Désormais CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` — vérifiés sur la réponse réelle, cache toujours `HIT`. |
| CVE `sharp` (haute) | **Non exploitable ici, et vérifié** : `images.unoptimized: true` et **aucun `next/image`** dans le dépôt, donc le chemin de code n'est jamais exercé. Next 16.2.12 est déjà la dernière version — rien à mettre à jour. Consigné plutôt que maquillé. |
| CVE `esbuild` (modérée) | Fermée : vitest 2 → 4. |
| Code mort | 92 exports sans usage externe, dont **3 vrais** (re-exports de confort). Le reste est de l'inférence de types — faux positifs assumés. |

**⚠️ CSP sans nonce, et c'est un arbitrage, pas un oubli.** Une politique à nonce est la
seule qui neutralise vraiment le script injecté ; elle exige une valeur différente **par
réponse**, donc un rendu par requête, donc la destruction du cache de bord — c'est-à-dire
de ce qui tient le budget. `script-src` reste permissif, tout le reste est fermé, et le
seul endroit où du contenu tiers entre dans une balise `<script>` est traité à la source.

---

### 🔒 Bloc du 2026-08-03 (matin) — les trois features calculables sans utilisateurs

**Réservé — @claude-opus — 2026-08-03.** Motif : `docs/NEXT-FIVE.md` classe les cinq
propositions par un seul critère — les trois premières se calculent **sans un seul
utilisateur**, donc elles nourrissent le seul canal qui marche à froid. Les implémenter
maintenant coûte trois modules purs et **zéro appel réseau supplémentaire** : toutes les
données sont déjà chargées et en cache sur la page série.

| # | Tâche | Statut | Motif |
|---|---|---|---|
| F1 | **Point d'entrée** — « ça commence vraiment à S1E8 » | ✅ 2026-08-03 | `src/domain/entry-point.ts`, 15 tests. Le biais de survie joue **en sa faveur** |
| F4 | **Plan de rattrapage** — « 14 épisodes en 12 jours » | ✅ 2026-08-03 | `src/domain/catch-up.ts`, 11 tests. Le chiffre qui compte est le **temps** |
| F2 | **Verdict de la saison en cours** | ✅ 2026-08-03 | `src/domain/current-season.ts`, 10 tests. Se tait la plupart du temps |

### 🔁 Rewatch — journal v3 (2026-08-03) ✅

**La quatrième décision irréparable**, et la seule proposition de `NEXT-FIVE-2` qui se
périmait. Le journal ne connaissait **aucune** notion de revisionnage : la position étant
un pointeur unique, recommencer une série **écrasait** la progression précédente. Le
produit ne perdait pas une statistique, il perdait le fait — et les visionnages passés
qu'on n'enregistre pas ne se devinent pas.

| Décision | Motif |
|---|---|
| Une **liste de dates**, pas des « passages » complets | Un ensemble : l'union est commutative, associative et idempotente **par construction**, donc les huit lois de fusion tiennent sans effort. Des passages identifiés demanderaient un identifiant stable qu'aucun appareil ne peut attribuer seul |
| Déduplication **par jour**, pas par instant | Deux appareils qui synchronisent enregistrent le même achèvement à quelques millisecondes d'écart. Dédupliquer sur l'horodatage exact ferait de « vu 4 fois » un compteur de synchronisations |
| Fusion par **union**, jamais « le plus récent gagne » | Un visionnage achevé sur un appareil ne peut pas être invalidé par un autre. Vérifié en cassant la règle : 2 tests sur 20 tombent |
| Geste attaché à la décision « terminée » | La décision décrit un **état** qui se retire ; un visionnage est un **événement** qui ne se retire pas. `markCompleted` étant idempotent dans la journée, basculer dix fois ne compte jamais dix visionnages |

**La série-refuge** en découle (`taste.ts`) : *« Ma série-refuge — Breaking Bad — vue
3 fois »*. C'est **le trait de goût le plus difficile à falsifier** — on peut poser cinq
étoiles par enthousiasme d'un soir, on ne revoit pas trois fois quarante heures par erreur.

> ⚠️ **Vérifié au navigateur sur un journal v2 réel**, donc migration comprise. Et la
> première vérification n'a rien prouvé : ma fixture avait des instantanés vieux de sept
> mois — donc **expirés par le plafond contractuel**, comportement correct — et trop peu de
> séries notées pour que le profil parle. *Se méfier de sa propre vérification* reste la
> règle : c'est la deuxième fois qu'une fixture biaisée donne un faux négatif.

**Trouvé par cette même vérification** : une série rangée dans « Terminées et abandonnées »
affichait **« à voir »** dès que son instantané n'avait pas de libellé de statut — ce qui
arrive dès qu'il expire. La vignette contredisait la section qui la contient. La décision
passe désormais avant le repli.

### 🏁 Bloc du 2026-08-03 (soir) — Voltface : le nom, la peau, le plan, et la navigation

| # | Tâche | Statut | Note |
|---|---|---|---|
| **A6** | **Monétisation** | ✅ **tranché** | **Freemium cosmétique**, référence Riot Games. Le produit reste entièrement gratuit ; on vend l'apparence, **jamais la réponse** |
| 1.70 | **La navigation par faces + l'écran calendrier** | ✅ 2026-08-03 | `Faces.tsx`, `Agenda.tsx`, `MyStats.tsx`. **562 tests**, 19 routes statiques |

| 2a | **Le socle légal + les handles réservés** | ✅ 2026-08-03 | `src/domain/handles.ts` (13 tests), `lib/legal.ts`, `/mentions` et `/confidentialite` dans les deux langues. **580 tests**, 23 routes |

#### 2a — trois décisions qui ne se rattrapent pas

**1. L'identité de l'éditeur ne vit pas dans le dépôt.** Il est public (règle 5) : un nom
ou une adresse postale committés y resteraient **dans l'historique**, où un `revert` ne les
enlève pas. Elles arrivent de l'environnement Vercel, et se corrigent donc sans
redéploiement. ⚠️ **Tant qu'elles manquent, `/mentions` le dit** au lieu d'afficher un
texte à trous qui aurait l'air complet — même règle que partout ici : signaler, jamais
remplir la case.

**2. Les handles réservés existent avant le premier compte.** Un handle attribué ne se
retire pas : c'est une URL, donc un lien partagé et un signet. Trois risques traités —
la **collision de route** (`@calendrier` contre `/calendrier`), l'**usurpation par
homoglyphe** (`а` cyrillique est indiscernable de `a` latin, d'où un jeu de caractères
restreint à l'ASCII : l'attaque devient *impossible* plutôt que difficile à détecter), et
l'**héritage** (un handle libéré ne revient jamais en circulation).

> **Le test a trouvé du bruit dans ma propre liste** : `sw` (2 caractères) et `hors-ligne`
> (tiret interdit) n'auraient **jamais** pu être pris. Une réserve inutile laisse croire à
> une protection qui n'a jamais servi. Retirés.

**3. L'âge est fixé à 16 ans** — le seuil de référence du RGPD, et non les 15 ans français.
Pour un produit international, le plus élevé est le seul qui ne demande pas de logique par
pays. Déclaratif, **aucune date de naissance collectée** : un âge exact serait une donnée
de plus à protéger pour un gain nul.

**La politique de confidentialité décrit ce qui est vrai aujourd'hui** — rien ne sort du
navigateur, et c'est *vérifiable* par `connect-src 'self'`. Sa dernière section annonce
déjà ce que les comptes changeront, avec la règle qui va avec : **cette page se met à jour
avant que le comportement change, jamais après.** Une politique qui décrit l'état précédent
est pire qu'une absence — l'absence n'affirme rien.

| 2b | **Auth + journaux + synchronisation** | 🔒 in-progress — @claude-opus — 2026-08-03 | Supabase. SDK pour l auth (import dynamique), fetch pour les données |
| 1.71 | **Le design cesse de cacher le différenciateur** | ✅ 2026-08-03 | Ton `waiting`, pastille sur l'affiche, engagement en évidence, hero compact, bandeau repliable |

#### 1.71 — le diagnostic tenait en une phrase

**La direction artistique n'existait que sur l'onglet actif, et le différenciateur du
produit était peint en gris.** Quatre corrections, toutes sur la même faute — *le regard
n'avait aucune raison d'aller au bon endroit* :

| Défaut | Correction |
|---|---|
| « en attente · 7 mois » avait le ton **`neutral`**, donc gris | Un ton **`waiting`** : ni « ça se passe maintenant », ni « anomalie », mais **l'attente qualifiée** — l'accent du produit |
| Le statut vivait **sous** l'affiche, en fin de ligne | Il passe **sur** l'affiche, en pastille. Sur vingt vignettes on lit l'état d'un coup d'œil, **sans lire** |
| « ~50 heures » avait le même poids que « 29 septembre 2013 » | Une seule carte brille. En mettre deux en avant reviendrait à n'en mettre aucune |
| Le hero occupait un écran entier pour trois lignes | Compacté : on voit des séries dans la même vue que la promesse |

Le bandeau de sécurité devient **repliable** : déployé sur chaque page, il poussait le
contenu réel sous la ligne de flottaison partout. *Un avertissement qu'on voit trop cesse
d'être lu.*

#### 🔴 Ce que le design a rendu visible : la vitrine montre du mauvais contenu

En regardant la rangée « En attente » avec ses pastilles enfin lisibles : **Inspecteur
Barnaby, Saber y Ganar, 1 Rue Sésame, Hockey Psychology.** C'est D11 — le filtre par genre
n'attrape pas la longue traîne — **mais il y a une cause plus profonde, et elle est
mécanique** :

> **Trier par attente décroissante sélectionne les séries obscures.** Les séries populaires
> en attente ont 1 à 5 mois ; celles à 7 mois et plus sont, par construction, dans la longue
> traîne. Le tri optimise le **spectaculaire** (le plus long silence) au détriment de la
> **reconnaissance** — et la vitrine du produit en paie le prix.

⚠️ **Non corrigé** : c'est un arbitrage éditorial, pas un défaut technique. Trois options, à
trancher par Tristan — filtrer sur une popularité minimale avant de trier par attente ;
pondérer les deux ; ou assumer et changer le sous-titre. **Aucun travail de design ne
compensera une vitrine dont les titres ne parlent à personne.**

#### A6 — ce que le freemium cosmétique débloque, et ce qu'il bloque

C'est le seul modèle qui **ne contredise aucune promesse déjà faite** : pas de paywall sur
les statistiques (le bilan a été construit *contre* celui de Letterboxd), pas de publicité
donc pas de traçage, pas d'affiliation donc « où regarder » reste factuel. Et les
cosmétiques étant **produits par nous**, ils n'ajoutent aucune charge de modération.

⚠️ **Deux conséquences dures :**

| | |
|---|---|
| **D6 passe de dormante à active** | Le freemium **est** un usage commercial de TMDB, qui exige un **accord écrit** — établi dès `RESEARCH.md` §300. ⛔ **Action de Tristan, avant la première vente.** Repli documenté : changer de fournisseur reste *un module à réécrire* (règle 3) |
| Le revenu ne peut pas précéder le social | Chez Riot, le cosmétique vaut parce qu'il est **vu**. Ici les profils sont `followers` par défaut et le fil sera vide longtemps. Le meilleur véhicule est donc `ShareCard`, qui sort du produit et se voit par des **non-utilisateurs** |

#### 1.70 — quatre faces et pas six, et c'est le point

Livrer *Mes amis* et *Les listes* en coquilles vides aurait été ce que l'architecture
s'interdit — *on ne remplit pas une face de faux contenu*. Une barre dont un tiers des
entrées mène à « bientôt » apprend surtout à ne plus cliquer dessus.

**Le calendrier existait depuis le matin même, avec 12 tests, et ne servait qu'à fabriquer
un `.ics`** : il fallait télécharger un fichier et ouvrir une autre application pour lire ce
que le produit avait déjà calculé. La forme d'échec la mieux documentée du dépôt, refermée.

**Trois défauts trouvés en câblant**, tous invisibles au typage :

1. **`themeColor` était resté sur l'ancien fond** (`#0f1115`) : l'application installée
   encadrait une teinte qui n'existait plus nulle part depuis la DA.
2. **Le lien « Ma bibliothèque » de l'en-tête faisait doublon** avec la barre.
3. **L'export `.ics` apparaissait sur `/moi` *et* sur `/calendrier`** — exactement la faute
   que je venais de reprocher au point 2.

> **La leçon** : une navigation neuve ne s'ajoute pas, elle **remplace**. Chaque chemin qui
> menait déjà quelque part doit être re-examiné, sinon on livre deux vérités concurrentes.

### 🏁 Bloc du 2026-08-03 (soir) — Voltface : le nom, la peau, et le plan de l'application (suite)

| # | Tâche | Statut | Note |
|---|---|---|---|
| A4 | **Le nom** | ✅ tranché | `VOLTFACE`. Voir en tête de fichier |
| 1.67 | **Renommage `seasoned` → `Voltface`** | ✅ 2026-08-03 | Le nom vit dans **une seule** constante (`lib/site.ts`) ; il était en dur à sept endroits. **550 tests** |
| 1.68 | **Direction artistique cyberpunk** | ✅ 2026-08-03 | `globals.css`. Sur le **châssis**, jamais sur les vignettes |
| 1.69 | **Architecture de l'application** | ✅ 2026-08-03 | `docs/ARCHITECTURE-APP.md`. Document, aucun code |

#### ⚠️ Le renommage n'était pas mécanique — trois chaînes sont des données d'utilisateur

**La règle : on migre ce qu'on contrôle, on ne touche pas à ce qui est parti ailleurs.**

| Chaîne | Décision | Motif |
|---|---|---|
| `STORAGE_KEY` | **migrée** vers `voltface.journal.v1` | Renommer sans plus **efface le journal de tout le monde** — le navigateur ignore que les deux clés désignent la même chose. L'ancienne est relue **indéfiniment** et jamais supprimée : un journal dort des mois dans un navigateur fermé |
| **UID des `.ics`** | **inchangée** | Un UID est l'identité d'un événement pour l'agenda qui l'a reçu. Le changer ne renomme rien : il crée un **doublon** dans un agenda qu'on ne contrôle pas et **qu'on ne peut pas réparer** |
| Clé du bandeau de sécurité | inchangée | Elle ne retient que « déjà écarté ». La migrer le ferait réapparaître pour rien |

La source d'import `'seasoned'` était un **discriminant interne**, jamais écrit dans le
fichier exporté (vérifié : `serializeJournal` ne sérialise que version et entrées).

✅ **Migration confirmée en conditions réelles** au navigateur : le journal de test était
rangé sous l'ancienne clé, la bibliothèque s'est affichée sans rien perdre. Plus quatre
tests, vérifiés en débranchant la migration.

#### 🔴 Correction : le fil d'activité des amis ne spoile pas

J'avais écrit que la règle 7 bloquait le social. **C'était faux et surdimensionné**, corrigé
par Tristan. « Marie a noté *Breaking Bad* ★★★★ » ne révèle rien de l'intrigue, et le nombre
de saisons d'une série est public.

Ce qui spoile est plus étroit, et se traite **à l'affichage** : les **titres d'épisodes**
(beaucoup racontent l'épisode) et les **agrégats calculés** (« 78 % abandonnent après la
S6 » est un jugement sur la suite — c'est le domaine de `redactTrajectory`).

> **La leçon** : une règle de sécurité appliquée trop large coûte une feature entière. Le
> fil passe de la place 5 à la place 4 dans l'ordre des lots.

#### Ce que le passage à contre-sens a trouvé dans ma propre architecture

**Un document JSON par utilisateur ne se requête pas.** « Les vingt derniers gestes de mes
amis » aurait exigé de charger le journal entier de chaque ami — impossible dès la dizaine.
D'où une **projection** (`activity`), dérivée du document et **entièrement
reconstructible** : on peut donc se tromper sur sa forme sans rien perdre.

Et deux pièges nommés : **l'inondation par import** (500 séries reprises = 500 lignes chez
tous les amis — plafond de 20 par jour, puis une ligne agrégée) et **les dates de repli à
l'epoch**, qui se neutralisent seules mais méritent un test, parce que quelqu'un
« corrigera » ce repli un jour sans savoir ce qu'il tient.

### 🔒 Bloc du 2026-08-03 (après-midi) — le bilan personnel, et le trou qui le bloquait

**Réservé — @claude-opus — 2026-08-03.** Motif : `docs/NEXT-FIVE-2.md` §4 annonce que le
bilan personnel se calcule avec ce qui existe déjà. **C'est encore faux, pour la seconde
fois.** La fiche avait manqué `episodeMinutes` (livré ce matin) ; en relisant le code, son
**jumeau** apparaît — `JournalSnapshot` ne mémorise pas les **tailles de saisons**. Or
`/moi` ne fait aucun appel réseau : une position « S3E7 » y est donc **incomptable**, faute
de savoir combien d'épisodes font les saisons 1 et 2. `episodeMinutes` seul ne chiffre rien.

Même règle que le rewatch : **ce qu'on n'enregistre pas aujourd'hui manque pour toujours**
aux visites déjà faites. D'où l'ordre — le champ d'abord, la feature ensuite.

| # | Tâche | Statut | Motif |
|---|---|---|---|
| 1.65 | **`seasonSizes` dans l'instantané** — le troisième champ irréparable | ✅ 2026-08-03 | Réutilise le type `SeasonSize` de `remaining.ts`, donc le bilan consomme sans adaptation. Champ facultatif + parsing tolérant = **aucune migration**, pas de bump de version |
| 1.66 | **Bilan personnel** — « au moins 537 heures » | ✅ 2026-08-03 | `src/domain/tally.ts` (24 tests) + `MyTally.tsx` (6 tests). Zéro appel, **+1,38 Ko gzip**. 508 → **546 tests** |

#### 🔴 Trois défauts trouvés en le posant, tous de la même famille

Aucun n'était visible au typage. Les trois disent la même chose : **un champ qui existe
n'est pas un champ qui est écrit, et un champ qui est écrit n'est pas un champ qui survit.**

**1. `episodeMinutes` n'était jamais écrit — la feature du matin était morte-née.** Il
arrive dans `MyProgress` en prop **à côté** de `series`, pas dedans. `SeriesShape` le
déclarait, la page série ne le remplissait pas : pas un seul instantané ne l'a jamais porté.
Tout le bilan repose dessus.

> ⚠️ **La vérification au navigateur ne pouvait pas le voir**, parce que le journal de test
> était écrit à la main et portait déjà la valeur qu'on croyait écrire. C'est le **troisième
> faux négatif de fixture** du projet, et la variante la plus retorse : la fixture décrivait
> le journal qu'on veut, pas celui que le produit produit. Trouvé par un test qui interroge
> `localStorage` **après** le rendu — le seul angle qui regarde l'écriture elle-même.

**2. `freshSnapshot` jetait la forme des séries à trente jours.** Durée d'épisode et tailles
de saisons étaient rangées avec le **mouvant** (statut, date de retour). Or elles ne bougent
pas : *Breaking Bad* fera toujours 47 minutes. Le bilan aurait donc été aveugle à toute
série non revisitée depuis un mois — **c'est-à-dire aux séries terminées**, celles qui
pèsent le plus lourd dans un bilan de temps passé. Même défaut que « Série 1405 » : *un
titre ne se périme pas, un statut si.*

**3. `isFresh` ne comparait pas les champs neufs.** Elle décide si une réécriture est
nécessaire ; un champ absent de la comparaison rend son écriture invisible pendant vingt-
quatre heures. `episodeMinutes` y manquait déjà depuis le matin. Un commentaire d'avertis-
sement est maintenant posé sur la fonction.

#### La décision de conception du module : ne jamais compter deux fois

`setDecision` **n'efface pas la position**. Naïvement, « passages achevés + position »
compterait donc la dernière saison en double sur **toute** série terminée. La position n'est
prise en compte que si elle est **postérieure** au dernier passage achevé — c'est-à-dire si
elle appartient à un nouveau visionnage. C'est exactement l'usage pour lequel la v2 a rendu
la date obligatoire sur chaque fait, deux sessions avant qu'on en ait besoin.

Vérifié en réel : sur un journal de six séries, *Breaking Bad* compte **124 épisodes et non
186**.

#### Vérification au navigateur (2026-08-03, après-midi)

| Vérifié | Résultat |
|---|---|
| Total sur six séries | **537 h — 22 jours et 9 h**, 1175 épisodes, recalculable à la main |
| Double comptage | ✅ absent (124 ép. pour *Breaking Bad*, deux passages) |
| Instantané expiré (200 j) | ✅ non compté, et **avoué** |
| Série sans `seasonSizes` | ✅ non comptée, et avouée |
| Silence sous le seuil | ✅ — vérifié **après** avoir attendu que la bibliothèque soit chargée, sinon l'absence ne prouve rien |
| Les deux langues | ✅ `/moi` en anglais, `/fr/moi` en français |
| Console | ✅ aucune erreur |

⚠️ **Ce qui n'a pas pu être vérifié en local** : la chaîne complète *page série → instantané
→ `/moi`*, faute de catalogue (`TMDB_ACCESS_TOKEN` vide). Les deux extrémités sont couvertes
par des tests de composant — et c'est là que le défaut n°1 a été trouvé.

#### La mesure, et une réserve sur la mesure

**+1,38 Ko gzip** sur `/moi` (205,73 → 207,11), même méthode avant et après. Le calcul est
ici **côté client**, contrairement aux trois features du matin importées `import type`.

⚠️ **L'absolu n'est pas comparable aux 166 Ko relevés le 2026-08-02** : ma méthode somme
tous les chunks référencés par le HTML prérendu, l'autre mesurait autre chose. Les *deltas*
concordent (l'écart `/` → `/moi` mesuré ici, ~4,8 Ko, correspond aux ~4 Ko relevés alors
pour la couche des gestes). **À réconcilier avant de citer un absolu.**

**Périmètre arbitré avec Tristan** : pas de carte partageable cette fois — `ShareCard`
existe et pourra s'y brancher après. Les **pages-listes** (`NEXT-FIVE-2` §2) restent au
menu, elles ne sont pas abandonnées.

⚠️ **Ce que ce bilan doit dire de lui-même.** Trois causes de sous-estimation se cumulent,
et aucune n'est un bug : les instantanés **expirent** (plafond contractuel de six mois), les
séries visitées **avant** 1.65 n'ont pas de tailles de saisons, et TMDB ne donne pas
toujours de durée d'épisode. Donc **« au moins X »**, jamais « X » — et un **seuil de
couverture sous lequel on se tait**, parce qu'annoncer « au moins 3 heures » à quelqu'un qui
suit quarante séries est un mensonge par omission. C'est la règle déjà écrite deux fois ici
(`MIN_STOP_POINT_SAVING`, `MIN_SERIES_FOR_TASTE`).

### Ce que la boucle d'audit a trouvé sur ces trois features

**1. Une cinquième règle, trouvée par les tests (F1).** La première version maximisait le
seul écart de médianes et conseillait de commencer sur **un épisode encore mauvais** : la
médiane de « tout le reste » est trop robuste pour voir un creux d'un épisode. Or le
conseil dit *« à partir d'ici, c'est bon »* — celui qui le suit tombe sur cet épisode en
premier. La règle ajoutée a corrigé **deux cas de test d'un coup**, le signe habituel
qu'elle décrit une propriété réelle et non une rustine.

**2. ⚠️ Un test creux, trouvé en injectant le défaut (F2).** Les six tests de placement
restaient **verts** quand on supprimait purement et simplement le rendu hors dépliant.
Cause : `useJournal` lit le stockage de façon asynchrone, donc au premier rendu la position
est inconnue et la note apparaît dans le dépliant ; `findByText` résolvait sur ce
rendu-là, et l'assertion suivante mesurait un état transitoire.

> **La leçon, et elle est générale** : sur un composant dont l'état arrive de façon
> asynchrone, `findByText` puis une assertion **ne prouve rien** — il faut attendre la
> condition finale elle-même. Un test qui ne tombe pas quand on casse ce qu'il surveille
> donne une confiance imméritée, ce qui est pire qu'un test absent.

**3. Une borne manquante, à la fois performance et produit (F1).** `MAX_ENTRY_FRACTION`
seule ne borne rien : elle *grandit avec la série*. Sur une série-fleuve comme *Detective
Conan* (~1100 épisodes), la boucle faisait 366 itérations en triant à chaque pas — de
l'ordre de **8 millions d'opérations à chaque régénération de page** — et pouvait proposer
de passer des centaines d'épisodes, ce qui n'est pas un conseil d'entrée. Un plafond
absolu (`MAX_SKIPPED_EPISODES = 25`) répond aux deux à la fois.

### Mesures de cette session

| Sujet | Résultat |
|---|---|
| **Poids JS** | **166,3 Ko gzip** sur `/moi` contre 166,0 avant : **+0,3 Ko** pour les trois features. Les modules de calcul sont importés `import type` par la couche client — ils restent **entièrement côté serveur**, le navigateur ne reçoit que le résultat. |
| Appels réseau ajoutés | **Zéro.** Les trois features lisent des données déjà chargées pour la grille et la courbe. |
| En-têtes | CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options` toujours servis ; aucune erreur console. |
| Seuils | `tests/thresholds.test.ts` — les seuils sont verrouillés dans leurs **rapports**, pas dans leurs valeurs : chacun reste réglable, mais deux qui doivent rester liés ne peuvent plus diverger en silence. |
| CVE `sharp` | Inchangée et toujours **non exploitable** (pas de `next/image`, `images.unoptimized`). |
| Dépendances majeures | `typescript@7`, `jsdom@30`, `@types/node@26` disponibles. **Volontairement non mises à jour** : trois changements majeurs en autonomie, sans bénéfice immédiat, contre un projet dont la preuve est la CI verte. À faire en présence de Tristan. |

### ✅ Audit en production du 2026-08-03, **après déploiement** — tout est vérifié

**24 commits poussés, CI verte, déploiement passé.** Ce qui suit est mesuré sur
https://seasoned-two.vercel.app, pas déduit du code.

| Vérification | Résultat |
|---|---|
| **`hreflang` des pages série** — dette ouverte depuis **trois sessions** | ✅ **Réciproques et auto-référents.** `/serie/1396` et `/fr/serie/1396` déclarent toutes deux `fr-FR`, `en-US` et `x-default`, avec des cibles identiques |
| Canonique par langue | ✅ Chaque page pointe la sienne — le français ne demande pas sa propre désindexation |
| **Cache de bord** | ✅ `HIT` sur `/`, `/serie/1396`, `/fr/serie/1396`, `/convertir` (le premier appel d'une page jamais rendue est un `MISS`, c'est l'ISR normal) |
| **Faille XSS du JSON-LD** | ✅ **Corrigée en ligne** : plus aucun `<` brut dans le bloc `ld+json` |
| En-têtes de sécurité | ✅ Les cinq servis : CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` |
| `robots.txt` | ✅ Les six chemins exclus, **dans les deux langues** |
| `sitemap.xml` | ✅ 107 URLs, 214 alternates, `/convertir` présent |
| `lang` servi | ✅ `en` sur `/`, `fr` sur `/fr` — sur les huit routes testées |

### ⚠️ Correction d'une conclusion fausse écrite le matin même

J'ai écrit, en tête de ce fichier : *« la description française servie sur une page
destinée à l'anglais est la **preuve directe** que `TMDB_LANGUAGE=fr-FR` est posé chez
Vercel »*. **C'était faux, et c'était une sur-interprétation.**

Le code alors déployé (`08a8d43`) est **antérieur à la bascule A10** : `DEFAULT_LOCALE`
y valait encore `fr`. Le français s'expliquait donc entièrement par le code, sans qu'aucune
variable d'environnement soit en cause. J'avais une explication suffisante et j'en ai
affirmé une autre.

**Ce que la production dit maintenant**, et qui tranche pour de bon :

| Page | Description servie |
|---|---|
| `/serie/1396` | *« Walter White, a New Mexico chemistry teacher… »* — **anglais** |
| `/fr/serie/1396` | *« Un professeur de chimie atteint d'un cancer… »* — **français** |

Or `TMDB_LANGUAGE`, s'il était défini, **écraserait toutes les langues d'un coup**
(`lib/catalog.ts`). L'anglais sortant en anglais, **la variable n'est pas définie chez
Vercel.** ✅ L'action « la vider » n'a donc jamais eu lieu d'être — elle est retirée de la
liste des choses à faire.

> **La leçon, et elle vaut d'être gardée** : *une observation compatible avec deux causes
> ne prouve aucune des deux.* Le produit avait changé de défaut **et** la variable était
> suspecte ; j'ai attribué au second ce qui suffisait au premier. La bonne conduite était
> d'écrire « unverified » jusqu'au déploiement, ce que la règle du projet demande
> explicitement.

### Les trois features de ce matin, vues sur de vraies séries

| Série | Ce que la production affiche |
|---|---|
| **BoJack Horseman** | *« It starts slowly — 7,3/10 puis 8,2/10, ça décolle à **S1E8** »* |
| **Star Trek TNG** | *« 6,3 → 7,0, ça décolle à S1E5 »*, plus un décrochage en S6 |
| **House of the Dragon** | *« Saison 3 — 6 épisodes sortis, notés 6,7/10, soit 0,6 sous la moyenne de la série »* |
| Breaking Bad, The Office, Parks & Rec, Agents of SHIELD | **se taisent** |

> 🎯 **La validation la plus forte est celle de BoJack.** La source citée en écrivant la
> proposition disait que la série *« devient un chef-d'œuvre vers l'épisode 8 de la
> saison 1 »*. Le module, qui ne connaît que des notes publiques et n'a jamais lu cette
> phrase, sort **exactement le même épisode**. C'est une concordance externe, pas un
> réglage sur nos propres exemples.

**Et le silence est majoritaire, comme annoncé** : un verdict de saison en cours sur
**14 séries** testées, et quatre séries sur six sans point d'entrée. ⚠️ *The Office* et
*Parks and Recreation*, dont le démarrage lent est notoire, n'en produisent pas — le
module rate donc des cas réels. C'est **le bon sens de l'erreur** (se taire plutôt que
d'inventer), mais c'est une limite à connaître, et le seuil mériterait d'être re-mesuré
sur un échantillon large plutôt que resserré au jugé.

### 🔴 Vérification en production du 2026-08-03 (matin, **avant** déploiement)

La dette de vérification traînait depuis deux sessions (`hreflang` d'une page série, cache
de `/fr/serie/1396`). Elle est **répondue, et pas comme prévu** : ces deux points ne
peuvent pas être vérifiés, parce que **le code n'est pas déployé**.

| Observé sur https://seasoned-two.vercel.app | Résultat |
|---|---|
| `X-Vercel-Cache` sur `/serie/1396` | **`HIT`** ✅ — le cache tient, c'est confirmé |
| `/fr/serie/1396` | **404** — le routage par locale n'est pas en ligne |
| `<html lang>` sur `/serie/1396` | **`fr`** — le site en ligne est monolingue français |
| `hreflang` | **aucun** |
| Description du JSON-LD sur la page anglaise | **en français** : « Un professeur de chimie atteint d'un cancer… » |

> **⚠️ Trois faits qui en découlent, et qui ne sont pas des détails.**
>
> 1. **La faille XSS du JSON-LD est en ligne depuis le 2026-08-02.** Le correctif
>    (`lib/jsonld.ts`) existe, il est testé, il n'est pas déployé.
> 2. **`TMDB_LANGUAGE=fr-FR` est bien posé dans l'environnement Vercel** — la description
>    française servie sur une page destinée à l'anglais en est la preuve directe. Le
>    diagnostic du 2026-08-03 n'était donc pas théorique.
> 3. **18 commits ne sont pas poussés.** Tout le travail des deux dernières sessions —
>    i18n complète, vague A, correctifs de sécurité — est invisible en ligne.
>
> **Un push est nécessaire, et il n'appartient pas à un agent de le décider** : il
> déclenche un déploiement public. À trancher par Tristan.

---

## 🔄 Reprise à froid — état au 2026-08-03 (fin de session)

**Tout est committé, `main` propre. 436 tests verts, typecheck strict vert, build vert,
13 routes `○ Static` sur 15** (`/recherche` et `/fr/recherche` sont dynamiques par nature).
Quatre commits : `a1fab2d` (réservation + D14) · `9043233` (filet + i18n) · `26e7514`
(vague A) · `96853ae` (XSS + langue du catalogue + en-têtes).

## 🔄 REPRENDRE ICI — point d'entrée de la prochaine session (2026-08-03, après-midi)

**État : tout est committé sur `main` propre. 546 tests verts, typecheck strict vert, build
vert, 13 routes `○ Static`.** ⚠️ **Quatre commits ne sont PAS poussés** — un push déclenche
un déploiement public, ce n'est pas à un agent de le décider.

### Les cinq choses à faire, par ordre de valeur

0. **Pousser** (`7147eba`, `ed546b9`, `66ca1a8`, `e533451`). ⚠️ **Décision de Tristan.**
   Le bilan personnel et le correctif d'instantané ne sont en ligne pour personne tant que
   ce n'est pas fait — et **le manque d'instantané est rétroactif** : chaque jour sans
   déploiement est un jour de visites dont la forme des séries n'est pas mémorisée.
1. **La n°2 de `docs/NEXT-FIVE-2.md` — les pages-listes calculées.** Le plus gros levier
   SEO restant, et **ses calculs sont déjà écrits** (`findEntryPoint`, `stopPointAdvice`,
   `computeTrajectory`). Une route `/listes/[slug]` en ISR quotidien. Elle referme aussi
   le maillage interne. Garde-fou : ne publier que les listes où les chiffres tiennent.
2. **A4 — le nom.** Seul arbitrage bloquant avant un vrai lancement public.
   Recommandation `peaked.tv`, repli `howfar.tv`. **Décision de Tristan.**
3. **0.9 — la relecture par un autre agent.** `AGENTS.md` pose « rédacteur ≠ relecteur »,
   et **tout le dépôt a été écrit par le même agent**. C'est la dette de méthode la plus
   ancienne, et elle grossit à chaque session. ⚠️ Elle vient de coûter cher : trois défauts
   de la même famille ont traversé une session entière avant d'être vus (bloc 1.65/1.66).
4. **Re-mesurer le seuil du point d'entrée.** Mesuré en production : *The Office* et
   *Parks and Recreation*, au démarrage lent notoire, ne produisent aucun point d'entrée.
   Le module rate des cas réels. ⚠️ **Ne pas resserrer au jugé** — c'est exactement la
   faute qui a coûté trois passes à `trajectory.ts`. Mesurer sur un échantillon large.

### ⚠️ La question à se poser en ouvrant n'importe quel champ d'instantané

Trois champs ont maintenant été ajoutés à `JournalSnapshot` dans l'urgence, un par session,
chacun parce que le précédent ne suffisait pas. À chaque fois le manque était **rétroactif**.
Avant d'écrire la prochaine feature qui lit le journal, poser la question dans l'ordre :

1. **Le champ est-il écrit ?** (défaut n°1 — le type l'acceptait, personne ne le remplissait)
2. **Survit-il aux trente jours ?** (défaut n°2 — rangé avec le mouvant)
3. **`isFresh` le compare-t-elle ?** (défaut n°3 — sinon l'écriture est invisible 24 h)
4. **Un test lit-il `localStorage` après le rendu ?** Sans lui, rien de ce qui précède ne
   se voit — ni au typage, ni aux tests purs, ni au navigateur avec une fixture écrite à
   la main.

### Ce qu'il ne faut PAS refaire

- ❌ Vider `TMDB_LANGUAGE` chez Vercel : **la variable n'est pas définie**, prouvé par la
  production. Une note antérieure disait le contraire, elle est corrigée plus bas.
- ❌ Vérifier les `hreflang` ou le cache : **fait, en production, le 2026-08-03**.

### Les deux leçons de méthode de cette session

1. **Une observation compatible avec deux causes ne prouve aucune des deux.** J'ai
   attribué à une variable d'environnement ce qu'un changement de défaut expliquait déjà.
2. **Sur un état asynchrone, `findByText` puis une assertion ne prouve rien.** Six tests
   de placement restaient verts alors que le code qu'ils surveillaient était supprimé.
   Vérifier un test en **injectant le défaut** est la seule façon de le savoir.

---

### À faire en premier, dans cet ordre (mis à jour le 2026-08-03 au matin)

0. ✅ **Push fait le 2026-08-03**, autorisé par Tristan. CI verte, déploiement passé,
   **tout est vérifié en production** — voir le tableau d'audit plus haut. La faille XSS
   n'est plus en ligne.
1. ✅ **`TMDB_LANGUAGE` : rien à faire.** La variable n'est pas définie chez Vercel —
   prouvé par la production, qui sert désormais de l'anglais sur `/serie/*` et du français
   sur `/fr/serie/*`. Ma conclusion inverse du matin était fausse, voir la correction.
2. **`docs/NEXT-FIVE-2.md`** — il reste quatre pistes sur cinq (la n°1, le rewatch, est
   livrée). La n°2 (**pages-listes**) est le plus gros levier SEO restant, et ses calculs
   sont déjà écrits.
3. **A4 (le nom)** reste le seul arbitrage bloquant avant un lancement public.
4. **0.9 — la relecture par un autre agent n'a jamais eu lieu.** `AGENTS.md` pose
   « rédacteur ≠ relecteur » et le projet entier a été écrit par le même agent. C'est la
   dette de méthode la plus ancienne du dépôt.

### L'ancienne liste, conservée pour mémoire

1. **⚠️ Vérifier en production, c'est la seule chose que le local ne peut pas prouver.**
   Le catalogue est **indisponible en local** (`TMDB_ACCESS_TOKEN` vide dans `.env`), donc
   les pages série y servent leur repli. **Deux vérifications restent dues** depuis deux
   sessions : les `hreflang` d'une page série, et `X-Vercel-Cache: HIT` sur
   `/fr/serie/1396`. Tout le reste a été vérifié au navigateur.
2. **⚠️ Vider `TMDB_LANGUAGE` dans l'environnement Vercel** — toujours dû. Depuis
   le 2026-08-03 la langue du catalogue suit la page ; cette variable **écrase toutes les
   langues d'un coup** et n'a plus qu'un usage de diagnostic. Un `fr-FR` oublié y sert des
   synopsis français sur les pages `lang="en"`, c'est-à-dire celles qui portent le SEO.
   *(Le forçage local a été retiré de `.env` ; l'environnement Vercel n'est pas
   observable d'ici — **unverified**.)*
3. **Les cinq propositions** : `docs/NEXT-FIVE.md`, à trancher par Tristan. La n°1 (point
   d'entrée, « ça commence vraiment à S1E8 ») est rentable dès demain, sans un seul
   utilisateur, avec les données déjà en cache.
4. **A4 (le nom)** reste le seul arbitrage bloquant avant un vrai lancement public.

### Ce que la méthodologie a encore trouvé cette nuit

Les quatre défauts de l'audit (XSS, langue du catalogue, `robots.txt` à moitié, i18n des
composants) étaient **tous dans du code marqué ✅**, et **aucun** n'était visible au
typage, aux tests ni au build. La règle tient pour la cinquième fois : **auditer le
résultat, jamais l'intention.**

Deux ajouts durables à l'outillage, qui rendent deux de ces fautes non répétables :
`tests/no-hardcoded-strings.test.ts` (toute phrase française hors dictionnaire casse la CI)
et `tests/catalog-locale.test.ts` (la langue doit rester dans la clé de cache).

### La méthodologie qui a produit ces cinq commits

Elle a trouvé trois défauts réels que ni le typage, ni les tests, ni le build ne voyaient.
À rejouer telle quelle :

1. **Prendre l'hypothèse et la retourner** avant d'écrire. « localStorage est gratuit » →
   c'est une perte de données silencieuse. « Le social demande de la modération » → pas les
   réactions structurées. « Détecter la langue du visiteur » → casse le cache **et** le SEO.
2. **Réserver dans `TASKS.md`**, en y écrivant *le motif*, pas la tâche.
3. **Écrire le test qui échoue d'abord si possible — sinon vérifier qu'il échouerait.**
   Preuve exigée : en réintroduisant le défaut, 4 des 8 lois de fusion tombent. Un test qui
   passe avant et après ne prouve rien.
4. **`npm run check` puis `npm run build`.**
5. **Puis auditer le résultat servi, pas l'intention.** C'est l'étape qui paie : `lang="en"`
   sur `/fr`, le sitemap contradictoire, les alternates. ⚠️ Et se méfier de sa propre
   vérification — la première passe sur les pages série était **biaisée** (catalogue en
   panne, page de repli) et ne prouvait rien.
6. **Commit atomique**, message qui dit *pourquoi*, doc à jour dans le même commit.

> **La règle du projet confirmée une troisième fois** (après le SEO en cul-de-sac et le
> cache inopérant) : **le code peut être juste et l'effet nul.** Rien ne remplace de
> regarder ce qui sort.

---

## Lot 0 — ce qui doit être corrigé **avant** qu'il existe deux appareils

> Découvert le 2026-08-02 en préparant la synchro. Ces trois points sont invisibles
> aujourd'hui (un seul appareil, un seul journal) et **corrompent silencieusement les
> données dès qu'il y en a deux**. `mergeJournals` est la primitive sur laquelle repose
> toute la phase 2 : elle doit être juste avant d'être utilisée, pas après.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 0.10 | **`laterOf` n'est pas commutatif sur l'égalité de date** | ✅ 2026-08-02 | `journal.ts` l. 789 : `>` strict, donc à date égale c'est **l'ordre des arguments** qui tranche. `merge(A,B) ≠ merge(B,A)` → deux appareils divergent et se battent indéfiniment. Départager par un ordre stable et total. |
| 0.11 | **La date de repli d'un fait est l'horloge du lecteur** | ✅ 2026-08-02 | `journal.ts` l. 253 `readInstant(…, fallback)` : un fait sans date lisible reçoit `new Date()` **de celui qui lit**. Deux appareils lisant le même export lui donnent deux dates. Repli sur l'epoch pour les **faits** ; l'horloge de lecture ne reste légitime que pour l'**expiration** des pierres tombales. |
| 0.12 | **Les deux défauts se composent** | ✅ 2026-08-02 | Un import où plusieurs faits n'ont pas de date leur donne **tous la même** date de repli → égalités exactes → 0.10 se déclenche en masse. C'est précisément le scénario de l'import multi-formats (A2). |
| 0.13 | Tests de propriété sur `mergeJournals` (idempotence, commutativité, associativité, convergence) | ✅ 2026-08-02 | `tests/journal-merge.test.ts`, sans nouvelle dépendance (générateur congruentiel déterministe, dates piochées dans un jeu de **trois** pour forcer les ex aequo). Les 410 lignes de `tests/journal.test.ts` étaient des **exemples** ; aucune ne vérifiait les lois. Lois énoncées sur les **entrées** : `deviceId` n'est pas commutatif **par contrat**, `platforms` est un ensemble non ordonné. |

> **Vérifié, et c'est le point** : en réintroduisant l'ancien départage, **4 des 8 tests
> tombent** (commutativité, convergence, et les deux cas ciblés) — tandis qu'idempotence
> et associativité restent vertes. La fusion n'était donc cassée que sur la
> commutativité, et un test qui ne l'aurait pas montré n'aurait rien prouvé.
> `npm run check` : **276 tests verts**, typecheck strict vert.

---

## 🌍 A9 — le produit vise l'international (tranché par Tristan, 2026-08-02)

**Ce n'est pas un élargissement du produit, c'est un multiplicateur du seul canal qui
marche à froid.** Le SEO est le seul canal d'acquisition qui fonctionne sans utilisateurs
(`ROADMAP.md` §0.2) ; une page en français ne capte pas *« is X worth watching »*, qui est
un marché d'un ordre de grandeur plus grand.

**Et le projet est structurellement bien placé pour le faire** :

> Le différenciateur est **language-agnostic**. Statut réel, temps écoulé chiffré,
> trajectoire, point d'arrêt, taux d'abandon se calculent **sans langue** — tout
> `src/domain/` est déjà muet, et le reste muet : rien de `lib/i18n.ts` n'y est importé.
> Un site de critiques doit traduire son contenu ; nous avons une centaine de chaînes.

**Trois conséquences à ne pas perdre de vue** :

1. **Le social structuré devient encore plus juste.** Le texte libre fragmente par langue
   et rend la modération multilingue ingérable pour une personne seule. Un jeu fermé de
   réactions s'agrège **mondialement** et se traduit une fois. L'international renforce
   l'arbitrage social au lieu de le compliquer.
2. **⚠️ Le coût catalogue est multiplié par le nombre de langues** : TMDB renvoie des
   métadonnées traduites, donc une requête par langue. La rupture décrite au dimensionnement
   arrive N fois plus vite avec N langues. À intégrer avant d'ajouter la troisième langue.
3. **La négociation par en-tête n'existe pas sur une page statique.** Les pages sont
   `force-static` — c'est ce qui tient le budget. La langue se décide donc soit à la
   construction (routage par locale), soit côté client. Pas au rendu.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 1.57 | **Socle i18n** — `lib/i18n.ts` : langues servies, négociation `Accept-Language` tolérante, étiquette BCP 47, région de repli, dictionnaire typé | ✅ 2026-08-02 | 12 tests. **Le typage rend une clé manquante fatale à la compilation** : une traduction incomplète ne peut pas atteindre la production. `fr` fait foi. |
| 1.58 | **Bandeau de sécurité des données** (A0 + A1 réunis) | ✅ 2026-08-02 | `app/components/DataSafety.tsx`. Voir ci-dessous. |
| 1.59 | Migrer les chaînes existantes vers le dictionnaire | 🟡 **partiel** | ✅ Faits : `lib/format.ts` (le différenciateur), `layout`, accueil, page série, métadonnées, langue du catalogue. 🟢 Restent : les ~14 composants `'use client'` (`/moi`, `EpisodeGrid`, `MyProgress`, `StarRating`, `ShareCard`, `TasteCard`…). **Volontairement pas fait dans le même lot** : sans test de composant, migrer 14 fichiers d'un coup est un risque sans filet. À faire après 1.61. |
| 1.60 | **Routage par locale + `hreflang` + sitemap par langue** | ✅ 2026-08-02 | `/` en anglais, `/fr` en français. `lib/routes.ts` (12 tests), deux dispositions racines, sélecteur de langue, `hreflang` réciproques, sitemap avec alternates. Deux décisions contre-intuitives : anglais **sans** préfixe, et **aucune redirection automatique**. Motifs ci-dessous. |
| 1.61 | Harnais de test de composants (`jsdom`, `include` en `.tsx`) | 🟢 libre | Prérequis de 1.59. `vitest.config.ts` fixe `environment: 'node'` et `include: '**/*.test.ts'` : **aucun test de composant n'est possible aujourd'hui**, pour 15 modules `'use client'`. |
| **A10** | **Quelle langue par défaut ?** | ✅ **`en`**, tranché 2026-08-02 | Sur un site statique, « par défaut » n'est pas une préférence : c'est **la langue de la page que les moteurs indexent**, donc une décision d'acquisition. Le français n'est pas rétrogradé, il cesse d'être implicite — et il est désormais **testé explicitement**, ce qu'il n'était pas : tant qu'il était le défaut, les tests qui ne précisaient rien le vérifiaient par accident. |

### ⚠️ Ce que la bascule a révélé, et qu'il faut regarder en face

**En basculant le défaut sur `en` sans routage par locale, le français n'est plus servi
nulle part.** Les traductions existent, elles sont complètes, elles sont testées — et
**aucune URL ne les rend**. « Traduire vers l'anglais » a donc, de fait, *retiré* une
langue du site au lieu d'en ajouter une.

C'est le genre d'effet qu'on ne voit pas en lisant le diff : chaque changement était juste
isolément, et le résultat d'ensemble est une régression. Conséquence : **1.60 n'est plus
une amélioration SEO, c'est la réparation d'une perte**. Tant qu'il n'est pas fait, le
produit est monolingue — en anglais.

Le raisonnement reste bon (l'anglais devait devenir la page indexée) ; c'est l'ordre qui
était incomplet. La règle à en tirer : **changer un défaut ne suffit pas à servir une
alternative — il faut d'abord qu'elle ait une adresse.**

### 1.60 — les deux choix contre-intuitifs, et pourquoi

**1. L'anglais reste sans préfixe.** `/serie/1396` sert l'anglais, `/fr/serie/1396` le
français. La symétrie (`/en/…` et `/fr/…`) serait plus élégante et **casserait toutes les
URL déjà indexées** — le site est en ligne depuis le 2026-08-01 avec un sitemap. Or le SEO
est le canal n°1 : sacrifier l'indexation acquise pour de la symétrie serait payer cher un
confort de lecture du code. L'asymétrie est le prix de la continuité, et elle est assumée.

**2. ⛔ Aucune redirection automatique selon `Accept-Language`.** C'est le réflexe naturel,
et c'est le mauvais choix ici, pour trois raisons qui se cumulent :
- **Elle casserait le cache.** Un middleware s'exécute à *chaque* requête, y compris celles
  que le CDN servirait sans nous. C'est une invocation facturée par visite — exactement le
  coût par utilisateur que `ROADMAP.md` §1.4 interdit, et ce qui a tué TV Time.
- **Elle saboterait le SEO.** Googlebot explore majoritairement depuis les États-Unis avec
  un `Accept-Language` anglais. Redirigé, il pourrait ne **jamais** voir les pages
  françaises — on aurait traduit pour un moteur qui ne le saurait pas.
- **Elle surprend.** Cliquer sur un lien anglais partagé par quelqu'un et atterrir en
  français est un bug du point de vue de l'utilisateur.

→ Les adresses sont **explicites**, et le changement de langue est **un lien qu'on clique**,
jamais une décision prise à notre place.

**3. Les `hreflang` doivent être réciproques et auto-référents.** Chaque version déclare
**toutes** les versions, y compris elle-même, plus un `x-default`. Une déclaration non
réciproque est purement et simplement ignorée par Google — c'est l'erreur classique, et elle
est silencieuse : la balise est là, elle a l'air juste, elle ne sert à rien.

### 1.60 — ce que la vérification a trouvé, et que rien d'autre n'aurait trouvé

Le typage était vert, les 306 tests verts, le build vert, **et `/fr` servait du français en
s'annonçant `lang="en"`**. Un seul `<html>` existe par page, et il vivait dans une
disposition racine unique qui écrivait la langue par défaut en dur.

Ce n'est pas un détail cosmétique : un lecteur d'écran prononce alors le français avec la
phonétique anglaise, et le signal envoyé aux moteurs contredit le contenu. **C'est la
troisième fois que ce projet rencontre cette forme d'échec** — le SEO en cul-de-sac, le
cache inopérant, et maintenant `lang` — et la règle tient : **auditer le résultat, jamais
l'intention.**

Réparé par **deux dispositions racines** (`app/(site)` et `app/(fr)`), chacune de trois
lignes, tout ce qui pourrait diverger vivant dans `SiteChrome`. Une page ne portant qu'un
seul `<html>`, c'est la seule façon correcte de faire varier `lang`.

Deux autres trouvailles de la même vérification :
- Le sitemap écrivait la racine sous **deux formes** (`…:3000` dans `<loc>`, `…:3000/` dans
  l'alternate). Sans effet — Google normalise la racine — mais un document qui se contredit
  fait chercher un bug ailleurs le jour où il y en aura un. Normalisé.
- Le test de conformité `no-journal-on-server` est tombé au déplacement des fichiers : il
  citait des chemins en dur. **C'est son rôle** — mais un test de conformité qui casse pour
  un déplacement apprend à être ignoré, d'où le groupe nommé en constante.

⚠️ **Ce que cette vérification n'a PAS pu prouver** : le catalogue était indisponible en
local, donc les pages série ont servi leur repli et **leurs `hreflang` n'ont pas pu être
observés**. Le chemin de code est le même (`alternatesFor`), couvert par 12 tests et
vérifié sur l'accueil — mais **à re-vérifier en production**, comme le cache l'a été.

### 1.58 — ce que le bandeau répare, et pourquoi il se tait la plupart du temps

Le produit promet de garder la trace, et l'écrit dans `localStorage`. Or **Safari efface
tout stockage inscriptible par script après sept jours d'usage du navigateur sans
interaction avec le site**, et le public visé revient tous les un à trois mois. Le trou
d'engagement (D9) n'était donc pas seulement un problème de rétention : c'était une
**destruction de journal**.

**La nuance qui change tout** : une application ajoutée à l'écran d'accueil y échappe. La
protection existait déjà dans le produit — elle était conditionnée à un geste que rien
n'invitait à faire. D'où la formulation : installer n'est pas un confort, c'est **ce qui
empêche de perdre ses notes**.

Trois règles pour que ce ne soit pas une nuisance : rien tant qu'il n'y a rien à perdre ;
**rien si l'application est déjà installée** (le risque n'existe plus — continuer à
l'annoncer apprendrait à ignorer nos messages) ; « plus tard » ne revient qu'après quatre
gestes de plus — le refus se mesure en **gestes**, pas en jours, parce que ce qui augmente
le risque est le travail accumulé.

Vérifié : `npm run build` reste vert et **toutes les routes restent `○ Static`**, y compris
`/serie/[id]`. Ajouter un composant client au layout n'a pas coûté le rendu statique.

### ⚠️ Trois corrections pour une seule feature — ce que ça a appris

`computeTrajectory` était écrit et testé depuis le premier jour sans jamais servir : il
attendait des notes d'utilisateurs. Les notes du public TMDB permettent de l'activer
sans un seul compte. **Il a fallu trois passes pour que la courbe dise quelque chose de
vrai**, et chacune a été révélée par la production, pas par les tests.

| Passe | Ce qui s'affichait | Cause |
|---|---|---|
| 1 | *Dexter* : **4,0 partout, « tenue de bout en bout »** | L'arrondi au demi-point détruisait l'information |
| 2 | Valeurs justes (3,6 → 4,2), mais **toujours « chef-d'œuvre »**, constance 92 % | Forme et constance normalisées sur l'échelle complète |
| 3 | Courbe + pic + décrochage, **aucun jugement** | ✅ |

> **La leçon, transposable** : un instrument taillé pour des notes **humaines** ne
> s'applique pas à des moyennes de **foule**. Les notes d'épisode d'une même série
> tiennent dans une bande d'environ un point sur dix — ceux qui notent un épisode l'ont
> regardé, donc l'aiment. L'échelle en demi-étoiles, le seuil de rupture à une étoile et
> la normalisation de la constance supposent tous une dispersion qui n'existe pas.
>
> La sortie n'a pas été de recalibrer des seuils jusqu'à ce que ça tombe juste sur quatre
> exemples, mais de **séparer les faits des jugements** : on montre la courbe, le pic et
> le décrochage ; on tait la forme et la constance. Elles reviendront intactes le jour où
> de vraies notes existeront — elles sont justes pour ce qu'elles ont été conçues.

**Vérifié en production** : *Dexter* et *Stranger Things* signalent tous deux leur
décrochage, et plus aucun jugement faux n'est affiché.

### 🟢 1.30 → 1.34 — Le produit se souvient (2026-08-02) ✅

Bloc dirigé par le cadrage produit de Tristan : **Letterboxd** (amis, listes, profils,
notes) + **IMDb** (notes par épisode, couleurs) + **JustWatch** (où regarder, sorties).

| # | Fait | Modèle |
|---|---|---|
| 1.30 | **Grille d'épisodes colorée** | IMDb |
| 1.31 | **« Où la regarder »** + attribution JustWatch | JustWatch |
| 1.32 | **Prochain épisode daté et nommé** | JustWatch |
| 1.33 | **Journal personnel** — position, notes de saison, décision | Letterboxd |
| 1.34 | Vérification interactive au navigateur | — |

#### Le contre-sens qui a dirigé le bloc

J'ai décomposé ce qui rend réellement addict : attente récompensée, progression
visible, collection, comparaison sociale, découverte de soi. **Quatre sur cinq butaient
sur la même chose** — le produit ne se souvenait de rien. Le blocage n'était pas une
feature manquante, c'était l'absence de persistance.

> **Sortie : stocker sans base de données, dans le navigateur.** Coût zéro, aucun compte
> à créer, aucune donnée personnelle hébergée, aucune obligation RGPD — et surtout, cela
> **valide l'usage avant d'investir dans Supabase**.

Deux propriétés rendent la chose acceptable architecturalement :

- **La page reste statique et mise en cache** — vérifié au build, `/serie/[id]` est
  toujours `○ Static`. L'état personnel s'ajoute par-dessus, côté navigateur.
- **La forme des données est exactement celle qu'attend `RATING-MODEL.md` §7** :
  position en pointeur, cible de note polymorphe, décision de plein droit. Passer au
  serveur ne demandera pas de la réécrire.

#### Vérifié au navigateur, pas au curl

Le HTML servi **ne contient pas** le composant — voulu : il ne rend rien tant que le
stockage n'est pas lu, ce qui évite toute erreur d'hydratation. Un `curl` ne pouvait
donc rien prouver.

| Vérification | Résultat |
|---|---|
| Sélection saison 3 | 13 épisodes proposés — correct pour Breaking Bad |
| Sélecteurs de note | **3 seulement** (saisons 1-3) : les saisons non atteintes ne sont pas proposées — la règle de spoiler tient jusque dans la saisie |
| Note 4,5 sur la saison 1, puis rechargement | restaurée |
| Contenu de `localStorage` | forme conforme au modèle, version 1 |

**Dette D14** : pas de synchronisation entre appareils, et le journal disparaît si le
navigateur est nettoyé. Un export/import JSON est le minimum à ajouter avant que
quiconque y investisse du temps — `exportJournal()` existe déjà, il lui manque une
interface.

### 1.24 → 1.29 — Bloc du 2026-08-02 ✅

| # | Ce qui a été fait | Trouvé par |
|---|---|---|
| 1.24 | **Dimensions d'affiche déclarées** + `fetchPriority` sur le LCP | audit de performance |
| 1.25 | **Métadonnées de partage** (Open Graph, Twitter, `metadataBase`) | audit de performance |
| 1.26 | **Maillage interne « Du même créateur »** — clôt 1.16 | trou SEO connu |
| 1.27 | Hiérarchie de titres cohérente (`sr-only`) | audit d'accessibilité |
| 1.28 | **Statut dans les résultats de recherche** (8 premiers) | audit du parcours |
| 1.29 | **Cadence à un seul intervalle** | audit sur échantillon large |

**Audit de performance.** 194 Ko de JS compressé pour **zéro composant client** — le site
n'a aucune interactivité, formulaire et dépliant sont natifs. C'est le coût structurel de
Next, non retirable sans changer de framework : **dette D13**, consignée plutôt que
combattue. En revanche aucune image ne déclarait ses dimensions, donc la page sautait à
leur arrivée — un des trois indicateurs mesurés par Google, corrigé sans rien charger
puisque le ratio TMDB est constant.

**Audit d'accessibilité.** `lang`, un seul `h1`, hiérarchie correcte, tous les `alt`,
landmarks, `aria-label` : **rien de grave**. C'est un résultat, pas un échec d'audit.
Seule incohérence corrigée : deux sections sans `h2`.

**Maillage interne (1.16, ouvert depuis le début).** J'avais écarté « séries similaires »
parce que la recommandation algorithmique est bannie (`ROADMAP.md` §3). Mais **« du même
créateur » est un crédit de production, pas un calcul de similarité** — la distinction
n'est pas rhétorique, c'est elle qui rend ce maillage compatible avec le positionnement.
Vérifié : depuis *Breaking Bad* on atteint *Better Call Saul*, *X-Files*, *Battle Creek*.

**Audit sur échantillon large** (16 séries : très anciennes, mini-séries, anime,
non-anglophones, très longues). Engagements plausibles — *Chernobyl* 6 h, *Détective
Conan* 505 h. Un faux positif sur une série très connue : *Les Anneaux de Pouvoir*
déclarée « sans nouvelle » alors que deux saisons à deux ans d'écart et 20 mois de
silence sont son rythme normal. `seasonCadence` exigeait **trois** saisons ; le garde-fou
posé pour la prudence produisait exactement le défaut qu'il devait corriger.

> **Correction asymétrique** : un intervalle unique produit désormais une cadence, avec
> un facteur plus prudent (1,5 au lieu de 2) et une règle stricte — **une mesure fragile
> peut allonger le délai, jamais le raccourcir**. Vérifié des deux côtés : *Les Anneaux
> de Pouvoir* repasse en « entre deux saisons », et *Majhi Manasa* reste « sans nouvelle
> · 26 mois ». Une correction qui casse ce qui marchait n'en est pas une.

### 🔴 1.23 — Audit de robustesse : le budget était violé depuis le début ✅ 2026-08-02

Premier audit portant sur le **comportement HTTP réel** plutôt que sur le contenu. Il a
trouvé le défaut le plus coûteux du projet, invisible dans le code comme dans les tests.

| Ce que je croyais | Ce qui se passait |
|---|---|
| `revalidate = 86400` ⇒ page en cache | `X-Vercel-Cache: MISS`, `Cache-Control: no-store` |
| Trafic gratuit | **Chaque visiteur** rejouait tous les appels TMDB — jusqu'à 10 pour une série de 8 saisons |

Deux causes, corrigées séparément :

1. **Le cache mémoire ne sert à rien en serverless.** Il est propre à chaque instance,
   donc presque toujours vide. Les appels TMDB passent désormais par le **cache de
   données** de l'hôte, partagé et persistant. Le provider reste agnostique : il
   transmet un `RequestInit`, c'est `lib/catalog.ts` qui y met `{ next: { revalidate } }`.
2. **`revalidate` ne suffit pas sur une route dynamique.** Sans `generateStaticParams`,
   Next 16 rend à la demande sans jamais mettre en cache. `dynamic = 'force-static'`
   rétablit l'ISR. Au build, `/serie/[id]` passe de `ƒ Dynamic` à `○ Static`.

> **Ce qui m'avait trompé** : le build affichait « Revalidate 1d » sur la route. Cette
> colonne décrit l'intention déclarée, **pas le cache effectif**. Seuls les en-têtes de
> réponse en production disent la vérité.

Vérifié après correctif : `X-Vercel-Cache: HIT` sur toutes les pages testées, y compris
des séries jamais visitées.

**Trouvaille secondaire du même audit** : `/serie/1396%2F..%2F..%2Fetc` répondait **200**.
Une URL inventée devenait une page indexable, servie avec le repli « catalogue
indisponible » et un code de succès. Un identifiant est désormais validé en amont
(entier positif, sinon 404).

### 1.22 — « Arrête-toi après la saison N », chiffré ✅ 2026-08-01

La phrase archétypale du domaine, enfin calculée : *« s'arrêter après la saison 6 ramène
la série à ~45 h au lieu de ~82 h »*. Derrière le même geste explicite que la courbe.

Une correction a été nécessaire dès le premier test réel. *Dexter* conseillait de
s'arrêter **après la saison 7** — exact (la plus forte chute est entre S7 et S8) et
parfaitement inutile : huit épisodes épargnés sur quatre-vingt-seize. Ce n'est pas un cas
isolé, la dernière saison est souvent la moins bien notée, donc le conseil deviendrait
systématiquement « regarde tout sauf le final ». **Seuil ajouté : un point d'arrêt ne
s'affiche que s'il épargne au moins un tiers de la série.**

Ce que ça donne sur de vraies séries :

| Série | Verdict | Cohérence avec la réputation |
|---|---|---|
| **The Walking Dead** | arrêt après S6 (4,2 → 3,9) | ✅ la saison 7 est le décrochage connu |
| **Rick et Morty** | arrêt après S4 | ✅ |
| **Breaking Bad** | aucun — elle monte | ✅ |
| Dexter, Stranger Things | aucun — le garde-fou coupe | correct, mais voir ci-dessous |

> **Limite réelle, consignée et non résolue — le biais de survie.** Ces points d'arrêt
> dérivent de notes de foule : ceux qui ont vu la saison 6 de *Dexter* sont ceux qui ont
> persévéré, et ils la notent bien. Les notes publiques ne retrouvent donc pas
> l'effondrement dont tout le monde parle. **Le conseil est exact sur les données, et les
> données ne disent pas ce que dit la réputation.** Le signal ne transparaît que sur les
> séries assez longues pour que le déclin s'installe.

### ✅ 1.10 — ce que le premier contact avec l'API réelle a révélé

Deux défauts, tous deux invisibles hors ligne, tous deux sur la **même promesse** :
« ce qu'elle vous demande », l'une des trois annoncées en page d'accueil.

1. **`episode_run_time` est de facto abandonné par TMDB.** Le champ existe encore mais
   revient vide, y compris sur Breaking Bad. Nos fixtures le contenaient toujours —
   écrites de mémoire, elles décrivaient une API qui n'existe plus. Résultat :
   « Engagement » ne s'affichait sur **aucune** série.
2. **Le repli sur le dernier épisode paru donnait un chiffre faux du simple au double.**
   Stranger Things : 90 heures pour 42 épisodes — 128 min chacun — parce que le final de
   la saison 5 est un long-métrage. La série en fait environ 45.

Correction : **médiane** des durées d'épisode d'une saison **représentative** (ni la
première, pilote rallongé ; ni la dernière, final rallongé ; celle du milieu). Médiane et
non moyenne, précisément pour résister à ces deux cas. Coût : un appel de plus par série,
mis en cache 24 h. Le total est préfixé d'un tilde — c'est une estimation, l'annoncer
comme exact serait mentir.

> **Leçon, à appliquer désormais** : une fixture écrite de mémoire décrit l'API dont on
> se souvient, pas celle qui existe. Les prochaines fixtures doivent être **capturées**
> depuis une réponse réelle, jamais rédigées à la main.

### Statuts observés en conditions réelles

| Statut | Vu ? | Cas observé le 2026-08-01 |
|---|---|---|
| `ended` | ✅ | Breaking Bad, Stranger Things, Euphoria, Loki, The Boys, Squid Game, Umbrella Academy, The Mandalorian |
| `between_seasons` | ✅ | **Yellowjackets** (16 mois), **Mercredi** (11 mois), **The Witcher** (9 mois) |
| `airing` | ✅ | **Ted Lasso** — dernier épisode il y a 3 ans, mais « Nouvel épisode dans 3 jours ». La date à venir prime correctement sur l'ancienneté. **Rick et Morty** |
| `cancelled` | ✅ | **Westworld** — « peut s'arrêter sans conclusion » |
| **`awaiting_renewal`** | ✅ | **Majhi Manasa** (série marathi, 2022) — « aucun épisode depuis 26 mois ». Introuvable en devinant des titres connus ; apparu **dès qu'une liste a été construite pour les faire remonter**. Il était dans la longue traîne, comme prévu. |

### ⚠️ Ce que la chasse au zombie a révélé — recentrage du différenciateur

Deux temps, et le second corrige le premier.

**D'abord**, douze séries connues devinées à la main : **aucun zombie**. TMDB classait
correctement partout — terminée, annulée, entre deux saisons, en diffusion. Ce qui
contredisait `RESEARCH.md` §3.4 (« les fournisseurs annoncent `returning` pour des séries
mortes depuis trois ans »).

**Ensuite**, une liste construite pour les faire remonter — les populaires filtrées sur
l'attente, triées par ancienneté — en a sorti un **immédiatement** : *Majhi Manasa*,
série marathi, 26 mois de silence. **Deviner des titres était la mauvaise méthode**, pas
l'hypothèse qui était fausse.

Distribution réelle observée sur l'accueil (36 vignettes) :

| Ce qui s'affiche | Occurrences |
|---|---|
| en diffusion (`en cours`, `ép. dans N j`) | ~20 |
| `en attente · 1 à 5 mois` | ~9 |
| **`sans nouvelle · 26 mois`** | **1** |

> **Le recentrage tient, et il est maintenant chiffré : la valeur n'est pas le cas
> zombie, c'est le chiffre.** « Saison terminée il y a 5 mois » est dix fois plus fréquent
> que le zombie, et tout aussi introuvable ailleurs. Le zombie en est la forme extrême —
> spectaculaire, mais rare, et surtout situé dans la longue traîne, là où le trafic SEO
> n'est pas.

À reporter dans le discours produit : parler du **temps écoulé chiffré**, dont le zombie
est le cas limite — et non l'inverse.

Les avertissements de saison se sont aussi montrés en conditions réelles : « Saison 4
annoncée mais pas encore diffusée » sur Ted Lasso et Yellowjackets, et la mention des
épisodes spéciaux sur Breaking Bad, Euphoria et Ted Lasso.

### ✅ Audit SEO du 2026-08-01 — le canal d'acquisition était un cul-de-sac

Constat sur le site en ligne : **sitemap à 1 URL, `/recherche` en `Disallow`, zéro lien
sortant depuis l'accueil.** Aucun moteur ne pouvait découvrir une seule page série.
Défaut introduit par `app/sitemap.ts`, qui annonçait que les pages « seront découvertes
par les liens » — sans que ces liens existent.

| | Avant | Après |
|---|---|---|
| Liens `/serie/*` depuis l'accueil | 0 | **20** |
| URLs dans le sitemap | 1 | **147** dont 146 pages série |

> **Leçon** : une fonctionnalité présente dans le code n'est pas une fonctionnalité qui
> marche. Tout le dispositif SEO — rendu serveur, ISR, JSON-LD, métadonnées — était
> correct et intégralement inutile faute d'un point d'entrée. **Auditer le résultat, pas
> l'intention.**

---

## Phase 2 — Comptes et gestes légers

**Canal : communautés existantes.** Aucun texte, aucun social.

| # | Tâche | Statut |
|---|---|---|
| 2.1 | Authentification (Supabase) | 🟢 libre |
| 2.2 | **Schéma de base** — les 5 contraintes de `RATING-MODEL.md` §7 | 🟢 libre |
| 2.3 | « J'en suis là » — la position en un geste | 🟢 libre |
| 2.4 | Note de saison — un tap, pas un formulaire | 🟢 libre |
| 2.5 | Décision : continuer / pause / abandon | 🟢 libre |
| 2.6 | File d'attente + reprise après interruption | 🟢 libre |

---

## Phase 3 — Agrégats et migration

**Canal : migration.** Ce qui rend les pages non reproductibles par scraping.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 3.1 | Trajectoire agrégée, point d'arrêt communautaire, carte des abandons | 🟢 libre | `computeTrajectory` existe ; reste l'agrégation multi-utilisateurs |
| 3.2 | **Filtrage spoiler câblé dans chaque requête** | 🟢 libre | ⚠️ critique ici — `redactTrajectory` existe. Tester les fuites **par agrégat** |
| 3.3 | Import TV Time / Trakt / Simkl | 🟢 libre | Levier de **rétention**, plus d'acquisition — audit §1.1 |
| 3.4 | **Export intégral** | 🟢 libre | Non négociable dès qu'il y a une donnée |

---

## Phase 4 — Textes, profil, partage

**Canal : viralité.** Les textes arrivent en dernier — ils ne s'amorcent pas.

| # | Tâche | Statut |
|---|---|---|
| 4.1 | Critiques de saison | 🟢 libre |
| 4.2 | Épisodes marquants | 🟢 libre |
| 4.3 | Verdict de série rédigé + point d'arrêt | 🟢 libre |
| 4.4 | Profil : la forme d'un goût | 🟢 libre |
| 4.5 | Trajectoire exportable en image | 🟢 libre |

---

## Phase 5 — Social, sous condition

| # | Tâche | Statut | Note |
|---|---|---|---|
| 5.0a | **La procédure : règles, motifs typés, procédure de retrait** | 🔒 in-progress — @claude-opus — 2026-08-03 | Le socle **décidé et publié**, avant qu'il existe une seule ligne de contenu de tiers. Contient ce qui ne s'improvise pas au moment où un signalement arrive : les **motifs typés**, l'**exposé des motifs** dû à l'auteur, le **délai**, et la règle « **on masque, on ne supprime jamais** » — un retrait erroné doit être réversible. ⚖️ **Je ne suis pas une source juridique** : le mécanisme est construit, le texte est à faire relire |
| 5.0b | **Le canal de signalement** | 🟢 libre | Dépend de 5.0a. **Pas de table `reports` pour l'instant** — la même raison que `001_journal.sql` refuse les tables sociales « pendant qu'on y est » : une table qu'on peut remplir avant de savoir traiter un signalement est un piège. Le point de contact publié suffit tant qu'il n'existe aucun contenu de tiers ; le formulaire viendra **avec** le contenu |
| 5.1 | Suivre, fil d'activité, listes, commentaires | ⛔ | N'ouvre pas sans 5.0a **et** 5.0b |

---

## Dette et points de vigilance

| # | Sujet | Note |
|---|---|---|
| D1 | `docs/ROADMAP-AUDIT.md` écrit par l'auteur du plan | Violation assumée de « rédacteur ≠ relecteur ». À faire relire. |
| D2 | Hypothèse de répartition 70/25/5 des niveaux d'engagement | Calquée sur d'autres communautés, non mesurée ici |
| D3 | Seuils de `trajectory.ts` calibrés sur deux séries de référence | À rejouer sur un vrai corpus |
| D4 | Détection de saison scindée | Heuristique. Signale seulement — ne jamais la faire fusionner. |
| D5 | Anthologies (*Black Mirror*) et sitcoms | Le modèle par saison y est mal ajusté. `RATING-MODEL.md` §8.2 et §8.3 |
| D6 | Usage commercial de TMDB | ⚠️ **Redevenu actif depuis A1.** Affiliation ou freemium = usage commercial = accord écrit exigé. À traiter **avant** d'activer, pas après (`ROADMAP.md` §4.1). |
| D7 | **L'économie n'est pas résolue** | Le plan traite le coût, pas le revenu (A6). TV Time est mort avec 26 M d'utilisateurs faute d'avoir répondu à cette question. |
| D8 | **La thèse SEO n'est pas quantifiée** | Motif qualitatif confirmé, **aucun volume chiffré** — il faudrait Ahrefs/SEMrush. Le canal d'acquisition n°1 repose sur un pari raisonnable, pas sur une mesure. |
| D9 | Trou d'engagement de 3 mois (diffusion hebdomadaire) | Audit §4.3, resté ouvert et devenu un problème de **rétention** en mode produit. La saison est la bonne unité de jugement ; l'épisode est peut-être la bonne unité de **rythme**. |
| D10 | **Fixtures écrites de mémoire** | Cause directe du bug `episode_run_time`. Les prochaines doivent être **capturées** depuis une réponse réelle (tâche 1.17). |
| **D13** | **194 Ko de JS** — mesure faite avant les gestes | ⚠️ **Cette ligne était fausse et disait le contraire du code.** Elle affirmait « aucun `'use client'` dans le projet » alors qu'il y en a **14 modules** (toute la couche des gestes : `StarRating`, `EpisodeGrid`, `MyProgress`, `Library`…). Le chiffre de 194 Ko date d'**avant** cette couche et ne vaut plus. À **re-mesurer**, et à ne plus citer d'ici là. Corrigé le 2026-08-02. |
| **D14** | **La documentation ment sur le code** | Constaté le 2026-08-02 : ~20 tâches livrées (1.39→1.53) encore marquées `🟢 libre`, D13 affirmait un fait faux, `CLAUDE.md` annonçait 115 tests pour ~267 réels. Dans un projet dont la règle de reprise à froid est « lire la documentation d'abord », une doc fausse coûte plus cher qu'une doc absente : elle est **crue**. À remettre en accord, et à traiter comme une étape de fin de session, pas comme du rangement. |
| D11 | Listes TMDB polluées par des programmes non narratifs | **Partiellement réglé** le 2026-08-01 par `src/domain/program.ts` : *Tagesschau* et *Paradise Hotel* ont disparu de la vitrine, le sitemap est passé de 146 à 110 pages série (~25 % écartés). **Mais le filtre par genre n'attrape pas tout** : *Die Ratgeber*, magazine de conseils allemand, reste en tête de la rangée « En attente » — TMDB ne l'étiquette ni `news` ni `talk`. La longue traîne échappe au genre. |
| **D15** | ⛔ **Trakt est fermé comme source de position** | Un compte gratuit ne connecte qu'**une seule** application externe ; VIP à **60 $/an** (+100 %) ; usage commercial de l'API **soumis à approbation**. Ne pas rouvrir sans fait nouveau — motif et sources dans `docs/CONVERGENCE-RAPPORTS.md` §3.3. |
| **D16** | ⛔ **L'achat intégré Apple ponctionne A6** | Le natif (A11) impose l'IAP pour tout bien numérique : **15 à 30 %** de commission sur les cosmétiques (15 % sous 1 M$/an, Small Business Program). A6 a été tranché **le matin même, sans Apple dans l'équation** — le modèle doit être rechiffré. ⚠️ Barème **à confirmer** sur les pages Apple, non vérifié. **Bloque 4.8.** |
| **D17** | ⚠️ **Le natif rend le push obligatoire** | Un webview nu se fait refuser (App Store règle 4.2, « minimum functionality ») : le natif **oblige** à apporter du natif — notifications, hors-ligne, partage. Or le push exige un planificateur serveur qui sache quand diffuse chaque série suivie par chaque personne, c'est-à-dire **le coût marginal par utilisateur** que tout le reste du plan s'emploie à éviter. La chaîne se referme : à budgéter, pas à découvrir. |
| **D18** | ⚠️ **`TMDB_ACCESS_TOKEN` est vide dans `.env`** | Constaté le 2026-08-03 : aucune vérification contre l'API réelle n'est possible en local. `episode_groups` (4.4) n'a donc été vérifié qu'**en documentation**, jamais contre une réponse. Or D10 dit qu'une fixture écrite de mémoire décrit l'API dont on se souvient : le jeton est le **prérequis** de 4.4, pas un confort. |
| **D12** | **Le facteur d'anomalie ×2 est arbitraire** | `CADENCE_ANOMALY_FACTOR` vaut 2 — « deux cycles manqués ». Observé le 2026-08-01 : *Die Ratgeber*, silencieuse depuis 20 mois avec un rythme annuel, repasse en « entre deux saisons » (609 j < seuil 730 j). Défendable, mais probablement **trop permissif** : une série annuelle qui manque son créneau de six mois est déjà un signal. ×1,5 donnerait 18 mois. **Non tranché faute de données** — il faudrait mesurer la distribution réelle des intervalles sur un échantillon large, pas régler au jugé. |

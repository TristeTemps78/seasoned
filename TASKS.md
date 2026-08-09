# TASKS.md — ordonnancement

> Protocole : `C:\Git project\WORKFLOW.md`. **Réserver avant d'écrire** — passer la ligne
> à `🔒 in-progress — @agent — date`, committer la réservation, puis travailler.
> Statuts : `🟢 libre` · `🔒 in-progress` · `✅ done` · `⛔ bloqué`

---

## ▶️ À FAIRE — la seule section à lire pour commencer (2026-08-09)

Le reste du fichier est l'**historique** des lots livrés : on l'ouvre pour savoir pourquoi
une décision a été prise, pas pour choisir quoi faire.

| Ce qui manque | Pourquoi c'est la suite |
|---|---|
| **Les followers** | On voit qui l'on suit, jamais qui nous suit. Le pendant manquant du lot 6 |
| **La face (`face.ts`)** | 9.1 → 9.4. Son prérequis (9.0, la provenance) est posé |
| **8.10 — un dictionnaire par langue** | Chaque visiteur télécharge la langue qu'il ne lit pas. Le problème n'est pas les 9 Ko, c'est la pente à cinq langues |
| **Le chemin connecté, vu à l'œil** | Listes, critiques, fil : tout est prouvé par RLS contre la vraie base, **rien n'a été vu depuis un compte**. Ce n'est pas la même chose |

✅ **Livré le 2026-08-09** : les listes (8.13), le bilan annuel (8.14), la provenance d'un
fait (9.0), « découvrir des gens », et le correctif Google (le fournisseur n'était pas
activé, et le bouton s'affichait quand même en avalant l'erreur).

**Dette mesurée, sans urgence** : 15 mutations survivent dans `src/domain/` (lot 12) ;
`lib/`, `src/catalog/`, `src/social/` et `app/` n'ont **jamais** été mutés.

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

## 👥 Lot 6 — les comptes, la synchronisation, le fil (2026-08-03, nuit)

> Périmètre décidé par Tristan : **jusqu'au fil d'activité inclus**. Les listes et l'envoi
> d'avatars restent dehors. Ordre imposé par `docs/ARCHITECTURE-APP.md` §6.
> **Règle de cette session : on pousse dès qu'un lot est vert.**
>
> ⚠️ **Trois constats vérifiés avant d'écrire une ligne**, et ils changent le plan :
> 1. **Le projet Supabase existe et répond** (`/auth/v1/health` → 200) mais **la table
>    `journals` n'a jamais été créée** (`/rest/v1/journals` → 404 `PGRST205`). Le SQL est
>    écrit depuis le 2026-08-03 et n'a jamais été appliqué.
> 2. **Le socle de synchro est écrit et n'a jamais été branché** — `remote.ts`, `sync.ts`,
>    `001_journal.sql`, testés ; **zéro ligne d'authentification** dans tout le dépôt.
> 3. `npm run check:supabase` **déclarait absentes des variables renseignées** : son regex
>    `(.*)$` échoue sur un `.env` en CRLF, parce qu'en JavaScript `.` ne matche pas `\r`.
>    Les lignes **vides** matchaient, les renseignées non. *Un outil de diagnostic qui ment
>    est pire qu'aucun outil.*

| # | Tâche | Statut | Note |
|---|---|---|---|
| 6.0 | **Les trois choses qui mentent aujourd'hui** | ✅ 2026-08-03 — @claude-opus | Livré en `b8ed3c3`.  Aucune dépendance, tout s'appuie dessus. 🔴 `sameJournal` compare le `deviceId`, que `mergeJournals` fixe à celui de `a` et que `local.ts` rend différent par appareil : **deux appareils s'écriraient mutuellement à l'infini** sans qu'aucun fait ne change — exactement le défaut que `stableStringify` avait été écrit pour tuer, réapparu sur un autre champ. 🔴 `JournalSnapshot.statusLabel` stocke le statut **déjà traduit** : constaté au navigateur, `/moi` en anglais affiche « Entre deux saisons ». 🔴 `fetchDocument()` confond « pas de ligne » et « appel raté », donc un GET échoué fait pousser le local par-dessus un distant qu'on n'a pas lu. Plus `looksLikeEmail` (D19, partie code), le CRLF, le `theme_color` du manifeste et l'`aria-label` anglais en dur |
| 6.1 | **Appliquer le schéma — automatiquement** | ✅ 2026-08-03 — @claude-opus | 🔴 **Ce n'était pas « une action de Tristan », c'était un outil manquant.** Constaté le 2026-08-03 : `check-supabase` répond « la table journals n'existe pas » — le SQL n'a **jamais** été appliqué, quatre sessions après avoir été écrit, parce que l'appliquer demandait d'ouvrir un tableau de bord et de coller du texte. ⚠️ Et le malentendu vaut d'être écrit : **lier Vercel et Supabase ne synchronise que des variables d'environnement, cette intégration n'exécute jamais de SQL** — la liaison était faite, elle ne pouvait pas créer une table. Réponse : `scripts/db-push.mjs`, `npm run db:push`. Une seule action humaine restante, **irréductible** : un jeton d'accès personnel dans `.env`, parce que la clé `anon` ne peut pas créer de table — c'est exactement ce qui la rend publiable |
| 6.2 | **L'authentification, seule** | ✅ 2026-08-03 — @claude-opus · vérifié en vrai | Lien magique + OAuth, **pas de mot de passe**. ⛔ **Pas `@supabase/ssr`** : il met la session dans un cookie lu par un middleware, donc **une invocation par visite** — le dépôt a mesuré ce que ça coûte et refusé le nonce CSP pour la même raison. `/compte/retour` reste `force-static` : le composant client finit l'échange PKCE, **le serveur ne voit jamais le jeton**. Suppression de compte par fonction `security definer`, donc **sans jamais introduire de `service_role`** |
| 6.3 | **La synchronisation** *(fin de 2b)* | ✅ 2026-08-03 — @claude-opus | `SyncingJournalStore`. `load()` **ne touche jamais au réseau** (Q12 tenue par construction). Écriture débattue à 2 s. ⚠️ Un seul store par document — aujourd'hui `useJournal()` en crée un par appel. Et le « non » de `decideAdoption` exige **une clé locale par compte**, sinon le refus est contourné par la porte de derrière |
| 6.3bis | **Vérifier contre la vraie base** | ✅ 2026-08-03 — @claude-opus · ⏳ **reste Vercel** | 🔴 **La seule chose qui manque, et elle n'est pas du code.** Rien de l'authentification ni de la synchronisation n'a jamais parlé à une base réelle : tests verts, typecheck vert, build vert, **et la table n'existe pas**. Le dépôt sait exactement ce que ça vaut — `episodeMinutes` et `ordering.ts` ont été livrés morts-nés en étant verts. Ordre : `npm run db:push` → lien magique sur l'adresse de Tristan (le service intégré ne livre qu'aux membres de l'équipe, 2/h) → code à six chiffres dans un **second navigateur** → une note sur l'appareil A retrouvée sur l'appareil B → suppression de compte → couper le réseau et vérifier que tout continue |
| 6.4 | **Les tables sociales, sans surface de lecture** | ✅ 2026-08-03 — @claude-opus | `profiles`, `reserved_handles` **semée depuis le domaine**, `follows`, `activity`. 🔴 La cascade **libérerait le handle**, ce que Q7 règle 3 interdit → trigger `before delete`. 🔴 Le §5 du document ne prévoit **aucune clé naturelle** sur `activity` : sans elle **chaque synchro duplique le fil** |
| 6.5 | **La projection + le canal de signalement (5.0b)** | ✅ 2026-08-04 — @claude-opus | **Le client dérive, le serveur contraint** — le document dit « dérivée à chaque synchro » et ne dit jamais **par quoi**. Un client ne peut forger que **sa propre** activité, et il peut déjà le faire à la main puisque le journal est déclaratif ; ce qu'aucun geste ne permet, c'est le **volume et les dates**, et ces deux-là se ferment en SQL. Décision **réversible** : la projection est reconstructible |
| 6.6 | **Suivre, et le fil `/amis`** | ✅ 2026-08-03 — @claude-opus (D19 levé) | ⚠️ **Le seul lot qui ouvre du contenu de tiers.** Le verrou devient **exécutable** : si `legalIsComplete()` est faux, la page rend l'avertissement et la face ne s'affiche pas — une variable Vercel mal saisie ne peut plus ouvrir un fil sans voie de recours. Le titre d'épisode **n'est jamais dans la projection**, donc la position du lecteur n'a rien à demander au serveur et **ne peut pas fuir** |
| 6.7 | **Extraire le design system** | ✅ 2026-08-03 — @claude-opus | Après les lots 6.2-6.6, pas avant : on extrait ce que huit écrans neufs ont **réellement** répété. Le « bouton secondaire » est aujourd'hui une chaîne Tailwind recopiée 4 fois, la « carte » 3 fois, et `--color-pulse` / `--color-volt-dim` ne servent **nulle part** |


---

## 🎨 Lot 7 — UX/UI (2026-08-04) — **reprendre ici**

> **Comment reprendre à froid**, dans cet ordre :
>
> ```bash
> npm run check          # 731 tests, typecheck strict — doit être vert avant tout
> npm run db:push        # applique supabase/*.sql et vérifie RLS (jeton dans .env)
> npm run build && npm run start   # puis regarder, pas déduire
> ```
>
> ⚠️ **Le service worker sert des pages en cache** : ajouter `?v=N` à l'URL pour voir le
> build courant, sinon on juge une version d'il y a une heure. Et le screenshot de l'outil
> navigateur **ne suit pas** `resize_window` — le mobile ne peut pas être vérifié ainsi.
>
> 🔴 **Le « contournement » du 2026-08-04 était une conclusion fausse, et il faut le lire comme
> un avertissement.** Il était écrit ici que `resize_window` « redimensionne réellement la
> fenêtre, seule la capture ne suit pas ». **Mesuré le 2026-08-05 : non.** L'appel répond
> « Successfully resized » et le viewport CSS ne suit pas — `outerWidth` reste à `0`,
> `innerWidth` plafonne à **784 px** quoi qu'on demande, et l'effet réel est un **zoom
> appliqué en différé** (`devicePixelRatio` passe à 2), pas un redimensionnement.
>
> **Conséquence : `matchMedia('(width < 40rem)')` reste `false`, donc la branche mobile de la
> feuille de style n'a JAMAIS pu être exercée.** Et le détail qui doit alerter : à 784 px on
> mesure **exactement** les valeurs que la session précédente a consignées comme « mesurées à
> 360 px » — `.btn` à 38 px, cases de grille à 20 px. Ce sont les valeurs de la branche
> **bureau**. La correction des 44 px reste juste (le `.btn` de base ne change pas de hauteur
> entre 360 et 784 px, donc 38 px y vaut aussi), mais **elle est juste par accident** : la
> mesure n'a pas fait ce qu'elle annonçait.
>
> > *Une vérification mal ancrée est pire qu'aucune : elle rassure.* Quatrième fois. Et cette
> > fois-ci elle a produit une **méthode** consignée dans ce fichier pour les sessions
> > suivantes, ce qui est le pire endroit où loger une erreur.
>
> ✅ **En échange, la capture d'écran fonctionne depuis le 2026-08-05** — les deux sessions
> précédentes butaient sur « the Browser pane is not displayed ». Et elle a rapporté en une
> seconde ce que 735 tests, le typage et le build ne voient pas : **deux textes français
> privés de leurs accents** dans le bandeau de sauvegarde (« Installee sur l'ecran
> d'accueil »), c'est-à-dire le premier texte que lit un visiteur qui a des notes sans compte.
>
> **Ce qu'il faut retenir pour la prochaine session** : mesurer le bureau au navigateur, lire
> la branche mobile **dans la CSSOM** (`document.styleSheets` → les règles `@media` réellement
> parsées, ce qui prouve au moins qu'elles ont survécu au build et vivent dans
> `@layer components`), et **ne rien affirmer sur le rendu sous 640 px** sans un vrai
> téléphone ou l'émulation d'appareil. L'iframe ne sert à rien ici : la CSP interdit
> l'encadrement du site par lui-même.
>
> 🔴 **Et un piège de manipulation, qui a coûté une modification** : `git checkout <fichier>`
> pour annuler une mutation de test **ramène au dernier commit**, donc efface aussi le travail
> non committé du même fichier. Sauvegarder et restaurer par copie, jamais par git.

### Les règles posées le 2026-08-03/04 — à ne pas défaire

| Règle | Où elle vit | Pourquoi |
|---|---|---|
| **Une couleur, un sens** — le vert parle de la **série**, le volt parle de **vous** | `app/globals.css`, à côté des tokens | Le vert servait aux deux sur la fiche série : on cessait de savoir si la couleur décrivait la série ou soi |
| **`@layer components`** pour tout le vocabulaire | `app/globals.css` | Hors couche, ces classes **gagnent** sur les utilitaires Tailwind : `class="btn px-3 py-1"` n'avait aucun effet |
| **L'état choisi vient d'`aria-pressed`**, jamais d'une classe conditionnelle | `.btn[aria-pressed='true']` | Deux sources pour un même état divergent ; et c'est l'attribut qui dit la vérité à un lecteur d'écran |
| **Six formes, pas une de plus** — `.btn` `.card` `.tile` `.field` `.section-title` `.clamp-2` | `app/globals.css` | N'extraire que ce qui est **déjà répété trois fois**. Rien « au cas où » |
| **Une seule rangée de chrome** | `SiteChrome` + `Faces` | Deux rangées empilées repoussaient le titre de page à 270 px du haut |
| **Une phrase sur le stockage = un seul endroit** | `WhereItLives` | Trois écrans promettaient « rien n'est envoyé » ; le lot 6.3 les a rendus menteurs. `tests/no-false-privacy-claim.test.ts` interdit d'en écrire une quatrième |
| **Cinq crans de titre, et TOUT titre en porte un** *(2026-08-05)* | `app/globals.css` + `tests/no-adhoc-typography.test.ts` | 🔴 La règle disait « quatre crans, aucune taille en dur » et c'était la **mauvaise question** : un titre sans taille n'en écrit aucune, donc il passait — or c'était le défaut à attraper. Le test demande maintenant « ce titre porte-t-il un cran ? », ce qui refuse la taille absente **et** la taille en dur. Exceptions justifiées à la granularité du **titre**, pas du fichier |
| **Une forme et un cran sont deux choses** *(2026-08-05)* | `.section-title` (forme) + `.row-title` (cran) | `.section-title > :first-child` habillait le titre par sa **position** : un élément inséré avant lui retirait taille, graisse, capitales et interlettrage, sans erreur ni test. Un cran se pose sur le titre |
| **44 px de hauteur tactile sous 640 px** *(2026-08-04)* | `.btn`, en `@media (width < 40rem)` | Mesuré, pas supposé : les boutons faisaient 38 px. Et **seulement** sur mobile — un bouton de 44 px à la souris est simplement gros |

### Ce qui reste, par ordre de valeur

| # | Tâche | Statut | Note |
|---|---|---|---|
| 7.1 | **Vérifier le mobile pour de vrai** | 🟡 **le mobile n'a toujours PAS été vu** — 2026-08-05 | 🔴 **Et la mesure du 2026-08-04 ne portait pas sur 360 px** : `resize_window` ne redimensionne rien ici (voir l'avertissement d'outillage plus haut), le viewport plafonne à 784 px et `matchMedia('(width < 40rem)')` reste `false`. Les « 38 px » et les « 20 px » consignés sont les valeurs de la branche **bureau** — je les remesure identiques à 784 px. ✅ Ce qui **est** vérifié le 2026-08-05, dans la feuille réellement servie et parsée par le navigateur : la règle `@media not all and (min-width: 40rem) { .btn { min-height: 2.75rem } }` existe bien **dans `@layer components`**, donc un utilitaire `min-h-*` peut encore la corriger au cas par cas. ✅ **Arbitrage tranché par Tristan : grille à 32 px sous 640 px.** ⚠️ **Reste à voir sur un vrai téléphone** : les quatre pastilles de décision mesurent **26 px** au bureau et passeront à 44 px sous 640 px — **+69 %**, dans un conteneur `flex-wrap` où elles risquent de passer sur deux lignes. Personne ne l'a vu |
| 7.2 | **Les cinq faces vues à froid**, journal **vide** | 🟡 **parcouru à froid** — 2026-08-04 | `localStorage` vidé, service worker désinscrit, 2 caches purgés — donc vraiment à froid. Les cinq faces répondent et sont cohérentes : `/moi`, `/calendrier`, `/bilan` montrent le même écran vide (512 px, centré), `/` montre ses trois rangées, `/amis` affiche **l'avertissement légal** — le verrou exécutable de 6.6 fonctionne. ⚠️ **Reste ton jugement esthétique** : je n'ai mesuré que des valeurs calculées |
| 7.3 | **`/amis` avec un vrai fil** | 🟢 libre | Demande **deux comptes**. À vérifier : le caviardage des notes de saison au-delà de sa propre position, le bouton « Signaler », et qu'un fil vide dise quoi faire au lieu d'afficher zéro |
| 7.4 | **Les six écrans jamais revus** | 🟡 `/hors-ligne` fait — 2026-08-05 | ✅ `/hors-ligne` porte `.empty-state` (c'était la **14ᵉ** copie à la main du bouton secondaire, dans un fichier que ni le 6.7 ni la passe du 04 n'avaient ouvert) et aligne les **mêmes** utilitaires d'actions que `EmptyLibrary` — ce qui est la seule chose qui empêche les deux de diverger, puisque deux écrans ne font pas les trois qu'exige une extraction. Son `h1` garde `.page-title` et non `.empty-state-title` : c'est le seul `h1` de sa page, là où les quatre autres vivent sous une page qui a déjà son titre. 🟢 **Restent `/convertir`, `/regles`, `/mentions`, `/confidentialite`, `/compte/retour`** |
| 7.5 | **Une échelle typographique** | ✅ 2026-08-04 — @claude-opus | Quatre crans nommés : `.page-title` (1.5 / 1.75 rem), `.section-heading` (1.125), `.card-title` (0.875), `.empty-state-title` (1). 🔴 **Le vrai défaut n'était pas l'absence d'échelle, c'était que trois écrans avaient déjà dérivé** — `Agenda`, `MyStats` et `Friends` écrivaient leur `h2` en `font-semibold` **nu**, soit exactement la taille du corps de texte : sur ces pages la hiérarchie n'existait plus, et **rien ne le signalait**. `.card-title` n'a pas été inventé, il a été **trouvé** en cherchant ce que le test allait refuser (8 occurrences de `text-sm font-semibold`) |
| 7.6 | **`/bilan` est presque vide** | 🟢 libre | Une carte, puis du vide sur 60 % de la hauteur. ⚠️ **Problème de contenu, pas de style** : ne pas le décorer. Le quiz personnel (5.13) est le candidat naturel |
| 7.7 | **Le bandeau `DataSafety` occupe la première place** | 🟢 libre | Sur **toutes** les pages, pour qui a des notes sans compte. Ses trois règles de silence sont justes et documentées — la question est le **placement**, pas l'existence. Replié par défaut, ou sous le contenu |
| 7.8 | **`--color-pulse` ne sert nulle part** | ✅ 2026-08-05 — décision de Tristan | **Le token reste, pour un seul emploi assumé : le second halo du `body`**, qui donne au noir une profondeur que le cyan seul rendrait monochrome. Ce qui est réparé est le **commentaire**, qui annonçait « le second accent, pour ce qui se compte et se compare » — un emploi que rien n'avait jamais eu et que rien n'aurait : tout ce qui se compte ici parle de **vous**, donc relève du volt. ⚠️ *Un token qui promet un emploi qu'il n'a pas est pire qu'un token absent* : le prochain écran s'en sert en croyant appliquer une intention |
| 7.9 | **Le champ de recherche fait toute la largeur sur `/recherche`** | ✅ 2026-08-04 — @claude-opus | Mesuré : **1024 → 672 px**, la même borne que sur l'accueil |
| 7.10 | **Les quatre écrans vides ne se ressemblent pas** | ✅ 2026-08-04 — @claude-opus | Une seule forme `.empty-state` : carte centrée, 512 px, corps borné à 34 caractères. 🔴 Deux d'entre eux **recopiaient à la main** `.card` et `.btn`, extraits au 6.7 — **la duplication s'était reformée dans les fichiers que ce lot n'avait pas ouverts**, ce qui est la leçon à retenir : extraire une forme ne protège que les écrans qu'on rouvre le même jour |
| 7.11 | **`.section-title` a été extraite au 6.7 et n'est utilisée nulle part** | ✅ 2026-08-04 — @claude-opus | Employée par l'accueil et la bibliothèque, qui rendent le même objet — une grille d'affiches sous un titre — et n'avaient aucune raison de se présenter différemment. 🔴 L'original avait gardé `text-base tracking-tight uppercase`, c'est-à-dire des **capitales resserrées** : les capitales demandent plus d'interlettrage, jamais moins. La classe extraite portait la bonne valeur (`+0.1em`) et **personne ne l'avait jamais vue à l'écran** |
| 7.12 | **Deux `h2` à 14 px et trois à 18 px sur la fiche série** | 🟡 **vu au bureau, et ça se tient** — 2026-08-05 | Première capture de la fiche série depuis l'ouverture du lot. Sur le même écran, « Ce découpage n'est pas le seul » (`.card-title`, 14 px) et « Où la regarder » (`.section-heading`, 18 px) : **la hiérarchie se lit correctement** — le panneau est subordonné, la section domine. L'écart est donc voulu **et** lisible. ⚠️ Ne pas juger les tailles absolues sur cette capture, dont le facteur de zoom est incertain ; c'est le **rapport** qui a été regardé. Reste à confirmer sous 640 px, où les deux se rapprochent |
| 7.13 | **Le grand chiffre du bilan est plus petit que le titre de la page** | ✅ 2026-08-05 — décision de Tristan | `text-2xl` → `text-3xl` (30 px). 🔴 **Mais la prémisse ne valait qu'au-dessus de 640 px, et le commentaire ne le disait pas** : `.page-title` fait 24 px sous ce seuil et 28 px au-dessus, donc sur mobile l'ancien 24 px **égalait** le titre au lieu de passer après lui — et le nouveau 30 px le dépasse de 25 %, dans une carte de 360 px. ⚠️ **Non vu** : le mobile n'est pas atteignable (7.1). Le contenu de l'écran reste 7.6 |
| 7.14 | **Le `/code-review` du lot 7 : neuf titres n'ont aucun cran, et la garde ne les voit pas** | ✅ 2026-08-05 — @claude-opus | 🔴 **Le défaut que 7.5 annonçait avoir corrigé.** Il en a réparé trois et laissé **sept** `h2` en `font-semibold` nu — `OrderingNotice`, `JournalSync`, `Friends`, `AccountPanel` ×2, `/regles`, `/mentions`, `/confidentialite` — plus deux `h3` que son motif `<h[12]` ne regardait pas. **734 tests verts.** La cause est la question posée : « écrit-il une taille en trop ? » laisse passer un titre qui n'en écrit aucune, or c'était le défaut. ✅ Quatre autres faux négatifs fermés : `h3` ignoré, `className` en template literal invisible (le faux négatif de `.tile`, refait), `text-[28px]` et `style={{fontSize}}` non vus, et `ALLOWED` qui exemptait un **fichier** entier. ✅ Quatre mutations vérifiées + le test reste vert lancé depuis `app/`. **Vérifié au navigateur** : les 10 titres de la fiche série portent tous un cran, 28/18/14 px, et le sélecteur positionnel a disparu de la feuille servie |
| 7.15 | **Les quatre pastilles de décision passent de 26 à 44 px sous 640 px** | 🟢 libre | Conséquence non regardée de la hauteur tactile. Mesurées **26 px** au bureau (`text-xs`, `py-1`) ; sous 640 px `min-height: 2.75rem` les porte à 44 px, soit **+69 %**, dans un `flex flex-wrap`. Elles risquent de passer sur deux lignes sur la fiche série. ✅ Le mécanisme est sain — la règle vit dans `@layer components`, donc `min-h-*` peut la corriger là où c'est trop (contrairement à ce qu'affirmait la relecture). ⚠️ **C'est un choix de goût, pas un correctif** : 44 px est la bonne cible tactile, la question est l'encombrement. Demande un vrai téléphone (7.1) |
| 7.16 | **Un `<p>` joue un titre dans `TrajectorySection`** | 🟢 libre | `TrajectorySection.tsx:119` — `<p className="text-sm font-medium">{t('entry.title')}</p>` titre l'encart du point d'entrée sans être un titre. ⚠️ **Question d'accessibilité, pas de typographie** : en faire un `h3` change l'arbre du document et la table des matières que lit un lecteur d'écran. Délibérément **pas** traité dans un lot sur les tailles — et invisible à `no-adhoc-typography`, qui ne regarde que les `<h*>` : *un `<p>` qui joue un titre est précisément ce qu'une garde sur les titres ne peut pas voir.* ⚠️ *(La note disait « qui ne regarde que `h1`–`h3` » : corrigé le 2026-08-06, la garde va jusqu'à `h6` depuis `48b869f`. Ça ne change rien à cette tâche, mais une note périmée dans un fichier de reprise est crue.)* |
| 7.17 | **Quatre copies du même parcours de répertoire dans les tests de conformité** | 🟢 libre | `no-adhoc-typography`, `no-hardcoded-strings`, `no-journal-on-server`, `no-ssr-auth` portent chacun son `sourceFiles`. ⚠️ **Pas extrait, et c'est un choix** : les quatre **diffèrent** (`withFileTypes` contre `statSync`, filtres et racines distincts), donc un helper commun toucherait trois gardes vertes pour zéro défaut. À faire **le jour où l'une doit changer** — pas « pendant qu'on y est », ce que ce dépôt s'interdit |

---

## ✍️ Lot 8 — écrire : critiques, cœurs, exceptions de progression (2026-08-06)

> **🔒 Réservé — @claude-opus — 2026-08-06.**
>
> **Le motif, et il tient en une phrase : ce produit ne sait écrire nulle part.** Il n'existe
> aujourd'hui aucun champ de texte libre dans tout le dépôt, sauf la `note` d'un signalement.
> Confronté à la cible « TvTime × Letterboxd » demandée par Tristan, c'est le manque le plus
> structurant — devant les listes, devant le profil public, devant le bilan annuel.
>
> **Trois décisions de Tristan, 2026-08-06** :
> 1. On ouvre par **l'écriture** : critiques **publiques**, par **série ET par saison**.
> 2. Plus le **cœur** — la note dit la qualité, le cœur dit l'attachement, et ce n'est pas la
>    même information (motif Letterboxd).
> 3. La progression devient **« pointeur + exceptions »** : le pointeur reste la vérité, on
>    peut marquer un épisode **sauté** ou **vu en avance**. Additif — pas de cases à cocher
>    partout, donc pas la friction de saisie qui est *la cause n°1 d'abandon des trackers*
>    (`RESEARCH.md`).
>
> **Hors périmètre, et dit** : les listes (leur prérequis 4.5 est traité ici, mais elles sont
> un lot à part), la page de profil public `/@handle`, le bilan annuel, A12 (le plafond de
> nuisance d'une image n'est pas celui d'un texte).

| # | Tâche | Statut | Note |
|---|---|---|---|
| 8.0 | **La tolérance de format** | ✅ 2026-08-06 — @claude-opus · **poussée, CI verte, servie en production** | 🔴 **Elle répare un défaut présent aujourd'hui, indépendant du lot.** `remote.ts:135` porte le commentaire « un document écrit par une version plus récente ne doit pas casser celui-ci » et appelle `parseJournal`, qui **jette exactement ce cas** (`journal.ts:763`) et retourne **`kind: 'found'` avec un journal vide**. Six maillons plus loin (`syncing.ts:145` → `sync.ts:143` → `remote.ts:163`, `POST merge-duplicates`), **un seul clic détruit le local ET le distant**. Le type `RemoteRead` distingue déjà `absent` de `unavailable` précisément pour ça : la garde manque à un endroit. Livre (a) le **pass-through des champs inconnus** — sans quoi un ancien client dépouille silencieusement les critiques à chaque synchro — et (b) `tryParseJournal` + le sauvetage local. **Aucun comportement observable ne change**, c'est ce qui la rend déployable seule |
| 8.1 | **Mesurer le journal** (ferme **4.5**, ouverte depuis le lot 4) | 🟢 libre | ≈ 930 o/série suivie ; une critique de série + six de saison = ≈ 5 ko sur une entrée, ×5,4. `serializeJournal` tourne **à chaque geste** et chaque poussée réécrit **tout** le document. Livre `MAX_REVIEW_CHARS` et un budget de taille **testé**, pas la synchro par delta — *n'écrire la mécanique qu'au moment où il y a quelque chose à mécaniser* |
| 8.2 | **Le cœur** | ✅ 2026-08-06 — @claude-opus | `setLiked` (jumeau de `wanted`), projection `liked` dans le fil, `supabase/005_liked.sql` qui **remplace** la contrainte de genre, bouton sur la fiche série. ⚠️ Corrigé au passage : `feed()` transtypait le genre **sans le valider** — un serveur en avance d'un déploiement produisait une ligne muette. Un test creux trouvé par sa propre mutation : « retirer le cœur ne retire pas `wanted` » ne tombait pas, faute de fusion |
| 8.3 | **Les exceptions de progression** | ✅ 2026-08-06 — @claude-opus | `episodeMarks`, un seul enregistrement par épisode donc exclusion mutuelle **vraie par construction**. Tombstone `mark:` et non `episode:`, déjà pris. 🔴 **Le piège** : `tally` compte par `total − restant`, donc passer les marques à `remainingAfter` ferait **monter** les heures vues d'un épisode déclaré sauté. D'où `classifyMarks`, seul endroit qui tranche, avec deux listes nommées. Mutation vérifiée : le réflexe naïf fait tomber 2 tests. `nudge` et `library` auraient cassé en silence | watched`), donc exclusion mutuelle **vraie par construction**. ⚠️ Tombstone `mark:3:7` et **surtout pas** `episode:3:7`, déjà pris par la note d'épisode. 🔴 **Le piège du lot est dans `tally.ts:167`** : `vus = total − remaining`, donc brancher les marques naïvement ferait qu'un épisode **sauté** *monte* les heures vues — on compterait comme regardé ce qu'on a déclaré ne pas avoir regardé |
| 8.4 | **Les critiques : domaine et caviardage** | ✅ 2026-08-06 — @claude-opus | `reviews` dans le journal (fusion par `mergeDated`, déjà généralisé), `checkReview` sur le patron de `checkHandle`, et le caviardage dans **`spoiler.ts`** — là où `AGENTS.md` règle 7 dit qu'il doit vivre, plutôt qu'un module neuf |
| 8.5 | **Réveiller le code mort du social** | ✅ 2026-08-06 — @claude-opus | 🔴 `setVisibility()` et `unfollow()` n'avaient **aucun appelant** et la visibilité était codée en dur à `followers` : le social était bâti et **aveugle**. Trois boutons de visibilité, un « ne plus suivre », et quatre tests qui lisent la source |
| 8.6 | **La table `reviews` + la publication** | ✅ 2026-08-06 — @claude-opus | `supabase/006_reviews.sql`, **appliqué à la vraie base** (`db:push`) et vérifié : lecture anonyme vide, écriture anonyme refusée en 401. `can_see()` de 003 réutilisée. `hidden_at` rend exécutable « on masque, on ne supprime jamais » |
| 8.7 | **Écrire** (UI) | ✅ 2026-08-06 — @claude-opus | `ReviewEditor`, monté au niveau série **et** saison. Écrire et publier sont deux gestes : on peut tenir un carnet privé sans rien publier. La borne de spoiler est déclarée par l'auteur — prérenseignée depuis sa position, jamais déduite en silence (règle 7). ✅ **Le verrou légal est levé, en local ET en production** : `/mentions` affiche l'éditeur sur le site servi, vérifié le 2026-08-06 |
| 8.8 | **Lire** (UI caviardée) | ✅ 2026-08-06 — @claude-opus | `Reviews`, chargement paresseux, **aucune route serveur** — la page reste `force-static` et le coût Vercel est nul. Le caviardage se fait dans le navigateur avec le journal du lecteur : le serveur ne sait pas où en est celui qui lit. Le texte masqué est **déplacé** dans `hiddenText`, pas caché en CSS — mutation vérifiée |
| 8.9 | **Boucler** | 🟡 partiel | ✅ L'export/import porte les trois champs neufs sans rien changer : ils traversent `parseEntry`/`serializeJournal`, testés. 🟢 **Restent** : la phrase de `/regles` sur le retrait d'une critique, et `ARCHITECTURE-APP.md` §5 dont la ligne « pas de texte libre avant 5.0 » est désormais levée |

## 🔎 Lot 10 — l'audit : les failles, et les tests (2026-08-07) ✅

> **Demande de Tristan** : « audite le tout, simplifie ce qui doit l'être, simplifie
> également les tests, essaye de réfléchir à contre-sens pour trouver les failles. »
> C'est la **deuxième fois** qu'il demande de simplifier les tests — la première avait
> produit la règle qui a gouverné ce lot : *on garde un test si l'on sait nommer le bug
> qu'il attrape ; on le supprime s'il ne fait que redire le code.*
>
> **787 → 708 tests**, typecheck strict vert, 29 routes prérendues (inchangé).
> Six failles fermées, deux tests creux réparés, **chaque correctif prouvé par mutation**.

### 🔴 Les failles trouvées, et ce qu'elles avaient en commun

**Cinq des six décrivaient le dépôt d'avant.** Ce n'est pas de la négligence : c'est la
forme d'échec de ce projet, et elle a maintenant un nom.

| # | Faille | Ce qui la rendait invisible |
|---|---|---|
| A1 | **La garde CI des secrets était aveugle deux fois** : elle excluait `':!*.md'` — le seul type de fichier qui contienne une clé — et ne connaissait que le JWT hérité. `sb_secret_` (service_role, contourne RLS) et `sbp_` (le jeton personnel que `db-push.mjs` demande de poser) **passaient en vert** | Elle protégeait d'un cas qui n'arrive plus pendant que le cas réel était nu |
| A2 | **`no-journal-on-server` couvrait 3 modules sur 9.** `app/journal/journalStore` n'était pas listé, alors qu'il importe `local`, `remote` et `syncing` à sa première ligne | Une liste noire de **fichiers** se périme à chaque ajout. Elle barre désormais les **répertoires** |
| A3 | **Écrire une critique ne faisait pas remonter la série dans « Reprendre ».** `lastTouch` énumérait les champs à la main et il en manquait deux — `reviews` et `completions`, c'est-à-dire tout le lot 8 | L'oubli s'était **déjà produit** : `liked` avait été ajouté après coup, avec un commentaire posé au-dessus de la mauvaise ligne |
| A4 | **`src/social/client.ts` promettait de ne jamais lever, et levait.** Le `try/catch` couvrait le réseau, pas le post-traitement : un corps JSON valide de la mauvaise forme traversait le garde puis `rows.map` levait | `?? []` ne rattrape que `null`/`undefined` — le piège du `??`, deuxième fois dans ce dépôt |
| A5 | **`/regles` annonçait au public qu'il n'existe « aucun profil public, aucun commentaire »** — sur la page indexable, liée depuis tous les pieds de page, dont le rôle entier est de dire la vérité sur ce qu'on héberge | Le lot 8 a livré critiques, profils et fil. Aucune garde ne regarde le contenu des pages |
| A6 | **`no-orphan-component` ne voyait que `export function X`** — `export const Foo = () => …` lui était invisible | Trou latent, fermé pendant qu'il ne coûtait rien |

### La leçon de méthode, et elle vaut plus que les six correctifs

🔴 **Mon propre outil de détection de code mort a menti** — il annonçait `parseJournal` et
`t` comme morts. *Un outil de diagnostic qui ment est pire qu'aucun outil* : **quatrième
fois** dans ce dépôt, **deuxième fois que c'est l'agent qui l'écrit**. Il n'a été cru
qu'une fois **ancré** — une preuve qu'un symbole vivant est vu, une preuve qu'un symbole
inexistant ne l'est pas — et l'ancrage a refusé de publier les résultats.

⚠️ **Et j'ai failli écrire « mutation vérifiée » sur une mutation qui n'avait pas eu
lieu** : un script de substitution n'avait rien substitué, et les tests restaient verts
« sous mutation ». Depuis, toute mutation passe par une édition qui **échoue bruyamment**
si elle ne s'applique pas.

🔴 **Quatre conclusions d'agents écartées après vérification** — c'est le contre-sens
appliqué à l'audit lui-même :
1. La « fuite de spoiler » d'`activity.ts:134` : **fausse**. Le `@param` de
   `redactActivity` dit *exactement* ce que le code fait (« rendre `undefined` pour une
   série qu'il n'a pas commencée : dans ce cas **rien** n'est masqué »). Décision écrite,
   et cohérente avec `entry-point`, que le produit montre **exprès** à qui n'a pas
   commencé. ⚠️ **Ce qui reste vrai** : `spoiler.ts:47` et `activity.ts:134` ont des
   défauts **opposés** pour la même entrée, chacun justifié séparément — à nommer dans
   `AGENTS.md` règle 7 pour que le prochain chemin de caviardage n'en tire pas un au hasard.
2. Supprimer le test « la page série câble le bandeau » : **non**. `no-orphan-component`
   écrit lui-même qu'il est « moins précis sur **où** le composant est monté », et le dépôt
   a une mutation documentée — le retirer laissait 655 tests verts.
3. Retirer le `clear()` de `data-safety` : **non**, il défait le `beforeEach` du fichier.
4. « Huit tests redondants » : **un seul** l'était vraiment.

⚠️ **Une garde automatique a été mesurée puis refusée.** Détecter les affirmations périmées
par leurs marqueurs de temps : « jamais » sort **177 fois** (noyade), « aujourd'hui | pour
l'instant » **18 fois** — c'est une liste qu'on relit, pas une mécanique qu'on écrit. Relues
à la main : **5 fausses, pas 3**. La relecture en a trouvé deux de plus que l'agent, dont
celle de `/regles`. *Un garde-fou adossé à quinze exemptions est un garde-fou qu'on désactive.*

### Les tests : 787 → 708, sans perdre un bug attrapé

- 🔴 **Deux tests creux**, dont un qui reproduisait l'anti-patron que `CLAUDE.md` nomme mot
  pour mot. `data-safety` : `await waitFor(() => textContent === '')` s'arrête au **premier**
  passage réussi, et le rendu initial est déjà vide. **Prouvé, pas affirmé** : composant muté
  pour parler en toutes circonstances → ancienne version **7 passed**, nouvelle **1 failed**.
  La parade (la sonde `Probe`) était déjà écrite quarante lignes plus bas dans le même fichier.
- **87 tests pour une propriété.** `no-hardcoded-strings` employait `it.each(files)` : 11 % du
  total du dépôt mesurait la taille de `app/`, pas la couverture. Un seul `it()` désormais,
  avec la **liste complète** des fautes et le chemin **dans** la ligne — meilleur diagnostic.
- **22 égalités sur du texte littéral** dans `format.test.ts`, pour des bugs qui sont des
  **chiffres**. Comparées à `tn('fr', 'say.awaiting.since', 25)`. **Double mutation** : calcul
  faussé → 4 tests tombent ; dictionnaire reformulé → **24 verts**. ⚠️ Et la mutation a trouvé
  un 25ᵉ couplage que la relecture avait raté.
- Le **dé-commentateur** était écrit quatre fois, et deux copies portaient des chemins relatifs
  au répertoire courant — la leçon écrite dans `no-adhoc-typography` et non appliquée ailleurs.
  ⚠️ **Contrainte trouvée en la corrigeant** : `import.meta.url` n'est pas une URL `file:` sous
  jsdom, donc `tests/sources.ts` n'est utilisable que dans le projet `domain`. Les chemins
  relatifs des tests `.tsx` ne sont **plus un oubli, mais une contrainte**.

---

## 🏁 Verdict de stabilité (2026-08-07) — **lire ceci en premier**

> Demande de Tristan : *« continue ce process jusqu'à me dire, en le justifiant jusqu'au
> bout, que tu as une base stable. »* Voici la réponse, mesurée. **Elle est nuancée, et la
> nuance est le sujet.**

### ✅ Ce qui est stable, et prouvé

| Mesure | Avant | Après |
|---|---|---|
| Plus gros fichier | **1858 l.** (`journal.ts`) | **716 l.** (`lib/catalog.ts`) |
| Fichiers > 1000 lignes | 2 | **0** |
| Chaînes de classes répétées ≥ 3× dans `app/` | 3 formes (19 + 5 + 3 sites) | **0** |
| Tests | 787 | **718** |
| Score de mutation du **domaine** | 57/77 (74 %) | **63/78 (81 %)** |
| CI | jamais lancée sur ce travail | ✅ **verte** |
| Dépendances de production | 4 | **4** |
| Routes prérendues | 29 | **29** |

- **Chaque correctif de la session est prouvé par mutation, pas par relecture.** Sans
  exception, y compris les deux mutations qui ont montré que mes propres tests étaient creux.
- **Le domaine est pur, et l'est redevenu** : `stopPointAdvice` vivait dans la couche réseau.
- **Deux refactors du cœur sans toucher un seul test** (`journal.ts`, `i18n.ts`) : un barillet
  garde la surface publique, donc les tests eux-mêmes sont la preuve de neutralité.

### 🔴 Ce que je ne peux PAS attester — et c'est ce qui compte

1. ✅ **Levé le 2026-08-07 : tout est poussé et la CI est verte** — 27 commits, `check`
   (typecheck + 718 tests + build) et `secrets` (la garde corrigée). C'était **le** point
   bloquant du verdict, et c'est la seule preuve que ce dépôt accepte.
2. 🔴 **15 mutations survivent — ~19 % des décisions du domaine.** Quatre des plus graves ont
   été fermées, chacune par sa mutation : `trajectory:240` (le garde-fou de dispersion, qui
   aurait rendu **toute** page notée par la foule « indifférenciée »), `nudge:93`,
   `write:305`, `cadence:103`. ⚠️ **Une partie du reste sont des mutants équivalents** —
   `import.ts:120` en est un, vérifié : `toStars(0)` est déjà testé et la garde fait doublon
   avec le contrôle d'échelle en aval. *Un survivant ne se compte pas, il se lit.*
   Reste : `calendar:150`·`302` · `catch-up:99` · `current-season:80` · `entry-point:164` ·
   `import:120`·`335` · `merge:32` · `parse:144`·`259` · `ordering:157` · `seasons:245` ·
   `trajectory:203`·`219`·`307`.
3. 🔴 **Le score ne couvre que `src/domain/`.** `lib/`, `src/catalog/`, `src/social/` et `app/`
   n'ont **jamais** été mutés. `src/social/client.ts` fait 422 lignes et n'a que 4 tests, tous
   écrits aujourd'hui sur une seule propriété.
4. ⚠️ **Rien n'a été vu à l'œil.** Le lot 9 attend les captures, le mobile n'a jamais été
   regardé (7.1), et la divergence `.card` / `.panel` est **nommée mais pas tranchée** —
   ça se regarde, ça ne se déduit pas.
5. ⚠️ **Le volume n'a pas baissé** — ~19 200 → ~19 400 lignes hors tests. Les découpages
   ajoutent des en-têtes qui expliquent le contrat de chaque brique. **Ce projet n'est pas
   devenu plus petit, il est devenu segmenté**, et c'est la seule chose que je puisse
   défendre : le plus gros fichier a fondu de 61 %, la duplication a disparu, et la surface
   qu'il faut tenir en tête pour modifier une brique est celle de la brique.

### La phrase exacte

> **La base est stable au sens de ce dépôt : tout est poussé, la CI est verte, et le domaine
> est mieux gardé qu'il ne l'a jamais été (81 %). Ce qui reste n'est pas une fragilité
> cachée — c'est une liste : 15 décisions nommées, ligne par ligne, dont on sait qu'elles ne
> sont pas gardées.**

**La suite, dans l'ordre** : lire les 15 survivants un par un (`calendar` et `catch-up`
d'abord — 35 tests qui ne gardent aucune décision de leur module), puis **muter `lib/` et
`src/social/`, qui n'ont jamais été mesurés** — `src/social/client.ts` fait 422 lignes et
n'a que 4 tests.

---

## 🧬 Lot 12 — le mutation testing, et ce qu'il dit du nombre de tests (2026-08-07)

> **Question de Tristan, posée deux fois** : « c'est impossible qu'on ait besoin de 750
> tests ». Ma première réponse reposait sur **une seule mutation** — trop mince. Mesuré
> pour de bon : **77 mutations** jouées sur `src/domain/`, une suite complète par mutation.

### 🔴 Le résultat, et il renverse la question

| | |
|---|---|
| mutations tuées | **57** |
| mutations **survivantes** | **20** — soit **26 % des décisions du domaine que personne ne garde** |
| tests qui tombent par défaut, **médiane** | **4** |
| défauts attrapés par **un seul** test | **11 sur 57** |

**Une suite redondante ferait tomber des dizaines de tests par défaut.** Ici la médiane est
4, onze défauts ne sont vus que par un test unique, et un quart des décisions n'est pas
gardé du tout.

> **La suite n'est pas trop grosse, elle est mal distribuée.** `calendar.ts` a **20 tests** et
> **aucune** de ses deux décisions gardée — dont 17 vérifient le *format* du `.ics`, jamais
> son *effet*, ce que ce dépôt avait déjà écrit une fois. Pendant que `spoiler`, `remaining`,
> `taste`, `status`, `activity` et `library` n'ont **aucun survivant**.

### ✅ Ce qui a été fermé

🔴 **`import.ts` — un export sans colonne de titre importait ZÉRO série.** 4 de ses 8
mutations survivaient, avec 14 tests. Le trou tient en une ligne :
`if (idColumn < 0 && titleColumn < 0) return []`. Les quatorze tests employaient **tous** un
document portant à la fois un identifiant **et** un titre. L'orphelin de TV Time colle un
export qui n'a que `tmdb_id`, lit « 0 série importée », et n'a aucun moyen de savoir
pourquoi — pour la population même que `/convertir` vise. Trois tests, mutations vérifiées.

### 🟢 Les 18 mutations qui survivent encore, par ordre de gravité

| Module | Ligne | Ce qui n'est pas gardé |
|---|---|---|
| `import.ts` | 120, 335 | deux décisions de lecture de plus |
| `calendar.ts` | 150, 302 | **les deux seules décisions du module**, 20 tests à côté |
| `tally.ts` | 114, 248 | `wasWatched` rend `true` sur les achèvements — muter en `false` ne casse rien |
| `journal/parse.ts` | 144, 259 | deux bornes de lecture |
| `catch-up.ts` | 99 | la seule décision du module, 15 tests à côté |
| `nudge.ts` | 93 | le `&&` qui filtre les marques par saison |
| `current-season.ts` | 80 · `entry-point.ts` 164 · `seasons.ts` 245 · `ordering.ts` 157 · `cadence.ts` 103 · `trajectory.ts` 240 · `journal/merge.ts` 32 · `journal/write.ts` 281 | une borne chacun |

⚠️ **À traiter comme des candidats, pas comme des bugs.** Une partie sont des **mutants
équivalents** (`< now` contre `<= now` ne diffère qu'à la milliseconde près). J'en ai examiné
quatre à la main : `import.ts` ×2 étaient de vrais trous, `calendar.ts` ×2 sont probablement
équivalents. **Chaque survivant se juge en le lisant, jamais en le comptant.**

### L'outil

`mutants.mjs` + `analyse.mjs` vivent dans le scratchpad de session, **délibérément hors du
dépôt** : c'est un instrument de mesure, pas une garde. Il s'ancre avant de servir — suite
verte au départ, sinon il refuse de publier — parce que **deux outils de diagnostic ont déjà
menti ici, dont un que j'avais écrit moi-même le matin même**.

---

## 🧱 Lot 11.0 — `journal.ts` devient six briques (2026-08-07) ✅

> **Question de Tristan** : « tu peux diviser par 10 le nombre de tests ? Continue cette
> réflexion de segmentation des briques pour avoir un château de cartes qui tient et qui
> est super clair. »

**La mesure qui a tout décidé** : **297 des 708 tests — 42 %** — visaient
`src/domain/journal.ts`, un fichier de 1858 lignes et 54 exports. Et le contraste interne
disait tout :

| | code | tests | forme |
|---|---|---|---|
| `mergeJournals`, la seule partie **déjà isolée** | ~90 l. | **10** | 6 **lois** sur 120 graines |
| tout le reste | ~1760 l. | ~290 | des **exemples** |

> **Le nombre de tests ne mesure pas la prudence, il mesure l'absence de contrat.** Un
> module à 54 exports n'a aucune phrase à tester, alors on écrit des exemples. Un module à
> un export se teste par « c'est commutatif, associatif, idempotent », et c'est fini.

**Les six briques**, chacune avec sa phrase : `types` (534 l., les formes) · `parse`
(528 l., *lire est idempotent, rien ne lève*) · `write` (415 l., *rejouer un geste
l'annule*) · `merge` (247 l., **1 export**) · `derive` (108 l.) · `entry` (88 l., *quand
une entrée vaut d'être gardée*).

- **`entry.ts` n'était pas prévu** : `hasContent`, `worthKeeping` et `dedupeByDay` servent à
  la lecture, à l'écriture **et** à la fusion. Les laisser dans le parseur aurait fait
  dépendre l'écriture de la lecture.
- ✅ **La preuve que le découpage est neutre** : un barillet garde la surface publique au
  symbole près, donc **aucun fichier de test n'a été touché**. 708 verts, `git status tests/`
  vide. *Un refactor du cœur du produit sans toucher un seul test est un refactor dont on
  peut prouver qu'il n'a rien changé.*
- ⚠️ **Le découpage a failli rouvrir la faille fermée le matin même** : `no-journal-on-server`
  barrait `@/src/domain/journal` avec une **ancre de fin**, donc `…/journal/write` lui serait
  passé sous le nez.

### 🔴 La réponse à « ÷10 », et elle est mesurée

**Non, et voici la preuve.** J'ai muté le pass-through des champs inconnus et lancé la suite
entière : **sur 711 tests, un seul tombe** — l'exemple « préserve un champ inconnu ». Ni les
six lois de fusion, ni les trois lois de lecture, ni les 120 graines ne le voient.

> **Les lois et les exemples n'attrapent pas les mêmes choses.** Supprimer les exemples au
> nom des lois, c'est perdre le seul garde-fou du pass-through — le mécanisme même que le
> lot 8.0 a construit. Les lois **s'ajoutent**, elles ne remplacent pas.

Et sur les quatorze exemples du plus gros bloc, la relecture en donne **quatre** couverts par
une loi, et **dix** qui nomment chacun un bug qui a réellement eu lieu.

🔴 **La première loi écrite était fausse, et c'est le meilleur résultat du lot.** J'avais
énoncé `parse(serialize(j)) = j` ; elle échoue dès la graine 21. Ce n'est pas un défaut :
**`parseJournal` n'est pas un décodeur pur, il *vieillit* le document** (traces à 90 jours,
instantanés à 30). Le contrat exact est l'**idempotence**, et personne ne l'avait écrit.
*Une loi fausse qui échoue vaut mieux qu'un exemple juste qui ne dit rien.*

### ✅ Brique suivante faite : `lib/i18n.ts` (2026-08-07)

**1459 → 254 lignes.** 84 % du fichier étaient des phrases, pas du moteur : les deux
dictionnaires partent dans `lib/i18n/fr.ts` (659 l., 482 clés — **la source du typage**) et
`lib/i18n/en.ts` (587 l.).

- ✅ **Le typage ne change pas d'un iota** : `MessageKey` vaut toujours `keyof typeof FR`, et
  `en.ts` déclare `Record<keyof typeof FR, string>`. Une clé française sans équivalent anglais
  ne compile toujours pas — la contrainte que 8.10 pose explicitement.
- ⚠️ **Ça ne résout PAS 8.10** : séparer des fichiers ne sépare pas des chunks. Ça le rend
  faisable.
- 🔴 **Deux gardes sont tombées, et c'était la bonne alerte** : elles encodaient « le
  dictionnaire est **un** fichier ». `no-hardcoded-strings` excluait `lib/i18n.ts` du parcours
  et a donc accusé **274 phrases légitimes** ; elle exclut maintenant le **répertoire**.
  `no-false-privacy-claim` lisait le **fichier** pour y chercher une clé ; elle interroge
  maintenant l'**objet**. *Ce qui compte est que la clé existe, pas où elle est écrite.*

### ▶️ Les briques restantes

`lib/catalog.ts` (770 l., trois métiers : cache réseau, URL d'affiches, et un conseil d'arrêt
qui est du **domaine pur** coincé dans une couche réseau) · et `journal/types.ts` (534 l.,
31 exports) dont l'**algèbre des clés** mérite sa brique.

---

## 🧹 Lot 11 — la simplification du code (trouvé au lot 10, **non exécuté**)

> Décision de Tristan (2026-08-07) : **les failles d'abord, seules**. Tout ce qui suit est
> mesuré et vérifié, et attend son lot. Rien ici ne porte de bug : ce sont des coûts.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 11.1 | **Deux formes de carte concurrentes** | 🟢 libre — **à faire avec le lot 9** | `globals.css:557` promet « un seul rayon, une seule bordure, un seul fond dans toute l'application ». C'est **faux** : `.card` (rayon `0.75rem`, fond à 80 %) est employée **8 fois**, contre **19** copies à la main en `rounded-lg` (`0.5rem`) et fond **opaque**. **6 rayons distincts** circulent. Visible à l'œil, donc à traiter avec la direction visuelle |
| 11.2 | **Trois formes au-dessus du seuil d'extraction** | 🟢 libre | La règle du dépôt est trois répétitions. La grille d'affiches (×3, `page.tsx`/`Library.tsx`/`serie/[id]`), le paragraphe de prose (×5), `text-{xs,sm} text-(--color-muted)` (×19 chacun) |
| 11.3 | **`setWanted` et `setLiked` sont identiques** | 🟢 libre | `journal.ts:1363` et `:1484`, au nom du champ près — vérifié par normalisation. Un troisième drapeau daté produirait une troisième copie, et le jeu de pierres tombales devrait être corrigé trois fois |
| 11.4 | **45 `export` que personne n'importe** | 🟢 libre | 44 types + `CURRENT_PROVIDER`. Retirer le mot-clé, pas le symbole. ⚠️ Mesuré par un outil **ancré** — le premier en annonçait 201, dont `parseJournal` |
| 11.5 | **Deux clés de dictionnaire orphelines** | 🟢 libre | `friends.following` (le composant utilise `friends.followingLabel`) et `review.none`. 4 lignes |
| 11.6 | **16 paramètres `AbortSignal` jamais passés** | 🟢 libre | `CatalogProvider` + `TmdbProvider`, 7 méthodes. Aucun appelant n'a jamais fourni de signal |
| 11.7 | **L'horloge est injectable, pas injectée** | 🟢 libre | **18 `new Date()`** en valeur par défaut dans `src/domain/`, et quatre appels de production omettent l'argument dans un `useMemo([journal])` (`Library.tsx:42`, `MyStats.tsx:35-36`, `ResumeStrip.tsx:27`) : **l'heure est lue au montage et jamais relue**. Une PWA installée et laissée ouverte affiche « revient dans 3 jours » indéfiniment. ⚠️ La règle 2 dit « tout instant est injecté » — ce qui est vrai est « **injectable** » |
| 11.8 | **Le test de `/regles` compte des `<li>`, pas des motifs** | 🟢 libre | `rules-page.test.tsx:29-36` affirme `listitem >= REPORT_GROUNDS.length` : il passe si la page liste cinq puces sans rapport. À renforcer, pas à supprimer — la propriété (« tout motif appliqué a été publié ») est la bonne |
| 11.9 | **Deux `eslint-disable` pour un linter absent** | 🟢 libre | `Poster.tsx:50`, `WatchOptions.tsx:96`. Le dépôt n'a **aucune** dépendance ESLint |

---

## 🎨 Lot 9 — la direction visuelle (2026-08-06) — **le vrai sujet ouvert**

> **Verdict de Tristan : « le site est hyper moche », et il faut une vraie direction** — pas
> des retouches. C'est le trou de tout le projet : le lot 7 a posé un design *system*
> (formes, crans, tokens) et **personne n'a jamais jugé le résultat**. Les trois notes de
> `CLAUDE.md` le disaient déjà : *« reste ton jugement esthétique — je n'ai mesuré que des
> valeurs calculées »*.
>
> 🔴 **La leçon, et c'est la même que le SEO en cul-de-sac et le cache inopérant** : un
> système cohérent, mesuré, testé, **peut produire un rendu laid sans qu'aucune mesure ne le
> signale**. `no-adhoc-typography` prouve qu'un titre porte un cran ; il ne dit rien de la
> beauté de l'échelle. *Auditer le résultat, jamais l'intention* — y compris celui de son
> propre design system.

### Ce que le code trahit, à confirmer **en regardant** (hypothèses, pas constats)

| Piste | Ce que dit le code | Pourquoi c'est un candidat sérieux |
|---|---|---|
| **Aucune police n'est chargée** | `font-src 'self'`, et `CLAUDE.md` assume : « le caractère vient de la grille monospace appliquée aux chiffres » | Le site s'affiche donc en **Segoe UI système**. C'est le premier signal de « pas designé », et il survit à n'importe quelle qualité de mise en page. ✅ Corrigeable **sans toucher la CSP** : une police variable auto-hébergée est servie par `'self'` |
| **Noir bleuté + cyan** | `--color-ink: #08090e`, `--color-volt: #22d3ee` | Cohérent, documenté… et c'est l'exact cliché du tableau de bord technique. Froid pour un produit dont le sujet est ce qu'on aime regarder. ⚠️ La règle « une couleur, un sens » est bonne et doit survivre à tout changement de palette |
| **L'affiche est l'interface** | Règle posée dès le départ | Si le châssis lutte contre les affiches au lieu de les porter, aucune palette ne sauvera l'écran |

### La méthode, et elle n'est pas négociable

1. ⛔ **Ne rien changer avant d'avoir vu.** Ce dépôt a déjà payé le design à l'aveugle. Il
   faut une capture de l'accueil, de la fiche série et de `/moi`, **avant**.
2. **Une référence choisie par Tristan** — un site dont il aime le rendu. « Faire plus beau »
   n'est pas une consigne exécutable ; « ressembler à ça » l'est.
   ✅ **Tranché le 2026-08-06 : c'est Letterboxd.** Et la référence dit déjà quelque chose de
   précis sur la palette, avant même de la regarder : son fond est un **charbon chaud**
   (`#14181c`), pas un noir bleuté (`#08090e` ici), et ses trois accents — vert `#00e054`,
   bleu `#40bcf4`, orange `#ff8000` — correspondent presque terme à terme à `--color-live`,
   `--color-volt` et `--color-warn`. **Donc le sujet n'est probablement pas les accents, c'est
   le fond.** Noté pour l'étape 2, pas exécuté : une seule chose à la fois.
3. **Une seule chose à la fois, revue à l'œil** : typo, puis palette, puis densité. Trois
   changements simultanés rendent impossible de savoir lequel a aidé.
4. **Le design system reste** — il n'est pas la cause du problème, il est le moyen de
   corriger partout d'un coup. Changer `.page-title` change vingt écrans.

⚠️ **Bloqué le 2026-08-06** : l'extension Chrome refuse de se connecter (« the OAuth token
belongs to a different claude.ai account »). Sans elle, aucune capture, donc aucun jugement.
Remède : `/logout` puis `/login` dans Claude Code, en vérifiant que l'extension est signée
sur **le même compte** claude.ai.

> ✅ **Contournement retenu le 2026-08-06, et il est meilleur que l'outil** : **c'est Tristan
> qui capture et colle les images dans la conversation.** L'agent n'a alors aucun moyen de
> confondre « j'ai lu le code » avec « j'ai vu l'écran » — la confusion exacte qui a produit
> les quatre « vérifications mal ancrées » de ce dépôt. Le protocole tient en trois URL, et
> **le `?v=1` n'est pas optionnel** : le service worker sert des pages en cache, donc sans lui
> on juge un build d'il y a une heure.
>
> ```
> npm run build && npm run start
> localhost:3000/fr?v=1  ·  /fr/serie/1396?v=1  ·  /fr/moi?v=1
> ```
>
> ⚠️ **Ce que ce contournement ne donne pas** : la CSSOM, la mesure au pixel, et le mobile
> (7.1 reste ouvert). Une capture juge une **apparence**, elle ne mesure rien — ne pas écrire
> « mesuré » là où on a regardé.

### 📏 Premier inventaire **mesuré sur le rendu servi** (2026-08-07, production Vercel)

> ⚠️ **Ce sont des mesures, pas un jugement.** Elles disent *où regarder*, pas si c'est beau —
> la méthode du lot 9 (voir avant de changer) reste entière. Relevé sur
> `seasoned-two.vercel.app`, dont on a vérifié qu'elle porte bien le dernier commit
> (`.poster-grid` et `.prose-note`, ajoutées la veille par `47d50de`, sont dans la feuille servie).

| Constat | Mesure | Pourquoi c'est un candidat |
|---|---|---|
| 🔴 **Le différenciateur est le plus petit texte de l'écran** | accueil : « en attente · 7 mois » à **11 px** · fiche série : **78 éléments sous 12 px**, tous en `text-[10px] tabular-nums` (les notes de saison) | `CLAUDE.md` désigne ces chiffres comme **le caractère du produit**, et `RESEARCH.md` le temps écoulé comme **la** valeur. Ils sont écrits plus petit que tout le reste, et en dur, hors de l'échelle (9.8) |
| 🔴 **L'échelle est écrasée** | accueil : `36px×1` puis **`16px×243`**, `14×38`, `13×3`, `12×42`, `11×28` · `/moi` : `28px×1` puis **`16px×77`** | Un seul grand titre, puis un mur au même corps. Les crans intermédiaires du lot 7 existent mais ne portent presque rien |
| ⚠️ **Les rayons divergent, et ça se voit là où il y a peu de surfaces** | fiche série : **6 valeurs** (2·4·6·8·12·plein) · `/moi` : **12 px et 8 px côte à côte pour 3 surfaces** · accueil : **8 px partout** (le seul cohérent) | Confirme 9.7 / 11.1 sur le **rendu**, plus seulement par lecture du CSS |
| ✅ **Le contraste n'est PAS le problème** | texte `#e8ebf2` sur `#08090e` = **16,67:1**. Letterboxd (blanc pur sur `#14181c`) = **17,84:1** | 🔴 **Mon hypothèse était fausse et la mesure l'a retournée** : j'allais écrire « notre noir est trop dur, leur charbon est plus doux ». Letterboxd contraste **plus**. La vraie différence est la **luminance du fond** — 0,0089 contre **0,0028**, leur charbon est **3,2× plus clair** — avec un texte plus dur par-dessus. Donc la piste palette n'est pas « adoucir », c'est **remonter le fond et durcir le texte** |

⚠️ **Ce que la mesure ne remplace pas** : le panneau navigateur n'étant pas affiché, la page ne
composite aucune image — les affiches sont en `loading="lazy"` et **aucune requête ne part**.
Un jugement porté maintenant serait porté sur un site **sans affiches**, alors que la règle
fondatrice est « l'affiche est l'interface ». Vérifié aussi que ce n'est pas une question
d'origine : la capture échoue **identiquement** sur localhost et sur Vercel, et l'extension
Chrome est signée sur l'**autre** compte Claude de Tristan (`list_connected_browsers` → `[]`).

---

### 🎲 Les trois faces — l'identité devient une mécanique (idée de Tristan, 2026-08-06)

> Née de l'idée « des équipes comme Pokémon GO », **retournée** : on ne choisit pas sa face,
> on la **découvre**. Une face choisie ne dit rien de vous ; une face méritée est
> structurellement incopiable — il faut *votre* journal.
> *(Note : Pokémon GO a exactement les trois couleurs du logo — Valor rouge, Mystic bleu,
> Instinct jaune. Trois faces, pas quatre : une quatrième exigerait une couleur qui
> n'existe nulle part.)*
>
> **Rouge** finit tout, même quand ça décroche · **Bleu** coupe tôt et sans regret ·
> **Jaune** revient et revisionne. Les trois se calculent déjà : `taste.ts` fournit le taux
> d'achèvement, la saison médiane d'abandon et la série-refuge.
>
> 🔴 **Le piège, trouvé par Tristan avant l'écriture — c'est le BIAIS DE SURVIE**, celui que
> ce dépôt documente déjà pour les notes TMDB. On se souvient de ce qu'on a **fini**, pas de
> ce qu'on a lâché à S1E3 : une saisie d'historique est biaisée vers l'achèvement, et *tout
> le monde arriverait rouge*.
>
> 🔴 **Et « 10 séries nouvelles » ne le règle PAS** — deuxième objection de Tristan, décisive.
> Ce critère compte des **saisies**, pas des **parcours** : 20 séries entrées d'un bloc
> restent 20 souvenirs, qu'elles arrivent le premier jour ou trois mois après. Quelqu'un qui
> pose 3 séries petit à petit puis en déverse 20 franchirait le seuil sans qu'on ait rien
> observé de lui.
>
> 🔴 **Et l'écart `position` → `decision` ne le règle pas non plus** — troisième objection de
> Tristan, et elle tue ma solution de la veille. *Personne ne met son tracker à jour en temps
> réel.* On regarde, puis on vient déclarer. Quelqu'un qui a réellement enchaîné Arcane et
> Succession en deux semaines pose position **et** décision dans le même geste, exactement
> comme quelqu'un qui déclare un souvenir de 2019. **Dans le journal, les deux sont
> indiscernables** : cet écart mesurait la ponctualité de la saisie, pas la réalité du
> visionnage.
>
> 🔴 **Et le volume du geste reste une devinette** — quatrième objection de Tristan, tirée
> de Letterboxd, et c'est celle qui ferme la question. Là-bas, **noter** un film ne le met
> pas au journal ; **le consigner** l'y met, avec sa date. Deux gestes, deux sens, et
> *aucune heuristique* : le geste porte son intention, on ne la devine pas.
>
> ⚠️ **Cette distinction existait ici et a été supprimée le 2026-08-06 au matin.** `types.ts`
> portait `LogEntry` : « une entrée date ce qui est arrivé ; une note exprime un jugement. On
> peut avoir l'une sans l'autre. » Retiré comme code mort — il l'était — mais *le code était
> mort, la pensée non*.
>
> ✅ **La traduction ici est directe** : une **note de saison** est un jugement, elle peut
> porter sur quelque chose vu il y a dix ans. Une **décision** est un fait qui arrive. Ne
> compter que les faits consignés supprime le besoin de compter les rafales.
>
> 🔴 **Mais le vrai piège est l'import, et Tristan le nomme** : un export TV Time produit
> exactement les mêmes faits datés, en masse. **Toute règle fondée sur la nature du geste
> s'effondre si l'import fabrique le même geste.**
>
> ✅ **La réponse n'est pas une heuristique de plus, c'est une PROVENANCE sur le fait.** Ce
> qui vient de `/convertir` porte une marque, et la face l'ignore. Décidé **à l'écriture**,
> une fois pour toutes, au lieu d'être redeviné à chaque calcul — et utile au-delà de la
> face : savoir ce qu'on a importé plutôt que vécu est une information honnête en soi.
>
> ⚠️ **C'est un champ de plus dans le journal**, donc irrattrapable après coup : les faits
> déjà importés ne se distingueront jamais des faits vécus. À écrire **avant** d'ouvrir la
> face, pas après. Le format est additif depuis 8.0, donc le champ ne coûte aucune migration.

| # | Tâche | Statut | Note |
|---|---|---|---|
> ### 📱 Ce que le natif impose aux faces (audit du 2026-08-06)
>
> **Mesuré** : `src/domain/` fait **5 977 lignes et n'importe rien d'externe** — il part tel
> quel sur iOS et Android. Ce qui ne part pas : `app/`, Tailwind, le CSS. La règle 2, écrite
> pour la testabilité, est en réalité de la **portabilité** (A11).
>
> D'où le partage, qui vaut pour les cinq tâches ci-dessous :
>
> | Ce qui va dans `src/domain/face.ts` | Ce qui reste dans `app/` |
> |---|---|
> | Quelle face, à partir de quels faits | Les couleurs, le cube, l'animation |
> | Le seuil, et le **silence** sous le seuil | Le texte affiché |
> | La **bascule** : ai-je changé de face ? | Comment on la célèbre |
>
> ⚠️ **La bascule se calcule, elle ne se déclenche pas depuis l'interface.** Si c'est un
> composant qui décide « tiens, elle a changé », il faudra le réécrire en Swift et en Kotlin,
> et les trois versions divergeront. Le domaine rend « votre face **vient de** basculer » ;
> chaque plateforme décide comment le fêter.
>
> ### 🎬 L'animation de découverte
>
> **Une seule fois, à la bascule** — rejouée à chaque visite, elle devient une gêne. Elle a
> donc besoin d'un fait mémorisé : la dernière face **annoncée**. C'est un champ de journal,
> donc à poser avec 9.0 pendant que le format est gratuit.
>
> Le geste juste est déjà écrit dans `CLAUDE.md` du 2026-08-03 et jamais réalisé : *« le cube
> se déplie en patron, les faces deviennent les onglets »*. La découverte en est l'inverse
> exact — **le patron se replie et une face reste devant**. Même vocabulaire, deux sens.
>
> ⚠️ Un `@keyframes` ne traverse pas vers le natif. Ce n'est pas grave **à condition de ne
> pas y mettre de logique** : l'animation ne décide de rien, elle montre un résultat déjà
> calculé.
>
> ### Où les faces s'intègrent, du gratuit au coûteux
>
> 1. **Le logo** — déjà sur toutes les pages, donc l'intégration est faite d'un coup. Zéro
>    écran à modifier.
> 2. **`/bilan`** — presque vide (tâche 7.6, ouverte), et c'est l'écran qui dit *qui vous
>    êtes*. La face y appartient plus qu'ailleurs.
> 3. **Le fil et les critiques** — une colonne sur `profiles`, l'auteur porte sa face.
> 4. **Les jeux** ⛔ — agrégation serveur, donc coût par utilisateur. Pas avant que 1-3 aient
>    pris.

| 9.0 | **La provenance d'un fait** | ✅ **2026-08-09 — @claude-opus** | `origin?: 'import'` sur les trois faits qu'un import écrit (`position`, `wanted`, `seasonRatings`). **L'absence est la valeur normale**, donc zéro journal touché. 📏 **Le motif est mesuré, pas intuité** : `importForeign` date **chaque** fait de `now`, donc reprendre dix ans dépose deux cents séries à la date du jour — une fenêtre glissante (9.1) n'y verrait qu'un clic, un bilan annuel (8.14) dix ans en 2026. `src/` n'a **aucun** `getFullYear` : la marque arrive à temps, de justesse. **Trois décisions** : (a) la marque est sur le **fait**, pas la série — importer puis avancer laisse une position vécue et un « je veux la voir » repris ; (b) **notre propre export n'est PAS marqué**, il porte les vraies dates — les déclarer importées effacerait des années vécues ; (c) on ne **devine** pas la vraie date (règle 8). 🔴 **Le défaut le plus discret** : `parseEntry` reconstruit champ par champ et le pass-through de la décision n°4 ne protège que les champs **d'entrée** inconnus, pas ceux **nichés dans un champ connu** — sans lecture au parse, la marque était écrite puis effacée à la première sauvegarde, avec 8 tests verts. **Sept mutations vérifiées.** `asImported` marque par **parcours** et non par liste de champs (`lastTouch` en oubliait deux) : il se trompe vers l'exclusion, comme `isSeriesKey` |
| 9.1 | **`face.ts` — la face, pure** | 🟢 libre | Réutilise `taste.ts`. Ne compte que les **faits vécus** — ni les notes (un jugement peut porter sur dix ans en arrière), ni ce qui vient d'un import (9.0). ⚠️ **Fenêtre glissante** : les 10 dernières, jamais les 10 premières — sinon la face se fige, alors que **basculer *est* le produit**. ⚠️ Se **tait** sous le seuil, et le dit |
| 9.2 | **Le logo porte la face** | 🟢 libre | `Mark.tsx` existe : la face active devient vive, les deux autres reculent. La marque cesse d'être un logo et devient un miroir — et comme elle est sur **toutes** les pages, l'intégration est faite partout d'un coup, sans une ligne de plus |
| 9.3 | **L'animation de révélation** | 🟢 libre | Le moment de plaisir que le produit n'a jamais eu. Le cube tourne, la face sort. ⚠️ Une seule fois, à la bascule — rejouée à chaque visite, elle devient une gêne. `prefers-reduced-motion` la supprime |
| 9.4 | **La face des autres** | 🟢 libre | Une colonne sur `profiles`, affichée dans le fil et sur les critiques. Coût quasi nul |
| 9.5 | **Les jeux entre faces** | ⛔ pas avant que 9.1-9.4 prennent | Comparer les faces demande une **agrégation serveur**, donc un coût par utilisateur — la cause de mort de TV Time. Un compteur mis en cache, jamais un calcul par visite |
| 9.6 | **La police — le premier axe de la direction visuelle** | ✅ **2026-08-07 — @claude-opus** · **Instrument Sans** (interface) + **IBM Plex Mono** (chiffres), **43 Ko**, sous-ensemble latin, zero dependance, CSP inchangee, licences OFL dans `app/fonts/LICENSE.md`. Choix delegue par Tristan (« choisis toi-meme »), argumente : **pas Inter** — police par defaut du web moderne, donc choisir de n'avoir aucune identite alors que le diagnostic est « ca ne ressemble a rien » ; Instrument Sans est la plus proche de **Graphik**, la police de Letterboxd. **Pas JetBrains Mono** — caractere de terminal, exactement le cliche que le lot 9 dit de fuir. 🔴 **Le commentaire de `globals.css` etait faux** : « `font-src 'self'` interdit Google Fonts **donc** le caractere vient de la grille monospace » — la CSP interdit un *fournisseur tiers*, jamais une police, et `next/font/local` sert depuis `'self'`. Meme forme que « pas de Mac donc pas de natif » (A11). Et la « grille monospace » etait la pile **systeme recopiee trois fois** : le differenciateur changeait de dessin selon la machine. **Verifie sur le HTML servi** : `document.fonts` rend `instrumentSans: loaded`, largeur d'un meme texte 364,7 px contre 361,4 px en pile systeme. _Historique de la reservation :_ | Référence choisie par Tristan : **Letterboxd**. Aucune police n'est chargée aujourd'hui : le site s'affiche en **Segoe UI** chez Tristan, **San Francisco** sur Mac, **Roboto** sur Android. 🔴 **Et le différenciateur n'a pas de dessin non plus** — la « grille monospace tabulaire » que `CLAUDE.md` désigne comme *le* caractère du produit est la pile système `ui-monospace, 'SF Mono', 'Cascadia Mono', …`, **recopiée trois fois** (`globals.css:128`, `:653`, `:800`) : « 537 h », « S5E3 », « 26 mois » sont dessinés différemment sur chaque machine. ✅ **Aucune modification de la CSP** : `next/font/local` sert depuis `/_next/static/media/`, donc `'self'` (`next.config.ts:97`), et pose son `@font-face` en style inline (`:94`). **Zéro dépendance ajoutée** |
| 9.7 | **Deux formes de carte concurrentes, et `.card` affirme le contraire** | ✅ **2026-08-07 — tranché par la mesure.** `.panel` l'emporte sur deux relevés : l'accueil rend **59 éléments tous à 8 px** (donc `0.5rem` était déjà le rayon du produit), et le fond translucide de `.card` rend `#0f1119`, **plus proche du fond** que l'opaque `#11131c` — or le défaut vu est que rien ne se détache. 🔴 **Le diagnostic ci-dessous était périmé le jour même** : « 19 copies » était vrai la veille, il en restait **8** (le commit qui a extrait `.panel` les avait absorbées). 🔴 **Et fusionner `.card`/`.panel` n'aurait pas suffi** : le 12 px de `/moi` venait de **`.empty-state`**, qui portait sa propre copie de l'ancienne recette — comme `.tile`. L'écran vide serait resté seul avec la forme abandonnée. Les **quatre** partagent désormais une seule définition de forme, plus `OrderingNotice` (9ᵉ surface, écrite en `rounded-md`). ⚠️ **La tuile `ENGAGEMENT` est intacte** : elle doit son identité à `emphasis` (liseré volt, halo, chiffre en grille), **pas à sa géométrie** — vérifié sur le code puis sur le rendu. **Mesure : fiche série 6 rayons → 5, `/moi` 2 → 1.** _Diagnostic d'origine :_ | `globals.css:557` promet « un seul rayon, une seule bordure, un seul fond dans toute l'application », et c'est **faux aujourd'hui** : `.card` (rayon `0.75rem`, padding `1rem 1.25rem`) est employée **8 fois**, pendant que `rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4` — **rayon `0.5rem`, padding `1rem`** — est écrite à la main dans **19 endroits**, dont une douzaine sont bien le même objet « panneau » (`CalendarExport`, `MyTally`, `TasteCard`, `MyProgress`, `MyPlatforms`, `JournalTransfer`, `/convertir`, `/regles`…). Mot pour mot la leçon de 7.10 : *extraire une forme ne protège que les écrans qu'on rouvre le même jour*. ⚠️ **Densité, pas typographie** — délibérément hors de 9.6, sinon on ne saura pas ce que la police a apporté |
| 9.8 | **Cinq tailles de police sous le plus petit cran** | 🟢 libre — **après 9.6** | Deux valeurs (10 et 11 px) écrites de **trois** façons — `text-[10px]`, `text-[11px]`, `text-[0.6875rem]` — dans `EpisodeGrid:108`, `StarRating:67`, `SeriesCard:87`, `TrajectoryChart:78` et `:93`. Un même objet visuel (la légende minuscule) sans cran nommé : le motif exact de `.label`, écrite **dix fois** avant d'être nommée. Invisibles à `no-adhoc-typography`, qui ne regarde que les `<h*>`. ⚠️ **À trancher après la police, pas avant** : elle change les métriques, donc le bon cran ne se décide qu'en regardant |

### ▶️ Les trois features qui restent face à la cible « TvTime × Letterboxd »

| # | Tâche | Statut | Note |
|---|---|---|---|
| 8.12 | **La page de profil public `/u/[handle]`** | ✅ **2026-08-07 — @claude-opus.** `/u/<nom>` et `/fr/u/<nom>`, **toutes deux `○ Static`** (vérifié au build). 🔴 **Mon intuition « pas de route dynamique » était fausse** : `/serie/[id]` en est une, avec le motif documenté (`force-static` sans `generateStaticParams` → rendue à la première demande puis servie du cache). Donc l'URL reste propre et partageable. 🔴 **Et la décision de spoiler était au mauvais endroit** : je l'avais mise dans le composant, c'est-à-dire dans la couche de rendu — ce que la règle 7 interdit, et je citais la règle en l'enfreignant. D'où `redactReviewsAcross` **dans le domaine**, avec sa loi et son ancrage. **Mutation vérifiée** : une position unique fait tomber le test qui nomme le défaut (la saison 6 d'une série jamais commencée s'affichait parce que le lecteur en est à la saison 6 d'une **autre**). ⚠️ **Une seule phrase** pour « inconnu » et « invisible » — les distinguer ferait un **oracle** d'énumération des comptes. Le nom est un lien depuis `/amis`, sans quoi la page serait injoignable. **724 tests.** _Voie d'origine :_ | On suit un `@handle` sans pouvoir ouvrir sa page : c'est le maillon qui donne son sens au lot 8, puisque les critiques ne se lisent aujourd'hui que sur la fiche série. 🔴 **Ce qui semblait l'interdire** : le dépôt a **zéro route dynamique** et y tient (une invocation par visite, donc un coût par utilisateur — la cause de mort de TV Time). Or on ne connaît pas les handles au build. ✅ **La réponse existe déjà dans le dépôt** : `/compte/retour` est `force-static` et fait tout son travail **côté client**. Même motif ici — la coquille est prérendue et vide, le `@handle` est lu depuis `window.location`, et `SocialClient.findByHandle` + `reviewsFor` remplissent la page. Zéro invocation, zéro route serveur, et RLS décide déjà qui voit quoi. ⚠️ **Non indexable, et c'est voulu** : une page vide au build ne se référence pas — ce qui est cohérent avec Q1 (`followers` par défaut, l'indexation reste fermée). ⚠️ Démarrage à froid : *mieux vaut se taire que compter zéro* — pas de « 0 vu · 0 critique » |
| 8.13 | **Les listes personnalisées** | ✅ **2026-08-09 — @claude-opus** | `007_lists.sql` (deux tables, **appliqué à la vraie base**), `src/domain/lists.ts`, 5 méthodes sur `SocialClient`, `/listes` ×2 prérendues, les listes sur `/u/<nom>`, et « Ajouter à une liste » sur la fiche série. **Le prérequis 8.1 tombe** : il ne valait que pour un `jsonb` dans le journal — deux tables n'ont pas de taille non bornée. 🔴 Les éléments **ne refont pas** le calcul de visibilité, ils le demandent à `lists` par un `exists`. **11 scénarios RLS rejoués contre la vraie base**, écritures réellement tentées. ⚠️ Le titre d'une série n'est pas stocké (règle 1) : il vient de l'instantané du lecteur, sinon repli + lien |
| 8.14 | **Le bilan annuel** | 🟢 libre — **9.0 est son prérequis, et il est posé** | `tally.ts` et `taste.ts` ne contiennent **aucun** découpage temporel (vérifié : zéro occurrence de `getFullYear`). Or chaque fait du journal porte déjà sa date — la matière est là, il manque le filtre. C'est la feature la moins chère des trois, et la seule qui ne demande ni table, ni route, ni modération. ⚠️ **Le piège, nommé le 2026-08-09** : un fait importé porte la date de **l'import**, pas celle du visionnage. Sans le filtre de provenance livré en 9.0, « votre 2026 » afficherait dix ans de TV Time repris le matin même. Le filtre à écrire est donc `origin === undefined` **et** l'année, jamais l'année seule |

### 🔎 Audit de solidité (2026-08-06) — ce que la mesure a dit

> Demandé par Tristan : « peur d'un château de cartes ». **Verdict : la base est saine.**
> Ce qui suit est mesuré, pas ressenti.

| Ce qui a été mesuré | Résultat |
|---|---|
| Dépendances de production | **4** : `next`, `react`, `react-dom`, `@supabase/auth-js`. Surface d'attaque et de rupture minuscule |
| Règle 2 — le domaine n'importe rien d'externe | ✅ vérifié fichier par fichier : `src/domain/` n'importe que ses propres voisins |
| Règle — aucun journal côté serveur | ✅ les 5 fichiers qui y touchent portent tous `'use client'` |
| Code réellement mort | **5** symboles, supprimés (`8a0f0c5`). Dont 4 interfaces de `types.ts` qui décrivaient un modèle concurrent de celui du code |
| Exports sans importeur | **19**, rendus privés |
| Clés de dictionnaire mortes | **3 sur 461** — le dictionnaire est sain |
| Volume | 18 000 lignes hors tests, 9 000 de tests. Plus gros fichiers : `journal.ts` (1554), `i18n.ts` (1412), `catalog.ts` (770) |

| # | Ce qui reste, et qui est un vrai sujet | Statut | Note |
|---|---|---|---|
| 8.10 | 🔴 **Les DEUX dictionnaires sont livrés à chaque visiteur** | 🟢 libre | **Mesuré** : le chunk client de 18 Ko gzip contient `'Tenue de bout en bout'` **et** `'Holds up throughout'`. Un anglophone télécharge donc tout le français, et réciproquement. ⚠️ **Le problème n'est pas les ~9 Ko d'aujourd'hui, c'est la pente** : A9 vise l'international, et à cinq langues ce chunk ferait ~45 Ko dont 36 inutiles à chacun. **La contrainte à ne pas casser** : `MessageKey = keyof typeof FR` rend une clé anglaise manquante **fatale à la compilation** — un découpage par langue doit garder cette garantie, sinon on échange 9 Ko contre des textes manquants en production |
| 8.11 | Le garde-fou contre le code mort | 🟢 libre | Les 5 morts et 19 exports inutiles se sont accumulés sans que rien ne le signale, et le dépôt en est à sa **sixième** occurrence (`ordering.ts`, `episodeMinutes`, `unfollow`, `setVisibility`, et deux que j'ai créées moi-même dans le commit précédent). ⚠️ **Écrire l'outil avant de l'automatiser** : mes deux premiers scans ont rendu **72** puis **210** faux positifs — un test bâti dessus aurait été bruyant, donc désactivé. Le scan corrigé vit dans le scratchpad ; le stabiliser d'abord, l'ancrer ensuite |

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
| 1.16 | Maillage interne entre pages série | ✅ 2026-08-02 | **Vérifié le 2026-08-04** : `alsoByCreators` dans `lib/catalog.ts`, appelée par la page série — *Breaking Bad* renvoie vers *Better Call Saul*. | Une page série ne renvoie vers aucune autre : cul-de-sac pour le crawl comme pour le visiteur |
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

| 2b | **Auth + journaux + synchronisation** | 🟡 **partiel — repris au lot 6** (2026-08-03) | Supabase. **Ce qui a été livré** : `src/journal/remote.ts` (transport PostgREST en `fetch` brut), `src/journal/sync.ts` (décisions pures), `supabase/001_journal.sql`, `scripts/check-supabase.mjs`, testés. **Ce qui manquait et que la ligne ne disait pas** : l'authentification, **zéro ligne** — aucune dépendance Supabase dans `package.json`, aucun `signIn` ni `getSession` dans le dépôt, et `useJournal` n'utilise que le store local. ⚠️ **Le verrou est resté `in-progress` pendant deux lots** : la tâche a été réservée, à moitié livrée, puis l'agent est passé à autre chose sans refermer — D14 dans sa forme la plus coûteuse, puisque la ligne annonçait une synchro qui n'existait pas. La suite est **6.2** et **6.3** |
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
| 1.61 | Harnais de test de composants (`jsdom`, `include` en `.tsx`) | ✅ 2026-08-03 | Prérequis de 1.59. `vitest.config.ts` fixe `environment: 'node'` et `include: '**/*.test.ts'` : **aucun test de composant n'est possible aujourd'hui**, pour 15 modules `'use client'`. |
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
| 2.1 | Authentification (Supabase) | ✅ 2026-08-03 — lot 6.2 |
| 2.2 | **Schéma de base** — les 5 contraintes de `RATING-MODEL.md` §7 | ⛔ **caduc** — le journal est local-first et vit dans un `jsonb` (`001_journal.sql`) ; les contraintes relationnelles de §7 décrivent une base que ce produit n'a plus |
| 2.3 | « J'en suis là » — la position en un geste | ✅ 2026-08-02 — `EpisodeGrid` |
| 2.4 | Note de saison — un tap, pas un formulaire | ✅ 2026-08-02 — `StarRating` |
| 2.5 | Décision : continuer / pause / abandon | ✅ 2026-08-02 — `MyProgress` |
| 2.6 | File d'attente + reprise après interruption | ✅ 2026-08-02 — `ResumeStrip` |

---

## Phase 3 — Agrégats et migration

**Canal : migration.** Ce qui rend les pages non reproductibles par scraping.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 3.1 | Trajectoire agrégée, point d'arrêt communautaire, carte des abandons | 🟡 partiel — 2026-08-02 | `computeTrajectory` existe ; reste l'agrégation multi-utilisateurs |
| 3.2 | **Filtrage spoiler câblé dans chaque requête** | ✅ 2026-08-02 — `TrajectorySection` | ⚠️ critique ici — `redactTrajectory` existe. Tester les fuites **par agrégat** |
| 3.3 | Import TV Time / Trakt / Simkl | 🟡 partiel — 2026-08-03 (`/convertir`, `src/domain/import.ts`) | Levier de **rétention**, plus d'acquisition — audit §1.1 |
| 3.4 | **Export intégral** | ✅ 2026-08-02 — `JournalTransfer` | Non négociable dès qu'il y a une donnée |

---

## Phase 4 — Textes, profil, partage

**Canal : viralité.** Les textes arrivent en dernier — ils ne s'amorcent pas.

| # | Tâche | Statut |
|---|---|---|
| 4.1 | Critiques de saison | 🟢 libre |
| 4.2 | Épisodes marquants | 🟢 libre |
| 4.3 | Verdict de série rédigé + point d'arrêt | 🟢 libre |
| 4.4 | Profil : la forme d'un goût | ✅ 2026-08-02 — `taste.ts` + `TasteCard` |
| 4.5 | Trajectoire exportable en image | ✅ 2026-08-02 — `ShareCard` |

---

## Phase 5 — Social, sous condition

| # | Tâche | Statut | Note |
|---|---|---|---|
| 5.0a | **La politique publiée : ce qu'on retire, sous quel délai** | ✅ 2026-08-03 | **`/regles`** + `/fr/regles`, au sitemap et **en pied de page partout** — une voie de signalement introuvable n'en est pas une. `src/domain/moderation.ts` tient en **60 lignes** : la liste fermée des motifs (dont `spoiler`, propre à ce produit) et le délai de 72 h. **La page ne peut pas mentir** — les motifs viennent du domaine, et *ajouter un motif sans le publier ne compile plus*. Les promesses de procédure (on masque sans supprimer, l'auteur est informé, il peut contester) vivent dans le **texte** de `/regles`, où elles engagent. ⚠️ **Première version taillée le jour même sur remarque de Tristan** : j'avais écrit 281 lignes de moteur — file d'attente, tri par urgence, exposé des motifs, rétablissement — **pour un système sans aucun contenu à modérer**. C'est l'erreur que j'avais moi-même refusée pour la table `reports`, appliquée au SQL et pas au domaine. ⚖️ Textes à faire relire |
| 5.0b | **Le canal de signalement** | ✅ 2026-08-04 — voir 6.5 | Dépend de 5.0a. **Pas de table `reports` pour l'instant** — la même raison que `001_journal.sql` refuse les tables sociales « pendant qu'on y est » : une table qu'on peut remplir avant de savoir traiter un signalement est un piège. Le point de contact publié suffit tant qu'il n'existe aucun contenu de tiers ; le formulaire viendra **avec** le contenu |
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
| **D19** | ✅ **FERMÉE le 2026-08-07 — vérifiée sur le site servi** | `seasoned-two.vercel.app/fr/mentions` affiche « ÉDITEUR — Tristan de Forges » et « CONTACT — volteface.app@gmail.com » ; `/fr/amis` s'ouvre. La page ne peut afficher l'éditeur que si `legalIsComplete()` est vrai, donc **les deux variables sont posées chez Vercel et l'adresse passe le contrôle de forme**. ⚠️ Ne plus demander à Tristan de les poser : il l'avait dit, et la vérification tenait en une requête sur une page publique. _Historique :_ constaté en production le 2026-08-03 : `LEGAL_CONTACT_EMAIL` valait `voltface@gmail.co;` — point-virgule parasite, et `.co` au lieu de `.com`. **L'adresse de contact DSA publiée ne reçoit donc rien**, et la page a l'air complète : pire que l'avertissement qu'elle remplaçait. (1) Corriger la variable chez Vercel + redéployer. (2) **`lib/legal.ts` ne valide pas la forme** — il ne fait que `trim()`. Un contrôle minimal ferait retomber `/regles` et `/mentions` sur leur avertissement au lieu de publier une adresse morte : c'est la règle 8 appliquée au seul champ légal qui y échappait. |
| **D15** | ⛔ **Trakt est fermé comme source de position** | Un compte gratuit ne connecte qu'**une seule** application externe ; VIP à **60 $/an** (+100 %) ; usage commercial de l'API **soumis à approbation**. Ne pas rouvrir sans fait nouveau — motif et sources dans `docs/CONVERGENCE-RAPPORTS.md` §3.3. |
| **D16** | ⛔ **L'achat intégré Apple ponctionne A6** | Le natif (A11) impose l'IAP pour tout bien numérique : **15 à 30 %** de commission sur les cosmétiques (15 % sous 1 M$/an, Small Business Program). A6 a été tranché **le matin même, sans Apple dans l'équation** — le modèle doit être rechiffré. ⚠️ Barème **à confirmer** sur les pages Apple, non vérifié. **Bloque 4.8.** |
| **D17** | ⚠️ **Le natif rend le push obligatoire** | Un webview nu se fait refuser (App Store règle 4.2, « minimum functionality ») : le natif **oblige** à apporter du natif — notifications, hors-ligne, partage. Or le push exige un planificateur serveur qui sache quand diffuse chaque série suivie par chaque personne, c'est-à-dire **le coût marginal par utilisateur** que tout le reste du plan s'emploie à éviter. La chaîne se referme : à budgéter, pas à découvrir. |
| **D18** | ⚠️ **`TMDB_ACCESS_TOKEN` est vide dans `.env`** | Constaté le 2026-08-03 : aucune vérification contre l'API réelle n'est possible en local. `episode_groups` (4.4) n'a donc été vérifié qu'**en documentation**, jamais contre une réponse. Or D10 dit qu'une fixture écrite de mémoire décrit l'API dont on se souvient : le jeton est le **prérequis** de 4.4, pas un confort. |
| **D12** | **Le facteur d'anomalie ×2 est arbitraire** | `CADENCE_ANOMALY_FACTOR` vaut 2 — « deux cycles manqués ». Observé le 2026-08-01 : *Die Ratgeber*, silencieuse depuis 20 mois avec un rythme annuel, repasse en « entre deux saisons » (609 j < seuil 730 j). Défendable, mais probablement **trop permissif** : une série annuelle qui manque son créneau de six mois est déjà un signal. ×1,5 donnerait 18 mois. **Non tranché faute de données** — il faudrait mesurer la distribution réelle des intervalles sur un échantillon large, pas régler au jugé. |

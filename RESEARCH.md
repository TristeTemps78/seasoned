# RESEARCH.md — état du terrain avant de coder

> Recherche préliminaire, 2026-07-31. Toutes les affirmations sourcées sont datées.
> Ce qui n'a pas de source est marqué `[non vérifié]` — c'est une hypothèse, pas un fait.
> Document destiné à être **contredit** : voir `docs/ROADMAP-AUDIT.md`.

---

## 0. Résumé pour qui n'a que deux minutes

Cinq faits qui déterminent tout le reste :

1. **TV Time est mort le 15 juillet 2026**, seize jours avant la rédaction de ce document,
   avec **26,4 millions d'installations**. Motif officiel : *pas soutenable en gratuit, pas
   assez de demande pour du payant.* C'est simultanément la meilleure et la pire nouvelle
   possible pour ce projet.
2. **Letterboxd promet les séries depuis septembre 2023** et n'a toujours pas livré. La
   fenêtre est ouverte, mais on ne sait pas pour combien de temps, et on ne construit pas un
   produit dont la thèse est « ils sont lents ».
3. **Serializd occupe déjà la place** (« Letterboxd pour la TV »), 4,5/5 sur l'App Store, et
   il est **techniquement en train de craquer** : serveurs lents, logs qui disparaissent,
   recherche cassée. Sa faiblesse est opérationnelle, pas conceptuelle.
4. **La friction de saisie manuelle est la cause n°1 d'abandon** des trackers de séries.
   Toute fonctionnalité qui ajoute des taps par épisode est un passif, pas un actif.
5. **Aucun acteur n'a résolu la question de la granularité de notation.** C'est le seul
   endroit où il reste quelque chose d'original à faire, et c'est précisément la question
   posée au départ.

---

## 1. Le paysage concurrentiel réel (juillet 2026)

### 1.1 Ce qui vient de se passer

| Date | Événement |
|---|---|
| 2023-09-29 | Tiny acquiert la majorité de Letterboxd ; intention annoncée d'ajouter les séries |
| 2024 (début) | Letterboxd : les logs de séries arriveront « plus tard cette année » — non tenu |
| 2025 (début) | Blue Torch Capital rachète Whip Media (maison mère de TV Time) |
| 2025-11-20 | Letterboxd lance la location de films — la roadmap est ailleurs que sur la TV |
| 2026-07-02 | Annonce de la fermeture de TV Time ; Whip Media pivote vers l'IA B2B (« Helix ») |
| 2026-07-09 | JustWatch lance un outil de migration ; TVmaze, Hobi, Moviebase suivent |
| **2026-07-15** | **TV Time ferme. ~26 M d'utilisateurs sans domicile.** |
| 2026-07 | Letterboxd reconfirme publiquement travailler sur les séries |

Sources : [TechCrunch](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/),
[9to5Mac](https://9to5mac.com/2026/07/09/as-tv-time-prepares-to-shut-down-justwatch-launches-migration-tool/),
[TechTimes](https://www.techtimes.com/articles/319583/20260703/tv-time-closes-july-15-26-million-users-face-permanent-watch-history-deletion.htm),
[ResetEra / Film Updates](https://www.resetera.com/threads/following-the-tv-time-shutdown-letterboxd-confirms-they-are-still-working-on-adding-tv-shows-to-their-platform.1567171/),
[Businesswire (acquisition Tiny)](https://www.businesswire.com/news/home/20230929276535/en/Tiny-Announces-Majority-Acquisition-of-Letterboxd).

### 1.2 La carte des acteurs

| Produit | Positionnement | Granularité de note | Force | Faille exploitable |
|---|---|---|---|---|
| **Serializd** | « Letterboxd pour la TV » | épisode + saison + série (les trois) | Communauté critique, listes, ton éditorial | **Fiabilité** : serveurs lents, logs perdus, recherche cassée ; pas de notifications push |
| **Trakt** | Infrastructure de tracking | tous niveaux, 1–10 | Scrobbling Plex/Kodi/Jellyfin, **écosystème d'API le plus large** | Outil d'ingénieur, aucune âme éditoriale ; VIP ~60 $/an |
| **Simkl** | Auto-tracking navigateur | tous niveaux | Extension qui détecte la lecture sur les sites de streaming ; anime en première classe | Identité floue, UI datée |
| **TVmaze** | Base de données + tracking | limitée | Données de diffusion excellentes, API ouverte | Ce n'est pas un réseau social |
| **JustWatch** | Guide de disponibilité | quasi nulle | Distribution énorme, argent de l'affiliation | Le tracking est un produit d'appel, pas le produit |
| **Moviebase / Hobi / Showly / SeriesGuide** | Trackers mobiles | variable | Bien faits, mobiles natifs | Mono-plateforme, pas de couche sociale sérieuse |
| **Letterboxd** | Le modèle | 0,5–5 étoiles, demi-étoiles, **au film** | Marque, communauté, culture | **Ne fait pas les séries** — pour l'instant |
| **IMDb** | Référence | série + épisode, **pas la saison** | Ubiquité | Incohérences documentées (voir §3.2) |
| **AniList / MAL** | Anime | MAL : moyenne globale ; AniList : jusqu'à 6 sous-scores pondérés | Communautés très engagées | Périmètre anime uniquement |

Sources : [Achriom Serializd vs TV Time](https://www.achriom.com/blog/serializd-vs-tv-time/),
[Achriom Simkl vs Trakt](https://www.achriom.com/blog/simkl-vs-trakt/),
[Serializd FAQ](https://www.serializd.com/about),
[Achriom AniList vs MAL](https://www.achriom.com/blog/anilist-vs-myanimelist/),
[AlternativeTo](https://alternativeto.net/news/2026/7/tv-time-is-shutting-down-on-july-15-2026-here-are-some-great-replacements/).

### 1.3 Ce que disent les utilisateurs de Serializd (App Store / Play Store)

Le point important n'est pas qu'ils se plaignent — c'est **de quoi** ils se plaignent :

- « les serveurs sont trop lents » — ajouter une série et écrire une critique prend du temps
- « des bugs partout dès qu'il s'agit de créer, mettre à jour ou afficher des logs »
- des logs qui **disparaissent** de l'activité ou n'apparaissent jamais
- la recherche : la première marche, les suivantes non — il faut redémarrer l'app
- absence de notifications push pour les nouveaux épisodes

Aucune de ces plaintes ne porte sur le **concept**. Elles portent toutes sur
l'**exécution**. C'est une information stratégique de premier ordre : le concept
« Letterboxd pour les séries » est validé par le marché, l'exécution ne l'est pas.

Sources : [App Store Serializd](https://apps.apple.com/us/app/serializd/id1581244120?see-all=reviews&platform=iphone),
[Play Store](https://play.google.com/store/apps/details?id=com.serializdmobile&hl=en).

---

## 2. Reverse engineering de Letterboxd

### 2.1 Les trois couches d'accès

**a) L'API officielle** — `https://api.letterboxd.com/api/v0`

- Accès **sur demande uniquement**, par email à `api@letterboxd.com`. Il n'y a pas de
  self-service.
- OAuth2 : *Client Credentials* pour la donnée publique, *Authorization Code* pour agir au
  nom d'un membre.
- Identifiants internes : les **LID** (Letterboxd IDentifiers), exposés en en-tête
  `x-letterboxd-identifier` et dans les URL courtes `boxd.it`.
- La pagination par curseur est **plafonnée à 100 000 objets** — plafond explicitement
  décrit comme une mesure anti-copie du catalogue.
- Certains endpoints sont marqués **« First Party »** : réservés aux applications de
  Letterboxd, pour raisons de licence sur les données.

**b) Les clients non officiels** — utiles pour lire la forme du modèle sans avoir l'accès.
Le plus complet est [`erunion/letterboxd-client`](https://github.com/erunion/letterboxd-client)
(TypeScript). Il expose les espaces de noms suivants — c'est **la carte du modèle de
données de Letterboxd**, et elle mérite d'être lue attentivement :

```
auth          requestAuthToken, revokeAuth, getLoginToken, usernameCheck,
              forgottenPasswordRequest
films         all, get, statistics, genres, countries, languages, services,
              getMembers, getMemberFriends, getMemberRelationship, report
logEntries    all, get, create, update, delete, statistics,
              getRelationship, updateRelationship, getComments, createComment, report
lists         all, get, create, update, delete, statistics, topics,
              getEntries, getComments, createComment,
              getRelationship, updateRelationship, updateLists, report
members       all, get, statistics, register, pronouns, watchlist,
              getMemberActivity, getMemberLogEntryTags, getMemberListTags,
              getMemberRelationship, updateMemberRelationship, report
me            get, update, deactivate, validationRequest,
              registerPushNotifications, deregisterPushNotifications
contributors  getContributor, getContributions
filmCollections get
comments      update, report
search        (recherche transverse au catalogue)
stories, news (contenu éditorial)
```

**c) Le scraping des flux RSS publics** — c'est la voie qu'empruntent la majorité des outils
tiers ([`zeromero-dev/letterboxd-api`](https://github.com/zeromero-dev/letterboxd-api),
[`zactopus/letterboxd`](https://github.com/zactopus/letterboxd)). Limite structurelle : le
flux ne renvoie que les **20 entrées de journal les plus récentes**.

**d) La signature de l'APK** — [`lumaaaaaa/letterboxdAPI`](https://github.com/lumaaaaaa/letterboxdAPI)
extrait la clé et le secret API codés en dur dans l'application Android pour signer des
requêtes `/api/v0/`. Projet expérimental (3 commits, 0 étoile) et **juridiquement hostile** :
usurper les identifiants du client officiel n'est pas la même chose que lire une doc
publique. **On ne s'en sert pas.** Il est cité ici parce qu'il existe et qu'il fallait le
vérifier, pas parce qu'il est utilisable.

### 2.2 Ce que le modèle de données nous apprend vraiment

Le point qu'il faut retenir de cette liste d'endpoints n'est pas technique, il est
conceptuel. **L'objet central de Letterboxd n'est pas le film : c'est le `LogEntry`.**

Un `LogEntry` porte : une date de visionnage, une note en étoiles, un texte optionnel, des
tags, un booléen « like », un booléen « rewatch ». Une critique n'est pas une entité
séparée — c'est un `LogEntry` qui a du texte. Le journal (« diary ») et les critiques sont
**la même table**.

C'est un choix de conception d'une élégance rare, et c'est ce qui rend Letterboxd
copiable dans son principe et difficile à copier dans son effet. Il repose sur une
coïncidence que le cinéma offre gratuitement et que la télévision détruit — voir §3.

### 2.3 Ce qui fait le succès de Letterboxd (et qui n'est pas technique)

Synthèse des études UX publiées ([Blake Crosley](https://blakecrosley.com/guides/design/letterboxd),
[Design Interactive](https://davisdesigninteractive.medium.com/letterboxd-a-ux-case-study-e0034805d48b),
[The Spinoff](https://thespinoff.co.nz/pop-culture/24-04-2025/how-letterboxds-four-favourites-took-over-the-internet)) :

1. **Le mot « journal » plutôt que « critique ».** Le cadrage psychologique déplace
   l'utilisateur de « je performe pour un public » à « je note pour moi ». C'est ce qui
   produit l'authenticité du corpus. Un renommage, pas une fonctionnalité.
2. **L'affiche est l'interface.** Les affiches ne décorent pas, elles *sont* la navigation.
3. **Pas de fil algorithmique, pas de compteur d'abonnés affiché en trophée, pas de
   downvote.** Les hostilités sociales classiques sont retirées par construction.
4. **Le « Top 4 ».** Quatre affiches en haut du profil. Contrainte brutale → objet
   identitaire → mème → distribution gratuite. La viralité vient d'une **contrainte**, pas
   d'une fonctionnalité de partage.
5. **Le bilan annuel.** Rétrospective partageable, saisonnalité de l'attention.
6. **Une promesse en trois phrases à l'inscription** : *Track films you've watched. Save
   those you want to see. Tell your friends what's good.*

> **À retenir pour la conception** : les points 1, 3, 4 et 6 ne coûtent presque rien à
> implémenter et représentent l'essentiel de la valeur perçue. Les copier est légitime.
> Ce qui ne se copie pas, c'est le corpus accumulé depuis 2011.

---

## 3. Le problème de fond : une série n'est pas un film long

C'est ici que se joue le produit. Le reste est de l'exécution.

### 3.1 Pourquoi Letterboxd fonctionne — et pourquoi ça ne se transpose pas

Letterboxd repose sur un **isomorphisme à trois termes** que le cinéma fournit gratuitement :

```
   L'ŒUVRE        =        L'ÉVÉNEMENT        =        L'UNITÉ DE JUGEMENT
   un film              une séance, ~2 h,              « j'ai aimé ce film »
                        en une fois, datée
```

Ces trois choses **coïncident**. C'est pour ça qu'un `LogEntry` unique peut porter à la fois
une date, une note et un texte sans jamais être ambigu. Toute l'élégance du modèle vient de
là.

Pour une série, les trois termes **divergent violemment** :

```
   L'ŒUVRE                L'ÉVÉNEMENT                UNITÉ DE JUGEMENT
   la série ?             un épisode ?               on juge la saison
   la saison ?            une soirée de 4 ?          (« la 4 est nulle »)
   l'épisode ?            un binge de 3 jours ?      mais on se souvient
   l'arc narratif ?       une diffusion hebdo        de 3 épisodes précis
   « l'ère showrunner » ? étalée sur 3 mois ?        sur 60
```

**Aucune des trois colonnes ne s'aligne sur les autres.** C'est le problème entier, et c'est
la raison pour laquelle personne ne l'a résolu proprement. Ce n'est pas un manque d'effort
de la part de Serializd ou d'IMDb : c'est un problème structurel.

### 3.2 Comment les autres s'en sortent, et pourquoi ça rate

**IMDb** — note la série et l'épisode, **pas la saison**. Résultat : des incohérences
publiques et embarrassantes. *Call Me Kat* affiche 4,7 en note globale alors que **tous** ses
épisodes sont notés 5,1 ou plus, moyenne 6,7. La note de série et la note d'épisode mesurent
deux choses différentes (l'une capte le ressentiment envers la série comme objet social,
l'autre l'appréciation du contenu) et l'absence de niveau intermédiaire rend l'écart
illisible. Les demandes de notes par saison sur leurs forums datent de 2020 au moins.
Source : [IMDb Community](https://community-imdb.sprinklr.com/conversations/data-issues-policy-discussions/a-tv-shows-overall-rating-vs-its-average-episode-rating/605e1975f015536843e1bcdf).

**Serializd** — propose les **trois** niveaux (épisode, saison, série). C'est honnête, et
c'est le choix le plus défendable aujourd'hui. Mais offrir trois niveaux sans hiérarchie
transfère le problème à l'utilisateur : *lequel est la vérité ?* Charge cognitive à chaque
log, redondance, et une base de données où l'on ne sait pas quoi agréger pour classer les
séries.

**MyAnimeList** — moyenne toutes les saisons ensemble. Simple, et faux dès que la qualité
varie.

**AniList** — jusqu'à six sous-scores pondérés (histoire, art, son, personnages, plaisir).
Riche, mais réservé à une population de niche prête à remplir un formulaire. Ne passe pas à
l'échelle d'un public grand public.

**TV Time** — a renoncé aux notes fines au profit de « réactions » courtes. Friction
minimale, mais aucune donnée exploitable, aucune critique, aucun corpus. Ils sont morts —
pas à cause de ça, mais ça ne les a pas sauvés.

### 3.3 Le fait empirique qui manque à tout le monde

Une analyse des notes IMDb sur l'ensemble des séries montre un **point de bascule typique
vers la saison 5 ou 6**, après lequel les notes déclinent continûment jusqu'à l'annulation.
Source : [Narain Jashanmal](https://narain.io/writing/quality-decline-in-serialized-tv-shows-a-data-driven-analysis).

Autrement dit : **la qualité d'une série est une fonction du temps, pas une constante.** Un
scalaire ne peut pas la représenter. Tous les produits existants tentent pourtant de la
réduire à un scalaire.

C'est, à mon sens, l'ouverture principale du projet. Elle est développée dans
`docs/RATING-MODEL.md`.

### 3.4 Le second problème : la série n'est jamais finie

Un film est terminé au moment où on le regarde. Une série « returning » ne l'est pas. Cela
casse deux choses :

- **La note.** Noter une œuvre inachevée est une opération sans signification claire — et
  les forums en témoignent (« les critiques de saisons non terminées sont absurdes »).
- **Le statut.** Les trackers affichent « running », ce qui ne distingue pas *« diffusion en
  cours »* de *« en pause entre deux saisons »* de *« probablement mort mais pas encore
  annulé »*. L'utilisateur ne sait pas s'il attend ou s'il abandonne.

Aucun produit ne modélise correctement ce cycle de vie. Il est pourtant entièrement dérivable
des données de diffusion de TMDB/TVmaze.

> **Correction du 2026-08-01, après vérification en conditions réelles.** L'affirmation
> ci-dessus (« les trackers affichent *running* pour des séries mortes depuis trois ans »)
> était en partie fausse pour TMDB : sur **douze séries populaires testées, aucune** n'était
> déclarée `Returning Series` à tort. TMDB classe correctement — terminée, annulée, entre
> deux saisons, en diffusion.
>
> L'échantillon est biaisé vers les séries populaires, que la communauté TMDB tient à jour ;
> les zombies existent probablement dans la longue traîne. **Mais le trafic vient des séries
> populaires**, donc un différenciateur qui ne se manifeste que sur les œuvres que personne
> ne cherche ne vaut pas grand-chose.
>
> **Ce qui reste vrai, et qui est la vraie valeur** : personne n'affiche le **temps écoulé
> chiffré**. « Saison terminée il y a onze mois, la suite est attendue » répond exactement à
> la question que se pose le spectateur — j'attends ou j'abandonne ? — et vaut pour **toutes**
> les séries entre deux saisons, pas seulement pour le cas extrême du zombie.
> Détail et mesures : `TASKS.md`, section « chasse au zombie ».

---

## 4. Les données : d'où vient le catalogue

C'est la contrainte dure du projet. On ne construit pas une base de séries à la main.

### 4.1 Comparatif des fournisseurs

| Fournisseur | Couverture séries | Coût | Contrainte majeure |
|---|---|---|---|
| **TMDB** | Excellente, ~150 endpoints, saisons + épisodes, `append_to_response` | Gratuit **non commercial** | **Cache max 6 mois** ; usage commercial = accord écrit ; interdit de faire des dérivés ; attribution + logo obligatoires |
| **TheTVDB** | Excellente, très bonne sur les dates de diffusion | **Gratuit sous 50 k$/an de CA**, puis 1 000 $/an (50–250 k), 10 000 $/an (250 k–1 M) | Barème public et prévisible — un vrai avantage |
| **TVmaze** | Très bonne sur les grilles de diffusion | API publique gratuite | Moins riche sur les métadonnées éditoriales |
| **Trakt** | Bonne, + historique social | Gratuit avec clé | On dépend d'un concurrent ; VIP payant côté utilisateur |

Sources : [TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use),
[TMDB append_to_response](https://developer.themoviedb.org/docs/append-to-response),
[TheTVDB API information](https://www.thetvdb.com/api-information),
[Trakt docs](https://docs.trakt.tv/docs/getting-started).

### 4.2 Les trois pièges à connaître avant d'écrire une ligne

1. **Le cache TMDB de 6 mois est un piège d'architecture, pas un détail juridique.** Si le
   catalogue est une copie locale de TMDB, il faut soit le rafraîchir en permanence, soit
   être en infraction. La conception correcte : **notre base ne stocke que des identifiants
   et les données que nous produisons** (notes, journaux, critiques) ; les métadonnées sont
   récupérées et mises en cache avec expiration. Cela doit être vrai dès le premier commit,
   parce que c'est irréparable ensuite.
2. **`append_to_response` plafonne à 20 éléments, et il n'existe aucun moyen d'obtenir tous
   les épisodes d'une série en un appel** avec leurs détails complets. Une série de 200
   épisodes = beaucoup d'appels. Cela conditionne toute la stratégie d'hydratation.
3. **La notion de « saison » n'est pas fiable dans les données.** Saison 0 = les spéciaux ;
   les découpages de saison divergent entre TMDB, TVDB et les diffuseurs (cas notoires :
   les anime, les séries britanniques, les séries diffusées en deux parties comme *Better
   Call Saul* ou *Stranger Things*). Si la saison devient l'unité centrale du produit, cette
   instabilité devient un problème de **produit**, pas d'intégration. Voir l'audit.

---

## 5. L'économie, qui est le vrai sujet

C'est la partie que la plupart des projets de ce type refusent de regarder. Elle est ici
placée avant la roadmap volontairement.

### 5.1 Le fait brutal

**TV Time : 26,4 millions d'installations. Mort. Motif : « pas soutenable en gratuit, pas
assez de demande pour du payant ».**

Ce n'est pas un échec de produit. C'est le constat, par l'acteur le mieux placé du marché,
que **la valeur par utilisateur d'un tracker de séries est trop basse pour payer son
infrastructure**. Avec 26 millions d'utilisateurs.

### 5.2 Et pourtant Letterboxd vit

Letterboxd : Pro à 19 $/an, Patron à ~50 $/an, plus de la publicité au niveau gratuit ; CA
estimé autour de 5,5 M$/an `[estimation tierce, non confirmée par l'entreprise]`.
Sources : [Letterboxd Pro](https://letterboxd.com/about/pro/),
[PricingSaaS](https://newsletter.pricingsaas.com/p/letterboxd-and-niche-social-monetization).

Différence structurelle entre les deux :

| | TV Time | Letterboxd |
|---|---|---|
| Nature | **Utilitaire** (« où j'en suis ») | **Identité** (« qui je suis ») |
| Ce qu'on paie | Une commodité — donc rien | Une appartenance et une vitrine |
| Coût marginal / utilisateur | Élevé (notifications, sync, catalogue, mobile ×2) | Plus faible (web-first, texte) |
| Défendabilité | Nulle — remplaçable en un après-midi | Le corpus et la culture |

**La leçon n'est pas « le marché est mort ».** C'est : *un tracker meurt, une identité
survit.* Un produit qui se positionne comme utilitaire de suivi d'épisodes est déjà mort en
2026. Le seul positionnement viable est celui du **goût** — ce que la personne aime, ce
qu'elle en dit, ce que ça dit d'elle.

### 5.3 Conséquence de conception, non négociable

Le coût marginal par utilisateur doit être **proche de zéro** et le rester même en cas de
succès inattendu. Concrètement, cela interdit dès maintenant :

- un pré-chargement massif du catalogue TMDB « au cas où » ;
- des notifications push pour tout le monde sur chaque épisode diffusé ;
- des jobs planifiés qui balaient toutes les séries de tous les utilisateurs ;
- des images servies depuis notre infrastructure alors que TMDB les sert déjà par CDN.

Et cela suggère fortement une architecture où **la lecture est statique ou mise en cache au
bord**, et où seule l'écriture (peu fréquente par nature : quelques logs par semaine et par
personne) touche une base de données.

---

## 6. Le risque Letterboxd, regardé en face

Letterboxd va sortir les séries. Peut-être dans six mois, peut-être dans trois ans — ils
l'annoncent depuis 2023 et ont livré autre chose entre-temps (la location de films en
décembre 2025).

**Il faut construire en supposant que ça arrive, pas en pariant que ça n'arrive pas.**

Ce qu'ils feront, presque certainement : appliquer leur modèle existant. Le `LogEntry` est
leur socle et ils ne le réécriront pas. Ils vont donc traiter **la saison comme un film** —
c'est la transposition minimale qui préserve leur architecture, leur code, leur culture et
leur promesse de « ne pas perturber l'expérience actuelle ». `[prédiction, non vérifiée]`

Ce qu'ils ne feront probablement pas, parce que ça n'a aucun sens pour du cinéma et que leur
modèle n'y est pas préparé :

- la **trajectoire** d'une œuvre dans le temps (la courbe de qualité) ;
- le suivi d'une œuvre **en cours**, avec reprise après interruption ;
- l'**abandon** comme donnée de première classe ;
- la question « **est-ce que ça vaut mes 40 heures ?** », qui n'existe pas au cinéma.

**Ce sont les quatre seuls endroits où un projet indépendant peut construire quelque chose
qui survit à l'arrivée de Letterboxd sur les séries.** Tout ce qui est en dehors de cette
liste sera commodité dans 18 mois.

---

## 7. Ce qu'il faut retenir pour la conception

1. Le concept est validé par le marché ; c'est **l'exécution** qui est disponible.
2. L'objet central doit être **un événement de visionnage**, comme le `LogEntry` de
   Letterboxd — mais il faut trancher **sur quoi il porte**. C'est la décision n°1.
3. La friction manuelle tue. Chaque tap par épisode est un passif.
4. Le produit ne doit pas produire un **nombre** mais une **forme** — la trajectoire.
5. L'économie impose un coût marginal quasi nul. Ça détermine la stack, dès le début.
6. Le catalogue est loué, pas possédé : identifiants + cache expirant, jamais de copie.
7. Se positionner sur l'identité et le goût, pas sur l'utilitaire de suivi.

Suite : `docs/RATING-MODEL.md` (la décision de granularité), `ROADMAP.md` (le plan),
`docs/ROADMAP-AUDIT.md` (la critique du plan).

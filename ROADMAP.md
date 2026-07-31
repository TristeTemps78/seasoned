# ROADMAP.md — le plan

> Rédigé le 2026-07-31 après `RESEARCH.md` et `docs/RATING-MODEL.md`.
> **À lire avec `docs/ROADMAP-AUDIT.md`, qui attaque ce plan point par point.**
> Là où l'audit contredit ce document, c'est l'audit qui a raison jusqu'à arbitrage.

---

## 0. La thèse, en une phrase

> Ni un tracker (TV Time est mort de ça), ni un clone de Letterboxd (il arrive sur les
> séries) : **un endroit où l'on garde la trace de ce qu'on a pensé d'une série dans le
> temps**, dont le livrable est une trajectoire et un conseil — pas une note.

Les quatre territoires défendables identifiés en recherche (`RESEARCH.md` §6), c'est-à-dire
les seuls que Letterboxd ne prendra pas en transposant son modèle film :

1. la **trajectoire** d'une œuvre dans le temps ;
2. le suivi d'une œuvre **en cours**, avec reprise après interruption ;
3. l'**abandon** comme donnée de première classe ;
4. la question « **ça vaut mes 40 heures ?** ».

**Tout ce qui n'est pas dans cette liste est une commodité et doit être construit au moindre
coût, ou pas construit.**

---

## 1. Décisions techniques et leur justification

### 1.1 Web d'abord, et pas d'application native. C'est non négociable.

Ce n'est pas une préférence esthétique, c'est la leçon directe du projet voisin `Limits` :
une application iOS native développée sans Mac, sur un PC Windows **ARM64**, est aujourd'hui
bloquée depuis des semaines — non pas sur le code, qui est fini et testé (300 tests verts),
mais sur l'**impossibilité matérielle de l'installer sur un téléphone**. Le pilote USB Apple
est un pilote noyau x64 ; Windows on ARM n'émule que l'espace utilisateur.

Répéter ce choix ici serait construire sciemment le même mur. Une application web :

- se développe et se teste intégralement sur ce PC ;
- se déploie sans compte développeur, sans signature, sans magasin d'applications ;
- s'installe quand même sur un téléphone (PWA, écran d'accueil) ;
- se met à jour sans re-signature — donc **sans le cycle de sept jours** qui rend `Limits`
  pénible à vivre.

### 1.2 La pile

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js (App Router) + TypeScript** | Rendu serveur pour les pages catalogue = mise en cache au bord = coût marginal quasi nul (`RESEARCH.md` §5.3) |
| Style | **Tailwind** | L'affiche est l'interface ; peu de CSS propre à écrire |
| Base | **Postgres (Supabase)** | Relationnel, indispensable ici : les agrégations par saison sont des jointures, pas des documents |
| Auth | **Supabase Auth** | Ne jamais écrire soi-même de l'authentification |
| Hébergement | **Vercel** | Connecteur déjà disponible dans l'environnement de travail |
| Catalogue | **TMDB** en v1 | Meilleure couverture séries + saisons + épisodes |

**Réserve explicite sur TMDB** : l'usage commercial exige un accord écrit, et le barème de
TheTVDB (gratuit sous 50 k$ de CA, puis 1 000 $/an) est nettement plus prévisible. D'où la
décision d'architecture ci-dessous.

### 1.3 La règle qui structure tout le code catalogue

> **Le catalogue est loué, pas possédé.**
> Notre base ne contient que des **identifiants externes** et **ce que nous produisons**
> (positions, notes, journaux, textes, verdicts). Toute métadonnée — titres, affiches,
> résumés, dates — transite par une couche de cache à expiration et **n'est jamais la source
> de vérité**.

Deux raisons, l'une contractuelle et l'autre stratégique :

- TMDB interdit de conserver ses données au-delà de **six mois** (`RESEARCH.md` §4.2) ;
- si le fournisseur doit changer un jour — et c'est probable, pour la raison de coût
  ci-dessus — il faut que ce soit **un module à réécrire, pas une base à migrer**.

C'est irréparable après coup. D'où son implémentation dès la phase 0.

---

## 2. Les phases

Chaque phase est livrable et utile seule. Aucune ne suppose la suivante.

### Phase 0 — Le socle *(faisable sans aucun arbitrage — en cours)*

Tout ce qui est vrai quel que soit le modèle de notation finalement retenu.

- [x] Dépôt, outillage, TypeScript strict, tests, CI GitHub Actions
- [x] Types de domaine : `Series`, `Season`, `Episode`, `Position`, `Rating`, `Decision`
- [x] Client TMDB typé, derrière une **interface de fournisseur** (`CatalogProvider`)
- [x] Cache à expiration avec plafond contractuel de 6 mois codé en dur
- [x] **Normalisation des saisons** — le risque n°1 du modèle (spéciaux, parties, anthologies)
- [x] Moteur de trajectoire : pic, constance, forme
- [ ] Schéma de base de données *(attend l'arbitrage §4, mais le brouillon existe)*

### Phase 1 — Le catalogue en lecture seule *(pas de compte, pas de base)*

Une application publique, utile, et qui ne coûte presque rien à faire tourner.

- Recherche de séries
- Page série : saisons, épisodes, dates de diffusion, statut réel
- **Le statut réel** : distinguer « en diffusion », « entre deux saisons », « en attente de
  renouvellement », « terminée », « annulée sans fin ». Personne ne le fait correctement
  (`RESEARCH.md` §3.4) et c'est entièrement dérivable des données.
- Tout est rendu côté serveur et mis en cache : le trafic ne coûte rien

> Cette phase produit déjà quelque chose que l'on peut montrer et qui rend service, sans une
> ligne de code d'authentification. C'est le meilleur rapport valeur/risque du plan.

### Phase 2 — Le suivi personnel *(compte, aucun social)*

La couche 0 du modèle de notation : l'enregistrement sans opinion.

- Authentification
- « J'en suis là » — la position, en un geste (`RATING-MODEL.md` §3, couche 0)
- Liste de suivi et file d'attente : ce qui m'attend cette semaine
- Reprise : « tu as arrêté il y a 8 mois à S02E04, voilà ce qui s'est passé avant »
- Décision explicite : continuer / pause / abandon, avec le point exact

> À la fin de cette phase, le produit est **utile pour un seul utilisateur**. C'est le
> critère qui compte le plus, et l'audit y insiste (§3 de l'audit).

### Phase 3 — Le jugement *(la couche qui fait le corpus)*

- Note de saison, journal, texte (`RATING-MODEL.md` couche 1)
- Épisodes marquants (couche 2)
- Verdict de série et point d'arrêt recommandé (couche 3)
- **La trajectoire** : la courbe, le pic, la constance — la signature visuelle du produit
- Profil : la forme d'un goût, exportable en image

### Phase 4 — L'entrée par la migration

- Import de l'export TV Time (`tracking-prod-records-v2.csv`)
- Import Trakt, Simkl, Serializd si les formats le permettent
- **Export intégral, dès le premier jour où il y a une donnée à exporter.** Non négociable :
  26 millions de personnes viennent de perdre leur historique parce qu'un produit fermait.
  Un produit qui retient ses données par la sortie n'a aucune légitimité à demander cette
  confiance-là aujourd'hui.

### Phase 5 — Le social, si et seulement si

Suivre, fil d'activité, listes, commentaires. **Conditionnée à un arbitrage explicite** —
voir l'audit §3 et §6, qui soutient que cette phase pourrait ne jamais devoir exister.

---

## 3. Ce qui n'est délibérément pas fait

Décisions par la négative, aussi importantes que les autres :

| Écarté | Motif |
|---|---|
| Application native iOS / Android | §1.1. Le mur est connu et documenté. |
| Scrobbling (Plex, Jellyfin, extension navigateur) | Trakt et Simkl le font mieux, depuis dix ans. Terrain perdu d'avance. |
| Base de métadonnées propre | Interdit par TMDB, et sans intérêt : TVmaze et TVDB existent. |
| Notifications push généralisées | Coût marginal par utilisateur — exactement ce qui a tué TV Time. |
| Recommandation algorithmique | Le produit se positionne sur le goût humain. Un algorithme de recommandation est la commodité par excellence. |
| Classement global à un chiffre | `RATING-MODEL.md` §4. Produit des guerres de notes et détruit l'information. |

---

## 4. Les arbitrages qui attendent Tristan

Bloquants. Rien de ce qui suit n'est décidable sans lui, et tout le reste en dépend.

| # | Question | Recommandation | Impact si on se trompe |
|---|---|---|---|
| **A1** | **À quoi sert ce projet ?** Outil personnel excellent · projet public · produit à utilisateurs | *Personnel d'abord, public ensuite* — voir audit §3 | **Total.** Détermine tout le reste. |
| **A2** | Le modèle de notation de `RATING-MODEL.md` est-il validé ? | Oui, avec les réserves §8 | Schéma de base, écran principal |
| **A3** | Social en v1, ou solo ? | **Solo.** Un produit social vide vaut zéro ; un produit solo excellent vaut quelque chose dès le premier utilisateur | Six mois de travail, et la modération (audit §5) |
| **A4** | Le nom. `seasoned` est un nom de code, pas une décision | À trancher avant toute identité visuelle | Faible techniquement, fort en marque |
| **A5** | TMDB ou TheTVDB en v1 ? | TMDB pour commencer, derrière l'interface `CatalogProvider` — donc réversible | Faible, précisément grâce à l'interface |

---

## 5. Ce qui est fait cette nuit

Strictement ce qui est vrai **quel que soit** l'arbitrage §4 — c'est-à-dire du travail qui ne
sera pas jeté même si toutes les réponses sont contraires à mes recommandations :

1. le dépôt, l'outillage, la CI ;
2. les types de domaine et le moteur de trajectoire, **purs et testés**, sans dépendance à
   l'interface, à la base ni au réseau ;
3. le client TMDB derrière `CatalogProvider`, avec le cache contractuel ;
4. **la normalisation des saisons** — le risque n°1 du modèle, et le seul morceau de la
   phase 0 qui soit réellement difficile ;
5. la documentation de recherche, la roadmap, et son audit.

Aucune interface, aucune base de données, aucune authentification : ce sont précisément les
trois choses qui dépendent des arbitrages en attente.

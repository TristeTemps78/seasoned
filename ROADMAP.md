# ROADMAP.md — le plan

> Rédigé le 2026-07-31 après `RESEARCH.md` et `docs/RATING-MODEL.md`.
> **Révisé le 2026-08-01 : l'arbitrage A1 est tranché — produit à utilisateurs.**
> À lire avec `docs/ROADMAP-AUDIT.md`, qui attaque ce plan point par point.

---

## 0. La thèse, en une phrase

> Ni un tracker (TV Time est mort de ça), ni un clone de Letterboxd (il arrive sur les
> séries) : **un endroit où l'on garde la trace de ce qu'on a pensé d'une série dans le
> temps**, dont le livrable est une trajectoire et un conseil — pas une note.

Quatre **différenciateurs** — et non des fossés, l'audit §3 a raison sur ce point : ils
sont copiables. Ce sont simplement les seuls terrains que Letterboxd ne prendra pas en
transposant son modèle film :

1. la **trajectoire** d'une œuvre dans le temps ;
2. le suivi d'une œuvre **en cours**, avec reprise après interruption ;
3. l'**abandon** comme donnée de première classe ;
4. la question « **ça vaut mes 40 heures ?** ».

**Tout ce qui n'est pas dans cette liste est une commodité et doit être construit au moindre
coût, ou pas construit.**

### 0.1 La décision A1 et ce qu'elle impose (2026-08-01)

**Cible retenue : produit à utilisateurs.** L'audit recommandait l'outil personnel ; la
décision est contraire et elle est actée. Les objections de l'audit ne disparaissent pas —
elles deviennent le **cahier des charges**. Réponses en `docs/ROADMAP-AUDIT.md` §6bis.

La conséquence la plus lourde est un renversement du plan initial :

> **Une page série doit valoir le détour avec zéro critique.**

Le plan initial affirmait que le corpus de textes était le seul actif défendable. C'est
vrai à long terme et **c'est un piège en mode produit** : ce corpus ne s'amorce pas —
premier arrivant, page vide, ne revient pas, n'écrit rien pour le deuxième. Le contenu
doit donc venir dans cet ordre de facilité d'obtention :

| Source | Coût pour l'utilisateur | Disponible à partir de |
|---|---|---|
| Données **dérivées** (statut réel, dates, durée totale) | zéro | le jour 1, sans aucun utilisateur |
| Gestes **à un tap** (position, note de saison) | ~1 s | les 100 premiers comptes |
| **Agrégats** (trajectoire commune, point d'arrêt, abandons) | zéro (dérivé) | quelques centaines de notes |
| **Textes** (critiques, verdicts rédigés) | 5 min | tard, et seulement pour ~5 % |

Les textes passent donc **en dernier**, pas en premier. Et `src/domain/status.ts` cesse
d'être une commodité pour devenir un élément de valeur produit : personne n'affiche
correctement « en diffusion » vs « entre deux saisons » vs « déclarée vivante et morte
depuis dix-huit mois ».

### 0.2 Séquençage de l'acquisition

Les quatre canaux sont retenus. L'ordre n'est pas une préférence : **chacun a un
prérequis que le précédent fournit.**

1. **SEO** *(phase 1)* — le seul qui fonctionne sans aucun utilisateur. Structurel : il
   impose le rendu serveur, des pages publiques sans compte, des URL stables. Coûteux à
   ajouter après coup, d'où sa position.
2. **Communautés existantes** *(phase 2)* — quand il y a un compte à créer. Mal scalable,
   et c'est ce qui remplit les 100 premiers comptes — ceux qui feront le corpus.
3. **Migration** *(phase 3)* — quand il y a un compte à *remplir*. Amorce les données,
   donc les agrégats. N'est plus un levier d'acquisition (la fenêtre TV Time est passée)
   mais de **rétention**.
4. **Viralité** *(phase 4)* — quand il y a assez de données pour qu'une image vaille la
   peine d'être partagée. Partager une courbe vide n'a pas de sens.

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

### 1.4 Le coût marginal quasi nul, et pourquoi il n'est pas négociable

Découle de l'arbitrage A6 (monétisation non décidée) et de l'objection la plus lourde de
l'audit : **TV Time est mort avec 26,4 millions d'installations**, en disant que ce
n'était soutenable ni en gratuit ni en payant. Le problème n'était pas le coût brut mais
le revenu par utilisateur, qui tend vers zéro parce que la valeur perçue tend vers zéro.

On ne peut pas résoudre le revenu aujourd'hui. On peut résoudre le coût — et c'est **la
seule position qui ne ferme aucune des trois options de monétisation** :

- pages catalogue en rendu **statique / ISR**, servies depuis le cache de bord ;
- **aucune** notification push généralisée ;
- **aucun** pré-chargement massif du catalogue « au cas où » ;
- images servies par le **CDN de TMDB**, jamais par nous ;
- aucun job planifié qui balaie toutes les séries de tous les utilisateurs.

Formulé autrement : **le succès inattendu ne doit pas coûter cher.** C'est exactement ce
qui n'était pas vrai chez TV Time.

---

## 2. Les phases

Chaque phase est livrable et utile seule. Aucune ne suppose la suivante.

### Phase 0 — Le socle ✅ *(livré le 2026-07-31, 89 tests)*

Tout ce qui est vrai quel que soit le modèle de notation retenu — et, de fait, quel que
soit l'arbitrage A1 : rien n'a été jeté quand la décision est tombée à l'inverse de la
recommandation. C'était le critère de construction.

- [x] Dépôt, outillage, TypeScript strict, tests, CI GitHub Actions
- [x] Types de domaine : `Series`, `Season`, `Episode`, `Position`, `Rating`, `Decision`
- [x] Client TMDB typé, derrière une **interface de fournisseur** (`CatalogProvider`)
- [x] Cache à expiration avec plafond contractuel de 6 mois codé en dur
- [x] **Normalisation des saisons** — le risque n°1 du modèle (spéciaux, parties, anthologies)
- [x] Moteur de trajectoire : pic, constance, forme, point de rupture
- [x] **Horizon de spoiler** — issu de l'audit §2

### Phase 1 — Le catalogue public, conçu pour le SEO *(pas de compte, pas de base)*

Le gros du travail, et le seul canal d'acquisition qui fonctionne **sans aucun
utilisateur**. C'est aussi ce qui rend la page utile à zéro critique (§0.1).

- Application Next.js App Router, réutilisant `src/domain` et `src/catalog` tels quels
- Recherche de séries
- Page série : saisons, épisodes, dates, **durée totale d'engagement**
- **Le statut réel** : distinguer « en diffusion », « entre deux saisons », « en attente de
  renouvellement », « terminée », « annulée sans fin ». Personne ne le fait correctement
  (`RESEARCH.md` §3.4), c'est entièrement dérivable, et le module existe déjà.
- Rendu statique / ISR : le trafic ne doit rien coûter (§1.4)
- URL stables et lisibles, métadonnées, données structurées, `sitemap.xml`
- **Attribution TMDB + logo** — obligation contractuelle

### Phase 2 — Comptes et gestes légers *(canal : communautés existantes)*

La couche 0 du modèle de notation, plus la note de saison. Aucun texte, aucun social.

- Authentification
- **Schéma de base** — respecter les cinq contraintes de `RATING-MODEL.md` §7
- « J'en suis là » — la position, en un geste (`RATING-MODEL.md` couche 0)
- Note de saison (couche 1) — un geste à un tap, pas un formulaire
- Décision explicite : continuer / pause / abandon, avec le point exact
- Liste de suivi et file d'attente ; reprise après interruption

### Phase 3 — Les agrégats, et la migration *(canal : migration)*

Ce qui rend les pages uniques et non reproductibles par scraping.

- **Trajectoire agrégée**, point d'arrêt communautaire, **carte des abandons**
- **Filtrage spoiler câblé partout** — `redactTrajectory` existe, il doit passer dans
  chaque requête servant du contenu d'autrui. Devient critique ici : on affiche le
  jugement de tiers.
- Import TV Time (`tracking-prod-records-v2.csv`), Trakt, Simkl
- **Export intégral, dès le premier jour où il y a une donnée à exporter.** Non négociable :
  26 millions de personnes viennent de perdre leur historique parce qu'un produit fermait.
  Un produit qui retient ses données par la sortie n'a aucune légitimité à demander cette
  confiance-là aujourd'hui.

### Phase 4 — Textes, profil, partage *(canal : viralité)*

- Critiques de saison, épisodes marquants (couche 2), verdicts rédigés (couche 3)
- Profil : la forme d'un goût
- Trajectoire exportable en image — la contrainte produit la viralité, leçon du « Top 4 »

### Phase 5 — Le social, sous condition

Suivre, fil d'activité, listes, commentaires. **Ne pas ouvrir sans le dispositif de
modération** (signalement, retrait, point de contact) : obligations DSA, et charge
permanente pour une personne seule — audit §5.

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

## 4. Les arbitrages

| # | Question | Décision | Date |
|---|---|---|---|
| **A1** | **À quoi sert ce projet ?** | ✅ **Produit à utilisateurs.** Contraire à la recommandation de l'audit, actée. Conséquences en §0.1 et §0.2. | 2026-08-01 |
| **A2** | Le modèle de notation est-il validé ? | 🟡 Réputé validé par défaut, réserves §8 de `RATING-MODEL.md` en vigueur | — |
| **A3** | Social en v1 ? | ✅ **Non — phase 5**, et sous condition de modération | 2026-08-01 |
| **A4** | Le nom | 🟡 Six domaines vérifiés libres à 35 $/an. Recommandé : **`peaked.tv`**, repli `howfar.tv`. À trancher avant le premier déploiement public — pas bloquant pour construire. | — |
| **A5** | TMDB ou TheTVDB ? | ✅ TMDB, derrière `CatalogProvider` — réversible par construction | 2026-07-31 |
| **A6** | **Monétisation** | 🟡 **Non décidée, et volontairement non fermée.** Voir §1.4 : le coût marginal quasi nul est la seule position qui ne ferme aucune porte. | 2026-08-01 |

### 4.1 Le point de vigilance contractuel qui découle de A6

⚠️ L'usage de TMDB reste **non commercial** tant que A6 n'est pas tranchée. Or
l'affiliation streaming **comme** le freemium constituent un usage commercial et exigent
un accord écrit de TMDB. À traiter **avant** d'activer l'une ou l'autre, pas après.

C'est aussi le moment où TheTVDB redevient intéressant — barème public et prévisible :
gratuit sous 50 k$ de chiffre d'affaires, puis 1 000 $/an. D'où l'intérêt d'avoir gardé
`CatalogProvider`.

---

## 5. Ce qui a été fait la nuit du 2026-07-31

Strictement ce qui est vrai **quel que soit** l'arbitrage §4 — c'est-à-dire du travail qui
ne serait pas jeté même si toutes les réponses étaient contraires aux recommandations.
A1 est effectivement tombé à l'inverse, et rien n'a été jeté : le critère a tenu.

1. le dépôt, l'outillage, la CI ;
2. les types de domaine et le moteur de trajectoire, **purs et testés**, sans dépendance à
   l'interface, à la base ni au réseau ;
3. le client TMDB derrière `CatalogProvider`, avec le cache contractuel ;
4. **la normalisation des saisons** — le risque n°1 du modèle, et le seul morceau de la
   phase 0 qui soit réellement difficile ;
5. la documentation de recherche, la roadmap, et son audit.

Aucune interface, aucune base de données, aucune authentification : c'étaient précisément
les trois choses qui dépendaient des arbitrages alors en attente. A1 étant tranché, la
phase 1 lève la première des trois.

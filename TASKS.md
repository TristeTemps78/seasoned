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
| A4 | Le nom | 🟡 Tristan | 6 domaines libres à 35 $/an. Reco **`peaked.tv`**, repli `howfar.tv`. Bloquant **avant le premier déploiement public**, pas avant |
| A5 | TMDB ou TheTVDB ? | ✅ 2026-07-31 | TMDB, derrière `CatalogProvider` — réversible |
| A6 | **Monétisation** | 🟡 non fermée | Volontairement non décidée. ⚠️ L'usage TMDB reste **non commercial** : affiliation ou freemium = accord écrit requis (`ROADMAP.md` §4.1) |

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
| 5.0 | **Dispositif de modération** (signalement, retrait, contact) | ⛔ | **Prérequis bloquant** — DSA, audit §5 |
| 5.1 | Suivre, fil d'activité, listes, commentaires | ⛔ | N'ouvre pas sans 5.0 |

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
| **D13** | **194 Ko de JS pour zéro composant client** | Le site n'a aucune interactivité — formulaire et dépliant sont natifs, aucun `'use client'` dans le projet. C'est le coût structurel de Next App Router, non retirable sans changer de framework. Mesuré le 2026-08-02. À reconsidérer seulement si les Core Web Vitals deviennent bloquants pour le SEO. |
| D11 | Listes TMDB polluées par des programmes non narratifs | **Partiellement réglé** le 2026-08-01 par `src/domain/program.ts` : *Tagesschau* et *Paradise Hotel* ont disparu de la vitrine, le sitemap est passé de 146 à 110 pages série (~25 % écartés). **Mais le filtre par genre n'attrape pas tout** : *Die Ratgeber*, magazine de conseils allemand, reste en tête de la rangée « En attente » — TMDB ne l'étiquette ni `news` ni `talk`. La longue traîne échappe au genre. |
| **D12** | **Le facteur d'anomalie ×2 est arbitraire** | `CADENCE_ANOMALY_FACTOR` vaut 2 — « deux cycles manqués ». Observé le 2026-08-01 : *Die Ratgeber*, silencieuse depuis 20 mois avec un rythme annuel, repasse en « entre deux saisons » (609 j < seuil 730 j). Défendable, mais probablement **trop permissif** : une série annuelle qui manque son créneau de six mois est déjà un signal. ×1,5 donnerait 18 mois. **Non tranché faute de données** — il faudrait mesurer la distribution réelle des intervalles sur un échantillon large, pas régler au jugé. |

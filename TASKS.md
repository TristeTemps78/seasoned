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
| **`awaiting_renewal`** | ❌ | **Aucun cas trouvé sur 12 séries testées.** Voir ci-dessous — c'est un résultat, pas un échec de recherche. |

### ⚠️ Ce que la chasse au zombie a révélé — recentrage du différenciateur

`RESEARCH.md` §3.4 posait que « les fournisseurs annoncent `returning` pour des séries
mortes depuis trois ans ». **Sur douze séries testées en conditions réelles, aucune.**
TMDB classe correctement : terminée, annulée, entre deux saisons, en diffusion.

Deux lectures, et il faut tenir les deux :

- **L'échantillon est biaisé** vers les séries populaires, que la communauté TMDB tient à
  jour. Les zombies existent probablement dans la longue traîne.
- **Mais le trafic SEO vient précisément des séries populaires.** Un différenciateur qui
  ne se manifeste que sur les séries que personne ne cherche ne vaut pas grand-chose.

> **Conséquence : la valeur n'est pas le cas zombie, c'est le chiffre.**
> « Saison terminée il y a 11 mois. La suite est attendue. » est une information
> qu'aucun tracker n'affiche, et elle est disponible sur **toutes** les séries entre deux
> saisons — un cas bien plus fréquent que le zombie. Le zombie n'en est que la forme
> extrême.

À reporter dans `RESEARCH.md` §3.4 et dans le discours produit : cesser de présenter la
série zombie comme *le* différenciateur, et parler du **temps écoulé chiffré**, dont le
zombie est le cas limite.

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

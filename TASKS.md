# TASKS.md — ordonnancement

> Protocole : `C:\Git project\WORKFLOW.md`. **Réserver avant d'écrire** — passer la ligne
> à `🔒 in-progress — @agent — date`, committer la réservation, puis travailler.
> Statuts : `🟢 libre` · `🔒 in-progress` · `✅ done` · `⛔ bloqué`

---

## Bloquants — arbitrages humains

Rien de la phase 2 ne peut démarrer avant A1. Détail dans `ROADMAP.md` §4.

| # | Tâche | Statut | Note |
|---|---|---|---|
| A1 | **À quoi sert ce projet ?** outil personnel · projet public · produit à utilisateurs | ⛔ Tristan | **Le seul vrai bloquant.** Recommandation : personnel d'abord (audit §6) |
| A2 | Valider le modèle de notation de `docs/RATING-MODEL.md` | ⛔ Tristan | Réserves connues en §8 |
| A3 | Social en v1, ou solo ? | ⛔ Tristan | Recommandation : solo. Coût caché = modération/DSA (audit §5) |
| A4 | Le nom (`seasoned` est un nom de code) | ⛔ Tristan | À trancher avant toute identité visuelle |
| A5 | TMDB ou TheTVDB en v1 ? | 🟢 libre | Réversible grâce à `CatalogProvider` — faible enjeu |

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
| 0.9 | **Relecture par un autre agent** (`/code-review`) — rédacteur ≠ relecteur | 🟢 libre | ⚠️ prioritaire |
| 0.10 | Schéma de base de données | ⛔ | Attend A1 + A2 |

---

## Phase 1 — Catalogue en lecture seule

Ne dépend d'aucun arbitrage : ni compte, ni base. Peut démarrer immédiatement.

| # | Tâche | Statut |
|---|---|---|
| 1.1 | Application Next.js, rendu serveur, mise en cache au bord | 🟢 libre |
| 1.2 | Recherche de séries | 🟢 libre |
| 1.3 | Page série : saisons, épisodes, dates | 🟢 libre |
| 1.4 | Affichage du **statut réel** (le module existe déjà, `status.ts`) | 🟢 libre |
| 1.5 | Attribution TMDB + logo — obligation contractuelle | 🟢 libre |

---

## Phase 2 — Suivi personnel

⛔ Bloquée par A1.

| # | Tâche | Statut |
|---|---|---|
| 2.1 | Authentification | ⛔ |
| 2.2 | « J'en suis là » — la position en un geste | ⛔ |
| 2.3 | File d'attente : ce qui m'attend cette semaine | ⛔ |
| 2.4 | Reprise après interruption | ⛔ |
| 2.5 | Décision : continuer / pause / abandon | ⛔ |

---

## Phase 3 — Jugement

⛔ Bloquée par A2.

| # | Tâche | Statut |
|---|---|---|
| 3.1 | Note de saison + journal | ⛔ |
| 3.2 | Épisodes marquants | ⛔ |
| 3.3 | Verdict de série + point d'arrêt | ⛔ |
| 3.4 | Affichage de la trajectoire (le moteur existe déjà) | ⛔ |
| 3.5 | Profil | ⛔ |

---

## Phase 4 — Migration

| # | Tâche | Statut | Note |
|---|---|---|---|
| 4.1 | Import de l'export TV Time (`tracking-prod-records-v2.csv`) | 🟢 libre | Valeur d'acquisition largement retombée — audit §1.1 |
| 4.2 | **Export intégral** | 🟢 libre | Non négociable dès qu'il y a une donnée |

---

## Dette et points de vigilance

| # | Sujet | Note |
|---|---|---|
| D1 | `docs/ROADMAP-AUDIT.md` écrit par l'auteur du plan | Violation assumée de « rédacteur ≠ relecteur ». À faire relire. |
| D2 | Hypothèse de répartition 70/25/5 des niveaux d'engagement | Calquée sur d'autres communautés, non mesurée ici |
| D3 | Seuils de `trajectory.ts` calibrés sur deux séries de référence | À rejouer sur un vrai corpus |
| D4 | Détection de saison scindée | Heuristique. Signale seulement — ne jamais la faire fusionner. |
| D5 | Anthologies (*Black Mirror*) et sitcoms | Le modèle par saison y est mal ajusté. `RATING-MODEL.md` §8.2 et §8.3 |
| D6 | Usage commercial de TMDB | Exige un accord écrit. Sans objet tant que A1 = personnel. |

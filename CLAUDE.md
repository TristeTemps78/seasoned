# CLAUDE.md — seasoned

@AGENTS.md

## Notes spécifiques Claude

- Réponds en français. Dates absolues.
- Avant d'écrire : réserver dans `TASKS.md` (protocole `C:\Git project\WORKFLOW.md`).
- `npm run check` = typecheck + tests. Doit être vert avant tout commit.

## État actuel (2026-08-01)

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
- **⛔ Bloquant immédiat — tâche 1.10 : rien n'a jamais tourné contre l'API TMDB réelle.**
  Aucun jeton n'est disponible ici et en créer un supposerait d'ouvrir un compte. Toute
  la phase 1 est validée contre des fixtures et le typage. Protocole de vérification dans
  `TASKS.md` §1.10 — le cas qui compte est la série « zombie ».
- **Le nom n'est pas tranché (A4).** Six domaines vérifiés libres à 35 $/an ;
  recommandation **`peaked.tv`**, repli `howfar.tv`. Bloquant avant le premier
  déploiement public, pas avant.
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

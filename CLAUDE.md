# CLAUDE.md — seasoned

@AGENTS.md

## Notes spécifiques Claude

- Réponds en français. Dates absolues.
- Avant d'écrire : réserver dans `TASKS.md` (protocole `C:\Git project\WORKFLOW.md`).
- `npm run check` = typecheck + tests. Doit être vert avant tout commit.

## État actuel (2026-07-31)

- **Phase 0 livrée cette nuit. 89 tests verts, typecheck strict vert.** Le projet vient
  d'être créé ; il n'y a ni interface, ni base de données, ni authentification — c'est
  volontaire, ce sont les trois choses qui dépendent des arbitrages en attente.
- **Ce qui existe** : les documents de recherche et le socle pur.
  - `RESEARCH.md` — état du terrain sourcé au 2026-07-31
  - `docs/RATING-MODEL.md` — la proposition sur la granularité de notation
  - `ROADMAP.md` + `docs/ROADMAP-AUDIT.md` — le plan et sa contre-expertise
  - `src/domain/` — types, normalisation des saisons, moteur de trajectoire, statut réel,
    horizon de spoiler. Tout pur, tout testé.
  - `src/catalog/` — `CatalogProvider`, cache à plafond contractuel, fournisseur TMDB.
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
- **À relire en priorité par un autre agent** : `docs/ROADMAP-AUDIT.md`. Il a été écrit
  par l'agent qui a écrit le plan — c'est le « rédacteur = relecteur » qu'`AGENTS.md`
  interdit. Il le signale lui-même en tête.

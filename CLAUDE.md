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
- **En ligne : https://seasoned-two.vercel.app** — dépôt public
  https://github.com/TristeTemps78/seasoned, redéploiement automatique à chaque push.
  115 tests verts.
- **Le premier contact avec l'API réelle a révélé deux défauts** que les fixtures ne
  pouvaient pas voir, tous deux sur la promesse « ce qu'elle vous demande » (`TASKS.md`
  §1.10) : `episode_run_time` est abandonné par TMDB, et le repli sur le dernier épisode
  paru donnait un chiffre **faux du simple au double** (Stranger Things : 90 h au lieu de
  37). Corrigé par une **médiane** sur une saison représentative.
  > **Leçon à appliquer** : une fixture écrite de mémoire décrit l'API dont on se
  > souvient, pas celle qui existe. Les prochaines doivent être **capturées** depuis une
  > réponse réelle.
- **Les cinq statuts sont observés en conditions réelles**, zombie compris (*Majhi
  Manasa*, 26 mois). Le zombie était introuvable en devinant des titres connus ; il est
  apparu dès qu'une liste a été construite pour le faire remonter — **c'était la méthode
  de recherche qui était mauvaise, pas l'hypothèse**.
- **Le différenciateur a été recentré, chiffres à l'appui.** Sur 36 vignettes : ~20 en
  diffusion, ~9 « en attente · 1 à 5 mois », 1 seul « sans nouvelle · 26 mois ». La
  valeur est le **temps écoulé chiffré**, pas le cas zombie — qui en est la forme
  extrême, rare, et située dans la longue traîne où le trafic SEO n'est pas.
- **Le seuil de « sans nouvelle » n'est plus absolu** (`src/domain/cadence.ts`) : il suit
  le rythme observé de chaque série. Un seuil fixe traitait *Les Griffin*, qui revient
  chaque automne, comme *Stranger Things*, qui sortait tous les deux ou trois ans.
- **La trajectoire et le point d'arrêt sont en ligne**, dérivés des notes du public TMDB,
  derrière un geste explicite (règle de spoiler). *The Walking Dead* → arrêt après S6,
  ce qui correspond à sa réputation.
- **⚠️ Le cache est ce qui tient le budget, et il ne se vérifie qu'en production.**
  Pendant tout le début du projet, les pages série répondaient `X-Vercel-Cache: MISS` et
  `no-store` malgré leur `revalidate` — chaque visiteur rejouait tous les appels TMDB.
  Deux choses sont nécessaires ensemble : `dynamic = 'force-static'` sur la route (sans
  quoi Next 16 ne met jamais en cache une route dynamique) **et** le cache de données de
  l'hôte sur les appels (`{ next: { revalidate } }`), le cache mémoire étant inutile en
  serverless. La colonne « Revalidate » du build décrit l'intention, pas le cache réel.
- **Trois règles apprises à la dure, à ne pas défaire** :
  1. **Un instrument taillé pour des notes humaines ne s'applique pas à des moyennes de
     foule.** L'échelle en demi-étoiles, le seuil de rupture à une étoile et la
     normalisation de la constance supposent une dispersion qui n'existe pas — les notes
     d'une même série tiennent dans un point sur dix. D'où : les seuils sont des
     **paramètres**, et on affiche les faits (courbe, pic, décrochage) sans les jugements
     (forme, constance) sur des données de foule.
  2. **Un conseil exact mais sans portée ne vaut pas mieux que pas de conseil.** Un point
     d'arrêt qui épargne 8 % de la série ne s'affiche pas.
  3. **Auditer le résultat, jamais l'intention.** Le SEO était un cul-de-sac alors que
     tout le dispositif était en place ; le cache était inopérant alors que le build
     affichait « 1d ». Dans les deux cas le code était juste et l'effet nul.
- ⚠️ **Biais de survie, non résolu** : ceux qui ont vu la saison 6 de *Dexter* sont ceux
  qui ont persévéré, et ils la notent bien. Les notes publiques ne retrouvent pas les
  effondrements dont tout le monde parle.
- **Le nom n'est pas tranché (A4).** `seasoned.vercel.app` était déjà pris par un tiers —
  le mot est trop commun. Six domaines vérifiés libres à 35 $/an ; recommandation
  **`peaked.tv`**, repli `howfar.tv`.
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

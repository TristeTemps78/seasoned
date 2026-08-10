# CLAUDE.md — Voltface

Réponds en français. Dates absolues.

## Le but

Un mix entre Letterboxd, Serializd et TV Time.

- Letterboxd : écrire, noter, faire des listes, un profil.
- Serializd : les séries, saison par saison.
- TV Time : où j'en suis, et ce qui revient.

## Les trois règles

1. Prendre du recul.
2. La structure la plus simple qui marche.
3. Ne pas refaire ce qui existe déjà.

## Pour travailler

- `npm run check` vert avant tout commit.
- `npm run db:push` applique `supabase/*.sql`. `npm run db:scenarios` rejoue 25 scénarios
  RLS contre la vraie base, en transaction annulée — **rien ne persiste, jamais**.
- `npm run db:round -- 2026-08-10 7` construit 7 manches de quiz d'avance depuis TMDB.
- Pousser = déployer en public : décision de Tristan.
- **Ce fichier est le seul.** Pas de `TASKS.md`, pas d'`AGENTS.md`, pas de `docs/` :
  supprimés le 2026-08-10, à la demande de Tristan. Ne pas les recréer. Ce qui reste à
  faire se dit dans la conversation ; ce qui a été fait est dans les commits.

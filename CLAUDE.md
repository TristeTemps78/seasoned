# CLAUDE.md — Voltface

Réponds en **français**. Dates absolues.

## Le but

**Un mix entre Letterboxd, Serializd et TV Time.** Rien de plus compliqué que ça.

- de **Letterboxd** : écrire, noter, faire des listes, un profil qu'on montre ;
- de **Serializd** : les séries, saison par saison ;
- de **TV Time** : savoir où j'en suis et ce qui revient.

## Les trois règles, par ordre d'importance

1. **Prendre du recul.** Si je passe trop de temps dans un détail, c'est le signe que je
   n'ai pas assez reculé. Le détail attendra ; la fonctionnalité manquante, non.
2. **Garder la structure très simple.** Toujours la solution la plus simple qui marche.
3. **Ne pas refaire ce qui existe déjà.** Chercher avant d'écrire — la moitié de ce dont
   j'ai besoin est déjà là, sous un autre nom.

## Ce qu'il faut savoir pour travailler

- `npm run check` (typecheck + tests) doit être vert avant tout commit.
- `npm run db:push` applique `supabase/*.sql` à la vraie base.
- Les règles d'ingénierie non négociables sont dans **`AGENTS.md`** — 9 règles, courtes.
- Ce qui reste à faire est dans **`TASKS.md`**.
- Pousser = déployer en public : **c'est la décision de Tristan**, jamais la mienne.

## État

Le social existe : comptes, synchronisation, profils publics `/u/<nom>`, abonnements, fil
d'activité, critiques par série et par saison, signalements, et **listes**. Six faces :
accueil, `/moi`, `/calendrier`, `/bilan`, `/amis`, `/listes`.

Manquent surtout le **bilan annuel** et de quoi **découvrir des gens**.

---

_L'historique détaillé des sessions (2026-07-31 → 2026-08-09) est dans
`docs/HISTORIQUE.md`. On l'y consulte si l'on veut savoir **pourquoi** une décision a été
prise ; on ne le lit pas pour travailler._

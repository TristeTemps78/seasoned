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

Le social est complet et **réciproque** : comptes, synchronisation, profils publics
`/u/<nom>`, abonnements **dans les deux sens**, fil d'activité, critiques par série et par
saison, listes, signalements, bilan annuel. Trois portes de découverte : « qui d'autre l'a
vue » sur une fiche série, « des gens à découvrir » trié par ce qu'ils ont écrit, et les
noms qu'on croise dans le fil. Six faces : accueil, `/moi`, `/calendrier`, `/bilan`,
`/amis`, `/listes`.

Et le produit a une **identité qui se calcule** : les trois faces (`src/domain/face.ts`).
On ne la choisit pas, on la découvre — le logo la porte sur toutes les pages.

🔴 **Ce qui manque n'est plus une fonctionnalité, c'est une preuve.** La base de production
porte **1 compte et 0 profil** : tout le social a été bâti sans qu'une seule ligne y passe.
Le 2026-08-10 l'a payé — le fil et les critiques n'avaient **jamais rien pu lire** (une
relation non déclarée, un 400 avalé en liste vide), et rien ne pouvait le signaler puisque
l'écran d'un défaut est identique à celui d'un démarrage à froid. **La prochaine session
ouvre deux comptes avant d'écrire une ligne.**

---

_L'historique détaillé des sessions (2026-07-31 → 2026-08-09) est dans
`docs/HISTORIQUE.md`. On l'y consulte si l'on veut savoir **pourquoi** une décision a été
prise ; on ne le lit pas pour travailler._

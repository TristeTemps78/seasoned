# CLAUDE.md — Voltface

Réponds en français. Dates absolues.

## Le but

Un mix entre Letterboxd, Serializd et TV Time.

- Letterboxd : écrire, noter, faire des listes, un profil.
- Serializd : les séries, saison par saison.
- TV Time : où j'en suis, et ce qui revient.

## Les quatre règles

1. Prendre du recul.
2. La structure la plus simple qui marche.
3. Ne pas refaire ce qui existe déjà.
4. **Un écran qui n'a rien à montrer dit quoi faire.** Jamais `return null`.

### Sur la quatrième (2026-08-11, décision de Tristan)

Elle remplace une doctrine qui était citée dans **onze composants** : *« mieux vaut se
taire que compter zéro »*, et sa jumelle *« mieux vaut se taire que montrer une porte
fermée »*. Appliquées, elles rendaient deux des six faces muettes pour un visiteur sans
compte, faisaient disparaître « où la regarder » de la fiche série, et cachaient l'écriture
de critiques — c'est-à-dire la moitié de la cible. Verdict de Tristan : *« ça doit être
précisément l'inverse, sinon les gens ne viendraient pas si on tait tout »*.

Trois précisions, parce qu'une règle appliquée mécaniquement redevient une doctrine :

- **Un écran sans issue, pas un écran sans bouton.** Quand le geste est déjà sur la page
  (le fil d'amis vide, le formulaire juste au-dessus), une phrase suffit.
- **Un bouton qui ne peut pas marcher ne s'affiche toujours pas** (règle du 2026-08-09,
  le bouton Google de `SignIn`). Une porte *nommée, avec sa condition dite et son chemin
  cliquable* n'est pas un bouton mort : elle informe.
- **Trois silences restent, et ce sont des fonctionnalités** : `stop_map()` sous cinq
  contributeurs (c'est de l'anonymat, un compte se déduirait du chiffre), le spoiler
  (`mieux vaut masquer à tort`), et ce qui n'a littéralement rien derrière sur une page
  par ailleurs pleine (`FaceDot`, le compteur de cœurs à zéro).

  ⚠️ **`Cast` a quitté cette liste le 2026-08-15**, et l'erreur mérite d'être notée parce
  qu'elle se refera : il y était rangé sous « rien derrière », alors que la donnée existait
  — `alsoByCreators` interroge `/person/{id}/tv_credits` depuis toujours pour « du même
  créateur ». Ce n'était pas *rien derrière*, c'était *pas encore construit*, et les deux
  se ressemblent à l'écran. Le générique est cliquable depuis `/personne/[id]`.

## Pour travailler

- `npm run check` vert avant tout commit. **Et `npm run build` avant de pousser** : la CI le
  lance, et c'est lui qui vérifie que `/serie/[id]` reste `○ Static` — l'invariant de coût.
- **La mise en page ne se teste pas ici : jsdom n'a aucun moteur de rendu.** Trois défauts
  (chevauchement annulé par un `space-y`, tuiles de 64 px, 566 px cachés derrière une barre
  masquée) ont vécu sous 956 tests verts. Ce qui se lit dans la source est gardé par
  `tests/layout-collisions.test.ts` ; le reste **se mesure au navigateur**, en lisant le DOM
  (`getComputedStyle`, `getBoundingClientRect`, `scrollWidth > clientWidth`).
- `npm run db:push` applique `supabase/*.sql`. `npm run db:scenarios` rejoue 52 scénarios
  RLS contre la vraie base, en transaction annulée — **rien ne persiste, jamais**.
- `npm run db:round -- 2026-08-10 7` construit 7 manches de quiz d'avance depuis TMDB.
- Pousser = déployer en public : décision de Tristan.
- **Ce fichier est le seul.** Pas de `TASKS.md`, pas d'`AGENTS.md`, pas de `docs/` :
  supprimés le 2026-08-10, à la demande de Tristan. Ne pas les recréer. Ce qui reste à
  faire se dit dans la conversation ; ce qui a été fait est dans les commits.

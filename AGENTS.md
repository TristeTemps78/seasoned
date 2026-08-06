# AGENTS.md — règles projet (source de vérité, tous agents)

> Lu par Codex/Hermes directement, par Claude via `CLAUDE.md` (`@AGENTS.md`).
> Protocole inter-agents : `C:\Git project\WORKFLOW.md` (réservation dans `TASKS.md`,
> worktrees, verrou projet dans `_ORCHESTRATION.md` à la racine).

## Ce qu'on construit

Nom de code : **seasoned** (provisoire, arbitrage A4 de `ROADMAP.md`).

> Ni un tracker, ni un clone de Letterboxd : **un endroit où l'on garde la trace de ce
> qu'on a pensé d'une série dans le temps**, dont le livrable est une trajectoire et un
> conseil — pas une note.

Ordre de lecture pour reprendre à froid :

1. `RESEARCH.md` — l'état du terrain, sourcé et daté
2. `docs/RATING-MODEL.md` — **la décision de conception n°1** : comment on note une série
3. `ROADMAP.md` — le plan et les arbitrages en attente
4. `docs/ROADMAP-AUDIT.md` — la contre-expertise du plan, à lire avec

## Règles d'ingénierie

1. **Le catalogue est loué, pas possédé.** La base ne contient que des identifiants
   externes et ce que nous produisons (positions, notes, journaux, verdicts). Aucune
   métadonnée TMDB stockée durablement : cache à expiration, plafond contractuel de
   six mois appliqué **par le code** (`src/catalog/cache.ts`). Irréparable après coup.
2. **Le domaine est pur.** `src/domain/` n'importe rien, n'accède ni au réseau ni à
   l'horloge : tout instant de référence est injecté. C'est ce qui le rend testable sans
   rien monter.
3. **Un seul module connaît la forme des réponses d'un fournisseur.** Tout passe par
   `CatalogProvider`. Changer de fournisseur doit rester un module à réécrire, jamais une
   base à migrer.
4. **Parsing tolérant.** Clé inconnue ignorée, champ absent ou mal typé jamais fatal. Un
   catalogue tiers change sans prévenir : le code dégrade, il ne casse pas.
5. **Aucun secret dans le dépôt** (destiné à être public). Jetons, clés d'API, jetons
   d'accès personnels, clés `service_role` : jamais dans le code, les fixtures, les
   journaux ni les messages de commit. La CI le vérifie.
   - ⚠️ **Une clé publiable n'est pas un secret**, et confondre les deux coûte des deux
     côtés. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`sb_publishable_…`) part dans le bundle
     client : n'importe qui la lit dans l'inspecteur. Ce qui protège les données est
     **RLS**, pas le secret de cette clé. L'interdire ferait crier la garde sur une valeur
     publique par construction — et *on apprend à ignorer une garde qui a tort*.
   - 🔴 **La garde a été aveugle jusqu'au 2026-08-06, et pour la raison la plus banale :
     elle décrivait le dépôt d'avant.** Elle excluait `':!*.md'` — le seul type de fichier
     qui contienne effectivement une clé — et ne connaissait que le format JWT hérité,
     alors que Supabase émet désormais `sb_secret_` et `sbp_`. Les deux vrais secrets
     passaient en vert. *Auditer le résultat, jamais l'intention* : une garde se prouve par
     une mutation, pas par sa présence.
6. **Jamais de secret dans un message d'erreur ni un journal.** Les erreurs réseau
   consignent le statut HTTP et l'endpoint, rien d'autre.
7. **Rien qui dépasse la position du spectateur sans un geste explicite.** Contrainte de
   niveau 1 issue de `docs/ROADMAP-AUDIT.md` §2 — la trajectoire est elle-même un
   spoiler. Le filtrage vit dans le domaine (`src/domain/spoiler.ts`), jamais dans la
   couche de rendu : un filtre d'affichage laisse fuir les agrégats.
   - ⚠️ **« Sans position » n'a pas le même sens partout, et les deux sens sont voulus**
     (nommé le 2026-08-07, après qu'un audit l'a pris pour un défaut). `spoiler.ts`
     masque **tout** à qui n'a pas de position : ce qu'on y montre décrit *l'intérieur*
     d'une série, et mieux vaut masquer à tort que spoiler. `activity.ts` ne masque
     **rien** dans le même cas : le fil décrit ce que font **les autres**, et le nombre de
     saisons est public. C'est aussi ce que fait `entry-point`, qui s'adresse **exprès** à
     qui n'a pas commencé.
   - **Donc la question n'est pas « a-t-il une position ? » mais « ce fait décrit-il
     l'œuvre ou quelqu'un d'autre ? »** Un nouveau chemin de caviardage doit trancher
     celle-là, et écrire sa réponse — pas recopier le défaut du voisin.
8. **On signale, on ne répare jamais en silence.** Vaut d'abord pour la normalisation des
   saisons : une fusion automatique erronée casserait des notes déjà posées.
9. **Export intégral dès qu'il y a une donnée à exporter.** Non négociable — 26 millions
   de personnes viennent de perdre leur historique parce qu'un produit fermait.

## Contraintes de la machine

- Pas de Mac, pas de Xcode **en local**. PC sous **Windows ARM64**.
- **Le natif est possible, et se bâtit en nuage** (arbitrage A11, 2026-08-03). Aucun build
  local n'est tenté : la compilation iOS tourne sur des **runners macOS hébergés**
  (EAS Build, ou GitHub Actions), et le dépôt sur l'App Store part **depuis Windows**.
- La preuve d'un travail est la **CI verte**. Ne jamais déclarer une tâche finie sans.

> ### ⚠️ Ce que cette section affirmait, et pourquoi c'était faux
>
> Jusqu'au 2026-08-03 elle disait : « **Aucune application native** : le projet voisin
> `Limits` est terminé, testé, et n'a jamais tourné sur un téléphone faute de pouvoir s'y
> installer. Web uniquement. »
>
> L'observation était juste, **la conclusion ne suivait pas** — et le contre-exemple était
> dans la phrase elle-même. `Limits` a produit un **IPA en Release**, depuis ce PC, en CI,
> avec un runner qui choisit dynamiquement un Xcode portant le SDK iOS. Il n'a **jamais**
> buté sur le build. Il a buté sur le **sideload sans compte développeur** — WSL2,
> `usbipd-win`, Sideloadly, une chaîne USB qu'un compte Apple à 99 $/an et TestFlight
> rendent inutile.
>
> Donc le mur n'était pas matériel, c'était une **ligne budgétaire** : ~99 $/an (Apple)
> + 25 $ une fois (Google Play). Une décision de Tristan, prise le 2026-08-03.
>
> **La leçon, et c'est la même que celle du SEO en cul-de-sac et du cache inopérant :**
> *auditer le résultat, jamais l'intention* — y compris celui de sa propre documentation.
> « Pas de Mac » est un fait vérifiable ; « donc pas de natif » est une **inférence**, et
> elle est restée écrite comme un fait pendant tout le projet, dans le fichier que tous les
> agents lisent en premier. Une contrainte fausse dans une source de vérité coûte plus cher
> qu'une contrainte absente : elle est **crue**, et personne ne la revérifie.
>
> ⚠️ Ce que le natif entraîne, et qui n'est pas gratuit : l'**achat intégré Apple** ponctionne
> le modèle cosmétique (A6 — voir `TASKS.md` D16), et un webview nu se fait refuser
> (règle 4.2 de l'App Store), donc le natif **rend le push obligatoire** — c'est-à-dire
> ramène le coût marginal par utilisateur. À budgéter, pas à découvrir.

## Orchestration

- Réserver dans `TASKS.md` avant d'écrire, committer la réservation immédiatement.
- **Rédacteur ≠ relecteur.** `docs/ROADMAP-AUDIT.md` viole cette règle et le dit : il a
  été écrit par l'agent qui a écrit le plan. Il vaut comme liste de questions, pas comme
  validation.
- Commits atomiques, messages `type: sujet` (`feat:`, `fix:`, `test:`, `docs:`, `claim:`).

## Fin de session

`TASKS.md` à jour, « État actuel » de `CLAUDE.md` mis à jour, commit. Décision durable →
note dans le vault (`C:\Obsidian\Cerveau`), jamais de push du vault par un agent.

# CLAUDE.md — seasoned

@AGENTS.md

## Notes spécifiques Claude

- Réponds en français. Dates absolues.
- Avant d'écrire : réserver dans `TASKS.md` (protocole `C:\Git project\WORKFLOW.md`).
- `npm run check` = typecheck + tests. Doit être vert avant tout commit.

## 🏁 Verdict de stabilité (2026-08-07) — la première chose à lire

| Mesure | Début de session | Maintenant |
|---|---|---|
| Plus gros fichier | **1858 l.** (`journal.ts`) | **716 l.** (`lib/catalog.ts`) |
| Fichiers > 1000 lignes | 2 | **0** |
| Chaînes de classes répétées ≥ 3× dans `app/` | 3 formes (19+5+3 sites) | **0** |
| Tests | 787 | **718** |
| **Mutation du domaine** | **57/77 — 74 %** | **63/78 — 81 %** |
| Dépendances de production | 4 | **4** |
| Routes prérendues | 29 | **29** |
| **CI** | jamais lancée sur ce travail | ✅ **verte** (`check` + `secrets`) |

### ✅ Ce qui est acquis, et prouvé

- **✅ Tout est poussé et la CI est verte** — 27 commits, `check` (typecheck + 718 tests +
  build) et `secrets` (la garde corrigée) au vert. **C'est la seule preuve que ce dépôt
  accepte**, et elle est là.
- **Chaque correctif est prouvé par mutation, pas par relecture** — sans exception, y compris
  les deux mutations qui ont montré que mes propres tests étaient creux.
- **Deux refactors du cœur sans toucher un seul test** (`journal.ts` → six briques,
  `i18n.ts` → 254 lignes) : un barillet garde la surface publique, donc les tests sont
  eux-mêmes la preuve de neutralité.
- **Six failles fermées, quatre trous de garde comblés**, le domaine redevenu pur.

### 🔴 Ce que je ne peux toujours PAS attester

1. **15 mutations survivent — ~19 % des décisions du domaine restent non gardées.**
   `calendar.ts:150`·`:302` · `catch-up.ts:99` · `current-season.ts:80` ·
   `entry-point.ts:164` · `import.ts:120`·`:335` · `journal/merge.ts:32` ·
   `journal/parse.ts:144`·`:259` · `ordering.ts:157` · `seasons.ts:245` ·
   `trajectory.ts:203`·`:219`·`:307`.
   ⚠️ **Une partie sont des mutants équivalents** — `import.ts:120` en est un, vérifié :
   `toStars(0)` est déjà testé et la garde fait doublon avec le contrôle d'échelle en aval.
   *Un survivant ne se compte pas, il se lit.*
2. **Le score ne couvre que `src/domain/`.** `lib/`, `src/catalog/`, `src/social/` et `app/`
   n'ont **jamais** été mutés. `src/social/client.ts` : 422 lignes, 4 tests.
3. **Rien n'a été vu à l'œil** — lot 9 bloqué sur les captures, mobile jamais vu (7.1), et la
   divergence `.card` / `.panel` est **nommée mais pas tranchée**.
4. ⚠️ **Le volume n'a pas baissé** (~19 200 → ~19 400 lignes hors tests) : les découpages
   ajoutent les en-têtes qui énoncent le contrat de chaque brique. **Ce projet n'est pas plus
   petit, il est segmenté** — et c'est la seule chose défendable.

> **La base est stable au sens de ce dépôt : tout est poussé, la CI est verte, et le domaine
> est mieux gardé qu'il ne l'a jamais été (81 %). Ce qui reste n'est pas une fragilité
> cachée mais une liste : 15 décisions nommées, ligne par ligne, dont on sait qu'elles ne
> sont pas gardées.**

**La suite, dans l'ordre** : lire les 15 survivants un par un (`calendar` et `catch-up`
d'abord — 35 tests qui ne gardent aucune décision de leur module), puis muter `lib/` et
`src/social/`, qui n'ont jamais été mesurés.

## État actuel (2026-08-07 — l'audit, puis `journal.ts` découpé en six briques)

- **✅ Lots 10 et 11.0 livrés.** **787 → 711 tests**, typecheck strict vert, build vert,
  **29 routes prérendues**. Douze commits, `main` propre, **rien n'est poussé**.

### 🧱 Le découpage, et la mesure qui l'a décidé

**297 des 708 tests — 42 %** — visaient `src/domain/journal.ts` : 1858 lignes, 54 exports.
Le contraste interne disait tout : `mergeJournals`, la seule partie **déjà isolée**, tenait
en ~90 lignes et **10 tests dont 6 lois** ; tout le reste, ~1760 lignes et ~290 **exemples**.

> **Le nombre de tests ne mesure pas la prudence, il mesure l'absence de contrat.**

Six briques désormais, chacune avec sa phrase : `types` · `parse` (*lire est idempotent,
rien ne lève*) · `write` (*rejouer un geste l'annule*) · `merge` (**1 export**) · `derive` ·
`entry`. ✅ **Preuve de neutralité** : un barillet garde la surface publique au symbole près,
donc **aucun fichier de test n'a été touché** — 708 verts, `git status tests/` vide.

### 🔴 « On peut diviser les tests par 10 ? » — mesuré par mutation testing, et c'est l'inverse

Tristan a posé la question **deux fois**. Ma première réponse reposait sur **une seule
mutation** — trop mince. **77 mutations** jouées sur `src/domain/`, une suite complète
chacune :

| | |
|---|---|
| tuées | **57** |
| **survivantes** | **20** — soit **26 % des décisions du domaine que personne ne garde** |
| tests qui tombent par défaut, **médiane** | **4** |
| défauts vus par **un seul** test | **11 sur 57** |

**Une suite redondante ferait tomber des dizaines de tests par défaut.** La médiane est 4.

> **La suite n'est pas trop grosse, elle est mal distribuée.** `calendar.ts` a **20 tests** et
> **aucune** de ses deux décisions gardée — 17 vérifient le *format* du `.ics`, jamais son
> *effet*. Pendant que `spoiler`, `remaining`, `taste`, `status`, `activity` et `library`
> n'ont **aucun survivant**.

🔴 **Et ça a trouvé un vrai défaut** : `import.ts` avait 4 survivants sur 8 avec 14 tests. Un
export ne portant qu'un `tmdb_id` **importait zéro série** — l'orphelin de TV Time lit « 0
série importée » sans pouvoir savoir pourquoi, pour la population même que `/convertir` vise.
Trois tests, mutations vérifiées. **Les 18 survivants restants sont listés dans `TASKS.md`,
lot 12** — à juger un par un, une partie sont des mutants équivalents.

⚠️ L'outil (`mutants.mjs`) vit dans le scratchpad, **hors du dépôt** : c'est un instrument de
mesure, pas une garde. Il s'ancre avant de servir — parce que deux outils de diagnostic ont
menti ici, dont un que j'avais écrit le matin même.

🔴 **Et la première loi écrite était fausse** — `parse(serialize(j)) = j` échoue dès la
graine 21. Pas un défaut : **`parseJournal` n'est pas un décodeur pur, il *vieillit* le
document** (traces à 90 j, instantanés à 30 j). Le contrat exact est l'**idempotence**, et
personne ne l'avait écrit. *Une loi fausse qui échoue vaut mieux qu'un exemple juste qui ne
dit rien.*

⚠️ **Le découpage a failli rouvrir la faille fermée le matin même** : `no-journal-on-server`
barrait `@/src/domain/journal` avec une **ancre de fin**, donc `…/journal/write` passait.

### ✅ Deuxième brique : `lib/i18n.ts`, 1459 → 254 lignes

84 % du fichier étaient des phrases, pas du moteur. Les dictionnaires partent dans
`lib/i18n/{fr,en}.ts`. **Le typage ne bouge pas** — `MessageKey = keyof typeof FR` tient, donc
une clé française sans équivalent anglais ne compile toujours pas. ⚠️ **Ça ne résout pas
8.10** : séparer des fichiers ne sépare pas des chunks.

🔴 **Deux gardes sont tombées, et c'était la bonne alerte** : elles encodaient « le
dictionnaire est **un** fichier ». `no-hardcoded-strings` a accusé **274 phrases légitimes** ;
`no-false-privacy-claim` lisait le fichier au lieu de l'objet. Les deux restent
mutation-vérifiées après correction.

### ▶️ Les briques restantes

`lib/catalog.ts` (trois métiers mélangés, dont du **domaine pur** coincé dans une couche
réseau), et l'**algèbre des clés** encore dans `journal/types.ts`.

## État précédent (2026-08-07 — l'audit : six failles, et cinq décrivaient le dépôt d'avant)

- **✅ Lot 10 livré.** **787 → 708 tests**, typecheck strict vert, build vert, **29 routes
  prérendues** (inchangé). Neuf commits, `main` propre, **rien n'est poussé** — un push est un
  déploiement public, décision de Tristan.
- **Demande de Tristan** : « audite le tout, simplifie ce qui doit l'être, simplifie également
  les tests, essaye de réfléchir à contre-sens pour trouver les failles. » C'est la **deuxième
  fois** qu'il demande de simplifier les tests. Trois décisions : les **failles d'abord,
  seules** ; sur les secrets, **distinguer publiable et secret** ; sur les tests, aller jusqu'aux
  **doublons et au dictionnaire**.

### 🔴 Ce que les six failles avaient en commun : elles décrivaient le dépôt d'avant

1. **La garde CI des secrets était aveugle deux fois.** Elle excluait `':!*.md'` — le seul type
   de fichier qui contienne effectivement une clé — et ne connaissait que le JWT hérité.
   **`sb_secret_` (la clé `service_role`, qui contourne RLS) et `sbp_` (le jeton personnel que
   `db-push.mjs` demande de poser) passaient en vert.** *Elle protégeait d'un cas qui n'arrive
   plus pendant que le cas réel était nu.*
2. **`no-journal-on-server` couvrait 3 modules sur 9.** `app/journal/journalStore` n'était pas
   listé, alors qu'il importe `local`, `remote` et `syncing` à sa première ligne. La garde barre
   désormais les **répertoires** : une liste de fichiers se périme à chaque ajout.
3. 🔴 **Écrire une critique ne faisait pas remonter la série dans « Reprendre ».** `lastTouch`
   énumérait les champs à la main et il en manquait **deux** — `reviews` et `completions`,
   c'est-à-dire tout le lot 8. L'oubli s'était **déjà produit** : `liked` avait été ajouté après
   coup, avec un commentaire posé au-dessus de la mauvaise ligne. Réparé par un **type indexé**
   sur `JournalEntry` : ajouter un champ oblige à fournir son extracteur, ou à le ranger dans
   `NOT_A_GESTURE` avec sa raison. *Mutation : `tsc` refuse **en nommant** `reviews, completions`.*
4. **`src/social/client.ts` promettait de ne jamais lever, et levait.** Le `try/catch` couvrait
   le réseau, pas le post-traitement. *Mutation : le test tombe sur `TypeError: rows.map is not a
   function` — ce n'était pas théorique.* Et `SocialClient` n'avait **aucun test** (399 lignes).
5. 🔴 **`/regles` annonçait au public qu'il n'existe « aucun profil public, aucun commentaire ».**
   Sur la page **indexable**, liée depuis tous les pieds de page, et dont le rôle entier est de
   dire la vérité sur ce que le produit héberge. Le lot 8 a livré critiques, profils et fil.
   Section retirée — son propos était d'expliquer pourquoi des règles arrivent *avant* le
   contenu, et ce propos n'a plus d'objet.
6. **`no-orphan-component` ne voyait que `export function X`** — `export const Foo = () => …`
   lui était invisible. Trou latent, fermé pendant qu'il ne coûtait rien.

⚠️ **Trois autres affirmations périmées corrigées**, dont « `deviceId` anonyme et **jamais
envoyé nulle part** » alors que `remote.ts` le PUT à chaque sauvegarde. **Ce que ça vaut
exactement, mesuré** : `journals` est RLS « own only », donc l'identifiant part dans la ligne de
la personne et personne d'autre ne le lit. **Affirmation périmée, pas fuite** — ne pas l'écrire
plus fort que ça.

### 🔴 La leçon de méthode, et elle vaut plus que les six correctifs

- **Mon propre outil de détection de code mort a menti** — `parseJournal` et `t` annoncés morts.
  *Un outil de diagnostic qui ment est pire qu'aucun outil* : **quatrième fois**, **deuxième fois
  que c'est l'agent qui l'écrit**. Il n'a été cru qu'une fois **ancré**, et l'ancrage a refusé de
  publier ses résultats.
- ⚠️ **J'ai failli écrire « mutation vérifiée » sur une mutation qui n'avait pas eu lieu** : un
  script de substitution n'avait rien substitué, et les tests restaient verts « sous mutation ».
  **Toute mutation passe désormais par une édition qui échoue bruyamment si elle ne s'applique
  pas.**
- 🔴 **Quatre conclusions d'agents écartées après vérification** — le contre-sens appliqué à
  l'audit lui-même. La plus grave : la « fuite de spoiler » d'`activity.ts` **n'existe pas**, le
  `@param` dit exactement ce que le code fait. ⚠️ Ce qui restait vrai a été écrit dans
  `AGENTS.md` règle 7 : **« sans position » n'a pas le même sens dans `spoiler.ts` et dans
  `activity.ts`, et les deux sont voulus** — l'un décrit l'intérieur d'une œuvre, l'autre ce que
  font les autres.
- ⚠️ **Une garde automatique mesurée puis refusée.** Détecter les affirmations périmées par leurs
  marqueurs de temps : « jamais » sort **177 fois**, « aujourd'hui / pour l'instant » **18 fois**.
  18, ça se relit ; ça ne se mécanise pas. Relues à la main : **5 fausses, pas 3** — la relecture
  en a trouvé deux de plus que l'agent, dont celle de `/regles`. *Un garde-fou adossé à quinze
  exemptions est un garde-fou qu'on désactive.*

### Les tests : 787 → 708, sans perdre un bug attrapé

- 🔴 **Deux tests creux**, dont un qui reproduisait l'anti-patron que ce fichier nomme mot pour
  mot. **Prouvé, pas affirmé** : composant muté pour parler en toutes circonstances → l'ancienne
  version restait **verte (7/7)**, la nouvelle tombe. La parade — la sonde `Probe` — était déjà
  écrite **quarante lignes plus bas dans le même fichier**.
- **87 tests pour une propriété** : `no-hardcoded-strings` faisait un `it.each` par fichier, soit
  11 % du total du dépôt. Les « 787 tests » mesuraient en partie la taille de `app/`. Un seul
  `it()` désormais, avec la liste complète des fautes et le chemin **dans** la ligne.
- **22 égalités sur du texte littéral** dans `format.test.ts`, pour des bugs qui sont des
  **chiffres**. **Double mutation** : calcul faussé → 4 tests tombent ; dictionnaire reformulé →
  **24 verts**. ⚠️ Et la mutation a trouvé un **25ᵉ** couplage que la relecture avait raté.
- ⚠️ **Contrainte trouvée en corrigeant les chemins relatifs** : `import.meta.url` n'est pas une
  URL `file:` sous jsdom, donc `tests/sources.ts` n'est utilisable que dans le projet `domain`.
  Les chemins relatifs des tests `.tsx` ne sont **plus un oubli, mais une contrainte**.

### ▶️ Pour reprendre

**Deux lots sont ouverts, et ils ne se mélangent pas :**

- **Lot 9.6 — la typographie**, réservé et **en attente de Tristan**. Un banc d'essai autonome
  a été construit (`banc-typo.html` dans le scratchpad, polices et vraies affiches embarquées) :
  quatre fois le même écran, seule la police change. ⛔ **Rien ne bouge tant qu'il n'a pas
  choisi**, et tant qu'il n'a pas collé les trois captures (`/`, `/serie/1396`, `/moi`) — la
  méthode du lot 9 l'exige, et l'agent n'a **aucun outil de navigateur**.
- **Lot 11 — la simplification du code**, mesurée et **non exécutée** (décision : les failles
  d'abord). Tout est dans `TASKS.md`. Le point le plus visible est **11.1** : `.card` promet
  « un seul rayon dans toute l'application » alors qu'elle est employée **8 fois** contre **19**
  copies à la main, avec un rayon et un fond **différents** — donc à traiter **avec le lot 9**.

## État précédent (2026-08-06 — le lot 8 est livré : on peut écrire, aimer, et sauter un épisode)

- **✅ Lot 8 livré et poussé.** **787 tests** (+52), typecheck strict vert, build vert,
  **29 routes statiques** (inchangé), CI verte. `005` et `006` **appliqués à la vraie base**.
- **Trois features, décidées avec Tristan le 2026-08-06** après un état des lieux
  « TvTime × Letterboxd » :
  1. **Le cœur** — l'attachement, distinct de la note. Une note dit la qualité, un cœur dit
     autre chose : on met cinq étoiles à une série qu'on ne reverra jamais.
  2. **Les épisodes sautés ou vus en avance** — la position reste **un pointeur**, on ajoute
     l'exception. Pas de cases à cocher, donc pas la friction qui est *la cause n°1
     d'abandon des trackers*.
  3. **Les critiques**, publiques, par série **et** par saison — le premier champ de texte
     libre du produit.
- 🔴 **Le piège du lot était dans `tally.ts`, et il était silencieux.** Le bilan compte par
  `total − restant` : passer les marques à `remainingAfter` — le réflexe — aurait fait
  **monter les heures vues** d'un épisode qu'on vient de déclarer avoir sauté. D'où
  `classifyMarks`, seul endroit qui range les marques, avec deux listes **nommées** et leur
  signe explicite. *Mutation vérifiée : la version naïve fait tomber deux tests.*
- 🔴 **Le social était bâti et aveugle.** `setVisibility()` et `unfollow()` existaient depuis
  le lot 6 **sans aucun appelant**, et la visibilité était codée en dur à `followers` — donc
  aucune critique n'aurait jamais pu être lue par quelqu'un qui ne vous suit pas déjà.
- **Les critiques vivent aux deux endroits, et la frontière est nette** : le journal reste la
  source de vérité (règle 9 + Q12, on écrit hors ligne), la table `reviews` porte la copie
  publiable — parce que `journals` est RLS « own only » par décision écrite, et parce que
  `hidden_at` rend **exécutable** la promesse « on masque, on ne supprime jamais ».
- **Le caviardage vit dans `spoiler.ts`**, là où `AGENTS.md` règle 7 l'exige, et **dans le
  navigateur du lecteur** — le serveur ne sait pas où en est celui qui lit, donc sa position
  ne peut pas fuir. ⚠️ Le texte masqué est **déplacé**, pas caché en CSS.
- ✅ **Le verrou légal est levé, en local et en production** : `/mentions` affiche l'éditeur
  sur le site servi (variables Vercel « sensitive » — vérifié, elles fonctionnent au build).
  RLS de `reviews` éprouvée contre la vraie base : lecture anonyme vide, écriture refusée 401.
- ⚠️ **Deux tests creux trouvés par leur propre mutation**, et c'est la leçon récurrente :
  « retirer le cœur ne retire pas *je veux la voir* » ne tombait pas (une pierre tombale
  n'agit qu'à la fusion, que le test ne faisait pas), et l'exemple de « champ inconnu » des
  tests de 8.0 utilisait `reviews`… qui est devenu un champ **connu** deux commits plus tard.

### ▶️ Pour reprendre

**Reste du lot 8** : **8.1** (mesurer le journal, ferme la tâche 4.5 ouverte depuis le lot 4)
et **8.9 partiel** (la phrase de `/regles` sur le retrait d'une critique, et
`ARCHITECTURE-APP.md` §5 dont la ligne « pas de texte libre avant 5.0 » est levée).

**Ce qui n'a pas été regardé à l'œil** : les critiques n'ont jamais été vues dans un
navigateur, ni le cœur, ni le tiroir de la grille. Tout est prouvé par les tests et par la
lecture de la source — *ce n'est pas la même chose que de l'avoir vu*. Un test vérifie que
la fiche série monte bien `<Reviews />`, mais personne n'a jamais lu une critique à l'écran.

**Ce qui manque encore face à la cible** : les **listes** personnalisées, la **page de profil
public** `/@handle` (on suit un handle sans pouvoir ouvrir sa page), le **bilan annuel**.

⚠️ **Tâche 8.10** — le seul vrai sujet de scalabilité trouvé par l'audit : les **deux
dictionnaires** partent dans le même chunk client de 18 Ko gzip. À cinq langues, ce serait
45 Ko dont 36 inutiles à chacun.

## État précédent (2026-08-06, matin — 8.0, la perte de données réparée)

- **✅ Sous-tâche 8.0 livrée.** **747 tests** (+12), typecheck strict vert, build vert,
  **29 routes statiques** (inchangé). **8 commits poussés, CI verte** (`check` + `secrets`),
  `main` propre — `fa77b21..8a0ed93`, poussés sur décision de Tristan en fin de session.
- **Le lot 8 est ouvert et réservé** — décidé avec Tristan le 2026-08-06 après un état des
  lieux « TvTime × Letterboxd ». **Le manque le plus structurant est que ce produit ne sait
  écrire nulle part** : aucun champ de texte libre dans tout le dépôt, sauf la note d'un
  signalement. Trois décisions : critiques **publiques, par série ET par saison** ; **cœur**
  distinct de la note ; progression **« pointeur + exceptions »** (marquer un épisode sauté
  ou vu en avance, sans passer aux cases à cocher).
- 🔴 **8.0 ne livre aucune fonctionnalité : elle répare un défaut de perte de données présent
  aujourd'hui.** `remote.ts:135` portait le commentaire « un document écrit par une version
  plus récente ne doit pas casser celui-ci » et appelait `parseJournal`, qui **jette
  exactement ce cas** et retournait `kind: 'found'` avec **zéro entrée**. La suite se déroule
  seule : l'écran affiche « rien », **un seul geste** écrase le local, la synchro lit
  « le compte n'a rien », et le `POST merge-duplicates` remplace la ligne entière.
  **Local et distant détruits par un clic.**
  - **Le type `RemoteRead` distinguait DÉJÀ `absent` de `unavailable`**, et son docblock
    décrit précisément ce raisonnement — pour le cas « zéro ligne », réparé au 6.0. Le
    **troisième** cas, document présent mais illisible, était passé au travers.
    *Le commentaire décrivait l'intention, le code faisait le contraire* — quatrième fois.
  - **L'autre moitié du piège** : `parseEntry` reconstruit un objet neuf, donc un ancien
    client relisant un journal plus récent le **réécrit dépouillé**. D'où le pass-through des
    champs inconnus — et son prix, écrit dans l'en-tête de `journal.ts` et non dans
    `TASKS.md`, parce que c'est là qu'on le lit au moment de le payer : **le format est
    désormais additif par contrat**, une version future peut ajouter un champ, jamais changer
    le sens d'un existant.
- 🔴 **L'ancrage a trouvé que le reste aurait été creux.** Le générateur des huit lois de
  fusion apprend à poser des champs inconnus, et il en produit en quantité — mais le cas où
  les **deux** appareils en portent un sur la **même série** n'arrive qu'**une fois sur 120**.
  Les lois ne couvraient donc quasiment pas le seul cas où `mergeUnknown` doit départager.
  D'où une loi dédiée qui **construit** ce conflit au lieu de l'espérer.
  > **La règle, encore une fois** : *un test qui compare deux journaux sans la donnée qu'il
  > prétend éprouver compare deux fois rien.* C'est le cinquième faux négatif de fixture que
  > ce dépôt aurait pu commettre.
- **Quatre mutations vérifiées** : illisible remis en `found`+vide → 2 tests tombent, dont le
  bout-en-bout ; `mergeUnknown` en « b gagne » → 3 lois ; `'wanted'` retiré de la liste des
  champs connus → **`tsc` refuse, en nommant le champ** ; version future re-jetée → 2 tests.
- **Deux tests disaient l'inverse et ont été retournés, pas supprimés.** Le plus parlant est
  celui du rewatch : *un visionnage est un fait qui a eu lieu*, et le perdre sur un numéro de
  version est la trahison même contre laquelle le rewatch a été conçu.
- ⚠️ **Le refactor trouvé non committé en début de session a été relu avant d'être repris**
  (`RowHeader`, `.hero-title`, `.label` — celle-ci écrite **dix fois** à la main avant d'être
  nommée). Il **renforçait** la garde typographique (`h1`→`h6`, exceptions supprimées) mais
  perdait deux choses, rendues : l'ancrage comptait les **fichiers** au lieu des **titres**
  — mutation vérifiée, il restait vert quand le motif de titre était cassé — et la détection
  de deux crans contradictoires sur un même titre.

### ▶️ Pour reprendre le lot 8 — **le verrou de déploiement est levé**

✅ **8.0 est poussée, la CI est verte, et le lecteur tolérant est SERVI en production** —
vérifié sur le résultat, pas sur le commit : les chunks référencés par l'accueil de
`seasoned-two.vercel.app` contiennent `unknownFields` **et** `.rescue`
(`/_next/static/chunks/05yb8119inc66.js`, relevé le 2026-08-06).
- ⚠️ **Ce que cette preuve vaut, exactement** : elle montre que le build déployé **contient**
  le pass-through, pas qu'il se comporte bien à l'exécution — ça, ce sont les 747 tests sur
  la même source. La vérification en console
  (`parseJournal('{"version":99,"entries":{"tmdb:1":{"x":1}}}')` doit rendre une entrée) reste
  la plus directe si un doute apparaît. *Ne pas écrire « vérifié en production » plus fort que
  ce qui a été regardé.*

**Donc les trois sous-tâches qui écrivent dans le journal sont débloquées** : 8.2 (cœur),
8.3 (marques d'épisode), 8.4 (critiques). Ordre conseillé, du moins risqué au plus :
**8.5** (réveiller `unfollow()` / `setVisibility()` — sans elles *aucune critique ne serait
lisible par personne*, la visibilité étant codée en dur à `followers`), puis **8.1** (mesurer
le journal, ferme la tâche 4.5), puis **8.2**, **8.3**, et enfin **8.4 → 8.9**.

✅ **Le verrou légal est levé partout — local ET production. C'est fini, ne plus le demander.**
En local depuis le 2026-08-06 (`.env`, l'adresse passe `looksLikeEmail`, le contrôle né de D19).
✅ **Chez Vercel : vérifié le 2026-08-07 sur le site servi**, pas sur un tableau de bord ni sur
parole — `seasoned-two.vercel.app/fr/mentions` affiche « ÉDITEUR — Tristan de Forges » et
« CONTACT — volteface.app@gmail.com », et `/fr/amis` s'ouvre sur l'invitation à créer un compte
au lieu de l'avertissement. Or la page **ne peut afficher l'éditeur que si `legalIsComplete()`
est vrai** : c'est donc la variable elle-même qui est prouvée, par son effet.
- 🔴 **Tristan a dû le redire plusieurs fois avant que ce fichier soit corrigé**, alors que la
  vérification tenait en une requête sur la page publique. *Une dette qu'on peut fermer en
  regardant le résultat ne se redemande pas à l'utilisateur* — c'est la règle du dépôt
  (« auditer le résultat, jamais l'intention ») appliquée à ses propres notes de session.
- ⚠️ Écart relevé, non tranché : l'adresse s'écrit `volteface…` alors que le produit s'appelle
  **VOLTFACE**. Peut être voulu (« volte-face »). Posée telle que dictée.

### 🔎 Audit de solidité (2026-08-06) — « pas un château de cartes », et c'est mesuré

**Verdict : la base est saine.** 4 dépendances de production (`next`, `react`, `react-dom`,
`@supabase/auth-js`), le domaine n'importe rien d'externe, aucun journal côté serveur — les
trois règles structurelles tiennent, vérifiées fichier par fichier. Détail dans `TASKS.md`.

- **Retiré** : 5 symboles réellement morts, 19 exports que personne n'importait, 3 clés de
  dictionnaire orphelines. **95 lignes en moins, zéro test perdu.**
- 🔴 **Le vrai défaut n'était pas du volume, c'était une contradiction** : `types.ts` — le
  **deuxième** fichier de l'ordre de lecture d'`AGENTS.md` — portait quatre formes de la
  phase 0.2 (`Highlight`, `Decision`, `SeriesVerdict`, `LogEntry`) que **rien n'a jamais
  construites**, pendant que `journal.ts` bâtissait les siennes. Deux modèles concurrents,
  et rien ne disait lequel était réel. *C'est exactement la sensation de château de cartes :
  la base a l'air de dire une chose, le code en fait une autre.*
- 🔴 **Mes deux outils de mesure ont menti** — 72 puis **210** faux positifs. Le second
  ignorait que `tn()` compose la variante de pluriel à l'exécution et que cinq préfixes sont
  construits dynamiquement. Après correction : **3 clés mortes sur 461**. J'ai vérifié à la
  main avant de supprimer, seule raison pour laquelle 207 clés vivantes sont encore là.
  > *Un outil de diagnostic qui ment est pire qu'aucun outil* — troisième fois dans ce
  > dépôt, et cette fois c'est l'agent qui l'avait écrit.
- 🔴 **Le seul vrai sujet de scalabilité trouvé — tâche 8.10** : le chunk client de 18 Ko
  gzip contient **les deux dictionnaires**, `'Tenue de bout en bout'` et `'Holds up
  throughout'` côte à côte. Chaque visiteur télécharge la langue qu'il ne lit pas. Le
  problème n'est pas les ~9 Ko d'aujourd'hui, **c'est la pente** : A9 vise l'international,
  et à cinq langues ce chunk ferait ~45 Ko dont 36 inutiles à chacun.

## État précédent (2026-08-05 — la garde ne voyait pas le défaut pour lequel elle existait)

- **✅ La relecture du lot 7 est traitée.** **735 tests** (+1), typecheck strict vert, build vert.
  Quatre commits, `main` propre, rien n'était poussé ce jour-là *(ils l'ont été le
  2026-08-06, dans le lot de 8 commits — voir l'état actuel)*.
- 🔴 **Le 7.5 annonçait avoir réparé les titres sans cran. Recensement : il en a réparé TROIS
  et laissé SEPT.** `OrderingNotice`, `JournalSync`, `Friends`, `AccountPanel` (deux fois),
  `/regles`, `/mentions`, `/confidentialite` écrivaient encore leur `h2` en `font-semibold`
  **nu**, c'est-à-dire à la taille exacte du corps de texte — plus deux `h3` que son motif
  `<h[12]` ne regardait même pas. **734 tests verts pendant tout ce temps.**
  - **La cause est la question posée.** Le test demandait « ce titre écrit-il une taille en
    trop ? ». Un titre en `font-semibold` nu n'en écrit **aucune**, donc il passait — or c'était
    exactement le défaut à attraper. Il demande maintenant **« ce titre porte-t-il un cran ? »**,
    ce qui refuse d'un seul coup la taille absente et la taille en dur.
  - > **C'est la troisième fois, et cette fois c'est le lot qui écrivait la leçon qui la répète.**
    > Le 6.7 avait extrait les FORMES en laissant la typographie ; le 7.5 a extrait la
    > TYPOGRAPHIE en laissant sept titres sans cran, dans les fichiers qu'il n'avait pas ouverts.
  - **Quatre autres faux négatifs fermés** : `h3` ignoré ; `className` en template literal
    **invisible** — le faux négatif de `.tile`, refait quinze heures plus tard ; `text-[28px]`
    et `style={{fontSize}}` non vus ; et `ALLOWED` qui exemptait un **fichier** entier, donc
    aussi les titres qu'on n'avait pas examinés. La clé contient désormais la classe, donc
    l'exemption **s'invalide d'elle-même** quand on réécrit le titre.
  - **Et `.section-title > :first-child` était POSITIONNEL** : un élément inséré avant le `h2`
    lui retirait taille, graisse, capitales et interlettrage, sans erreur ni test. D'où
    `.row-title`, cinquième cran — **il existait déjà**, caché dans le sélecteur, ce qui rendait
    « quatre crans » inexact.
- 🔴 **J'ai corrigé un chiffre faux par un autre chiffre faux, et c'est le résultat le plus
  instructif de la session.** Mon commentaire d'`EpisodeGrid` disait que 44 px rendrait la table
  « trois fois plus large que l'écran ». La relecture a eu raison de le contester et j'ai refait
  l'arithmétique : **8,7×**. Les deux sont faux. Les deux prenaient **62** pour le nombre de
  colonnes — c'est le nombre **total d'épisodes** de *Breaking Bad*. Le nombre de colonnes est la
  taille de la **saison la plus longue** : mesuré au navigateur, **16**. Vrais rapports : 1,1× à
  20 px, 1,7× à 32 px, 2,3× à 44 px.
  > **La leçon** : *une relecture qui accepte la prémisse de ce qu'elle relit ne relit rien.*
  > J'ai refait le calcul **sur la prémisse du commentaire** au lieu d'ouvrir la page.
- 🔴 **Et un constat de la relecture était faux, vérifié avant de le suivre** : elle affirmait
  que le `min-height` mobile de `.btn` « ne peut être corrigé par aucun utilitaire ». Tailwind 4
  fournit `min-h-*`, ce dépôt l'emploie déjà (`SeriesCard.tsx:87`), et la règle vit bien dans
  `@layer components` — vérifié dans la CSSOM de la feuille servie. *Un rapport d'agent ne se
  prend pas au mot.*
- ⚠️ **L'outillage : le « contournement » du 2026-08-04 était une conclusion fausse, et elle
  était écrite comme une méthode pour les sessions suivantes.** `resize_window` répond
  « Successfully resized » **sans rien redimensionner** : `outerWidth` reste à 0, `innerWidth`
  plafonne à 784 px, et l'effet réel est un zoom différé. Donc `matchMedia('(width < 40rem)')`
  reste `false` et **la branche mobile n'a jamais pu être exercée**. Le détail qui alerte : à
  784 px je remesure **exactement** les valeurs consignées comme « mesurées à 360 px » — `.btn`
  à 38 px, cases à 20 px, les valeurs de la branche **bureau**. La correction des 44 px reste
  juste, mais **par accident**.
  - ✅ **En échange, la capture d'écran fonctionne** — les deux sessions précédentes butaient sur
    « the Browser pane is not displayed ». Elle a rapporté en une seconde ce que 735 tests, le
    typage et le build ne voient pas : **deux textes français privés de leurs accents**
    (« Installee sur l'ecran d'accueil »), dans le bandeau que lit en premier un visiteur qui a
    des notes sans compte.
  - ✅ **Vérifié au navigateur** : les 10 titres de la fiche série portent tous un cran
    (28/18/14 px), `.row-title` rend 13 px / +1,3 px / capitales, et le sélecteur positionnel a
    **disparu** de la feuille servie.
  - ⚠️ **Une fausse alerte de ma part, écartée par la mesure** : cinq `<li>` sans image sur
    l'accueil — ce sont les **onglets de navigation**, et les 29 affiches se chargent toutes.
- **Quatre arbitrages tranchés par Tristan (2026-08-05)** : grille à 32 px sous 640 px (7.1),
  bilan à 30 px (7.13), `--color-pulse` gardé pour le seul halo du `body` (7.8), `/hors-ligne`
  en `.empty-state` (7.4). Et **titre de rangée à 13 px** — ce qui coûte −19 % sur l'accueil et
  −28 % sur la bibliothèque, deux baisses que le commit précédent n'avait pas annoncées et qui
  sont maintenant écrites avec le cran.

## ▶️ Pour reprendre : **lot 7 — UX/UI**, dans `TASKS.md`

Tristan reprend l'UX/UI dans une prochaine session en disant simplement **« continue »**.
Tout est dans **`TASKS.md` → « 🎨 Lot 7 — UX/UI »** : la marche à suivre, les **huit règles
de design à ne pas défaire**, et les tâches classées par valeur.

**Fermés : 7.5, 7.8, 7.9, 7.10, 7.11, 7.13, 7.14.** Partiels : 7.1, 7.2, 7.4, 7.12. Ce qui
reste demande **un téléphone ou un œil**, pas une mesure :

1. **7.1 / 7.15** — le mobile n'a **toujours pas** été vu, et il ne l'a jamais été : la
   méthode consignée le 2026-08-04 ne redimensionnait rien (voir ci-dessus). La question
   concrète est **7.15** : les quatre pastilles de décision passent de 26 à 44 px sous
   640 px, dans un `flex-wrap`. Bonne cible tactile, encombrement inconnu.
2. **7.13 bis** — le bilan à 30 px dépasse `.page-title` de 25 % **sur mobile**, dans une
   carte de 360 px. Tranché, pas regardé.
3. **7.4** — restent `/convertir`, `/regles`, `/mentions`, `/confidentialite`,
   `/compte/retour`. Les captures marchent désormais, donc c'est faisable seul.
4. **7.3** `/amis` avec un vrai fil (deux comptes), **7.6** `/bilan` (contenu, pas style),
   **7.7** le placement du bandeau `DataSafety`.

⚠️ **Pièges d'outillage, corrigés le 2026-08-05.** Le service worker sert des pages en cache
(`?v=N`). 🔴 **`resize_window` ne redimensionne pas** : il répond « Successfully » et le
viewport plafonne à 784 px (`outerWidth` reste 0, l'effet réel est un zoom différé) — donc
**la branche mobile n'est pas atteignable**, et les « mesures à 360 px » du 2026-08-04 étaient
des mesures de bureau. La CSP interdit l'iframe du site par lui-même, donc ce contournement-là
non plus. Ce qui marche : la CSSOM (`document.styleSheets`) pour prouver qu'une règle `@media`
a survécu au build et vit dans la bonne couche, et **la capture d'écran**, qui fonctionne
maintenant. Enfin, `git checkout <fichier>` pour annuler une mutation **efface le travail non
committé** du même fichier — sauvegarder par copie.

## État précédent (2026-08-04, matin — l'échelle typographique, et la duplication qui s'était reformée)

- **✅ Passe UX/UI livrée : 7.5, 7.9, 7.10, 7.11.** **734 tests** (+3), typecheck strict vert,
  build vert, 29 routes statiques. Deux commits, `main` propre.
- 🔴 **Le lot 6.7 avait extrait les FORMES et laissé la TYPOGRAPHIE en chaînes recopiées.**
  Le compte : `text-2xl font-semibold tracking-tight` **seize fois**, `text-lg …` huit fois,
  `text-sm font-semibold` huit fois. C'est le bouton × 11 qui recommence, dans le lot suivant.
  - **Ce que la duplication avait déjà produit, et que personne n'avait vu** : `Agenda`,
    `MyStats` et `Friends` écrivaient leur `h2` en **`font-semibold` nu**, c'est-à-dire à la
    taille exacte du corps de texte. **Sur ces trois pages la hiérarchie n'existait plus**, et
    seule la graisse distinguait un titre d'un paragraphe. Ni le typage, ni les tests, ni le
    build ne voient qu'un titre a la taille d'un paragraphe.
  - Quatre crans : `.page-title` (1.5 / 1.75 rem), `.section-heading` (1.125), `.card-title`
    (0.875), `.empty-state-title` (1). **`.card-title` n'a pas été inventé** — il a été
    *trouvé* en cherchant ce que le test allait refuser.
- 🔴 **Les quatre écrans vides avaient quatre mises en page, et c'est le premier écran de
  TOUT LE MONDE.** Deux d'entre eux **recopiaient à la main `.card` et `.btn`**, extraits au
  6.7 quinze heures plus tôt.
  > **La leçon** : extraire une forme ne protège que les écrans qu'on rouvre **le même jour**.
  > La duplication s'était reformée dans les fichiers que le lot n'avait pas ouverts — même
  > mécanique que les deux blocs d'affiche qui avaient divergé sans bruit.
- 🔴 **Et `.section-title`, extraite au 6.7 D'APRÈS l'accueil, n'était employée NULLE PART.**
  L'original avait continué sa vie de son côté, en gardant `text-base tracking-tight
  uppercase` — des **capitales resserrées**, alors que les capitales demandent *plus*
  d'interlettrage. La classe extraite portait la bonne valeur et **personne ne l'avait jamais
  vue à l'écran**. *Une forme extraite que personne n'emploie ne protège de rien.*
- **📏 Le mobile est mesuré pour la première fois (7.1).** Le raisonnement était juste :
  **aucun débordement horizontal à 360 px**. Ce qu'il n'avait pas prédit : les `.btn`
  faisaient **38 px**, sous les 44 px d'Apple — corrigé, et seulement sous 640 px.
  > **Le contournement qui a rendu ça possible** : `resize_window` redimensionne réellement la
  > fenêtre, **seule la capture ne suit pas**. Une échelle et une hauteur tactile **se
  > mesurent** — `getBoundingClientRect` ne se trompe pas là où l'œil hésite.
- 🔴 **L'audit a trouvé dans mon propre travail la règle que je venais d'appliquer.**
  `.empty-state-actions` n'avait **qu'un seul usage**, alors que `globals.css` impose de
  n'extraire qu'à partir de trois répétitions — le « rien au cas où » que le 6.7 s'interdisait.
  Retirée le jour même.
  - ⚠️ **Et mon premier comptage était FAUX** : il cherchait les classes entre guillemets et
    ratait donc `.tile`, écrite dans un template literal. J'ai failli déclarer morte une classe
    vivante. *Une vérification mal ancrée est pire qu'aucune : elle rassure* — troisième fois.
- **Le test `no-adhoc-typography` refuse une taille de police en dur sur un titre**, avec deux
  exceptions qui doivent **se justifier** (patron de `no-false-privacy-claim`).
  > 🔴 **Son ancrage a attrapé un défaut dans le test lui-même** : `RegExp.test` avec le
  > drapeau `g` retient `lastIndex` d'un appel à l'autre, donc le second fichier examiné
  > repartait du milieu et répondait faux. **Sans l'ancrage, le test aurait été vert par
  > accident.** Deux mutations vérifiées ensuite : un `h1` réécrit à la main le fait tomber,
  > un cran retiré de la feuille de style aussi.

## État précédent (2026-08-04, nuit — le signalement, et trois écrans qui mentaient)

- **✅ 6.5 livré : le canal de signalement existe.** **731 tests**, typecheck strict vert,
  build vert, 29 routes statiques. Tout est poussé, le lot 6 est **entièrement fermé**.
- **La table `reports` avait été refusée deux fois, et pour la bonne raison** : *une table
  qu'on peut remplir avant de savoir traiter un signalement est un piège*. Les deux
  conditions sont maintenant réunies — la procédure est publiée sur `/regles` depuis 5.0a, et
  le fil montre du contenu de tiers depuis 6.6.
  - **Les motifs du menu sont les clés de `/regles`, mot pour mot.** Pas de libellés courts
    écrits pour l'occasion : c'est ce qui rend impossible la dérive où l'on retire pour un
    motif qu'on n'a pas publié. Le prix est un bouton qui porte une phrase.
  - **Aucune politique de lecture sur la table, et c'est la décision du fichier.** Relisible
    par son auteur, un signalement devient un accusé de réception — donc une promesse de
    suivi à tenir dans l'interface. Relisible par la personne visée, une dénonciation
    nominative. Les deux sont pires que le silence.
  - **Six scénarios rejoués contre la base** : signaler passe ; signaler au nom d'un autre, se
    signaler soi-même, inventer un motif, redéposer le même sont refusés ; et **personne ne
    peut relire, pas même l'auteur**.
- 🔴 **Le lot 6.3 avait rendu quatre écrans menteurs, et personne ne l'avait vu.**
  - Le bandeau de sauvegarde dit « ces notes ne vivent que dans ce navigateur » et tout son
    propos est le risque que Safari efface le stockage local. **Avec un compte, la phrase est
    fausse et le risque n'existe plus.** Il se tait désormais.
  - La fiche série, le bilan et la bibliothèque vide promettaient « rien n'est envoyé ».
    Corriger les trois aurait suffi ce jour-là et **raté la quatrième**, écrite plus tard par
    quelqu'un qui se souvient de la promesse d'origine. La phrase vit maintenant à un seul
    endroit — `WhereItLives` — et **un test interdit de la réécrire ailleurs**.
    > Ce test a une valeur inattendue : il n'interdit pas la phrase, **il oblige à la
    > justifier**. Quatre clés la portent encore, chacune pour une raison désormais écrite.
- 🔴 **Et le test qui accompagnait le bandeau était CREUX — la mutation l'a montré.**
  Vérifier un **silence** ne prouve rien sur un composant dont le silence est l'état par
  défaut : il se tait aussi avant d'avoir lu le journal. Pire, `waitFor(textContent === '')`
  **réussit au premier tick**, avant toute lecture.
  > **La règle, et c'est la deuxième fois que ce dépôt la réapprend** : sur un état
  > asynchrone, on attend **la condition finale elle-même**, jamais l'absence. Le test attend
  > désormais la même asynchronie que le composant, via une sonde branchée sur le même
  > journal — et un **ancrage** prouve d'abord que le bandeau parle dans ce montage exact.
- **✅ Deux règles de design écrites, pas seulement appliquées** :
  1. **Une couleur, un sens.** Le vert parlait à la fois de la série (« en diffusion ») et
     du bouton actif sur la fiche série. La règle est maintenant dans `globals.css` :
     **le vert parle de la série, le volt parle de vous.**
  2. **`@layer components`** — et ce n'est pas décoratif. Sans la couche, mes classes sont
     du CSS nu et **gagnent** sur les utilitaires Tailwind : `class="btn px-3 py-1 text-xs"`
     n'avait aucun effet, et les quatre boutons de décision avaient grossi sans que personne
     l'ait demandé. *Un défaut qu'aucun typage ni aucun test ne voit, et qu'une capture
     d'écran voit en une seconde.*
- **L'état choisi n'a plus aucune classe conditionnelle** : `.btn[aria-pressed='true']` le
  porte. L'apparence dérive de l'attribut d'accessibilité au lieu de le doubler — et c'est
  l'attribut, pas la classe, qui dit la vérité à un lecteur d'écran.
- **`.env.example` perd son piège** : la consigne « laisser VIDE » **était** la cause du bogue
  de langue. Une ligne commentée ne peut plus poser la question.

## État précédent (2026-08-03, nuit — l'apparence, et ce qu'elle a fait sortir du bois)

- **✅ 6.7 livré : le vocabulaire visuel existe.** **722 tests**, typecheck strict vert, build
  vert, 29 routes statiques. Tout est poussé.
- 🔴 **Le diagnostic n'était pas « c'est laid » mais « aucun écran ne ressemble au suivant ».**
  Le bouton secondaire était la même chaîne de huit utilitaires écrite **onze fois**, sans
  qu'aucune copie sache qu'elle en était une — et un écran neuf en inventait une douzième, un
  peu différente. Six formes sont extraites dans `globals.css` (`.btn`, `.card`, `.tile`,
  `.field`, `.section-title`, `.clamp-2`), **et seulement pour ce qui était déjà répété trois
  fois ou plus**.
- **Ce qui était vraiment moche, et que seule la capture d'écran a montré** :
  1. **`LibraryCard` et `SeriesCard` portaient chacun leur copie du bloc d'affiche, et les
     copies avaient divergé** : la bibliothèque — l'écran le plus personnel du produit —
     affichait **trois rectangles gris « Pas d'affiche »**. Un seul composant `Poster`
     désormais, avec un monogramme qui appartient à la série.
     > **La leçon** : la duplication ne fait aucun bruit tant qu'on ne regarde pas les deux
     > écrans **le même jour**. Le code compilait, les tests passaient, et l'un des deux était
     > laid depuis le début.
  2. **Deux rangées de chrome** empilées : avec le bandeau de sauvegarde, le titre d'une page
     commençait à **270 px du haut**, sur toutes les pages. Une seule ligne désormais.
  3. L'anneau de focus de la recherche était **vert** — la couleur qui signifie « en
     diffusion » partout ailleurs. Et le champ et son bouton étaient deux rectangles séparés,
     donc deux contrôles sans rapport, pour le geste le plus fréquent du produit.
  4. « The Rookie : Le Flic de » coupé net **ne désigne plus aucune série**.
- 🔴 **Et un vrai défaut, trouvé parce qu'on regardait ailleurs** : `/fr/serie/1396` servait un
  synopsis **anglais** en local. `process.env['TMDB_LANGUAGE'] ?? localeTag(locale)` — `??` ne
  retombe que sur `null`/`undefined`, et **une chaîne vide est une valeur**. Or `.env.example`
  porte `TMDB_LANGUAGE=`, donc le `.env` de quiconque part de l'exemple. Invisible en
  production (la variable n'y existe pas), invisible aux tests (la lecture d'environnement
  était enfouie dans une fabrique). D'où `catalogLanguage()`, extraite **pour la seule raison
  qu'elle est testable**.
- ⚠️ **Ce qui reste à regarder à l'œil** : `/amis` et `/moi` en vrai (le navigateur s'est
  déconnecté en fin de session), et **le mobile** — la barre unique a été raisonnée, pas vue.
  La marque s'efface sous 640 px parce que le premier onglet mène au même endroit.
- ⚠️ **Le message du commit `754cc60` est amputé** : des backticks non protégés ont été avalés
  par le shell. Le contenu vit dans les commentaires de `lib/catalog.ts`. *Un message de commit
  se passe désormais par `git commit -F -` et un heredoc.*

## État précédent (2026-08-03, nuit — le lot 6 entier, et deux impasses trouvées en l'exécutant)

- **✅ 6.1 → 6.6 livrés et poussés.** 656 → **716 tests**, typecheck strict vert, build vert,
  **29 routes statiques**. La base répond, le schéma est appliqué, les politiques sont vérifiées.
- ⏳ **La seule chose qui reste, et elle est chez Vercel** : les variables de production
  pointent encore sur un projet Supabase **supprimé**. À coller dans Vercel → Settings →
  Environment Variables, puis redéployer (la CSP est calculée au build) :
  - `NEXT_PUBLIC_SUPABASE_URL=https://eoldfgxgbsczubtfdbza.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xOvt4LMu9DGXRVTigfWvHA_TvUZ4PSc`
- 🔴 **Il y avait DEUX projets Supabase, et personne ne le savait.** La production parlait à
  `voltface` (Sydney), le `.env` local à `cerveau` (us-east-1) — j'ai donc appliqué le schéma
  là où rien ne le lirait, **sans la moindre erreur** : tout était vert des deux côtés.
  Trouvé en lisant l'en-tête `connect-src` de la production, pas le code.
  > **Le garde-fou est désormais exécutable** : `db:push` refuse un projet dont le nom n'est
  > pas celui du produit. Une erreur qui ne produit aucun message doit être rendue bruyante,
  > sinon elle se répète.
- **🇪🇺 Q3 tranché et appliqué** : projet recréé en **eu-west-3 (Paris)**. Sydney a été
  supprimé après vérification qu'il portait **0 compte et 0 journal** — c'était le dernier
  moment où déménager était gratuit.
- 🔴 **Deux impasses dans mon propre SQL, trouvées en le jouant, pas en le relisant** :
  1. `follows` exigeait `can_see(followee)`. Or un profil `followers` n'est visible
     **qu'une fois suivi** — donc personne n'aurait jamais pu suivre personne, et c'est la
     visibilité par défaut. **Le social entier était mort au démarrage.**
  2. Le correctif évident — une sous-requête sur `profiles` — **subit RLS à son tour**. La
     même impasse, déplacée d'un cran, et toujours verte à la lecture. Il fallait une
     fonction `security definer`.
  > **Neuf scénarios rejoués contre la base** en transaction annulée : fil invisible avant
  > le suivi, visible après ; suivre au nom d'un autre, publier au nom d'un autre, publier
  > une date future, prendre un handle réservé, lire le journal d'autrui → tous refusés ;
  > supprimer un compte laisse son nom réservé.
- 🔴 **Un défaut de conception du fil, trouvé à contre-sens.** Il était écrit — et je l'avais
  validé — que « Marie a noté *Breaking Bad* ★★★★ ne révèle rien ». Vrai **au niveau de la
  série**, faux au niveau de la saison : *« a noté la saison 6 ★☆☆☆☆ »* apprend à quelqu'un
  qui en est à la saison 2 qu'il **existe** une saison 6 et qu'elle est mauvaise. C'est le
  spoiler de trajectoire, entré par une autre porte. `redactActivity` **dégrade** le fait au
  lieu de le supprimer — un fil à trous est lui-même un indice — et le caviardage se fait
  **dans le navigateur, avec le journal du lecteur** : le serveur ne sait pas où j'en suis,
  ce qui est précisément ce qui empêche ma position de fuir.
- **Deux autres divergences réparées** : le SQL acceptait le tiret dans un handle et pas le
  domaine ; et `db:push` criait « fonction détournable » sur une fonction correcte, parce que
  Postgres normalise `search_path=''` en `search_path=""`. *Un outil de diagnostic qui ment
  est pire qu'aucun outil* — deuxième fois dans ce dépôt.
- **Ce qui reste ouvert** : 6.5 (le canal de signalement, 5.0b), 6.7 (le design system), et le
  SMTP — le service intégré ne livre qu'aux membres de l'équipe du projet, ce qui suffit pour
  vérifier mais pas pour un premier utilisateur qui ne serait pas Tristan.

## État précédent (2026-08-03, nuit — les comptes et la synchronisation, lot 6)

- **✅ 6.1, 6.2, 6.3 livrés et poussés.** 695 → **706 tests**, typecheck strict vert, build
  vert, **27 routes statiques** — l'authentification n'a rendu **aucune** route dynamique.
- 🔴 **La trouvaille de la session n'est pas du code : le SQL était écrit depuis quatre
  sessions et n'avait jamais été appliqué.** `check-supabase` répondait « la table journals
  n'existe pas ». La cause n'était ni un oubli ni une négligence : **appliquer le schéma
  demandait d'ouvrir une interface, de copier un fichier et de le coller ailleurs.** Une
  étape manuelle placée entre du code écrit et du code qui marche finit par ne pas être faite.
  - ⚠️ **Et le malentendu vaut d'être retenu** : Vercel et Supabase *étaient* bien liés.
    Mais **cette intégration ne synchronise que des variables d'environnement — elle
    n'exécute jamais de SQL.** La liaison était juste ; elle ne pouvait pas créer une table.
  - Réponse : **`npm run db:push`** (`scripts/db-push.mjs`, zéro dépendance). Il applique
    `supabase/*.sql`, **vérifie que `delete_me` est `security definer` AVEC un `search_path`
    fixe** — sans quoi elle est détournable, ce que la clé publique ne peut pas voir —, pose
    les URLs de retour dans les deux langues, et enchaîne sur le diagnostic existant.
  - ⏳ **Une seule action humaine reste, irréductible** : `SUPABASE_ACCESS_TOKEN` dans `.env`
    (https://supabase.com/dashboard/account/tokens). La clé `anon` ne peut pas créer une
    table — c'est exactement ce qui la rend publiable.
- **6.2 — l'authentification** : lien magique + code à six chiffres + Google, pas de mot de
  passe. `@supabase/ssr` refusé (cookie + middleware = une invocation facturée par visite).
  Suppression de compte par fonction `security definer`, donc **aucune `service_role`**.
  - 🔴 **Défaut trouvé en fin de session précédente, et par la mesure seule** : l'import
    dynamique isole le morceau, il ne décide pas **quand** on le demande. `AuthProvider`
    monte sur toutes les pages, donc `/serie/*` téléchargeait **24 Ko gzip** pour un visiteur
    sans compte. Réparé par `hasStoredSession()` — une lecture de `localStorage`.
  - ⚠️ **`@supabase/auth-js` était importé sans être déclaré** : il ne se résolvait que comme
    dépendance transitive de `supabase-js`, dont rien n'utilisait le reste. Corrigé.
- **6.3 — la synchronisation** : `SyncingJournalStore`. `load()` **ne touche jamais au
  réseau** (Q12 vraie par construction). Chaque poussée est une synchro complète — lire,
  fusionner, écrire ce qui change — parce que `POST` remplace la ligne entière. Écriture
  débattue à 2 s, forcée sur `pagehide`. **Mutation vérifiée** : retirer le débat fait tomber
  deux tests.
  - **Une clé de stockage par compte**, sans quoi le refus d'adoption ne veut rien dire : le
    compte se remettrait à lire, écrire et **pousser vers le serveur** le journal de
    quelqu'un d'autre. Et **le refus est mémorisé** — une question qui revient à chaque page
    s'apprend à fermer, et la réponse qui fait disparaître une invitation est « oui ».
  - **La page de confidentialité est réécrite dans le même commit** : elle disait que le
    journal ne quitte pas l'appareil, ce qui devient faux ici. Une politique en retard d'un
    lot est exactement ce que D19 a coûté.
- 🔴 **Ce qui n'est PAS vérifié, et il faut le lire comme un avertissement** : **rien de ces
  deux lots n'a jamais parlé à une base réelle.** Tests verts, build vert, et la table
  n'existe pas. Ce dépôt a déjà livré `episodeMinutes` et `ordering.ts` morts-nés en étant
  verts. **Tâche 6.3bis**, dès que le jeton est là.

## État précédent (2026-08-03, soir — 5.0a, puis une simplification demandée)

- **✂️ Remarque de Tristan, et elle était juste : « tu te perds avec tous tes tests, fais
  simple ».** Elle valait pour le code autant que pour les tests.
  - J'avais écrit **281 lignes de moteur de modération** — file d'attente, tri par urgence,
    machine à états, exposé des motifs, rétablissement — **pour un système qui n'a aucun
    contenu à modérer**. C'est exactement l'erreur que j'avais *refusée* deux heures plus tôt
    pour la table `reports` (« une table qu'on peut remplir avant de savoir traiter un
    signalement est un piège ») : je l'ai appliquée au SQL et pas au domaine.
  - Et une dizaine de tests ne faisaient que **relire le texte que je venais d'écrire dans le
    dictionnaire**. Ils cassent à chaque reformulation et n'ont jamais rien attrapé.
  - **Taillé : 795 → 311 lignes** sur les quatre fichiers concernés, **682 → 656 tests**.
    Rien de ce qui attrapait un défaut n'a été retiré : les mutations vérifiées, la chaîne
    fournisseur → écran, le silence du bandeau, l'échappement des noms TMDB restent.
  > **La règle à appliquer désormais** : *on garde un test si l'on sait nommer le bug qu'il
  > attrape ; on le supprime s'il ne fait que redire le code.* Et le corollaire, plus
  > important : **n'écrire la mécanique qu'au moment où il y a quelque chose à mécaniser.**

## État précédent (2026-08-03, soir — 5.0a : le verrou du social)

- **✅ 5.0a livré — la procédure de modération existe, décidée et publiée.** Choix de Tristan :
  débloquer 5.0 plutôt que polir le profil personnel, et c'est le bon ordre — **un profil que
  personne ne voit n'est pas un profil**, et les cosmétiques d'A6 ne valent que s'ils sont vus.
  **655 → 682 tests**, typecheck strict vert, build vert, 21 → **23 routes statiques**.
  - `src/domain/moderation.ts` (pur) + **`/regles`** et `/fr/regles` — au sitemap, et **en pied
    de page sur toutes les pages** : une voie de signalement introuvable n'en est pas une.
  - **Trois décisions figées, et ce sont elles qui comptent** :
    1. **On masque, on ne supprime jamais.** Supprimer rendrait une erreur irréparable et une
       contestation inexaminable — on ne peut pas rendre ce qu'on a effacé. Et *le premier à se
       tromper sera nous*.
    2. **Tout retrait porte un motif typé, jamais seulement du texte libre.** Ce n'est pas de la
       bureaucratie : une personne seule ne peut pas rédiger une explication sur mesure à chaque
       fois. Un motif typé se **gabarise**, donc l'auteur reçoit toujours une explication, même
       le jour où l'on n'a pas le temps.
    3. **L'auteur peut contester** — *un dispositif qui sait retirer mais pas rendre n'est pas
       de la modération, c'est de la censure*.
    > ⚠️ Ces trois promesses vivent désormais dans le **texte** de `/regles`, pas dans du code :
    > les fonctions qui les portaient ont été retirées le jour même (voir « État actuel »).
  - ✅ **La page ne peut pas mentir sur le code qu'elle décrit** : les motifs viennent de
    `REPORT_GROUNDS`, le délai de `REVIEW_DEADLINE_HOURS`. **Mutation vérifiée : ajouter un
    motif au domaine sans le publier ne compile plus** — le typage l'interdit, ce qui vaut mieux
    qu'un test. Une règle appliquée sans avoir été annoncée est exactement l'arbitraire que
    cette page existe pour empêcher.
  - **`spoiler` est un motif de retrait**, et il fallait y penser : ailleurs c'est une
    impolitesse, ici c'est une atteinte à la promesse centrale (règle 7). L'omettre aurait dit
    qu'on ne le retire pas.
  - **Le délai est 72 h, et c'est un choix de personne seule** : celui qu'on tient en étant
    absent un week-end. Annoncer 24 h serait une promesse qu'un déplacement casse — et une
    promesse de modération non tenue est **vérifiable par celui qui attend**.
  - ⚖️ **Textes à faire relire par quelqu'un dont c'est le métier.** Je ne suis pas une source
    juridique : ce module encode une **procédure**, pas une conformité.
- ⛔ **Deux choses bloquent encore l'ouverture du social, et les deux sont des actions de
  Tristan** :
  1. **`LEGAL_CONTACT_EMAIL` n'est pas renseigné.** Sans adresse, il n'y a nulle part où
     signaler — donc le dispositif n'existe pas. La page le **dit** au lieu d'afficher une
     section muette, mais aucun contenu public ne doit s'ouvrir avant.
  2. **5.0b, le canal** : pas de table `reports` pour l'instant, **délibérément** — même raison
     que `001_journal.sql` refuse les tables sociales « pendant qu'on y est ». Une table qu'on
     peut remplir avant de savoir traiter un signalement est un piège. Le formulaire viendra
     **avec** le contenu.

## État précédent (2026-08-03, soir — l'avertissement des découpages est en ligne)

- **✅ 4.4b livré : le bandeau est câblé et vérifié en production. 639 → 655 tests**,
  typecheck strict vert, build vert, 21 routes statiques. **Poussé, CI verte.**
  - **Vérifié au navigateur sur de vraies séries, pas déduit du code** — `npm run start`,
    vraies réponses TMDB :
    - ***Money Heist*** (`/fr/serie/71446`) : « Ce découpage n'est pas le seul » ·
      « 3 saisons · 41 épisodes » · « **Parts (edited version) — 5 saisons, 48 épisodes** » ·
      « Italian Parts » · « Seasons (edited version) » · « **et 1 autre découpage** » ·
      « Si vous la suivez dans un autre découpage, vos numéros de saison ne correspondent
      pas à ceux-ci. »
    - ***One Piece*** : « et **12 autres découpages** » — le plafond fonctionne.
    - ***Game of Thrones*** et ***The Walking Dead*** : **silence**, comme attendu.
  - **Composants serveur, zéro octet de JS** (`OrderingNotice`, `SeriesOrderings`) : rien ici
    ne dépend du journal, donc le bandeau part dans le HTML mis en cache au bord. C'est la
    différence entre *informer* et *personnaliser*, et elle se paie en kilo-octets.
  - **La formulation est une décision** : le bandeau annonce **la convention suivie**, il ne
    crie pas à l'erreur. Nos chiffres ne sont pas faux — ils suivent l'ordre de diffusion.
    Ce qui serait faux est de laisser croire qu'il n'en existe qu'un.
  - 🔴 **Le maillon que rien ne couvrait, et c'est le trou exact d'`episodeMinutes`.** Ni le
    test du calcul ni celui du composant ne prouvaient que **la page appelle quoi que ce
    soit**. Deux réponses : (a) la partie asynchrone extraite dans `SeriesOrderings`, dont le
    rendu est synchrone — donc `render(await …)` traverse **fournisseur → cache → domaine →
    écran** en une ligne ; (b) un test qui **lit la source de la page**, procédé déjà employé
    ici par `no-hardcoded-strings` et `no-journal-on-server`.
    > **Mutation vérifiée** : retirer `<SeriesOrderings />` de la page fait tomber un test.
    > Sans ce test, la suppression laissait **655 tests verts**.
  - ⚠️ **Défaut latent réparé au passage** : `setProvider` ne vidait que **4 caches sur 7** —
    `creatorCache` et `watchCache` y échappaient depuis leur création. Un double injecté par un
    test pouvait donc recevoir la réponse du **fournisseur précédent**, selon l'ordre
    d'exécution des fichiers. Le pire genre de défaut : il fait passer un test qui devrait
    échouer.
  - ⚠️ **Et une de mes vérifications était fausse** : j'ai d'abord « prouvé » l'absence de
    `'use client'` avec un `grep -c "use client"`, qui comptait les mots **dans mes propres
    commentaires** et renvoyait 1 pour chaque fichier. Vérifié correctement ensuite
    (`^'use client'` → 0). *Une vérification mal ancrée est pire qu'aucune : elle rassure.*

## État précédent (2026-08-03, soir — `episode_groups` livré et vérifié en vrai)

- **🔁 A13 révisé par Tristan : séries seulement pour le moment, pas les films.** ✅ **Rien
  n'est perdu** — le garde-fou 5.10a livré une heure plus tôt **devient l'implémentation de
  cette décision** : `seriesEntries` *est* ce qui garde les films hors des agrégats. Ce qui
  était une préparation devient l'application. `movieKey` / `isMovieKey` restent, testés, à
  coût nul, et documentent la couture pour le jour où ça rebasculera. ✅ Et ça referme sans
  arbitrage la question « un film compte-t-il dans le bilan d'heures ? ».
- **✅ 4.4a livré — `episode_groups`, la vraie trouvaille des rapports. 624 → 639 tests**,
  typecheck strict vert, build vert, 21 routes statiques.
  - `EpisodeGrouping` + `episodeGroups()` sur `CatalogProvider`, `mapEpisodeGroups` (parsing
    tolérant, règle 4), et **`src/domain/ordering.ts`** — pur, il **signale** et ne convertit
    **rien** (règle 8 : réparer en silence déplacerait des notes déjà posées par saison).
  - ✅ **Vérifié contre l'API réelle**, jeton en place. Les fixtures sont des **captures**,
    pas des souvenirs (dette D10, dont la cause était exactement une fixture inventée) :
    - ***Money Heist*** : défaut TMDB **3 saisons / 41 épisodes**, Netflix **5 parts / 48**.
      Donc « il vous reste X épisodes · Y heures » se trompait de **17 %**, et quelqu'un qui
      dit « je suis saison 4 » désigne une saison **qui n'existe pas** dans notre modèle.
    - ***One Piece*** : **18 découpages**, dont Funimation à **−414 épisodes**. Défaut : 23
      saisons dont une de **197 épisodes**.
    - ***Breaking Bad*** : 62 épisodes des deux côtés, **5 saisons contre 6** — l'axe des
      conseils par saison casse même quand les totaux concordent.
  - 🔴 **Faire tourner la vraie chaîne a trouvé deux défauts que les captures ne pouvaient pas
    montrer**, et les deux tests correspondants n'existaient pas :
    1. ***Game of Thrones* était un faux positif** — son unique groupe « Aired Order » compte
       102 épisodes contre 73, mais c'est **l'ordre de diffusion qu'on affiche déjà**, avec les
       spéciaux. D'où `AIRED_ORDER_KIND` exclu.
    2. ***One Piece* sortait 17 découpages divergents** — illisible, et l'anime est justement
       la catégorie qui en a le plus besoin. D'où `MAX_NAMED_ORDERINGS = 3` + un `total`.
    > **La leçon** : mes captures venaient de l'API et étaient justes. C'est le **comportement
    > d'ensemble** sur six séries qui a montré les défauts. *Auditer le résultat, jamais
    > l'intention* — une fixture juste ne dit rien du comportement juste.
  - **Sélectif, vérifié** : sur six séries, **trois se taisent** (GoT, The Walking Dead,
    Stranger Things). Le silence reste majoritaire, comme partout dans ce produit.
  - **Le typage a exigé une ligne dans un double de test** qui n'implémentait pas la nouvelle
    méthode : c'est pourquoi elle vit sur `CatalogProvider` (règle 3) — un fournisseur muet se
    signale à la **compilation**.
- 🔴 **4.4b est la tâche prioritaire, et c'est un piège connu : `ordering.ts` n'est appelé par
  RIEN.** *Une fonctionnalité écrite n'est pas une fonctionnalité qui marche* — `episodeMinutes`
  a été livré mort-né exactement comme ça. Reste : l'enveloppeur dans `lib/catalog.ts` (+1 appel
  par série et par 24 h), le rendu, deux entrées de dictionnaire. Formulation à respecter :
  **« voici la convention que suivent nos chiffres »**, pas « attention erreur ».
- ⚠️ **Jeton TMDB en place dans `.env`** (non suivi par git, vérifié). Il a transité par la
  conversation : **à régénérer sur TMDB** — il est en lecture seule (`api_read`), donc le risque
  est le quota, pas les données.

## État précédent (2026-08-03, soir — le garde-fou des films)

- **✅ 5.10a livré — le garde-fou de A13. 610 → 624 tests**, typecheck strict vert, build vert.
  Fait **sans jeton TMDB** : le domaine est pur, donc il ne dépend ni du réseau ni de l'API.
  - `isSeriesKey` / `isMovieKey` / `movieKey` / `seriesEntries` dans `journal.ts`, et les
    **quatre** agrégats bordés — `calendar`, `library`, `tally`, `taste`.
  - **La décision de conception à ne pas défaire** : `isSeriesKey` teste l'**absence de
    qualificatif** dans l'espace d'identifiants, et non `!isMovieKey`. Le jour où un
    `tmdb-book:` apparaît (le concurrent Achriom fait déjà du multi-média), il sera **exclu**
    des agrégats de séries au lieu d'y être compté avec des saisons absentes.
    > **Le garde-fou doit échouer vers l'exclusion : omettre n'est qu'un oubli, inclure
    > corrompt.** Et personne n'aura à penser à mettre la fonction à jour.
  - 🔴 **Il a attrapé un quatrième faux négatif de fixture, dans mes propres tests.**
    `setSnapshot` ignore une entrée qui n'existe pas encore — un instantané s'*attache* à un
    geste, il ne le crée pas. Mon fixture appelait `setSnapshot` **avant** le geste : aucun
    instantané n'était écrit, **ni pour la série ni pour le film**, et les quatre tests
    d'égalité passaient en comparant deux agrégats **vides**.
    > **La leçon** : une égalité ne prouve rien tant qu'on n'a pas montré qu'il y avait quelque
    > chose à fausser. D'où le `describe` d'**ancrage**, qui exige d'abord un agrégat non vide.
  - **Trois mutations vérifiées** au lieu de faire confiance au vert : filtre retiré → 5 tests
    tombent ; `isSeriesKey` remplacé par le réflexe `!isMovieKey` → 1 tombe.
  - ⚠️ **Et le typage a rattrapé ce que l'exécution laissait passer** : `setPosition` prend deux
    nombres et non un objet, `'watching'` n'est pas un `DecisionKind`. `vitest` ne typecheck
    pas — c'est `npm run check` qui l'a vu. Raison de plus de ne jamais committer sans.
- ⚠️ **`TMDB_ACCESS_TOKEN` toujours vide** (D18) : Tristan n'est pas devant son PC. **4.4
  `episode_groups`** et **5.11 multi-pays** attendent, ce sont les deux seules tâches qui exigent
  l'API réelle. Le jeton ne doit **pas** passer par la conversation (règle 5).
- **🟢 Prochaine tâche : 5.10b, les fonctionnalités film** — fiche film, espace `tmdb-movie` dans
  `CatalogProvider`. ⚠️ Et **une décision de produit non tranchée** : un film doit-il compter
  dans le bilan d'heures ? Ça ferait passer « heures de séries » à « heures d'écran ».
  **À ne pas décider en silence.**

## État précédent (2026-08-03, soir — convergence, lot 5 trié, trois décisions)

- **✅ Trois décisions de Tristan sur le lot 5, dont deux qui corrigent mon analyse.**
  - ✅ **5.18 — l'accueil montrera des critiques.** J'objectais que le corpus de textes ne
    s'amorce pas. **Réponse : les premiers utilisateurs seront sa famille.** L'objection tombe —
    **mon raisonnement supposait un lancement à des inconnus**, et je n'avais pas demandé qui
    arrivait en premier. ⚠️ Le risque n'est pas annulé, il est **déplacé** au passage au public.
    D'où la seule contrainte gardée : **« un accueil qui se remplit »** — les données dérivées
    portent l'écran, les critiques viennent par-dessus. Le même écran marche à 5 et à 50 000,
    sans réécriture.
    > **La leçon, et elle est gênante** : c'est exactement le reproche que je faisais aux deux
    > rapports Gemini — « aucun ne demande qui arrive, et par où ». **La même erreur, commise en
    > la dénonçant.**
  - ✅ **5.11 — la disponibilité multi-pays sera une option dans les paramètres.** Converge avec
    la recommandation : on ne détecte pas le VPN (traçage + peu fiable), **on laisse choisir ses
    pays**. ⚠️ La liste de pays est une **préférence**, donc elle vit dans le journal — elle doit
    suivre d'un appareil à l'autre.
  - ✅ **5.20 — scrobbling par notre propre extension de navigateur** (non prioritaire, mais à
    prendre en compte). **Et c'est moins cher que ce que j'avais chiffré** : une extension que
    nous signons écrit par le **chemin de synchronisation existant** (Supabase + RLS), donc
    **aucune route serveur nouvelle** — contrairement au webhook Plex que j'avais évalué. Et ce
    produit n'a besoin que de **la position**, un champ : un ordre de grandeur plus simple que
    Simkl.
    > **La leçon** : *le coût d'une mise en œuvre n'est pas le coût du besoin.* J'avais chiffré
    > le webhook, conclu « trop cher », et pas examiné l'autre voie.
    - ⚠️ **Le coût réel est ailleurs** : un second produit à distribuer (Chrome Web Store 5 $,
      Manifest V3) ; **les sites de streaming changent leur DOM en permanence**, donc l'extension
      casse en silence — charge **récurrente**, pas coût de construction ; et **bureau
      uniquement**, donc pas là où l'essentiel du streaming se regarde.
    - ⚠️ **Point de confiance** : la permission dira « lire vos données sur netflix.com ». Sur un
      produit qui promet l'absence de traçage, c'est **strictement opt-in**, et la donnée ne va
      **que** dans le journal de la personne.
    - ✅ Construire notre extension **contourne** D15 (Trakt) au lieu de le heurter.
  - ⏳ **A4 — le domaine `voltface` sera enregistré en fin de projet** (choix de Tristan, pas sa
    priorité). Le risque reste connu : c'est ainsi que `seasoned` a été perdu.
- ⚠️ **`TMDB_ACCESS_TOKEN` (D18) : le jeton ne doit PAS passer par la conversation** —
  `AGENTS.md` règle 5 interdit un secret dans un journal, et un message en est un. `.env` est
  ignoré par git et non suivi (vérifié) : Tristan y colle la valeur, l'agent vérifie l'effet
  sans jamais voir le secret. Débloque 4.4 et 5.11.

## État précédent (2026-08-03, soir — convergence, et le lot 5 trié)

- **✅ Tout est poussé** (`c919a64..4c11706`) — 4 commits, CI déclenchée. `main` propre.
- **🎬 A13 tranché par Tristan : suivi complet des films.** **Contraire à ma recommandation**
  (« les listes acceptent les films, le produit ne les suit pas »), actée — comme A1 et A7,
  mes objections deviennent le cahier des charges. Ce qui reste vrai de l'objection : un film
  n'a ni saison, ni position, ni trajectoire, donc **aucun** des quatre différenciateurs ne s'y
  applique. **La conséquence n'est pas de refuser, c'est de ne pas prétendre** — une fiche film
  doit être honnêtement sobre.
  - ✅ **Aucune migration de journal**, trouvé en vérifiant : la clé est `<espace>:<id>` et
    `parseJournalKey` coupe au **premier** `:`. Les séries gardent `tmdb:1396` **inchangé**,
    les films prennent un espace neuf. Le préfixe identifiait déjà l'**espace
    d'identifiants** — et c'est exact, chez TMDB le film 550 et la série 550 sont deux objets.
  - 🔴 **Le vrai risque n'est pas les types : quatre modules parcourent `journal.entries` en
    supposant des saisons** — `calendar`, `library`, `tally`, `taste`. *(⚠️ J'avais écrit
    « huit » : c'était faux, et vérifié depuis. Les six autres — `remaining`, `trajectory`,
    `entry-point`, `catch-up`, `current-season`, `nudge` — reçoivent une série en argument et
    ne parcourent rien.)* Un film non filtré ne plante pas — il **empoisonne
    silencieusement chaque agrégat** — et le typage ne dira rien, puisqu'une clé reste une chaîne.
    > **Donc l'ordre est : border les quatre modules d'abord, écrire la première entrée film
    > ensuite.** L'inverse produit des chiffres faux dont on ne saura pas depuis quand.
  - **Bénéfice inattendu** : un film **a une durée**, donc il compte légitimement dans le bilan
    d'heures. Le seul endroit où les films renforcent un différenciateur au lieu de le diluer.
- **🎯 Lot 5 : les idées de Tristan triées** (parité Serializd, VPN, quiz, scrobbling) —
  **`docs/IDEES-TRIEES.md`**. Rien n'est écarté : tout est soit déjà fait (huit items), soit
  chiffré, soit rangé derrière son prérequis. Et le prérequis n'est presque jamais technique,
  c'est **5.0 la modération**.
  - 🔴 **Le VPN : la question était bonne, la méthode non.** Détecter un VPN exige d'inspecter
    l'IP côté serveur — donc du **traçage**, ce qui casse l'argument qui rend A6 cohérent — et
    c'est peu fiable. Or `/watch/providers` renvoie **tous les pays d'un coup**, dans l'appel
    qu'on fait déjà. **On ne devine pas l'utilisateur, on le laisse choisir ses pays.** Même
    forme que le `.ics` et que le `VALARM` à 9 h locales : *la solution qui n'a pas besoin de
    l'information vaut mieux que celle qui va la chercher.*
  - 🔴 **Le quiz personnel est la meilleure idée de la liste.** « Quelle série avez-vous vue le
    7 janvier ? » se calcule sur le **journal local** : zéro serveur, zéro compte, zéro
    modération, hors ligne, et **structurellement incopiable** — il faut *votre* journal.
  - ⚠️ **Les quiz publics ont deux pièges** : le **spoiler** (« devine d'après les notes par
    épisode » révèle une trajectoire, et `spoiler.ts` existe pour ça) et la **triche** (toute
    réponse est dans l'API TMDB, donc un classement exige un score calculé côté serveur).
  - ⛔ **L'écran d'accueil fait de critiques contredit une décision fondatrice** : le corpus de
    textes ne s'amorce pas, donc une page doit valoir le détour **avec zéro critique**. Un tel
    accueil est vide le premier jour. À reformuler en « accueil qui se remplit ».
  - **Changer l'affiche** (la feature la plus aimée de Serializd) se fait **sans upload** : on
    choisit parmi les images que TMDB porte déjà. Même ruse que A12.
  - ⚠️ **Compteurs « 0 vu · 0 critique » : mieux vaut se taire que compter zéro.** Le vrai
    sujet du social n'est pas la modération, c'est le démarrage à froid.
  - **Scrobbling, 3ᵉ demande : question d'ordre, pas de principe.** Deux faits nouveaux —
    **Serializd n'a aucun scrobbling** et c'est lui qui occupe la place ; et D17 fait qu'un
    planificateur serveur existera de toute façon, donc le coût marginal baisse **après**.
    D15 (Trakt) reste fermé.

## État précédent (2026-08-03, soir — convergence de deux rapports externes)

- **🔀 Deux rapports Gemini confrontés au dépôt. Verdict : on ne refait rien** — et le
  raisonnement est vérifiable, pas affaire de goût. Analyse complète :
  **`docs/CONVERGENCE-RAPPORTS.md`**. **610 tests verts**, typecheck strict vert.
  - **L'inversion à retenir, parce qu'elle est dans les rapports eux-mêmes** : les deux
    ouvrent sur « TV Time est mort avec 26,4 M d'installations » et concluent « donc la place
    est libre ». Mais 26,4 M d'installations **sont** la demande — il est mort parce que son
    coût par utilisateur ne se monétisait pas. Or leurs recommandations sont presque
    intégralement une liste de coûts par utilisateur (Kafka, Redis, push, hébergement de GIF,
    modération de médias, sync Plex, apps tablette).
    > **Les rapports prescrivent en détail la cause de mort du cas qu'ils citent en ouverture.**
  - Retire ce qui est (a) impossible ici, (b) **déjà livré** — sept de leurs recommandations
    « indispensables » le sont —, (c) un coût par utilisateur : il reste **trois** éléments,
    tous petits. Ce que les rapports apportent de plus utile n'est pas une feature, c'est la
    **confirmation externe** que le diagnostic de `RESEARCH.md` est bon, par quelqu'un qui ne
    l'avait pas lu.
- **🔴 A11 — la contrainte « aucune application native » était FAUSSE, et c'est le résultat le
  plus important de la session.** `AGENTS.md` observait « pas de Mac, pas de Xcode » (vrai) et
  en concluait « aucune application native » (faux). Le contre-exemple était dans la phrase :
  `Limits` a produit un **IPA en Release** depuis ce PC, en CI, sur un runner macOS hébergé.
  Il n'a **jamais** buté sur le build — il a buté sur le **sideload sans compte développeur**.
  Les quatre arguments alignés par `ROADMAP.md` §1.1 (*sans compte* · *sans signature* · *sans
  magasin* · *sans le cycle de sept jours*) décrivent **tous** les conséquences du *free
  provisioning*, aucun celles du natif.
  - **Tranché par Tristan : natif iOS + Android.** Le mur était **~99 $/an + 25 $**, pas une
    impossibilité matérielle. Corrigé dans `AGENTS.md`, `ROADMAP.md` §1.1 et `app/manifest.ts`.
  - ⛔ **D16 : l'achat intégré Apple ponctionne A6** (15–30 %). A6 a été tranché *le matin
    même*, sans Apple dans l'équation — **à rechiffrer**. Bloque la tâche 4.8.
  - ⚠️ **D17 : le natif rend le push obligatoire** (un webview nu se fait refuser, règle 4.2),
    et le push ramène le planificateur serveur, donc le coût par utilisateur.
  - **Le web reste premier**, mais pour la bonne raison : une application n'a pas de SEO, donc
    le natif est un canal de **rétention**, pas d'acquisition. Et `src/domain/` n'important
    **rien**, la règle 2 — écrite pour la testabilité — se révèle être de la **portabilité**.
  > **La leçon** : *auditer le résultat, jamais l'intention* — **y compris celui de sa propre
  > documentation**. « Pas de Mac » est un fait ; « donc pas de natif » est une **inférence**,
  > restée écrite comme un fait et marquée « non négociable » dans le fichier que tous les
  > agents lisent en premier. **Une contrainte fausse dans une source de vérité coûte plus
  > cher qu'une contrainte absente : elle est crue, et personne ne la revérifie.**
- **🔴 Le calendrier déposait un pense-bête muet.** `calendar.ts` écrivait des `VEVENT` et
  **aucun** `VALARM` : les dates arrivaient dans l'agenda et **rien ne sonnait**. La promesse
  de son propre en-tête — « le rappel arrive même si l'on n'a pas rouvert le site depuis un
  mois » — était fausse. **12 → 20 tests.**
  - **Le déclencheur est positif (`PT9H`)** et ça ressemble à une faute : sur un événement de
    journée entière `DTSTART` vaut minuit, donc `-PT1H` sonnerait **à 23 h la veille** —
    exactement le rappel nocturne que le choix de la journée entière évitait. Et un
    `DTSTART;VALUE=DATE` n'ayant pas de fuseau, le même fichier sonne à 9 h **locales**
    partout, **sans que nous sachions où est qui**.
  - **Deux mutations vérifiées** plutôt que crues : retirer le `VALARM` fait tomber 5 tests,
    inverser le signe en fait tomber 1.
  > **La leçon** : les 12 tests d'origine vérifiaient tous la **conformité** du fichier, aucun
  > son **effet**. Un `.ics` valide qui ne rappelle rien passe toutes les vérifications qu'on
  > avait pensé à écrire. Le défaut a été trouvé **en confrontant, pas en relisant**.
- **Trois arbitrages tranchés, un en attente** (`TASKS.md`, tableau des arbitrages) :
  - ✅ **A11** natif iOS/Android (ci-dessus) ;
  - ✅ **A12** médias riches : **sélecteur d'un catalogue tiers + copie proxifiée, jamais
    d'upload**. Le *hotlink* est écarté parce que **Tenor appartient à Google** : chaque
    affichage enverrait IP + referer, ce qui casse « pas de publicité donc pas de traçage » —
    l'argument même qui rend A6 cohérent. ⛔ Livraison après 5.0 (modération).
    🔴 **Ma première objection était fausse** : ce n'est pas le GIF qui crée l'obligation DSA,
    c'est la couche sociale, texte compris. Ce que le GIF change est le **plafond de nuisance**.
  - 🟡 **A13 — le produit suit-il les films ? EN ATTENTE DE TRISTAN.** Le seul arbitrage de la
    session qui touche `src/domain/types.ts`, donc le seul qu'il vaut mieux ne pas prendre en
    retard. Ma reco : **les listes acceptent les films, le produit ne les suit pas** — un film
    n'a ni saison, ni position, ni trajectoire, donc **aucun** des quatre différenciateurs ne
    s'y applique, et on se mesurerait à Letterboxd sur son seul terrain imbattable.
    Explication en clair : `docs/CONVERGENCE-RAPPORTS.md` §1.
- **Trois choses fermées avec un chiffre**, à ne pas rouvrir sans fait nouveau :
  - **Kafka / Redis** : le mécanisme d'effondrement décrit (contention de lignes chaudes) **ne
    peut pas se produire** — `user_id uuid primary key`, chaque compte écrit sa propre ligne.
    Structurel, pas « pas encore assez d'utilisateurs ». Et **le projet a déjà le motif
    write-behind, en mieux et pour 0 €** : le tampon est `localStorage`, chez l'utilisateur.
    Le vrai axe est **Q8 / tâche 4.5** (octets par écriture), pas le débit.
  - **Scrobbling par webhooks** : exigerait la **première route serveur** du projet (zéro
    aujourd'hui), un jeton par utilisateur, la `service_role`.
  - **D15 — Trakt** : 🔴 j'avais recommandé de le lire comme source de position ;
    **l'enquête dit non.** Un compte gratuit ne connecte qu'**une seule** application externe,
    donc quelqu'un ayant déjà branché son scrobbler Plex — la population visée — **ne peut pas
    brancher VOLTFACE**. VIP à 60 $/an, usage commercial soumis à approbation.
- **🔴 `episode_groups` — la vraie trouvaille des rapports, tâche 4.4 (libre).** Zéro occurrence
  dans le dépôt. Chez un tracker un mauvais ordre d'épisodes = une case mal cochée, **visible**.
  Ici l'ordre est **l'entrée de tous les calculs** (`trajectory`, `entry-point`, point d'arrêt,
  `remaining`, `tally`) : le produit rendrait un conseil **faux avec assurance** et **rien ne le
  montrerait**. Réponse = règle 8, **signaler d'abord** ; le sélecteur d'ordre seulement si
  l'avertissement se révèle fréquent.
  - ⚠️ **D18 : `TMDB_ACCESS_TOKEN` est vide dans `.env`** — `episode_groups` n'a été vérifié
    qu'**en documentation**, jamais contre une réponse réelle. C'est le prérequis de 4.4 (D10).
- ⚠️ **La dérive D14 s'était reformée** : `CLAUDE.md` annonçait 562 tests, il y en avait 602
  avant cette session. Remis à 610.
- ⚠️ **Sept commits non poussés** (4 antérieurs + 3 de cette session). Un push est un
  déploiement public — décision de Tristan.

## État précédent (2026-08-03, soir — la navigation par faces)

- **💰 A6 tranché : freemium cosmétique** (référence Riot Games). Le seul modèle qui ne
  contredise **aucune** promesse déjà faite — pas de paywall sur les statistiques, pas de
  publicité donc pas de traçage, pas d'affiliation donc « où regarder » reste factuel. Et
  les cosmétiques étant produits par nous, ils n'ajoutent **aucune** charge de modération.
  > **La règle : on vend l'apparence, jamais la réponse.**
  - ⛔ **D6 est désormais active** : le freemium **est** un usage commercial de TMDB, qui
    exige un **accord écrit**. Action de Tristan, **avant la première vente**.
  - ⚠️ **Le revenu ne peut pas précéder le social.** Chez Riot, le cosmétique vaut parce
    qu'il est **vu** ; ici les profils sont `followers` par défaut. Le meilleur véhicule est
    `ShareCard`, qui sort du produit et se voit par des non-utilisateurs.
- **🧭 La navigation par faces est livrée** — `/`, `/moi`, `/calendrier`, `/bilan`. **562
  tests**, 19 routes statiques. **Quatre faces et pas six** : *Mes amis* et *Les listes*
  n'ont aucun contenu sans comptes, et une barre dont un tiers mène à « bientôt » apprend à
  ne plus cliquer dessus. Le logo garde ses six faces.
  - **Le calendrier a enfin un écran.** `calendar.ts` existait avec 12 tests et ne servait
    qu'à fabriquer un `.ics` : il fallait télécharger un fichier et ouvrir une autre
    application pour lire ce que le produit avait déjà calculé.
  - **Le bilan quitte `/moi`** : `/moi` dit *où j'en suis*, `/bilan` dit *qui je suis*.
  - ⚠️ **Trois défauts trouvés en câblant** : `themeColor` resté sur l'ancien fond, le lien
    « Ma bibliothèque » en double avec la barre, et l'export `.ics` présent sur les deux
    écrans.
    > **La leçon** : une navigation neuve ne s'ajoute pas, elle **remplace**. Tout chemin qui
    > menait déjà quelque part est à re-examiner, sinon on livre deux vérités concurrentes.

## État précédent (2026-08-03, après-midi)

- **🏷️ A4 tranché : le produit s'appelle `VOLTFACE`.** Dernier arbitrage bloquant avant un
  lancement public, ouvert depuis cinq sessions. **Volte-face = un revirement d'opinion** —
  c'est la promesse même du produit, et le seul nom de la liste qui la dise. Il porte aussi
  la direction artistique choisie (**volt** : cyberpunk, éclairs) et le logo (**face** : le
  cube). Libre au RDAP en `.tv`, `.app`, `.io` et `.dev` ; `.com` enregistré mais mort.
  - ⚠️ **Le domaine n'est pas enregistré — action de Tristan.** Un nom tranché et non
    réservé est exactement ainsi que `seasoned` a été perdu.
  - ⚠️ **Le code, les métadonnées et le dictionnaire disent encore « seasoned » partout.**
    Le renommage n'est pas fait et n'est pas trivial : `lib/site.ts`, les métadonnées, le
    manifeste PWA, le JSON-LD, les deux dictionnaires, le dépôt GitHub, le projet Vercel.
- **🎨 Direction prise (2026-08-03) : passer d'une page à une application.** Onglets,
  comptes, social, DA **cyberpunk**, logo en **cube 3D** aux faces colorées (fabriqué
  ailleurs — ne pas s'en occuper). Animation : **le cube se déplie en patron, les faces
  deviennent les onglets.** Livré : le renommage, la DA, et `docs/ARCHITECTURE-APP.md`.
  - **La DA est posée sur le châssis, jamais sur les vignettes** — « l'affiche est
    l'interface » reste la règle. Aucune police chargée (`font-src 'self'`) : le caractère
    vient de la **grille monospace appliquée aux chiffres**, qui sont le différenciateur.
  - **Le renommage n'était pas mécanique.** Trois chaînes désignaient des données déjà
    écrites chez l'utilisateur. Règle appliquée : **on migre ce qu'on contrôle, on ne touche
    pas à ce qui est parti ailleurs** — clé du journal migrée (avec relecture indéfinie de
    l'ancienne), UID des `.ics` **inchangé** (le changer créerait des doublons dans un agenda
    qu'on ne peut pas réparer).
  - ⚠️ **`connect-src 'self'` devra s'ouvrir vers Supabase.** Cette ligne rendait
    « rien ne sort de ce navigateur » **vérifiable** ; après, c'est une déclaration. Le texte
    de l'interface devra être réécrit, pas conservé.
  - ⚠️ **Le prérequis n'est pas l'argent, c'est la modération** (5.0, ⛔ bloquant). Ça
    démarre gratuitement — Supabase et Vercel offrent de quoi. Le DSA, non.
  - **✅ Q4 tranché (2026-08-03) : tout le monde a un compte, mais on circule d'abord.**
    Les six faces sont libres ; **le compte est demandé au premier geste** — et le geste
    **s'applique avant** l'invitation (« gardé sur cet appareil, créez un compte pour le
    retrouver ailleurs »). Ça évite par construction le défaut classique du modèle, le geste
    perdu pendant l'inscription, **sans écrire une ligne de « geste en attente »** : le
    journal local est déjà le tampon, et `mergeJournals` fait la montée.
    - ⚠️ **Le RGPD devient un prérequis de mise en ligne**, pas une finition : le premier
      compte crée une donnée personnelle.
    - ⚠️ **Jamais de fusion silencieuse à la connexion.** Sur un appareil partagé, elle
      verserait le journal du propriétaire dans le compte du visiteur. On demande, et le
      défaut est **non**.
  - **Toutes les questions d'architecture sont tranchées** (`ARCHITECTURE-APP.md` §7),
    et huit nouvelles ont été trouvées en cherchant les failles des premières. Les plus
    coûteuses si ratées :
    - **Q1 — trois états de visibilité, pas deux.** `followers` par défaut : le fil marche
      dès le premier suivi, mais l'indexation et l'inconnu restent fermés. Un profil public
      par défaut irait contre la protection par défaut du RGPD (⚖️ à confirmer).
    - **Q7 — les handles réservés doivent exister *avant* la première inscription.** Un
      handle attribué ne se retire pas sans casser une URL, et `@admin` ou `@moi` entrerait
      en collision avec une route.
    - **Q9 — `activity` purgée à 90 jours**, le même horizon que les traces de suppression :
      un chiffre qui s'accorde à un existant plutôt qu'un seuil inventé.
    - **Q12 — si la base tombe, le produit continue.** Bénéfice inattendu du local-first, à
      annoncer comme une fonctionnalité.
  - **Correction actée : le fil d'activité des amis ne spoile pas.** J'avais affirmé le
    contraire ; c'était surdimensionné. « Marie a noté *Breaking Bad* ★★★★ » ne révèle rien,
    et le nombre de saisons est public. Ce qui spoile est plus étroit : **les titres
    d'épisodes** et **les agrégats calculés**. Le fil remonte donc de la place 5 à la 4.

- **⏱️ Bilan personnel livré — et trois défauts de la même famille trouvés en le posant.**
  508 → **546 tests verts**, typecheck strict vert, build vert, 13 routes `○ Static`.
  **+1,38 Ko gzip** sur `/moi`. ⚠️ **Quatre commits non poussés** : un push est un
  déploiement public, décision de Tristan.
  - **`src/domain/tally.ts`** — « au moins 537 heures — 22 jours et 9 h ». Le
    différenciateur du produit (le temps chiffré) retourné vers soi, là où ces
    statistiques sont **payantes** chez Letterboxd. Le calcul se fait dans le navigateur :
    être gratuit y est structurel, pas généreux.
  - **La décision de conception : ne jamais compter deux fois.** `setDecision` n'efface pas
    la position, donc « passages achevés + position » compterait la dernière saison en
    double sur **toute** série finie. La position ne compte que si elle est **postérieure**
    au dernier passage — c'est l'usage pour lequel la v2 a rendu la date obligatoire sur
    chaque fait, deux sessions avant qu'on en ait besoin.
  - **Le chiffre s'annonce comme un minorant, et le prouve** : « au moins », plus le nombre
    de séries non comptables, plus un **silence** sous 50 % de couverture ou sous une heure.
  - 🔴 **Trois défauts, tous invisibles au typage** :
    1. **`episodeMinutes` n'était jamais écrit** — prop *à côté* de `series`, pas dedans.
       La feature livrée le matin même était **morte-née**.
    2. **`freshSnapshot` jetait la forme des séries à trente jours**, donc le bilan aurait
       ignoré les séries **terminées** — celles qui y pèsent le plus.
    3. **`isFresh` ne comparait pas les champs neufs**, rendant leur écriture invisible 24 h.
    > **La leçon** : *un champ qui existe n'est pas un champ qui est écrit.* Et la
    > vérification au navigateur **ne pouvait pas** le voir — le journal de test, écrit à la
    > main, portait déjà la valeur qu'on croyait écrire. **Troisième faux négatif de
    > fixture**, dans sa variante la plus retorse. Seul un test qui lit `localStorage`
    > **après** le rendu regarde l'écriture elle-même.
  - ⚠️ **Réserve sur la mesure** : les 207 Ko que je mesure ne sont **pas** comparables aux
    166 Ko du 2026-08-02 (méthodes différentes). Seuls les deltas le sont, et ils
    concordent. À réconcilier avant de citer un absolu.

## État précédent (2026-08-03, matin)

- **🔁 Rewatch livré — journal v3, la quatrième décision irréparable.** Le journal ne
  connaissait aucune notion de revisionnage : la position étant un pointeur unique,
  recommencer une série **écrasait** la progression précédente. Une **liste de dates**
  (donc un ensemble : union commutative, associative, idempotente par construction),
  dédupliquée **par jour** — sinon « vu 4 fois » compterait des synchronisations. La
  **série-refuge** en découle : le trait de goût le plus difficile à falsifier.
  - ⚠️ **`episodeMinutes` ajouté à l'instantané dans la foulée** : sans lui, aucun bilan
    de temps passé n'est calculable ailleurs que sur la page série, et **le manque serait
    rétroactif** (`/moi` ne fait aucun appel). Même règle que le rewatch — ce qu'on
    n'enregistre pas aujourd'hui manque pour toujours.
  - **Vérifié au navigateur sur un journal v2 réel**, migration comprise. La première
    vérification n'a rien prouvé : fixture aux instantanés expirés et trop peu de séries
    notées. *Se méfier de sa propre vérification* — deuxième faux négatif de ce genre.


- **✅ Tout est en ligne et vérifié en production (2026-08-03).** 26 commits poussés,
  CI verte, déploiement passé. **La faille XSS n'est plus en ligne.** Vérifié sur
  https://seasoned-two.vercel.app, pas déduit du code : `hreflang` réciproques et
  auto-référents sur les pages série (**dette ouverte depuis trois sessions, levée**),
  cache `HIT`, cinq en-têtes de sécurité, `robots.txt` couvrant les deux langues,
  sitemap à 107 URLs / 214 alternates, `lang` correct sur les 8 routes testées.
  - **`TMDB_LANGUAGE` : rien à faire, la variable n'est pas définie chez Vercel.**
    ⚠️ J'avais affirmé le contraire le matin même — c'était une sur-interprétation, le
    code alors déployé était antérieur à la bascule A10 et `DEFAULT_LOCALE` y valait
    encore `fr`. Détail et leçon dans `TASKS.md`.
  - **Les features vues sur de vraies séries** : BoJack Horseman « ça décolle à S1E8 »
    (la source citée en écrivant la proposition disait *exactement* cet épisode — c'est
    une concordance externe), Star Trek TNG S1E5 + décrochage S6, House of the Dragon
    « saison 3, 0,6 sous la moyenne ». Le silence reste majoritaire, comme annoncé.
- **Session du matin : les trois features de `NEXT-FIVE` qui se calculent sans un seul
  utilisateur.** 436 → **486 tests verts**, typecheck strict vert, build vert, 13 routes
  `○ Static`. Trois commits.
  - **F1 point d'entrée** (`entry-point.ts`) — « ça commence vraiment à S1E8 ». Le
    symétrique du point d'arrêt, et **le biais de survie joue en sa faveur** : ceux qui
    notent l'épisode 3 incluent tous ceux qui ont abandonné après.
  - **F4 plan de rattrapage** (`catch-up.ts`) — le chiffre qui compte est le **temps**, pas
    le nombre d'épisodes. Les plans intenables sont annoncés aussi.
  - **F2 verdict de la saison en cours** (`current-season.ts`) — se tait la plupart du
    temps, et son **placement dépend de la position** (règle 7).
  - **Coût mesuré : +0,3 Ko gzip et zéro appel réseau.** Les modules sont importés
    `import type` par la couche client : le calcul reste serveur.
  - **Deux trouvailles d'audit** : une borne manquante (`MAX_ENTRY_FRACTION` *grandit avec
    la série* — 8 M d'opérations sur *Detective Conan*, et un « conseil » de passer
    300 épisodes), et surtout **un test creux** — six tests de placement restaient verts
    quand on supprimait le code qu'ils surveillaient.
    > **La leçon** : sur un composant dont l'état arrive de façon asynchrone,
    > `findByText` puis une assertion **ne prouve rien**. Il faut attendre la condition
    > finale elle-même.
  - **Cinq nouvelles propositions** : `docs/NEXT-FIVE-2.md`. ⚠️ **Letterboxd bloque
    l'accès automatisé** (403 sur `/talk/` et `/about/suggestions/`, domaine refusé par le
    navigateur), Reddit aussi — les sources sont donc autres et le document le dit.

## État précédent (2026-08-03, nuit)

- **Session du 2026-08-03 : le filet, la langue, cinq gestes, et un audit qui a trouvé une
  faille.** 306 → **436 tests verts**, typecheck strict vert, build vert, 13 routes
  `○ Static`. Quatre commits — détail et suites dans `TASKS.md`.
  - **🔴 Une XSS réelle**, dans le JSON-LD des pages série. `JSON.stringify` **n'échappe
    pas `<`** : un titre TMDB valant `</script><script>…` refermait la balise et faisait
    exécuter la suite, sur toutes les pages servies depuis le cache de bord, avec accès au
    journal dans `localStorage`. Réparé par `lib/jsonld.ts`.
    > **La leçon** : les titres viennent de contributeurs TMDB. Au sens de la sécurité,
    > c'est une **entrée non fiable**. Le parsing tolérant (`AGENTS.md` règle 4) protège du
    > **mal formé**, pas du **malveillant** — et le premier a masqué le second tout le projet.
  - **La langue du catalogue ne suivait pas la page** — quatrième occurrence de la forme
    d'échec du projet. Le commentaire disait la règle, le code lisait `TMDB_LANGUAGE`, une
    variable **globale** valant `fr-FR` : les pages **anglaises**, celles que les moteurs
    indexent, servaient des synopsis français. Corrigé par un fournisseur par langue **et
    la locale dans la clé de cache** — sans quoi la première visite fixe la langue pour
    toutes les suivantes, selon qui arrive en premier.
  - **1.61 le harnais de composants** (deux projets vitest ; le domaine reste sous `node`,
    pour qu'une violation de la règle 2 ne puisse pas passer inaperçue) et **1.59 l'i18n
    des 18 modules client** — six défauts trouvés dans des fichiers marqués ✅, dont le
    `StatusBadge` anglais sur les pages françaises et **tous** les liens internes en dur.
    > **La leçon de la bascule se prolonge** : il ne suffit pas qu'une langue ait une
    > adresse, il faut que **les chemins y restent**.
  - **Vague A** : `remaining.ts` (« il vous reste 15 épisodes · 11 h 15 »), `nudge.ts`
    (le rappel de noter la saison finie), `calendar.ts` (`.ics` — le rappel que quelqu'un
    d'autre paie), `import.ts` + `/convertir` (**aucun format tiers connu nommément** :
    écrire un lecteur « Trakt » de mémoire serait la dette D10, TV Time a fermé et on ne
    peut plus en obtenir d'export).
  - **Mesuré, pas supposé** : **162 Ko gzip** sur `/`, 166 sur `/moi` — D13 refermée, la
    couche des gestes coûte ~4 Ko. En-têtes de sécurité posés (CSP **sans nonce**, assumé :
    un nonce impose un rendu par requête, donc détruit le cache).
  - **Cinq features proposées** : `docs/NEXT-FIVE.md`. ⚠️ **Reddit est bloqué dans cet
    environnement** (recherche et navigateur) — les sources sont donc autres, et le dire
    fait partie du travail.

## État précédent (2026-08-01)

- **🌍 A9 tranché par Tristan (2026-08-02) : le produit vise l'international.** Ce n'est pas
  un élargissement, c'est le **multiplicateur du seul canal qui marche à froid** — une page
  en français ne capte pas « is X worth watching ». Et le projet est bien placé : le
  différenciateur est **language-agnostic** (statut, temps écoulé, trajectoire, abandons se
  calculent sans langue ; `src/domain/` est muet et doit le rester — rien de `lib/i18n.ts`
  n'y est importé). Conséquences : le social **structuré** devient encore plus juste (un jeu
  fermé de réactions s'agrège mondialement, le texte libre fragmente par langue) ; ⚠️ **le
  coût catalogue est multiplié par le nombre de langues** ; la négociation par en-tête
  n'existe pas sur une page statique, donc la langue se décide à la construction ou côté
  client. **A10 tranché : `en` par défaut** (2026-08-02). Sur un site statique, « par
  défaut » n'est pas une préférence : c'est la langue de la page que les moteurs indexent.
  Livré : `lib/i18n.ts` (dictionnaire typé sur le français, donc clé manquante = erreur de
  compilation ; pluriel par `Intl.PluralRules` parce que le désaccord commence à **zéro** —
  « 0 jour » contre « 0 days »), `lib/format.ts` internationalisé **en premier parce que
  c'est lui qui est indexé**, plus le layout, l'accueil, la page série, les métadonnées et
  la langue du catalogue.
  > ✅ **Réparé le 2026-08-02 (1.60)** : `/` en anglais, `/fr` en français. Deux décisions
  > contre-intuitives, motivées dans `lib/routes.ts` — **l'anglais n'a pas de préfixe**
  > (préfixer casserait toutes les URL déjà indexées) et **aucune redirection selon
  > `Accept-Language`** (un middleware s'exécute à chaque requête et casse le cache donc le
  > budget ; Googlebot explore depuis les États-Unis et ne verrait jamais le français ;
  > et atterrir dans une autre langue que le lien cliqué est un bug).
  > La leçon reste : **changer un défaut ne suffit pas à servir une alternative — il faut
  > d'abord qu'elle ait une adresse.**
- **⚠️ Un `lang` qui ment, trouvé par la vérification et par elle seule.** Typage vert,
  306 tests verts, build vert — et `/fr` servait du français en s'annonçant `lang="en"`.
  Une page ne porte qu'un seul `<html>` ; il vivait dans une disposition racine unique qui
  écrivait la langue par défaut en dur. Réparé par **deux dispositions racines**
  (`app/(site)`, `app/(fr)`) de trois lignes chacune, tout le commun étant dans
  `app/components/SiteChrome.tsx`.
  > **Troisième occurrence de la même forme d'échec** — après le SEO en cul-de-sac et le
  > cache inopérant. La règle ne bouge pas : **auditer le résultat, jamais l'intention.**
  > ⚠️ Reste à vérifier **en production** : les `hreflang` des pages série n'ont pas pu être
  > observés en local (catalogue indisponible, la page servait son repli).
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
  **276 tests verts** (2026-08-02).
- **⚠️ Deux défauts de fusion corrigés le 2026-08-02, avant qu'il existe deux appareils**
  (`TASKS.md` lot 0). Ils étaient invisibles à un seul appareil et corrompaient
  silencieusement les données dès qu'il y en aurait eu deux :
  1. `laterOf` départageait les dates **égales** par l'ordre des arguments, donc
     `merge(a,b) ≠ merge(b,a)` : deux appareils fusionnant la même paire dans leur propre
     ordre divergeaient et se renvoyaient indéfiniment des journaux différents.
  2. Un fait sans date lisible recevait l'horloge de **celui qui lit** — deux appareils
     lisant le même journal donnaient au même fait deux dates. Repli passé à l'epoch ;
     l'horloge de lecture ne sert plus qu'à l'**expiration**.
  > **La leçon** : les deux se composaient. Un import donne la même date de repli à
  > beaucoup de faits, donc fabrique en masse les ex aequo que le premier défaut traitait
  > mal. Et surtout : `tests/journal.test.ts` couvrait la fusion par 410 lignes
  > d'**exemples** sans jamais rejouer une paire dans l'autre sens. **Un exemple prouve un
  > cas, une loi prouve la classe** — d'où `tests/journal-merge.test.ts`.
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

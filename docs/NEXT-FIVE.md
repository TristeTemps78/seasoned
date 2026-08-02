# Les cinq prochaines — propositions argumentées (2026-08-03)

> Écrit à la demande de Tristan, en fin de session. **Ce sont des propositions, pas des
> décisions** : rien n'est engagé tant qu'il n'a pas tranché, comme A1, A7, A8 et A9.

## ⚠️ D'où viennent les sources, et ce que je n'ai pas pu consulter

La demande était de regarder « le Reddit de Letterboxd, dans la boîte à idées ».
**Reddit est bloqué dans cet environnement** — par l'outil de recherche (`reddit.com`
inaccessible à l'agent) comme par le navigateur (« blocked by policy »). Je le dis plutôt
que de présenter des idées inventées comme si elles venaient d'un fil de discussion.

Sources réellement consultées, toutes de seconde main sauf la première :

| Source | Nature |
|---|---|
| [TVmaze wishlist megathread](https://www.tvmaze.com/threads/3266/tvmaze-wishlist-megathread?page=4) | **Première main** : une boîte à idées d'utilisateurs de tracker TV |
| [Achriom — TV Time alternatives](https://www.achriom.com/blog/best-tv-tracking-apps/) | Synthèse des manques des concurrents |
| [Moviebase — TV Time alternatives](https://moviebase.app/resources/tv-time-alternatives) | Idem, autre angle |
| [Letterboxd (Wikipedia)](https://en.wikipedia.org/wiki/Letterboxd) | Confirme que les séries sont promises et non livrées |

Trois constats en ressortent, et ils commandent les propositions :

1. **« Trakt suit la consommation, mais n'aide pas à comprendre son goût. »** Le manque
   n'est pas un tracker de plus : c'est du **sens**.
2. **La communauté de réactions par épisode est ce que les orphelins de TV Time
   regrettent le plus**, et personne ne l'a reprise.
3. **La peur d'être enfermé** est devenue un critère de choix explicite : « si cette
   application disparaît aussi, pourrez-vous emporter vos données ? »

---

## 1. Le point d'entrée — « ça commence vraiment à S1E8 »

**Le symétrique exact du point d'arrêt, et il manque.**

Le produit sait déjà dire « arrêtez-vous après la saison 6 ». Il ne sait pas dire l'inverse,
qui est pourtant **la question la plus posée sur une série** : *does it get better?* Les
recherches remontent constamment cette formulation — « la première saison était une épreuve
de dévotion », *BoJack Horseman* qui « devient un chef-d'œuvre vers l'épisode 8 de la
saison 1 *».

| | |
|---|---|
| **Ce qui existe déjà** | `episodeRatings()` charge les notes par épisode, **et la page les affiche déjà**. Zéro appel de plus. |
| **Ce qu'il faut écrire** | Un module pur, ~80 lignes, symétrique de `stopPointAdvice` |
| **Coût par utilisateur** | **Zéro** — dérivé de données déjà en cache |
| **Valeur SEO** | Très élevée : *« does X get better »*, *« when does X get good »* sont des requêtes de volume, **language-agnostic**, et sans réponse chiffrée nulle part |

> **Le renversement qui rend cette feature meilleure que le point d'arrêt.** Le biais de
> survie (dette ⚠️ de `TASKS.md`) ruine les points d'arrêt : ceux qui ont vu la saison 6 de
> *Dexter* sont ceux qui ont persévéré, et ils la notent bien. **Sur le début d'une série,
> le biais joue dans l'autre sens** — ceux qui notent l'épisode 3 incluent tous ceux qui ont
> abandonné après. La note du début est donc *plus honnête* que celle de la fin.
>
> Autrement dit : la donnée la moins fiable du produit devient la plus fiable dès qu'on la
> lit par l'autre bout. C'est la même correction asymétrique que `SINGLE_SAMPLE_FACTOR`.

**Garde-fou obligatoire** : le même seuil de portée que le point d'arrêt. « Ça démarre à
l'épisode 2 » n'est pas un conseil, c'est du bruit. À n'afficher que si le décollage est
tardif *et* net.

---

## 2. Le verdict de la saison en cours — pendant qu'elle passe

**Le seul moment où la question se pose, et le seul où personne ne répond.**

Quand une saison est en cours de diffusion, aucun média ne dit encore si elle tient : les
critiques sortent au lancement, les rétrospectives des mois après. Or le produit possède,
chaque semaine, les notes des épisodes déjà sortis — et la moyenne historique de la série.

> *« Saison 5, 4 épisodes sur 10 diffusés : notés 0,6 sous la moyenne de la série. »*

| | |
|---|---|
| **Ce qui existe déjà** | `episodeRatings`, `publicTrajectory`, `deriveStatus` (statut `airing`) |
| **Ce qu'il faut écrire** | Un comparateur pur : saison partielle contre référence historique |
| **Coût** | **Zéro** appel supplémentaire ; la page est déjà en ISR quotidien |
| **Effet produit** | C'est **une raison de revenir chaque semaine** sans notification, sur les séries en cours — donc exactement le trou d'engagement D9, attaqué par le contenu au lieu du rappel |

⚠️ **Le piège, et il est sérieux.** Sur trois épisodes, un écart de 0,3 est du bruit. Ce
module doit refuser de parler en dessous d'un nombre d'épisodes ET d'un écart minimal —
c'est la leçon des trois passes de `computeTrajectory` : *un instrument taillé pour des
notes humaines ne s'applique pas à des moyennes de foule.* Mieux vaut se taire quatre
semaines sur cinq.

---

## 3. Les réactions structurées — le seul héritage de TV Time que personne n'a repris

**C'est ce que les orphelins regrettent le plus, et le format est déjà tranché.**

Les deux sources le disent séparément : *« si la communauté de réactions par épisode était
ce que vous aimiez dans TV Time, ce manque comptera »*. Aucun concurrent ne l'a repris —
Serializd a des critiques (texte long), Trakt a des notes, personne n'a **la réaction d'un
épisode**.

Et A9 a déjà tranché la forme : **un jeu fermé de réactions**, jamais du texte libre.

> Le texte libre fragmente par langue et rend la modération multilingue ingérable pour une
> personne seule. Un jeu fermé de six réactions s'agrège **mondialement** et se traduit une
> fois. **L'international rend ce choix plus juste, pas plus difficile.**

| | |
|---|---|
| **Ce qui existe déjà** | La grille d'épisodes cliquable — l'endroit est construit, il attend son geste |
| **Prérequis** | Le premier stockage serveur du projet (Supabase, phase 2) |
| **Modération** | **Aucune** — on ne peut pas être injurieux avec un jeu fermé de six icônes. C'est ce qui fait tomber le prérequis bloquant 5.0 (DSA) pour cette feature-là, et pour elle seule |
| **Coût** | Lecture **gratuite** (compteurs figés dans l'ISR), écriture rare et payée à l'acte. C'est l'inverse du modèle qui a tué TV Time |

> **Le vrai argument** : c'est la première brique qui rend les pages **non reproductibles
> par scraping** (`ROADMAP.md` phase 3). Aujourd'hui, tout ce que le site affiche est
> dérivable de TMDB par n'importe qui. Une réaction agrégée, non.

---

## 4. Le plan de rattrapage — « 14 épisodes en 12 jours »

**Le chiffre du produit, appliqué à une échéance.**

Le produit sait maintenant dire ce qu'il reste (A4) et connaît la date du prochain épisode.
Croiser les deux donne quelque chose que personne n'affiche :

> *« Il vous reste 14 épisodes et 12 jours avant la saison 3 : 1,2 épisode par jour. »*

| | |
|---|---|
| **Ce qui existe déjà** | `remainingAfter()` (livré cette nuit), `nextEpisodeAt` dans le journal, `buildCalendar()` |
| **Ce qu'il faut écrire** | Une dizaine de lignes de domaine pur |
| **Coût** | **Zéro** — tout est déjà dans le navigateur, `/moi` ne fait aucun appel |

C'est la feature la moins chère des cinq et probablement la plus partagée : elle transforme
une bibliothèque en **plan**, et elle ne demande ni compte, ni serveur, ni permission.
Elle prolonge naturellement le calendrier `.ics` : celui-ci dit *quand*, celle-là dit
*à quel rythme*.

---

## 5. La carte des abandons — la seule donnée que personne d'autre ne peut avoir

**« 38 % des gens qui commencent cette série s'arrêtent en saison 2. »**

Tout ce que le site affiche aujourd'hui est dérivable de TMDB par n'importe qui. Ceci ne
l'est pas — et ne le sera jamais, parce que **la décision d'abandon est une donnée que
seuls nous demandons** (`decision.kind = 'abandoned'`, dans le journal depuis le premier
jour, et déjà agrégée par série dans `taste.ts` pour soi-même).

| | |
|---|---|
| **Ce qui existe déjà** | La décision est un objet de plein droit dans le modèle, avec sa saison |
| **Prérequis** | Des utilisateurs, et le stockage serveur — c'est la plus lointaine des cinq |
| **Effet** | Elle résout **le biais de survie**, la limite consignée et non résolue du produit : les notes publiques ne retrouvent pas les effondrements dont tout le monde parle, parce que ceux qui sont partis ne notent plus. **L'abandon, lui, est exactement le signal de ceux qui sont partis.** |

> C'est la feature qui justifie l'existence du produit à long terme. Les quatre autres
> rendent les pages meilleures ; celle-ci les rend **impossibles à copier**.

---

## Comment je les ordonnerais, et pourquoi

| Ordre | Feature | Motif |
|---|---|---|
| **1** | Point d'entrée (§1) | Zéro coût, données déjà chargées, et la requête SEO la plus fréquente du domaine. **Rentable dès demain, sans un seul utilisateur.** |
| **2** | Plan de rattrapage (§4) | Une dizaine de lignes, pur, aucune dépendance |
| **3** | Saison en cours (§2) | Attaque D9 par le contenu, mais demande de la prudence statistique |
| **4** | Réactions structurées (§3) | Premier vrai fossé — et déclenche la phase 2 (comptes, Supabase) |
| **5** | Carte des abandons (§5) | Le fossé définitif, mais il faut des utilisateurs d'abord |

**Le fil qui les relie** : les trois premières se calculent **sans un seul utilisateur**,
donc elles nourrissent le SEO, qui est le seul canal qui fonctionne à froid. Les deux
dernières ne valent que *grâce* aux utilisateurs — elles sont ce que le SEO doit financer.
C'est l'ordre imposé par `ROADMAP.md` §0.1, et il n'a pas bougé.

**Ce qu'aucune des cinq ne fait, volontairement** : de la recommandation algorithmique
(bannie, `ROADMAP.md` §3), du texte libre (ingérable en modération multilingue), et du
cross-média (le manque le plus cité par les articles — et hors sujet : la thèse du produit
est que *la série n'est pas un long film*, donc en faire un catalogue de tout la dissoudrait).

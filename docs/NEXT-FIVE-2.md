# Les cinq suivantes — seconde vague (2026-08-03, matin)

> Suite de `docs/NEXT-FIVE.md`, dont **trois propositions sur cinq sont livrées** ce matin
> (point d'entrée, plan de rattrapage, verdict de saison en cours). Les deux restantes —
> réactions structurées, carte des abandons — **ne sont pas annulées** : elles demandent
> des utilisateurs, donc elles viennent après. Elles restent au menu.
>
> **Ce sont des propositions, pas des décisions.**

## ⚠️ La boîte à idées Letterboxd n'est pas consultable depuis ici

La demande était de vérifier dans la boîte à idées de Letterboxd. **Letterboxd bloque
l'accès automatisé** : `letterboxd.com/talk/` et `letterboxd.com/about/suggestions/`
répondent **403 Forbidden** au récupérateur, et le navigateur intégré refuse le domaine.
Reddit reste bloqué également (constaté à la session précédente).

Je le dis plutôt que d'habiller des idées inventées d'une source que je n'ai pas lue.

**Ce que j'ai pu établir, et qui suffit**, parce que le signal est convergent :

| Constat | Source |
|---|---|
| **Les statistiques personnelles sont derrière le paywall** Letterboxd (Pro/Patron) — y compris « most rewatched » | [Letterboxd sur X](https://x.com/letterboxd/status/1778982330620883367), [AlternativeTo](https://alternativeto.net/software/letterboxd/about) |
| **Des outils tiers existent pour combler ce trou** — `letterboxdstats.app`, `watchboxd` sur GitHub | [watchboxd](https://github.com/ExcuseMeImJack/watchboxd) |
| Letterboxd **investit** dans les stats : « Stats for Lists » est une sortie récente et mise en avant | [Letterboxd Journal](https://letterboxd.com/journal/hit-list-new-stats-for-lists-feature/) |
| Letterboxd va vers **la décision** et plus seulement l'archive : showtimes déployés fin 2025 | [TechCrunch](https://techcrunch.com/2025/11/20/letterboxd-to-launch-new-movie-rental-feature-in-december) |
| **Le « comfort rewatching » est un phénomène documenté**, et les trackers TV commencent à le suivre | [Comfort television](https://en.wikipedia.org/wiki/Comfort_television), [TV Show Tracker](https://www.tvshowtracker.eu/features/favorites-rewatch) |
| « Les statistiques m'ont bluffé — je ne savais pas que je regardais autant de SF » | [Hobi — best tracker apps](https://hobiapp.com/blog/best-tv-show-tracker-apps) |

> **La lecture qui commande les cinq propositions** : la demande la plus forte de cet
> écosystème est **l'analyse de soi par ses propres données**. Elle est payante chez le
> leader, et suffisamment frustrée pour que des gens écrivent leurs propres outils. Or
> chez nous ce calcul est **gratuit par construction** — il se fait dans le navigateur, sur
> des données qui n'ont jamais quitté l'appareil.

---

## 1. Le rewatch, et la série-refuge — ✅ **livré le 2026-08-03**

**Ce n'est pas une feature, c'est un trou dans le modèle — et il se referme mal.**

Le journal ne connaît **aucune** notion de revisionnage. La position est un pointeur
unique : quelqu'un qui recommence *The Office* pour la troisième fois **écrase** sa
progression précédente. Le produit ne perd pas seulement une statistique, il perd le fait.

Or le rewatch n'est pas un détail d'usage :

> **C'est le seul comportement qui distingue une série aimée d'une série finie.** Une note
> de 5 étoiles posée une fois et un troisième visionnage disent deux choses différentes ;
> la seconde est bien plus difficile à falsifier.

| | |
|---|---|
| **Ce qui existe** | Le journal, ses dates par fait, sa fusion multi-appareils |
| **Ce qu'il faut** | Une **version 3** du journal : la position devient une liste de passages |
| **⚠️ Urgence** | C'est **irréparable après coup**, exactement comme les trois décisions de la v2 (`journal.ts`) : les visionnages passés qu'on n'a pas enregistrés ne se devinent pas. Le bon moment est **maintenant**, tant qu'il y a peu de journaux à préserver |
| **Coût** | Zéro serveur. Un champ de plus, et `mergeJournals` sait déjà fusionner des listes datées |

**Ce que ça débloque** : « votre série-refuge », le nombre de passages, et surtout la
question que personne ne sait poser — *est-ce qu'elle tient au revisionnage ?* La note de
la deuxième vision contre celle de la première est une donnée **que personne n'a**.

---

## 2. Les pages-listes calculées — le plus gros levier SEO restant

**« Les séries qui démarrent lentement », chiffré, avec l'épisode exact.**

Le produit vient d'acquérir trois calculs que personne d'autre ne publie : point d'entrée,
point d'arrêt, trajectoire. Ils ne servent aujourd'hui **qu'à la page de la série qu'on
cherchait déjà**. Or ce sont exactement les réponses à des recherches par *intention* :

- *« TV shows that get better after season 1 »*
- *« shows worth finishing »* / *« shows that fall off »*
- *« short series to binge »*

| | |
|---|---|
| **Ce qui existe** | `findEntryPoint`, `stopPointAdvice`, `computeTrajectory`, et les listes de découverte déjà chargées pour l'accueil |
| **Ce qu'il faut** | Une route `/listes/[slug]`, en ISR quotidien comme le reste |
| **Coût** | Quelques appels **par jour**, partagés avec l'accueil et le sitemap. Pas un appel par visiteur |
| **Bonus** | Elles **referment le maillage interne** : chaque liste pointe vingt pages série, et chaque page série peut pointer sa liste |

> **Pourquoi c'est plus fort qu'un article de blog** : ces listes sont **recalculées** et
> datées. « Mise à jour le 3 août » sur une liste qu'un rédacteur humain aurait écrite une
> fois en 2019. Et elles sont **language-agnostic** : le classement est identique dans
> toutes les langues, seuls les libellés changent.

⚠️ **Le garde-fou** : ne publier que les listes où les chiffres tiennent. Une liste
« séries qui démarrent lentement » qui contient trois séries parce que les seuils sont
stricts est une bonne liste ; la remplir en abaissant les seuils serait recommencer la
faute que `trajectory.ts` a coûté trois passes.

---

## 3. Le comparateur — « j'hésite entre ces deux-là »

**Une intention de recherche massive, et le produit a déjà toutes les données.**

*« X vs Y »* est l'une des formulations les plus courantes du domaine, et aucune réponse
existante n'est chiffrée : les articles comparent des goûts, pas des engagements.

> Deux colonnes : ce qu'elle demande (heures), où elle en est, si elle a une fin, où elle
> décroche, et — le seul qui compte vraiment — **combien de temps vous y laissez**.

| | |
|---|---|
| **Ce qui existe** | Absolument tout : `getSeriesPageData` deux fois |
| **Ce qu'il faut** | Une route `/comparer/[a]-[b]`, `force-static` comme les pages série |
| **Coût** | Le double d'une page série, **une fois par jour et par paire visitée**. Les paires improbables ne sont jamais rendues |
| **⚠️ Piège** | Le nombre de paires est **quadratique**. Il faut refuser d'être exploré : `robots.txt` doit interdire l'exploration systématique et ne laisser au sitemap que les paires réellement demandées, sinon on invite un moteur à parcourir un espace infini — et on paie le rendu de chaque page |

---

## 4. Le bilan personnel, gratuit — ce que le leader fait payer

**« Vous avez passé 47 jours devant des séries. »**

C'est la promesse d'origine du produit — *l'engagement chiffré* — retournée vers soi. Le
produit sait déjà le calculer : positions dans le journal, durée médiane par série. Il ne
le fait pour personne.

| | |
|---|---|
| **Ce qui existe** | `TasteCard` (le goût), `remaining.ts` (le temps), le journal |
| **Ce qu'il faut** | Un module pur de plus, et une section dans `/moi` |
| **Coût** | **Zéro** — calcul dans le navigateur, aucune donnée ne sort |
| **Positionnement** | Les statistiques équivalentes sont **payantes** chez Letterboxd, au point que des tiers écrivent des outils pour les remplacer. Les offrir n'est pas une générosité : c'est le seul endroit où être gratuit est un **argument structurel**, parce que chez nous le calcul ne coûte rien à personne |

**Et c'est le meilleur candidat viral du produit.** La leçon du « Top 4 » de Letterboxd est
que la contrainte fait le partage : un chiffre, une image, rien d'autre. `ShareCard` sait
déjà dessiner sur un canvas côté client, sans serveur et sans facture par partage.

---

## 5. Le mode soirée — « 45 minutes, chez moi, maintenant »

**La seule question qu'on se pose vraiment devant un écran, et à laquelle rien ne répond.**

Le produit connaît trois choses que personne ne réunit : où vous en êtes, **à quoi vous
êtes abonné** (`MyPlatforms`), et combien dure un épisode. La question du soir n'est pas
« que regarder ? » — c'est *« qu'est-ce que je peux finir avant de dormir, sur un service
que j'ai déjà ? »*

| | |
|---|---|
| **Ce qui existe** | `MyPlatforms`, le journal, les durées médianes, `WatchOptions` |
| **Ce qu'il faut** | Un filtre sur la bibliothèque : temps disponible → ce qui rentre |
| **Coût** | **Zéro**, entièrement client, hors ligne compris |
| **⚠️ La ligne à ne pas franchir** | Ce n'est **pas** de la recommandation : on ne suggère rien qui ne soit déjà dans votre bibliothèque, et on ne classe pas par goût supposé. On filtre ce que vous avez déjà choisi. La recommandation algorithmique reste bannie (`ROADMAP.md` §3) et cette feature ne l'entrouvre pas |

---

## L'ordre que je recommande, et pourquoi

| Ordre | Feature | Motif |
|---|---|---|
| ~~1~~ | ~~**Rewatch (§1)**~~ | ✅ **Livré** — journal v3, série-refuge, 20 tests. Voir `TASKS.md` |
| **2** | **Pages-listes (§2)** | Le plus gros levier SEO restant, sur des calculs déjà écrits, et il referme le maillage interne |
| **3** | **Bilan personnel (§4)** | Zéro coût, fort en partage, et positionnement direct contre un paywall |
| **4** | **Comparateur (§3)** | Excellent rapport valeur/effort, mais demande de traiter l'explosion quadratique avant d'ouvrir |
| **5** | **Mode soirée (§5)** | Le plus petit, à faire quand la bibliothèque sera assez remplie pour qu'un filtre ait du sens |

**Le fil** : §1 protège une donnée qu'on est en train de perdre, §2 amène du monde, §3 et §4
transforment les visiteurs en utilisateurs, §5 les fait revenir le soir. Et **aucune ne
demande de serveur** — seule la §2 ajoute quelques appels quotidiens, partagés.

**Ce qu'aucune ne fait, toujours volontairement** : de la recommandation algorithmique, du
texte libre, du social sans dispositif de modération (`TASKS.md` 5.0 reste bloquant).

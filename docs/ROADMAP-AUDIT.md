# ROADMAP-AUDIT.md — contre-expertise du plan

> Rédigé immédiatement après `ROADMAP.md`, le 2026-07-31, avec pour consigne explicite de
> penser **à contre-courant**. Ce document cherche les raisons pour lesquelles le plan est
> mauvais, pas celles pour lesquelles il est bon.
>
> Réserve méthodologique honnête, à laquelle il faut donner son poids : **c'est le même agent
> qui a écrit le plan et qui l'audite ici.** C'est le motif « rédacteur = relecteur » que les
> règles du dossier interdisent explicitement. Cet audit vaut donc comme travail préparatoire
> et liste de questions — **pas comme validation**.

---

## 1. Les trois objections qui portent sur la viabilité même

### 1.1 La fenêtre d'acquisition est déjà refermée

Le plan s'appuie implicitement sur la mort de TV Time comme opportunité. Regardons le
calendrier honnêtement :

```
 02 juil.  annonce de la fermeture
 02 juil.  TVmaze ouvre son importeur
 09 juil.  JustWatch ouvre le sien ; Hobi devient « partenaire officiel de migration »
 15 juil.  TV Time ferme — 26 M de personnes doivent choisir
 …
 31 juil.  ce document
```

**Nous arrivons seize jours après la fermeture, et vingt-neuf jours après que les
concurrents ont ouvert leurs portes.** Les gens qui allaient migrer ont migré. Le seul
événement d'acquisition massive de la décennie dans ce domaine s'est produit pendant que ce
projet n'existait pas.

Conséquence directe : **la phase 4 (import TV Time) a perdu l'essentiel de sa valeur.** Elle
reste utile — les fichiers d'export dorment dans des dossiers de téléchargement, et une
partie des gens n'a rien choisi — mais elle n'est plus un levier d'acquisition. La traiter
comme tel serait se raconter une histoire.

*Ce que ça ne change pas* : l'export intégral reste non négociable, pour la raison morale
donnée dans le plan.

### 1.2 L'économie de ce marché est démontrée impossible, pas seulement difficile

C'est l'objection la plus lourde et le plan la traite trop poliment.

**TV Time avait 26,4 millions d'installations et est mort en disant : pas soutenable en
gratuit, pas assez de demande pour du payant.**

Ce n'est pas un accident de gestion, c'est un résultat expérimental produit par l'acteur qui
avait le plus de données du secteur. Aucun raisonnement du plan n'explique pourquoi ce
projet-ci échapperait à ce constat. « Nous aurons un coût marginal plus faible » est vrai et
insuffisant : le problème de TV Time n'était pas le coût, c'était le **revenu par
utilisateur, qui tend vers zéro parce que la valeur perçue tend vers zéro.**

L'objection au plan est donc : *si le but est d'avoir des utilisateurs, c'est un plan pour
perdre de l'argent proportionnellement au succès.* Il faut le dire avant, pas après.

Contre-argument admis : Letterboxd survit sur le même marché adjacent, parce qu'il vend de
l'identité et non un utilitaire. Mais Letterboxd a mis **quinze ans** et a été racheté pour
y arriver, avec un corpus qu'on ne peut pas répliquer. Ce n'est pas un contre-exemple
transposable à un projet solo.

### 1.3 Le seul actif défendable est précisément celui qu'on ne peut pas amorcer

Le plan affirme que le corpus (les textes) est le seul fossé durable. C'est juste. Il
n'affirme pas la conséquence, qui est brutale :

> **Un site de critiques sans critiques n'est pas « un site avec peu de contenu ».
> C'est un site vide, et un site vide est activement décourageant.**

Le problème du démarrage à froid est ici plus dur qu'ailleurs, parce que la valeur perçue
d'une page série est presque entièrement produite par les autres utilisateurs. Le premier
arrivant voit une page vide, ne revient pas, et n'écrit donc rien pour le deuxième.

Aucune phase du plan ne traite ce problème. C'est son défaut principal — plus grave que
n'importe quel choix technique, parce qu'un choix technique se corrige.

---

## 2. L'angle mort du modèle de notation : le spoiler

**Ceci n'apparaît nulle part dans `RATING-MODEL.md` et invalide partiellement son
architecture sociale.**

Sur Letterboxd, l'état d'un utilisateur vis-à-vis d'une œuvre est **binaire** : vu, ou pas
vu. Il y a une case « cette critique contient des spoilers », et elle suffit.

Pour une série, **l'état est un point sur un axe**. L'utilisateur est *au milieu*. Et alors :

- une critique de la saison 5 spoile la saison 4 ;
- une note affichée en baisse à la saison 6 est déjà une information sur l'intrigue ;
- la simple existence d'une saison 7 dit que les personnages principaux survivent ;
- **la trajectoire elle-même — la signature visuelle du produit — est un spoiler** : montrer
  que la courbe s'effondre en saison 5 est une information que quelqu'un en saison 2 n'a pas
  demandée ;
- le « point d'arrêt recommandé », qui est le cœur de la proposition de valeur, dit à
  quelqu'un qui commence qu'il va être déçu, et quand.

**Conséquence** : tout affichage social doit être filtré par la position de l'utilisateur.
Ce n'est pas une préférence d'interface, c'est une contrainte structurelle qui traverse
chaque requête, chaque page et chaque agrégat. Coût réel, jamais anticipé par les produits
existants.

**Retournement** : c'est aussi le meilleur candidat comme véritable fossé technique du
projet. Un affichage conscient de la position est difficile à ajouter après coup — pour
Letterboxd comme pour n'importe qui — parce qu'il faut avoir modélisé la position dès le
départ. Le plan la modélise en phase 2. C'est une chance, pas un mérite.

**Action** : le principe « rien qui dépasse ma position sans un geste explicite » doit entrer
dans `RATING-MODEL.md` comme contrainte de niveau 1, avant toute écriture de schéma.

---

## 3. Attaque sur la thèse : « les quatre territoires défendables » sont surestimés

Le plan appelle « défendables » quatre choses qui sont en réalité des **différenciateurs**,
pas des **fossés**. La distinction est fondamentale.

Un fossé est ce qu'un concurrent ne peut pas copier même en le voulant. Or :

| Territoire annoncé | Copiable par Letterboxd en… |
|---|---|
| La trajectoire | quelques semaines — c'est un graphique sur des données qu'ils auront |
| Le suivi en cours | quelques mois — c'est un pointeur |
| L'abandon comme donnée | quelques semaines — c'est un champ |
| « Ça vaut 40 heures ? » | quelques semaines — c'est une question dans un formulaire |

**Aucun des quatre n'est un fossé.** Ils ont tous la même faiblesse : ce sont des
fonctionnalités, et une fonctionnalité se copie. La seule chose non copiable reste le corpus
et la communauté — c'est-à-dire, encore une fois, exactement ce dont on ne dispose pas.

Cela n'annule pas leur intérêt : un différenciateur suffit à exister, à être remarqué, à
donner une raison de venir. Mais le plan doit cesser d'appeler ça une défense.

---

## 4. Attaques sur les choix techniques

### 4.1 « Web d'abord » — l'objection sérieuse

Le tracking de séries est un geste **mobile et du soir** : on est sur un canapé, l'épisode
vient de se finir. Letterboxd et Serializd sont d'abord des applications mobiles, et ce n'est
pas un accident.

Ce qu'une PWA perd réellement sur iOS : la découverte par l'App Store (nulle), les
notifications fiables, le widget, l'intégration au partage système, et le simple fait
d'exister sur un écran d'accueil sans une manipulation que 90 % des gens ne connaissent pas.

**Le contre-argument tient quand même**, et pour une raison qui n'est pas technique : ici,
l'alternative au web n'est pas « une application native ». C'est **rien du tout**. La preuve
est dans le dossier voisin — `Limits` est terminé, testé, et n'a jamais tourné sur un
téléphone. Livrer un produit web imparfait bat un produit natif parfait qui ne s'installe
pas. Le choix est maintenu, mais pour ce motif-là, pas pour ses qualités propres.

### 4.2 Le risque réel, moins visible : construire ce qui est amusant

Le plan consacre cinq phases à du code. La difficulté du projet n'est pas le code — le socle
technique décrit ici représente quelques semaines pour un agent, et c'est la partie
**facile**.

La partie difficile est : *obtenir que des gens écrivent quelque chose.* Zéro ligne du plan
n'y est consacrée.

C'est le mode d'échec classique des projets de ce genre, et il est d'autant plus probable ici
que l'environnement de travail rend le code peu coûteux à produire. **Facilité de production
et importance ne sont pas corrélées ; ici elles sont inversement corrélées.**

### 4.3 Un trou d'engagement de trois mois, créé par le modèle lui-même

Objection contre `RATING-MODEL.md`, que je n'avais pas vue en l'écrivant.

Si l'unité canonique est la saison, alors pour une série diffusée en hebdomadaire, **le
produit ne reçoit un jugement qu'une fois tous les trois mois.** Entre-temps, l'utilisateur
n'a rien à y faire sauf déplacer un pointeur.

Un produit avec lequel on interagit significativement quatre fois par an n'existe pas dans
l'esprit des gens. C'est exactement le régime dans lequel Letterboxd **n'est pas** (on voit
plusieurs films par mois, chacun produisant une entrée complète).

Le binge atténue le problème — une saison Netflix avalée en un week-end fait coïncider
l'événement et la saison, ce qui *renforce* le modèle. Mais la diffusion hebdomadaire est
revenue en force chez tous les diffuseurs, et le modèle y est structurellement pauvre.

**Piste, non tranchée** : les « épisodes marquants » (couche 2) sont la seule chose qui
puisse combler ce trou, puisqu'ils s'émettent en cours de saison. Ils sont classés comme
optionnels et secondaires dans le modèle. Il faudrait peut-être inverser cette hiérarchie —
non pas parce que l'épisode est la bonne unité de jugement, mais parce que c'est la bonne
unité de **rythme**. Ce sont deux choses différentes, et le modèle les confond.

### 4.4 Le vrai concurrent n'est ni Serializd ni Letterboxd

C'est **l'inertie**. La grande majorité des gens qui regardent des séries n'enregistrent
rien, nulle part, et n'ont jamais envisagé de le faire. Le marché adressable réel n'est pas
« les gens qui regardent des séries », c'est « les gens qui tiennent déjà un journal de
quelque chose » — une population beaucoup plus petite, déjà servie, et déjà répartie entre
Trakt, Simkl, Serializd et les tableurs.

Positionner le produit contre Serializd, c'est se battre pour une part d'un très petit
gâteau. Le plan ne le dit nulle part.

---

## 5. Le coût caché que personne n'anticipe : la modération

Un produit social public hébergeant du contenu utilisateur, accessible depuis l'Union
européenne, entraîne des obligations au titre du **DSA** : mécanisme de signalement, procédure
de retrait, information des utilisateurs, points de contact. `[cadre général — à faire
vérifier, je ne suis pas une source juridique]`

Au-delà du droit, il y a le fait pratique : **un espace de commentaires public sur un projet
tenu par une personne seule est une charge permanente**, et une charge qui arrive au pire
moment — quand le produit commence à marcher.

C'est un argument de poids en faveur de l'arbitrage A3 (solo plutôt que social), qui n'était
pas listé dans le plan.

---

## 6. Ce que l'audit conclut réellement

En reprenant les objections : la fenêtre est passée (1.1), l'économie est mauvaise (1.2), le
corpus ne peut pas être amorcé (1.3), les différenciateurs ne sont pas des fossés (3), le
marché réel est petit (4.4), et la modération est un coût caché (5).

Si le but est **« construire un produit avec des utilisateurs »**, l'ensemble de ces
objections rend le projet peu raisonnable, et il faut le dire clairement plutôt que de le
noyer dans une roadmap.

Mais il existe une lecture sous laquelle **toutes ces objections tombent d'un coup** :

> **Construire d'abord l'outil personnel excellent.**
> Un produit qui a de la valeur pour une seule personne — Tristan — dès le premier jour.

Sous cette lecture :

| Objection | Ce qu'elle devient |
|---|---|
| Fenêtre d'acquisition passée | Sans objet — on ne cherche pas à acquérir |
| Économie impossible | Sans objet — coût proche de zéro, zéro utilisateur à financer |
| Corpus non amorçable | Sans objet — le corpus, c'est le sien, et il a de la valeur pour lui seul |
| Différenciateurs copiables | Sans objet — on ne défend rien |
| Marché réel petit | Sans objet |
| Modération / DSA | Sans objet — pas de contenu de tiers |
| Spoiler (§2) | **Reste vrai**, et devient plus simple : on ne se spoile pas soi-même |

Et le point décisif, qui rend l'argument asymétrique :

> **Cela ne change presque rien au code des phases 0 à 3.** La différence tient à la phase 5,
> qu'on ne construit pas, et à quelques décisions de schéma qui restent ouvertes.

On ne perd donc rien à commencer solo, et on gagne de sortir de toutes les objections
ci-dessus. C'est le trajet qu'a suivi Letterboxd lui-même : deux personnes qui ont d'abord
construit pour elles.

Il y a par ailleurs un besoin réel, fréquent, et à ma connaissance **sans concurrent
sérieux** : *« qu'est-ce que j'avais pensé de la saison 3, déjà ? »*. Personne ne le sert.
Ce n'est pas un marché, mais ce n'est pas rien.

---

## 7. Recommandation révisée

1. **Répondre à l'arbitrage A1 avant tout le reste.** Tant que « à quoi sert ce projet »
   n'est pas tranché, tout choix en aval est arbitraire. C'est la seule question réellement
   bloquante.
2. **Par défaut, viser l'outil personnel** — pari asymétrique démontré au §6.
3. **Faire entrer la contrainte de spoiler dans le modèle de notation** avant d'écrire le
   schéma de base (§2). C'est le seul point de l'audit qui exige une correction technique
   immédiate.
4. **Reconsidérer la hiérarchie épisode/saison** à la lumière du §4.3 : la saison est la
   bonne unité de *jugement*, l'épisode est peut-être la bonne unité de *rythme*.
5. **Cesser de qualifier les quatre territoires de « défendables »** (§3). Ce sont des
   différenciateurs. Le vocabulaire compte parce qu'il change les décisions.
6. **Faire relire cet audit par un autre agent.** Rédacteur = relecteur, c'est la limite
   assumée de ce document.

---

## 8. Ce que l'audit ne remet pas en cause

Pour être équitable, et parce qu'un audit qui démolit tout n'est pas un audit :

- le choix du web (§4.1), pour le motif révisé ;
- la règle « le catalogue est loué, pas possédé » — contractuellement obligatoire et
  stratégiquement saine ;
- la saison comme unité de jugement canonique — aucune alternative examinée ne fait mieux, et
  l'argument de finitude (`RATING-MODEL.md` §2.1) tient ;
- l'export intégral dès le premier jour ;
- la séquence des phases 0 → 3, qui reste valable sous toutes les lectures du projet ;
- le travail de la phase 0, qui n'est jeté sous aucune hypothèse — c'est pourquoi il a été
  fait cette nuit.

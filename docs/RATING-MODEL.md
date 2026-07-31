# RATING-MODEL.md — comment on note une série

> La décision de conception n°1. Tout le reste en découle : le schéma de base de données,
> l'écran principal, la page série, l'agrégation, le classement, ce qui est partageable.
> Se trompe-t-on ici, et le reste ne rattrape rien.
>
> Statut : **proposition argumentée**, à valider par Tristan. Les alternatives rejetées sont
> conservées avec leur motif de rejet — c'est ce qui permet de revenir en arrière sans
> refaire le raisonnement.

---

## 1. Reformuler le problème correctement

Le réflexe est de demander : *« à quel niveau met-on les étoiles — épisode, saison, ou
série ? »*

C'est la mauvaise question, et c'est pour ça que tout le monde y répond mal. La bonne
question est en deux temps :

> **(a) Quel est l'événement qu'un utilisateur veut consigner ?**
> **(b) Quel est le jugement qu'il est réellement capable de formuler ?**

Letterboxd n'a jamais eu à distinguer les deux : pour un film, l'événement (une séance) et
le jugement (« j'ai aimé ce film ») portent sur le même objet. Pour la télévision, ils
divergent, et **il faut deux mécanismes distincts, pas un compromis entre les deux.**

Le reste de ce document sépare donc systématiquement :

- l'**enregistrement** — ce qui est arrivé, sans effort, sans opinion ;
- le **jugement** — ce que j'en pense, avec effort, volontaire et optionnel.

Les confondre est l'erreur commune. C'est pourtant ce que fait toute case « regardé + noter »
sur le même écran.

---

## 2. Les trois observations qui déterminent la réponse

### 2.1 La saison est la seule unité qui soit à la fois réelle, finie et dicible

| Unité | Existe dans le monde réel ? | Finie ? | Les gens en parlent ? | Volume par série |
|---|---|---|---|---|
| Épisode | Oui | Oui | Rarement, sauf exception | 20–200 |
| **Saison** | **Oui** (commande, budget, writers' room, année) | **Oui** | **Constamment** | **1–10** |
| Série | Oui | **Non** — pas tant qu'elle tourne | Oui, mais vaguement | 1 |
| Arc narratif | Non (pas dans les données) | — | Oui | — |

La colonne décisive est « finie ». **Une saison se termine, donc on peut la clore, donc on
peut la dater, donc elle peut devenir une entrée de journal.** C'est exactement ce qui
restaure l'isomorphisme qui fait marcher Letterboxd :

```
   L'ŒUVRE           =        L'ÉVÉNEMENT        =      L'UNITÉ DE JUGEMENT
   une saison            « j'ai fini la S3 »          « la S3 était très bien »
                          le 14 mars, datable
```

Une série entière ne peut pas jouer ce rôle : elle n'a pas de date de fin tant qu'elle est
en cours, et noter une œuvre inachevée n'a pas de sens stable. Un épisode ne peut pas le
jouer non plus : il est fini et datable, mais **le jugement n'y est pas** — presque personne
n'a d'opinion formée sur l'épisode 7 de la saison 4.

### 2.2 Ce qu'on demande à une série n'est pas « c'est bien ? » mais « je continue ? »

C'est la différence la plus mal comprise entre le cinéma et la télévision.

Pour un film, la décision de regarder est prise **une fois**, avant ; la note est un verdict
**rétrospectif**. Pour une série, la décision est **reprise à chaque frontière** — fin
d'épisode, fin de saison, annonce d'une nouvelle saison deux ans plus tard.

**L'acte de jugement naturel d'un téléspectateur n'est donc pas une note. C'est une
décision : continuer, mettre en pause, ou abandonner.**

Aucun produit existant ne traite cette décision comme une donnée. C'est pourtant la seule
qui soit émise spontanément, sans qu'on ait à la demander, à chaque frontière de saison.
Et elle produit l'information la plus recherchée du domaine : *où les gens décrochent.*

### 2.3 La qualité d'une série est une courbe, pas un nombre

Fait mesuré, pas opinion : sur l'ensemble des séries notées sur IMDb, le point de bascule
typique se situe **vers la saison 5 ou 6**, après quoi les notes déclinent continûment
jusqu'à l'annulation (source dans `RESEARCH.md` §3.3).

Un scalaire ne peut pas représenter une fonction du temps. Toute note unique de série est
une **perte d'information par construction** — et c'est ce qui produit les incohérences
d'IMDb.

> Corollaire produit : le livrable d'une série n'est pas un nombre, c'est une **forme**.
> Letterboxd produit une note ; ici on doit produire une **trajectoire**. C'est visuellement
> identifiable, immédiatement partageable, et structurellement impossible pour un film — donc
> non copiable par Letterboxd.

---

## 3. Le modèle proposé

**« La saison est le canon. L'épisode est l'exception. La série est un verdict, pas une
moyenne. »**

Quatre couches. Chacune est optionnelle sauf la première.

### Couche 0 — La position (enregistrement, zéro opinion)

L'utilisateur déclare **où il en est**, pas ce qu'il a coché.

```
   « Tu en es où ? »   →   S03E07
```

Un seul geste met à jour toute la progression : tout ce qui précède est implicitement vu.
C'est la différence entre **un tap et quarante-sept**. C'est aussi le seul remède réaliste à
la cause n°1 d'abandon des trackers (`RESEARCH.md` §7.3) sans scrobbling.

Corollaire important : la progression est **un pointeur, pas une collection de booléens**.
Les épisodes sautés sont un cas marginal, à traiter comme une exception explicite, jamais
comme le modèle par défaut.

### Couche 1 — La note de saison (jugement canonique)

Une entrée de journal = **une saison terminée**. Elle porte :

| Champ | Obligatoire | Note |
|---|---|---|
| saison | oui | l'objet noté |
| date de fin | oui (auto-remplie) | ce qui la rend datable et journalisable |
| note 0,5–5, demi-étoiles | **non** | échelle Letterboxd : familière, comparable, agrégeable |
| texte | non | c'est lui le vrai actif à long terme |
| like | non | signal affectif, distinct de la qualité |
| revisionnage | non | booléen |

C'est **la seule note qui compte** pour toutes les agrégations et tous les classements.
Une seule note canonique = une seule vérité = pas d'incohérence à la IMDb.

**Pourquoi les demi-étoiles et pas /10 ou /100 ?** Parce que l'échelle doit être assez
grossière pour être stable dans le temps. Un utilisateur ne sait pas distinguer 73 de 76 ;
il sait distinguer 3,5 de 4. Letterboxd a raison sur ce point et l'a validé sur quinze ans.

### Couche 2 — Les épisodes marquants (l'exception, pas la règle)

**On ne note pas les épisodes. On les distingue.**

Le geste : marquer un épisode comme marquant — en bien ou en mal. Typiquement zéro à cinq
par saison. Ça capture ce dont les gens se souviennent vraiment (*Ozymandias*, *The Rains of
Castamere*, *San Junipero*, et symétriquement l'épisode qui a tué la série) sans imposer
deux cents décisions.

Justification : demander une note sur 200 épisodes, c'est demander 200 décisions pour
obtenir un signal dont 190 valeurs seront « c'était bien je suppose ». Le rapport
signal/effort est catastrophique. Distinguer 3 épisodes sur 60 produit **plus**
d'information pour **1,5 %** de l'effort.

> **Mais** : les utilisateurs qui *veulent* noter chaque épisode existent, ils sont bruyants,
> et Serializd les sert. C'est donc un **mode explicitement activable**, jamais le défaut. Le
> schéma de base de données doit le permettre dès le départ (une note d'épisode est un
> enregistrement de plein droit) ; c'est l'**interface** qui ne le propose pas d'emblée.
> Coût de conception : nul. Coût de ne pas l'avoir prévu : une migration.

### Couche 3 — Le verdict de série (et non la moyenne)

La série ne reçoit **pas** de note en étoiles. Elle reçoit une réponse à la question qu'on
pose réellement à quelqu'un dans la vraie vie :

> **« Je me lance ? »**

Réponses possibles, structurées :

- **Fonce.**
- **Oui, mais arrête-toi après la saison N.** ← le cœur du produit
- **Seulement si tu aimes [X].**
- **Non.**

Le deuxième cas est la phrase archétypale de toute conversation sur les séries — *« regarde
Dexter mais arrête-toi à la saison 4 »* — et **personne ne la capture**. Agrégée sur une
communauté, elle donne :

```
   Dexter — 73 % recommandent d'arrêter après la saison 4
```

C'est immédiatement utile, immédiatement partageable, dérivé d'un geste que les gens font
déjà spontanément, et **structurellement impossible pour un film**. Un film n'a pas de point
d'arrêt. C'est donc un actif que Letterboxd ne peut pas copier même en ajoutant les séries.

### Ce que le modèle produit, en une image

```
 Breaking Bad
 ████░ ████▌ ████▌ █████ █████        pic 5,0 · constance haute
  S1    S2    S3    S4    S5           verdict : fonce

 Dexter
 ████▌ ████░ ███▌░ █████ ██▌░░ █▌░░░   pic 5,0 · constance basse
  S1    S2    S3    S4    S5    S6      verdict : arrête-toi après S4 (73 %)
```

Deux séries que toute note unique rendrait comparables et qui ne le sont pas. La forme dit
en un coup d'œil ce qu'un 4,1 contre 3,8 masque complètement.

---

## 4. Agréger : comment classe-t-on deux séries entre elles ?

Une moyenne des notes de saisons est le choix évident, et il est **mauvais** : il punit les
séries longues qui ont eu de grands moments et récompense les séries courtes sans risque.
Deux saisons parfaites et huit saisons dont cinq excellentes ne sont pas la même
proposition, et aucune moyenne ne les départage honnêtement.

**Décision : ne pas produire un score unique. Produire deux axes.**

| Axe | Définition | Ce qu'il capture |
|---|---|---|
| **Pic** | la meilleure note de saison | Jusqu'où cette série est montée |
| **Constance** | dispersion des notes de saisons (inversée) | Est-ce qu'elle s'est tenue |

Cela produit une typologie lisible sans explication :

```
              constance haute        constance basse
 pic haut     le chef-d'œuvre        la série qui s'est perdue
              (Breaking Bad)         (Dexter, GoT)
 pic moyen    le confort fiable      la série sans intérêt
              (une sitcom)           (à éviter)
```

Un classement global unique reste possible si nécessaire (par le pic, en départageant par la
constance), mais **il n'est pas l'objet principal de l'interface**. Les palmarès à un chiffre
sont exactement ce qui produit les guerres de notes stériles, et Letterboxd s'en passe très
bien.

**Note technique importante** : la constance n'a aucun sens sous trois saisons notées. Sous
ce seuil, on n'affiche que le pic. Ne pas afficher un écart-type calculé sur deux points est
une question d'honnêteté, pas d'esthétique.

---

## 5. Le principe de friction dégressive

Le modèle ne vaut que si le geste minimal reste minimal. Trois niveaux d'engagement, et
**personne ne doit jamais voir le niveau au-dessus de celui qu'il a choisi** :

| Niveau | Geste | Population attendue `[hypothèse]` | Ce que ça produit |
|---|---|---|---|
| 0 | « j'en suis là » | ~70 % | La carte des abandons, les stats de visionnage |
| 1 | + note de saison | ~25 % | La trajectoire, les agrégations, les classements |
| 2 | + texte, épisodes marquants, verdict | ~5 % | **Le corpus** — le seul actif défendable |

Les 5 % du niveau 2 sont ceux qui font exister le produit pour les 95 % autres. C'est vrai
de Letterboxd, de Goodreads, de MyAnimeList, de Wikipédia. **L'interface doit être conçue
pour eux et supportable par les autres**, jamais l'inverse.

---

## 6. Alternatives examinées et rejetées

Conservées avec leur motif — pour ne pas refaire le débat dans trois mois.

| Alternative | Motif de rejet |
|---|---|
| **Noter aux trois niveaux (Serializd)** | Transfère le problème à l'utilisateur : *lequel est la vérité ?* Charge cognitive à chaque log, et aucune base saine pour agréger. C'est le choix par défaut quand on refuse de trancher. |
| **Noter uniquement la série** | Perd la trajectoire, qui est le fait central (§2.3). Reproduit les incohérences d'IMDb. |
| **Noter uniquement l'épisode** | Friction insupportable ; 190 notes sur 200 sans signal. Et l'agrégation reste à inventer. |
| **Sous-scores pondérés (AniList)** | Excellent pour une niche disciplinée, mortel pour un public large. Un formulaire à cinq champs par saison ne sera pas rempli. |
| **Comparaison par paires / Elo** | Théoriquement supérieur — la littérature montre que la comparaison par paires reflète mieux les préférences intrinsèques que les étoiles ([arXiv 1609.00683](https://arxiv.org/pdf/1609.00683)) — mais : pas de note affichable pour une œuvre isolée, démarrage à froid impossible, et résultat non interprétable par l'utilisateur. **À reconsidérer comme couche secondaire** : le classement *intra-série* par paires (« la S3 était-elle meilleure que la S2 ? ») est une question à laquelle tout le monde sait répondre avec confiance, et elle produit la courbe sans exiger de note absolue. Piste sérieuse pour v2, pas pour v1. |
| **Réactions au lieu de notes (TV Time)** | Friction minimale mais aucune donnée exploitable, aucun corpus, aucune défendabilité. Ils sont morts. |

---

## 6bis. La contrainte de niveau 1 : rien au-delà de ma position

Ajoutée le 2026-08-01, à la demande de `docs/ROADMAP-AUDIT.md` §2. Ce n'est pas une
préférence d'interface : **c'est une contrainte du modèle**, au même rang que le choix de
la saison comme unité canonique.

Sur Letterboxd, l'état d'un utilisateur face à une œuvre est **binaire** : vu, ou pas vu.
Une case « contient des spoilers » suffit. Pour une série, l'état est **un point sur un
axe** — le spectateur est *au milieu*. Alors :

- une critique de la saison 5 spoile la saison 4 ;
- l'existence même d'une saison 7 dit que les personnages survivent ;
- **la trajectoire est elle-même un spoiler** : montrer que la courbe s'effondre en
  saison 5 est une information que quelqu'un en saison 2 n'a pas demandée ;
- **le point d'arrêt recommandé — le cœur de la proposition §3 couche 3 — dit à quelqu'un
  qui commence qu'il va être déçu, et quand.**

> **Règle : rien qui dépasse la position du spectateur ne s'affiche sans un geste
> explicite de sa part.**

Deux conséquences techniques non négociables :

1. **Le filtrage vit dans le domaine, pas dans la couche de rendu.** Un filtre d'affichage
   laisse fuir les agrégats : la courbe est coupée mais le pic et le point de rupture,
   calculés sur l'ensemble, restent visibles. `redactTrajectory`
   (`src/domain/spoiler.ts`) **recalcule** sur les seules saisons visibles.
2. **Sans position déclarée, on masque tout.** Mieux vaut masquer à tort que spoiler.

Cette contrainte devient critique en phase 3, quand on commence à afficher le jugement de
tiers. C'est aussi, paradoxalement, le meilleur candidat comme véritable fossé technique :
un affichage conscient de la position est difficile à ajouter après coup — il faut avoir
modélisé la position dès le départ.

---

## 7. Ce que ce modèle exige du schéma de données

Conséquences directes, à respecter dès le premier commit — ce sont celles qui coûtent une
migration si on les rate :

1. **La note appartient à un couple (utilisateur, objet notable)** où l'objet notable est
   polymorphe : saison, épisode, ou série. Même si l'interface v1 n'expose que la saison, le
   schéma accepte les trois. Le coût est nul aujourd'hui, prohibitif plus tard.
2. **L'entrée de journal est distincte de la note.** Une entrée date un événement ; une note
   exprime un jugement. On peut avoir l'une sans l'autre, et une même saison peut être
   revisionnée — donc plusieurs entrées, une seule note courante. Fusionner les deux tables
   est l'erreur qui rend le revisionnage impossible à modéliser ensuite.
3. **La position est un pointeur, pas un ensemble de booléens.** `(série, saison, épisode)`
   + date. L'historique complet se dérive.
4. **La décision (continuer / pause / abandon) est une table de plein droit**, avec le point
   exact et un motif optionnel. C'est la donnée propriétaire du produit ; elle ne doit pas
   être un champ `status` sur la série.
5. **Aucune métadonnée TMDB n'est stockée durablement.** Identifiants externes + cache
   expirant. Voir `RESEARCH.md` §4.2 — contrainte contractuelle de six mois.

---

## 8. Les questions ouvertes, honnêtement

Ce modèle a des angles morts connus. Les cacher serait malhonnête ; ils sont repris dans
`docs/ROADMAP-AUDIT.md` §2.

1. **Les données de saison sont instables.** Saison 0 (spéciaux), anime, séries britanniques,
   saisons scindées en deux parties (*Better Call Saul*, *Stranger Things*). Si la saison est
   l'unité canonique, cette instabilité devient un problème de **produit**, pas
   d'intégration. C'est le risque n°1 du modèle.
2. **Les mini-séries et les anthologies.** Une mini-série a une saison : saison = série,
   redondance. Une anthologie (*Black Mirror*) n'a pas de continuité entre épisodes : le
   modèle par saison y est mal ajusté. Il faudra un traitement de cas.
3. **Les sitcoms.** Personne ne « termine » consciemment une saison de *Friends*. La
   frontière de saison, sur laquelle repose tout le modèle, y est molle.
4. **La date de fin d'une saison suivie en hebdomadaire** est arbitraire : l'« événement »
   est étalé sur trois mois. La date de journal est alors une convention, pas un fait.
5. **La répartition 70/25/5 est une hypothèse**, calquée sur d'autres communautés. Elle n'est
   pas mesurée sur ce produit et ne le sera pas avant d'avoir de vrais utilisateurs.

Aucune de ces cinq n'invalide le modèle. Toutes exigent une décision explicite avant la
mise en ligne.

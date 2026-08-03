# Les idées de Tristan, triées

> Liste apportée le **2026-08-03 (soir)** : parité avec Serializd, disponibilité par pays,
> quiz avec classements, et une troisième demande de scrobbling. Plus une source :
> [achriom.com — best TV tracking apps](https://www.achriom.com/blog/best-tv-tracking-apps/).
>
> **Rien n'est écarté dans ce document.** Chaque idée est soit déjà faite, soit chiffrée, soit
> rangée derrière son prérequis. Et le prérequis n'est presque jamais technique : c'est **5.0,
> la modération** (⛔ DSA, charge permanente pour une personne seule).
>
> ⚠️ **Sur la source** : le blog cité est celui d'**Achriom, qui se classe lui-même dans le
> comparatif**. Ce n'est pas une source neutre. Elle contient tout de même deux faits utiles,
> repris plus bas.

---

## 0. Les deux faits que la source apporte, et qui changent un arbitrage

1. 🔴 **Serializd n'a aucun scrobbling** — et c'est lui qui occupe la place de « Letterboxd
   pour la TV », lui dont Tristan veut importer les fonctionnalités. **Le scrobbling n'est donc
   pas la feature qui décide de cette niche.** Trakt et Simkl scrobblent tous les deux et ne
   l'ont pas prise.
2. Sur Trakt, la source écrit : *« doesn't help you understand your taste. Recommendations are
   basic »*. C'est mot pour mot le différenciateur que `src/domain/taste.ts` construit. Une
   confirmation externe de plus, par quelqu'un qui n'a pas lu `RESEARCH.md`.

*(Troisième fait, moins confortable : Achriom fait déjà du **multi-média** — séries, films,
livres, albums, anime — privé par défaut, à 9,99 $/mois. Pertinent pour A13, §1.)*

---

## 1. A13 — le suivi complet des films

✅ **Tranché par Tristan le 2026-08-03 : suivi complet.** C'est **contraire à ma
recommandation**, et c'est acté. Comme pour A1 et A7, mes objections ne disparaissent pas :
elles deviennent le cahier des charges.

### 1.1 Ce que j'avais dit, et qui reste vrai

Un film n'a **ni saison, ni position, ni trajectoire**. Aucun des quatre différenciateurs de
`ROADMAP.md` ne s'y applique. Donc le produit n'aura, sur un film, rien à dire de plus que
n'importe qui — et se mesurera à Letterboxd sur son seul terrain imbattable. **La conséquence
n'est pas de refuser : c'est de ne pas prétendre.** Une fiche film doit être honnêtement
sobre, et ne pas imiter la richesse d'une fiche série.

### 1.2 ✅ La bonne nouvelle : aucune migration de journal

Trouvée en vérifiant plutôt qu'en supposant. La clé d'entrée est `<espace>:<identifiant>` et
`parseJournalKey` (`src/domain/journal.ts:73`) coupe au **premier** `:`. Donc :

- les séries gardent `tmdb:1396`, **inchangé** — aucun journal existant n'est touché ;
- les films prennent un **espace neuf**, distinct.

C'est la règle appliquée au renommage `seasoned` → `Voltface` : **on ne migre pas ce qui marche
déjà.** Le préfixe n'identifie d'ailleurs pas seulement le fournisseur, il identifie l'**espace
d'identifiants** — et c'est exact : chez TMDB, le film 550 et la série 550 sont deux objets
différents. La convention actuelle était donc déjà prête sans qu'on l'ait prévu.

### 1.3 🔴 Le vrai risque, et il n'est pas dans les types

**Huit modules parcourent `journal.entries` en supposant que chaque entrée a des saisons et des
épisodes** : `tally`, `remaining`, `trajectory`, `entry-point`, `catch-up`, `current-season`,
`nudge`, `calendar`. Une entrée film non filtrée ne fera pas planter : elle **empoisonnera
silencieusement chaque agrégat**.

> C'est la famille d'échec du projet, dans sa variante la plus coûteuse : *un champ qui existe
> n'est pas un champ qui est écrit* — ici, **un module qui compile n'est pas un module qui
> filtre**. Le typage ne dira rien, parce qu'une clé de journal reste une chaîne.

**Donc l'ordre de travail est : border les huit modules d'abord, écrire la première entrée film
ensuite.** L'inverse produit des chiffres faux dont personne ne saura à quelle date ils ont
commencé à l'être.

### 1.4 Le bénéfice inattendu

Un film **a une durée**. Il compte donc légitimement dans le bilan d'heures — `tally.ts`
devient plus juste, pas moins. C'est le seul endroit où les films renforcent un
différenciateur au lieu de le diluer.

---

## 2. 🔴 Le VPN : la question était la bonne, la méthode non

**La demande** : *« je veux que tu sois capable de dire si t'as un VPN ou pas, pour avoir une
idée de si c'est sur Netflix mais dans un autre pays. »*

**Pourquoi détecter le VPN est un mauvais chemin**, deux raisons indépendantes :

1. ⛔ ça exige d'**inspecter l'adresse IP côté serveur** et de la comparer à des listes de
   plages connues. C'est du **traçage** — précisément ce que le produit promet de ne pas faire,
   et cette promesse est l'argument qui rend le modèle cosmétique cohérent (A6, A12) ;
2. c'est **peu fiable** : les listes de plages VPN sont périmées en permanence, et un faux
   positif dirait à quelqu'un qu'il est ailleurs qu'où il est.

**Le contre-sens, et il est presque gratuit** : le besoin réel n'est pas « suis-je derrière un
VPN », c'est **« où cette série est-elle disponible ? »**. Et `/watch/providers` renvoie **tous
les pays d'un seul coup**, dans l'appel que `src/catalog/tmdb.ts:471` fait déjà.

> **On ne devine pas l'utilisateur, on le laisse choisir ses pays.** « Sur Netflix 🇬🇧, pas
> 🇫🇷 » est une information plus utile, plus vraie, et obtenue **sans savoir où est qui**.

C'est la même forme que le `.ics` (le rappel payé par l'agenda de quelqu'un d'autre) et que la
journée entière du `VALARM` (sonner à 9 h locales sans connaître le fuseau) : **la solution qui
n'a pas besoin de l'information est meilleure que celle qui va la chercher.**

---

## 3. Ce qui est déjà livré dans la liste

| Idée de la liste | État |
|---|---|
| Intégration JustWatch | ✅ `/tv/{id}/watch/providers` + attribution contractuelle — `provider.ts:192` |
| Critiques et notes par **épisode, saison, global** | ✅ A7 tranché, `docs/RATING-MODEL.md` |
| **Demi-étoiles** | ✅ `rating-scale.ts` |
| Fond = l'affiche + texte (date, âge) | ✅ La règle de DA est « l'affiche est l'interface » |
| **Le moment du dernier épisode** | ✅ Et c'est **le différenciateur** : le temps écoulé chiffré (`cadence.ts`, `status.ts`) |
| Abandonner une série | ✅ `DecisionKind: 'abandoned'` — distinct de `'completed'` |
| Saisons avec date + nombre d'épisodes, log par saison | ✅ Page série (`EpisodeGrid`, `seasons.ts`) |
| Dire qu'on est en train de regarder | ✅ La position existe. Ce qui manque est son affichage **public** — donc 5.0 |

---

## 4. Cheap et additif — aucun compte requis

- **5.12 Changer l'affiche et la bannière.** La fonctionnalité la plus aimée de Serializd, et
  gratuite chez lui. La version propre est **le choix parmi les images que TMDB porte déjà**
  (`/tv/{id}/images` en renvoie plusieurs) : aucun upload, aucun hébergement, **aucune
  modération**, aucune surface de droit d'auteur. Exactement la ruse de A12 — *choisir dans un
  catalogue existant, ne jamais accepter un fichier*.
- **5.13 Le quiz personnel** — voir §5, c'est la meilleure idée de la liste.
- **5.14** Boutons *Détails · Où la regarder · Casting*, et « plus de stats » par saison : la
  matière existe, c'est du câblage.
- **5.15 Les cœurs, en plus des demi-étoiles.** Une note dit la **qualité**, un cœur dit
  l'**attachement** — ce ne sont pas la même information, et la série-refuge du journal v3 le
  montrait déjà. Petit, et cohérent avec le modèle.

---

## 5. Les quiz — la meilleure idée, et ses deux pièges

### 5.1 🔴 Le quiz personnel est à faire en premier

*« Quelle série + quel épisode avez-vous vu le 7 janvier ? »* se calcule **sur le journal
local**. Donc : zéro serveur, zéro compte, zéro modération, **fonctionne hors ligne**, et coût
marginal par utilisateur **nul** — le seul type de feature que ce projet peut multiplier sans
risque.

Et il est **structurellement incopiable** : il faut *votre* journal. Un concurrent ne peut pas
le livrer sans avoir d'abord vos données. C'est la même asymétrie que le bilan d'heures, qui est
payant chez Letterboxd et gratuit ici parce qu'il se calcule dans le navigateur.

⚠️ **Démarrage à froid** : sans historique, il n'y a pas de question. Le quiz doit donc **se
taire** au début — la règle déjà appliquée au point d'arrêt, au verdict de saison et au bilan
(« le silence reste majoritaire, comme annoncé »).

### 5.2 Les quiz publics, classements et 1v1 : deux pièges, pas un

1. ⚠️ **Le spoiler** (règle 7, contrainte de niveau 1). « Devine la série d'après ses notes par
   épisode » **révèle une trajectoire** — et `src/domain/spoiler.ts` existe précisément parce
   que *la trajectoire est elle-même un spoiler*. Un quiz sur le nombre de vues par épisode
   révèle où les gens décrochent, donc le point de rupture. **À limiter aux séries finies, ou
   à celles que le joueur a déjà vues** — ce que le domaine sait déjà calculer.
2. ⚠️ **La triche.** Toute réponse vérifiable dans l'API publique de TMDB est triviale à
   trouver. Un classement exige donc un score **calculé côté serveur**, c'est-à-dire une route
   serveur et une surface à défendre. Le quiz personnel n'en a aucun besoin — d'où l'ordre.

---

## 6. Ce qui attend 5.0 (la modération), et pourquoi ce n'est pas un refus

Profils, séries préférées, activité récente, recherche d'utilisateurs, compteurs
vus/critiques/watchlist, recommandations, 1v1, classements. **L'essentiel est déjà conçu** dans
`docs/ARCHITECTURE-APP.md` §3-4. Ce qui bloque est le dispositif de signalement/retrait/contact
exigé par le DSA — ⛔ 5.0, et une charge **permanente** pour une personne seule.

⚠️ **Le vrai sujet de cette section n'est pas la modération, c'est le démarrage à froid.**
« 0 vu · 0 critique · 0 watchlist » affiché sur chaque fiche **annonce le vide**. Mieux vaut se
taire que compter zéro : un compteur n'apparaît qu'au-dessus d'un seuil, comme tout le reste du
produit.

### 6.1 ⛔ L'écran d'accueil fait de critiques contredit une décision fondatrice

`ROADMAP.md` §0.1, le renversement du plan initial :

> **Une page série doit valoir le détour avec zéro critique.**

Le corpus de textes **ne s'amorce pas**. Un accueil bâti sur des critiques est donc **vide le
premier jour**, et vide pour les premiers milliers de visiteurs — ce qui est exactement la
raison pour laquelle les textes ont été mis en dernier et les données dérivées en premier.

À reformuler en **« un accueil qui se remplit »** : il montre d'abord ce qui se calcule sans
personne (trajectoires, statuts, temps), et laisse la place aux critiques quand il y en aura.
L'inverse est un écran qui apprend au visiteur que le produit est désert.

### 6.2 « Correspondant à l'algo de ton profil » — à reformuler, pas à jeter

La **recommandation algorithmique** est un non-but documenté (`ROADMAP.md` §3) : « la commodité
par excellence », alors que le produit se positionne sur le goût humain.

**Mais `src/domain/taste.ts` existe déjà.** « Des gens dont le goût ressemble au vôtre » n'est
pas un algorithme de recommandation : c'est une **similarité de goût, assumée et explicable**
— on peut dire *pourquoi* deux profils se ressemblent. La nuance mérite d'être gardée, parce
qu'elle est la version du besoin qui ne contredit pas le positionnement.

---

## 7. Le scrobbling, troisième demande : une question d'ordre, pas de principe

Rien n'a changé sur le coût **aujourd'hui** : première route serveur du projet (il y en a
**zéro**), un jeton par utilisateur à générer/révoquer/afficher, la clé `service_role` côté
serveur, donc la principale surface d'écriture authentifiée à défendre.

Mais deux faits nouveaux méritent d'être posés :

1. **Serializd n'a aucun scrobbling** (§0) — et c'est lui qui occupe la place. Ce n'est pas la
   feature qui décide de cette niche.
2. **D17** : le natif (A11) rend le push obligatoire, donc un **planificateur serveur existera
   de toute façon**. Le coût *marginal* d'un récepteur de webhooks baisse nettement **après**
   cette infrastructure.

> Donc : **pas maintenant, moins cher plus tard.** À reconsidérer quand le push existe, pas
> avant. Et **D15 reste fermé** : Trakt limite les comptes gratuits à une seule application
> externe, ce qui exclut exactement la population visée.

---

## 8. L'ordre que je recommande

1. **5.10 — border les huit modules, puis A13** (les films). C'est le plus structurant, et le
   seul dont un retard fabrique des données fausses.
2. **4.4 — `episode_groups`** (lot 4). Toujours le plus rentable : il protège les calculs
   existants d'être faux avec assurance. ⚠️ Exige le jeton TMDB (**D18**).
3. **5.11 — la disponibilité multi-pays.** Quasi gratuit, répond à la demande du VPN mieux que
   le VPN.
4. **5.13 — le quiz personnel.** Zéro coût marginal, incopiable, et il rend le journal amusant
   au lieu de comptable.
5. **5.12, 5.14, 5.15** — les cheap : affiches, boutons, cœurs.
6. **A6 à rechiffrer avec l'IAP Apple (D16)** avant toute dépense native.
7. Le reste **derrière 5.0**.

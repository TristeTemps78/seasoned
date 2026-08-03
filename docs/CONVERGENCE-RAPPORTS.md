# Convergence — deux rapports externes confrontés au dépôt

> Rédigé le **2026-08-03 (soir)** par `@claude-opus`, à partir de deux rapports produits par
> Gemini sur « la plateforme ultime de suivi de séries » (analyse concurrentielle + cahier
> des charges UX/UI). Tristan a demandé une **solution convergente**, avec pour consigne
> explicite : *si il faut tout refaire on refait tout*, et *ne pas faire compliqué quand on
> peut faire simple*.
>
> ⚠️ **Ce document viole « rédacteur ≠ relecteur »** au même titre que
> `docs/ROADMAP-AUDIT.md` : je juge des rapports externes en défendant l'architecture que
> j'ai en partie écrite. À lire comme un dossier argumenté, pas comme une validation.
> Les points où j'ai eu tort sont marqués 🔴 — il y en a trois.

---

## 0. Le verdict, en une page

**On ne refait rien.** Le raisonnement est vérifiable plutôt qu'affaire de goût : retire des
deux rapports tout ce qui est (a) matériellement impossible ici, (b) déjà livré, ou (c) un
coût marginal par utilisateur qui a tué le cas d'école qu'ils citent en ouverture. Il reste
**trois éléments**, tous petits, tous compatibles avec le code existant — `episode_groups`,
l'option de masquage des heures, le rapport des titres non appariés à l'import.

Et ce que les rapports décrivent qui exigerait vraiment de tout refaire — backend de
scrobbling, social à médias uploadés, chemin d'écriture temps réel — est précisément
l'ensemble que le projet avait déjà écarté **avec des motifs écrits**. Ces motifs n'ont pas
bougé à la lecture.

### Les deux rapports ne répondent pas à la question de ce projet

Ils répondent à : *« comment construire le meilleur tracker de séries ? »*
Le projet a répondu, exprès, à une autre (`ROADMAP.md` §0.1) : *« que doit valoir une page
série quand il n'existe zéro critique et zéro utilisateur ? »*

### L'inversion à nommer, parce qu'elle est dans les rapports eux-mêmes

Les deux ouvrent sur le même fait — TV Time est mort avec **26,4 M d'installations**, motif :
*pas soutenable en gratuit, pas assez de demande pour du payant*. Puis ils concluent « donc
la place est libre, construisez le remplaçant ».

TV Time n'est pas mort par manque de demande. **26,4 M d'installations, c'est la demande.**
Il est mort parce que son coût par utilisateur ne se monétisait pas. Or la liste de leurs
recommandations est, presque intégralement, une liste de **coûts marginaux par
utilisateur** : cluster Redis, Kafka, workers, notifications push, hébergement d'images et de
GIF, modération de médias, sync bidirectionnelle Plex, apps natives tablette, extensions
navigateur.

> **Les rapports prescrivent en détail la cause de mort du cas qu'ils citent en ouverture.**

Ce n'est pas une figure de style : `ROADMAP.md` §3 portait déjà la ligne « Notifications push
généralisées | Coût marginal par utilisateur — **exactement ce qui a tué TV Time** ».

### La deuxième inversion, sur l'UX

Leur recommandation n°1 est le *checkmark à friction zéro*, omniprésent, un clic.
`RESEARCH.md` §7.3 porte déjà le même fait de départ — la saisie manuelle est la cause n°1
d'abandon — mais en tire la conclusion opposée : **un produit dont la valeur exige de cocher
chaque épisode meurt le jour où l'on arrête de cocher pendant deux semaines.** Et leur propre
section scrobbling est l'aveu du problème : ils ont besoin du *Zero-UI* précisément parce que
le tapis roulant du checkmark ne tient pas.

Le pari du projet est structurellement moins coûteux : « ça décolle à S1E8 », « il vous reste
15 épisodes · 11 h 15 », « au moins 537 heures » se calculent depuis **une position**, pas
depuis un journal épisode par épisode. **Un geste par série, pas un par épisode** — friction
plus basse que n'importe quel checkmark, et sans un octet de scrobbling.

### Le point aveugle des deux rapports

Aucun ne demande **qui arrive, et par où**. Tous deux supposent un marché de migration :
26 M de réfugiés en quête d'un domicile — d'où leur hiérarchie (importateurs, social,
onboarding). Or ce marché a une date de péremption : TV Time a fermé le **2026-07-15**, les
réfugiés ont déjà atterri. Construire pour cette vague, c'est construire pour une vague
passée.

« is X worth watching » se demande tous les jours, indéfiniment. C'est le canal pour lequel
le projet est bâti, et le seul qui fonctionne à froid, sans corpus et sans communauté.

### Ce que les rapports apportent de plus utile

Ce n'est pas une fonctionnalité. C'est la **confirmation externe** que le diagnostic de
terrain de `RESEARCH.md` est bon, écrite par quelqu'un qui ne l'avait pas lu. Sept de leurs
recommandations « indispensables » décrivent des choses déjà livrées ici (§5).

---

## 1. A13 — « suivre les films » : la question, en clair

Tristan a demandé que les listes soient possibles, « des listes de films par exemple ». Deux
choses très différentes se cachent là-dedans, et une seule est coûteuse.

### 1.1 Les listes ne posaient aucun problème

Mon « non » du ① portait sur **Kafka + Redis**, une *solution d'infrastructure*. Il ne disait
rien des fonctionnalités. Les listes sont possibles, et rien dans l'architecture ne s'y
oppose. Ce que « un document JSON par compte » implique réellement :

| | Conséquence |
|---|---|
| ✅ Ajouter les listes | = ajouter un champ au JSON. **Zéro migration.** C'est exactement pourquoi cette forme a été choisie : le journal a changé quatre fois en deux jours sans une seule migration (`supabase/001_journal.sql`) |
| ⚠️ Le coût réel | un `UPSERT` de `jsonb` réécrit **tout** le document. Une liste de 500 titres repart en entier quand on ajoute le 501ᵉ. C'est **Q8**, posée et jamais mesurée → tâche 4.5 |
| ⚠️ Les listes **publiques** | « le serveur ne sait pas interroger les journaux ». Une liste partageable et indexable a besoin d'une **projection** — déjà conçue, `ARCHITECTURE-APP.md` §3.2 |

Les listes sont donc **la première donnée de taille non bornée** que le produit offrira. Ça ne
change pas la décision, ça la **date** : mesurer Q8 avant de les livrer, pas après.

### 1.2 La vraie question : une liste qui *contient* des films ≠ *suivre* des films

C'est ça que je demandais à Tristan de trancher.

| | Ce que c'est | Ce que ça coûte |
|---|---|---|
| **Une liste qui contient des films** | Des **références**. « Mes 10 films préférés » = dix identifiants et une affiche chacun. Rien n'est calculé, rien n'est suivi | Faible. TMDB sert déjà les films, `CatalogProvider` s'étend d'une méthode |
| **Suivre des films** | Vu / pas vu, noté, daté, dans le journal, dans le bilan, dans le profil | **Le terrain de Letterboxd**, et *aucun* différenciateur du produit ne s'y applique |

Le second point mérite d'être dit franchement : **un film n'a pas de trajectoire.** Pas de
saison, donc pas de courbe ; pas de position, donc pas de « il vous reste 11 h 15 » ; pas de
point d'arrêt, pas de point d'entrée, pas de « ça décolle à S1E8 », pas de statut zombie. Les
quatre différenciateurs listés en tête de `ROADMAP.md` sont **tous** des propriétés d'une
œuvre qui dure. Sur un film, le produit n'aurait rien de plus à dire que n'importe qui, et se
mesurerait à Letterboxd sur le seul terrain où Letterboxd est imbattable.

### 1.3 Recommandation, et le piège de calendrier

**Les listes acceptent les films ; le produit ne suit pas les films** — et l'interface le dit,
au lieu de laisser croire.

⚠️ **Pourquoi il ne faut pas décider ça en retard.** Tout ce qui est donnée utilisateur pointe
vers `SeriesId` (`src/domain/types.ts`). Accueillir un film demande une notion de **type
d'œuvre** à ce niveau — c'est-à-dire au seul endroit du projet dont tout le reste dépend.
**Peu coûteux maintenant, cher plus tard**, et c'est exactement la forme du rewatch et
d'`episodeMinutes` : *ce qu'on n'enregistre pas aujourd'hui manque pour toujours*.

⚠️ **Le risque de la recommandation, honnêtement** : une liste qui affiche des films invite
« pourquoi je ne peux pas noter celui-là ? ». C'est un trou en forme de promesse. Il se traite
par le texte, mais il faut le savoir avant, pas le découvrir.

---

## 2. A12 — médias riches dans les critiques

✅ **Tranché par Tristan le 2026-08-03 : oui, par sélecteur + copie proxifiée. Jamais
d'upload libre.**

🔴 **Mon premier raisonnement était faux.** J'avais dit que les GIF déclenchent l'obligation de
modération. Non : **c'est la couche sociale qui la déclenche**, texte compris. Un commentaire
public en texte pur crée déjà l'obligation DSA. Les GIF n'ajoutent pas l'obligation — ils
augmentent le **coût de s'y conformer** (relire des images est plus lourd que relire du texte)
et surtout le **plafond de nuisance** : le pire texte et la pire image ne sont pas dans la
même catégorie. Pour une personne seule, c'est cette asymétrie qui décide.

| Variante | Stockage | Droit d'auteur | Traçage | Verdict |
|---|---|---|---|---|
| Upload libre (ce que demandent les rapports) | à notre charge, **non borné** | **notre surface** | aucun | ⛔ |
| Sélecteur tiers, URL *hotlinkée* | 0 | celui du fournisseur | ⛔ **Tenor appartient à Google** : chaque affichage envoie IP + referer | ⛔ |
| **Sélecteur + copie proxifiée, dédupliquée par hash** | borné (catalogue partagé, très réutilisé) | celui du fournisseur | 0 | ✅ **retenu** |

La colonne « traçage » tue la variante en apparence la plus simple. `next.config.ts:96` dit
`img-src 'self' https://image.tmdb.org data: blob:`. Ouvrir vers Tenor enverrait chaque
visiteur chez Google à chaque affichage — et le projet a écrit que l'absence de traçage est
**l'argument qui rend A6 cohérent** : « pas de publicité donc pas de traçage ». On ne casse pas
la justification du modèle économique pour un GIF.

⛔ **Ordre de livraison** : après **5.0** (modération). Le design se fige maintenant, pendant
que le raisonnement est frais ; la livraison attend.

---

## 3. Ce qui est fermé, avec un chiffre

### 3.1 Kafka + Redis write-behind — le rapport se trompe d'axe

Le chemin d'écriture réel (`src/journal/remote.ts:126`) : un `POST` avec
`Prefer: resolution=merge-duplicates`, corps = **le journal entier**, et
`user_id uuid primary key` côté base. Un journal par compte, jamais deux. Plus `subscribe()`
qui ne s'abonne à rien (`remote.ts:152`) — le temps réel avait déjà été refusé, avec le même
motif de coût.

Le mécanisme d'effondrement que le rapport décrit est nommément la **contention de lignes
chaudes**. Il **ne peut pas se produire sur ce schéma** : chaque compte écrit sa propre ligne,
adressée par clé primaire. C'est le motif d'écriture le moins contentieux qui existe en
Postgres. Ce n'est pas « pas encore assez d'utilisateurs pour que ça casse » — c'est
structurel.

Deux remarques de plus :

- le chiffre de **« 5 000 écritures/seconde »** est **sans source** dans le rapport ;
- le motif *write-behind* **perd les données** présentes dans le tampon au crash du broker. Le
  prescrire à un produit dont le traumatisme fondateur est 26 M d'historiques perdus est à
  l'envers.

**Le point de convergence, et il est joli** : le motif que le rapport décrit — un tampon
durable devant la base — **le projet l'a déjà, en mieux et pour 0 €.** Le tampon est
`localStorage`, sur l'appareil de la personne. Il est durable, il survit à la panne de la base
(Q12, annoncé comme une fonctionnalité), et il ne peut pas perdre une écriture dans le crash
d'un broker. **Le local-first *est* le write-behind cache, avec le buffer chez l'utilisateur.**

Ce qui reste vrai du rapport : **il y a bien un plafond**, mais sur l'axe *octets par écriture
× fréquence*, pas sur le débit. → tâche **4.5**, à faire avant les listes.

### 3.2 Scrobbling par webhooks (Plex, Jellyfin, Emby)

Exigerait la **première route serveur du projet** (`find app -name route.ts` : **zéro
résultat**), un jeton par utilisateur à générer/révoquer/afficher, la clé `service_role` côté
serveur, donc la principale surface d'écriture authentifiée à défendre. Tout ça pour refaire
ce que Trakt fait depuis dix ans.

### 3.3 Scrobbling en lisant Trakt — 🔴 j'avais recommandé, l'enquête dit non

J'avais proposé le mouvement à contre-sens : ne pas concurrencer Trakt, le **consommer** comme
source de position — un OAuth, un appel, et on hérite de Plex, Jellyfin, Emby, Kodi et des
extensions d'un coup. C'était cohérent avec le motif récurrent du projet (le catalogue est
loué, le rappel est payé par l'agenda de quelqu'un d'autre).

Vérification faite, c'est fermé :

- 🔴 **un compte Trakt gratuit ne connecte qu'une seule application externe.** Donc quelqu'un
  qui a déjà branché son scrobbler Plex — c'est-à-dire *exactement* la population visée —
  **ne peut pas brancher VOLTFACE** sans sacrifier ce qu'il utilise déjà ;
- **VIP est passé de 30 à 60 $/an** (+100 %) ;
- ⛔ **l'usage commercial de l'API exige une approbation** de Trakt — même forme que D6 avec
  TMDB : une dépendance de plus dont le feu vert ne nous appartient pas.

Demander à quelqu'un de payer 60 $/an à un concurrent pour utiliser notre produit gratuit
n'est pas une fonctionnalité. **L'investigation a fait son travail : elle a dit non.**

Sources : [Trakt Forums — Updating Trakt Limits for 2026](https://forums.trakt.tv/t/updating-trakt-limits-for-2026/101592),
[Trakt Forums — API commercial uses on free plan](https://forums.trakt.tv/t/asking-about-api-commercial-uses-on-free-plan/99367),
[AlternativeTo — stricter limits, VIP +100 %](https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/).

### 3.4 Widgets

Aucun accès utilisable depuis une PWA sur iOS ni Android. *(Le membre `widgets` du manifeste
existe côté Windows/Edge — hors sujet.)*

---

## 4. A11 — le natif : 🔴 la contrainte du projet était fausse

✅ **Tranché par Tristan le 2026-08-03 : applications natives iOS et Android.**

`AGENTS.md` observait « pas de Mac, pas de Xcode » (**vrai**) et en concluait « **aucune
application native** » (**faux**). Et le contre-exemple était dans la phrase elle-même : le
projet voisin `Limits` a produit un **IPA en Release**, depuis ce PC, en CI, sur un runner
macOS hébergé qui choisit dynamiquement un Xcode portant le SDK iOS. Il n'a **jamais** buté
sur le build. Il a buté sur le **sideload sans compte développeur** — WSL2, `usbipd-win`,
Sideloadly, une chaîne USB documentée dans son propre `SIDELOAD-ARM64.md`.

Vérifié par ailleurs : **EAS Build compile iOS sur des runners macOS en nuage, EAS Submit
dépose depuis Windows**, 15 builds iOS/mois au palier gratuit.

Relire la liste d'arguments que `ROADMAP.md` §1.1 alignait — *sans compte développeur* ·
*sans signature* · *sans magasin* · *sans le cycle de sept jours* : **les quatre décrivent les
conséquences du free provisioning**, aucun celles du natif. Avec un compte payant, le
certificat vaut un an (le cycle de sept jours disparaît) et TestFlight installe par le réseau
(le pilote USB x64, seul mur réellement matériel, ne sert plus).

> Le mur n'était donc pas matériel : **~99 $/an (Apple) + 25 $ une fois (Google Play)**. Une
> ligne budgétaire, donc une décision de Tristan — prise.

### Ce que le natif entraîne, et qui doit être budgété

1. ⛔ **A6 est touché.** Apple exige son achat intégré pour tout bien numérique : **15 à 30 %**
   de commission sur les cosmétiques (15 % sous 1 M$/an via le Small Business Program). Le
   modèle freemium a été tranché le matin même ; il faut le rechiffrer avec Apple dedans.
   *(Barème à confirmer sur les pages Apple avant de s'y fier.)* → **D16**
2. ⚠️ **Un webview nu se fait refuser** (règle 4.2 de l'App Store, « minimum functionality »).
   Donc le natif **oblige** à apporter du natif : notifications, hors-ligne, partage.
   Autrement dit **le natif rend le push obligatoire**, et le push ramène le planificateur
   serveur, c'est-à-dire le coût marginal par utilisateur que tout le reste du plan évite. → **D17**
3. **Le natif n'est pas un canal d'acquisition, c'est un canal de rétention.** Une application
   n'a pas de SEO. Le canal n°1 reste la recherche. L'app **s'ajoute** au site.
4. **Android d'abord** (TWA/Capacitor : 25 $, un seul code, voie bénie par Google pour une
   PWA), **iOS ensuite** via Expo.

**La bonne nouvelle, et elle est structurelle** : `src/domain/` n'importe **rien** — ni réseau,
ni horloge, ni framework. La règle 2, écrite pour la testabilité, se révèle être de la
**portabilité** : les 19 modules partent tels quels. Ce qui ne part pas : `app/`, Tailwind, la
couche SEO.

⚠️ **Le vrai risque n'est ni Apple ni Google : un second codebase est ce qui tue les projets
d'une personne seule.** D'où : partager le domaine, ne pas réécrire.

Sources : [EAS Build](https://docs.expo.dev/build/introduction/),
[EAS Submit iOS](https://docs.expo.dev/submit/ios/),
[Ship an Expo App With EAS Build and Submit (2026)](https://www.generateideas.app/blog/expo-eas-build-submit-guide).

---

## 5. Ce que les rapports réclament et qui était déjà livré

| Recommandation « indispensable » | État réel |
|---|---|
| Intégration JustWatch « où regarder » | ✅ `/tv/{id}/watch/providers` + attribution contractuelle — `src/catalog/provider.ts:192` |
| Demi-étoiles, note par épisode / saison / série | ✅ `docs/RATING-MODEL.md`, la décision de conception n°1 |
| Rewatch qui conserve l'historique (reproché à Trakt) | ✅ journal v3, liste de dates dédupliquée par jour |
| Distinguer « abandonné » de « terminé » | ✅ `DecisionKind` : `paused`, `abandoned` (`journal.ts:319`) |
| Export intégral, souveraineté des données | ✅ règle 9, non négociable depuis le premier jour |
| Barre de progression / % d'avancement | ✅ `remaining.ts`, `/moi` |
| Invite à noter la saison qu'on vient de finir | ✅ `nudge.ts` |
| Application installable sur cinq plateformes | ✅ `app/manifest.ts` (A8) |

---

## 6. Ce qui a été retenu, et pourquoi c'est peu

### 6.1 🔴 `episode_groups` — la vraie trouvaille (tâche 4.4)

**Vérifié en documentation** : `/3/tv/{series_id}/episode_groups` existe, renvoie `results[]`
avec un champ `type` entier, et il existe **7 types** (original air date, absolute, DVD,
digital, story arc, production, TV). **Zéro occurrence dans le dépôt.**

*Non vérifié* : le mapping numérique exact des types, et si `append_to_response` l'accepte —
`TMDB_ACCESS_TOKEN` est **vide** dans `.env`, l'API n'a pas pu être interrogée. À capturer
depuis une réponse réelle avant d'écrire une fixture (**D10**).

**Pourquoi c'est plus grave ici que chez un tracker.** Chez un tracker, un mauvais ordre
d'épisodes = une case cochée au mauvais endroit : visible, agaçant, réparable par
l'utilisateur. Ici, **l'ordre des épisodes est l'entrée de tous les calculs** — `trajectory`,
`entry-point`, le point d'arrêt, `remaining`, `tally`. Si le découpage TMDB en ordre de
diffusion ne correspond pas aux saisons vues sur Netflix, le différenciateur du produit
**rend un conseil faux avec assurance**, et **rien ne le montre** : aucune case n'a l'air
fausse, le chiffre est juste faux. C'est la famille d'échec que le projet a rencontrée quatre
fois — *le code était juste et l'effet nul*.

**La réponse est déjà écrite dans `AGENTS.md` règle 8 : on signale, on ne répare jamais en
silence.** Donc, dans cet ordre : (1) détecter et **avertir** — `seasons.ts` émet déjà des
avertissements, c'est le même canal, une méthode sur `CatalogProvider` (règle 3), un appel mis
en cache 24 h ; (2) le sélecteur d'ordre **seulement si** l'avertissement se révèle fréquent.
Les rapports demandent le sélecteur tout de suite : c'est faire compliqué avant de savoir.

Sources : [TMDB — TV Series Episode Groups](https://developer.themoviedb.org/reference/tv-series-episode-groups),
[TMDB Talk — TV Episode Groups](https://www.themoviedb.org/talk/5e1f71b2d6dbba0015e1e369?language=en-US).

### 6.2 Option de masquage des heures (tâche 4.6)

`tally.ts` annonce « au moins 537 heures — 22 jours et 9 h » et n'a **aucune** option de
masquage. Les rapports notent, à raison, que la métrique est anxiogène pour une part réelle
des gens. Petit, aligné, à prendre.

### 6.3 Rapport des titres non appariés à l'import (tâche 4.7)

Ne jamais écarter en silence : lister, et offrir de résoudre à la main. Règles 8 et 9.
⚠️ **Ne pas investir dans la voie TV Time** que décrivent les rapports (`DioCache.db` par ADB
sur Android rooté) : population minuscule, et le flux **se tarit** depuis la fermeture du
2026-07-15 au lieu de croître.

---

## 7. Ce que cette session a appris sur la méthode

1. **Auditer le résultat, jamais l'intention — y compris celui de sa propre documentation.**
   « Pas de Mac » est un fait ; « donc pas de natif » est une **inférence**. Elle est restée
   écrite comme un fait, marquée « non négociable », dans le fichier que tous les agents
   lisent en premier. **Une contrainte fausse dans une source de vérité coûte plus cher qu'une
   contrainte absente : elle est crue, et personne ne la revérifie.** (Même famille que D14.)
2. **Un rapport externe vaut d'abord par ce qu'il confirme.** Sept recommandations décrivaient
   des choses déjà faites. C'est le signal le plus utile des deux documents.
3. **Une recommandation qu'on adopte doit être vérifiée, pas seulement trouvée séduisante.**
   Trakt était mon idée, elle était élégante, et elle est morte sur un détail de barème que
   dix minutes d'enquête ont suffi à trouver. Le coût de l'enquête était nul comparé à celui
   d'un OAuth écrit pour rien.
4. **Un défaut se trouve en confrontant, pas en relisant.** Le `VALARM` manquant
   (`calendar.ts`) était invisible depuis l'intérieur : 12 tests verts, tous sur la conformité
   du fichier, **aucun sur son effet**. Un `.ics` valide qui ne rappelle rien passe toutes les
   vérifications qu'on avait pensé à écrire.

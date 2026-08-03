# De la page à l'application — comptes, social, six faces

> Écrit le **2026-08-03**, révisé le même jour après une correction de Tristan.
> **Rien de ce document n'est implémenté.**
>
> Il existe parce que les décisions ci-dessous sont **irréparables après coup**, et que ce
> projet a déjà appris quatre fois ce que coûte un modèle décidé trop tard. Un schéma se
> migre ; un schéma **avec des données dedans** se migre beaucoup moins.
>
> Chaque section se termine par un passage **à contre-sens** : on cherche à faire tomber ce
> qui vient d'être proposé. Ce qui survit est écrit ; ce qui tombe est retiré et le motif
> reste, pour qu'on ne le repropose pas dans six mois.

---

## 0. Une correction, d'abord

La première version de ce document affirmait que **le fil d'activité des amis était un
spoiler**. C'était faux, et surdimensionné.

> « Marie a noté *Breaking Bad* ★★★★ » ne révèle rien de l'intrigue. Le nombre de saisons
> d'une série est une information publique. Qu'une amie soit arrivée à la saison 5 ne dit
> rien de ce qui s'y passe.

Ce qui spoile vraiment est bien plus étroit, et se traite à l'affichage :

| Ce qui spoile | Pourquoi | Traitement |
|---|---|---|
| **Les titres d'épisodes** | « The Rains of Castamere » ne dit rien, mais beaucoup de titres racontent l'épisode | Masqués au-delà de la position du lecteur — le seul endroit où la règle 7 s'applique au social |
| **Les agrégats calculés** | « 78 % abandonnent après la S6 » est un jugement sur **la suite** | `redactTrajectory`, déjà écrit. Rien à voir avec un fil d'amis |
| Une **décision** d'abandon située | « Marie a abandonné en S6 » suggère que ça se dégrade | Toléré : c'est un avis, pas un fait d'intrigue. C'est exactement ce qu'on vient chercher |

**Conséquence** : le fil d'activité n'est plus bloqué par la règle 7. Il devient le lot
social n°1, et non le dernier.

---

## 1. Ce qui change, dit franchement

Le produit tient aujourd'hui sur une propriété simple : **il n'a pas d'utilisateurs au sens
technique.** Pas de compte, pas de base, `connect-src 'self'` dans la CSP. C'est ce qui le
rend gratuit là où Letterboxd fait payer, et **vérifiable dans l'inspecteur du navigateur**.

Ouvrir des comptes retire cette propriété. Ce n'est pas un argument contre — c'est le prix
d'un produit social, accepté. Mais il se paie sciemment :

- ⚠️ **La CSP devra ouvrir `connect-src` vers Supabase.** Cette ligne était la forme
  *exécutable* de la promesse. Après, c'est une déclaration — donc le texte de l'interface
  doit être **réécrit**, pas conservé. Laisser « rien n'est envoyé nulle part » sur une page
  qui synchronise serait un mensonge, et le produit s'interdit ça partout ailleurs.

### Le coût, chiffré

**Ça démarre gratuitement** : Supabase offre 500 Mo, 50 000 utilisateurs authentifiés par
mois et 1 Go de stockage ; Vercel héberge sans frais. Trois réserves, aucune bloquante :

1. **Vercel Hobby interdit l'usage commercial.** Le jour où A6 se tranche, c'est un plan
   payant — et l'accord écrit TMDB devient exigible (D6).
2. **Supabase met un projet gratuit en pause après une semaine d'inactivité.** Sur un
   produit qui vise le trafic à froid, c'est une panne invisible.
3. **Le coût par utilisateur est ce qui a tué TV Time** (26,4 M d'installations, motif :
   *pas soutenable en gratuit*). Ce n'est pas une prudence rhétorique, c'est le fait
   fondateur du projet. Il ne dit pas « n'y allez pas » — il dit « sachez à partir de quand
   ça se paie ».

### Le vrai prérequis n'est pas l'argent

**C'est la modération.** Dès qu'il existe des profils, des listes et des avatars, il y a du
contenu de tiers, donc les obligations du DSA : signalement, retrait, point de contact,
information de l'auteur. C'est `TASKS.md` **5.0**, ⛔ bloquant — et il l'était déjà.

---

## 2. Les six faces

**La règle de sélection** : une face existe si elle répond à une question qu'on se pose à
**un moment différent**. Pas à un contenu différent — un moment différent.

| Face | La question | Ce qui existe |
|---|---|---|
| **Découvrir** | « je cherche quoi voir » | l'accueil, `discover` |
| **Mes amis** | « qu'est-ce qu'ils regardent ? » | rien |
| **Ma bibliothèque** | « où j'en suis » | `/moi`, `library.ts` |
| **Le calendrier** | « qu'est-ce qui revient, et quand » | `calendar.ts` — **calculé, jamais affiché** |
| **Les listes** | « ce que je garde et ce que je classe » | rien |
| **Mon bilan** | « qui je suis, en séries » | `tally.ts`, `taste.ts` — livré |

Ne sont **pas** des faces : la **recherche** (elle est partout ; en faire un onglet ajoute
un clic à l'action la plus fréquente), **`/convertir`** (une porte d'entrée SEO, pas une
pièce), les **réglages** (dans le profil).

> 💡 **Deux faces sont déjà calculées et n'ont jamais eu d'écran** : le calendrier
> (12 tests, ne sert qu'à exporter un `.ics`) et le bilan. C'est la forme d'échec la mieux
> documentée du projet — *un module testé mais jamais affiché n'est pas une
> fonctionnalité*. Le cube leur donne une adresse.

### 🔄 À contre-sens

**« Six faces, c'est six fois plus de choses à maintenir pour un produit sans
utilisateurs. »** — Vrai, et c'est pourquoi **quatre des six existent déjà** ou sont à un
écran près. Seules *Amis* et *Listes* sont du travail neuf, et elles sont l'objet de ce
document.

**« Et si une face reste vide ? »** — La face *Amis* **sera** vide au début. Voir §4.4 : on
ne la remplit pas de faux contenu, et elle n'est pas la face par défaut.

**« Le cube impose six, mais si la bonne réponse était quatre ? »** — Alors le cube reste
un logo. C'est une option ouverte, pas un échec : la marque n'a pas besoin que la
navigation lui obéisse.

---

## 3. Les données : une source de vérité, une projection jetable

### 3.1 La décision structurante

> **Le journal local reste la source de vérité. Le serveur en est une réplique. Tout le
> reste est une projection reconstructible.**

Trois raisons, par ordre de force :

1. **`mergeJournals` existe et est prouvé** — huit lois, commutativité vérifiée, dates par
   fait, traces de suppression (`tests/journal-merge.test.ts`). C'est *exactement* le
   problème de la synchronisation multi-appareils, résolu depuis le 2026-08-02. Une base
   autoritaire jetterait ce travail pour le refaire en SQL, moins bien.
2. **Le hors-ligne survit.** `/moi` fonctionne sans réseau ; c'est le seul écran dont on
   puisse le promettre.
3. **La migration est indolore** : les journaux existants montent à la première connexion.

### 3.2 Le problème que ça pose, et sa réponse

Un document JSON par utilisateur **ne se requête pas**. « Les vingt derniers gestes de mes
amis » exigerait de charger le journal entier de chaque ami et de trier en mémoire —
impossible dès la dizaine d'amis.

**C'est la faille principale de la version précédente de ce document, trouvée en le relisant
à contre-sens.** La réponse :

| Couche | Nature | Qui écrit | Reconstructible ? |
|---|---|---|---|
| `journals.document` | Le journal entier, JSON | L'appareil, par fusion | ❌ **C'est la source** |
| `activity` | Un fait plat par ligne, daté, indexé | **Dérivé** du document à chaque synchro | ✅ **Oui, entièrement** |

> **Et c'est ce qui rend la décision réversible.** Une projection se jette et se
> reconstruit ; on peut donc se tromper sur sa forme sans rien perdre. La seule chose
> irréparable reste le document — et il est déjà écrit, testé, et livré.

La projection est possible **grâce à une décision prise deux sessions plus tôt pour une
autre raison** : chaque fait du journal porte sa propre date (v2, pour la fusion). Sans
elle, on ne saurait pas *quand* Marie a noté cette saison, donc il n'y aurait pas de fil.

### 3.3 🔄 À contre-sens

**« Pourquoi ne pas faire simple : un serveur autoritaire, des tables relationnelles, comme
tout le monde ? »** — C'est l'option la plus sérieuse, et elle mérite d'être écrite :

| | Serveur autoritaire | Local + projection |
|---|---|---|
| Social | ✅ trivial | ✅ via la projection |
| Hors-ligne | ❌ perdu | ✅ conservé |
| `mergeJournals` | ❌ jeté | ✅ réutilisé, déjà prouvé |
| Journaux existants | ⚠️ à migrer | ✅ montent seuls |
| Complexité | 1 couche | **2 couches** |

Le local-first coûte une couche de plus. Il la vaut **uniquement parce que la fusion est
déjà écrite** — si elle ne l'était pas, le serveur autoritaire gagnerait. C'est une
décision de circonstance, pas un principe, et elle doit être révisée si la projection
devient plus compliquée que le document qu'elle projette.

**« Deux écritures, donc deux vérités possibles. »** — Non : la projection n'est jamais
écrite par un client, seulement dérivée. Une divergence se répare en la reconstruisant.
C'est vérifiable, et ce sera un test.

**« Et si la dérivation est trop lente ? »** — Elle est proportionnelle à un seul journal
(quelques dizaines de séries), déclenchée à la synchro, pas à la lecture. Si elle devient
lente, c'est que le journal est énorme — un autre problème.

---

## 4. Le fil d'activité

### 4.1 Ce qu'on montre

Le modèle Letterboxd, adapté aux séries. Une ligne = **un avatar, un titre, une affiche, un
geste, une date**.

| Geste | La ligne | Contient un spoiler ? |
|---|---|---|
| Note de série | « Marie a noté *Breaking Bad* ★★★★★ » | non |
| Note de saison | « Marie a noté la **saison 4** ★★★★ » | non — le nombre de saisons est public |
| Série finie | « Marie a terminé *Dexter* » | non |
| Revisionnage | « Marie revoit *The Office* — 3ᵉ fois » | non, et c'est **le signal le plus fort du produit** |
| Abandon situé | « Marie a abandonné *Dexter* en saison 6 » | non (un avis, pas un fait d'intrigue) |
| Note d'épisode | « Marie a noté **S5E14** ★ » | ⚠️ **oui si le titre est affiché** → n° seul, titre masqué au-delà de la position du lecteur |

**Ce que les séries ajoutent aux films, et que Letterboxd ne peut pas montrer** : le
revisionnage compté, la position, et l'abandon situé. C'est notre avantage, pas une
adaptation de leur modèle.

### 4.2 ⚠️ Le piège : l'inondation par import

Quelqu'un qui importe 500 séries de TV Time produirait **500 lignes** dans le fil de tous
ses amis. Le fil devient inutilisable, et c'est le premier geste du produit
(`/convertir`) — donc ça arriverait tout de suite.

**La réponse, simple** : un plafond de lignes par personne et par jour dans la projection
(20). Au-delà, une seule ligne agrégée — « Marie a repris 340 séries ». Pas de champ
supplémentaire dans le journal, pas de marquage d'origine : une règle de projection, donc
modifiable sans toucher à la source de vérité.

### 4.3 ⚠️ Le piège : les dates de repli

Un fait sans date lisible reçoit **l'epoch** (décision v2). Un import en produit beaucoup.
Ces faits ne doivent pas remonter le fil, et ne le peuvent pas : trié par date, l'epoch est
tout en bas. **Le défaut se neutralise tout seul** — mais il faut un test qui le dise, parce
que quelqu'un « corrigera » un jour ce repli sans savoir ce qu'il tient.

### 4.4 ⚠️ Le démarrage à froid

**Le fil sera vide, longtemps.** C'est le problème de tout produit social, et Letterboxd a
mis des années.

Ce qu'on **ne** fait **pas** : le remplir d'activité globale d'inconnus, ni de faux
comptes. Un fil qu'on n'a pas choisi n'est pas un fil d'amis, c'est un flux — et le produit
s'interdit la recommandation algorithmique (`ROADMAP.md` §3).

Ce qu'on fait :

- **La face *Amis* n'est pas la face par défaut.** L'ouverture reste *Découvrir* ou *Ma
  bibliothèque*, qui fonctionnent seules et sans personne.
- **Vide, elle dit quoi faire** : inviter, ou coller un lien de profil. Même traitement que
  la bibliothèque vide, qui mène quelque part au lieu de constater.
- **Un profil est partageable sans compte en face.** C'est le seul mécanisme d'amorçage
  honnête : on partage son bilan (déjà livré), et le lien ramène quelqu'un.

### 4.5 Les avatars

Vous les avez demandés, ils sont au modèle. En deux temps, pour une raison précise :

1. **Étape 1 — un avatar généré**, déterministe à partir du handle : un motif géométrique
   coloré, dessiné en SVG côté client. **Zéro stockage, zéro modération, zéro octet
   téléchargé**, et il sert la direction artistique (des faces colorées, comme le cube).
2. **Étape 2 — l'envoi d'une image**, quand le dispositif de modération existe.

> ⚠️ **L'image est le pire cas de modération** : on ne peut pas la filtrer par mot-clé, elle
> est illisible pour un humain à l'échelle, et le contenu illégal y engage la
> responsabilité de l'hébergeur immédiatement. Livrer l'envoi d'images avant 5.0 serait
> ouvrir la seule porte qu'on ne sait pas refermer.

### 4.6 🔄 À contre-sens

**« Le fil est le cœur du produit social, pourquoi pas en premier ? »** — Il l'est
maintenant (§6). La correction du §0 l'a fait remonter de la place 5 à la place 4.

**« Un fil sans temps réel paraîtra mort. »** — Le temps réel (websockets) coûte une
connexion permanente par visiteur, soit exactement le coût par utilisateur qui a tué TV
Time. Le fil se charge à l'ouverture. Personne n'a besoin de voir la note d'une amie à la
seconde près.

**« Et si quelqu'un ne veut pas être vu ? »** — La visibilité du profil est un réglage, et
la valeur par défaut est tranchée en Q1. Le fil ne montre que ce qu'un profil visible a
produit.

---

## 4bis. Le compte : on se balade librement, on agit avec un compte

**Tranché par Tristan le 2026-08-03.** Tout le monde a un compte. Mais :

> **On circule dans toutes les faces sans compte. Le compte est demandé au premier geste.**

### Le mur, et pourquoi il n'est pas sec

Le piège classique de ce modèle est de **perdre le geste** : on clique « j'en suis à S3E7 »,
on crée un compte, on revient — et le geste a disparu. C'est le défaut le plus fréquent des
inscriptions différées.

La forme retenue l'évite par construction :

1. **Le geste s'applique**, localement et immédiatement. L'utilisateur voit qu'il a été pris.
2. **Puis l'invitation** : *« gardé sur cet appareil — créez un compte pour le retrouver
   ailleurs »*.
3. **À l'inscription, le journal local monte tel quel** par `mergeJournals`.

Trois propriétés en découlent, et aucune ne coûte de code neuf :

- **On montre la valeur avant de la demander.** Le mur sec demande un compte pour une chose
  qu'on n'a pas encore vue fonctionner.
- **Le geste n'est jamais perdu**, sans mécanisme de « geste en attente » à écrire.
- **C'est le journal local d'aujourd'hui**, inchangé. Le compte ajoute une réplique, il ne
  remplace rien.

> ♻️ **Le bandeau `DataSafety` fait déjà ce travail** — il dit « ces notes ne vivent que
> dans ce navigateur, installez l'application ou exportez une copie ». Il devient
> l'invitation au compte. C'est une **réécriture de texte**, pas un composant de plus.

### Où le mur devient dur

Ce qui est **purement local** reste accessible sans compte : la position, les notes, le
bilan, le calendrier. Ce qui **demande le serveur** est fermé, et le dire est honnête plutôt
que frustrant :

| Sans compte | Avec compte |
|---|---|
| Circuler dans les six faces | + Retrouver son journal sur un autre appareil |
| Noter, positionner, décider | + Le fil d'activité et les amis |
| Voir son bilan et son calendrier | + Les listes partagées et le profil |

### ⚠️ Le piège de l'appareil partagé

Un journal local existe sur cet appareil ; quelqu'un d'autre s'y connecte. **Une fusion
silencieuse verserait le journal du propriétaire dans le compte du visiteur** — une fuite de
données, causée par une commodité.

**Règle : jamais de fusion implicite à la connexion.** Si un journal local existe et que le
compte qui se connecte n'est pas celui qui l'a déposé, on demande explicitement :
*« un journal a été trouvé sur cet appareil — le rattacher à votre compte ? »*. Le défaut est
**non**.

### 🔄 À contre-sens

**« Un mur qui ne bloque rien sera ignoré : les gens resteront sans compte. »** — Vrai, et
c'est le prix assumé de ce choix. Il est atténué par le fait que **tout le social est
derrière le compte**, donc quiconque veut un ami s'inscrit. Si la conversion reste trop
basse, le levier est de durcir le rappel après N gestes — pas de bloquer le premier, qui est
celui qui montre à quoi sert le produit.

**« Le RGPD attendra bien le lot 4. »** — Non. Dès le **premier compte** il y a une donnée
personnelle : mentions légales, politique de confidentialité, base légale, droit d'accès et
d'effacement. Ça devient un **prérequis de mise en ligne du lot 2**, pas une tâche de
finition.

**« Le mur va casser le SEO. »** — Non : Googlebot circule et ne clique jamais. Les pages
série restent entièrement lisibles sans compte, ce qui est précisément la balade libre.

**« Alors le hors-ligne meurt ? »** — Non, il se restreint : ce qui est local marche
toujours sans réseau. C'est le hors-ligne d'aujourd'hui, inchangé.

---

## 5. Le schéma

| Table | Colonnes | Décisions |
|---|---|---|
| `profiles` | `id`, `handle`, `display_name`, `visibility`, `created_at` | Le `handle` est une **URL** : jeu de caractères restreint, mots réservés, ancien handle conservé (Q7). `visibility` a **trois** états — `private`, `followers` (défaut), `public` (Q1) |
| `reserved_handles` | `handle`, `reason` | Les noms de routes et les marques. Doit exister **avant** la première inscription : un handle attribué ne se retire pas sans casser une URL |
| `journals` | `user_id`, `document` (jsonb), `updated_at` | Le journal entier. **Fusionné, jamais écrasé** |
| `activity` | `id`, `user_id`, `kind`, `provider_id`, `season`, `episode`, `stars`, `happened_at` | **Projection.** Reconstructible, aucun client n'y écrit, **purgée à 90 jours** (Q9) — même horizon que les traces de suppression du journal |
| `follows` | `follower_id`, `followee_id`, `created_at` | Suivi **asymétrique** comme Letterboxd : pas de négociation à deux, donc pas de file d'invitations, pas de trois états |
| `lists` | `id`, `owner_id`, `title`, `visibility`, `created_at` | `visibility` **dès la création** : la basculer après coup exposerait rétroactivement ce qui a été écrit en privé |
| `list_items` | `list_id`, `provider_id`, `position`, `note` | `provider_id` **préfixé** (`tmdb:1396`), jamais nu — même règle que le journal |
| `reports` | `id`, `reporter_id`, `target`, `reason`, `state`, `created_at` | Écrite **en même temps** que la première feature sociale. Voir §1 |

**Row Level Security dès la première table.** Sur Supabase la base est exposée au
navigateur : sans RLS, un journal est lisible par quiconque a la clé publique. Ce n'est pas
un durcissement, c'est **la** couche d'autorisation.

Trois policies suffisent au départ :

1. `journals` — lecture et écriture par son propriétaire, **personne d'autre, jamais**.
2. `activity` — lecture si le profil est visible **et** que le lecteur suit l'auteur.
3. `lists` — lecture si `visibility = 'public'` ou si le lecteur en est propriétaire.

### Ce qu'on n'ajoute pas, et pourquoi

- **Pas de mot de passe** — lien magique et OAuth. Un mot de passe, c'est une politique, une
  réinitialisation, des fuites, et rien à gagner.
- **Pas de texte libre** avant 5.0. Les réactions structurées s'agrègent mondialement et ne
  demandent pas de modération par langue — c'est déjà la conclusion d'A9.
- **Pas de notifications push.** C'est le coût marginal par utilisateur que `ROADMAP.md` §3
  interdit, et le produit a déjà sa réponse : le calendrier `.ics`, où c'est *quelqu'un
  d'autre* qui paie le rappel.

---

## 6. L'ordre

| # | Lot | Motif | Dépend de |
|---|---|---|---|
| **1** | **Les six onglets, sans compte** | Le calendrier et le bilan existent déjà : leur donner un écran est immédiat, et valide la navigation **avant** d'y accrocher un serveur. C'est aussi **la balade** que §4bis rend libre | — |
| **1bis** | **L'invitation au compte** | Réécriture du bandeau `DataSafety`. Sans serveur : elle décrit ce qui viendra | 1 |
| **2a** | **Mentions légales, confidentialité, effacement, handles réservés, âge** | ⚠️ **Prérequis de mise en ligne**, pas une finition. Contient les trois choses qui ne se rattrapent pas : le texte légal, la table `reserved_handles` (Q7) et l'âge déclaré (Q11) | — |
| **2b** | **Auth + `journals` + synchronisation** | La fusion est écrite et prouvée. Le plus de valeur pour le moins de risque, **aucune** surface sociale ouverte. Inclut le garde-fou de l'appareil partagé | 1bis, 2a |
| **3** | **Modération (5.0)** | ⛔ Prérequis légal, avant toute écriture visible par un tiers | — |
| **4** | **`profiles` + `follows` + `activity` + le fil** | Le cœur social. Débloqué par la correction du §0 | 2b, 3 |
| **5** | **`lists` + partage** | Un objet, un propriétaire, une visibilité | 3 |
| **6** | **Envoi d'avatars** | La porte qu'on ne sait pas refermer. Jamais avant 3 | 3 |

---

## 7. Les questions, tranchées

> ⚖️ **Avertissement.** Plusieurs réponses ci-dessous s'appuient sur le RGPD et le DSA. Je
> ne suis pas juriste et ce projet s'interdit d'inventer des faits : ce qui suit est un
> **état de connaissance à orienter la conception**, pas un avis juridique. Les points
> marqués ⚖️ doivent être confirmés **avant** la mise en ligne du premier compte, pas après.

### Q1 — Un profil est-il public par défaut ? **Non, et ce n'est pas qu'un choix de goût**

⚖️ Le RGPD pose la **protection des données par défaut** (art. 25) : sans intervention de la
personne, ses données ne doivent pas devenir accessibles à un nombre indéterminé de gens. Un
profil public par défaut va frontalement contre.

**Mais « privé » ne veut pas dire « invisible »**, et c'est ce qui débloque le social. Trois
états, pas deux :

| État | Qui voit | Par défaut ? |
|---|---|---|
| `private` | personne | — |
| `followers` | ceux qu'on a acceptés de laisser suivre | ✅ **oui** |
| `public` | tout le monde, **et les moteurs** | opt-in explicite |

🔄 **À contre-sens** — *« Un réseau social qui démarre en privé ne démarre pas. »* Objection
sérieuse. Elle tombe parce que le défaut n'est pas `private` mais `followers` : le fil
d'amis fonctionne dès le premier suivi. Ce qui est fermé par défaut, c'est **l'indexation et
l'inconnu**, pas l'ami.

*« Et le partage de bilan, alors ? »* Il fonctionne déjà **sans profil** — c'est une image
générée côté client (`ShareCard`). Rien à ouvrir.

### Q2 — Chiffrer le journal côté client ? **Non, et il faut le dire au lieu de le cacher**

Un journal chiffré ne serait pas projetable, donc **pas de fil, pas d'amis, pas d'agrégats**.
Le chiffrement de bout en bout et le social sont incompatibles ici ; choisir le social, c'est
renoncer au premier.

**Ce qu'on fait à la place**, et qui est honnête :

- La CSP dira ce qu'elle peut encore prouver — `connect-src` limité au **seul** hôte
  Supabase, ce qui reste vérifiable dans l'inspecteur.
- Le texte de l'interface change. « Rien n'est envoyé nulle part » devient « envoyé à notre
  serveur, à personne d'autre ». **Conserver l'ancienne phrase serait un mensonge.**
- L'export intégral reste non négociable (`AGENTS.md` règle 9).

🔄 **À contre-sens** — *« Chiffrer juste le journal, pas l'activité ? »* Alors le journal ne
peut plus **produire** l'activité, puisque la projection le lit. On aurait le coût du
chiffrement sans sa garantie. Écarté.

### Q3 — Région Supabase : **UE (Francfort ou Paris)**

⚖️ Héberger dans l'UE évite d'avoir à documenter un transfert hors UE. La latence est bonne
pour le public de départ, et pour l'anglophone la donnée personnelle est rare et non
critique (le journal se lit en local d'abord).

🔄 **À contre-sens** — *« Le produit vise l'international, donc les États-Unis. »* Non : le
local-first rend la latence de la base **presque invisible**, puisque la lecture ne l'attend
pas. On paie une latence qu'on ne ressent pas, contre une simplification juridique réelle.

### ~~Q4~~ — ✅ Tranché : on circule librement, on agit avec un compte (§4bis)

### Q5 — Suppression de compte : **on demande, on ne devine pas**

⚖️ Le droit à l'effacement (art. 17) porte sur les **données personnelles**. Une liste
publique enregistrée par d'autres pose un conflit réel : la supprimer casse ce que des tiers
ont gardé ; la garder telle quelle maintient une donnée liée à une personne.

**La réponse est de ne pas choisir à la place de l'utilisateur** — trois lignes dans l'écran
de suppression :

| Donnée | Sort |
|---|---|
| Journal, activité, follows, profil | **Supprimés.** Sans condition, sans délai de grâce déguisé |
| Listes **privées** | Supprimées |
| Listes **publiques** | **Au choix** : anonymisées (elles survivent sans auteur) ou supprimées |

Le titre d'une liste peut être personnel — *« Ce que je regardais pendant ma dépression »* —
donc l'anonymisation ne peut pas être imposée. Et proposer les deux coûte une case à cocher.

🔄 **À contre-sens** — *« Anonymiser suffit toujours, c'est plus simple. »* Non : le contenu
peut rester identifiant. Une case à cocher est moins chère qu'un litige.

*« Et les lignes d'activité déjà lues par des amis ? »* Elles sont dans une **projection**,
donc supprimées avec la source. C'est un bénéfice direct de §3 qu'on n'avait pas anticipé.

### Q6 — Durcir le rappel après N gestes ? **À mesurer, pas à régler au jugé**

C'est le levier si la conversion est trop basse. Il ne se règle pas sans données : ce projet
a payé **trois passes** sur `trajectory.ts` pour avoir choisi des seuils au jugé, et l'a
réappris sur `MAX_ENTRY_FRACTION`.

**Ce qui se décide maintenant, en revanche** : la mesure elle-même. Un compteur local de
gestes sans compte, jamais envoyé — il suffit à afficher un rappel plus insistant, sans
qu'aucune donnée sorte.

---

## 7bis. Les questions que personne n'avait posées

Trouvées en cherchant à faire tomber ce qui précède. Aucune n'était dans la liste initiale.

### Q7 — Un handle peut-il être n'importe quoi ? **Non, et c'est un vrai risque**

`@netflix`, `@admin`, `@support`, ou une insulte : un handle est une **URL publique** et une
usurpation possible. Trois règles, toutes triviales à écrire :

1. Une **liste de mots réservés** (`admin`, `support`, `api`, `moi`, `serie`, `listes`… et
   les six noms de faces) — sinon un handle entre en collision avec une route.
2. Un **jeu de caractères restreint** : `[a-z0-9_]`, 3 à 20. Les caractères Unicode
   ressemblants (`а` cyrillique contre `a` latin) rendent l'usurpation invisible.
3. Un handle libéré **reste réservé** — sans quoi quelqu'un le reprend et hérite des liens
   partagés de son prédécesseur.

⚠️ La règle 1 doit être écrite **avant** la première inscription : un handle déjà attribué ne
se retire pas sans casser une URL.

### Q8 — Quelle taille peut atteindre un journal ? **Mesurer avant de croire que ça tient**

`localStorage` plafonne autour de 5 Mo par origine, et **échoue silencieusement** au-delà.
Un journal de plusieurs milliers de séries — un import Trakt massif — peut s'en approcher.

**Ce qui existe déjà et qui sauve** : le port `JournalStore` (`src/journal/store.ts`) rend le
stockage remplaçable **sans toucher au reste**. Passer à IndexedDB sera une implémentation à
écrire, pas une couche à reprendre.

**Ce qu'on fait maintenant** : rien, sauf mesurer la taille réelle à l'export et le dire si
elle dérive. Écrire IndexedDB aujourd'hui pour un problème que personne n'a serait
exactement le compliqué-avant-l'heure qu'on s'interdit.

### Q9 — La table `activity` grossit indéfiniment. **Rétention : 90 jours**

Un fil append-only sans purge est une facture qui monte toute seule. Personne ne remonte un
fil d'activité à six mois.

**90 jours**, le même horizon que les traces de suppression du journal — un chiffre de plus
qui doit s'accorder avec un existant plutôt que d'être inventé. Et comme `activity` est une
**projection**, la purge ne perd rien : la source reste le document.

### Q10 — Un profil public est-il indexable ? **Oui, et c'est le seul social qui serve le SEO**

Un profil `public` est une page indexable de plus, avec du contenu que personne d'autre n'a.
C'est cohérent avec le canal d'acquisition n°1 — à condition que ce soit **un choix explicite**
(Q1) et que `robots.txt` exclue les profils `followers` et `private`.

⚠️ Piège symétrique : un profil qui **redevient** privé doit sortir de l'index. Une balise
`noindex` ne suffit pas à retirer une page déjà indexée rapidement — il faut aussi qu'elle
réponde 404 ou 410 aux moteurs.

### Q11 — L'âge minimum ⚖️

Un service qui traite des données de mineurs a des obligations renforcées. ⚖️ Le RGPD fixe le
consentement numérique autonome à 16 ans, avec possibilité pour les États de descendre —
**la France a retenu 15 ans**, à confirmer avant mise en ligne.

**Le plus simple qui tienne** : une case déclarative à l'inscription, et pas de collecte de
date de naissance — collecter un âge exact créerait une donnée sensible de plus à protéger,
pour un gain nul.

### Q12 — Que se passe-t-il si Supabase tombe ? **Le produit continue, et c'est un argument**

C'est le bénéfice inattendu du local-first : **panne de base = le produit fonctionne
toujours** en lecture et en écriture locales ; seule la synchronisation attend. Aucun autre
tracker ne peut le dire.

À traiter comme une **fonctionnalité annoncée**, pas comme un détail d'exploitation.

### Q13 — Que contient l'export après les comptes ?

`AGENTS.md` règle 9 : export intégral, **non négociable**. Avec des comptes, « intégral »
grandit — journal, listes, follows, profil. Un export qui ne rendrait que le journal serait
une régression silencieuse de la promesse.

### Q14 — Et si TMDB change ou disparaît ?

Les `provider_id` sont **préfixés** (`tmdb:1396`) dans le journal comme dans `list_items` :
un changement de catalogue reste un remappage, jamais une perte (règle 3). ✅ Déjà résolu,
noté ici parce que la question se reposera à chaque nouvelle table.

---

## 7quater. A6 — la monétisation : freemium cosmétique

**Tranché par Tristan le 2026-08-03.** Modèle Riot Games : le produit reste entièrement
gratuit, on vend de la **personnalisation**.

### Pourquoi c'est le bon choix pour *ce* produit

Ce n'est pas un choix neutre parmi d'autres — il est le seul qui **ne contredise aucune
promesse déjà faite** :

| Modèle | Ce qu'il coûterait |
|---|---|
| Paywall sur les statistiques | Détruit le positionnement entier : le bilan personnel a été construit **contre** le paywall de Letterboxd |
| Publicité | Traçage, donc contradiction frontale avec « vos données restent chez vous » |
| Affiliation streaming | Le classement des offres devient suspect — « où regarder » cesse d'être factuel |
| **Cosmétique** | **Rien.** Aucune donnée, aucune fonctionnalité, aucun jugement n'est mis derrière un mur |

Et un avantage inattendu : **les cosmétiques sont produits par nous**, donc ils n'ajoutent
**aucune charge de modération** — contrairement à tout contenu vendu ou téléversé par des
utilisateurs.

### 🔄 À contre-sens : ce qui doit être vrai pour que ça marche

**« Chez Riot, le cosmétique a de la valeur parce qu'il est vu par d'autres joueurs. »**
C'est l'objection sérieuse, et elle est structurelle :

> **Un cosmétique ne vaut rien sur un profil que personne ne regarde.** Or Q1 fixe
> `followers` par défaut, et le fil sera vide longtemps (§4.4).

Conséquences, à accepter plutôt qu'à contourner :

1. **Le revenu ne peut pas venir avant le social.** A6 est tranché, mais il n'est pas
   *exploitable* avant le lot 4. Compter dessus plus tôt serait une erreur de plan.
2. **Le meilleur véhicule n'est pas le profil, c'est `ShareCard`.** Elle sort du produit et
   se voit par des **non-utilisateurs** — c'est le seul objet du produit qui ait déjà une
   audience. Elle existe, elle dessine sur un canvas côté client, et elle ne coûte rien par
   partage.
3. **Le second véhicule est le cube.** Des faces personnalisables sont cohérentes avec le
   logo, la DA et le nom. C'est la marque qui devient l'objet vendu.
4. **Le taux de conversion d'un free-to-play tourne autour de quelques pour cent.** À
   petite échelle, le revenu est négligeable. Ce modèle finance un produit installé, il ne
   l'amorce pas.

### ⛔ Ce qu'on ne vendra jamais, et qu'il faut écrire maintenant

- **Aucune donnée, aucun calcul, aucun agrégat.** Le bilan, la trajectoire, le point
  d'arrêt, le temps passé restent gratuits pour tout le monde. C'est la ligne qui sépare ce
  produit de celui qu'il critique.
- **Aucun avantage social** — pas de mise en avant payante dans le fil.
- **Aucune limite artificielle** dégradée pour vendre sa levée.

> **La règle en une phrase** : *on vend l'apparence, jamais la réponse.*

### ⚠️ Ce que A6 débloque de bloquant

| # | Conséquence | Statut |
|---|---|---|
| **D6** | **L'usage commercial de TMDB exige un accord écrit.** Établi dès `RESEARCH.md` §300 et `ROADMAP.md` §242 : le freemium *est* un usage commercial. La dette passe de dormante à **active** | ⛔ **Action de Tristan, avant la première vente** |
| Hébergement | Vercel Hobby **interdit** l'usage commercial → plan payant | À prévoir |
| ⚖️ Paiement | Prestataire (Stripe), TVA sur les services numériques dans l'UE, CGV, facturation | Avant le lot de vente |
| ⚖️ Rétractation | Le contenu numérique a un régime particulier ; à vérifier pour un achat cosmétique immédiat | Avant le lot de vente |

> Si l'accord TMDB n'était pas obtenu, le repli existe et il est documenté : changer de
> fournisseur reste **un module à réécrire** (`CatalogProvider`, règle 3), jamais une base à
> migrer. C'est précisément pour ce jour-là que la règle a été posée.

---

## 7ter. Ce qui reste vraiment ouvert

Après ce passage, il ne reste que ce qui demande une décision humaine ou une mesure :

| # | Question | Quand |
|---|---|---|
| Q6 | Le seuil de durcissement du rappel | Après le lot 2b — **à mesurer** |
| **D6** | ⛔ **L'accord écrit TMDB** — activé par A6 | **Avant la première vente.** Action de Tristan |
| ⚖️ | Le régime de rétractation d'un achat cosmétique | Avant le lot de vente |

---

## 8. Ce que ce document a retiré

Trace des simplifications, pour qu'on ne les repropose pas :

- **Le temps réel** — coût par utilisateur, aucun besoin réel (§4.6).
- **Les invitations réciproques** — le suivi asymétrique supprime trois états et une file.
- **Le chiffrement du journal** — incompatible avec la projection, donc avec le fil.
- **L'envoi d'avatars au départ** — remplacé par un avatar généré, qui coûte zéro et sert
  la direction artistique.
- **Un schéma relationnel du journal** — remplacé par un document plus une projection, ce
  qui réutilise `mergeJournals` au lieu de le jeter.
- **Les notifications push** — déjà résolues par le `.ics`.
- **Le mécanisme de « geste en attente »** pendant l'inscription — inutile : le geste
  s'applique d'abord en local, donc il n'y a rien à mettre en attente ni à rejouer.
- **Un composant d'invitation au compte** — le bandeau `DataSafety` existe et dit déjà
  presque cela. C'est un texte à réécrire, pas un composant à ajouter.
- **IndexedDB pour le journal** (Q8) — le port `JournalStore` rend le stockage remplaçable
  plus tard. L'écrire aujourd'hui, pour un plafond que personne n'a atteint, serait le
  compliqué-avant-l'heure qu'on s'interdit.
- **La collecte d'une date de naissance** (Q11) — une case déclarative suffit. Un âge exact
  serait une donnée sensible de plus à protéger, pour un gain nul.
- **Un délai de grâce à la suppression de compte** — c'est de la rétention déguisée. La
  suppression est immédiate (Q5).

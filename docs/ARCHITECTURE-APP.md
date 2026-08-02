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

## 5. Le schéma

| Table | Colonnes | Décisions |
|---|---|---|
| `profiles` | `id`, `handle`, `display_name`, `visibility`, `created_at` | Le `handle` est une **URL**. Changeable, mais l'ancien reste **réservé** pour ne pas casser les liens partagés — un handle libéré serait repris et usurperait quelqu'un |
| `journals` | `user_id`, `document` (jsonb), `updated_at` | Le journal entier. **Fusionné, jamais écrasé** |
| `activity` | `id`, `user_id`, `kind`, `provider_id`, `season`, `episode`, `stars`, `happened_at` | **Projection.** Reconstructible. Aucun client n'y écrit |
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
| **1** | **Les six onglets, sans compte** | Le calendrier et le bilan existent déjà : leur donner un écran est immédiat, et valide la navigation **avant** d'y accrocher un serveur | — |
| **2** | **Auth + `journals` + synchronisation** | La fusion est écrite et prouvée. Le plus de valeur (multi-appareil) pour le moins de risque, et **aucune** surface sociale ouverte | 1 |
| **3** | **Modération (5.0)** | ⛔ Prérequis légal, avant toute écriture visible par un tiers | — |
| **4** | **`profiles` + `follows` + `activity` + le fil** | Le cœur social. Débloqué par la correction du §0 | 2, 3 |
| **5** | **`lists` + partage** | Un objet, un propriétaire, une visibilité | 3 |
| **6** | **Envoi d'avatars** | La porte qu'on ne sait pas refermer. En dernier, jamais avant 3 | 3 |

---

## 7. Les questions ouvertes

| # | Question | Bloque | Recommandation |
|---|---|---|---|
| **Q1** | Un profil est-il public par défaut ? | `profiles` | **Non.** Un produit qui vend « vos données restent chez vous » ne peut pas rendre public par défaut ce qu'il vient de rapatrier |
| **Q2** | Le journal synchronisé est-il chiffré côté client ? | Lot 2 | **Non** — il ne serait plus projetable, donc plus de fil. À dire, pas à cacher |
| **Q3** | Quelle région Supabase ? | Lot 2 | **UE.** Le RGPD s'en trouve simplifié, et la latence est bonne pour le public de départ |
| **Q4** | Que devient l'utilisateur **sans** compte ? | Lot 1 | **Tout fonctionne sans compte** ; le compte ajoute les autres appareils et les autres gens |
| **Q5** | Que se passe-t-il à la suppression d'un compte ? | Lot 4 | Journal et activité supprimés ; les **listes publiques** deviennent anonymes plutôt que de disparaître de chez ceux qui les ont enregistrées. À trancher, c'est un choix RGPD réel |

> **Q4 mérite d'être tranché en premier.** Le produit vit du SEO : la quasi-totalité des
> arrivants n'auront jamais de compte. Une application qui force l'inscription remplace un
> canal d'acquisition qui marche par un mur.

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

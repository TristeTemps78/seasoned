# De la page à l'application — comptes, social, six faces

> Écrit le **2026-08-03**, après la décision de Tristan de passer d'un site à une
> application avec comptes et social. **Rien de ce document n'est implémenté.**
>
> Il existe pour une raison précise : les décisions ci-dessous sont **irréparables après
> coup**, et ce projet a déjà appris quatre fois ce que coûte un modèle décidé trop tard
> (clés de journal, dates par fait, traces de suppression, revisionnage). Un schéma de base
> se migre ; un schéma de base **avec des données dedans** se migre beaucoup moins.

---

## 0. Ce qui change, dit franchement

Le produit tient aujourd'hui sur une propriété simple : **il n'a pas d'utilisateurs au sens
technique.** Pas de compte, pas de base, pas de donnée personnelle hébergée, `connect-src
'self'` dans la CSP. C'est ce qui lui permet d'être gratuit là où Letterboxd fait payer, et
c'est vérifiable par n'importe qui dans l'inspecteur du navigateur.

Ouvrir des comptes retire cette propriété. Ce n'est **pas un argument contre** — c'est le
prix d'un produit social, et il a été accepté. Mais il faut le payer sciemment :

| Ce qu'on perd | Ce qu'on gagne |
|---|---|
| « Rien ne sort de ce navigateur », vérifiable | Le multi-appareil sans transfert manuel |
| `connect-src 'self'` — la CSP prouvait la phrase | Les amis, les listes, les agrégats |
| Zéro obligation RGPD | Une base sur laquelle la Phase 3 devient possible |
| Zéro modération | — |

> ⚠️ **La CSP devra ouvrir `connect-src` vers Supabase.** Cette ligne était la forme
> exécutable de la promesse. Après, la promesse devient une déclaration — donc elle doit
> être **réécrite honnêtement** dans l'interface, pas conservée telle quelle. Laisser
> « rien n'est envoyé nulle part » sur une page qui synchronise serait un mensonge, et le
> produit s'interdit ça partout ailleurs.

### Le coût réel, chiffré

Vous aviez raison sur le point principal : **ça démarre gratuitement.** Supabase offre
500 Mo de base et 50 000 utilisateurs authentifiés par mois ; Vercel héberge sans frais.

Trois réserves, aucune bloquante :

1. **Vercel Hobby interdit l'usage commercial.** Le jour où A6 se tranche (affiliation,
   abonnement), c'est un plan payant — et l'accord écrit TMDB devient exigible (D6).
2. **Supabase met un projet gratuit en pause après une semaine d'inactivité.** Sur un
   produit qui vise le trafic SEO à froid, une base en pause au mauvais moment est une
   panne invisible. À surveiller, ou à sortir du palier gratuit dès le premier utilisateur
   réel.
3. **Le coût par utilisateur est ce qui a tué TV Time** — 26,4 M d'installations, motif
   officiel *« pas soutenable en gratuit »*. C'est le fait fondateur du projet
   (`RESEARCH.md` §0.1), pas une prudence rhétorique. Il ne dit pas « ne le faites pas » ;
   il dit « sachez à partir de quand ça se paie ».

### Le vrai prérequis n'est pas l'argent

**C'est la modération.** Dès qu'il existe des listes partagées, des profils publics et des
avis d'amis, il y a du contenu produit par des tiers, donc les obligations du DSA :
signalement, retrait, point de contact, information de l'auteur. C'est `TASKS.md` **5.0**,
marqué ⛔ **bloquant** depuis l'audit — et il l'était avant cette décision.

Il n'est pas délégable et il ne s'achète pas. Il se conçoit avec la feature sociale, pas
après.

---

## 1. Les six faces

Le cube donne une contrainte, et une contrainte est une bonne nouvelle : elle oblige à
trancher ce qui mérite d'exister.

**La règle de sélection** — une face existe si elle répond à une question qu'on se pose à
**un moment différent**. Pas à un contenu différent : un moment différent.

| Face | La question | Ce qui existe déjà |
|---|---|---|
| **Découvrir** | « je cherche quoi voir » | l'accueil, les rangées, `discover` |
| **Ma bibliothèque** | « où j'en suis » | `/moi`, `library.ts` |
| **Le calendrier** | « qu'est-ce qui revient, et quand » | `calendar.ts` — **calculé, jamais affiché** |
| **Mon bilan** | « qui je suis, en séries » | `tally.ts`, `taste.ts` — livré le 2026-08-03 |
| **Mes amis** | « et les autres ? » | rien |
| **Les listes** | « ce que je garde, ce que je classe » | rien |

**Ce qui n'est pas une face, et pourquoi :**

- **La recherche** — elle est *partout*. En faire un onglet, c'est ajouter un clic à
  l'action la plus fréquente du produit.
- **`/convertir`** — c'est une **porte d'entrée SEO**, pas une pièce. Sa valeur entière est
  d'être trouvée depuis un moteur par les orphelins de TV Time. Dans une barre d'onglets,
  elle occuperait une face pour une action qu'on fait une seule fois dans sa vie.
- **Les réglages** — ils vivent dans le profil, comme partout.

> 💡 **Deux des six faces sont déjà calculées et n'ont jamais eu d'écran** : le calendrier
> (`calendar.ts`, 12 tests, sert uniquement à exporter un `.ics`) et le bilan. C'est la
> forme d'échec la mieux documentée du projet — *un module testé mais jamais affiché n'est
> pas une fonctionnalité*. Le cube leur donne enfin une adresse.

### L'animation d'ouverture

Le cube se déplie en patron, les faces deviennent les onglets. Deux contraintes à tenir :

1. **Elle ne se joue qu'une fois par session**, et jamais avant le contenu. Une animation
   de lancement qui retarde le premier affichage est une régression sur le seul indicateur
   que Google mesure et que ce projet a déjà payé cher.
2. **`prefers-reduced-motion` la coupe** — déjà en place dans `globals.css`. Les mouvements
   3D répétitifs déclenchent des troubles vestibulaires réels.

---

## 2. Les comptes : ce qui se décide maintenant

### 2.1 La décision structurante — le journal local **reste la source de vérité**

C'est le choix le plus important du document, et il est contre-intuitif.

> **Le serveur devient une réplique du journal, pas son propriétaire.** L'appareil écrit
> d'abord en local, puis synchronise.

Trois raisons, dans l'ordre de force :

1. **`mergeJournals` existe déjà, et il est prouvé.** Huit lois de fusion
   (`tests/journal-merge.test.ts`), commutativité vérifiée, dates par fait, traces de
   suppression. C'est *exactement* le problème que pose la synchronisation multi-appareils,
   et il est résolu depuis le 2026-08-02. Une base autoritaire jetterait ce travail pour le
   refaire en SQL, moins bien.
2. **Le mode hors ligne survit.** `/moi` fonctionne aujourd'hui sans réseau ; c'est le seul
   écran dont on puisse le promettre. Un serveur autoritaire le supprime.
3. **La migration est indolore.** Les journaux existants montent vers le serveur à la
   première connexion, au lieu d'être perdus ou réimportés à la main.

Conséquence concrète : la table du journal côté serveur stocke **le document JSON entier**
par utilisateur, plus un horodatage — pas un schéma relationnel éclaté par série. On
synchronise en fusionnant deux documents, avec la fonction déjà écrite.

⚠️ Cela veut dire que le serveur **ne sait pas interroger** les journaux (« quelles séries
sont les plus vues ? »). C'est acceptable tant qu'on n'en a pas besoin ; le jour où les
agrégats de la Phase 3 arrivent, il faudra une **projection** dérivée du document — jamais
un second endroit où l'utilisateur écrit.

### 2.2 Le schéma minimal

| Table | Contenu | Pourquoi |
|---|---|---|
| `profiles` | `id`, `handle`, `display_name`, `created_at` | Le `handle` est **public et immuable** : c'est une URL. Le changer casserait des liens partagés |
| `journals` | `user_id`, `document` (jsonb), `updated_at` | Le journal entier. Fusionné, jamais écrasé |
| `follows` | `follower_id`, `followee_id`, `created_at` | Suivi **asymétrique**, comme Letterboxd. « Ami » réciproque impose une négociation à deux, donc trois états et une file d'invitations |
| `lists` | `id`, `owner_id`, `title`, `visibility`, `created_at` | `visibility` dès la création : la rendre publique après coup expose rétroactivement ce qui a été écrit en privé |
| `list_items` | `list_id`, `provider_id`, `position`, `note` | `provider_id` préfixé (`tmdb:1396`), jamais un identifiant nu — même règle que le journal |
| `reports` | `id`, `reporter_id`, `target`, `reason`, `state` | **Écrite en même temps que la première feature sociale**, pas après. Voir §0 |

**Row Level Security dès la première table.** Sur Supabase, la base est exposée
directement au navigateur : sans RLS, un journal est lisible par n'importe qui avec la clé
publique. Ce n'est pas une couche de durcissement, c'est **la** couche d'autorisation.

### 2.3 Ce qu'on n'ajoute pas

- **Pas de mot de passe.** Lien magique par e-mail et OAuth. Un mot de passe, c'est une
  politique, une réinitialisation, des fuites, et rien à gagner ici.
- **Pas d'avatars hébergés** au départ : du stockage, de la modération d'image, et de la
  bande passante pour un gain nul.
- **Pas de texte libre** tant que 5.0 n'est pas fait. Les réactions structurées s'agrègent
  mondialement et ne demandent pas de modération linguistique — c'est déjà la conclusion
  d'A9.

---

## 3. L'ordre, et pourquoi il n'est pas négociable

| # | Lot | Motif |
|---|---|---|
| **1** | **Les six onglets, sans compte** | Le calendrier et le bilan existent déjà : leur donner un écran est gratuit et immédiatement visible. Et cela valide la navigation **avant** d'y accrocher un serveur |
| **2** | **Auth + `journals` + synchronisation** | La fusion est déjà écrite et prouvée. C'est le lot qui apporte le plus (multi-appareil) pour le moins de risque, et il n'ouvre **aucune** surface sociale |
| **3** | **Le dispositif de modération (5.0)** | ⛔ Prérequis légal. Avant toute écriture visible par un tiers, pas après |
| **4** | **`lists` + partage** | Le social le plus simple : un objet, un propriétaire, une visibilité. Pas d'interaction entre utilisateurs |
| **5** | **`follows` + activité** | Le vrai social. Demande 3 fait, et une réponse à « que voit-on d'un ami ? » qui est une question de **spoiler** autant que de vie privée |

> ⚠️ **La règle 7 d'`AGENTS.md` s'applique au social, et personne n'y pense.** « Rien qui
> dépasse la position du spectateur sans un geste explicite. » Le fil d'activité d'un ami
> qui vient de finir la saison 6 est **un spoiler pour qui en est à la saison 2**. Le
> filtrage vit dans le domaine (`spoiler.ts`), et il devra traverser les agrégats sociaux —
> c'est exactement le piège que `redactTrajectory` a été écrit pour éviter.

---

## 4. Les questions ouvertes, à trancher avant le lot correspondant

| # | Question | Bloque |
|---|---|---|
| Q1 | Un profil est-il public par défaut ? | `profiles` |
| Q2 | Que voit-on de l'activité d'un ami quand on est en retard dans la série ? | Lot 5 |
| Q3 | Le journal synchronisé est-il chiffré côté client ? (Il ne le serait plus interrogeable) | Lot 2 |
| Q4 | Quelle région d'hébergement Supabase ? (RGPD — l'UE simplifie tout) | Lot 2 |
| Q5 | Que devient l'utilisateur **sans** compte ? | Lot 1 |

> **Q5 mérite une réponse tôt.** Le produit vit du SEO : la quasi-totalité des arrivants
> n'auront **jamais** de compte. Si l'application les force à s'inscrire, on remplace un
> canal d'acquisition qui marche par un mur. La position recommandée : **tout fonctionne
> sans compte, le compte ajoute les autres appareils et les autres gens.**

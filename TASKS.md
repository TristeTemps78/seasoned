# TASKS.md — ordonnancement

> Protocole : `C:\Git project\WORKFLOW.md`. **Réserver avant d'écrire** — passer la ligne
> à `🔒 in-progress — @agent — date`, committer la réservation, puis travailler.
> Statuts : `🟢 libre` · `🔒 in-progress` · `✅ done` · `⛔ bloqué`

---

## Arbitrages

| # | Tâche | Statut | Note |
|---|---|---|---|
| A1 | **À quoi sert ce projet ?** | ✅ 2026-08-01 | **Produit à utilisateurs.** Contraire à la reco de l'audit, actée. Conséquences : `ROADMAP.md` §0.1-0.2, audit §6bis |
| A2 | Valider le modèle de notation | 🟡 par défaut | Réputé validé, réserves §8 en vigueur |
| A3 | Social en v1 ? | ✅ 2026-08-01 | **Non — phase 5**, et sous condition de modération |
| A4 | Le nom | 🟡 Tristan | 6 domaines libres à 35 $/an. Reco **`peaked.tv`**, repli `howfar.tv`. Bloquant **avant le premier déploiement public**, pas avant |
| A5 | TMDB ou TheTVDB ? | ✅ 2026-07-31 | TMDB, derrière `CatalogProvider` — réversible |
| A6 | **Monétisation** | 🟡 non fermée | Volontairement non décidée. ⚠️ L'usage TMDB reste **non commercial** : affiliation ou freemium = accord écrit requis (`ROADMAP.md` §4.1) |
| A7 | **Note complète par épisode ?** | ✅ 2026-08-02 | **Oui, tranché par Tristan.** Contraire à `RATING-MODEL.md` §3 couche 2 (« on ne note pas les épisodes, on les distingue »). Comme A1 : les objections deviennent le cahier des charges — `docs/RATING-MODEL.md` §6ter |
| A8 | **Multiplateforme et passage à l'échelle** | ✅ 2026-08-02 | **Cinq plateformes (web, iOS, Android, macOS, Windows) par PWA installable**, et chaque feature doit passer le test « et si 100 000 personnes le font ? ». Renforce `ROADMAP.md` §1.1 au lieu de le contredire — le natif reste matériellement impossible ici |

---

## Phase 0 — Socle ✅

| # | Tâche | Statut | Agent |
|---|---|---|---|
| 0.1 | Dépôt, outillage, TypeScript strict, vitest, CI | ✅ 2026-07-31 | @claude-opus |
| 0.2 | Types de domaine (`src/domain/types.ts`) | ✅ 2026-07-31 | @claude-opus |
| 0.3 | Normalisation des saisons (`seasons.ts`) — le risque n°1 du modèle | ✅ 2026-07-31 | @claude-opus |
| 0.4 | Moteur de trajectoire (`trajectory.ts`) — pic, constance, point de rupture | ✅ 2026-07-31 | @claude-opus |
| 0.5 | Statut réel (`status.ts`) — démasque les séries zombies | ✅ 2026-07-31 | @claude-opus |
| 0.6 | Horizon de spoiler (`spoiler.ts`) — issu de l'audit §2 | ✅ 2026-07-31 | @claude-opus |
| 0.7 | `CatalogProvider` + cache à plafond contractuel + TMDB | ✅ 2026-07-31 | @claude-opus |
| 0.8 | Recherche, roadmap, audit | ✅ 2026-07-31 | @claude-opus |
| 0.9 | **Relecture par un autre agent** (`/code-review`) — rédacteur ≠ relecteur | 🟢 libre | ⚠️ prioritaire, et plus encore depuis A1 |
| 0.11 | Docs alignées sur A1 (roadmap, audit §6bis, modèle §6bis) | ✅ 2026-08-01 | @claude-opus |

---

## Phase 1 — Catalogue public, conçu pour le SEO

**Canal d'acquisition n°1** — le seul qui fonctionne sans aucun utilisateur. Ni compte,
ni base. C'est ce qui rend une page utile à zéro critique (`ROADMAP.md` §0.1).

| # | Tâche | Statut | Note |
|---|---|---|---|
| 1.1 | Application Next.js App Router + Tailwind | ✅ 2026-08-01 | Next 16 / React 19 / Tailwind 4. `src/` et `lib/` réutilisés sans modification |
| 1.2 | `lib/catalog.ts` — provider + cache partagé | ✅ 2026-08-01 | Compose catalogue + domaine ; calcule l'engagement total |
| 1.3 | Recherche de séries | ✅ 2026-08-01 | `<form method=GET>` sans JS — la requête devient une URL |
| 1.4 | Page série : saisons, épisodes, dates, durée totale | ✅ 2026-08-01 | |
| 1.5 | Affichage du **statut réel** | ✅ 2026-08-01 | Le différenciateur. `lib/format.ts` chiffre le silence d'une série zombie |
| 1.6 | SEO : métadonnées, JSON-LD, `robots.txt`, `sitemap.xml` | ✅ 2026-08-01 | Sitemap volontairement minimal — voir `app/sitemap.ts` |
| 1.7 | ISR 24 h — le trafic ne doit rien coûter | ✅ 2026-08-01 | Le build ne touche aucune API : vérifié en CI sans secret |
| 1.8 | Attribution TMDB | ✅ 2026-08-01 | Dans le pied de page, sur toutes les pages |
| 1.9 | Dégradation si le catalogue tombe | ✅ 2026-08-01 | Message lisible au lieu d'une 500. `unavailable` ≠ 404 : ne pas faire désindexer une page valide |
| 1.10 | **Vérifié contre l'API TMDB réelle** | ✅ 2026-08-01 | A révélé **deux défauts invisibles hors ligne** — voir ci-dessous |
| 1.11 | Dépôt GitHub public | ✅ 2026-08-01 | https://github.com/TristeTemps78/seasoned — CI verte au premier push |
| 1.12 | **Mise en ligne** | ✅ 2026-08-01 | **https://seasoned-two.vercel.app** — redéploiement automatique à chaque push |
| 1.13 | Chercher un cas « zombie » | ✅ 2026-08-01 | **Aucun sur 12 séries.** Résultat, pas échec — a produit un recentrage du différenciateur, voir plus bas |
| 1.14 | **Découvrabilité** — l'accueil et le sitemap ouvrent le chemin vers `/serie/*` | ✅ 2026-08-01 | 0 → 20 liens ; 1 → 147 URLs |
| 1.15 | Statut réel visible sur les vignettes | ✅ 2026-08-01 | Hydratation réservée aux pages en cache. Home restée `○ Static` / 1d — vérifié au build |
| 1.16 | Maillage interne entre pages série | 🟢 libre | Une page série ne renvoie vers aucune autre : cul-de-sac pour le crawl comme pour le visiteur |
| 1.17 | Fixtures **capturées** depuis de vraies réponses TMDB | 🟢 libre | Dette D10 — les fixtures actuelles sont écrites de mémoire |
| 1.18 | Filtre de vitrine par nature de programme | ✅ 2026-08-01 | `src/domain/program.ts`. Sitemap 146 → 110 pages série. Ne filtre que la vitrine, jamais le catalogue |
| 1.19 | **Seuil de « sans nouvelle » relatif au rythme de la série** | ✅ 2026-08-01 | `src/domain/cadence.ts`. Corrige *Les Griffin*, préserve *Majhi Manasa*. Calibrage du facteur ouvert → D12 |
| 1.20 | Calibrer `CADENCE_ANOMALY_FACTOR` sur un échantillon réel | 🟢 libre | D12. Mesurer, pas régler au jugé |
| 1.21 | **La trajectoire s'affiche**, sur les notes du public TMDB | ✅ 2026-08-01 | Derrière un geste explicite. `computeTrajectory` servait enfin — après trois corrections, voir ci-dessous |

### ✅ 1.35 → 1.56 — Bloc du 2026-08-02, sous contraintes A7 et A8

Vingt-six boucles à contre-sens ont fait apparaître trois failles de fond : le produit
**se souvenait sans lieu de restitution** ; le **seul geste offert supposait la série déjà
commencée** alors que les arrivants viennent du SEO ; et le **multiplateforme est un
problème d'identité et de fusion**, que le format d'alors rendait impossible sans perte.

> ⚠️ **Statuts remis en accord avec le code le 2026-08-03** — c'est la dette D14 : quinze
> lignes ci-dessous étaient encore `🟢 libre` alors que le code correspondant est en
> production depuis le 2026-08-02. Vérifié fichier par fichier, pas de mémoire.

| # | Tâche | Statut | Preuve dans le code |
|---|---|---|---|
| 1.35 | **Clés de journal préfixées par fournisseur** (`tmdb:1396`) | ✅ 2026-08-02 | `journalKey()` dans `src/domain/journal.ts` |
| 1.36 | **Fusion au niveau du champ** — deux appareils ne se perdent pas | ✅ 2026-08-02 | `mergeJournals`, 8 lois dans `tests/journal-merge.test.ts` |
| 1.37 | **Port `JournalStore`** — patron `CatalogProvider` | ✅ 2026-08-02 | `src/journal/store.ts` + `local.ts` |
| 1.38 | **Garantie anti-fuite** : aucun journal côté serveur | ✅ 2026-08-02 | `tests/no-journal-on-server.test.ts` |
| 1.39 | **Manifeste + icônes** — l'application devient installable | ✅ 2026-08-02 | `app/manifest.ts` |
| 1.40 | **Service worker minimal + page hors-ligne** | ✅ 2026-08-02 | `app/components/ServiceWorker.tsx`, `app/(site)/hors-ligne` |
| 1.41 | Journal v2 : watchlist, notes d'épisode, snapshot à TTL, plateformes | ✅ 2026-08-02 | `journal.ts` v2 |
| 1.42 | `src/domain/library.ts` et `taste.ts` — purs | ✅ 2026-08-02 | 27 tests |
| 1.43 | **« Je veux la voir »** — le premier geste possible | ✅ 2026-08-02 | `setWanted`, `MyProgress` |
| 1.44 | **Étoiles cliquables** au lieu du `<select>` | ✅ 2026-08-02 | `StarRating.tsx` |
| 1.45 | **Grille d'épisodes vivante** : position + mes notes + commutateur | ✅ 2026-08-02 | `EpisodeGrid.tsx` |
| 1.46 | `MyProgress` : suggestion de note de saison, placeholder correct | ✅ 2026-08-02 | `MyProgress.tsx` |
| 1.47 | **`/moi`** — le lieu qui manquait, zéro appel API | ✅ 2026-08-02 | `app/(site)/moi/` |
| 1.48 | **Export / import JSON** — règle 9 d'`AGENTS.md` | ✅ 2026-08-02 | `JournalTransfer.tsx` |
| 1.49 | Bande **« Reprendre »** sur l'accueil | ✅ 2026-08-02 | `ResumeStrip.tsx` |
| 1.50 | **`redactTrajectory` branché** — la courbe se révèle à mesure | ✅ 2026-08-02 | `TrajectorySection.tsx` |
| 1.51 | **Mes plateformes** — « dispo chez vous » | ✅ 2026-08-02 | `MyPlatforms.tsx` |
| 1.52 | **Profil de goût** | ✅ 2026-08-02 | `TasteCard.tsx`, `taste.ts` |
| 1.53 | **Trajectoire partageable en image** (canvas, côté client) | ✅ 2026-08-02 | `ShareCard.tsx` |
| 1.54 | `npm run check` + build `○ Static` + test anti-fuite | ✅ 2026-08-02 | 306 tests |
| 1.55 | Vérification au navigateur, PWA comprise (hors-ligne) | ✅ 2026-08-02 | |
| 1.56 | Mesures : poids JS, coût à 100 000, en-têtes en production | 🔒 in-progress — @claude-opus — 2026-08-03 | D13 rouvert : le chiffre de 194 Ko date d'avant la couche des gestes |

### 🔒 Bloc du 2026-08-03 — le filet, la langue, et les cinq gestes qui manquent

**Réservé — @claude-opus — 2026-08-03.** Motif, et non liste de tâches : le produit sait
**se souvenir** et sait **parler deux langues**, mais les deux ne se rencontrent pas —
seize modules `'use client'` sont en français en dur *et* sans un seul test. Migrer seize
fichiers sans filet est précisément le geste qui casse en silence. D'où l'ordre : le
harnais d'abord, la langue ensuite, les gestes après.

| # | Tâche | Statut | Motif |
|---|---|---|---|
| 1.61 | Harnais de test de composants (`jsdom`, `include` en `.tsx`) | ✅ 2026-08-03 | Deux projets vitest. **Le domaine reste sous `node`** : un `document` global rendrait invisible une violation de la règle 2 |
| 1.59 | Migrer les composants client vers le dictionnaire | ✅ 2026-08-03 | Contexte de langue + `tests/no-hardcoded-strings.test.ts`. Six défauts trouvés, voir ci-dessous |
| A4 | **« Il vous reste 15 épisodes · 11 h 15 »** | ✅ 2026-08-03 | `src/domain/remaining.ts`, 12 tests |
| A5 | Rappel de noter la saison qu'on vient de finir | ✅ 2026-08-03 | `src/domain/nudge.ts`, 9 tests. Un seul rappel à la fois |
| A2 | Import des exports concurrents | ✅ 2026-08-03 | `src/domain/import.ts`, 14 tests. **Aucun format connu nommément** — voir le motif |
| A3 | `/convertir` — la page qui capte les orphelins | ✅ 2026-08-03 | Indexable, au sitemap, liée depuis chaque pied de page |
| A6 | Calendrier `.ics` des prochains épisodes | ✅ 2026-08-03 | `src/domain/calendar.ts`, 12 tests |
| 1.62 | **Langue du catalogue par page** | ✅ 2026-08-03 | Un fournisseur par langue, la locale dans la clé de cache. Voir ci-dessous — c'était sévère |
| 1.63 | **Faille XSS dans le JSON-LD** | ✅ 2026-08-03 | `lib/jsonld.ts`. Voir ci-dessous |
| 1.64 | En-têtes de sécurité HTTP | ✅ 2026-08-03 | CSP sans nonce, assumé : un nonce détruirait le cache |
| 1.56 | Mesures : poids JS, en-têtes en production | ✅ 2026-08-03 | D13 refermée : **162 Ko gzip** sur `/`, 166 sur `/moi` |

### 🔴 Ce que l'audit du 2026-08-03 a trouvé, et que rien d'autre ne voyait

Quatre défauts, tous dans du code déclaré fait, tous invisibles au typage et aux tests.

**1. Une faille XSS réelle dans les données structurées.** La page série injectait
`JSON.stringify(jsonLd)` dans une balise `<script>`, avec en commentaire « contenu
construit par nous, jamais du HTML tiers ». Le raisonnement est faux sur un point :
**`JSON.stringify` n'échappe pas `<`**. Un titre valant `</script><script>…` refermait la
balise et faisait exécuter la suite — sur toutes les pages servies depuis le cache de
bord, donc pour tous les visiteurs, avec accès au journal rangé dans `localStorage`.

> **Ce que ça apprend** : *les titres viennent de TMDB, alimenté par des contributeurs.*
> Au sens de la sécurité, c'est une entrée non fiable, au même titre qu'un champ rempli
> par un visiteur. Le parsing tolérant (`AGENTS.md` règle 4) protège du **mal formé**,
> pas du **malveillant** — et le premier a masqué le second pendant tout le projet.
>
> Détail savoureux : la première version de `lib/jsonld.ts` écrivait `U+2028` en clair,
> et **le compilateur TypeScript a refusé de la lire**. La démonstration la plus courte
> possible de ce contre quoi la fonction protège.

**2. La langue du catalogue ne suivait pas la page — quatrième occurrence.**
`lib/catalog.ts` portait ce commentaire depuis le premier jour : « la langue du catalogue
doit suivre celle du site : servir une page anglaise avec des synopsis français serait
pire que ne pas traduire du tout ». Et le code lisait `TMDB_LANGUAGE`, **une variable
globale**, qui valait `fr-FR`. Donc les pages **anglaises** — celles que les moteurs
indexent, le canal d'acquisition n°1 — servaient des synopsis français.

Corrigé par un fournisseur par langue **et la locale dans la clé de cache**. Le second
point est le plus vicieux : sans lui, la première requête d'une série fixe la langue de
son synopsis pour toutes les suivantes, `/serie/1396` et `/fr/serie/1396` se servant
mutuellement leur contenu **selon qui arrive en premier**. Un défaut qui ne se reproduit
pas à la demande et disparaît à chaque redémarrage. `tests/catalog-locale.test.ts` le
mesure sur le **nombre d'appels**, seule façon de le rendre visible.

**3. `robots.txt` ne couvrait que l'anglais.** `/recherche`, `/moi`, `/hors-ligne` étaient
exclus ; `/fr/recherche`, `/fr/moi`, `/fr/hors-ligne` ne l'étaient pas. Le budget de crawl
partait sur des pages vides par construction. La liste est désormais **dérivée** des
langues servies.

**4. Six défauts d'i18n dans des fichiers marqués ✅.** Le bandeau de sécurité devinait sa
langue via `navigator.language` — sur `/fr`, un navigateur anglophone recevait un bandeau
anglais **au milieu d'une page française**. `StatusBadge` ne recevait pas la locale : le
différenciateur même du produit s'affichait en anglais sur les pages françaises.
« Disponibilité en France » était servi en dur à des lecteurs américains. La virgule
décimale était codée en dur. Et **tous** les liens internes étaient absolus : depuis `/fr`,
chaque clic ramenait en anglais — vers des adresses qui, pour `/fr/moi` et `/fr/recherche`,
n'existaient même pas.

> **La leçon de la bascule se prolonge d'un cran.** On savait qu'il ne suffit pas de
> changer un défaut pour servir une alternative — il faut qu'elle ait une adresse. Il
> faut aussi que **les chemins y restent**.

### Ce que l'audit a mesuré plutôt que supposé

| Sujet | Résultat |
|---|---|
| **Poids JS** (D13) | **162 Ko gzip** sur `/`, **166 Ko** sur `/moi`. La couche des gestes — 18 modules client — coûte donc **~4 Ko** : le reste est le socle Next/React. L'ancienne ligne « 194 Ko pour zéro composant client » était fausse **dans les deux sens**. |
| En-têtes servis | Aucun avant. Désormais CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` — vérifiés sur la réponse réelle, cache toujours `HIT`. |
| CVE `sharp` (haute) | **Non exploitable ici, et vérifié** : `images.unoptimized: true` et **aucun `next/image`** dans le dépôt, donc le chemin de code n'est jamais exercé. Next 16.2.12 est déjà la dernière version — rien à mettre à jour. Consigné plutôt que maquillé. |
| CVE `esbuild` (modérée) | Fermée : vitest 2 → 4. |
| Code mort | 92 exports sans usage externe, dont **3 vrais** (re-exports de confort). Le reste est de l'inférence de types — faux positifs assumés. |

**⚠️ CSP sans nonce, et c'est un arbitrage, pas un oubli.** Une politique à nonce est la
seule qui neutralise vraiment le script injecté ; elle exige une valeur différente **par
réponse**, donc un rendu par requête, donc la destruction du cache de bord — c'est-à-dire
de ce qui tient le budget. `script-src` reste permissif, tout le reste est fermé, et le
seul endroit où du contenu tiers entre dans une balise `<script>` est traité à la source.

---

## 🔄 Reprise à froid — état au 2026-08-02 (fin de session)

**Tout est committé, `main` propre. 306 tests verts, typecheck strict vert, build vert,
toutes les routes `○ Static`.** Cinq commits : `a46b4cf` (fusion) · `2fa1292` (i18n +
DataSafety) · `2ae1816` (bascule `en`) · `40b4f99` (doc) · `bfd070e` (routage locale).

### À faire en premier, dans cet ordre

1. **Vérifier en production** (rien d'autre ne peut le prouver) : les `hreflang` d'une page
   série (`/serie/1396` et `/fr/serie/1396`) — non observables en local, le catalogue y
   était indisponible ; et `X-Vercel-Cache: HIT|PRERENDER` sur `/fr/serie/1396`.
2. **⚠️ Vider `TMDB_LANGUAGE` dans l'environnement Vercel.** Un `fr-FR` oublié servirait
   des synopsis français sur des pages `lang="en"` — pire que ne pas traduire.
3. **1.61 harnais de test de composants** (`jsdom` + testing-library, `include` en `.tsx`).
   15 modules `'use client'`, zéro test — dont `DataSafety` et `LanguagePicker`, livrés
   sans filet. Prérequis de 1.59.
4. **1.59 migrer les ~14 composants restants** vers le dictionnaire (`/moi`, `EpisodeGrid`,
   `MyProgress`, `StarRating`, `ShareCard`, `TasteCard`…). Encore en français en dur.
5. **Vague A** (plan complet dans le fichier de plan de session) : A4 « il vous reste
   14 épisodes · 9 h 20 », A5 rappel de noter la saison, A2 import, A3 `/convertir`,
   A6 calendrier `.ics`.

### La méthodologie qui a produit ces cinq commits

Elle a trouvé trois défauts réels que ni le typage, ni les tests, ni le build ne voyaient.
À rejouer telle quelle :

1. **Prendre l'hypothèse et la retourner** avant d'écrire. « localStorage est gratuit » →
   c'est une perte de données silencieuse. « Le social demande de la modération » → pas les
   réactions structurées. « Détecter la langue du visiteur » → casse le cache **et** le SEO.
2. **Réserver dans `TASKS.md`**, en y écrivant *le motif*, pas la tâche.
3. **Écrire le test qui échoue d'abord si possible — sinon vérifier qu'il échouerait.**
   Preuve exigée : en réintroduisant le défaut, 4 des 8 lois de fusion tombent. Un test qui
   passe avant et après ne prouve rien.
4. **`npm run check` puis `npm run build`.**
5. **Puis auditer le résultat servi, pas l'intention.** C'est l'étape qui paie : `lang="en"`
   sur `/fr`, le sitemap contradictoire, les alternates. ⚠️ Et se méfier de sa propre
   vérification — la première passe sur les pages série était **biaisée** (catalogue en
   panne, page de repli) et ne prouvait rien.
6. **Commit atomique**, message qui dit *pourquoi*, doc à jour dans le même commit.

> **La règle du projet confirmée une troisième fois** (après le SEO en cul-de-sac et le
> cache inopérant) : **le code peut être juste et l'effet nul.** Rien ne remplace de
> regarder ce qui sort.

---

## Lot 0 — ce qui doit être corrigé **avant** qu'il existe deux appareils

> Découvert le 2026-08-02 en préparant la synchro. Ces trois points sont invisibles
> aujourd'hui (un seul appareil, un seul journal) et **corrompent silencieusement les
> données dès qu'il y en a deux**. `mergeJournals` est la primitive sur laquelle repose
> toute la phase 2 : elle doit être juste avant d'être utilisée, pas après.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 0.10 | **`laterOf` n'est pas commutatif sur l'égalité de date** | ✅ 2026-08-02 | `journal.ts` l. 789 : `>` strict, donc à date égale c'est **l'ordre des arguments** qui tranche. `merge(A,B) ≠ merge(B,A)` → deux appareils divergent et se battent indéfiniment. Départager par un ordre stable et total. |
| 0.11 | **La date de repli d'un fait est l'horloge du lecteur** | ✅ 2026-08-02 | `journal.ts` l. 253 `readInstant(…, fallback)` : un fait sans date lisible reçoit `new Date()` **de celui qui lit**. Deux appareils lisant le même export lui donnent deux dates. Repli sur l'epoch pour les **faits** ; l'horloge de lecture ne reste légitime que pour l'**expiration** des pierres tombales. |
| 0.12 | **Les deux défauts se composent** | ✅ 2026-08-02 | Un import où plusieurs faits n'ont pas de date leur donne **tous la même** date de repli → égalités exactes → 0.10 se déclenche en masse. C'est précisément le scénario de l'import multi-formats (A2). |
| 0.13 | Tests de propriété sur `mergeJournals` (idempotence, commutativité, associativité, convergence) | ✅ 2026-08-02 | `tests/journal-merge.test.ts`, sans nouvelle dépendance (générateur congruentiel déterministe, dates piochées dans un jeu de **trois** pour forcer les ex aequo). Les 410 lignes de `tests/journal.test.ts` étaient des **exemples** ; aucune ne vérifiait les lois. Lois énoncées sur les **entrées** : `deviceId` n'est pas commutatif **par contrat**, `platforms` est un ensemble non ordonné. |

> **Vérifié, et c'est le point** : en réintroduisant l'ancien départage, **4 des 8 tests
> tombent** (commutativité, convergence, et les deux cas ciblés) — tandis qu'idempotence
> et associativité restent vertes. La fusion n'était donc cassée que sur la
> commutativité, et un test qui ne l'aurait pas montré n'aurait rien prouvé.
> `npm run check` : **276 tests verts**, typecheck strict vert.

---

## 🌍 A9 — le produit vise l'international (tranché par Tristan, 2026-08-02)

**Ce n'est pas un élargissement du produit, c'est un multiplicateur du seul canal qui
marche à froid.** Le SEO est le seul canal d'acquisition qui fonctionne sans utilisateurs
(`ROADMAP.md` §0.2) ; une page en français ne capte pas *« is X worth watching »*, qui est
un marché d'un ordre de grandeur plus grand.

**Et le projet est structurellement bien placé pour le faire** :

> Le différenciateur est **language-agnostic**. Statut réel, temps écoulé chiffré,
> trajectoire, point d'arrêt, taux d'abandon se calculent **sans langue** — tout
> `src/domain/` est déjà muet, et le reste muet : rien de `lib/i18n.ts` n'y est importé.
> Un site de critiques doit traduire son contenu ; nous avons une centaine de chaînes.

**Trois conséquences à ne pas perdre de vue** :

1. **Le social structuré devient encore plus juste.** Le texte libre fragmente par langue
   et rend la modération multilingue ingérable pour une personne seule. Un jeu fermé de
   réactions s'agrège **mondialement** et se traduit une fois. L'international renforce
   l'arbitrage social au lieu de le compliquer.
2. **⚠️ Le coût catalogue est multiplié par le nombre de langues** : TMDB renvoie des
   métadonnées traduites, donc une requête par langue. La rupture décrite au dimensionnement
   arrive N fois plus vite avec N langues. À intégrer avant d'ajouter la troisième langue.
3. **La négociation par en-tête n'existe pas sur une page statique.** Les pages sont
   `force-static` — c'est ce qui tient le budget. La langue se décide donc soit à la
   construction (routage par locale), soit côté client. Pas au rendu.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 1.57 | **Socle i18n** — `lib/i18n.ts` : langues servies, négociation `Accept-Language` tolérante, étiquette BCP 47, région de repli, dictionnaire typé | ✅ 2026-08-02 | 12 tests. **Le typage rend une clé manquante fatale à la compilation** : une traduction incomplète ne peut pas atteindre la production. `fr` fait foi. |
| 1.58 | **Bandeau de sécurité des données** (A0 + A1 réunis) | ✅ 2026-08-02 | `app/components/DataSafety.tsx`. Voir ci-dessous. |
| 1.59 | Migrer les chaînes existantes vers le dictionnaire | 🟡 **partiel** | ✅ Faits : `lib/format.ts` (le différenciateur), `layout`, accueil, page série, métadonnées, langue du catalogue. 🟢 Restent : les ~14 composants `'use client'` (`/moi`, `EpisodeGrid`, `MyProgress`, `StarRating`, `ShareCard`, `TasteCard`…). **Volontairement pas fait dans le même lot** : sans test de composant, migrer 14 fichiers d'un coup est un risque sans filet. À faire après 1.61. |
| 1.60 | **Routage par locale + `hreflang` + sitemap par langue** | ✅ 2026-08-02 | `/` en anglais, `/fr` en français. `lib/routes.ts` (12 tests), deux dispositions racines, sélecteur de langue, `hreflang` réciproques, sitemap avec alternates. Deux décisions contre-intuitives : anglais **sans** préfixe, et **aucune redirection automatique**. Motifs ci-dessous. |
| 1.61 | Harnais de test de composants (`jsdom`, `include` en `.tsx`) | 🟢 libre | Prérequis de 1.59. `vitest.config.ts` fixe `environment: 'node'` et `include: '**/*.test.ts'` : **aucun test de composant n'est possible aujourd'hui**, pour 15 modules `'use client'`. |
| **A10** | **Quelle langue par défaut ?** | ✅ **`en`**, tranché 2026-08-02 | Sur un site statique, « par défaut » n'est pas une préférence : c'est **la langue de la page que les moteurs indexent**, donc une décision d'acquisition. Le français n'est pas rétrogradé, il cesse d'être implicite — et il est désormais **testé explicitement**, ce qu'il n'était pas : tant qu'il était le défaut, les tests qui ne précisaient rien le vérifiaient par accident. |

### ⚠️ Ce que la bascule a révélé, et qu'il faut regarder en face

**En basculant le défaut sur `en` sans routage par locale, le français n'est plus servi
nulle part.** Les traductions existent, elles sont complètes, elles sont testées — et
**aucune URL ne les rend**. « Traduire vers l'anglais » a donc, de fait, *retiré* une
langue du site au lieu d'en ajouter une.

C'est le genre d'effet qu'on ne voit pas en lisant le diff : chaque changement était juste
isolément, et le résultat d'ensemble est une régression. Conséquence : **1.60 n'est plus
une amélioration SEO, c'est la réparation d'une perte**. Tant qu'il n'est pas fait, le
produit est monolingue — en anglais.

Le raisonnement reste bon (l'anglais devait devenir la page indexée) ; c'est l'ordre qui
était incomplet. La règle à en tirer : **changer un défaut ne suffit pas à servir une
alternative — il faut d'abord qu'elle ait une adresse.**

### 1.60 — les deux choix contre-intuitifs, et pourquoi

**1. L'anglais reste sans préfixe.** `/serie/1396` sert l'anglais, `/fr/serie/1396` le
français. La symétrie (`/en/…` et `/fr/…`) serait plus élégante et **casserait toutes les
URL déjà indexées** — le site est en ligne depuis le 2026-08-01 avec un sitemap. Or le SEO
est le canal n°1 : sacrifier l'indexation acquise pour de la symétrie serait payer cher un
confort de lecture du code. L'asymétrie est le prix de la continuité, et elle est assumée.

**2. ⛔ Aucune redirection automatique selon `Accept-Language`.** C'est le réflexe naturel,
et c'est le mauvais choix ici, pour trois raisons qui se cumulent :
- **Elle casserait le cache.** Un middleware s'exécute à *chaque* requête, y compris celles
  que le CDN servirait sans nous. C'est une invocation facturée par visite — exactement le
  coût par utilisateur que `ROADMAP.md` §1.4 interdit, et ce qui a tué TV Time.
- **Elle saboterait le SEO.** Googlebot explore majoritairement depuis les États-Unis avec
  un `Accept-Language` anglais. Redirigé, il pourrait ne **jamais** voir les pages
  françaises — on aurait traduit pour un moteur qui ne le saurait pas.
- **Elle surprend.** Cliquer sur un lien anglais partagé par quelqu'un et atterrir en
  français est un bug du point de vue de l'utilisateur.

→ Les adresses sont **explicites**, et le changement de langue est **un lien qu'on clique**,
jamais une décision prise à notre place.

**3. Les `hreflang` doivent être réciproques et auto-référents.** Chaque version déclare
**toutes** les versions, y compris elle-même, plus un `x-default`. Une déclaration non
réciproque est purement et simplement ignorée par Google — c'est l'erreur classique, et elle
est silencieuse : la balise est là, elle a l'air juste, elle ne sert à rien.

### 1.60 — ce que la vérification a trouvé, et que rien d'autre n'aurait trouvé

Le typage était vert, les 306 tests verts, le build vert, **et `/fr` servait du français en
s'annonçant `lang="en"`**. Un seul `<html>` existe par page, et il vivait dans une
disposition racine unique qui écrivait la langue par défaut en dur.

Ce n'est pas un détail cosmétique : un lecteur d'écran prononce alors le français avec la
phonétique anglaise, et le signal envoyé aux moteurs contredit le contenu. **C'est la
troisième fois que ce projet rencontre cette forme d'échec** — le SEO en cul-de-sac, le
cache inopérant, et maintenant `lang` — et la règle tient : **auditer le résultat, jamais
l'intention.**

Réparé par **deux dispositions racines** (`app/(site)` et `app/(fr)`), chacune de trois
lignes, tout ce qui pourrait diverger vivant dans `SiteChrome`. Une page ne portant qu'un
seul `<html>`, c'est la seule façon correcte de faire varier `lang`.

Deux autres trouvailles de la même vérification :
- Le sitemap écrivait la racine sous **deux formes** (`…:3000` dans `<loc>`, `…:3000/` dans
  l'alternate). Sans effet — Google normalise la racine — mais un document qui se contredit
  fait chercher un bug ailleurs le jour où il y en aura un. Normalisé.
- Le test de conformité `no-journal-on-server` est tombé au déplacement des fichiers : il
  citait des chemins en dur. **C'est son rôle** — mais un test de conformité qui casse pour
  un déplacement apprend à être ignoré, d'où le groupe nommé en constante.

⚠️ **Ce que cette vérification n'a PAS pu prouver** : le catalogue était indisponible en
local, donc les pages série ont servi leur repli et **leurs `hreflang` n'ont pas pu être
observés**. Le chemin de code est le même (`alternatesFor`), couvert par 12 tests et
vérifié sur l'accueil — mais **à re-vérifier en production**, comme le cache l'a été.

### 1.58 — ce que le bandeau répare, et pourquoi il se tait la plupart du temps

Le produit promet de garder la trace, et l'écrit dans `localStorage`. Or **Safari efface
tout stockage inscriptible par script après sept jours d'usage du navigateur sans
interaction avec le site**, et le public visé revient tous les un à trois mois. Le trou
d'engagement (D9) n'était donc pas seulement un problème de rétention : c'était une
**destruction de journal**.

**La nuance qui change tout** : une application ajoutée à l'écran d'accueil y échappe. La
protection existait déjà dans le produit — elle était conditionnée à un geste que rien
n'invitait à faire. D'où la formulation : installer n'est pas un confort, c'est **ce qui
empêche de perdre ses notes**.

Trois règles pour que ce ne soit pas une nuisance : rien tant qu'il n'y a rien à perdre ;
**rien si l'application est déjà installée** (le risque n'existe plus — continuer à
l'annoncer apprendrait à ignorer nos messages) ; « plus tard » ne revient qu'après quatre
gestes de plus — le refus se mesure en **gestes**, pas en jours, parce que ce qui augmente
le risque est le travail accumulé.

Vérifié : `npm run build` reste vert et **toutes les routes restent `○ Static`**, y compris
`/serie/[id]`. Ajouter un composant client au layout n'a pas coûté le rendu statique.

### ⚠️ Trois corrections pour une seule feature — ce que ça a appris

`computeTrajectory` était écrit et testé depuis le premier jour sans jamais servir : il
attendait des notes d'utilisateurs. Les notes du public TMDB permettent de l'activer
sans un seul compte. **Il a fallu trois passes pour que la courbe dise quelque chose de
vrai**, et chacune a été révélée par la production, pas par les tests.

| Passe | Ce qui s'affichait | Cause |
|---|---|---|
| 1 | *Dexter* : **4,0 partout, « tenue de bout en bout »** | L'arrondi au demi-point détruisait l'information |
| 2 | Valeurs justes (3,6 → 4,2), mais **toujours « chef-d'œuvre »**, constance 92 % | Forme et constance normalisées sur l'échelle complète |
| 3 | Courbe + pic + décrochage, **aucun jugement** | ✅ |

> **La leçon, transposable** : un instrument taillé pour des notes **humaines** ne
> s'applique pas à des moyennes de **foule**. Les notes d'épisode d'une même série
> tiennent dans une bande d'environ un point sur dix — ceux qui notent un épisode l'ont
> regardé, donc l'aiment. L'échelle en demi-étoiles, le seuil de rupture à une étoile et
> la normalisation de la constance supposent tous une dispersion qui n'existe pas.
>
> La sortie n'a pas été de recalibrer des seuils jusqu'à ce que ça tombe juste sur quatre
> exemples, mais de **séparer les faits des jugements** : on montre la courbe, le pic et
> le décrochage ; on tait la forme et la constance. Elles reviendront intactes le jour où
> de vraies notes existeront — elles sont justes pour ce qu'elles ont été conçues.

**Vérifié en production** : *Dexter* et *Stranger Things* signalent tous deux leur
décrochage, et plus aucun jugement faux n'est affiché.

### 🟢 1.30 → 1.34 — Le produit se souvient (2026-08-02) ✅

Bloc dirigé par le cadrage produit de Tristan : **Letterboxd** (amis, listes, profils,
notes) + **IMDb** (notes par épisode, couleurs) + **JustWatch** (où regarder, sorties).

| # | Fait | Modèle |
|---|---|---|
| 1.30 | **Grille d'épisodes colorée** | IMDb |
| 1.31 | **« Où la regarder »** + attribution JustWatch | JustWatch |
| 1.32 | **Prochain épisode daté et nommé** | JustWatch |
| 1.33 | **Journal personnel** — position, notes de saison, décision | Letterboxd |
| 1.34 | Vérification interactive au navigateur | — |

#### Le contre-sens qui a dirigé le bloc

J'ai décomposé ce qui rend réellement addict : attente récompensée, progression
visible, collection, comparaison sociale, découverte de soi. **Quatre sur cinq butaient
sur la même chose** — le produit ne se souvenait de rien. Le blocage n'était pas une
feature manquante, c'était l'absence de persistance.

> **Sortie : stocker sans base de données, dans le navigateur.** Coût zéro, aucun compte
> à créer, aucune donnée personnelle hébergée, aucune obligation RGPD — et surtout, cela
> **valide l'usage avant d'investir dans Supabase**.

Deux propriétés rendent la chose acceptable architecturalement :

- **La page reste statique et mise en cache** — vérifié au build, `/serie/[id]` est
  toujours `○ Static`. L'état personnel s'ajoute par-dessus, côté navigateur.
- **La forme des données est exactement celle qu'attend `RATING-MODEL.md` §7** :
  position en pointeur, cible de note polymorphe, décision de plein droit. Passer au
  serveur ne demandera pas de la réécrire.

#### Vérifié au navigateur, pas au curl

Le HTML servi **ne contient pas** le composant — voulu : il ne rend rien tant que le
stockage n'est pas lu, ce qui évite toute erreur d'hydratation. Un `curl` ne pouvait
donc rien prouver.

| Vérification | Résultat |
|---|---|
| Sélection saison 3 | 13 épisodes proposés — correct pour Breaking Bad |
| Sélecteurs de note | **3 seulement** (saisons 1-3) : les saisons non atteintes ne sont pas proposées — la règle de spoiler tient jusque dans la saisie |
| Note 4,5 sur la saison 1, puis rechargement | restaurée |
| Contenu de `localStorage` | forme conforme au modèle, version 1 |

**Dette D14** : pas de synchronisation entre appareils, et le journal disparaît si le
navigateur est nettoyé. Un export/import JSON est le minimum à ajouter avant que
quiconque y investisse du temps — `exportJournal()` existe déjà, il lui manque une
interface.

### 1.24 → 1.29 — Bloc du 2026-08-02 ✅

| # | Ce qui a été fait | Trouvé par |
|---|---|---|
| 1.24 | **Dimensions d'affiche déclarées** + `fetchPriority` sur le LCP | audit de performance |
| 1.25 | **Métadonnées de partage** (Open Graph, Twitter, `metadataBase`) | audit de performance |
| 1.26 | **Maillage interne « Du même créateur »** — clôt 1.16 | trou SEO connu |
| 1.27 | Hiérarchie de titres cohérente (`sr-only`) | audit d'accessibilité |
| 1.28 | **Statut dans les résultats de recherche** (8 premiers) | audit du parcours |
| 1.29 | **Cadence à un seul intervalle** | audit sur échantillon large |

**Audit de performance.** 194 Ko de JS compressé pour **zéro composant client** — le site
n'a aucune interactivité, formulaire et dépliant sont natifs. C'est le coût structurel de
Next, non retirable sans changer de framework : **dette D13**, consignée plutôt que
combattue. En revanche aucune image ne déclarait ses dimensions, donc la page sautait à
leur arrivée — un des trois indicateurs mesurés par Google, corrigé sans rien charger
puisque le ratio TMDB est constant.

**Audit d'accessibilité.** `lang`, un seul `h1`, hiérarchie correcte, tous les `alt`,
landmarks, `aria-label` : **rien de grave**. C'est un résultat, pas un échec d'audit.
Seule incohérence corrigée : deux sections sans `h2`.

**Maillage interne (1.16, ouvert depuis le début).** J'avais écarté « séries similaires »
parce que la recommandation algorithmique est bannie (`ROADMAP.md` §3). Mais **« du même
créateur » est un crédit de production, pas un calcul de similarité** — la distinction
n'est pas rhétorique, c'est elle qui rend ce maillage compatible avec le positionnement.
Vérifié : depuis *Breaking Bad* on atteint *Better Call Saul*, *X-Files*, *Battle Creek*.

**Audit sur échantillon large** (16 séries : très anciennes, mini-séries, anime,
non-anglophones, très longues). Engagements plausibles — *Chernobyl* 6 h, *Détective
Conan* 505 h. Un faux positif sur une série très connue : *Les Anneaux de Pouvoir*
déclarée « sans nouvelle » alors que deux saisons à deux ans d'écart et 20 mois de
silence sont son rythme normal. `seasonCadence` exigeait **trois** saisons ; le garde-fou
posé pour la prudence produisait exactement le défaut qu'il devait corriger.

> **Correction asymétrique** : un intervalle unique produit désormais une cadence, avec
> un facteur plus prudent (1,5 au lieu de 2) et une règle stricte — **une mesure fragile
> peut allonger le délai, jamais le raccourcir**. Vérifié des deux côtés : *Les Anneaux
> de Pouvoir* repasse en « entre deux saisons », et *Majhi Manasa* reste « sans nouvelle
> · 26 mois ». Une correction qui casse ce qui marchait n'en est pas une.

### 🔴 1.23 — Audit de robustesse : le budget était violé depuis le début ✅ 2026-08-02

Premier audit portant sur le **comportement HTTP réel** plutôt que sur le contenu. Il a
trouvé le défaut le plus coûteux du projet, invisible dans le code comme dans les tests.

| Ce que je croyais | Ce qui se passait |
|---|---|
| `revalidate = 86400` ⇒ page en cache | `X-Vercel-Cache: MISS`, `Cache-Control: no-store` |
| Trafic gratuit | **Chaque visiteur** rejouait tous les appels TMDB — jusqu'à 10 pour une série de 8 saisons |

Deux causes, corrigées séparément :

1. **Le cache mémoire ne sert à rien en serverless.** Il est propre à chaque instance,
   donc presque toujours vide. Les appels TMDB passent désormais par le **cache de
   données** de l'hôte, partagé et persistant. Le provider reste agnostique : il
   transmet un `RequestInit`, c'est `lib/catalog.ts` qui y met `{ next: { revalidate } }`.
2. **`revalidate` ne suffit pas sur une route dynamique.** Sans `generateStaticParams`,
   Next 16 rend à la demande sans jamais mettre en cache. `dynamic = 'force-static'`
   rétablit l'ISR. Au build, `/serie/[id]` passe de `ƒ Dynamic` à `○ Static`.

> **Ce qui m'avait trompé** : le build affichait « Revalidate 1d » sur la route. Cette
> colonne décrit l'intention déclarée, **pas le cache effectif**. Seuls les en-têtes de
> réponse en production disent la vérité.

Vérifié après correctif : `X-Vercel-Cache: HIT` sur toutes les pages testées, y compris
des séries jamais visitées.

**Trouvaille secondaire du même audit** : `/serie/1396%2F..%2F..%2Fetc` répondait **200**.
Une URL inventée devenait une page indexable, servie avec le repli « catalogue
indisponible » et un code de succès. Un identifiant est désormais validé en amont
(entier positif, sinon 404).

### 1.22 — « Arrête-toi après la saison N », chiffré ✅ 2026-08-01

La phrase archétypale du domaine, enfin calculée : *« s'arrêter après la saison 6 ramène
la série à ~45 h au lieu de ~82 h »*. Derrière le même geste explicite que la courbe.

Une correction a été nécessaire dès le premier test réel. *Dexter* conseillait de
s'arrêter **après la saison 7** — exact (la plus forte chute est entre S7 et S8) et
parfaitement inutile : huit épisodes épargnés sur quatre-vingt-seize. Ce n'est pas un cas
isolé, la dernière saison est souvent la moins bien notée, donc le conseil deviendrait
systématiquement « regarde tout sauf le final ». **Seuil ajouté : un point d'arrêt ne
s'affiche que s'il épargne au moins un tiers de la série.**

Ce que ça donne sur de vraies séries :

| Série | Verdict | Cohérence avec la réputation |
|---|---|---|
| **The Walking Dead** | arrêt après S6 (4,2 → 3,9) | ✅ la saison 7 est le décrochage connu |
| **Rick et Morty** | arrêt après S4 | ✅ |
| **Breaking Bad** | aucun — elle monte | ✅ |
| Dexter, Stranger Things | aucun — le garde-fou coupe | correct, mais voir ci-dessous |

> **Limite réelle, consignée et non résolue — le biais de survie.** Ces points d'arrêt
> dérivent de notes de foule : ceux qui ont vu la saison 6 de *Dexter* sont ceux qui ont
> persévéré, et ils la notent bien. Les notes publiques ne retrouvent donc pas
> l'effondrement dont tout le monde parle. **Le conseil est exact sur les données, et les
> données ne disent pas ce que dit la réputation.** Le signal ne transparaît que sur les
> séries assez longues pour que le déclin s'installe.

### ✅ 1.10 — ce que le premier contact avec l'API réelle a révélé

Deux défauts, tous deux invisibles hors ligne, tous deux sur la **même promesse** :
« ce qu'elle vous demande », l'une des trois annoncées en page d'accueil.

1. **`episode_run_time` est de facto abandonné par TMDB.** Le champ existe encore mais
   revient vide, y compris sur Breaking Bad. Nos fixtures le contenaient toujours —
   écrites de mémoire, elles décrivaient une API qui n'existe plus. Résultat :
   « Engagement » ne s'affichait sur **aucune** série.
2. **Le repli sur le dernier épisode paru donnait un chiffre faux du simple au double.**
   Stranger Things : 90 heures pour 42 épisodes — 128 min chacun — parce que le final de
   la saison 5 est un long-métrage. La série en fait environ 45.

Correction : **médiane** des durées d'épisode d'une saison **représentative** (ni la
première, pilote rallongé ; ni la dernière, final rallongé ; celle du milieu). Médiane et
non moyenne, précisément pour résister à ces deux cas. Coût : un appel de plus par série,
mis en cache 24 h. Le total est préfixé d'un tilde — c'est une estimation, l'annoncer
comme exact serait mentir.

> **Leçon, à appliquer désormais** : une fixture écrite de mémoire décrit l'API dont on
> se souvient, pas celle qui existe. Les prochaines fixtures doivent être **capturées**
> depuis une réponse réelle, jamais rédigées à la main.

### Statuts observés en conditions réelles

| Statut | Vu ? | Cas observé le 2026-08-01 |
|---|---|---|
| `ended` | ✅ | Breaking Bad, Stranger Things, Euphoria, Loki, The Boys, Squid Game, Umbrella Academy, The Mandalorian |
| `between_seasons` | ✅ | **Yellowjackets** (16 mois), **Mercredi** (11 mois), **The Witcher** (9 mois) |
| `airing` | ✅ | **Ted Lasso** — dernier épisode il y a 3 ans, mais « Nouvel épisode dans 3 jours ». La date à venir prime correctement sur l'ancienneté. **Rick et Morty** |
| `cancelled` | ✅ | **Westworld** — « peut s'arrêter sans conclusion » |
| **`awaiting_renewal`** | ✅ | **Majhi Manasa** (série marathi, 2022) — « aucun épisode depuis 26 mois ». Introuvable en devinant des titres connus ; apparu **dès qu'une liste a été construite pour les faire remonter**. Il était dans la longue traîne, comme prévu. |

### ⚠️ Ce que la chasse au zombie a révélé — recentrage du différenciateur

Deux temps, et le second corrige le premier.

**D'abord**, douze séries connues devinées à la main : **aucun zombie**. TMDB classait
correctement partout — terminée, annulée, entre deux saisons, en diffusion. Ce qui
contredisait `RESEARCH.md` §3.4 (« les fournisseurs annoncent `returning` pour des séries
mortes depuis trois ans »).

**Ensuite**, une liste construite pour les faire remonter — les populaires filtrées sur
l'attente, triées par ancienneté — en a sorti un **immédiatement** : *Majhi Manasa*,
série marathi, 26 mois de silence. **Deviner des titres était la mauvaise méthode**, pas
l'hypothèse qui était fausse.

Distribution réelle observée sur l'accueil (36 vignettes) :

| Ce qui s'affiche | Occurrences |
|---|---|
| en diffusion (`en cours`, `ép. dans N j`) | ~20 |
| `en attente · 1 à 5 mois` | ~9 |
| **`sans nouvelle · 26 mois`** | **1** |

> **Le recentrage tient, et il est maintenant chiffré : la valeur n'est pas le cas
> zombie, c'est le chiffre.** « Saison terminée il y a 5 mois » est dix fois plus fréquent
> que le zombie, et tout aussi introuvable ailleurs. Le zombie en est la forme extrême —
> spectaculaire, mais rare, et surtout situé dans la longue traîne, là où le trafic SEO
> n'est pas.

À reporter dans le discours produit : parler du **temps écoulé chiffré**, dont le zombie
est le cas limite — et non l'inverse.

Les avertissements de saison se sont aussi montrés en conditions réelles : « Saison 4
annoncée mais pas encore diffusée » sur Ted Lasso et Yellowjackets, et la mention des
épisodes spéciaux sur Breaking Bad, Euphoria et Ted Lasso.

### ✅ Audit SEO du 2026-08-01 — le canal d'acquisition était un cul-de-sac

Constat sur le site en ligne : **sitemap à 1 URL, `/recherche` en `Disallow`, zéro lien
sortant depuis l'accueil.** Aucun moteur ne pouvait découvrir une seule page série.
Défaut introduit par `app/sitemap.ts`, qui annonçait que les pages « seront découvertes
par les liens » — sans que ces liens existent.

| | Avant | Après |
|---|---|---|
| Liens `/serie/*` depuis l'accueil | 0 | **20** |
| URLs dans le sitemap | 1 | **147** dont 146 pages série |

> **Leçon** : une fonctionnalité présente dans le code n'est pas une fonctionnalité qui
> marche. Tout le dispositif SEO — rendu serveur, ISR, JSON-LD, métadonnées — était
> correct et intégralement inutile faute d'un point d'entrée. **Auditer le résultat, pas
> l'intention.**

---

## Phase 2 — Comptes et gestes légers

**Canal : communautés existantes.** Aucun texte, aucun social.

| # | Tâche | Statut |
|---|---|---|
| 2.1 | Authentification (Supabase) | 🟢 libre |
| 2.2 | **Schéma de base** — les 5 contraintes de `RATING-MODEL.md` §7 | 🟢 libre |
| 2.3 | « J'en suis là » — la position en un geste | 🟢 libre |
| 2.4 | Note de saison — un tap, pas un formulaire | 🟢 libre |
| 2.5 | Décision : continuer / pause / abandon | 🟢 libre |
| 2.6 | File d'attente + reprise après interruption | 🟢 libre |

---

## Phase 3 — Agrégats et migration

**Canal : migration.** Ce qui rend les pages non reproductibles par scraping.

| # | Tâche | Statut | Note |
|---|---|---|---|
| 3.1 | Trajectoire agrégée, point d'arrêt communautaire, carte des abandons | 🟢 libre | `computeTrajectory` existe ; reste l'agrégation multi-utilisateurs |
| 3.2 | **Filtrage spoiler câblé dans chaque requête** | 🟢 libre | ⚠️ critique ici — `redactTrajectory` existe. Tester les fuites **par agrégat** |
| 3.3 | Import TV Time / Trakt / Simkl | 🟢 libre | Levier de **rétention**, plus d'acquisition — audit §1.1 |
| 3.4 | **Export intégral** | 🟢 libre | Non négociable dès qu'il y a une donnée |

---

## Phase 4 — Textes, profil, partage

**Canal : viralité.** Les textes arrivent en dernier — ils ne s'amorcent pas.

| # | Tâche | Statut |
|---|---|---|
| 4.1 | Critiques de saison | 🟢 libre |
| 4.2 | Épisodes marquants | 🟢 libre |
| 4.3 | Verdict de série rédigé + point d'arrêt | 🟢 libre |
| 4.4 | Profil : la forme d'un goût | 🟢 libre |
| 4.5 | Trajectoire exportable en image | 🟢 libre |

---

## Phase 5 — Social, sous condition

| # | Tâche | Statut | Note |
|---|---|---|---|
| 5.0 | **Dispositif de modération** (signalement, retrait, contact) | ⛔ | **Prérequis bloquant** — DSA, audit §5 |
| 5.1 | Suivre, fil d'activité, listes, commentaires | ⛔ | N'ouvre pas sans 5.0 |

---

## Dette et points de vigilance

| # | Sujet | Note |
|---|---|---|
| D1 | `docs/ROADMAP-AUDIT.md` écrit par l'auteur du plan | Violation assumée de « rédacteur ≠ relecteur ». À faire relire. |
| D2 | Hypothèse de répartition 70/25/5 des niveaux d'engagement | Calquée sur d'autres communautés, non mesurée ici |
| D3 | Seuils de `trajectory.ts` calibrés sur deux séries de référence | À rejouer sur un vrai corpus |
| D4 | Détection de saison scindée | Heuristique. Signale seulement — ne jamais la faire fusionner. |
| D5 | Anthologies (*Black Mirror*) et sitcoms | Le modèle par saison y est mal ajusté. `RATING-MODEL.md` §8.2 et §8.3 |
| D6 | Usage commercial de TMDB | ⚠️ **Redevenu actif depuis A1.** Affiliation ou freemium = usage commercial = accord écrit exigé. À traiter **avant** d'activer, pas après (`ROADMAP.md` §4.1). |
| D7 | **L'économie n'est pas résolue** | Le plan traite le coût, pas le revenu (A6). TV Time est mort avec 26 M d'utilisateurs faute d'avoir répondu à cette question. |
| D8 | **La thèse SEO n'est pas quantifiée** | Motif qualitatif confirmé, **aucun volume chiffré** — il faudrait Ahrefs/SEMrush. Le canal d'acquisition n°1 repose sur un pari raisonnable, pas sur une mesure. |
| D9 | Trou d'engagement de 3 mois (diffusion hebdomadaire) | Audit §4.3, resté ouvert et devenu un problème de **rétention** en mode produit. La saison est la bonne unité de jugement ; l'épisode est peut-être la bonne unité de **rythme**. |
| D10 | **Fixtures écrites de mémoire** | Cause directe du bug `episode_run_time`. Les prochaines doivent être **capturées** depuis une réponse réelle (tâche 1.17). |
| **D13** | **194 Ko de JS** — mesure faite avant les gestes | ⚠️ **Cette ligne était fausse et disait le contraire du code.** Elle affirmait « aucun `'use client'` dans le projet » alors qu'il y en a **14 modules** (toute la couche des gestes : `StarRating`, `EpisodeGrid`, `MyProgress`, `Library`…). Le chiffre de 194 Ko date d'**avant** cette couche et ne vaut plus. À **re-mesurer**, et à ne plus citer d'ici là. Corrigé le 2026-08-02. |
| **D14** | **La documentation ment sur le code** | Constaté le 2026-08-02 : ~20 tâches livrées (1.39→1.53) encore marquées `🟢 libre`, D13 affirmait un fait faux, `CLAUDE.md` annonçait 115 tests pour ~267 réels. Dans un projet dont la règle de reprise à froid est « lire la documentation d'abord », une doc fausse coûte plus cher qu'une doc absente : elle est **crue**. À remettre en accord, et à traiter comme une étape de fin de session, pas comme du rangement. |
| D11 | Listes TMDB polluées par des programmes non narratifs | **Partiellement réglé** le 2026-08-01 par `src/domain/program.ts` : *Tagesschau* et *Paradise Hotel* ont disparu de la vitrine, le sitemap est passé de 146 à 110 pages série (~25 % écartés). **Mais le filtre par genre n'attrape pas tout** : *Die Ratgeber*, magazine de conseils allemand, reste en tête de la rangée « En attente » — TMDB ne l'étiquette ni `news` ni `talk`. La longue traîne échappe au genre. |
| **D12** | **Le facteur d'anomalie ×2 est arbitraire** | `CADENCE_ANOMALY_FACTOR` vaut 2 — « deux cycles manqués ». Observé le 2026-08-01 : *Die Ratgeber*, silencieuse depuis 20 mois avec un rythme annuel, repasse en « entre deux saisons » (609 j < seuil 730 j). Défendable, mais probablement **trop permissif** : une série annuelle qui manque son créneau de six mois est déjà un signal. ×1,5 donnerait 18 mois. **Non tranché faute de données** — il faudrait mesurer la distribution réelle des intervalles sur un échantillon large, pas régler au jugé. |

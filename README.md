# seasoned

*Nom de code provisoire.*

> Ni un tracker, ni un clone de Letterboxd : **un endroit où l'on garde la trace de ce
> qu'on a pensé d'une série dans le temps**, dont le livrable est une trajectoire et un
> conseil — pas une note.

```
 Breaking Bad
 ████░ ████▌ ████▌ █████ █████        pic 5,0 · constance haute
  S1    S2    S3    S4    S5           verdict : fonce

 Dexter
 ████▌ ████░ ███▌░ █████ ██▌░░ █▌░░░   pic 5,0 · constance basse
  S1    S2    S3    S4    S5    S6      verdict : arrête-toi après S4
```

Deux séries que toute note unique rendrait comparables, et qui ne le sont pas.

---

## Pourquoi

Letterboxd fonctionne grâce à une coïncidence que le cinéma offre gratuitement :
l'œuvre, l'événement de visionnage et l'unité de jugement sont **le même objet**. Une
séance de deux heures, une date, une note.

La télévision détruit cette coïncidence. On juge une saison, on se souvient de trois
épisodes sur soixante, et la série ne finit jamais. C'est pourquoi personne n'a
proprement résolu la question — ni IMDb, qui note la série et l'épisode mais pas la
saison et produit des incohérences publiques, ni Serializd, qui propose les trois
niveaux sans dire lequel est la vérité.

La proposition ici : **la saison est le canon, l'épisode est l'exception, la série est un
verdict et non une moyenne.** Argumentée dans [docs/RATING-MODEL.md](docs/RATING-MODEL.md).

## État

**Phase 1.** Catalogue public en ligne de mire : recherche, page série, statut réel.
101 tests, typecheck strict, build vert. Pas encore de compte ni de base — c'est la
phase 2.

⚠️ **Rien n'a encore tourné contre l'API TMDB réelle** : faute de jeton dans
l'environnement de développement, la phase 1 est validée contre des fixtures et le
typage. Protocole de vérification dans [TASKS.md](TASKS.md) §1.10.

Pas encore en ligne — voir [TASKS.md](TASKS.md) §1.12.

## Lire dans cet ordre

| Document | Ce qu'il contient |
|---|---|
| [RESEARCH.md](RESEARCH.md) | L'état du terrain au 2026-07-31, sourcé et daté. Reverse engineering de Letterboxd, concurrence, données, **économie**. |
| [docs/RATING-MODEL.md](docs/RATING-MODEL.md) | **La décision n°1** : comment on note une série. Alternatives rejetées avec leur motif. |
| [ROADMAP.md](ROADMAP.md) | Le plan, les choix techniques, les arbitrages en attente. |
| [docs/ROADMAP-AUDIT.md](docs/ROADMAP-AUDIT.md) | La contre-expertise du plan. À lire **avec** la roadmap, pas après. |

## Le code

```
src/domain/     pur : aucun import, aucun réseau, aucune horloge implicite
  types.ts        ce que nous produisons — jamais de métadonnée de catalogue
  seasons.ts      normalisation : spéciaux, saisons scindées, mini-séries
  trajectory.ts   pic, constance, tendance, point de rupture
  status.ts       statut réel — démasque les séries déclarées vivantes et mortes
  spoiler.ts      horizon de spoiler : la trajectoire est elle-même un spoiler

src/catalog/    le catalogue est loué, pas possédé
  provider.ts     l'interface — un seul module connaît la forme d'un fournisseur
  cache.ts        expiration, plafond contractuel de 6 mois appliqué par le code
  tmdb.ts         fournisseur TMDB, parsing tolérant

lib/            la couture entre le catalogue et le domaine
  catalog.ts      composition + cache partagé + engagement total en heures
  format.ts       mise en mots — c'est ici que le différenciateur devient visible

app/            Next 16, App Router, rendu serveur et ISR 24 h
```

```bash
npm install && npm run check
```

Pour lancer l'application, il faut un jeton TMDB v4 dans `.env`
(voir [.env.example](.env.example)) :

```bash
npm run dev
```

## Données

Ce produit utilise l'API TMDB sans être approuvé ni certifié par TMDB.
*This product uses the TMDB API but is not endorsed or certified by TMDB.*

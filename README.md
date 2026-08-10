# Voltface

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

## Pourquoi

Letterboxd fonctionne grâce à une coïncidence que le cinéma offre gratuitement :
l'œuvre, l'événement de visionnage et l'unité de jugement sont **le même objet**. Une
séance de deux heures, une date, une note.

La télévision détruit cette coïncidence. On juge une saison, on se souvient de trois
épisodes sur soixante, et la série ne finit jamais.

La proposition ici : **la saison est le canon, l'épisode est l'exception, la série est un
verdict et non une moyenne.**

## État

**En ligne : https://seasoned-two.vercel.app**

Recherche, page série, statut réel, engagement en heures, calendrier avec export `.ics`,
bilan annuel, listes. Comptes et synchronisation, profils publics `/u/<nom>`, abonnements,
fil d'activité, critiques par série et par saison.

767 tests, typecheck strict, vérifié contre l'API TMDB réelle.

## Le code

```
src/domain/     pur : aucun import, aucun réseau, aucune horloge implicite
  types.ts        ce que nous produisons — jamais de métadonnée de catalogue
  seasons.ts      normalisation : spéciaux, saisons scindées, mini-séries
  trajectory.ts   pic, constance, tendance, point de rupture
  status.ts       statut réel — démasque les séries déclarées vivantes et mortes
  spoiler.ts      horizon de spoiler : la trajectoire est elle-même un spoiler
  face.ts         l'identité qui se calcule sur ce qu'on fait, pas sur ce qu'on déclare

src/catalog/    le catalogue est loué, pas possédé
  provider.ts     l'interface — un seul module connaît la forme d'un fournisseur
  cache.ts        expiration, plafond contractuel de 6 mois appliqué par le code
  tmdb.ts         fournisseur TMDB, parsing tolérant

src/journal/    le journal local, et sa synchronisation
src/social/     profils, abonnements, activité, critiques, listes
supabase/       le schéma et les politiques RLS

lib/            la couture entre le catalogue et le domaine
app/            Next 16, App Router, rendu serveur et ISR 24 h
```

```bash
npm install && npm run check
npm run dev      # jeton TMDB v4 dans .env — voir .env.example
```

## Données

Ce produit utilise l'API TMDB sans être approuvé ni certifié par TMDB.
*This product uses the TMDB API but is not endorsed or certified by TMDB.*

-- =============================================================================
-- 018_activity_titre.sql — un fait voyage avec le titre de sa serie
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le defaut, vu sur une capture d'ecran le 2026-08-11
--
-- Le fil d'amis affichait, mot pour mot :
--
--   @test wrote about tmdb:94997
--
-- Une cle brute, sans titre et sans affiche, sur la surface dont la decouverte est la
-- seule raison d'etre. Le lecteur resolvait le titre depuis **son propre** journal
-- (`journal.entries[subject]?.snapshot?.title`) : il ne voyait donc un nom que pour les
-- series qu'il connaissait **deja**, c'est-a-dire jamais pour une decouverte.
--
-- Le commentaire de `Friends.tsx` assumait le choix : « une requete par ligne de fil est le
-- cout par utilisateur que ce produit refuse ». La premisse est juste ; la conclusion ne
-- suivait pas. Il n'y avait pas a choisir entre une requete par ligne et une cle brute :
-- le fait peut **voyager avec** son titre, pour zero requete et zero appel TMDB.
--
-- ⚠️ **Aucun test ne pouvait le voir, et aucune mesure non plus.** J'ai compte les couleurs,
-- les icones et les niveaux de titre pendant deux passes sans jamais trouver ca — parce que
-- le HTML rendu contient bien un texte a cet endroit. Il fallait le lire avec des yeux.
-- Neuvieme fois que ce depot verifie une intention au lieu d'un resultat.
--
-- ## Ce que ces colonnes exposent, et pourquoi ce n'est pas une fuite
--
-- Le titre et le chemin d'affiche d'une serie sont des donnees **publiques du catalogue** :
-- n'importe qui les derive de `subject` avec un appel TMDB anonyme. Les stocker ici ne rend
-- donc rien lisible qui ne le fut pas — a la difference d'un titre d'episode, d'une position
-- ou d'un agregat, que le caviardage de `src/domain/activity.ts` continue d'interdire.
--
-- Ce sont des **instantanes**, pas des references : ils gardent le titre tel que l'auteur
-- l'avait sous les yeux. Une serie renommee chez TMDB ne reecrit pas le passe du fil, ce qui
-- est le comportement voulu — c'est ce que la personne a vu.
--
-- ## ⚠️ Nullables, et ils le resteront
--
-- Les faits publies avant aujourd'hui n'en ont pas, et un journal peut porter une entree
-- sans instantane (une serie ajoutee sans jamais avoir ete ouverte). L'affichage retombe
-- alors sur l'ancien chemin — le journal du lecteur, puis la cle. Les rendre obligatoires
-- ferait echouer la publication entiere d'un compte pour une seule entree incomplete, ce
-- qui est exactement la classe de panne que `017` a coute une base vide a trouver.

-- -----------------------------------------------------------------------------
-- Les colonnes
-- -----------------------------------------------------------------------------

alter table public.activity add column if not exists title text;
alter table public.activity add column if not exists poster_path text;

alter table public.reviews add column if not exists title text;
alter table public.reviews add column if not exists poster_path text;

-- -----------------------------------------------------------------------------
-- Les bornes
-- -----------------------------------------------------------------------------
--
-- ⚠️ **Ce ne sont pas des precautions decoratives.** Ces deux colonnes sont les premieres
-- de `activity` a porter du texte libre venu du client : sans borne, la table accepte un
-- « titre » de dix megaoctets, ou un chemin d'affiche qui n'en est pas un. `body` est deja
-- borne dans `006_reviews.sql` pour la meme raison.
--
-- 200 caracteres : le plus long titre de serie de TMDB tient tres largement dedans, et la
-- colonne n'a pas vocation a porter autre chose.
--
-- Le chemin d'affiche suit la forme que le CDN sert (`/xxxxx.jpg`) : la contrainte refuse
-- une URL absolue, donc elle empeche que cette colonne devienne un vecteur pour faire
-- pointer une image du fil vers un domaine tiers. ⚠️ Le rendu la concatene derriere
-- `https://image.tmdb.org/t/p/<taille>` sans la reverifier — c'est ici, et seulement ici,
-- que la garantie existe.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activity'::regclass and conname = 'activity_titre_borne'
  ) then
    alter table public.activity
      add constraint activity_titre_borne
      check (title is null or char_length(title) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activity'::regclass and conname = 'activity_affiche_forme'
  ) then
    alter table public.activity
      add constraint activity_affiche_forme
      check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]{1,60}$');
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reviews'::regclass and conname = 'reviews_titre_borne'
  ) then
    alter table public.reviews
      add constraint reviews_titre_borne
      check (title is null or char_length(title) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reviews'::regclass and conname = 'reviews_affiche_forme'
  ) then
    alter table public.reviews
      add constraint reviews_affiche_forme
      check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]{1,60}$');
  end if;
end $$;

comment on column public.activity.title is
  'Instantane du titre au moment du geste. Donnee publique du catalogue, derivable de '
  '`subject` par un appel TMDB anonyme — elle n''ouvre aucune lecture nouvelle. Nullable : '
  'les faits d''avant le 2026-08-11 n''en ont pas.';

comment on column public.activity.poster_path is
  'Chemin d''affiche TMDB (`/xxxxx.jpg`), jamais une URL absolue — voir la contrainte '
  '`activity_affiche_forme`, seule garantie avant concatenation cote client.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name in ('activity','reviews')
--      and column_name in ('title','poster_path');
--
--   Attendu : **quatre** lignes. Moins signifie que ce fichier n'a pas ete applique, et que
--   le fil continue d'afficher des cles brutes aux lecteurs qui ne connaissent pas la serie.
--
--   select conname from pg_constraint
--    where conname in ('activity_titre_borne','activity_affiche_forme',
--                      'reviews_titre_borne','reviews_affiche_forme');
--
--   Attendu : quatre.
-- =============================================================================

-- =============================================================================
-- 029_no_self_heart.sql — on ne s'aime pas soi-meme, et la base doit le dire
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## La regle existait, et elle n'existait qu'a l'ecran
--
-- `Reviews.tsx` la porte depuis le 2026-08-15 : *« on ne peut pas non plus aimer sa propre
-- critique : ce serait un compteur qu'on s'incremente soi-meme »*, et le bouton ne s'affiche
-- donc pas sur ses propres textes. `028` a repris la meme condition pour les listes.
--
-- 🔴 **La base, elle, acceptait.** Mesure le 2026-08-17, depuis un vrai compte sur la
-- production : un `POST review_likes` avec `liker_id = author_id = moi` repond **201**. Rien
-- ne l'empechait — `review_likes_insert` ne verifie que `auth.uid() = liker_id`.
--
-- Ce depot a une phrase pour exactement ce cas, ecrite dans `publishTags` : *« la borne est
-- dans la base, pas ici — une borne posee dans l'appelant n'est pas une borne »*. Une regle
-- de produit qui ne vit que dans un composant est une regle que le prochain client oubliera,
-- et un compteur qu'on s'incremente soi-meme est precisement ce qui rend « les plus aimees »
-- inutilisable comme classement (F3, livre le meme jour).
--
-- ## ⚠️ Un `check` de table, et non une politique
--
-- Une politique `insert` aurait tenu aussi, et elle aurait laisse passer les lignes deja
-- posees le jour ou l'on modifie la politique. Une contrainte de table vaut pour **toutes**
-- les lignes, y compris celles ecrites par un futur chemin d'administration — c'est le meme
-- raisonnement qui a fait choisir `follows_not_self` en `003` plutot qu'une regle dans le
-- client.
--
-- ⚠️ `follows` porte deja `follows_not_self` depuis `003` : ces deux contraintes disent la
-- meme chose de trois gestes sociaux, et c'est la troisieme fois que ce depot ecrit qu'un
-- geste social suppose **quelqu'un d'autre**.
-- =============================================================================

-- ⚠️ Le nettoyage d'abord : une contrainte ne se pose pas par-dessus une ligne qui la viole,
-- et il en existait une — celle de la mesure du 2026-08-17, retiree par le meme chemin. La
-- garder ici rend le fichier vrai meme si une autre traine.
delete from public.review_likes where liker_id = author_id;
delete from public.list_likes where liker_id = author_id;

alter table public.review_likes drop constraint if exists review_likes_not_self;
alter table public.review_likes
  add constraint review_likes_not_self check (liker_id <> author_id);

alter table public.list_likes drop constraint if exists list_likes_not_self;
alter table public.list_likes
  add constraint list_likes_not_self check (liker_id <> author_id);

comment on constraint review_likes_not_self on public.review_likes is
  'Un coeur suppose quelqu''un d''autre. La regle vivait dans un composant et la base '
  'repondait 201 — voir 029_no_self_heart.sql.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   insert into public.review_likes (liker_id, author_id, subject, target)
--   values ('…même uuid…', '…même uuid…', 'tmdb:1', 'series');
--
--   Attendu : `23514 new row violates check constraint "review_likes_not_self"`.
-- =============================================================================

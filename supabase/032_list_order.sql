-- =============================================================================
-- 032_list_order.sql — une liste qu'on classe, pas seulement qu'on remplit
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce qui manquait
--
-- `list_items` se lit dans l'ordre d'ajout (`added_at asc`), et c'est **le bon defaut** :
-- une liste qu'on remplit au fil de l'eau se relit comme un fil. Mais « mes dix meilleures »
-- est le geste qui fait exister les listes chez la reference, et il n'etait pas possible :
-- pour mettre une serie en tete, il fallait retirer les neuf autres et les rajouter dans
-- l'ordre — ce qui perd la date de chaque ajout au passage.
--
-- ## ⚠️ Facultatif, et le defaut ne bouge pas
--
-- `ordinal` est **nullable** et vaut `null` pour tout ce qui existe. Une liste jamais classee
-- se lit exactement comme avant ; le classement n'apparait que lorsqu'on l'a demande. C'est
-- la meme discipline que `title`/`poster_path` en `020` : additif, jamais imposé.
--
-- Le tri du client est donc `ordinal.asc.nullslast,added_at.asc` — les rangs d'abord, le
-- reste dans son ordre d'ajout. ⚠️ Sans `nullslast`, Postgres met les `null` **en tete** sur
-- un tri ascendant : une liste a moitie classee commencerait par ce qu'on n'a pas classe.
--
-- ## 🔴 La politique `UPDATE` que cette table n'avait pas
--
-- Reordonner, c'est ecrire `ordinal` sur des lignes qui existent deja. `007` n'a jamais donne
-- de politique `UPDATE` a `list_items` — a raison : jusqu'ici, une ligne n'avait rien a
-- mettre a jour, et {@link IDEMPOTENCE} rappelle que `merge-duplicates` sans politique
-- `UPDATE` rend **42501 en silence**. C'est exactement le chemin qu'emprunte le reordonnement
-- (un seul POST pour toutes les lignes, comme `publishFavorites`), donc la politique arrive
-- avec le geste qui la rend necessaire — et pas une minute avant.
-- =============================================================================

alter table public.list_items add column if not exists ordinal integer;

alter table public.list_items drop constraint if exists list_items_ordinal_shape;
alter table public.list_items
  add constraint list_items_ordinal_shape check (ordinal is null or ordinal >= 1);

-- ⚠️ L'index porte les **trois** colonnes du tri, dans l'ordre du tri : sans lui, ouvrir une
-- liste de deux cents series trierait a chaque lecture.
create index if not exists list_items_ranked
  on public.list_items (user_id, slug, ordinal nulls last, added_at);

-- Chez soi, et nulle part ailleurs. `using` **et** `with check` : le premier dit quelles
-- lignes on peut modifier, le second ce qu'elles ont le droit de devenir — sans lui, on
-- pourrait deplacer une ligne dans la liste de quelqu'un d'autre en changeant `user_id`.
drop policy if exists list_items_update on public.list_items;
create policy list_items_update on public.list_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on column public.list_items.ordinal is
  'Le rang choisi a la main. `null` = jamais classe, et la ligne se range alors par date '
  'd''ajout. Voir 032_list_order.sql pour pourquoi il est facultatif.';

notify pgrst, 'reload schema';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select polname, polcmd from pg_policies where tablename = 'list_items';
--   Attendu : quatre — select, insert, update, delete.
--
--   GET /rest/v1/list_items?select=subject,ordinal&order=ordinal.asc.nullslast,added_at.asc
--   Attendu : 200. ⚠️ Le cache de schema de PostgREST se rafraichit a part : sans le
--   `notify` ci-dessus, `ordinal` rend **400** alors que la colonne existe.
-- =============================================================================

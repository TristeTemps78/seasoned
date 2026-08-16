-- =============================================================================
-- 021_profile_favorites.sql — les quatre epinglees arrivent enfin sur le profil
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le defaut : le bouton s'appelle « Pin to profile », et le profil ne les voyait pas
--
-- Constate a l'ecran le 2026-08-16. `favorites.pin` porte ce nom depuis toujours, et les
-- quatre epinglees vivent dans `journal.favorites` — c'est-a-dire **dans le navigateur de
-- celui qui epingle**. `<Favorites />` n'est monte qu'a un endroit du depot, `/moi`. On
-- epinglait donc « sur son profil » quatre series que personne d'autre ne verrait jamais.
--
-- Le 2026-08-15 a partiellement comble le vide en montrant les **coeurs** sur `/u/<nom>` —
-- deja publies dans `activity`, zero migration. C'etait la bonne premiere reponse, et elle
-- ne repond pas a celle-ci : un coeur est un fait pose serie par serie, une epinglee est un
-- **choix ordonne de quatre**, et c'est le choix qui fait une carte de visite.
--
-- ## Pourquoi une table et pas une colonne `jsonb` sur `profiles`
--
-- Une colonne aurait demande une fonction de validation appelee dans un `check` — les
-- contraintes n'admettent pas de sous-requete — donc du code SQL qu'aucun scenario ne peut
-- rejouer avant que la migration ne soit appliquee. Une table rend les memes garanties avec
-- des `check` de colonne ordinaires, exactement comme `list_items`, et les scenarios peuvent
-- l'eprouver en transaction annulee.
--
-- ⚠️ **Et surtout : l'epinglee voyage avec son titre.** C'est la lecon de `018` et de `020`,
-- pour la troisieme fois — *une cle qui voyage sans son instantane n'est lisible que par qui
-- l'a deja vue*. Un profil est vu par des gens qui ne suivent pas les memes series ; sans
-- `title`, `/u/<nom>` afficherait quatre monogrammes.
--
-- ## Quatre, et l'ordre compte
--
-- `ordinal` de 1 a 4 : `favorites` est une **suite choisie** et non un ensemble trie, ce que
-- `src/domain/journal/write.ts` dit deja (*« le tri est correct pour l'un et faux pour
-- l'autre »*). La borne haute est dans la cle, donc la base refuse une cinquieme ligne sans
-- qu'aucun client n'ait a compter.

create table if not exists public.profile_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Le rang, 1 a 4. ⚠️ La borne vit **ici** et pas dans un `check (count(*) <= 4)`, qui
  -- n'existe pas en SQL : une cle primaire sur un domaine borne est la seule facon de
  -- refuser la cinquieme ligne sans lire les quatre autres.
  ordinal smallint not null check (ordinal between 1 and 4),
  -- Meme vocabulaire que `list_items.subject` et `reviews.subject` : la cle de journal
  -- telle quelle, donc les trois se joignent sans traduction.
  subject text not null check (subject ~ '^tmdb:[0-9]{1,12}$'),
  -- L'instantane, aux memes bornes qu'en 018 et 020.
  title text check (title is null or char_length(title) between 1 and 200),
  -- ⚠️ Le rendu concatene ce chemin derriere `https://image.tmdb.org/t/p/<taille>` **sans le
  -- reverifier**. C'est ici, et seulement ici, que la garantie existe : une URL absolue
  -- acceptee poserait un pisteur sur une page de profil publique.
  poster_path text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]{1,60}$'),
  pinned_at timestamptz not null default now(),
  primary key (user_id, ordinal)
);

alter table public.profile_favorites enable row level security;

-- -----------------------------------------------------------------------------
-- Les politiques
-- -----------------------------------------------------------------------------
--
-- 🔴 **Elles ne refont pas le calcul de visibilite : elles demandent au profil.** C'est le
-- raisonnement de `list_items_select`, et il vaut mot pour mot ici. Recopier
-- `public.can_see(user_id)` marcherait aujourd'hui et divergerait au premier changement.
--
-- Le `exists` traverse `profiles`, donc **subit sa politique** : un profil `private` rend
-- ses epinglees invisibles sans qu'aucune ligne ne le dise deux fois, et un profil masque
-- par la moderation les emporte avec lui.

drop policy if exists profile_favorites_select on public.profile_favorites;
create policy profile_favorites_select on public.profile_favorites
  for select
  using (
    exists (
      select 1 from public.profiles p where p.user_id = profile_favorites.user_id
    )
  );

drop policy if exists profile_favorites_insert on public.profile_favorites;
create policy profile_favorites_insert on public.profile_favorites
  for insert with check (auth.uid() = user_id);

-- ⚠️ **Une politique d'`update` ici, contrairement a `list_items`** — et ce n'est pas une
-- inattention. Le rang **est** la cle : reepingler la meme serie en deuxieme position est un
-- `ON CONFLICT (user_id, ordinal) DO UPDATE`, donc un chemin `UPDATE`, qui exige cette
-- politique. Sans elle, reordonner ses epinglees rendrait 42501 en silence — le defaut que
-- `IDEMPOTENCE` documente pour quatre ecritures sur cinq.
drop policy if exists profile_favorites_update on public.profile_favorites;
create policy profile_favorites_update on public.profile_favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Retirer une epinglee, et vider avant de reecrire.
drop policy if exists profile_favorites_delete on public.profile_favorites;
create policy profile_favorites_delete on public.profile_favorites
  for delete using (auth.uid() = user_id);

comment on table public.profile_favorites is
  'Les quatre series epinglees, dans l''ordre choisi. Publiees depuis `journal.favorites` par '
  '`PublishActivity`. Portent leur instantane (titre, affiche) pour la meme raison que 018 et '
  '020 : un profil est lu par des gens qui ne suivent pas les memes series.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select count(*) from information_schema.tables
--    where table_schema = 'public' and table_name = 'profile_favorites';
--
--   Attendu : 1. Zero signifie que ce fichier n'a pas ete applique — et que `publishFavorites`
--   rend 404 a chaque envoi, en silence, comme la carte des abandons pendant onze lots.
--
--   select policyname from pg_policies where tablename = 'profile_favorites';
--
--   Attendu : quatre.
-- =============================================================================

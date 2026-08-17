-- =============================================================================
-- 028_list_likes.sql — une liste a une adresse, et rien pour y repondre
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## L'asymetrie que ce fichier corrige
--
-- Depuis le 2026-08-16 une critique porte un coeur (`015`) et des reponses (`024`). Depuis
-- le meme jour une liste porte une **adresse partageable** — c'est-a-dire qu'on l'envoie a
-- quelqu'un. Celui qui la recoit n'avait aucun moyen de reagir autrement qu'en dehors du
-- produit : la seule surface faite pour etre envoyee etait la seule sans retour.
--
-- ## 🔴 Ce qu'on ouvre, et ce qu'on N'ouvre PAS
--
-- **Le coeur, oui.** Il se pose en un clic, il ne demande aucune moderation — un coeur ne
-- porte pas de texte, donc il ne peut ni insulter ni spoiler. C'est aussi la moitie qui
-- fait le plus de travail : `015` a ecrit pourquoi en une phrase, *« ecrire dans le vide est
-- ce qui fait arreter d'ecrire »*, et une liste qu'on fabrique pour quelqu'un est
-- exactement ca.
--
-- **Les reponses, non — et c'est une decision, pas un reste.** Un fil de discussion est une
-- surface de moderation entiere : `024` a du ecrire ce qu'il refusait (aucun pouvoir de
-- masquage cote client, l'auteur ne modere pas son propre fil), poser `has_handle`, et
-- rendre chaque ligne signalable. Le faire une seconde fois par symetrie ajouterait cette
-- charge a une surface dont personne n'a encore demande la discussion. Le jour ou une liste
-- recevra des coeurs et qu'on voudra savoir pourquoi, `024` est le patron a recopier.
--
-- ## La forme, reprise de `015` sans une virgule de plus
--
-- Cle etrangere **composite** vers la liste : on ne peut pas aimer une liste qui n'existe
-- pas, et retirer une liste emporte ses coeurs — sans quoi ils resteraient a compter dans
-- le vide. `author_id` est denormalise pour cette raison exacte, comme dans `015`.
-- =============================================================================

create table if not exists public.list_likes (
  liker_id uuid not null references auth.users (id) on delete cascade,
  -- L'auteur de la liste aimee. Denormalise volontairement : sans lui, la cle etrangere
  -- composite serait impossible.
  author_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now(),
  primary key (liker_id, author_id, slug),
  constraint list_likes_list_fk
    foreign key (author_id, slug)
    references public.lists (user_id, slug)
    on delete cascade
);

create index if not exists list_likes_by_list on public.list_likes (author_id, slug);

alter table public.list_likes enable row level security;

-- -----------------------------------------------------------------------------
-- Lire
-- -----------------------------------------------------------------------------
--
-- Meme regle qu'en `015`, mot pour mot : son propre coeur, les coeurs recus, et ceux des
-- gens qu'on a le droit de voir. Le **compte**, lui, ne passe pas par ici — il vient de
-- {@link list_like_counts}, qui est stable pour tout le monde.
drop policy if exists list_likes_select on public.list_likes;
create policy list_likes_select on public.list_likes
  for select using (
    liker_id = auth.uid()
    or author_id = auth.uid()
    or public.can_see(liker_id)
  );

-- ⚠️ `has_handle` pour la quatrieme fois apres `008`, `015` et `024` : un compte sans profil
-- qui aime est un compte qu'on ne peut ni ouvrir ni signaler. Ici il n'y a rien a moderer,
-- mais la regle vaut pour une autre raison — un coeur anonyme serait un vote, et un vote se
-- fabrique en masse.
drop policy if exists list_likes_insert on public.list_likes;
create policy list_likes_insert on public.list_likes
  for insert with check (auth.uid() = liker_id and public.has_handle(auth.uid()));

-- Un coeur **se reprend** : ce n'est pas un fait vecu, contrairement a un visionnage. D'ou
-- une suppression reelle et non une pierre tombale.
drop policy if exists list_likes_delete on public.list_likes;
create policy list_likes_delete on public.list_likes
  for delete using (auth.uid() = liker_id);

-- -----------------------------------------------------------------------------
-- Compter — la meme mecanique et la meme garantie qu'en `015`
-- -----------------------------------------------------------------------------
--
-- ⚠️ Un LOT et non une liste : un profil en affiche dix, et dix appels seraient dix fois le
-- cout que ce produit refuse partout. Le filtre porte sur l'auteur, comme `listsBy`.
--
-- ⚠️ `security definer` **uniquement pour compter**. Aucune identite ne sort d'ici : le
-- `liker_id` n'est pas projete, et lire les noms passe par la table, donc par RLS.
create or replace function public.list_like_counts(for_author uuid)
returns table (slug text, likes integer, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.slug,
    count(*)::integer,
    bool_or(l.liker_id = auth.uid())
  from public.list_likes l
  where l.author_id = for_author
  group by l.slug;
$$;

comment on function public.list_like_counts(uuid) is
  'Combien de coeurs par liste, pour un auteur. Stable pour tous — voir 028_list_likes.sql.';

comment on table public.list_likes is
  'Le coeur d une liste. Aucune table de reponses ne l accompagne, et c est une decision '
  'ecrite : voir 028_list_likes.sql.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select polname, polcmd from pg_policies where tablename = 'list_likes';
--
--   Attendu : trois — `select`, `insert`, `delete`. **Pas d'`update`** : un coeur n'a rien a
--   mettre a jour, donc la resolution d'un doublon est `ignore-duplicates` cote client. Le
--   chemin `UPDATE` est celui qui a rendu 42501 en silence le 2026-08-11, quatre ecritures
--   sur cinq (voir `IDEMPOTENCE` dans `src/social/client.ts`).
-- =============================================================================

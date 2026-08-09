-- 007 — les listes.
--
-- La 2e fonctionnalite de Letterboxd, et la premiere chose du produit qu'on fabrique **pour
-- quelqu'un d'autre** : une note, une position, une critique parlent de soi ; une liste est
-- un objet qu'on tend. C'est aussi le seul contenu du produit qui ait une raison d'exister
-- avant d'avoir regarde quoi que ce soit.
--
-- ## Pourquoi une table, et pas le journal
--
-- Le journal est RLS « own only » par decision ecrite (001), donc rien de ce qu'il contient
-- ne peut etre lu par un tiers. Une liste privee n'est pas une liste : elle vit ici, comme
-- les critiques (006), et pour les memes deux raisons — la lecture par autrui, et le
-- `hidden_at` qui rend **executable** la promesse « on masque, on ne supprime jamais ».
--
-- ⚠️ **Le prix, et il est assume** : une liste ne se cree pas hors ligne, contrairement a
-- tout le reste du produit (Q12). C'est le meme arbitrage que pour une critique publiee,
-- et il est acceptable pour la meme raison : ecrire est local, **publier** demande le reseau.
--
-- ## Deux tables et pas une colonne `jsonb`
--
-- Un tableau `jsonb` d'elements ferait reecrire la liste entiere a chaque ajout, et rendrait
-- « les listes qui contiennent Breaking Bad » impossible sans lire toutes les listes du
-- monde. Deux tables, une cle naturelle par element : ajouter est une ligne, retirer est une
-- ligne, et l'index fait le reste.

create table if not exists public.lists (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Identifiant lisible dans une URL, derive du titre par `src/domain/lists.ts`. Le domaine
  -- le fabrique, jamais la base : c'est lui qui sait deja normaliser un handle.
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$'),
  title text not null check (length(title) between 1 and 80),
  -- Facultative. Une liste sans phrase reste une liste ; l'exiger ferait abandonner.
  note text check (note is null or length(note) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- La moderation, exactement comme 006. On masque, on ne supprime pas.
  hidden_at timestamptz,
  primary key (user_id, slug)
);

create table if not exists public.list_items (
  user_id uuid not null,
  slug text not null,
  -- La cle de journal, telle quelle : `tmdb:1396`. Meme vocabulaire que `reviews.subject`,
  -- donc les deux se joignent sans traduction.
  subject text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, slug, subject),
  -- ⚠️ Supprimer une liste emporte ses elements. Sans cette cascade, retirer une liste
  -- laisserait des orphelins que plus aucune politique ne rend lisibles — donc invisibles
  -- et indestructibles.
  foreign key (user_id, slug) references public.lists (user_id, slug) on delete cascade
);

create index if not exists lists_by_owner on public.lists (user_id, updated_at desc);
create index if not exists list_items_by_subject on public.list_items (subject);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- Lire : ce que la visibilite du profil autorise, et qui n'est pas masque. `can_see` vient
-- de 003 et gere deja les trois visibilites, visiteur anonyme compris. La reecrire ici
-- serait la deuxieme chance de se tromper.
--
-- ⚠️ Son auteur continue de voir sa propre liste masquee : sans cela, un retrait
-- ressemblerait a une perte de donnees vue de l'interieur.
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists
  for select
  using ((hidden_at is null or user_id = auth.uid()) and public.can_see(user_id));

drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists
  for insert with check (auth.uid() = user_id);

drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists
  for delete using (auth.uid() = user_id);

-- 🔴 Les elements ne refont PAS le calcul de visibilite : ils demandent a la liste.
--
-- Recopier `can_see(user_id) and hidden_at is null` ici marcherait aujourd'hui et divergerait
-- au premier changement — c'est exactement la duplication qui a fait diverger deux blocs
-- d'affiche dans ce projet. Le `exists` traverse `lists`, donc **subit sa politique** : une
-- liste masquee rend ses elements invisibles sans qu'aucune ligne ne le dise deux fois.
drop policy if exists list_items_select on public.list_items;
create policy list_items_select on public.list_items
  for select
  using (
    exists (
      select 1 from public.lists l where l.user_id = list_items.user_id and l.slug = list_items.slug
    )
  );

drop policy if exists list_items_insert on public.list_items;
create policy list_items_insert on public.list_items
  for insert with check (auth.uid() = user_id);

drop policy if exists list_items_delete on public.list_items;
create policy list_items_delete on public.list_items
  for delete using (auth.uid() = user_id);

-- ⚠️ AUCUNE politique d'`update` sur les elements, et aucune de retrait par `hidden_at` :
-- un element se pose ou se retire, il ne se modifie pas, et le pouvoir de moderation ne
-- s'expose pas a un client (meme raison qu'en 004 et 006).

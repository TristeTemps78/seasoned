-- =============================================================================
-- 003_social.sql — profils, abonnements, fil d'activite
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce que ce fichier ouvre, et ce qu'il n'ouvre pas
--
-- Il cree les tables. Il n'ouvre **aucun ecran** : le lot suivant branche la lecture, et
-- il est conditionne a `legalIsComplete()`. Une table qui existe ne montre rien a
-- personne ; c'est l'ordre voulu.
--
-- ## Trois decisions qui ne se rattrapent pas
--
-- 1. **Un handle libere est une URL cassee, et pire : une usurpation.** Quelqu'un
--    reprendrait `@marie` et heriterait des liens pointant vers l'ancienne. La cascade
--    depuis `auth.users` supprimerait pourtant la ligne `profiles` — donc le handle. D'ou
--    un declencheur `before delete` qui le **verse dans `reserved_handles`**. Supprimer
--    son compte libere son identite, jamais son nom.
--
-- 2. **`activity` porte une cle naturelle.** Sans elle, chaque synchronisation reinsere
--    les memes faits : le fil se duplique a chaque ouverture de page, et le seul remede
--    serait une deduplication a la lecture, c'est-a-dire un cout permanent pour un defaut
--    d'ecriture. La cle est `(user_id, kind, subject, happened_on)` — **au jour**, pas a
--    la milliseconde, parce que c'est la granularite des faits du journal.
--
-- 3. **La retention est portee par l'ecriture, pas par un planificateur.** Q9 fixe
--    90 jours. Un `pg_cron` serait une piece de plus a surveiller ; ici chaque client
--    efface **ses propres** lignes perimees en poussant les nouvelles. Si personne ne
--    revient, personne ne pousse — et un fil que personne n'alimente n'a pas de lecteur.
-- =============================================================================

-- Les identifiants sont compares sans casse : `@Marie` et `@marie` sont la meme personne,
-- et croire le contraire est la meilleure facon de fabriquer une usurpation.
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Les noms qu'on ne peut pas prendre
-- -----------------------------------------------------------------------------
--
-- Semee depuis `src/domain/handles.ts` par le code applicatif : le domaine reste la
-- source de verite, la table n'est qu'une contrainte executable. ⚠️ Elle doit etre
-- remplie **avant la premiere inscription** (Q7) — un handle attribue ne se retire plus.

create table if not exists public.reserved_handles (
  handle citext primary key,
  reason text not null default 'reserved'
);

alter table public.reserved_handles enable row level security;

-- Lisible par tous : c'est ce qui permet a l'interface de dire « ce nom est reserve »
-- avant l'envoi, plutot qu'apres un refus incomprehensible. Ecriture : personne.
drop policy if exists reserved_select_all on public.reserved_handles;
create policy reserved_select_all on public.reserved_handles for select using (true);

-- -----------------------------------------------------------------------------
-- Les profils
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle citext not null unique,
  display_name text,
  -- Q1 : trois etats, pas deux. `followers` par defaut — le fil marche des le premier
  -- abonnement, mais l'indexation et l'inconnu restent fermes.
  visibility text not null default 'followers'
    check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now(),
  -- Q7 : 3 a 20 caracteres, minuscules, chiffres et soulignes — **pas de tiret**. Le motif
  -- vient de `src/domain/handles.ts` : le domaine tranche, la base execute. Il avait diverge.
  constraint profiles_handle_shape check (handle ~ '^[a-z0-9_]{3,20}$')
);

-- ⚠️ Le refus d'un handle reserve est un **declencheur** et non un `check` : Postgres
-- interdit une sous-requete dans une contrainte de verification (0A000). Le refuser en
-- amont, cote client, ne suffirait pas — c'est la base qui doit trancher, sinon la reserve
-- n'est qu'une politesse.
create or replace function public.refuse_reserved_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.reserved_handles r where r.handle = new.handle) then
    raise exception 'handle reserved: %', new.handle using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_refuse_reserved on public.profiles;
create trigger profiles_refuse_reserved
  before insert or update of handle on public.profiles
  for each row execute function public.refuse_reserved_handle();

comment on table public.profiles is
  'L identite publique. Le journal, lui, reste prive et vit dans public.journals.';

alter table public.profiles enable row level security;

-- (`can_see` est definie plus bas : elle lit `follows`, qui n'existe pas encore ici — une
--  fonction `language sql` est validee des sa creation, pas a son premier appel.)
-- -----------------------------------------------------------------------------
-- Les abonnements
-- -----------------------------------------------------------------------------
--
-- Sans reciprocite : suivre n'est pas etre ami. C'est ce qui permet a quelqu'un d'arriver
-- par une page publique et de suivre sans demander la permission — et c'est aussi
-- pourquoi la visibilite par defaut est `followers` et non `public`.

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index if not exists follows_by_followee on public.follows (followee_id);

alter table public.follows enable row level security;

/**
 * Qui peut voir quoi.
 *
 * Une fonction plutot qu'une sous-requete recopiee : la meme regle gouverne `profiles` et
 * `activity`, et deux copies d'une regle de visibilite finissent par diverger — c'est
 * ainsi qu'un fil laisse fuir ce qu'un profil cache.
 */
create or replace function public.can_see(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = target
        and (
          p.visibility = 'public'
          or (
            p.visibility = 'followers'
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.followee_id = target
            )
          )
        )
    );
$$;

-- On voit qui l'on suit, et qui nous suit. Pas les abonnements des autres entre eux :
-- le graphe social complet n'est demande par aucun ecran, donc il n'est pas lisible.
drop policy if exists follows_select_mine on public.follows;
create policy follows_select_mine on public.follows
  for select using (auth.uid() = follower_id or auth.uid() = followee_id);

-- 🔴 **L'impasse que cette politique a d'abord contenue.** Elle exigeait
-- `can_see(followee_id)` — ce qui parait prudent et ne l'est pas : un profil `followers`
-- n'est visible **qu'une fois suivi**. Donc personne n'aurait jamais pu suivre personne, et
-- `followers` etant la visibilite par defaut (Q1), le social entier etait mort au demarrage.
--
-- La bonne lecture : **suivre est un acte, voir est un droit.** Ce qui se protege est la
-- lecture, et `can_see` la protege deja. Reste le seul cas ou suivre n'a aucun sens — un
-- profil `private` —, refuse ici pour ne pas laisser croire a un acces qu'on n'aura pas.
--
-- ⚠️ Et le correctif evident ne suffisait pas : ecrire la condition comme une sous-requete
-- sur `profiles` la soumet **elle aussi** a RLS. B ne voit pas le profil de A tant qu'il ne
-- le suit pas, donc `exists (…)` etait faux et le suivi restait refuse — la meme impasse,
-- deplacee d'un cran. Verifie contre la base, pas relu : le premier correctif etait vert a
-- la lecture et rouge a l'execution.
create or replace function public.is_followable(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.user_id = target and p.visibility <> 'private'
  );
$$;

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows
  for insert with check (auth.uid() = follower_id and public.is_followable(followee_id));

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows
  for delete using (auth.uid() = follower_id);

-- Le profil se lit apres `follows`, parce que sa politique s'y refere.
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles
  for select using (visibility = 'public' or user_id = auth.uid() or public.can_see(user_id));

drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Le handle ne se libere jamais
-- -----------------------------------------------------------------------------

create or replace function public.retire_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reserved_handles (handle, reason)
  values (old.handle, 'retired')
  on conflict (handle) do nothing;
  return old;
end;
$$;

drop trigger if exists profiles_retire_handle on public.profiles;
create trigger profiles_retire_handle
  before delete on public.profiles
  for each row execute function public.retire_handle();

-- -----------------------------------------------------------------------------
-- Le fil
-- -----------------------------------------------------------------------------
--
-- ⚠️ **Aucun titre d'episode ici, jamais.** Le fil ne porte que la serie, le type de fait
-- et — pour une note de saison — le numero de saison. La position d'un lecteur n'a donc
-- rien a demander au serveur, et ne peut pas fuir par cette table.

create table if not exists public.activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Ce qui s'est passe. Jeu ferme : un fil de types libres ne s'agrege pas, et se
  -- traduit encore moins (le produit vise l'international).
  kind text not null check (kind in ('rated_season', 'finished', 'started', 'wanted')),
  -- La cle de journal, `tmdb:1396`. Pas de titre : il est deja dans le catalogue.
  subject text not null,
  season integer,
  stars numeric(2,1) check (stars is null or (stars >= 0.5 and stars <= 5)),
  -- Au **jour** : c'est la granularite des faits du journal, et c'est ce qui rend la cle
  -- naturelle stable d'une synchronisation a l'autre.
  happened_on date not null,
  primary key (user_id, kind, subject, happened_on)
);

create index if not exists activity_recent on public.activity (user_id, happened_on desc);

alter table public.activity enable row level security;

drop policy if exists activity_select_visible on public.activity;
create policy activity_select_visible on public.activity
  for select using (public.can_see(user_id));

-- ⚠️ Un client ne peut forger que **sa propre** activite — et il peut deja le faire a la
-- main, puisque le journal est declaratif. Ce qu'aucun geste ne permet est une **date
-- future** ou un passe illimite : ces deux-la se ferment ici, en SQL, parce que c'est la
-- seule couche qu'un client ne peut pas contourner.
drop policy if exists activity_insert_own on public.activity;
create policy activity_insert_own on public.activity
  for insert with check (
    auth.uid() = user_id
    and happened_on <= current_date
    and happened_on > current_date - 90
  );

drop policy if exists activity_delete_own on public.activity;
create policy activity_delete_own on public.activity
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('profiles','follows','activity','reserved_handles');
--
--   Attendu : rowsecurity = true sur les quatre. Une table sociale sans RLS est
--   lisible par le monde entier, et c'est la faute la plus couteuse de ce fichier.
-- =============================================================================

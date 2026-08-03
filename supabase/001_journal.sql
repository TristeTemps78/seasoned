-- =============================================================================
-- Voltface — lot 2b : les comptes et le journal synchronise
-- =============================================================================
--
-- A appliquer dans l'editeur SQL de Supabase. Idempotent : re-executer ne casse rien.
--
-- ## Ce que cette migration installe, et ce qu'elle n'installe pas
--
-- **Seulement le journal.** Ni profils, ni suivis, ni listes, ni activite : ces tables
-- ouvrent une surface sociale, et le dispositif de moderation (lot 3, ⛔ bloquant) n'existe
-- pas encore. Les creer « pendant qu'on y est » reviendrait a pouvoir les remplir avant de
-- savoir traiter un signalement.
--
-- ## La decision structurante : un DOCUMENT, pas un schema relationnel
--
-- `document` contient le journal entier en JSON, tel que le navigateur l'ecrit. Ce n'est
-- pas de la paresse :
--
--   * `mergeJournals` (`src/domain/journal.ts`) resout deja la fusion multi-appareils, et
--     il est prouve par huit lois. Eclater le journal en tables le ferait reecrire en SQL,
--     moins bien ;
--   * le journal reste lisible **hors ligne**, puisque la source de verite est locale ;
--   * la forme du journal change encore (quatre versions en deux jours). Un schema
--     relationnel demanderait une migration a chaque fois ; un document, aucune.
--
-- Le prix : **le serveur ne sait pas interroger les journaux.** C'est acceptable tant qu'on
-- n'en a pas besoin. Le jour ou le fil d'activite arrivera, il lira une **projection**
-- derivee de ce document — reconstructible, donc sans risque (`docs/ARCHITECTURE-APP.md`
-- §3.2).
--
-- ## ⚠️ RLS : ce n'est pas un durcissement, c'est LA couche d'autorisation
--
-- Sur Supabase, PostgREST est expose au navigateur avec une cle publique. Sans politique,
-- n'importe qui lirait le journal de n'importe qui. Les politiques ci-dessous sont donc la
-- seule chose qui separe les donnees de deux personnes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La table
-- -----------------------------------------------------------------------------

create table if not exists public.journals (
  -- Cle primaire ET cle etrangere : un journal par compte, jamais deux.
  -- `on delete cascade` est le droit a l'effacement (RGPD art. 17) applique par le
  -- moteur : supprimer le compte supprime le journal, sans tache de menage a ecrire ni
  -- a oublier.
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Le journal entier. `jsonb` et non `json` : il se compare et s'indexe, et Postgres
  -- rejette un document mal forme a l'ecriture plutot qu'a la lecture.
  document jsonb not null,

  -- Ecrite par le serveur, jamais par le client (voir le declencheur plus bas).
  updated_at timestamptz not null default now()
);

comment on table public.journals is
  'Le journal personnel, replique du navigateur. La source de verite reste locale.';

-- -----------------------------------------------------------------------------
-- `updated_at` appartient au serveur
-- -----------------------------------------------------------------------------
--
-- ⚠️ Un client peut mentir sur l'heure. Si `updated_at` venait du navigateur, une horloge
-- deregle de trois jours — cas banal — ferait passer une ecriture ancienne pour la plus
-- recente. La date est donc posee par le moteur, a chaque ecriture.
--
-- Ce n'est pas ce qui tranche les conflits (c'est `mergeJournals` qui le fait, champ par
-- champ, avec les dates portees par chaque fait). Elle sert a savoir s'il y a quelque
-- chose de neuf a telecharger.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journals_touch_updated_at on public.journals;
create trigger journals_touch_updated_at
  before insert or update on public.journals
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.journals enable row level security;

-- Quatre politiques explicites plutot qu'une seule `for all` : elles se lisent une par
-- une, et une erreur sur l'une n'ouvre pas les trois autres.
--
-- `auth.uid() = user_id` partout, sans exception et sans cas particulier. Il n'existe
-- aucune raison qu'un compte lise le journal d'un autre — le partage social passera par
-- une projection, jamais par cette table.

drop policy if exists journals_select_own on public.journals;
create policy journals_select_own on public.journals
  for select using (auth.uid() = user_id);

drop policy if exists journals_insert_own on public.journals;
create policy journals_insert_own on public.journals
  for insert with check (auth.uid() = user_id);

-- `using` **et** `with check` : le premier decide quelles lignes sont modifiables, le
-- second ce que la ligne a le droit de devenir. Sans le second, on pourrait modifier sa
-- propre ligne pour l'attribuer a quelqu'un d'autre.
drop policy if exists journals_update_own on public.journals;
create policy journals_update_own on public.journals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists journals_delete_own on public.journals;
create policy journals_delete_own on public.journals
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
--
-- A executer apres coup : `rowsecurity` doit valoir `true` et quatre politiques doivent
-- exister. Une table sans RLS est publique, et rien dans l'interface ne le signale.
--
--   select relname, relrowsecurity from pg_class where relname = 'journals';
--   select policyname, cmd from pg_policies where tablename = 'journals';

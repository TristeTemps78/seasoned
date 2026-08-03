-- =============================================================================
-- 002_account.sql — supprimer son compte, sans jamais introduire de secret
-- =============================================================================
--
-- A coller dans Supabase → SQL Editor → New query → Run.
-- Idempotent : reexecutable sans dommage.
--
-- ## Le probleme que ce fichier resout
--
-- Le droit a l'effacement (RGPD art. 17) impose de pouvoir supprimer un compte. Or
-- supprimer une ligne d'`auth.users` par l'API d'administration exige la cle
-- `service_role` — **interdite au navigateur** (`AGENTS.md` regle 5), puisqu'elle
-- contourne RLS et donne acces aux donnees de tout le monde.
--
-- La reponse habituelle est « une petite route serveur qui porte la cle ». Elle est
-- refusee ici : ce serait la **premiere surface d'ecriture privilegiee** du projet, celle
-- qu'il faudrait defendre pour toujours, et `TASKS.md` l'a deja refusee pour les webhooks
-- de scrobbling. Un projet sans aucune route serveur n'a pas de cle a se faire voler.
--
-- ## La reponse : `security definer`, sans argument
--
-- Le privilege vit **dans la definition de la fonction**. Il n'est ni dans une variable
-- d'environnement, ni dans le depot, ni dans le navigateur. Il n'y a rien a faire fuiter.
--
-- Chaque ligne ci-dessous compte :
--
--   * `security definer` fait tourner la fonction avec les droits de son proprietaire —
--     c'est ce qui lui donne acces a `auth.users` ;
--   * `set search_path = ''` est **obligatoire**. Sans lui, une fonction `security
--     definer` est detournable : un appelant fabrique un `search_path` qui fait pointer
--     un nom de table vers le sien. C'est le defaut classique de ce patron, et il est
--     silencieux ;
--   * la fonction **ne prend aucun argument**. Une signature `delete_user(id uuid)`
--     serait une porte ouverte : ici il n'y a rien a falsifier, `auth.uid()` vient du
--     jeton verifie par la base ;
--   * `revoke ... from anon` : sinon un visiteur non connecte peut l'appeler. La garde
--     explicite sur `auth.uid() is null` reste, parce qu'une autorisation et une
--     verification ne protegent pas de la meme erreur.
--
-- ## Ce que ce fichier n'a PAS besoin de dire
--
-- Rien sur `journals`, ni sur les tables sociales a venir. Elles referencent toutes
-- `auth.users (id) on delete cascade`, donc la cascade les emporte.
--
-- > C'est l'argument decisif de ce patron : **il n'a pas a grandir**. Chaque table
-- > ajoutee est couverte le jour ou elle est creee, sans que personne ait a penser a
-- > modifier une routine de suppression — ce qui est exactement la facon dont une
-- > suppression finit par etre incomplete.
--
-- ⚠️ La suppression est **immediate et sans delai de grace** (Q5). Un delai de grace est
-- de la retention deguisee. L'export integral est propose **avant**, dans l'interface
-- (`AGENTS.md` regle 9).
-- =============================================================================

create or replace function public.delete_me() returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- La cascade emporte journals, et toutes les tables sociales a venir.
  delete from auth.users where id = auth.uid();
end;
$$;

-- Personne par defaut, et surtout pas `anon`.
revoke all on function public.delete_me() from public;
revoke all on function public.delete_me() from anon;
grant execute on function public.delete_me() to authenticated;

-- =============================================================================
-- Verification — a executer apres, et a lire vraiment
-- =============================================================================
--
-- 1) La fonction existe, elle est `security definer` (prosecdef = true) et son
--    `search_path` est bien vide :
--
--    select proname, prosecdef, proconfig
--    from pg_proc
--    where proname = 'delete_me';
--
--    Attendu : prosecdef = true, proconfig = {"search_path="}
--    ⚠️ Si proconfig est NULL, la fonction est detournable. Ne pas s'en contenter.
--
-- 2) Seul `authenticated` peut l'appeler :
--
--    select grantee, privilege_type
--    from information_schema.routine_privileges
--    where routine_name = 'delete_me';
--
--    Attendu : `authenticated` seulement. Si `anon` ou `public` apparait, rejouer les
--    `revoke` ci-dessus.
-- =============================================================================

-- =============================================================================
-- 019_publish_stops.sql — republier son point d'arret, sans politique `select`
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le defaut, mesure en production le 2026-08-16, connecte
--
-- A **chaque** chargement de page, sur un compte qui a deja contribue :
--
--   POST /rest/v1/stops → 403
--   {"code":"42501","message":"new row violates row-level security policy for table \"stops\""}
--
-- Rien dans la console. `publishStops` rend `response.ok`, donc `false`, et personne
-- n'affiche `false` : la carte des abandons ne recevait plus rien, et l'ecran d'une carte
-- vide est identique a celui d'une carte qui n'a jamais rien recu. C'est le meme silence
-- triple qu'en 10.0 et qu'en 017, pour la troisieme fois.
--
-- ## La cause : le piege du scenario 28, sur une autre commande
--
-- `016_stops.sql` decide de ne donner **aucune politique `select`** a cette table, et c'est
-- la fonctionnalite meme — chaque ligne y est l'information a proteger. Le fichier documente
-- deja la consequence pour l'effacement : *« Postgres applique aussi les politiques `select`
-- a un `DELETE` porteur d'une clause WHERE : decider quoi effacer demande de lire. »* D'ou
-- `forget_stops()`.
--
-- La meme phrase vaut pour l'upsert, et personne ne l'a cherchee. `publishStops` envoie
-- `Prefer: resolution=merge-duplicates`, que PostgREST traduit en `ON CONFLICT … DO UPDATE` :
-- des la **deuxieme** publication, le chemin `UPDATE` s'active et doit lire la ligne en
-- conflit. Il ne la lit pas. Il refuse.
--
-- ⚠️ Le scenario 30 (`A pose sa propre ligne d'abandon`) passait, et il passait a raison :
-- c'est un `INSERT` nu. Aucun scenario ne rejouait la **forme que le client envoie** — c'est
-- la seule raison pour laquelle le defaut a tenu. `rls-scenarios.sql` en porte un desormais.
--
-- ## Pourquoi une fonction et non une politique `select`
--
-- Ouvrir la lecture reglerait le 42501 en supprimant la raison d'etre de la table : un compte
-- se deduirait ligne a ligne. La reponse est celle que `forget_stops()` a deja etablie pour
-- le meme piege — une porte `security definer`, etroite, qui ne fait qu'une chose et ne rend
-- aucune ligne.
--
-- ⚠️ `security definer` contourne RLS : sans le `auth.uid()` impose **cote fonction**, un
-- client pourrait ecrire les lignes de quelqu'un d'autre. Le `user_id` du client n'est donc
-- jamais lu — il est remplace.

create or replace function public.publish_stops(records jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
begin
  if auth.uid() is null then
    raise exception 'publish_stops: aucun compte connecte';
  end if;

  -- ⚠️ `jsonb_array_elements` et non une boucle : un aller-retour par serie serait le cout
  -- par utilisateur que ce produit refuse partout ailleurs.
  --
  -- ⚠️ `where subject <> ''` : une cle vide passerait la contrainte `not null` et polluerait
  -- la carte d'une ligne qui ne designe aucune serie.
  with entrant as (
    select
      auth.uid() as user_id,
      nullif(item ->> 'subject', '') as subject,
      (item ->> 'reached_season')::integer as reached_season,
      case
        when item ->> 'left_at_season' is null then null
        else (item ->> 'left_at_season')::integer
      end as left_at_season
    from jsonb_array_elements(coalesce(records, '[]'::jsonb)) as item
  ),
  -- Le domaine garantit deja `reached >= left`, et la contrainte de table le verifie. On
  -- ecarte ici plutot que de lever : un envoi de dix series ne doit pas echouer en entier
  -- parce qu'une ligne est malformee — c'est exactement ce qui a coute le 21000 de 017.
  propre as (
    select * from entrant
    where subject is not null
      and reached_season >= 1
      and (left_at_season is null or (left_at_season >= 1 and left_at_season <= reached_season))
  ),
  pose as (
    insert into public.stops (user_id, subject, reached_season, left_at_season)
    select user_id, subject, reached_season, left_at_season from propre
    on conflict (user_id, subject) do update
      set reached_season = excluded.reached_season,
          left_at_season = excluded.left_at_season,
          updated_at = now()
    returning 1
  )
  select count(*)::integer into written from pose;

  return written;
end;
$$;

comment on function public.publish_stops(jsonb) is
  'Republie mes points d''arret. Passe par une fonction parce qu''un upsert exige de lire '
  'la ligne en conflit, et que cette table n''a aucune politique select — voir 016_stops.sql.';

-- Personne d'anonyme n'a de point d'arret a publier, et lui ouvrir la porte serait ouvrir
-- une ecriture non authentifiee sur une table. Meme reserve que `forget_stops`.
revoke all on function public.publish_stops(jsonb) from public;
revoke all on function public.publish_stops(jsonb) from anon;
grant execute on function public.publish_stops(jsonb) to authenticated;

-- =============================================================================
-- 013_quiz.sql — la manche du jour, et pourquoi elle n'a pas besoin d'un serveur
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce que ce fichier resout
--
-- Le quiz personnel (`src/domain/quiz.ts`) se calcule sur le journal local : gratuit,
-- hors ligne, incopiable — et **impossible a classer**, puisque chacun repond a ses
-- propres questions et que son journal lui appartient. Un classement demande l'inverse :
-- les memes questions pour tous, et un score que le joueur ne peut pas s'attribuer.
--
-- ## 🔴 Pourquoi AUCUNE route serveur, alors que le reflexe en demandait une
--
-- Le projet ne porte aujourd'hui **aucun** `route.ts`, et c'est une decision tenue : une
-- route est une invocation par requete (le middleware a ete refuse pour cette raison
-- exacte) et la premiere surface d'ecriture privilegiee a defendre.
--
-- Or tout ce qu'une route apporterait ici, Postgres le donne deja :
--
--   * **une horloge que le client ne peut pas mentir** — `now()` est celle du serveur ;
--   * **des donnees qu'il ne peut pas lire** — RLS ferme `quiz_questions`, et seule une
--     fonction `security definer` en rend une partie ;
--   * **un calcul qu'il ne peut pas refaire a son avantage** — le score est ecrit par la
--     fonction, jamais envoye par le navigateur.
--
-- C'est le motif de `delete_me()` (`002_account.sql`) : *le privilege vit dans la
-- definition de la fonction, jamais dans une cle*. Aucune `service_role` n'apparait ici.
--
-- ## Le barème est l'anti-triche, et c'est une remarque de Tristan
--
-- Chercher la reponse ailleurs **coute des secondes**, donc des points. Il n'y a donc
-- rien a verrouiller de plus : la triche est possible et elle est perdante. C'est
-- pourquoi le temps est mesure **par question** et non sur la manche entiere — sinon une
-- seule recherche lente se noierait dans le total.
--
-- ⚠️ **Ce fichier ne cree aucun corpus.** Les questions sont deposees par ailleurs, et
-- elles portent de la metadonnee TMDB : la regle 1 interdit de la conserver au-dela de
-- six mois. D'ou `expires_at`, **non nullable**, et la purge plus bas. Une manche est un
-- cache, jamais une archive.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Les questions
-- -----------------------------------------------------------------------------

create table if not exists public.quiz_questions (
  on_day date not null,
  ordinal integer not null check (ordinal >= 1),
  -- Les six familles voulues. Jeu ferme : un genre libre ne se traduit pas et ne
  -- s'agrege pas — meme raisonnement que `activity.kind`.
  kind text not null check (kind in ('cast', 'rating', 'seasons', 'episodes', 'poster', 'dates')),
  -- Ce qu'on montre au joueur : la liste d'acteurs, les notes, le chemin de l'affiche.
  -- `jsonb` parce que la forme differe par famille et qu'une colonne par famille serait
  -- une table a migrer a chaque idee nouvelle.
  prompt jsonb not null,
  -- Les quatre propositions, deja melangees a la construction.
  choices jsonb not null,
  -- 🔴 L'index de la bonne reponse. Il ne sort JAMAIS de cette table avant la reponse :
  -- aucune politique de lecture n'existe (voir plus bas), et `quiz_serve` ne le projette
  -- pas. C'est la seule chose qui rend le jeu jouable.
  answer integer not null check (answer between 0 and 3),
  -- Regle 1 : le catalogue est loue, pas possede. Une question porte des metadonnees
  -- TMDB, donc elle **expire**. Non nullable pour qu'on ne puisse pas l'oublier.
  expires_at timestamptz not null,
  primary key (on_day, ordinal)
);

alter table public.quiz_questions enable row level security;

-- ⚠️ **Aucune politique. C'est voulu, et c'est le coeur du fichier.**
--
-- RLS active sans politique = personne ne lit rien, pas meme sa propre ligne. Les
-- questions ne sont donc accessibles que par `quiz_serve`, qui est `security definer` et
-- choisit ce qu'elle projette. Ecrire une politique de lecture « sans la colonne answer »
-- serait impossible : RLS filtre des lignes, jamais des colonnes.

-- -----------------------------------------------------------------------------
-- Ce que chacun a joue
-- -----------------------------------------------------------------------------

create table if not exists public.quiz_answers (
  user_id uuid not null references auth.users (id) on delete cascade,
  on_day date not null,
  ordinal integer not null,
  -- Quand le SERVEUR a servi la question. Le navigateur ne l'ecrit pas et ne peut pas
  -- l'avancer : c'est la moitie du barème.
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  correct boolean,
  points integer not null default 0 check (points >= 0),
  primary key (user_id, on_day, ordinal)
);

create index if not exists quiz_answers_board on public.quiz_answers (on_day, user_id);

alter table public.quiz_answers enable row level security;

-- Chacun lit ce qu'il a joue — pour revoir sa manche, pas pour lire celle des autres
-- (le classement passe par une vue agregee, plus bas).
drop policy if exists quiz_answers_select_own on public.quiz_answers;
create policy quiz_answers_select_own on public.quiz_answers
  for select using (auth.uid() = user_id);

-- ⚠️ **Aucune politique d'ecriture, nulle part.** Un client ne peut ni s'inscrire une
-- reponse, ni se poser des points. Tout passe par les deux fonctions.

-- -----------------------------------------------------------------------------
-- Servir une question
-- -----------------------------------------------------------------------------

/**
 * Rend la question `ordinal` du jour, **sans sa reponse**, et demarre son chronometre.
 *
 * Rappelee sur une question deja servie, elle rend la meme chose **sans remettre
 * `asked_at` a zero** : sinon recharger la page rendrait le temps infini, et le barème
 * ne vaudrait plus rien. C'est le `on conflict do nothing` qui le garantit.
 */
create or replace function public.quiz_serve(day date, want integer)
returns table (kind text, prompt jsonb, choices jsonb, asked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = 'check_violation';
  end if;

  -- Le chronometre part maintenant, et une seule fois.
  insert into public.quiz_answers (user_id, on_day, ordinal)
  values (me, day, want)
  on conflict (user_id, on_day, ordinal) do nothing;

  return query
    select q.kind, q.prompt, q.choices, a.asked_at
    from public.quiz_questions q
    join public.quiz_answers a
      on a.on_day = q.on_day and a.ordinal = q.ordinal and a.user_id = me
    where q.on_day = day and q.ordinal = want and q.expires_at > now();
end;
$$;

comment on function public.quiz_serve(date, integer) is
  'Sert une question sans sa reponse et demarre son chronometre. Voir 013_quiz.sql.';

-- -----------------------------------------------------------------------------
-- Repondre
-- -----------------------------------------------------------------------------

/** Combien de secondes une question reste jouable. Au-dela, elle vaut zero. */
create or replace function public.quiz_window() returns integer
language sql immutable set search_path = '' as $$ select 30 $$;

/**
 * Enregistre une reponse et calcule ses points.
 *
 * Le barème : 100 points a la reponse instantanee, decroissant lineairement jusqu'a 10 au
 * bord de la fenetre, zero au-dela ou si la reponse est fausse. **Repondre juste tard
 * rapporte toujours quelque chose** — sinon quelqu'un qui reflechit se retrouve a egalite
 * avec quelqu'un qui n'a pas joue, et le jeu punit la reflexion plutot que la triche.
 *
 * ⚠️ **Une seule reponse par question, definitive.** `answered_at is null` dans le `where`
 * est ce qui le tient : la seconde tentative ne met a jour aucune ligne. Sans lui, on
 * repondrait jusqu'a tomber juste.
 */
create or replace function public.quiz_answer(day date, want integer, choice integer)
returns table (correct boolean, points integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  right_one integer;
  started timestamptz;
  elapsed numeric;
  earned integer;
  is_right boolean;
begin
  if me is null then
    raise exception 'not signed in' using errcode = 'check_violation';
  end if;

  select q.answer, a.asked_at into right_one, started
  from public.quiz_questions q
  join public.quiz_answers a
    on a.on_day = q.on_day and a.ordinal = q.ordinal and a.user_id = me
  where q.on_day = day and q.ordinal = want and a.answered_at is null;

  -- Jamais servie, deja repondue, ou inconnue : rien a faire, et on ne dit pas laquelle
  -- des trois — un message qui distingue « deja repondue » de « mauvaise question »
  -- apprend a sonder.
  if right_one is null then
    return query select false, 0;
    return;
  end if;

  elapsed := extract(epoch from (now() - started));
  is_right := choice = right_one;
  earned := case
    when not is_right then 0
    when elapsed > public.quiz_window() then 0
    else greatest(10, ceil(100 - (elapsed / public.quiz_window()) * 90)::integer)
  end;

  update public.quiz_answers a
  set answered_at = now(), correct = is_right, points = earned
  where a.user_id = me and a.on_day = day and a.ordinal = want and a.answered_at is null;

  return query select is_right, earned;
end;
$$;

comment on function public.quiz_answer(date, integer, integer) is
  'Enregistre une reponse, une seule fois, et calcule ses points au temps serveur.';

-- -----------------------------------------------------------------------------
-- Le classement
-- -----------------------------------------------------------------------------

/**
 * Le tableau du jour — **et il ne montre que des gens qu'on a le droit de voir.**
 *
 * ⚠️ Un classement est une surface de decouverte : sans filtre, il exposerait le nom de
 * tous les joueurs a tous les joueurs, c'est-a-dire l'annuaire que `Friends.tsx` refuse
 * explicitement de construire. `can_see` gouverne donc ici comme partout — on voit les
 * profils publics et ceux qu'on suit.
 *
 * Consequence assumee : **le classement n'est pas le meme pour deux personnes**. C'est le
 * prix de la regle, et c'est le meme choix qu'en 10.2 (aucun compteur, jamais).
 */
create or replace view public.quiz_board as
  select
    a.on_day,
    a.user_id,
    p.handle,
    p.face,
    sum(a.points)::integer as score,
    count(*) filter (where a.correct) ::integer as right_answers
  from public.quiz_answers a
  join public.profiles p on p.user_id = a.user_id
  where a.answered_at is not null
  group by a.on_day, a.user_id, p.handle, p.face;

-- La vue herite des politiques de `profiles` : `security_invoker` la fait evaluer avec
-- les droits de l'appelant, donc `profiles_select_visible` s'applique. Sans cela une vue
-- appartenant au proprietaire contournerait RLS — c'est la faute classique des vues.
alter view public.quiz_board set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- La purge — regle 1, et elle est executable
-- -----------------------------------------------------------------------------

/**
 * Retire les questions expirees.
 *
 * ⚠️ Les reponses, elles, **restent** : elles ne portent aucune metadonnee TMDB, ce sont
 * nos propres donnees (qui a joue, quand, combien). C'est exactement la ligne de la
 * regle 1 — on ne garde pas le catalogue, on garde ce que nous produisons.
 */
create or replace function public.quiz_purge() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  delete from public.quiz_questions where expires_at <= now();
  get diagnostics gone = row_count;
  return gone;
end;
$$;

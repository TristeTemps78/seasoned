-- =============================================================================
-- 016_stops.sql — la carte des abandons
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Le defaut que ce fichier referme, et il est ecrit dans le domaine depuis 2026-08-01
--
-- `src/domain/stop-point.ts` conseille « arretez-vous apres la saison N », et nomme
-- lui-meme sa propre faillite :
--
--   « Ces points d'arret derivent de notes de foule, qui souffrent d'un **biais de
--   survie** : ceux qui ont vu la saison 6 de Dexter sont ceux qui ont persevere, et ils
--   la notent bien. Le conseil est exact sur les donnees, et les donnees ne disent pas ce
--   que dit la reputation. »
--
-- Le produit possede depuis le 2026-08-03 la donnee qui repare exactement ca : le point
-- ou quelqu'un a **lache**. `setDecision` l'enregistre (`atSeason`), avec ce commentaire :
-- *« c'est lui qui fera la carte des abandons »*. Elle dort dans `journals.document`, un
-- `jsonb` que RLS rend illisible a quiconque sauf son proprietaire.
--
-- Un abandon est declare par **celui qui part**. Le biais de survie ne peut donc pas s'y
-- former : c'est la seule statistique de ce produit qu'aucun catalogue ne sait produire.
--
-- ## 🔴 Pourquoi cette table est illisible, et pas seulement protegee
--
-- 10.2 a interdit tout compteur passant par RLS : `can_see()` ne rend que les gens
-- visibles par CE lecteur, donc un nombre varierait d'un visiteur a l'autre pour la meme
-- serie. Un chiffre qui change selon qui regarde n'est pas un chiffre.
--
-- La consequence n'est pas « mettre une policy plus large », c'est **n'en mettre aucune**.
-- La table ne porte aucune politique `select` : PostgREST ne peut en tirer aucune ligne,
-- pour personne, jamais. C'est la ruse de `quiz_questions` (013) — RLS filtre des lignes
-- et pas des colonnes, donc on cache une colonne en fermant la table — appliquee ici a une
-- table dont **chaque ligne** est l'information a proteger.
--
-- Une seule porte : `stop_map()`, `security definer`, qui ne rend que des comptes. Meme
-- forme que `review_like_counts` (015), et pour la meme raison : *un agregat n'est pas un
-- annuaire*.
--
-- ## Ce qui n'est PAS ici, et pourquoi
--
-- **Aucune cle etrangere vers `profiles`**, contrairement a `reviews`, `activity` et
-- `lists` (009). Ces trois-la en avaient besoin pour que PostgREST sache joindre vers
-- l'auteur — et c'est precisement le chemin qu'on ferme ici. En declarer une ouvrirait la
-- jointure que toute cette table existe pour rendre impossible.
--
-- **Aucune date de visionnage, aucun numero d'episode.** La saison suffit a la courbe.
-- Tout champ supplementaire n'ajouterait rien a la mesure et elargirait la surface
-- d'identification par recoupement.
--
-- **Aucun `has_handle`**, contrairement a `follows` (008) et `review_likes` (015). Ces
-- deux-la l'exigent parce qu'un acteur invisible y serait quelqu'un qu'on ne peut ni voir
-- ni signaler. Ici c'est l'inverse : **la contribution est anonyme par construction**, il
-- n'y a ni nom a montrer ni texte a signaler. Exiger un profil public pour entrer dans un
-- agregat anonyme serait une contradiction.
--
-- ⚠️ **Limite assumee, et elle n'est pas fermee ici** : rien n'empeche quelqu'un de creer
-- plusieurs comptes pour peser plusieurs fois sur une courbe. Le cout d'entree est une
-- adresse e-mail verifiee ; c'est la meme exposition que `activity` ou `reviews`, et elle
-- se traiterait le jour ou elle se constate — pas avant, et pas par une heuristique.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La table
-- -----------------------------------------------------------------------------

create table if not exists public.stops (
  user_id uuid not null references auth.users (id) on delete cascade,

  -- La cle de journal, `tmdb:1396`. Jamais de titre : il est deja dans le catalogue
  -- (regle 1), et un titre stocke ici serait une copie a maintenir.
  subject text not null,

  -- 🔴 **Le denominateur, et c'est lui qui rend la statistique honnete.**
  -- Sans « combien de gens ont atteint la saison 4 », « 62 % » ne veut rien dire : on
  -- compterait des abandons sans savoir sur quoi. C'est ce champ qui fait une **courbe de
  -- survie** et non un decompte, et c'est exactement ce qui manque aux notes publiques.
  reached_season integer not null check (reached_season >= 1),

  -- Non nul = la personne a declare s'arreter la. Nul = elle est encore en route, ou elle
  -- est allee au bout — les deux comptent dans le denominateur et dans aucun numerateur.
  left_at_season integer check (left_at_season is null or left_at_season >= 1),

  -- Ecrite par le serveur, jamais par le client — meme raison qu'en 001 : un client peut
  -- mentir sur l'heure.
  updated_at timestamptz not null default now(),

  -- Une ligne par personne et par serie, remplacee a chaque publication. Pas d'historique :
  -- la carte dit ou on en est, pas comment on y est venu.
  primary key (user_id, subject),

  -- On ne peut pas s'arreter apres etre alle moins loin que la ou l'on s'arrete. Le
  -- domaine le garantit deja (`reachedSeason = max(position, leftAtSeason)`), et une
  -- position se declare a la main, donc elle peut reculer : la contrainte est ici parce
  -- que c'est la seule couche qu'un client ne peut pas contourner.
  constraint stops_left_within_reached
    check (left_at_season is null or left_at_season <= reached_season)
);

comment on table public.stops is
  'Ou chacun a lache une serie. Anonyme : illisible ligne a ligne, lue seulement par stop_map().';

-- `updated_at` appartient au serveur — le declencheur de 001, reutilise tel quel.
drop trigger if exists stops_touch_updated_at on public.stops;
create trigger stops_touch_updated_at
  before insert or update on public.stops
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Les politiques — et l'absence de l'une d'elles
-- -----------------------------------------------------------------------------

alter table public.stops enable row level security;

-- ⚠️ **Il n'y a volontairement AUCUNE politique `select` ici.** Ce n'est pas un oubli, et
-- ce n'est pas a completer : c'est la garantie d'anonymat elle-meme. RLS refuse par
-- defaut, donc `GET /rest/v1/stops` rend `[]` a tout le monde, y compris a l'auteur de la
-- ligne et y compris avec un jeton valide. Verifie par les scenarios de `db:scenarios`.
--
-- Consequence a connaitre avant d'ecrire un ecran : **on ne peut pas relire ce qu'on a
-- publie**. C'est voulu — l'etat de reference est le journal local, cette table n'en est
-- qu'une projection anonyme, et `merge-duplicates` la reecrit sans jamais avoir besoin de
-- la lire.

drop policy if exists stops_insert_own on public.stops;
create policy stops_insert_own on public.stops
  for insert with check (auth.uid() = user_id);

-- `update` est indispensable **en plus** de `insert` : un `POST` PostgREST en
-- `resolution=merge-duplicates` devient un `on conflict do update`, que Postgres refuse
-- sans politique d'ecriture des deux cotes. Sans elle, la premiere publication passerait
-- et toutes les suivantes echoueraient — le pire des deux mondes, et silencieusement,
-- puisque `#write()` ne rend qu'un booleen que personne ne regarde.
drop policy if exists stops_update_own on public.stops;
create policy stops_update_own on public.stops
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Se retirer de la carte, a tout moment et sans rien demander. La suppression du compte
-- l'emporte deja par `on delete cascade` (RGPD art. 17) ; celle-ci couvre le cas ou l'on
-- veut cesser de contribuer **sans** fermer son compte.
--
-- ⚠️ **Cette politique ne suffit PAS a rendre le retrait possible depuis le navigateur** —
-- voir `forget_stops()` plus bas, et la raison y est ecrite. Elle reste ici parce qu'elle
-- est la borne : meme la fonction ne peut effacer que les lignes de son appelant.
drop policy if exists stops_delete_own on public.stops;
create policy stops_delete_own on public.stops
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Sortir de la carte
-- -----------------------------------------------------------------------------

/**
 * Retire toutes mes lignes, et rend combien.
 *
 * ## 🔴 Pourquoi une fonction, alors qu'une politique `delete` existe deja
 *
 * **Postgres applique aussi les politiques `select` a un `DELETE` porteur d'une clause
 * `WHERE`** : lire une colonne pour decider quoi effacer est une lecture. Or cette table
 * n'a **aucune** politique `select`. Un `DELETE /rest/v1/stops?user_id=eq.<moi>` — la seule
 * forme que PostgREST accepte, puisqu'il exige un filtre — ne voit donc **aucune ligne**,
 * n'en efface **aucune**, et repond **204**.
 *
 * ⚠️ Autrement dit : le retrait aurait ete une promesse tenue par personne, **et
 * inverifiable**, puisque la table est justement illisible. Mesure contre la vraie base par
 * `npm run db:scenarios` le 2026-08-10 — les tests, eux, ne pouvaient rien en dire : ils
 * doublent `fetch` et prouvent l'URL qu'on construit, jamais qu'elle fait ce qu'elle dit.
 *
 * ## Pourquoi pas simplement ouvrir la lecture de ses propres lignes
 *
 * Ce serait suffisant, inoffensif — on ne lirait que ce qu'on a soi-meme ecrit — et c'est
 * pour ca qu'il faut le refuser : la propriete « **cette table n'est lisible par personne,
 * jamais, par aucun chemin** » est plus facile a tenir qu'une propriete a exception. La
 * premiere se verifie d'un coup d'oeil au fichier ; la seconde demande de verifier, a chaque
 * requete future, que le filtre est bien celui qu'on croit.
 *
 * Meme forme que `delete_me()` (002) : **aucun argument** — il n'y a rien a falsifier,
 * l'identite vient du jeton.
 */
create or replace function public.forget_stops() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if auth.uid() is null then
    raise exception 'forget_stops: aucun compte connecte';
  end if;
  delete from public.stops s where s.user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.forget_stops() is
  'Retire toutes mes lignes de la carte des abandons — voir 016_stops.sql.';

-- Personne d'anonyme n'a de lignes a retirer, et lui ouvrir la porte serait ouvrir une
-- ecriture non authentifiee sur une table. Meme reserve que `delete_me`.
revoke all on function public.forget_stops() from public;
revoke all on function public.forget_stops() from anon;
grant execute on function public.forget_stops() to authenticated;

-- -----------------------------------------------------------------------------
-- La seule porte de lecture
-- -----------------------------------------------------------------------------

/**
 * Combien de gens ont atteint chaque saison d'une serie, et combien s'y sont arretes.
 *
 * Rend une ligne par saison, de 1 jusqu'a la plus loin atteinte par quiconque. Le taux
 * d'abandon d'une saison est `left_here / reached` — le calcul reste au domaine, qui seul
 * sait si le lecteur a le droit de le voir (regle 7).
 *
 * ⚠️ **Le plancher est ici, et pas dans l'affichage.** Sous **5** contributeurs sur cette
 * serie, la fonction rend **zero ligne** : sur un petit effectif, « une personne a
 * abandonne en saison 3 » recoupe avec le graphe d'abonnements et redevient nominatif.
 * C'est une garantie d'anonymat, donc elle vit dans la seule couche qu'un client ne peut
 * pas contourner — meme raisonnement que la fenetre de 90 jours d'`activity_insert_own`.
 *
 * ⚠️ `security definer` **uniquement pour compter**. Aucun `user_id` n'est projete, et il
 * n'existe aucun autre chemin de lecture vers cette table.
 */
create or replace function public.stop_map(for_subject text)
returns table (season integer, reached integer, left_here integer)
language sql
stable
security definer
set search_path = ''
as $$
  with contributors as (
    select s.reached_season, s.left_at_season
    from public.stops s
    where s.subject = for_subject
  ),
  -- Le plancher vit dans ce `having` : s'il n'est pas franchi, `bounds` est vide, et la
  -- jointure laterale ci-dessous ne produit aucune ligne. La fonction se tait donc en
  -- rendant un ensemble vide — jamais un zero, qui serait une reponse.
  bounds as (
    select max(c.reached_season) as top
    from contributors c
    having count(*) >= 5
  )
  select
    g.season::integer,
    (select count(*)::integer from contributors c where c.reached_season >= g.season),
    (select count(*)::integer from contributors c where c.left_at_season = g.season)
  from bounds b, lateral generate_series(1, b.top) as g(season);
$$;

comment on function public.stop_map(text) is
  'La courbe de survie d une serie, anonyme et planchee a 5 contributeurs — voir 016_stops.sql.';

-- ⚠️ **Executable par `anon`, contrairement a `delete_me`.** La fiche serie est une page
-- publique et statique : la courbe y a sa place pour quelqu'un qui n'a pas de compte, et
-- c'est meme le lecteur qu'elle sert le mieux — celui qui hesite a commencer. La fonction
-- ne rend que des comptes agreges et planches, donc l'ouvrir n'expose personne.
grant execute on function public.stop_map(text) to anon, authenticated;

-- =============================================================================
-- Verification
-- =============================================================================
--
--   -- doit rendre 0 ligne, meme authentifie, meme pour ses propres lignes
--   select count(*) from public.stops;
--
--   -- doit exister, et n'avoir que insert / update / delete
--   select polname, polcmd from pg_policy
--   where polrelid = 'public.stops'::regclass;

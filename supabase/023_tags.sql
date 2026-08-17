-- =============================================================================
-- 023_tags.sql — les mots de quelqu'un, quand il choisit de les montrer
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce que ce fichier ouvre
--
-- Les tags existent depuis le lot 8 : « a revoir avec Lea », « le dimanche », « quand je
-- n'ai pas la tete a suivre une intrigue ». Ce sont des categories que seul le lecteur peut
-- nommer, et qu'aucune taxonomie de catalogue ne remplacera. Ils vivaient **entierement dans
-- le navigateur**, et `Tags.tsx` le promettait en toutes lettres : *« vos mots, ranges par
-- vous, pour vous »*.
--
-- ## 🔴 D'ou l'accord explicite, et pourquoi il n'est PAS symetrique de la carte des abandons
--
-- `016_stops.sql` fait contribuer par defaut, et c'est defendable : ce qui part est **anonyme
-- et illisible** — cette table-la n'a aucune politique `select`, personne ne relit ces
-- lignes, pas meme leur auteur.
--
-- ⚠️ Un mot n'a aucune de ces proprietes. C'est une phrase ecrite par quelqu'un, attachee a
-- son nom, et souvent ecrite **avant** que la question ne se pose. Publier par defaut
-- romprait une promesse retroactivement, sur du texte que la personne croyait prive. Le
-- champ `shareTags` du journal nomme donc l'ACCORD, et son absence laisse tout dans le
-- navigateur. Aucune ligne n'arrive ici sans un geste.
--
-- ## Un ETAT, pas des faits — et la lecon de `021` s'applique telle quelle
--
-- Retirer un mot doit le retirer du profil. `publishTags` reecrit donc l'ensemble : il efface
-- ce qui est la, puis reinsere. C'est le chemin `DELETE` + `INSERT`, et **pas** un
-- `merge-duplicates` : celui-la emprunterait `UPDATE`, qui exige sa propre politique et qui a
-- coute quatre ecritures sur cinq le 2026-08-11 en rendant 42501 en silence. Ici les deux
-- politiques necessaires sont ecrites, et deux scenarios les rejouent.
--
-- ⚠️ **La suppression est bornee a soi**, et c'est ce qui rend le « effacer puis reinserer »
-- sur : `tags_delete` porte `auth.uid() = user_id`, donc un client qui enverrait un `DELETE`
-- large n'effacerait que ses propres lignes. Sans cette borne, republier ses mots viderait la
-- table de tout le monde.
-- =============================================================================

create table if not exists public.tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  -- Le mot, tel que la personne l'a ecrit. ⚠️ 40 caracteres : `MAX_TAG_CHARS` vaut la meme
  -- chose dans `src/domain/journal`, et la borne vit aux DEUX endroits — le client peut etre
  -- en retard sur la base, et c'est ici que la garantie existe.
  tag text not null check (char_length(tag) between 1 and 40),
  -- L'instantane, pour la quatrieme fois apres `018`, `020` et `021`. Un profil est lu par
  -- des gens qui ne suivent pas les memes series : sans lui, la page d'un mot afficherait
  -- autant de monogrammes qu'elle porte de series que le lecteur ne connait pas.
  title text check (title is null or char_length(title) between 1 and 200),
  poster_path text check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]{1,60}$'),
  primary key (user_id, subject, tag)
);

create index if not exists tags_by_user on public.tags (user_id);

alter table public.tags enable row level security;

-- Lire : ce que la visibilite de l'auteur autorise, plus les siens. Meme forme que
-- `reviews_select` et `lists_select` — c'est `can_see` qui decide, et elle decide seule.
drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags
  for select using (user_id = auth.uid() or public.can_see(user_id));

-- Ecrire : chez soi, et **avec un nom**.
--
-- ⚠️ `has_handle` pour la meme raison qu'en `008` et `015` : un compte sans profil dont les
-- mots seraient publies serait un auteur qu'on ne peut ni ouvrir ni signaler.
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags
  for insert with check (auth.uid() = user_id and public.has_handle(auth.uid()));

-- Retirer les siens, et **rien d'autre**. C'est cette borne qui rend sur le
-- « effacer puis reinserer » de `publishTags` : sans elle, republier ses mots viderait la
-- table de tout le monde.
drop policy if exists tags_delete on public.tags;
create policy tags_delete on public.tags
  for delete using (auth.uid() = user_id);

comment on table public.tags is
  'Les mots de quelqu''un sur une serie, publies UNIQUEMENT si `shareTags` est vrai dans son '
  'journal. Voir 023_tags.sql pour pourquoi l''accord est explicite ici et implicite pour 016.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select polname from pg_policies where tablename = 'tags';
--
--   Attendu : trois — `tags_select`, `tags_insert`, `tags_delete`. Il n'y a **pas** de
--   politique `update`, et ce n'est pas un oubli : `publishTags` reecrit un etat par
--   suppression puis insertion, jamais par `merge-duplicates`.
-- =============================================================================

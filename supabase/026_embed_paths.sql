-- =============================================================================
-- 026_embed_paths.sql — les chemins qui manquaient a PostgREST, huitieme fois
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce que `009` a fait, et ou il s'est arrete
--
-- `009_relations.sql` a donne a PostgREST le chemin `profiles!inner` pour `reviews`,
-- `activity` et `lists`. `025` l'a fait pour `review_comments`, apres que la lecture des
-- reponses ait rendu **400 PGRST200** en production le jour meme de leur ouverture.
--
-- Deux tables sociales n'en ont toujours pas, et les deux le paient :
--
-- 1. **`follows`** — sans chemin, lire « qui je suis » demande **deux** allers-retours : la
--    liste des identifiants, puis les profils (`#profilesOf`). Un profil en fait donc quatre
--    pour deux listes, mesure du 2026-08-17. C'est le dernier doublon de cette page, et la
--    sortie etait deja connue : `discoverLists` a resolu exactement ce probleme avec
--    `profiles!inner` en une requete.
-- 2. **`tags`** — sans chemin, une page par mot ne peut pas dire **qui** a range une serie
--    sous ce mot. Or c'est tout l'interet d'un index de mots : *le vocabulaire de quelqu'un
--    ne vaut que confronte a celui des autres.* Sans auteur, la page ne serait qu'une
--    seconde liste de series.
--
-- ## ⚠️ DEUX cles vers la meme table, et l'embarquement devient ambigu
--
-- `follows` reference `profiles` deux fois — le suiveur et le suivi. PostgREST refuse alors
-- `profiles!inner(...)` tout court : il ne peut pas deviner laquelle des deux. Le client
-- **doit** nommer la contrainte (`profiles!follows_followee_profile(...)`), et c'est pour ca
-- que les deux noms ci-dessous sont stables et explicites : ils sont **de l'API**, pas de la
-- plomberie. Les renommer casserait deux lectures.
--
-- ## ⚠️ Les lignes orphelines, effacees — et pourquoi c'est le seul choix honnete
--
-- `008_followers.sql` refuse depuis le 2026-08-09 qu'un compte sans handle suive quelqu'un,
-- et note que *« les lignes anterieures, elles, restent »*. Une cle etrangere ne se pose pas
-- par-dessus : elle echouerait, et tout le fichier avec.
--
-- Ces lignes sont **inaffichables aujourd'hui** : `following()` et `followers()` resolvent
-- des profils, donc une ligne sans profil ne rend rien nulle part. Personne ne peut ni la
-- voir, ni la defaire — c'est un abonnement fantome. La supprimer ne retire donc aucune
-- fonctionnalite a personne ; la garder empecherait la seule chose qui rende cette table
-- lisible en un appel. La meme logique vaut pour `tags`, dont `tags_insert` exige
-- `has_handle` depuis `023`.
--
-- ⚠️ C'est la premiere suppression de lignes d'une migration de ce depot. Elle est bornee a
-- ce qui n'a aucun profil, elle est ecrite ici plutot que tapee dans un tableau de bord, et
-- elle est rejouable sans effet une fois faite.
-- =============================================================================

delete from public.follows f
where f.follower_id not in (select p.user_id from public.profiles p)
   or f.followee_id not in (select p.user_id from public.profiles p);

delete from public.tags t
where t.user_id not in (select p.user_id from public.profiles p);

-- ⚠️ `add constraint … if not exists` n'existe pas pour les cles etrangeres : on retire puis
-- on repose, ce qui rend le fichier rejouable. Meme forme qu'en `009` et `025`.
alter table public.follows drop constraint if exists follows_follower_profile;
alter table public.follows
  add constraint follows_follower_profile
  foreign key (follower_id) references public.profiles (user_id) on delete cascade;

alter table public.follows drop constraint if exists follows_followee_profile;
alter table public.follows
  add constraint follows_followee_profile
  foreign key (followee_id) references public.profiles (user_id) on delete cascade;

alter table public.tags drop constraint if exists tags_author_profile;
alter table public.tags
  add constraint tags_author_profile
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

comment on constraint follows_followee_profile on public.follows is
  'Donne a PostgREST le chemin `profiles!follows_followee_profile` — sans lui, lire ses '
  'abonnements coute deux allers-retours. Le nom est de l''API : le renommer casse le client.';

comment on constraint follows_follower_profile on public.follows is
  'Le pendant pour les abonnes. Voir 026_embed_paths.sql pour l''ambiguite que les deux '
  'cles creent, et pourquoi le client doit les nommer.';

comment on constraint tags_author_profile on public.tags is
  'Donne a PostgREST le chemin `profiles!inner` — sans lui, une page par mot ne peut pas '
  'dire qui a range quoi sous ce mot, ce qui est tout l''interet d''un index.';

-- ⚠️ Le cache de schema de PostgREST se rafraichit a part : une contrainte posee sans ce
-- signal existe dans `pg_constraint` **et reste invisible a l'API**. `009` le dit deja, et
-- c'est exactement le piege qui a fait croire `025` inutile pendant dix minutes.
notify pgrst, 'reload schema';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select conname from pg_constraint
--   where conname in ('follows_follower_profile','follows_followee_profile','tags_author_profile');
--
--   Attendu : trois lignes. ⚠️ Et ca ne suffit pas — la seule preuve qui vaille est la
--   requete elle-meme, en 200 :
--
--     GET /rest/v1/follows?select=followee_id,profiles!follows_followee_profile(handle)&limit=1
--     GET /rest/v1/tags?select=tag,profiles!inner(handle)&limit=1
-- =============================================================================

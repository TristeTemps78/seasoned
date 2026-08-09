-- =============================================================================
-- 009_relations.sql — declarer le lien vers `profiles`, sans quoi RIEN ne se lit
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le defaut, et il n'etait visible d'aucune facon depuis le depot
--
-- Mesure le 2026-08-10 **contre la vraie base**, avec la cle publique, exactement comme le
-- fait le navigateur :
--
--   GET /rest/v1/reviews?select=subject,profiles!inner(handle,user_id)
--   → 400  PGRST200  « Could not find a relationship between 'reviews' and 'profiles' »
--
--   GET /rest/v1/activity?select=kind,profiles!inner(handle,user_id)
--   → 400  PGRST200  (le meme)
--
-- Ce sont **les deux seules lectures sociales du produit** : `SocialClient.#reviews()`, qui
-- sert la fiche serie et la page de profil, et `SocialClient.#activity()`, qui sert le fil
-- de `/amis`. Elles rendaient donc `[]` **depuis toujours**, pour tout le monde.
--
-- Et personne ne pouvait le voir, pour trois raisons qui se sont additionnees :
--
--   1. `#rows()` promet en tete de fichier de **ne jamais lever** : un 400 y devient `[]`.
--      La promesse est bonne — une panne du social ne doit pas interrompre un produit local
--      — mais elle transforme une erreur de schema en « personne n'a rien ecrit ».
--   2. Les ecrans se **taisent** quand la liste est vide : *mieux vaut se taire que compter
--      zero*. Bonne regle, meme consequence — l'ecran d'un defaut est identique a l'ecran
--      d'un demarrage a froid.
--   3. La base ne contient **aucun profil** (verifie : 1 compte, 0 profil, 0 critique). Il
--      n'existait donc aucune donnee dont l'absence aurait pu surprendre.
--
-- > *Une fonctionnalite ecrite n'est pas une fonctionnalite qui marche.* Septieme occurrence
-- > dans ce depot, apres `ordering.ts`, `episodeMinutes`, `unfollow`, `setVisibility` et
-- > deux autres. Cette fois la preuve manquante n'etait ni un test ni un typage : c'est
-- > qu'**aucune requete PostgREST n'avait jamais ete envoyee a la vraie base**. Les tests
-- > doublent `fetch`, donc ils verifient l'URL qu'on construit, jamais qu'elle repond.
--
-- ## Pourquoi PostgREST ne trouvait rien, alors que le lien existe
--
-- `reviews.user_id`, `activity.user_id` et `lists.user_id` referencent `auth.users`, pas
-- `public.profiles`. Le lien vers le profil est **vrai dans la tete de tout le monde et
-- declare nulle part** : PostgREST ne devine pas, il lit les cles etrangeres du catalogue.
--
-- La reference vers `auth.users` reste : c'est elle qui garantit qu'une donnee disparait
-- avec le compte. On ajoute la seconde, qui dit l'autre verite — **on ne publie pas sans
-- avoir un nom**. Elle etait deja appliquee de fait (l'interface exige un handle avant tout
-- geste social) sans etre executable.
--
-- ⚠️ La cascade est la meme des deux cotes, donc rien ne change au moment de supprimer un
-- compte : `auth.users` emporte `profiles`, qui emporte a son tour ce qui reste.
-- =============================================================================

-- ⚠️ `add constraint … if not exists` n'existe pas pour les cles etrangeres : on retire
-- puis on ajoute, ce qui rend le fichier rejouable sans erreur.

alter table public.reviews drop constraint if exists reviews_author_profile;
alter table public.reviews
  add constraint reviews_author_profile
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

alter table public.activity drop constraint if exists activity_author_profile;
alter table public.activity
  add constraint activity_author_profile
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

alter table public.lists drop constraint if exists lists_author_profile;
alter table public.lists
  add constraint lists_author_profile
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

-- PostgREST tient un cache du schema ; sans ce signal il continuerait de repondre 400
-- jusqu'a son prochain redemarrage. Supabase le declenche seul sur DDL, mais le dire ici
-- rend le fichier suffisant a lui-meme.
notify pgrst, 'reload schema';

-- =============================================================================
-- Verification — et elle ne se fait PAS en SQL
-- =============================================================================
--
-- Une cle etrangere presente dans `pg_constraint` ne prouve pas que PostgREST la voit : son
-- cache est l'objet meme du defaut. La seule verification qui vaille passe par la meme porte
-- que le navigateur, avec la cle publique :
--
--   GET /rest/v1/reviews?select=subject,profiles!inner(handle,user_id)&limit=1   → 200
--   GET /rest/v1/activity?select=kind,profiles!inner(handle,user_id)&limit=1     → 200
--   GET /rest/v1/profiles?select=handle,reviews(count),lists(count)&limit=1      → 200
--
-- `[]` est la bonne reponse tant qu'il n'y a pas de profil. **C'est le 200 qui compte**,
-- pas le contenu — et c'est exactement ce que trois sessions successives n'ont pas regarde.
-- =============================================================================

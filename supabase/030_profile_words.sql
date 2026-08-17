-- =============================================================================
-- 030_profile_words.sql — un profil qui ne dit que son pseudo
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 `display_name` existe depuis `003`, et **rien ne l'ecrit ni ne l'affiche**
--
-- La colonne est la depuis le premier jour du social. `rowToProfile` la lit et la range dans
-- `Profile.displayName` ; aucun composant ne la rend, aucun appel ne la pose. C'est le motif
-- que ce depot documente comme sa panne la plus chere — `unfollow()` et `setVisibility()` ont
-- vecu deux lots sans appelant —, et `handles.ts` promettait pourtant en toutes lettres :
-- *« un nom d'affichage libre (`display_name`) porte le reste »*, c'est-a-dire tout ce que
-- l'alphabet contraint d'un handle interdit — les accents, les espaces, les majuscules.
--
-- Ce fichier ne cree donc pas `display_name` : il lui pose **la borne qui manquait** et
-- ajoute la seconde moitie de ce qu'un profil dit de quelqu'un.
--
-- ## La phrase, et pourquoi elle est courte
--
-- 160 caracteres. C'est ce qui tient sous un nom sans devenir un article, et c'est la borne
-- que la reference emploie. Une bio de 2000 caracteres serait une critique posee sur un
-- profil : deux surfaces d'ecriture pour un seul geste, et la moderation devrait trancher
-- laquelle elle lit.
--
-- ## ⚠️ La moderation d'un profil passe par le tableau de bord, comme partout
--
-- Aucune colonne `hidden_at` ici, et ce n'est pas un oubli : `006` et `024` en portent une
-- parce qu'un texte masque doit rester **consultable** par la moderation et par son auteur.
-- Une phrase de profil retiree n'a pas ce besoin — il n'y a rien a examiner apres coup qu'un
-- signalement ne dise deja (`004`). Le retrait se fait en vidant la colonne, depuis le
-- tableau de bord, exactement comme un handle se retire par `retire_handle` (`003`).
--
-- ⚠️ **Aucune politique nouvelle.** `profiles_update_own` gouverne deja la ligne entiere :
-- on ecrit chez soi, jamais chez un autre. `profiles_select_visible` decide de qui lit. Une
-- colonne de plus sur une table deja gouvernee n'a pas besoin d'une regle de plus — en
-- ajouter une donnerait deux endroits ou lire la meme decision.
-- =============================================================================

-- Le nom lisible. ⚠️ La borne existe **aussi** dans le domaine (`checkDisplayName`), et les
-- deux ne se remplacent pas : le client peut etre en retard sur la base, et c'est ici que la
-- garantie existe. Meme raisonnement que `tags.tag` en `023`.
alter table public.profiles drop constraint if exists profiles_display_name_shape;
alter table public.profiles
  add constraint profiles_display_name_shape
  check (display_name is null or char_length(btrim(display_name)) between 1 and 40);

alter table public.profiles add column if not exists bio text;

alter table public.profiles drop constraint if exists profiles_bio_shape;
alter table public.profiles
  add constraint profiles_bio_shape
  check (bio is null or char_length(btrim(bio)) between 1 and 160);

comment on column public.profiles.display_name is
  'Le nom lisible, avec accents, espaces et majuscules — tout ce que l''alphabet d''un handle '
  'interdit. Ecrit depuis 030 ; il dormait dans le schema depuis 003.';

comment on column public.profiles.bio is
  'Une phrase, 160 caracteres. La moderation la vide depuis le tableau de bord : voir '
  '030_profile_words.sql pour pourquoi il n''y a pas de `hidden_at` ici.';

-- ⚠️ Une colonne neuve doit etre annoncee a PostgREST, comme une contrainte : son cache de
-- schema se rafraichit a part, et sans ce signal `select=bio` rend **400** — la meme forme de
-- panne que `025`, sur une colonne au lieu d'une jointure.
notify pgrst, 'reload schema';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   GET /rest/v1/profiles?select=handle,display_name,bio&limit=1   → 200
--
--   update public.profiles set bio = repeat('x', 161) where user_id = '…';
--   Attendu : 23514.
-- =============================================================================

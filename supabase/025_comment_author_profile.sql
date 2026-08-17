-- =============================================================================
-- 025_comment_author_profile.sql — une reponse sans auteur lisible n'est pas affichable
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 LE DEFAUT DU LOT 10.0, SEPTIEME OCCURRENCE — ET IL A ETE ECRIT HIER
--
-- `024` a ouvert les reponses aux critiques. L'ecriture marchait ; **la lecture rendait 400
-- a chaque chargement**, et l'ecran d'une fiche serie etait donc identique a celui d'une
-- fiche sans reponse. Constate le 2026-08-17 en ecrivant une vraie reponse depuis un vrai
-- compte, sur la production :
--
--     POST /rest/v1/review_comments → 201
--     GET  /rest/v1/review_comments?…profiles!inner(…) → 400
--     {"code":"PGRST200","details":"Searched for a foreign key relationship between
--      'review_comments' and 'profiles' … but no matches were found."}
--
-- `review_comments.author_id` reference `auth.users`, comme `reviews`, `activity` et `lists`
-- avant `009`. PostgREST ne sait embarquer que ce qu'une **cle etrangere** relie : sans elle,
-- `profiles!inner(handle,user_id,face)` n'a aucun chemin, et il refuse la requete entiere.
--
-- ## ⚠️ Pourquoi rien ne pouvait le voir
--
-- `#rows()` promet de ne jamais lever : un 400 y devient `[]`. Le composant affiche alors
-- « aucune reponse », ce qui est exactement l'ecran d'un demarrage a froid. Les tests, eux,
-- doublent `fetch` — ils prouvent la **forme** de l'URL, jamais que la base l'accepte. Et les
-- scenarios RLS ecrivent en SQL, donc ils ne passent pas par PostgREST.
--
-- C'est la septieme fois que ce depot paie cette forme, et la lecon est deja ecrite dans
-- `009` : *« une cle etrangere presente dans `pg_constraint` ne prouve pas que PostgREST la
-- voit »*. Ce qui manquait ici n'etait pas la connaissance, c'etait **un compte reel qui
-- ecrive une reponse** — l'angle mort A6 du releve, exactement.
--
-- ## Ce que la contrainte fait, et ce qu'elle ne fait pas
--
-- Elle donne le chemin d'embarquement, et elle impose qu'un auteur de reponse **ait un
-- profil** — ce que `review_comments_insert` exigeait deja par `has_handle`. Les deux disent
-- la meme chose a deux etages : la politique refuse l'ecriture, la cle etrangere refuse
-- l'incoherence. Aucune ligne existante ne peut la violer.
--
-- ⚠️ `on delete cascade` comme les trois de `009` : effacer un profil emporte ses reponses.
-- Un fil signe par un compte qui n'existe plus n'est ni ouvrable ni signalable.
-- =============================================================================

-- ⚠️ `add constraint … if not exists` n'existe pas pour les cles etrangeres : on retire puis
-- on repose, ce qui rend le fichier rejouable. Meme forme qu'en `009`.
alter table public.review_comments drop constraint if exists review_comments_author_profile;
alter table public.review_comments
  add constraint review_comments_author_profile
  foreign key (author_id) references public.profiles (user_id) on delete cascade;

comment on constraint review_comments_author_profile on public.review_comments is
  'Donne a PostgREST le chemin `profiles!inner` — sans elle, lire un fil rend 400 PGRST200 '
  'et l''ecran est celui d''une serie sans reponse. Voir 025_comment_author_profile.sql.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select conname from pg_constraint where conname = 'review_comments_author_profile';
--
--   Attendu : une ligne. ⚠️ Et ca ne suffit pas — `009` le dit : la contrainte peut exister
--   sans que PostgREST la voie, son cache de schema se rafraichit a part. La seule preuve qui
--   vaille est la requete elle-meme, en 200 :
--
--     GET /rest/v1/review_comments?select=id,profiles!inner(handle)&limit=1
-- =============================================================================

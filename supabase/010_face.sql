-- =============================================================================
-- 010_face.sql — la face des autres (9.4)
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce qui est publie, et ce qui ne l'est pas
--
-- **Un mot, et rien d'autre.** Ni le nombre de series terminees, ni le taux d'achevement,
-- ni la saison mediane d'abandon — c'est-a-dire rien de ce qui a servi a le calculer. La
-- face est un **resultat**, et le journal qui la produit reste ou il est : dans le
-- navigateur de son proprietaire.
--
-- C'est aussi ce qui la rend gratuite a l'echelle : le client calcule et pose un mot ; le
-- serveur ne calcule rien, ne cumule rien, et n'a donc aucun cout par utilisateur. Comparer
-- les faces entre elles — les « jeux » de 9.5 — demanderait au contraire une agregation
-- serveur, et c'est exactement ce qui a tue TV Time. Cette colonne n'y prepare rien.
--
-- ## Elle vit ici et non dans le journal, et c'est une decision
--
-- La face **se derive** du journal a chaque calcul : la ranger dans le journal donnerait un
-- second etat a garder d'accord avec le premier, et deux appareils s'en disputeraient la
-- valeur. Meme raisonnement que « l'etat publie d'une critique ne vit pas dans le journal »
-- (`types.ts`) : ce qui est **publie** appartient au serveur, qui en detient la copie.
--
-- ⚠️ Corollaire : la face suit la visibilite du profil, puisqu'elle est **une colonne de
-- `profiles`** et que `profiles_select_visible` gouverne la ligne entiere. Un profil
-- `private` ne montre pas sa face — sans qu'une regle de plus ait a etre ecrite.
--
-- ## Les trois noms, et pourquoi ce ne sont pas des couleurs
--
-- `finisher` mene au bout · `cutter` coupe tot et sans regret · `rewatcher` revient.
--
-- Le reflexe aurait ete `red` / `blue` / `yellow`, puisque c'est ainsi qu'on les reconnait —
-- et ce serait ranger une **presentation** dans une donnee durable. Ce depot a deja paye
-- exactement ca avec `statusLabel`, memorise deja traduit. Le lot 9 est ouvert pour changer
-- la palette : `red` en base deviendrait un mensonge le jour ou elle changerait.
-- =============================================================================

alter table public.profiles add column if not exists face text;

-- Contrainte **nommee**, retiree puis reposee : c'est la forme de `005_liked.sql`, et elle
-- est ce qui rend le fichier rejouable. Une contrainte anonyme posee dans le `add column`
-- ne se retrouverait plus pour etre remplacee le jour ou une quatrieme face existerait.
alter table public.profiles drop constraint if exists profiles_face_check;
alter table public.profiles
  add constraint profiles_face_check
  check (face is null or face in ('finisher', 'cutter', 'rewatcher'));

comment on column public.profiles.face is
  'Le resultat de src/domain/face.ts, pose par le client. Null = sous le seuil, donc on se tait.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   Aucune politique nouvelle : `profiles_update_own` couvre deja cette colonne
--   (`auth.uid() = user_id` en `using` ET en `with check`), donc personne ne peut poser la
--   face de quelqu'un d'autre. A verifier comme tel — c'est le seul risque de ce fichier :
--
--     depuis A :  update profiles set face = 'finisher' where user_id = <B>;
--     → 0 ligne. Pas une erreur : RLS **ne voit pas** la ligne, donc il n'y a rien a mettre
--       a jour. C'est le comportement attendu, et c'est pourquoi il faut compter les lignes
--       plutot que d'attendre un refus.
-- =============================================================================

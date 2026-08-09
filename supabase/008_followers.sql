-- =============================================================================
-- 008_followers.sql — voir qui nous suit
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Le defaut que ce fichier repare, et il n'etait pas dans le client
--
-- Le lot 6 a livre « suivre quelqu'un » et jamais son pendant : on voit qui l'on suit,
-- **jamais qui nous suit**. Ecrire la lecture cote client ne suffisait pas, et c'est le
-- constat qui a ouvert ce lot :
--
--   `follows_select_mine` rend deja la ligne (`auth.uid() = followee_id`), donc je SAIS
--   que quelqu'un me suit. Mais `profiles_select_visible` passe par `can_see()`, qui exige
--   que **je** suive la personne en retour. Un abonne en visibilite `followers` — la valeur
--   par defaut (Q1) — m'est donc invisible.
--
-- Le bloc aurait affiche « 3 personnes vous suivent » **sans un seul nom**, c'est-a-dire un
-- compteur sans geste possible : ni ouvrir, ni suivre en retour, ni signaler.
--
-- ## Deux decisions, et elles sont ecrites ici parce qu'elles ne se relisent pas ailleurs
--
-- 1. **Le nom de qui me suit m'est visible** (tranche par Tristan, 2026-08-10), y compris
--    pour un profil `private`. On ne suit personne anonymement : suivre est un acte dirige
--    vers quelqu'un, et le rendre anonyme donnerait un observateur qu'on ne peut ni voir ni
--    signaler. C'est aussi le modele de tous les produits qui ont un abonnement sans
--    reciprocite. Qui ne veut pas etre vu **ne suit pas** — et peut se desabonner.
--    ⚠️ `is_followable` interdit de **suivre** un profil `private` ; rien n'interdit a un
--    profil `private` d'en suivre un autre. Ce sont deux directions differentes.
--
-- 2. **Aucun contenu n'est ouvert.** Cette politique porte sur `profiles`, c'est-a-dire sur
--    le handle et le nom affiche. `activity`, `reviews` et `lists` restent gouvernes par
--    `can_see()`, inchangee. Voir mon nom n'est pas voir ce que je regarde.
--
-- ## Pourquoi une SECONDE politique et non une modification de l'existante
--
-- Postgres unit les politiques permissives d'une meme commande par un **OU**. Ajouter une
-- politique elargit donc exactement de ce qu'elle decrit, et `profiles_select_visible` reste
-- litteralement le texte que les 11 scenarios RLS du 2026-08-09 ont valide. Modifier
-- l'existante aurait demande de tout rejouer pour prouver qu'on n'a rien retire.
-- =============================================================================

/**
 * Cette personne me suit-elle ?
 *
 * ## Pourquoi `security definer`, alors que la sous-requete passerait
 *
 * Ecrite en clair dans la politique, la sous-requete sur `follows` serait soumise a RLS —
 * et elle passerait ici, puisque `follows_select_mine` rend les lignes ou
 * `auth.uid() = followee_id`, ce qui est exactement le cas teste.
 *
 * 🔴 **Mais c'est le raisonnement qui a produit l'impasse de `follows_insert_own`**
 * (`003_social.sql:172`) : « le correctif evident ne suffisait pas — ecrire la condition
 * comme une sous-requete la soumet elle aussi a RLS ». Elle passe *aujourd'hui*, avec les
 * politiques *d'aujourd'hui*. Un durcissement futur de `follows_select_mine` refermerait
 * cette lecture **en silence**, et le symptome serait des profils qui disparaissent.
 *
 * Les trois fonctions de visibilite du schema (`can_see`, `is_followable`, celle-ci) ont
 * donc la meme forme : `security definer`, `set search_path = ''`, `stable`. Une regle de
 * visibilite ne depend pas d'une autre regle de visibilite.
 */
create or replace function public.follows_me(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = target and f.followee_id = auth.uid()
  );
$$;

comment on function public.follows_me(uuid) is
  'Vrai si `target` me suit. Ouvre son handle, jamais son contenu — voir 008_followers.sql.';

drop policy if exists profiles_select_my_followers on public.profiles;
create policy profiles_select_my_followers on public.profiles
  for select using (public.follows_me(user_id));

-- -----------------------------------------------------------------------------
-- On ne suit pas sans nom
-- -----------------------------------------------------------------------------
--
-- 🔴 **Le trou que « voir qui me suit » a rendu visible.** `follows_insert_own` n'exige
-- **pas** que celui qui suit ait reclame un handle : il exige `auth.uid() = follower_id`,
-- et rien de plus. Or un compte sans profil n'a **aucune ligne** dans `profiles`, donc il
-- n'apparait dans la liste de mes abonnes ni avec ce fichier, ni sans lui — il n'y a rien
-- a montrer.
--
-- Le resultat est exactement ce que la decision n°1 refuse : **un observateur qu'on ne peut
-- ni voir ni signaler**, qui lit mon fil (il me suit, donc `can_see` est vrai si je suis en
-- `followers`) sans jamais exister a mes yeux. La feature entiere serait fausse par un cas
-- qu'elle ne peut pas afficher.
--
-- ⚠️ Ce n'est pas une contrainte nouvelle, c'est une contrainte **jamais executee** :
-- `Friends.tsx` demande deja de reclamer un nom avant tout geste social. `PublicProfile`,
-- lui, montrait le bouton « Suivre » a tout compte connecte — le bouton part avec ce lot,
-- pour la raison ecrite le 2026-08-09 : *un bouton qui ne peut pas marcher ne se degrade
-- pas, il ne s'affiche pas.*
--
-- Narrower, donc : aucune ligne existante n'est touchee, seules les futures sont refusees.

create or replace function public.has_handle(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = target);
$$;

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows
  for insert with check (
    auth.uid() = follower_id
    and public.has_handle(auth.uid())
    and public.is_followable(followee_id)
  );

-- =============================================================================
-- Verification
-- =============================================================================
--
-- Avec deux comptes A et B, B en visibilite `followers` et A ne suivant PAS B :
--
--   1. B suit A.
--   2. Depuis A : `select handle from profiles where user_id = <B>` → **une ligne**.
--      (Avant ce fichier : zero.)
--   3. Depuis A : `select count(*) from activity where user_id = <B>` → **zero**.
--      C'est la decision n°2 : le nom s'ouvre, le contenu non.
--   4. Depuis B : `select handle from profiles where user_id = <A>` → depend de A, pas de
--      ce fichier. Suivre quelqu'un n'ouvre pas son profil ; c'est l'inverse qui est vrai.
--   5. Depuis un compte connecte **sans handle** : `insert into follows …` → **refuse**.
-- =============================================================================

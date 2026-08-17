-- =============================================================================
-- 031_blocks.sql — se soustraire a quelqu'un, sans passer par la moderation
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le seul recours du produit etait de **demander de l'aide**
--
-- Depuis l'ouverture du social il existe un chemin de signalement (`004`), un fil de
-- reponses (`024`), des abonnements (`003`) — et **aucun geste qu'une personne puisse faire
-- seule** pour qu'une autre cesse de la lire, de la suivre et de lui repondre. Signaler
-- demande a quelqu'un d'autre de trancher, sous 48 heures (`/regles`) ; passer son profil en
-- `private` se retire de **tout le monde** pour se retirer d'un seul.
--
-- C'est le manque le plus grave qu'un produit social puisse avoir, et il ne se voyait pas
-- parce qu'il n'a de consequence qu'au premier incident.
--
-- ## Ce que bloquer fait, exactement
--
-- 1. **Les deux cotes cessent de se voir.** Pas seulement « il ne me voit plus » : voir
--    quelqu'un qu'on a bloque, sur une vitrine ou dans un classement, c'est le rencontrer
--    encore. La reference fait pareil, et c'est la seule forme qui tienne.
-- 2. **Le suivi tombe, dans les deux sens** — par le declencheur ci-dessous. Sans ca, un
--    abonnement d'avant survivrait a un blocage, et `can_see` continuerait de rendre vrai
--    pour un profil `followers`.
-- 3. **Suivre redevient impossible** (`is_followable`), et **repondre aussi** : les deux
--    passent deja par les fonctions qu'on modifie ici, donc aucune politique de `024` n'a
--    besoin d'etre touchee. C'est tout l'interet d'avoir mis la visibilite dans des
--    fonctions plutot que dans vingt sous-requetes.
--
-- ## ⚠️ Ce que bloquer NE fait pas, et il faut le dire
--
-- **Rien n'est efface.** Une reponse deja ecrite reste ecrite, un coeur deja pose reste
-- compte. Effacer retroactivement serait donner a n'importe qui un pouvoir de suppression
-- sur les textes d'autrui — exactement ce que `024` refuse a l'auteur d'une critique sur son
-- propre fil. Le blocage regarde vers l'avant.
--
-- **Rien n'est annonce.** La personne bloquee ne l'apprend pas : `blocks_select` ne rend que
-- ses propres lignes au **bloqueur**. Un blocage qui se signale est un blocage qu'on hesite a
-- poser, et il transforme un retrait en message.
--
-- ⚠️ **Ce n'est pas un remplacement du signalement.** Bloquer se soustrait ; signaler
-- demande qu'on regarde. Les deux gestes vivent cote a cote sur un profil, et `/regles` ne
-- change pas d'un mot : la moderation reste ce qu'elle etait.
-- =============================================================================

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Comme `follows_not_self` en `003` et `review_likes_not_self` en `029` : un geste social
  -- suppose quelqu'un d'autre. C'est la troisieme fois, et la contrainte est la meme.
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- ⚠️ L'index sur `blocked_id` n'est pas du zele : {@link blocked_with} interroge la table
-- **dans les deux sens**, et elle est appelee par `can_see`, donc par presque toutes les
-- lectures du produit. Sans lui, chaque lecture ferait un parcours complet.
create index if not exists blocks_by_blocked on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- -----------------------------------------------------------------------------
-- Lire : ses propres blocages, et **rien d'autre**
-- -----------------------------------------------------------------------------
--
-- ⚠️ Volontairement **pas** `blocked_id = auth.uid()` : savoir qui vous a bloque est une
-- information qu'on ne donne pas. Elle transformerait le retrait en notification, et elle
-- ferait de la table un annuaire de conflits.
drop policy if exists blocks_select_mine on public.blocks;
create policy blocks_select_mine on public.blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete using (auth.uid() = blocker_id);

-- -----------------------------------------------------------------------------
-- La question, posee une fois pour tout le schema
-- -----------------------------------------------------------------------------
--
-- `security definer`, `stable`, `search_path` vide : la meme forme que `can_see`,
-- `is_followable` et `follows_me`, et pour la raison que `008` a ecrite — *une regle de
-- visibilite ne depend pas d'une autre regle de visibilite*. Ecrite en sous-requete, elle
-- serait soumise a `blocks_select_mine`, qui ne rend que le sens « j'ai bloque » : le sens
-- « il m'a bloque » serait alors **toujours faux**, et le blocage ne protegerait que celui
-- qui n'en a pas besoin.
create or replace function public.blocked_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = target and b.blocked_id = auth.uid())
       or (b.blocker_id = auth.uid() and b.blocked_id = target)
  );
$$;

comment on function public.blocked_with(uuid) is
  'Vrai si un blocage existe entre `target` et moi, dans un sens ou dans l''autre. '
  'Voir 031_blocks.sql pour pourquoi les deux sens comptent.';

-- -----------------------------------------------------------------------------
-- Les trois regles qui changent, et rien de plus
-- -----------------------------------------------------------------------------
--
-- ⚠️ `target = auth.uid()` reste **en tete** : se voir soi-meme ne depend d'aucun blocage, et
-- inverser l'ordre ferait disparaitre son propre profil le jour ou une ligne fautive existe.
create or replace function public.can_see(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target = auth.uid()
    or (
      not public.blocked_with(target)
      and exists (
        select 1 from public.profiles p
        where p.user_id = target
          and (
            p.visibility = 'public'
            or (
              p.visibility = 'followers'
              and exists (
                select 1 from public.follows f
                where f.follower_id = auth.uid() and f.followee_id = target
              )
            )
          )
      )
    );
$$;

-- Suivre est un acte, voir est un droit (`003`) — mais on ne suit pas quelqu'un dont on
-- s'est soustrait, ni quelqu'un qui s'est soustrait de nous.
create or replace function public.is_followable(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.blocked_with(target) and exists (
    select 1 from public.profiles p where p.user_id = target and p.visibility <> 'private'
  );
$$;

-- 🔴 **Le raccourci `visibility = 'public'` contournait tout.** `profiles_select_visible` rend
-- un profil public **sans passer par `can_see`** : sans cette reecriture, bloquer quelqu'un
-- dont le profil est public n'aurait rien fait — on aurait continue de le croiser partout, et
-- le geste aurait eu l'air de marcher. C'est la seule politique du schema qui court-circuite
-- la fonction, et c'est exactement pour ca qu'elle doit etre reecrite ici.
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles
  for select using (
    user_id = auth.uid()
    or (not public.blocked_with(user_id) and (visibility = 'public' or public.can_see(user_id)))
  );

-- Meme trou du cote des abonnes (`008`) : le handle d'un abonne s'ouvrait sans `can_see`.
drop policy if exists profiles_select_my_followers on public.profiles;
create policy profiles_select_my_followers on public.profiles
  for select using (public.follows_me(user_id) and not public.blocked_with(user_id));

-- -----------------------------------------------------------------------------
-- Le suivi tombe, dans les deux sens
-- -----------------------------------------------------------------------------
--
-- ⚠️ Un declencheur et non une ligne dans le client : `follows_delete_own` ne laisse defaire
-- que **ses propres** abonnements, donc un client ne pourrait jamais retirer celui d'en face.
-- Sans ca, un abonnement d'avant survivrait au blocage et `can_see` continuerait de rendre
-- vrai pour un profil `followers` — c'est-a-dire que le blocage ne bloquerait rien.
create or replace function public.drop_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows f
  where (f.follower_id = new.blocker_id and f.followee_id = new.blocked_id)
     or (f.follower_id = new.blocked_id and f.followee_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_drop_follows on public.blocks;
create trigger blocks_drop_follows
  after insert on public.blocks
  for each row execute function public.drop_follows_on_block();

-- -----------------------------------------------------------------------------
-- Relire sa propre liste — et pourquoi une fonction est necessaire
-- -----------------------------------------------------------------------------
--
-- 🔴 **Le piege que ce lot fabrique lui-meme.** Bloquer quelqu'un rend son profil illisible
-- pour moi (c'est le point) — donc `blocks` rend des identifiants dont je ne peux plus
-- resoudre le **nom**. Une page « personnes bloquees » afficherait une liste d'UUID, et
-- debloquer demanderait de reconnaitre quelqu'un a son identifiant.
--
-- La sortie est celle qu'on emploie deja pour les compteurs (`027`) : une fonction
-- `security definer` qui ne rend **que ce que l'appelant a lui-meme ecrit**. Aucune identite
-- n'en sort qui ne soit deja la sienne — c'est sa propre liste.
create or replace function public.my_blocks()
returns table (user_id uuid, handle text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.handle, b.created_at
  from public.blocks b
  join public.profiles p on p.user_id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

comment on function public.my_blocks() is
  'Les gens que J AI bloques, avec leur nom. Necessaire parce que le blocage rend leur '
  'profil illisible — sans elle, la page de reglages afficherait des identifiants.';

comment on table public.blocks is
  'Se soustraire a quelqu''un. Les deux cotes cessent de se voir, le suivi tombe, et rien '
  'n''est annonce ni efface — voir 031_blocks.sql.';

notify pgrst, 'reload schema';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select public.blocked_with('…uuid…');
--   select polname from pg_policies where tablename = 'blocks';   → trois
--
--   ⚠️ La seule preuve qui vaille est celle des scenarios : `npm run db:scenarios` en pose
--   six (83 a 88), dont celui qui compte le plus — un profil **public** cesse d'etre lisible
--   par qui l'a bloque, ce que la version d'avant laissait passer.
-- =============================================================================

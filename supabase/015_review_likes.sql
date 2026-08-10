-- =============================================================================
-- 015_review_likes.sql — « quelqu'un t'a lu »
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Le trou que ce fichier referme
--
-- Depuis le 2026-08-10, les critiques entrent dans le fil : on ecrit, et les autres le
-- voient. Mais **rien ne revient jamais vers l'auteur**. Ecrire dans le vide est ce qui
-- fait arreter d'ecrire, et c'est le carburant que Letterboxd a compris avant tout le
-- monde : une note dit la qualite, un coeur dit qu'on a ete lu.
--
-- ## Aucune surface de moderation nouvelle
--
-- Un coeur ne porte **aucun texte**. Il n'y a rien a signaler, rien a masquer, rien a
-- traduire. C'est ce qui permet de le livrer avant 5.0, exactement comme les critiques
-- dans le fil.
--
-- ## 🔴 Le compteur, et pourquoi il differe de la decision de 10.2
--
-- 10.2 (« qui d'autre l'a vue ») a refuse tout compteur, et la raison etait juste : il
-- comptait des lignes **rendues par RLS**, donc le nombre variait d'un lecteur a l'autre
-- pour la meme serie. Un chiffre qui change selon qui regarde n'est pas un chiffre.
--
-- Ici le compte passe par une fonction `security definer` : il est **le meme pour tout le
-- monde**, parce qu'il ne depend d'aucune visibilite. La difference n'est pas un
-- revirement, c'est que ce n'est pas la meme mesure — l'une comptait ce qu'on voit,
-- l'autre compte ce qui est.
--
-- ⚠️ Et le compte ne dit **jamais qui** : les identites restent gouvernees par RLS. On
-- apprend « douze personnes », et on ne lit que les noms qu'on avait deja le droit de
-- lire. Un agregat n'est pas un annuaire.
-- =============================================================================

create table if not exists public.review_likes (
  liker_id uuid not null references auth.users (id) on delete cascade,
  -- L'auteur de la critique aimee. Denormalise **volontairement** : sans lui, la cle
  -- etrangere vers `reviews` serait impossible, et « qui a aime MES critiques » demanderait
  -- une jointure a chaque lecture.
  author_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  target text not null,
  created_at timestamptz not null default now(),
  primary key (liker_id, author_id, subject, target),
  -- ⚠️ La cle etrangere **composite** vers la critique elle-meme. Deux effets, et les deux
  -- comptent : on ne peut pas aimer une critique qui n'existe pas, et retirer une critique
  -- emporte ses coeurs — sans quoi ils resteraient a compter dans le vide.
  constraint review_likes_review_fk
    foreign key (author_id, subject, target)
    references public.reviews (user_id, subject, target)
    on delete cascade
);

create index if not exists review_likes_by_review
  on public.review_likes (author_id, subject, target);

alter table public.review_likes enable row level security;

-- Lire : ce que la visibilite de l'auteur du coeur autorise, plus les siens.
--
-- ⚠️ C'est `can_see(liker_id)` et non `can_see(author_id)` : la question posee est « ai-je
-- le droit de savoir que CETTE personne a aime », pas « ai-je le droit de lire la
-- critique » — celle-la, `reviews_select` y a deja repondu.
drop policy if exists review_likes_select on public.review_likes;
create policy review_likes_select on public.review_likes
  for select using (
    liker_id = auth.uid()
    or author_id = auth.uid()
    or public.can_see(liker_id)
  );

-- Ecrire : chez soi seulement, et **avec un nom**.
--
-- ⚠️ `has_handle` pour la meme raison qu'en 008 : un compte sans profil qui aime une
-- critique serait un lecteur qu'on ne peut ni voir ni signaler. La feature entiere serait
-- fausse par un cas qu'elle ne peut pas afficher.
drop policy if exists review_likes_insert on public.review_likes;
create policy review_likes_insert on public.review_likes
  for insert with check (auth.uid() = liker_id and public.has_handle(auth.uid()));

-- Retirer le sien, et rien d'autre. Un coeur se reprend — ce n'est pas un fait vecu.
drop policy if exists review_likes_delete on public.review_likes;
create policy review_likes_delete on public.review_likes
  for delete using (auth.uid() = liker_id);

-- -----------------------------------------------------------------------------
-- Combien, pour un lot de critiques
-- -----------------------------------------------------------------------------

/**
 * Le nombre de coeurs de chaque critique d'une serie, **stable pour tout le monde**.
 *
 * ⚠️ Un lot et non une critique : une fiche serie en affiche dix, et dix appels seraient
 * dix fois le cout — precisement ce que ce produit refuse partout. Le client passe le
 * sujet, la base rend une ligne par critique.
 *
 * ⚠️ `security definer` **uniquement pour compter**. Aucune identite ne sort d'ici : le
 * `liker_id` n'est pas projete, et lire les noms passe par la table, donc par RLS.
 */
create or replace function public.review_like_counts(for_subject text)
returns table (author_id uuid, target text, likes integer, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.author_id,
    l.target,
    count(*)::integer,
    bool_or(l.liker_id = auth.uid())
  from public.review_likes l
  where l.subject = for_subject
  group by l.author_id, l.target;
$$;

comment on function public.review_like_counts(text) is
  'Combien de coeurs par critique d une serie. Stable pour tous — voir 015_review_likes.sql.';

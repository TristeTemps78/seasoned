-- =============================================================================
-- 024_review_comments.sql — repondre a une critique
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Ce que le releve du 2026-08-16 disait, et pourquoi il hesitait
--
-- « Rien nulle part. C'est le fil de discussion de Letterboxd, et c'est aussi **une surface
-- de moderation entiere** — a decider franchement plutot qu'a laisser en creux. »
--
-- L'hesitation etait juste : tout ce que ce fichier ouvre, il faudra le tenir. Ce qui suit
-- dit ce qui a ete choisi, et surtout ce qui a ete refuse.
--
-- ## 🔴 Ce qu'on N'ouvre PAS, et c'est la moitie de la decision
--
-- **Aucun pouvoir de moderation cote client.** Il n'existe aucune politique permettant de
-- poser `hidden_at`, exactement comme en `006` : *« un pouvoir de moderation expose a un
-- client est un pouvoir qu'un client peut se donner »*. Le retrait passe par le tableau de
-- bord, et les signalements par `004`.
--
-- ⚠️ **L'auteur de la critique ne peut PAS effacer les commentaires des autres**, et ce n'est
-- pas un oubli. Ce serait le geste le plus naturel a ecrire, et il transforme chaque auteur
-- en moderateur de son propre fil — donc rend le produit responsable d'arbitrages qu'il ne
-- sait pas rendre. La voie reste celle de tout le reste : signaler (`ReportButton`, deja pose
-- sur chaque ligne du fil), et `/regles` dit ou ca arrive.
--
-- **Aucune modification.** Un commentaire ne s'edite pas : il se retire et se reecrit. Ca
-- evite la politique `UPDATE` — le chemin qui a rendu 42501 en silence le 2026-08-11, quatre
-- ecritures sur cinq — et ca vaut aussi comme decision de produit : un fil dont les messages
-- changent apres coup ne se lit plus.
--
-- ## Les bornes, et pourquoi elles different de celles d'une critique
--
-- 600 caracteres, la ou une critique en a 2000. Une critique est un texte qu'on ecrit ; un
-- commentaire est une reponse. La borne dit laquelle des deux on attend — et un fil de
-- reponses de 2000 caracteres est un fil que personne ne lit.
--
-- ## La cle etrangere composite, comme `015`
--
-- Elle porte deux garanties d'un coup : on ne commente pas une critique qui n'existe pas, et
-- **retirer une critique emporte ses commentaires**. Sans elle, un fil survivrait au texte
-- qu'il commente — des reponses a rien.
-- =============================================================================

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),

  -- La critique commentee, par sa cle naturelle — celle de `006`.
  review_author_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  target text not null,

  -- Qui repond.
  author_id uuid not null references auth.users (id) on delete cascade,

  body text not null check (length(body) between 1 and 600),
  -- ⚠️ Irrattrapable apres coup, meme raison qu'en `006` : sans elle, un corpus multilingue
  -- ne se filtre plus jamais. C'est le moment ou jamais.
  lang text not null check (lang in ('fr', 'en')),
  written_at timestamptz not null default now(),

  -- La moderation. On masque, on ne supprime pas : supprimer rendrait une erreur
  -- irrattrapable, et le masquage laisse la ligne consultable depuis le tableau de bord.
  hidden_at timestamptz,

  constraint review_comments_review_fk
    foreign key (review_author_id, subject, target)
    references public.reviews (user_id, subject, target)
    on delete cascade
);

create index if not exists review_comments_by_review
  on public.review_comments (review_author_id, subject, target, written_at asc);

alter table public.review_comments enable row level security;

-- -----------------------------------------------------------------------------
-- Lire
-- -----------------------------------------------------------------------------
--
-- ⚠️ **DEUX visibilites, et il faut les deux.** `can_see(author_id)` dit « ai-je le droit de
-- savoir que cette personne a repondu » ; `can_see(review_author_id)` dit « ai-je le droit de
-- lire ce fil ». Ne poser que la premiere laisserait lire les reponses posees sous la
-- critique de quelqu'un dont le profil m'est ferme — c'est-a-dire deduire l'existence et le
-- sujet d'une critique que `reviews_select` me refuse. Un commentaire est un revelateur de ce
-- qu'il commente.
--
-- Un commentaire masque reste lisible **par son auteur**, comme une critique masquee : sans
-- ca, le retrait serait indiscernable d'une panne pour la seule personne concernee.
drop policy if exists review_comments_select on public.review_comments;
create policy review_comments_select on public.review_comments
  for select using (
    (hidden_at is null or author_id = auth.uid())
    and public.can_see(author_id)
    and public.can_see(review_author_id)
  );

-- -----------------------------------------------------------------------------
-- Ecrire
-- -----------------------------------------------------------------------------
--
-- Chez soi, avec un nom, et **seulement sous une critique qu'on a le droit de lire**.
--
-- ⚠️ `has_handle` pour la troisieme fois apres `008` et `015` : un compte sans profil qui
-- repond serait un interlocuteur qu'on ne peut ni ouvrir ni signaler. Sur une surface de
-- discussion, c'est la condition qui rend la moderation possible du tout.
--
-- ⚠️ `can_see(review_author_id)` **dans le `with check`** : sans elle, on pourrait ecrire sous
-- une critique invisible — donc s'en servir comme sonde pour savoir qu'elle existe.
drop policy if exists review_comments_insert on public.review_comments;
create policy review_comments_insert on public.review_comments
  for insert with check (
    auth.uid() = author_id
    and public.has_handle(auth.uid())
    and public.can_see(review_author_id)
  );

-- -----------------------------------------------------------------------------
-- Retirer
-- -----------------------------------------------------------------------------
--
-- **Le sien, et rien d'autre.** Voir l'en-tete : donner ce pouvoir a l'auteur de la critique
-- ferait de chacun le moderateur de son fil.
drop policy if exists review_comments_delete on public.review_comments;
create policy review_comments_delete on public.review_comments
  for delete using (auth.uid() = author_id);

comment on table public.review_comments is
  'Les reponses a une critique. Aucune politique ne pose `hidden_at` et aucune ne permet '
  'de modifier : voir 024_review_comments.sql pour ce qui a ete refuse et pourquoi.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select polname, polcmd from pg_policies where tablename = 'review_comments';
--
--   Attendu : trois — `select`, `insert`, `delete`. **Pas d'`update`**, et ce n'est pas un
--   oubli : un commentaire ne s'edite pas, et la politique absente est ce qui le garantit.
-- =============================================================================

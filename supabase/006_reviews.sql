-- 006 — les critiques publiees.
--
-- ## Pourquoi une table, alors que le journal porte deja le texte
--
-- Le journal reste la **source de verite** : regle 9 (export integral — un texte qui ne vit
-- que sur le serveur meurt avec lui) et Q12 (si la base tombe, le produit continue : ecrire
-- ce qu'on pense ne doit pas demander de reseau).
--
-- Mais `journals` est RLS « own only », **par decision ecrite** (`001_journal.sql` : « il
-- n'existe aucune raison qu'un compte lise le journal d'un autre — le partage social passera
-- par une projection, jamais par cette table »). Rendre une critique lisible par le journal
-- exigerait donc d'ouvrir le document ENTIER. Impossible.
--
-- Et une seconde raison, qui a autant de poids : `/regles` promet « on masque, on ne supprime
-- jamais ». On ne masque pas une valeur dans le `jsonb` prive de quelqu'un que lui seul peut
-- ecrire. Une colonne `hidden_at` sur une table le fait — la promesse cesse d'etre du texte
-- pour devenir du code.
--
-- ## La cle naturelle
--
-- `(user_id, subject, target)` : republier REMPLACE, jamais ne duplique. Meme raisonnement
-- que `activity` — sans cle naturelle, chaque synchronisation dupliquerait le fil.

create table if not exists public.reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- La cle de journal, telle quelle : `tmdb:1396`.
  subject text not null,
  -- ⚠️ Le vocabulaire des pierres tombales du journal, et non un entier « 0 = serie » :
  -- la saison 0 existe chez TMDB, ce sont les episodes speciaux.
  target text not null check (target = 'series' or target ~ '^season:[0-9]+$'),
  body text not null check (length(body) between 1 and 2000),
  -- Jusqu'ou le texte va. Zero = sans spoiler, donc lisible par qui n'a pas commence.
  through_season integer not null default 0 check (through_season >= 0),
  -- ⚠️ Irrattrapable apres coup : sans elle, un corpus multilingue ne se filtre plus jamais
  -- (A9 — le produit vise l'international). C'est le moment ou jamais.
  lang text not null check (lang in ('fr', 'en')),
  written_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  -- La moderation. On masque, on ne supprime pas : supprimer rendrait une erreur
  -- irreparable et une contestation inexaminable.
  hidden_at timestamptz,
  primary key (user_id, subject, target)
);

create index if not exists reviews_by_subject on public.reviews (subject, published_at desc);

alter table public.reviews enable row level security;

-- Lire : ce que la visibilite du profil autorise, et qui n'est pas masque.
--
-- `can_see` existe depuis 003 et gere deja les trois visibilites, y compris le visiteur
-- anonyme sur un profil `public`. La reecrire ici serait la deuxieme chance de se tromper.
--
-- ⚠️ Son auteur continue de voir sa propre critique masquee. Sans cela, un retrait
-- ressemblerait a une perte de donnees vue de l'interieur.
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select
  using ((hidden_at is null or user_id = auth.uid()) and public.can_see(user_id));

-- Ecrire : chez soi seulement. Un client ne peut pas publier au nom d'un autre.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete using (auth.uid() = user_id);

-- ⚠️ AUCUNE politique ne permet de poser `hidden_at`, et c'est deliberé : le retrait se
-- fait depuis le tableau de bord, comme les signalements s'y lisent (004). Un pouvoir de
-- moderation expose a un client est un pouvoir qu'un client peut se donner.

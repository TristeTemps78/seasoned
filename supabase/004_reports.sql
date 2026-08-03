-- =============================================================================
-- 004_reports.sql — le canal de signalement (5.0b)
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## Pourquoi cette table n'existait pas avant aujourd'hui
--
-- Elle a ete **refusee deux fois**, et pour la bonne raison : *une table qu'on peut remplir
-- avant de savoir traiter un signalement est un piege*. Un formulaire branche sur du vide
-- promet un examen que personne n'a decide de faire.
--
-- Les deux conditions sont desormais remplies :
--
--   1. la **procedure** existe, publiee sur `/regles` — trois motifs de retrait typés, un
--      delai annonce de 72 h, et un droit de contestation (5.0a) ;
--   2. il existe enfin **quelque chose a signaler** : le fil montre ce qu'ecrivent des
--      tiers depuis le lot 6.6.
--
-- > L'ordre n'etait pas une precaution administrative : un signalement sans procedure est
-- > une boite aux lettres sans destinataire, et il vaut mieux ne pas en poser une.
--
-- ## Ce que cette table n'est pas
--
-- Ce n'est **pas** une file d'attente, ni une machine a etats. Le moteur de moderation
-- ecrit en aout — 281 lignes, tri par urgence, retablissement — a ete supprime le jour
-- meme : il mecanisait un traitement qui n'a encore jamais eu lieu. Ici on **recoit**, on
-- date, et on lit depuis le tableau de bord. La mecanique viendra avec le volume, s'il
-- vient.
-- =============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Qui signale. ⚠️ Conserve : un signalement anonyme ne peut ni etre recontacte, ni
  -- etre recoupe quand quelqu'un en depose trente en une nuit.
  reporter_id uuid not null references auth.users (id) on delete cascade,
  -- Qui est vise. `on delete cascade` : si le compte disparait, le signalement n'a plus
  -- d'objet — et le conserver serait garder une accusation contre quelqu'un qui n'est plus la.
  subject_id uuid not null references auth.users (id) on delete cascade,
  -- Le motif, **typé**, et le jeu vient de `src/domain/moderation.ts`.
  --
  -- ⚠️ Ce n'est pas de la bureaucratie : un motif typé se **gabarise**, donc l'auteur d'un
  -- retrait recoit toujours une explication, meme le jour ou l'on n'a pas le temps d'en
  -- rediger une. C'est la deuxieme des trois promesses de `/regles`.
  ground text not null check (ground in ('illegal', 'abuse', 'privacy', 'spam', 'spoiler')),
  -- Le texte libre est **facultatif** et vient en plus du motif, jamais a sa place.
  note text check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  -- Un signalant ne signale la meme personne pour le meme motif qu'une fois : sans cette
  -- cle, un clic repete gonfle un compteur et fait passer un agacement pour une vague.
  unique (reporter_id, subject_id, ground)
);

comment on table public.reports is
  'Les signalements recus. Lus depuis le tableau de bord — aucune surface de lecture applicative.';

alter table public.reports enable row level security;

-- ⚠️ **Aucune politique de lecture. C'est volontaire, et c'est la decision de ce fichier.**
--
-- Un signalement lisible par son auteur devient un accuse de reception, donc une promesse
-- de suivi qu'il faudrait tenir dans l'interface. Lisible par la personne visee, il devient
-- une denonciation nominative. Les deux sont pires que le silence.
--
-- La reponse passe par le canal annonce sur `/regles` : l'adresse de contact. Le tableau de
-- bord Supabase suffit a les lire tant qu'il y en a moins d'un par jour — et le jour ou il
-- y en aura davantage, ce sera un fait nouveau, pas une hypothese.
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert with check (
    auth.uid() = reporter_id
    -- On ne se signale pas soi-meme : ce n'est pas un usage, c'est un bruit.
    and reporter_id <> subject_id
  );

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select count(*) from public.reports;               -- depuis le tableau de bord
--   select ground, count(*) from public.reports group by 1 order by 2 desc;
--
-- ⚠️ Et la seule verification qui compte vraiment :
--
--   select rowsecurity from pg_tables where tablename = 'reports';   -- attendu : true
--
-- Une table de signalements lisible par tous exposerait qui a signale qui.
-- =============================================================================

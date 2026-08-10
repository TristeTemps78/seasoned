-- =============================================================================
-- 014_quiz_cron.sql — ce que la nuit fait toute seule
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Ce que ce fichier ne fait PAS, et c'est le plus important
--
-- Il **n'appelle pas TMDB**. Le reflexe etait `pg_cron` + `pg_net` : tout dans Supabase,
-- rien a heberger, aucun secret dehors. Les deux extensions sont bien disponibles (mesure
-- faite, scenario 20). Mais :
--
--   1. `pg_net` n'envoie ses requetes qu'**apres le commit**. Dans la transaction annulee
--      de `rls-scenarios.sql`, aucune requete ne partirait jamais : le harnais de ce depot
--      ne peut donc pas prouver un job ecrit ainsi.
--   2. Il faudrait le jeton TMDB **dans la base** (Vault), c'est-a-dire un secret de plus
--      a placer, a tourner et a surveiller.
--   3. Construire six questions demande de parcourir du JSON TMDB imbrique en PL/pgSQL,
--      la ou trente lignes de JavaScript le font en se relisant.
--
-- Trois couts pour remplacer une commande qui marche et se mesure. On garde donc
-- `npm run db:round`, qui sait construire **plusieurs jours d'avance**, et le cron ne
-- prend en charge que ce qu'il fait mieux que quiconque : **oublier**.
--
-- ## Ce qu'il fait, et pourquoi ca compte
--
-- La purge est une obligation, pas un confort : une question porte de la metadonnee TMDB,
-- et la regle 1 interdit de la conserver au-dela de six mois. Sans tache, `expires_at`
-- serait une intention ecrite dans une colonne que personne n'applique — exactement le
-- genre de garde-fou decoratif que ce depot a deja paye.
--
-- ⚠️ **Le fichier ne doit jamais echouer si `pg_cron` manque.** Il est rejoue a chaque
-- `db:push`, et une extension indisponible ne doit pas empecher le schema de s'appliquer.
-- D'ou le bloc qui avale l'erreur en la **disant**.
-- =============================================================================

do $$
begin
  create extension if not exists pg_cron;

  -- Rejouable : on retire la tache avant de la reposer, sinon `db:push` en empilerait une
  -- par execution.
  perform cron.unschedule('voltface-quiz-purge')
  where exists (select 1 from cron.job where jobname = 'voltface-quiz-purge');

  perform cron.schedule(
    'voltface-quiz-purge',
    '17 3 * * *',
    $job$ select public.quiz_purge(); $job$
  );

  raise notice 'pg_cron : purge des questions expirees programmee a 03:17';
exception when others then
  -- Ni `fail` ni silence : on le dit, et le schema continue de s'appliquer.
  raise notice 'pg_cron indisponible (%), la purge devra etre lancee autrement', sqlerrm;
end $$;

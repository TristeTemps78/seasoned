-- =============================================================================
-- rls-scenarios.sql — ce que RLS laisse voir, prouve contre la VRAIE base
-- =============================================================================
--
-- Lance par `npm run db:scenarios`. **Ne persiste rien**, jamais.
--
-- ## Pourquoi ce fichier existe
--
-- Les politiques RLS sont la seule couche d'autorisation du produit : PostgREST est
-- expose au navigateur avec une cle publique, donc ce qu'un inconnu peut lire est
-- **exactement** ce que ces politiques laissent passer. Rien de tout cela n'est
-- verifiable par les tests : ils doublent `fetch` et prouvent l'URL qu'on construit,
-- jamais qu'elle repond.
--
-- Les 11 scenarios du 2026-08-09 et les 7 + 4 du 2026-08-10 ont donc tourne a la main,
-- depuis un bloc-notes, et **n'ont pas survecu a leur session**. Le procede, lui, valait
-- d'etre garde. Il est ici.
--
-- ## Pourquoi ca ne peut pas laisser de trace
--
-- Le bloc se termine par un `raise exception`, jamais par un `commit`. Une exception
-- annule la transaction **entiere** — y compris le semis. Ce n'est pas un `rollback`
-- qu'on pourrait oublier d'ecrire ou ne pas atteindre : c'est le seul chemin de sortie,
-- succes comme echec. Le rapport voyage dans le message de l'exception.
--
-- ⚠️ Corollaire a ne pas perdre : **ce fichier ne doit jamais contenir de `commit`.**
--
-- ## Le detail qui rend la mesure vraie
--
-- `postgres` contourne RLS (`bypassrls`). Mesurer sous ce role rendrait tous les
-- scenarios verts sans rien prouver — c'est le piege exact de « une verification mal
-- ancree est pire qu'aucune : elle rassure ». Chaque mesure passe donc par
-- `set local role authenticated`, et l'identite est posee dans `request.jwt.claims`,
-- ou `auth.uid()` la lit — comme le ferait un vrai navigateur.
-- =============================================================================

do $$
declare
  -- Trois comptes : A regarde, B est regarde, Z est connecte mais n'a jamais pris de nom.
  a  uuid := gen_random_uuid();
  b  uuid := gen_random_uuid();
  z  uuid := gen_random_uuid();
  -- Un identifiant de passage, pour ne heurter aucune donnee reelle si elle arrive.
  tag text := 'rlstest' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  -- ⚠️ **La manche du jour, et pas une date inventee.** Ces scenarios ont d'abord seme sur
  -- `1999-01-01` pour ne heurter aucune vraie manche ; depuis que `quiz_serve` refuse tout
  -- ce qui n'est pas `current_date`, une date inventee ne mesurerait plus rien. On sepose
  -- donc sur le jour courant, avec des **ordinaux hors de portee** (901+) : c'est le
  -- numero qui evite la collision, pas la date.
  jour_test date := current_date;

  obtenu  text;
  attendu text;
  lignes  integer;
  n       integer := 0;
  echecs  integer := 0;
  rapport text := '';

begin
  -- ---------------------------------------------------------------------------
  -- Semis, en `postgres` : on fabrique la situation, on ne mesure rien encore.
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', tag || '_a@example.test'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', tag || '_b@example.test'),
    (z, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', tag || '_z@example.test');

  -- A est public, B est en `followers` — la valeur par defaut (Q1), et le cas qui compte.
  insert into public.profiles (user_id, handle, display_name, visibility)
  values (a, tag || 'a', 'A', 'public'),
         (b, tag || 'b', 'B', 'followers');

  -- B suit A. A ne suit PAS B : c'est toute la situation de 008.
  insert into public.follows (follower_id, followee_id) values (b, a);

  -- Du contenu chez B, pour distinguer « voir le nom » de « voir ce qu'il regarde ».
  insert into public.activity (user_id, kind, subject, season, stars, happened_on)
  values (b, 'rated_season', 'tmdb:1396', 1, 4.5, current_date);

  -- Un texte de chaque cote : le fil lit `reviews` **sans aucun filtre de visibilite**
  -- (`SocialClient.feedReviews`), en s'en remettant entierement a `reviews_select`. Cette
  -- confiance doit etre mesuree, pas supposee.
  insert into public.reviews (user_id, subject, target, body, through_season, lang)
  values (a, 'tmdb:1396', 'series', 'Ce que A en pense.', 0, 'fr'),
         (b, 'tmdb:1399', 'series', 'Ce que B en pense.', 0, 'fr');

  -- ---------------------------------------------------------------------------
  -- On devient A. Tout ce qui suit est mesure sous RLS.
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1 — 008 : le nom de qui me suit m'est visible, meme sans reciprocite.
  select count(*)::text into obtenu from public.profiles p where p.user_id = b;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. A voit le handle de B, qui le suit (008)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 2 — 008 decision n°2 : le nom s'ouvre, le contenu non.
  select count(*)::text into obtenu from public.activity where user_id = b;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. mais A ne voit RIEN de ce que B regarde (008)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 3 — 010 : personne ne pose la face de quelqu'un d'autre. RLS ne VOIT pas la ligne,
  --     donc ce n'est pas une erreur mais zero ligne mise a jour : on compte.
  update public.profiles set face = 'finisher' where user_id = b;
  get diagnostics lignes = row_count;
  obtenu := lignes::text;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. A ne peut pas poser la face de B (010)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 4 — 010 : et il pose bien la sienne, sinon la feature ne marche pour personne.
  update public.profiles set face = 'finisher' where user_id = a;
  get diagnostics lignes = row_count;
  obtenu := lignes::text;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. A pose sa propre face (010)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 5 — 009 : les trois cles etrangeres vers `profiles` sont **declarees**.
  --
  -- ⚠️ Ce scenario a d'abord teste une jointure SQL `join … on`, et c'etait faux : une
  -- jointure explicite marche **meme sans cle etrangere**. Elle serait donc passee au
  -- vert le 2026-08-10, le jour ou le fil ne pouvait rien lire. Ce qui manquait n'etait
  -- pas la capacite de joindre, c'est la **declaration** — PostgREST lit le catalogue
  -- Postgres pour deduire `profiles!inner(...)`, et ne devine rien.
  select count(*)::text into obtenu
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid = 'public.profiles'::regclass
    and c.conrelid in ('public.activity'::regclass,
                       'public.reviews'::regclass,
                       'public.lists'::regclass);
  n := n + 1; attendu := '3';
  rapport := rapport || format(E'  %s  %s. activity/reviews/lists declarent leur FK vers profiles (009)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 6 — 003 : une date future est refusee, et c'est la seule chose qu'un client ne peut
  --     pas forger lui-meme.
  begin
    insert into public.activity (user_id, kind, subject, happened_on)
    values (a, 'finished', 'tmdb:1399', current_date + 1);
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. une activite datee du futur est refusee (003)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 6bis — le fil des textes : A demande TOUTES les critiques, sans filtre, et n'obtient
  --        que les lisibles. B est en `followers` et A ne le suit pas.
  select count(*)::text into obtenu from public.reviews;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. « toutes les critiques » n''en rend qu''une a A (006)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- On devient Z : connecte, mais sans nom. C'est le trou que 008 a referme.
  -- ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', z::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 7 — 008 : un compte sans handle ne suit personne. Sans cette regle, il lirait le fil
  --     de A sans jamais apparaitre nulle part — ni visible, ni signalable.
  begin
    insert into public.follows (follower_id, followee_id) values (z, a);
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un compte sans nom ne peut pas suivre (008)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 8 — 003 : Z ne suit pas B et B est en `followers` — B lui est donc invisible.
  --     C'est le scenario qui prouve que le defaut n'est pas « tout ouvert ».
  select count(*)::text into obtenu from public.profiles p where p.user_id = b;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. un inconnu ne voit pas un profil « followers » (003)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 9 — 003 : le profil `public` de A, lui, se voit sans rien demander.
  select count(*)::text into obtenu from public.profiles p where p.user_id = a;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. un inconnu voit un profil « public » (003)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 9bis — et un inconnu ne lit que le texte du profil public, jamais celui de B.
  select count(*)::text into obtenu from public.reviews where user_id = b;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. un inconnu ne lit pas la critique d''un profil « followers » (006)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 10 — 003 : Z ne peut pas reclamer le nom de quelqu'un d'autre.
  begin
    insert into public.profiles (user_id, handle) values (z, tag || 'a');
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un handle deja pris est refuse (003)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 11 — 003 / Q7 : un handle reserve est refuse par le declencheur, pas par politesse.
  begin
    insert into public.profiles (user_id, handle) values (z, 'admin');
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un handle reserve est refuse (003, Q7)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- La manche du jour (013) — la mecanique anti-triche, mesuree
  -- ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);

  -- 🔴 **Une date que la production ne peut pas porter.** Ces scenarios semaient d'abord
  -- sur `current_date`, et ils ont casse le jour ou une VRAIE manche a existe : collision
  -- de cle primaire. Un test qui suppose l'absence de donnees reelles finit toujours par
  -- rencontrer des donnees reelles.
  insert into public.quiz_questions (on_day, ordinal, kind, prompt, choices, answer, expires_at)
  values
    (jour_test, 901, 'cast', '{"cast":["Bryan Cranston"]}', '["A","B","C","D"]', 2, now() + interval '1 day'),
    (jour_test, 902, 'poster', '{"path":"/x.jpg"}', '["A","B","C","D"]', 0, now() + interval '1 day');

  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 12 — 🔴 La bonne reponse ne sort JAMAIS de la base. Sans politique de lecture, la
  --      table entiere est fermee : RLS filtre des lignes, jamais des colonnes.
  select count(*)::text into obtenu from public.quiz_questions;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. un joueur ne peut pas lire les questions ni les reponses (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 13 — mais la fonction lui en sert une, sans la reponse.
  select count(*)::text into obtenu from public.quiz_serve(jour_test, 901);
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. quiz_serve rend la question (sans sa reponse) (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 14 — une reponse juste et rapide rapporte des points.
  select points::text into obtenu from public.quiz_answer(jour_test, 901, 2);
  n := n + 1;
  rapport := rapport || format(E'  %s  %s. repondre juste et vite rapporte des points (013)  [attendu > 0, obtenu %s]\n',
                               case when obtenu::integer > 0 then 'OK   ' else 'ECHEC' end, n, obtenu);
  if obtenu::integer <= 0 then echecs := echecs + 1; end if;

  -- 15 — 🔴 On ne repond pas deux fois. Sans ce garde-fou, on repondrait jusqu'a tomber
  --      juste, et le classement ne vaudrait rien.
  perform public.quiz_answer(jour_test, 901, 0);
  select points::text into obtenu from public.quiz_answers
    where user_id = a and on_day = jour_test and ordinal = 901;
  n := n + 1;
  rapport := rapport || format(E'  %s  %s. une seconde reponse ne change RIEN (013)  [attendu > 0, obtenu %s]\n',
                               case when obtenu::integer > 0 then 'OK   ' else 'ECHEC' end, n, obtenu);
  if obtenu::integer <= 0 then echecs := echecs + 1; end if;

  -- 16 — hors delai : zero. On simule en vieillissant `asked_at`, parce que `now()` est
  --      fige pour toute la transaction.
  perform public.quiz_serve(jour_test, 902);
  perform set_config('role', 'postgres', true);
  update public.quiz_answers set asked_at = now() - interval '40 seconds'
    where user_id = a and on_day = jour_test and ordinal = 902;
  perform set_config('role', 'authenticated', true);

  select points::text into obtenu from public.quiz_answer(jour_test, 902, 0);
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. juste mais hors delai ne rapporte rien (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 17 — 🔴 Et surtout : personne ne s'ecrit un score a la main. Aucune politique
  --      d'ecriture n'existe sur `quiz_answers`.
  begin
    insert into public.quiz_answers (user_id, on_day, ordinal, answered_at, correct, points)
    values (a, jour_test, 909, now(), true, 9999);
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. on ne s''ecrit pas un score a la main (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19pre — 🔴 **On ne joue pas la manche d'hier.** Les questions restent en base une
  --         semaine (regle 1), donc « expiree » ne voulait pas dire « fermee » : on
  --         pouvait ouvrir une manche passee sans pression, chercher les reponses, et
  --         modifier apres coup un classement deja publie.
  select count(*)::text into obtenu from public.quiz_serve(jour_test - 1, 901);
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. la manche d''hier ne se sert plus (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19pre-bis — et repondre a une manche passee ne rapporte rien non plus. Le verrou est
  --             repete dans `quiz_answer`, parce qu'une reponse peut arriver sans passer
  --             par `quiz_serve`.
  select points::text into obtenu from public.quiz_answer(jour_test - 1, 901, 2);
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. repondre a la manche d''hier ne rapporte rien (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19bis — 🔴 LE CLASSEMENT MONTRE-T-IL QUELQU'UN D'AUTRE QUE MOI ?
  --
  -- `quiz_board` est en `security_invoker`, donc evaluee avec les droits de l'appelant —
  -- ce qui etait le but pour que `profiles_select_visible` s'applique. Mais la vue lit
  -- AUSSI `quiz_answers`, dont la seule politique est `auth.uid() = user_id`. Si les deux
  -- se composent, un classement ne peut montrer que ses propres lignes, c'est-a-dire
  -- **rien**. C'est la question que l'audit du 2026-08-10 a posee, et elle se mesure.
  perform set_config('role', 'postgres', true);
  insert into public.quiz_answers (user_id, on_day, ordinal, asked_at, answered_at, correct, points)
  values (b, jour_test, 901, now(), now(), true, 80);
  perform set_config('role', 'authenticated', true);

  select count(*)::text into obtenu from public.quiz_board(jour_test) where user_id = b;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. A voit au classement B, qui le suit (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19ter — et l'inverse doit tenir : un inconnu ne lit pas ce classement. Sans ce
  --         scenario, « ouvrir a tout le monde » ferait passer le precedent au vert.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', z::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*)::text into obtenu from public.quiz_board(jour_test) where user_id = b;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. un inconnu ne voit PAS B au classement (013)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- On revient a A pour la suite.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 20 — La purge nocturne est **programmee**, pas seulement ecrite.
  --
  -- ⚠️ C'est le seul scenario qui verifie une tache plutot qu'une politique, et il a sa
  -- raison : `expires_at` sans tache serait une intention rangee dans une colonne que
  -- personne n'applique. La regle 1 (le catalogue est loue) deviendrait decorative, et
  -- rien ne le signalerait — une table qui grossit ne fait pas de bruit.
  perform set_config('role', 'postgres', true);
  select count(*)::text into obtenu from cron.job where jobname = 'voltface-quiz-purge';
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. la purge des questions expirees est programmee (014)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 21 — Et elle fait ce qu'elle promet : une question perimee disparait.
  insert into public.quiz_questions (on_day, ordinal, kind, prompt, choices, answer, expires_at)
  values (jour_test, 909, 'cast', '{}', '["A","B","C","D"]', 0, now() - interval '1 day');
  perform public.quiz_purge();
  select count(*)::text into obtenu from public.quiz_questions
    where on_day = jour_test and ordinal = 909;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. quiz_purge retire ce qui a expire (014)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- Sortie : toujours par une exception, donc toujours en annulant tout.
  -- ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  raise exception E'\n%  % scenario(s), % echec(s)\n  RIEN N''A ETE ECRIT : cette exception annule la transaction entiere.',
    rapport, n, echecs
    using errcode = 'RLSOK';
end $$;

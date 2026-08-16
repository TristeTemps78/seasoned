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
  -- Deux comptes de plus, qui ne servent qu'a **atteindre le plancher** de `stop_map` (016).
  -- Ils n'ont ni nom ni contenu : contribuer a la carte des abandons n'exige pas de profil,
  -- et c'est precisement ce que le semis doit refleter.
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
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
    (z, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', tag || '_z@example.test'),
    (c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', tag || '_c1@example.test'),
    (c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', tag || '_c2@example.test');

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

  -- 6bis — le fil des textes : A demande les critiques **sans filtre de visibilite**, et
  --        n'obtient que les lisibles. B est en `followers` et A ne le suit pas.
  --
  -- 🔴 Ce scenario comptait d'abord `from public.reviews` tout court, et il a casse le jour
  -- ou de VRAIES critiques ont ete ecrites (2026-08-10, 3 textes en production) : il en
  -- lisait 3 au lieu de 1. **Deuxieme fois qu'un scenario suppose l'absence de donnees
  -- reelles** — apres la manche du jour. On ne compte donc que les comptes semes ici ; ce
  -- qui est mesure reste le meme, et il ne depend plus de ce que contient la base.
  select count(*)::text into obtenu from public.reviews where user_id in (a, b, z);
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
  -- Les coeurs sur les critiques (015)
  -- ---------------------------------------------------------------------------

  -- A aime la critique de B. Il ne suit pas B, mais aimer ne demande pas de voir : c'est
  -- `reviews_select` qui decide si on PEUT lire, et cette ligne-la a deja ete mesuree.
  perform set_config('role', 'postgres', true);
  insert into public.review_likes (liker_id, author_id, subject, target)
  values (a, b, 'tmdb:1399', 'series');
  perform set_config('role', 'authenticated', true);

  -- 19a — l'auteur voit qui a aime sa critique. C'est TOUTE la feature : ce qui revient
  --       vers celui qui a ecrit. Mesure depuis B.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', b::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*)::text into obtenu from public.review_likes where author_id = b;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. l''auteur voit qui a aime sa critique (015)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19b — 🔴 le compte est le MEME pour tout le monde, contrairement aux lignes. C'est ce
  --       qui le distingue du compteur refuse en 10.2.
  select likes::text into obtenu from public.review_like_counts('tmdb:1399') limit 1;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. le compte de coeurs est stable (015)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19c — on n'aime pas au nom d'un autre.
  begin
    insert into public.review_likes (liker_id, author_id, subject, target)
    values (a, b, 'tmdb:1396', 'series');
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. on n''aime pas au nom d''un autre (015)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 19d — ⚠️ un coeur sur une critique inexistante est refuse par la cle etrangere
  --       composite : sans elle, on compterait des coeurs dans le vide.
  begin
    insert into public.review_likes (liker_id, author_id, subject, target)
    values (b, a, 'tmdb:99999', 'series');
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. on n''aime pas une critique qui n''existe pas (015)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- On revient a A pour la suite.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

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
  -- 016 — la carte des abandons : une table qu'on remplit sans jamais la relire
  -- ---------------------------------------------------------------------------
  --
  -- ⚠️ **Un sujet unique par execution.** Le fichier a deja casse deux fois pour avoir
  -- suppose une base vide ; ici le risque serait pire qu'un faux echec, puisque de vraies
  -- lignes feraient franchir le plancher et rendraient le scenario 25 vert par accident.
  -- `tag` garantit qu'on ne mesure que ce qu'on vient de semer.

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 22 — A contribue chez lui. Sans ca, rien de ce qui suit ne veut dire quoi que ce soit.
  insert into public.stops (user_id, subject, reached_season, left_at_season)
  values (a, tag || '_own', 4, 4);
  get diagnostics lignes = row_count;
  obtenu := lignes::text;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. A pose sa propre ligne d abandon (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 22 bis — 🔴 **LE MEME PIEGE QUE LE `DELETE`, SUR LE CHEMIN QUE LE CLIENT EMPRUNTE.**
  --
  -- Constate en production le 2026-08-16, connecte, a **chaque** chargement de page :
  --
  --   POST /rest/v1/stops → 403
  --   {"code":"42501","message":"new row violates row-level security policy for table \\"stops\\""}
  --
  -- Le scenario 22 juste au-dessus passe, et il passe pour une bonne raison : c'est un
  -- `INSERT` nu. Or `publishStops` envoie `Prefer: resolution=merge-duplicates`, que
  -- PostgREST traduit en `ON CONFLICT … DO UPDATE`. Des qu'une ligne existe deja — c'est-a-
  -- dire des la deuxieme publication —, le chemin `UPDATE` s'active, et **il doit lire la
  -- ligne en conflit**. Cette table n'ayant aucune politique `select`, il ne la lit pas.
  --
  -- C'est exactement le piege du scenario 28, sur une autre commande. Le depot l'avait
  -- trouve pour `DELETE` et ecrit noir sur blanc ; personne ne l'a cherche pour l'upsert,
  -- parce qu'aucun scenario ne rejouait la **forme** que le client envoie. Et le silence est
  -- le meme qu'en 10.0 : `publishStops` rend `response.ok`, donc `false`, que personne
  -- n'affiche — la carte des abandons ne recevait plus rien sans que rien ne le dise.
  -- (a) La forme que le client envoyait : refusee. C'est le defaut, ancre pour qu'on ne la
  --     reintroduise pas le jour ou elle « parait plus simple » — meme raison que le 28.
  begin
    insert into public.stops (user_id, subject, reached_season, left_at_season)
    values (a, tag || '_own', 5, 5)
    on conflict (user_id, subject) do update
      set reached_season = excluded.reached_season,
          left_at_season = excluded.left_at_season;
    obtenu := 'acceptee';
  exception when insufficient_privilege then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un upsert direct sur stops est refuse, faute de politique select (016)  [attendu %s, obtenu %s]
',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- (b) La forme qui la remplace (019) : la meme republication, par la porte etroite. Elle
  --     doit passer, et rendre le nombre de lignes ecrites — sans quoi le retrait resterait
  --     une promesse inverifiable, exactement comme pour `forget_stops`.
  begin
    select public.publish_stops(
             jsonb_build_array(
               jsonb_build_object('subject', tag || '_own', 'reached_season', 5, 'left_at_season', 5)
             ))::text
      into obtenu;
  exception when undefined_function then
    obtenu := 'fonction absente — appliquer 019 par npm run db:push';
  end;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. publish_stops republie la ligne de A (019)  [attendu %s, obtenu %s]
',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- (c) …et jamais celle de quelqu'un d'autre. `security definer` contourne RLS : c'est
  --     `auth.uid()`, impose cote fonction, qui tranche — le `user_id` du client n'est meme
  --     pas lu. Sans cette ligne, la porte etroite serait une porte ouverte.
  begin
    perform public.publish_stops(
              jsonb_build_array(
                jsonb_build_object('user_id', b::text, 'subject', tag || '_vol', 'reached_season', 2)
              ));
    perform set_config('role', 'postgres', true);
    select count(*)::text into obtenu from public.stops where subject = tag || '_vol' and user_id = b;
    perform set_config('role', 'authenticated', true);
  exception when undefined_function then
    obtenu := 'fonction absente';
  end;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. publish_stops ignore le user_id envoye par le client (019)  [attendu %s, obtenu %s]
',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 23 — 🔴 **LE scenario de ce lot.** La table n'a AUCUNE politique `select` : A ne relit
  --      pas meme la ligne qu'il vient d'ecrire. C'est la garantie d'anonymat elle-meme, et
  --      c'est la seule chose ici qu'aucun test ne peut prouver — ils doublent `fetch`.
  select count(*)::text into obtenu from public.stops;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. A ne relit RIEN, pas meme sa propre ligne (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 24 — Et il n'ecrit pas chez les autres : sinon la carte se truque en un `POST`.
  begin
    insert into public.stops (user_id, subject, reached_season)
    values (b, tag || '_own', 9);
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. A ne pose pas la ligne de B (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 25 — La contrainte de coherence, en SQL et pas seulement dans le domaine : une position
  --      se declare a la main, donc elle peut reculer.
  begin
    insert into public.stops (user_id, subject, reached_season, left_at_season)
    values (a, tag || '_bad', 2, 5);
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un arret plus loin que le point atteint est refuse (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- Quatre contributeurs sur une meme serie : un de moins que le plancher.
  perform set_config('role', 'postgres', true);
  insert into public.stops (user_id, subject, reached_season, left_at_season)
  values (a,  tag || '_m', 4, 4),
         (b,  tag || '_m', 4, 4),
         (z,  tag || '_m', 4, 4),
         (c1, tag || '_m', 4, null);
  perform set_config('role', 'authenticated', true);

  -- 26 — Sous le plancher, la fonction **se tait**. Pas un zero : zero ligne. Un zero serait
  --      une reponse, et sur un petit effectif une reponse redevient nominative.
  select count(*)::text into obtenu from public.stop_map(tag || '_m');
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. stop_map se tait a 4 contributeurs (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- Le cinquieme entre, et le plancher est franchi.
  perform set_config('role', 'postgres', true);
  insert into public.stops (user_id, subject, reached_season, left_at_season)
  values (c2, tag || '_m', 4, null);
  perform set_config('role', 'authenticated', true);

  -- 27 — Au plancher, elle parle — et elle compte juste : 5 arrives en saison 4, 3 arrets.
  --      ⚠️ Le denominateur est mesure avec le numerateur : c'est lui qui fait une courbe de
  --      survie plutot qu'un decompte, et un scenario qui ne verifierait que les arrets
  --      laisserait passer une fonction qui les rend sans base de comparaison.
  select format('%s/%s', s.left_here, s.reached) into obtenu
  from public.stop_map(tag || '_m') s where s.season = 4;
  n := n + 1; attendu := '3/5';
  rapport := rapport || format(E'  %s  %s. stop_map rend 3 arrets sur 5 arrives en S4 (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 28 — 🔴 **LE PIEGE, et il a coute une fonctionnalite silencieusement morte.**
  --
  -- Postgres applique aussi les politiques `select` a un `DELETE` porteur d'une clause
  -- `WHERE` : decider quoi effacer demande de lire. Cette table n'ayant AUCUNE politique
  -- `select`, un `DELETE … WHERE user_id = moi` — la seule forme que PostgREST accepte,
  -- puisqu'il exige un filtre — voit zero ligne, en efface zero, et repond **204**.
  --
  -- Le premier `forgetStops()` faisait exactement ca. Il compilait, il rendait `true`, et
  -- il ne retirait personne de la carte. Ce scenario existe pour que le raccourci ne soit
  -- pas re-ecrit un jour ou il « parait plus simple ».
  delete from public.stops where user_id = a;
  get diagnostics lignes = row_count;
  obtenu := lignes::text;
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. un DELETE filtre n efface RIEN, faute de politique select (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 29 — …d'ou la fonction. Elle efface reellement, et elle rend combien : sans ce nombre,
  --      le retrait resterait une promesse que personne ne peut verifier.
  select public.forget_stops()::text into obtenu;
  n := n + 1; attendu := '2';
  rapport := rapport || format(E'  %s  %s. forget_stops retire les 2 lignes de A (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 30 — …et rien d'autre. `security definer` contourne RLS : sans le `where` sur
  --      `auth.uid()`, la fonction viderait la carte de tout le monde. Ici B, Z, C1 et C2
  --      doivent rester — mesure en `postgres`, la seule facon de les voir.
  perform set_config('role', 'postgres', true);
  select count(*)::text into obtenu from public.stops where subject = tag || '_m';
  n := n + 1; attendu := '4';
  rapport := rapport || format(E'  %s  %s. forget_stops n emporte que les siennes (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;
  perform set_config('role', 'authenticated', true);

  -- 31 — Et la carte se tait a nouveau : le depart d'un contributeur repasse sous le
  --      plancher. C'est la preuve que le plancher se mesure a chaque appel, et non une
  --      fois pour toutes.
  select count(*)::text into obtenu from public.stop_map(tag || '_m');
  n := n + 1; attendu := '0';
  rapport := rapport || format(E'  %s  %s. la carte se retait quand on repasse sous le plancher (016)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- 017 — l'identite d'un fait porte la saison
  -- ---------------------------------------------------------------------------
  --
  -- 🔴 **Le scenario qui manquait, et son absence a coute la fonctionnalite entiere.**
  -- Mesure du 2026-08-11 : `activity` a 0 ligne alors que deux comptes ecrivaient depuis la
  -- veille. La cle d'origine ignorait `season`, donc deux saisons notees le meme soir
  -- tombaient sur la meme ligne — et `publish` envoyant tout d'un bloc en
  -- `merge-duplicates`, Postgres rejetait **l'envoi entier** :
  --
  --   [21000] ON CONFLICT DO UPDATE command cannot affect row a second time
  --
  -- Aucun test ne pouvait l'attraper : ils doublent `fetch`. Il fallait la vraie base et un
  -- vrai `ON CONFLICT`, c'est-a-dire exactement ce fichier.

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 32 — Deux saisons de la meme serie, le meme jour, dans UN seul envoi. C'est mot pour
  --      mot ce que `publish` emet, et c'est ce qui rendait 21000.
  begin
    insert into public.activity (user_id, kind, subject, season, stars, happened_on)
    values (a, 'rated_season', tag || '_s', 1, 4.0, current_date),
           (a, 'rated_season', tag || '_s', 2, 3.5, current_date)
    on conflict (user_id, kind, subject, season, happened_on) do update
      set stars = excluded.stars;
    get diagnostics lignes = row_count;
    obtenu := lignes::text;
  exception when others then
    -- Le code d'erreur EST la mesure : c'est lui qu'on lisait avant 017.
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '2';
  rapport := rapport || format(E'  %s  %s. deux saisons notees le meme jour passent en UN envoi (017)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 33 — 🔴 **Et republier doit passer.** `merge-duplicates` EST un `ON CONFLICT DO UPDATE` :
  --      le second envoi emprunte le chemin `UPDATE`, qui exige une politique `UPDATE`.
  --      `003_social.sql` n'en declarait aucune — trois politiques, jamais celle-la — donc
  --      le premier envoi d'un compte passait et **tous les suivants echouaient en 42501**.
  --      `PublishActivity` republiant toute la projection a chaque montage, le fil se
  --      figeait au premier chargement et aucun fait neuf n'arrivait plus : ils voyagent
  --      dans le meme lot que les anciens.
  --
  --      ⚠️ Ce scenario a d'abord ete ecrit `exception when others then null`, et il passait
  --      au vert **sans rien prouver** : le compte de 2 venait des lignes du scenario 32.
  --      Une verification mal ancree est pire qu'aucune — elle rassure.
  begin
    insert into public.activity (user_id, kind, subject, season, stars, happened_on)
    values (a, 'rated_season', tag || '_s', 1, 4.0, current_date),
           (a, 'rated_season', tag || '_s', 2, 3.5, current_date)
    on conflict (user_id, kind, subject, season, happened_on) do update
      set stars = excluded.stars;
    perform set_config('role', 'postgres', true);
    select count(*)::text into obtenu from public.activity where subject = tag || '_s';
    perform set_config('role', 'authenticated', true);
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '2';
  rapport := rapport || format(E'  %s  %s. le MEME envoi rejoue passe, et laisse 2 lignes (017)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 33bis — Et il **met a jour** : renoter une saison le meme jour doit changer l'etoile,
  --         sinon `do update` serait un `do nothing` deguise et le fil mentirait.
  begin
    insert into public.activity (user_id, kind, subject, season, stars, happened_on)
    values (a, 'rated_season', tag || '_s', 1, 1.5, current_date)
    on conflict (user_id, kind, subject, season, happened_on) do update
      set stars = excluded.stars;
    perform set_config('role', 'postgres', true);
    select stars::text into obtenu from public.activity
      where subject = tag || '_s' and season = 1;
    perform set_config('role', 'authenticated', true);
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '1.5';
  rapport := rapport || format(E'  %s  %s. renoter la meme saison le meme jour ecrase l etoile (017)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 33ter — Mais un `UPDATE` ne deplace pas un fait vers le futur : la borne de date est
  --         reprise dans `with check`, sinon l'`INSERT` serait garde et l'`UPDATE` ouvert.
  begin
    update public.activity set happened_on = current_date + 1
     where subject = tag || '_s' and season = 1;
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un UPDATE ne peut pas dater un fait du futur (017)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 34 — 🔴 Le point qui interdisait une cle primaire : `season` est **nul** pour `finished`,
  --      `liked`, `started` et `wanted`. Une PK refuse le nul ; `unique nulls not distinct`
  --      l'accepte **et** le dedoublonne. Sans `nulls not distinct`, deux publications d'un
  --      meme coeur feraient deux lignes, et le fil se repeterait.
  begin
    insert into public.activity (user_id, kind, subject, season, stars, happened_on)
    values (a, 'liked', tag || '_c', null, null, current_date)
    on conflict (user_id, kind, subject, season, happened_on) do update
      set stars = excluded.stars;
    insert into public.activity (user_id, kind, subject, season, stars, happened_on)
    values (a, 'liked', tag || '_c', null, null, current_date)
    on conflict (user_id, kind, subject, season, happened_on) do update
      set stars = excluded.stars;
    obtenu := 'ok';
  exception when others then
    obtenu := sqlstate;
  end;
  perform set_config('role', 'postgres', true);
  if obtenu = 'ok' then
    select count(*)::text into obtenu from public.activity where subject = tag || '_c';
  end if;
  perform set_config('role', 'authenticated', true);
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. un fait sans saison s ecrit et ne se dedouble pas (017)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 35 — La cle elle-meme, lue dans le catalogue. Meme motif que le scenario 5 : ce n'est
  --      pas la capacite d'ecrire qu'on verifie ici, c'est la **declaration** — une cle
  --      primaire encore presente sur `activity` signifie que 017 n'a pas ete applique, et
  --      les scenarios 32-34 ne le diraient pas tous les deux si la base etait vide.
  perform set_config('role', 'postgres', true);
  select count(*)::text into obtenu
  from pg_constraint c
  where c.conrelid = 'public.activity'::regclass
    and c.contype = 'u'
    and c.conname = 'activity_fait'
    and (select count(*) from unnest(c.conkey)) = 5;
  perform set_config('role', 'authenticated', true);
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. activity_fait porte les 5 colonnes de l identite (017)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- Le geste refait — trois tables ou la cle EST le fait entier
  -- ---------------------------------------------------------------------------
  --
  -- 🔴 **Le meme defaut que 017, dans trois endroits de plus.** `merge-duplicates` emprunte
  -- le chemin `UPDATE` ; ces trois tables n'ont pas de politique `UPDATE`, et elles ont
  -- raison de ne pas en avoir : il n'y a rien a mettre a jour. Refaire le geste rendait
  -- donc **42501** partout, mesure le 2026-08-11 :
  --
  --   follows      2e suivi : 42501       review_likes 2e coeur : 42501
  --   list_items   2e ajout : 42501
  --
  -- Le correctif n'est pas d'ouvrir un droit d'ecriture dont personne n'a besoin, c'est
  -- `ignore-duplicates` — `ON CONFLICT DO NOTHING`, qui ne demande que l'`INSERT` deja
  -- accorde. Ces trois scenarios verifient la **forme SQL que le client emet desormais**.

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 46 — Suivre quelqu'un qu'on suit deja ne doit rien lever : c'est le meme etat.
  begin
    insert into public.follows (follower_id, followee_id) values (a, b) on conflict do nothing;
    insert into public.follows (follower_id, followee_id) values (a, b) on conflict do nothing;
    obtenu := 'ok';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := 'ok';
  rapport := rapport || format(E'  %s  %s. suivre deux fois ne leve pas (008)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 47 — Aimer deux fois la meme critique non plus. Le client le promettait deja en
  --      commentaire ; il ne le faisait pas.
  begin
    perform set_config('role', 'postgres', true);
    insert into public.reviews (user_id, subject, target, body, through_season, lang)
    values (b, tag || '_rev', 'series', 'Texte du scenario.', 0, 'fr');
    perform set_config('role', 'authenticated', true);

    insert into public.review_likes (liker_id, author_id, subject, target)
    values (a, b, tag || '_rev', 'series') on conflict do nothing;
    insert into public.review_likes (liker_id, author_id, subject, target)
    values (a, b, tag || '_rev', 'series') on conflict do nothing;

    perform set_config('role', 'postgres', true);
    select count(*)::text into obtenu from public.review_likes where subject = tag || '_rev';
    perform set_config('role', 'authenticated', true);
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '1';
  rapport := rapport || format(E'  %s  %s. aimer deux fois laisse UN coeur, sans lever (015)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 48 — Et rajouter une serie deja presente dans une liste ne leve pas **ni ne la
  --      remonte** : `added_at` doit rester celui du premier ajout, sans quoi le second
  --      clic reordonnerait la liste sous les yeux de son auteur.
  begin
    insert into public.lists (user_id, slug, title) values (a, tag, 'Liste du scenario');
    insert into public.list_items (user_id, slug, subject) values (a, tag, tag || '_s');
    perform pg_sleep(0.01);
    insert into public.list_items (user_id, slug, subject)
    values (a, tag, tag || '_s') on conflict do nothing;

    select case when count(*) = 1 and max(added_at) = min(added_at) then 'intacte'
                else count(*)::text || ' lignes' end
      into obtenu
      from public.list_items where user_id = a and slug = tag;
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := 'intacte';
  rapport := rapport || format(E'  %s  %s. rajouter une serie deja listee ne la remonte pas (007)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 49 — 🔴 **La reserve de manches, et pourquoi elle merite un scenario.**
  --
  -- La purge nocturne est programmee (scenario 28) ; la **construction** ne l'est pas — elle
  -- ne peut pas l'etre, elle interroge TMDB depuis un poste (`npm run db:round`). Le jour ou
  -- la reserve s'epuise, `quiz_serve` ne rend rien et l'ecran affiche « Rien a afficher pour
  -- aujourd'hui » : mot pour mot ce qu'il afficherait un jour normal sans classement.
  --
  -- **Le jeu s'arreterait donc sans que rien ne le dise.** C'est le motif que ce depot a
  -- deja paye trois fois, et le seul endroit ou l'on peut le prendre de vitesse est ici :
  -- une reserve courte doit virer au rouge **avant** de devenir une panne, pas apres.
  --
  -- Mesure du 2026-08-11 : des manches jusqu'au 13, soit trois jours — le jeu mourait le 14.
  -- Le seuil est celui de `build-round.mjs` : une semaine. Rouge = `npm run db:round`.
  perform set_config('role', 'postgres', true);
  select count(distinct on_day)::text into obtenu
    from public.quiz_questions
   where on_day >= current_date;
  perform set_config('role', 'authenticated', true);
  n := n + 1; attendu := '7';
  rapport := rapport || format(E'  %s  %s. il reste une semaine de manches d avance (013)  [attendu >=%s, obtenu %s]\n',
                               case when obtenu::int >= attendu::int then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu::int < attendu::int then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- 018 — le fait voyage avec le titre de sa serie
  -- ---------------------------------------------------------------------------
  --
  -- 🔴 Sans ces colonnes, le fil affichait « @test wrote about tmdb:94997 » : le lecteur ne
  -- resolvait le titre que depuis SON journal, donc jamais pour une decouverte. Le bloc des
  -- faits, lui, ne nommait pas la serie du tout.
  --
  -- ⚠️ **Ce que ces trois scenarios protegent avant tout, c'est la publication elle-meme.**
  -- Le client emet desormais `title` et `poster_path` a chaque envoi. Si la colonne manque —
  -- 018 non applique — PostgREST rend 400 et **plus rien ne se publie**, ni les coeurs ni
  -- les series terminees. Le correctif casserait alors ce qu'il vient reparer, et
  -- `publish` rend `response.ok` : personne ne le saurait.

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 50 — La forme exacte que le client emet.
  begin
    insert into public.activity (user_id, kind, subject, season, stars, happened_on,
                                 title, poster_path)
    values (a, 'finished', tag || '_t', null, null, current_date, 'Breaking Bad', '/abc.jpg')
    on conflict (user_id, kind, subject, season, happened_on) do update
      set title = excluded.title, poster_path = excluded.poster_path;
    obtenu := 'ok';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := 'ok';
  rapport := rapport || format(E'  %s  %s. un fait s ecrit avec son titre et son affiche (018)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 51 — La borne de longueur mord. Sans elle, `activity` accepte un « titre » de dix
  --      megaoctets : ce sont les premieres colonnes de texte libre de cette table.
  begin
    insert into public.activity (user_id, kind, subject, happened_on, title)
    values (a, 'finished', tag || '_t2', current_date, repeat('x', 201));
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. un titre de plus de 200 caracteres est refuse (018)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 52 — ⚠️ Le seul des trois qui soit une question de securite. Le rendu concatene ce
  --      chemin derriere `https://image.tmdb.org/t/p/<taille>` **sans le reverifier** : une
  --      URL absolue acceptee ici ferait pointer une image du fil vers un domaine tiers,
  --      c'est-a-dire un pisteur pose par n'importe quel compte dans le fil des autres.
  begin
    insert into public.activity (user_id, kind, subject, happened_on, poster_path)
    values (a, 'finished', tag || '_t3', current_date, 'https://pisteur.example/x.jpg');
    obtenu := 'acceptee';
  exception when others then
    obtenu := 'refusee';
  end;
  n := n + 1; attendu := 'refusee';
  rapport := rapport || format(E'  %s  %s. une URL absolue en affiche est refusee (018)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- 020 — une liste sait nommer ce qu'elle contient
  -- ---------------------------------------------------------------------------
  --
  -- 🔴 Meme defaut que 018, sur la table d'a cote et **un cran plus cher** : une carte de
  -- liste resolvait ses vignettes depuis le journal du lecteur, donc affichait « Tracked
  -- series » pour toute serie qu'il ne suit pas — c'est-a-dire pour toute liste qu'il
  -- decouvre, sur la page faite pour decouvrir des listes.
  --
  -- ⚠️ **Ce que ces trois scenarios protegent d'abord, c'est le rangement lui-meme.**
  -- `addToList` emet desormais `title` et `poster_path` a chaque appel. Si les colonnes
  -- manquent — 020 non applique — PostgREST rend 400 et **plus aucune serie ne se range**,
  -- pendant que `#write` rend `false` sans que rien ne l'affiche. Le correctif casserait
  -- exactement ce qu'il repare, et c'est la troisieme fois que ce depot rencontre cette
  -- forme (lot 10.0, 017, la carte des abandons).

  -- 53 — La forme exacte que le client emet, `ignore-duplicates` compris.
  --
  -- ⚠️ Le slug prend un TIRET et pas un souligne. `007` borne `lists.slug` a
  -- `^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$` ; `tag || '_l20'` violait ce check, et les trois
  -- scenarios de 020 mesuraient donc cette faute-la et non 020. Voir la note des 54/55.
  begin
    insert into public.lists (user_id, slug, title) values (a, tag || '-l20', 'Liste 020');
    insert into public.list_items (user_id, slug, subject, title, poster_path)
    values (a, tag || '-l20', tag || '_s20', 'Breaking Bad', '/abc.jpg')
    on conflict do nothing;
    obtenu := 'ok';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := 'ok';
  rapport := rapport || format(E'  %s  %s. une serie se range avec son titre et son affiche (020)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 54 — La borne de longueur mord, comme en 018 : premieres colonnes de texte libre de
  --      cette table.
  --
  -- ⚠️ **Ces deux-la attendent `23514`, pas « refusee ».** Un scenario qui range TOUTE
  -- exception sous « refusee » est vert quand la colonne n'existe pas (42703), quand la
  -- table n'existe pas (42P01), ou quand un insert d'amont a echoue pour une raison sans
  -- rapport — c'est exactement ce qui est arrive ici : le slug etait invalide, `lists`
  -- refusait, et ces deux bornes de 020 n'avaient JAMAIS ete exercees tout en etant vertes.
  -- Nommer le sqlstate attendu rend ce faux vert impossible.
  begin
    insert into public.list_items (user_id, slug, subject, title)
    values (a, tag || '-l20', tag || '_s21', repeat('x', 201));
    obtenu := 'acceptee';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '23514';
  rapport := rapport || format(E'  %s  %s. un titre de liste de plus de 200 caracteres est refuse (020)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 55 — ⚠️ Le seul des trois qui soit une question de securite, et il porte plus loin
  --      qu'en 018 : une liste est **publique** des que son auteur l'est, donc une URL
  --      absolue acceptee ici poserait un pisteur sur `/listes` — la page de decouverte,
  --      vue par des gens qui ne suivent meme pas son auteur.
  begin
    insert into public.list_items (user_id, slug, subject, poster_path)
    values (a, tag || '-l20', tag || '_s22', 'https://pisteur.example/x.jpg');
    obtenu := 'acceptee';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '23514';
  rapport := rapport || format(E'  %s  %s. une URL absolue en affiche de liste est refusee (020)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- 021 — les quatre epinglees arrivent sur le profil
  -- ---------------------------------------------------------------------------
  --
  -- 🔴 « Pin to profile » epinglait dans le journal, donc dans le navigateur : `<Favorites />`
  -- n'etait monte que sur `/moi`, et personne d'autre ne voyait jamais les quatre series.
  --
  -- ⚠️ **Le scenario 57 est le seul qui compte vraiment.** `publishFavorites` reecrit un
  -- ETAT : il envoie les quatre lignes en `merge-duplicates` sur `(user_id, ordinal)`, donc
  -- il emprunte le chemin `UPDATE` des la deuxieme publication. Une table sans politique
  -- `UPDATE` y rend **42501 en silence** — c'est exactement ce qui a coute quatre ecritures
  -- sur cinq le 2026-08-11, et la carte des abandons pendant onze lots. La politique existe
  -- en 021 ; ce scenario est ce qui prouve qu'elle est la bonne.

  -- 56 — La forme exacte que le client emet la premiere fois.
  begin
    insert into public.profile_favorites (user_id, ordinal, subject, title, poster_path)
    values (a, 1, 'tmdb:1396', 'Breaking Bad', '/abc.jpg'),
           (a, 2, 'tmdb:1399', 'Game of Thrones', null)
    on conflict (user_id, ordinal) do update
      set subject = excluded.subject, title = excluded.title, poster_path = excluded.poster_path;
    obtenu := 'ok';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := 'ok';
  rapport := rapport || format(E'  %s  %s. quatre epinglees s ecrivent avec leur instantane (021)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 57 — 🔴 Reordonner : le meme rang, une autre serie. C'est le chemin `UPDATE`.
  begin
    insert into public.profile_favorites (user_id, ordinal, subject, title)
    values (a, 1, 'tmdb:94997', 'House of the Dragon')
    on conflict (user_id, ordinal) do update
      set subject = excluded.subject, title = excluded.title;

    select subject into obtenu from public.profile_favorites where user_id = a and ordinal = 1;
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := 'tmdb:94997';
  rapport := rapport || format(E'  %s  %s. reordonner ses epinglees passe par UPDATE, et est permis (021)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 58 — ⚠️ La securite, comme en 018 et 020 : un profil public est lu par n'importe qui,
  --      donc une URL absolue acceptee ici poserait un pisteur sur une page publique.
  begin
    insert into public.profile_favorites (user_id, ordinal, subject, poster_path)
    values (a, 3, 'tmdb:1400', 'https://pisteur.example/x.jpg');
    obtenu := 'acceptee';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '23514';
  rapport := rapport || format(E'  %s  %s. une URL absolue en affiche epinglee est refusee (021)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 59 — Et la cinquieme n'existe pas : la borne est dans la cle, pas dans un client.
  --      Meme raison qu'en 54/55 de nommer le sqlstate : tant que 021 n'est pas applique,
  --      la table est absente (42P01) et « refusee » aurait rendu ce scenario vert.
  begin
    insert into public.profile_favorites (user_id, ordinal, subject)
    values (a, 5, 'tmdb:1401');
    obtenu := 'acceptee';
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '23514';
  rapport := rapport || format(E'  %s  %s. une cinquieme epinglee est refusee par la base (021)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- ---------------------------------------------------------------------------
  -- 022 — les coeurs d'un lot de critiques qui melange les series
  -- ---------------------------------------------------------------------------
  --
  -- 🔴 `likeReview` et le tri « les plus aimees » existaient depuis `015` et n'etaient
  -- montes qu'a UN endroit : la fiche serie. On lisait quelqu'un sur son profil ou sur la
  -- vitrine de l'accueil sans pouvoir le lui dire. Le blocage n'etait pas dans le rendu :
  -- `review_like_counts` prend **un** sujet, parce qu'elle a ete ecrite pour une page ou
  -- toutes les critiques portent deja sur la meme serie.

  -- 63 — La forme exacte que le client emet : un appel, deux series.
  begin
    perform set_config('role', 'postgres', true);
    insert into public.reviews (user_id, subject, target, body, through_season, lang)
    values (b, tag || '_r22a', 'series', 'Texte du scenario.', 0, 'fr'),
           (b, tag || '_r22b', 'series', 'Texte du scenario.', 0, 'fr');
    perform set_config('role', 'authenticated', true);

    insert into public.review_likes (liker_id, author_id, subject, target)
    values (a, b, tag || '_r22a', 'series'),
           (a, b, tag || '_r22b', 'series');

    select count(*)::text into obtenu
      from public.review_like_counts_across(array[tag || '_r22a', tag || '_r22b']);
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '2';
  rapport := rapport || format(E'  %s  %s. un seul appel rend les coeurs de deux series (022)  [attendu %s, obtenu %s]\n',
                               case when obtenu = attendu then 'OK   ' else 'ECHEC' end, n, attendu, obtenu);
  if obtenu <> attendu then echecs := echecs + 1; end if;

  -- 64 — 🔴 **Le scenario qui compte.** Le chiffre doit etre le MEME pour tout le monde, et
  --      c'est exactement ce que `security definer` achete — c'est aussi ce qui distingue
  --      ce compteur de celui que 10.2 avait refuse, qui comptait des lignes rendues par
  --      RLS et variait donc d'un lecteur a l'autre.
  --
  --      `c1` n'a pas de profil, donc `can_see(c1)` est faux et `review_likes_select` cache
  --      son coeur a A. La table en rend 1, la fonction en compte 2. Si un jour quelqu'un
  --      « simplifie » la fonction en retirant `security definer`, les deux chiffres se
  --      rejoindront et ce scenario tombera.
  --
  --      ⚠️ Il resseme sa critique et son propre coeur au lieu de reprendre ceux du 63, et
  --      ce n'est pas de la redondance : un bloc `begin … exception` est une
  --      sous-transaction, donc **tout ce que le 63 a ecrit disparait des qu'il echoue**.
  --      Sans cette graine, ce scenario rendrait 23503 — une violation de cle etrangere —
  --      la ou la vraie nouvelle est « 022 n'est pas applique ». Un scenario qui accuse le
  --      mauvais coupable coute une heure a chaque fois qu'on le lit.
  begin
    perform set_config('role', 'postgres', true);
    insert into public.reviews (user_id, subject, target, body, through_season, lang)
    values (b, tag || '_r22a', 'series', 'Texte du scenario.', 0, 'fr')
    on conflict do nothing;
    insert into public.review_likes (liker_id, author_id, subject, target)
    values (a, b, tag || '_r22a', 'series') on conflict do nothing;
    insert into public.review_likes (liker_id, author_id, subject, target)
    values (c1, b, tag || '_r22a', 'series') on conflict do nothing;
    perform set_config('role', 'authenticated', true);

    select (select count(*) from public.review_likes where subject = tag || '_r22a')::text
           || '/' ||
           (select likes from public.review_like_counts_across(array[tag || '_r22a']))::text
      into obtenu;
  exception when others then
    obtenu := sqlstate;
  end;
  n := n + 1; attendu := '1/2';
  rapport := rapport || format(E'  %s  %s. le compte ignore la visibilite, la table non (022)  [attendu %s, obtenu %s]\n',
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

-- =============================================================================
-- 017_activity_saison.sql — la saison entre dans l'identite d'un fait
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le defaut, mesure le 2026-08-11 contre la vraie base
--
-- `003_social.sql:253` identifie un fait par `(user_id, kind, subject, happened_on)`. La
-- saison n'y est pas. Or noter la saison 1 et la saison 2 de la meme serie le meme soir
-- produit **deux `rated_season` sur la meme cle** — et c'est le geste le plus banal du
-- produit : on enchaine deux saisons, on note les deux.
--
-- `publish` envoie tout d'un bloc, avec `Prefer: resolution=merge-duplicates`, c'est-a-dire
-- `ON CONFLICT … DO UPDATE`. Postgres refuse de toucher deux fois la meme ligne dans une
-- seule commande :
--
--   [21000] ON CONFLICT DO UPDATE command cannot affect row a second time
--
-- Ce n'est pas la ligne fautive qui est rejetee, c'est **l'envoi entier**. Un compte dont le
-- journal contient une seule collision ne publie donc **plus jamais rien** — ni ses coeurs,
-- ni ses series terminees, ni ses autres notes.
--
-- ⚠️ **Et les deux seuls comptes de la base sont dans ce cas.** Mesure le 2026-08-11 :
-- `tmdb:94997` pour l'un, `tmdb:94605` pour l'autre, deux saisons notees le 2026-08-10. La
-- table `activity` etait a **0 ligne** — et le correctif de `PublishActivity` (2026-08-10),
-- qui reparait le fait que la publication ne partait que depuis `/amis`, n'y aurait rien
-- change : il aurait fait partir un envoi qui echoue.
--
-- 🔴 **Huitieme « une fonctionnalite ecrite n'est pas une fonctionnalite qui marche »** — et
-- le meme motif que 10.0, un cran plus loin. 10.0 avait prouve que la **lecture** du fil
-- repondait 400 ; personne n'a mesure l'**ecriture**. Trois silences se sont additionnes,
-- comme la-bas : `publish` rend `response.ok`, donc un 400 devient `false` ; `false`
-- n'affiche rien ; et un fil vide ressemble a un fil dont personne n'a rien fait.
--
-- ## Pourquoi une contrainte UNIQUE et non une cle primaire
--
-- `season` est **nul** pour `finished`, `liked`, `started` et `wanted` — ces faits-la n'ont
-- pas de saison, et leur en inventer une (`0`, `-1`) ferait entrer une valeur sentinelle
-- dans le client, qui lit `season` pour l'afficher. Or une cle primaire interdit le nul.
--
-- `unique nulls not distinct` (Postgres 15+, la base est en 17) dit exactement ce qui est
-- vrai : deux faits sans saison **sur la meme serie le meme jour sont le meme fait**, et
-- deux notes de saisons differentes sont deux faits. Verifie sur la vraie table, DDL
-- comprise, dans une transaction annulee :
--
--   deux saisons, meme jour  → ACCEPTE, 2 lignes   (aujourd'hui : REFUSE [21000])
--   le meme envoi, rejoue    → 2 lignes            (merge-duplicates tient)
--
-- ## ⚠️ Le pendant client est obligatoire, il n'est pas cosmetique
--
-- Cette contrainte deplace la collision, elle ne la supprime pas : deux `finished` de la
-- meme serie le meme jour — deux `completions`, un re-visionnage — retombent sur la meme
-- ligne et rendraient le meme 21000. `projectActivity` dedoublonne donc sur **cette cle**
-- avant l'envoi, et c'est la que ca doit vivre : la projection rend l'ensemble des faits
-- publiables, pas une liste ou le meme fait figure deux fois.
--
-- Et `publish` doit nommer la cible : PostgREST deduit `ON CONFLICT` de la cle **primaire**
-- quand on ne lui dit rien. On la lui dit, par `on_conflict=`.

-- -----------------------------------------------------------------------------
-- La cle
-- -----------------------------------------------------------------------------

alter table public.activity drop constraint if exists activity_pkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activity'::regclass
       and conname = 'activity_fait'
  ) then
    alter table public.activity
      add constraint activity_fait unique nulls not distinct
      (user_id, kind, subject, season, happened_on);
  end if;
end $$;

comment on constraint activity_fait on public.activity is
  'L''identite d''un fait : qui, quoi, sur quelle serie, quelle saison, quel jour. '
  'La saison en fait partie — sans elle, deux saisons notees le meme jour se percutent '
  'et l''envoi entier echoue en 21000.';

-- ⚠️ `activity_recent` (user_id, happened_on desc) reste : la contrainte ci-dessus ne
-- l'indexe pas dans cet ordre, et c'est lui qui sert la lecture du fil.

-- -----------------------------------------------------------------------------
-- 🔴 Le second defaut, trouve en corrigeant le premier
-- -----------------------------------------------------------------------------
--
-- `merge-duplicates` **est** un `ON CONFLICT DO UPDATE`. Le chemin `UPDATE` exige une
-- politique `UPDATE` — et `activity` n'en a jamais eu : `003_social.sql` en declare trois,
-- `select`, `insert`, `delete`. Mesure du 2026-08-11, transaction annulee :
--
--   1er envoi = OK      (aucun conflit, chemin INSERT pur)
--   2e  envoi = 42501   (conflit, chemin UPDATE, refuse par RLS)
--
-- ⚠️ **C'est pire que le premier defaut, et il l'aurait cache.** `PublishActivity` republie
-- toute la projection a chaque montage — la garde `lastSent` est une reference neuve a
-- chaque page. Le premier envoi de la vie d'un compte serait donc passe, et **tous les
-- suivants auraient echoue** : le fil se figeait sur le premier chargement, et aucun fait
-- nouveau n'arrivait plus jamais, puisqu'il voyage dans le meme lot que les anciens.
--
-- Un observateur aurait vu un fil qui marche, puis qui ne bouge plus. Aucune erreur nulle
-- part : `publish` rend `response.ok`.
--
-- Les bornes de date sont reprises telles quelles : sans `with check`, un `UPDATE` deplacerait
-- un fait vers le futur, ce que l'`INSERT` interdit — la meme serrure des deux cotes.

drop policy if exists activity_update_own on public.activity;
create policy activity_update_own on public.activity
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and happened_on <= current_date
    and happened_on > current_date - 90
  );

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint where conrelid = 'public.activity'::regclass;
--
--   Attendu : `activity_fait UNIQUE NULLS NOT DISTINCT (user_id, kind, subject, season,
--   happened_on)`, et **aucune** contrainte de type `p`. Une cle primaire encore presente
--   signifie que ce fichier n'a pas ete applique — et que personne ne publie.
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'activity';
--
--   Attendu : **quatre** politiques, dont `activity_update_own`. Trois signifie que le
--   premier envoi d'un compte passera et qu'aucun autre ne passera jamais.
-- =============================================================================

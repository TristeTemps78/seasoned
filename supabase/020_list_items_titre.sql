-- =============================================================================
-- 020_list_items_titre.sql — une liste sait nommer ce qu'elle contient
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le defaut, vu au navigateur le 2026-08-16
--
-- `018` a donne un titre et une affiche a `activity` et a `reviews`. Il a oublie
-- `list_items` — et c'est la table ou l'oubli coute le plus cher.
--
-- Une carte de liste resolvait ses vignettes depuis le journal **du lecteur**
-- (`journal.entries[subject]?.snapshot`), avec `library.card.tracked` en repli. Le lecteur
-- voyait donc « Tracked series » et un monogramme pour toute serie qu'il ne suit pas —
-- c'est-a-dire presque toujours, **puisqu'une liste qu'on decouvre est faite de ce qu'on ne
-- connait pas**. Sur `/listes`, la surface dont la decouverte est la seule raison d'etre,
-- une liste de quelqu'un d'autre s'affichait comme quatre fois le meme mot.
--
-- C'est le meme defaut que `018`, dans la meme forme, sur la table d'a cote : le lecteur
-- servait de dictionnaire a des cles qu'il n'a jamais rencontrees. Deuxieme fois. Ce qui
-- se generalise : **une cle qui voyage sans son instantane n'est lisible que par celui qui
-- l'a deja vue**, et aucune surface de decouverte n'a cette propriete.
--
-- ## Pourquoi ce n'est toujours pas une fuite
--
-- Le raisonnement de `018` vaut mot pour mot : le titre et le chemin d'affiche sont des
-- donnees **publiques du catalogue**, derivables de `subject` par un appel TMDB anonyme.
-- Les stocker ici ne rend lisible rien qui ne le fut deja — la politique `list_items_select`
-- continue de decider **qui voit la ligne**, et elle ne bouge pas ici.
--
-- Ce sont des **instantanes** : le titre tel que la personne l'avait sous les yeux en
-- rangeant la serie. Une serie renommee chez TMDB ne reecrit pas les listes du passe.
--
-- ## ⚠️ Nullables, et ils le resteront — avec une consequence propre a cette table
--
-- Les elements ranges avant aujourd'hui n'en ont pas, et `addToList` ecrit en
-- `resolution=ignore-duplicates` (voir `IDEMPOTENCE` dans `src/social/client.ts`) : refaire
-- le geste sur une serie deja rangee **ne met rien a jour**, donc ne rattrape pas un
-- instantane manquant. C'est voulu — la cle *est* le fait entier, et `merge-duplicates`
-- exigerait ici une politique `UPDATE` que cette table n'a pas a avoir, en plus de remonter
-- la ligne en reecrivant `added_at` alors qu'une liste se lit dans l'ordre d'ajout.
--
-- L'affichage retombe donc sur l'ancien chemin — le journal du lecteur, puis la cle — et il
-- doit continuer de le savoir faire. Le vieux fond de listes se nommera au fil des ajouts,
-- pas d'un coup.

-- -----------------------------------------------------------------------------
-- Les colonnes
-- -----------------------------------------------------------------------------

alter table public.list_items add column if not exists title text;
alter table public.list_items add column if not exists poster_path text;

-- -----------------------------------------------------------------------------
-- Les bornes — memes valeurs et meme raison qu'en `018`
-- -----------------------------------------------------------------------------
--
-- ⚠️ Ce ne sont pas des precautions decoratives : ces deux colonnes sont les premieres de
-- `list_items` a porter du texte libre venu du client. Sans borne, la table accepte un
-- « titre » de dix megaoctets, ou un chemin d'affiche qui n'en est pas un.
--
-- La contrainte de forme refuse une URL absolue, donc elle empeche que cette colonne
-- devienne un vecteur pour faire pointer la vignette d'une liste vers un domaine tiers.
-- ⚠️ Le rendu la concatene derriere `https://image.tmdb.org/t/p/<taille>` sans la
-- reverifier — c'est ici, et seulement ici, que la garantie existe.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.list_items'::regclass and conname = 'list_items_titre_borne'
  ) then
    alter table public.list_items
      add constraint list_items_titre_borne
      check (title is null or char_length(title) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.list_items'::regclass and conname = 'list_items_affiche_forme'
  ) then
    alter table public.list_items
      add constraint list_items_affiche_forme
      check (poster_path is null or poster_path ~ '^/[A-Za-z0-9._-]{1,60}$');
  end if;
end $$;

comment on column public.list_items.title is
  'Instantane du titre au moment ou la serie a ete rangee. Donnee publique du catalogue, '
  'derivable de `subject` par un appel TMDB anonyme — elle n''ouvre aucune lecture nouvelle. '
  'Nullable : les elements ranges avant le 2026-08-16 n''en ont pas, et `ignore-duplicates` '
  'ne les rattrapera pas.';

comment on column public.list_items.poster_path is
  'Chemin d''affiche TMDB (`/xxxxx.jpg`), jamais une URL absolue — voir la contrainte '
  '`list_items_affiche_forme`, seule garantie avant concatenation cote client.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'list_items'
--      and column_name in ('title','poster_path');
--
--   Attendu : **deux** lignes. Moins signifie que ce fichier n'a pas ete applique, et que
--   les listes continuent de s'annoncer « Tracked series » a qui ne suit pas leurs series.
--
--   select conname from pg_constraint
--    where conname in ('list_items_titre_borne','list_items_affiche_forme');
--
--   Attendu : deux.
-- =============================================================================

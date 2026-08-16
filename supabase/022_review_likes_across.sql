-- =============================================================================
-- 022_review_likes_across.sql — les coeurs d'un lot de critiques qui melange les series
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Ce qui manquait, et pourquoi ca bloquait une fonctionnalite entiere
--
-- `likeReview` et le tri « les plus aimees » existent depuis `015`, et ils ne vivent qu'a
-- UN endroit du depot : la fiche serie. Ni le profil public, ni la vitrine de l'accueil ne
-- portent le coeur — donc **on ne peut pas aimer une critique la ou on la decouvre**, ce qui
-- est precisement l'endroit ou l'on decide de lire quelqu'un.
--
-- Le blocage n'etait pas dans le rendu : c'etait cette fonction. `review_like_counts` prend
-- **un** sujet, parce qu'elle a ete ecrite pour une fiche, ou toutes les critiques portent
-- deja sur la meme serie. Un profil et une vitrine melangent les oeuvres.
--
-- ## ⚠️ Pourquoi pas une boucle cote client
--
-- C'etait la reponse facile, et `015` l'interdit noir sur blanc dans sa propre
-- documentation : *« un lot et non une critique : une fiche serie en affiche dix, et dix
-- appels seraient dix fois le cout — precisement ce que ce produit refuse partout »*. Un
-- profil charge jusqu'a 30 critiques ; une boucle y ferait jusqu'a 30 allers-retours pour un
-- chiffre. La regle vaut aussi quand c'est la dimension d'a cote qui change.
--
-- ## ⚠️ L'ancienne fonction reste, et ce n'est pas de la dette
--
-- `review_like_counts(text)` continue de servir la fiche serie, telle quelle. La remplacer
-- par la version tableau ferait dependre les coeurs de la fiche — qui marchent aujourd'hui,
-- en production — de l'application de CE fichier. C'est la forme exacte qui a coute le lot
-- 10.0, `017`, la carte des abandons et `020` : un client qui emet ce que la base n'a pas
-- encore. Ici la degradation est douce et bornee — sans `022`, `#rpc` rend `[]`, les coeurs
-- des nouvelles surfaces affichent zero et restent cliquables, et la fiche ne bouge pas.
--
-- ## La borne, et pourquoi elle est dans le SQL
--
-- Le client n'envoie jamais plus de 30 sujets (`reviewsBy` et `feedReviews` sont bornees a
-- 30). La tranche `[1:60]` ci-dessous ne protege donc pas contre le client : elle protege
-- contre un appel fabrique a la main a la cle publique, qui passerait dix mille sujets a une
-- fonction `security definer`. Une borne posee dans l'appelant n'est pas une borne.
-- =============================================================================

/**
 * Le nombre de coeurs de chaque critique d'un LOT de series, stable pour tout le monde.
 *
 * Meme mesure et meme garantie que {@link review_like_counts} : `security definer`
 * uniquement pour compter, aucune identite ne sort d'ici — `liker_id` n'est pas projete, et
 * lire les noms passe par la table, donc par RLS. Un agregat n'est pas un annuaire.
 *
 * ⚠️ `subject` est projete EN PLUS, et c'est la seule difference de forme : sur une fiche on
 * sait de quelle serie on parle, sur un profil non. Sans lui, deux critiques de deux series
 * differentes par le meme auteur sur la meme cible seraient indistinguables.
 */
create or replace function public.review_like_counts_across(for_subjects text[])
returns table (subject text, author_id uuid, target text, likes integer, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.subject,
    l.author_id,
    l.target,
    count(*)::integer,
    bool_or(l.liker_id = auth.uid())
  from public.review_likes l
  where l.subject = any(for_subjects[1:60])
  group by l.subject, l.author_id, l.target;
$$;

comment on function public.review_like_counts_across(text[]) is
  'Combien de coeurs par critique, pour un lot de series. Borne a 60 sujets. '
  'Stable pour tous — voir 022_review_likes_across.sql.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select proname from pg_proc where proname = 'review_like_counts_across';
--
--   Attendu : une ligne. Zero signifie que ce fichier n'a pas ete applique, et que le
--   coeur du profil et de la vitrine affiche zero pour tout le monde — sans rien casser,
--   mais sans rien montrer non plus.
-- =============================================================================

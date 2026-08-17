-- =============================================================================
-- 027_counts.sql — compter sans que le chiffre depende de qui regarde
-- =============================================================================
--
-- Applique par `npm run db:push`. Idempotent : rejouable sans dommage.
--
-- ## 🔴 Le piege que ce fichier existe pour eviter, et il a deja ete refuse une fois
--
-- Le reflexe pour « combien de gens ont aime cette serie » est `select count(*)`. Sous RLS,
-- il rend un chiffre **differemment faux pour chaque lecteur** : toutes les tables sociales
-- portent `can_see(user_id)`, donc la base ne compte que ce que *ce* lecteur a le droit de
-- voir. Deux personnes lisant la meme fiche verraient deux chiffres, et aucun des deux ne
-- serait « le » nombre. Le lot 10.2 a refuse le compteur pour cette raison exacte, a raison.
--
-- La sortie a deja servi trois fois — `stop_map`, `review_like_counts`,
-- `review_like_counts_across` : une fonction `security definer` qui ne rend **que des
-- agregats**. Aucune identite n'en sort ; un agregat n'est pas un annuaire.
--
-- ## ⚠️ `security definer` voit TOUT, donc il faut dire ce qu'on accepte de compter
--
-- C'est le danger de la forme : la fonction contourne RLS, donc elle compterait aussi ce
-- que des profils `private` ont publie — c'est-a-dire des gestes que leur auteur a
-- explicitement soustraits aux inconnus. Un chiffre agrege ne nomme personne, mais sur une
-- base a deux comptes il *designe* : « 1 personne l'a aimee » plus un fil ou un seul nom
-- apparait, et l'anonymat n'existe plus. C'est le raisonnement qui a donne son plancher a
-- `stop_map()` (cinq contributeurs).
--
-- {@link subject_counts} ne compte donc que les profils **`public`** : exactement ce qu'un
-- inconnu pourrait deja denombrer en ouvrant les profils un par un. Le chiffre est stable
-- pour tout le monde ET ne revele rien de neuf — les deux proprietes qu'on veut, sans
-- plancher arbitraire. Il **sous-compte** volontairement, et le produit doit le dire dans
-- ses mots : « au moins N », jamais « N personnes ».
--
-- {@link follow_counts} est l'autre cas et se traite autrement : le nombre porte sur **une**
-- personne, donc la question n'est pas « qui compte-t-on » mais « a-t-on le droit de
-- regarder ce profil ». La garde est `can_see`, et sans elle le compteur deviendrait
-- l'oracle que `/u/<nom>` refuse d'etre pour les noms — un profil ferme dirait « 3 abonnes »
-- au lieu de rester introuvable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- F1 — les compteurs sociaux sous une affiche
-- -----------------------------------------------------------------------------
--
-- ⚠️ Un LOT de series et non une, comme `review_like_counts_across` : une page de
-- catalogue en affiche vingt, et vingt appels seraient vingt fois le cout que ce produit
-- refuse partout. Borne a 60 sujets, comme `022`.
--
-- ⚠️ Trois comptes de **personnes**, jamais de lignes. `activity` porte une ligne par
-- saison notee : compter les lignes ferait dire « 12 » a une serie que trois personnes
-- suivent. `distinct` est ici la difference entre un compteur social et un compteur de
-- trafic.
--
-- ⚠️ `left join lateral` plutot que trois requetes : la liste des sujets demandes est rendue
-- entiere, **y compris les series que personne n'a touchees**. Une serie absente de la
-- reponse obligerait le client a distinguer « zero » de « pas lu », ce qui est exactement le
-- defaut 10.0 sous une autre forme.
create or replace function public.subject_counts(for_subjects text[])
returns table (subject text, watched integer, loved integer, listed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.subject,
    coalesce(a.watched, 0)::integer,
    coalesce(a.loved, 0)::integer,
    coalesce(l.listed, 0)::integer
  from unnest(for_subjects[1:60]) as s(subject)
  left join lateral (
    select
      count(distinct act.user_id) filter (
        where act.kind in ('finished', 'started', 'rated_season')
      ) as watched,
      count(distinct act.user_id) filter (where act.kind = 'liked') as loved
    from public.activity act
    join public.profiles p on p.user_id = act.user_id and p.visibility = 'public'
    where act.subject = s.subject
  ) a on true
  left join lateral (
    select count(*) as listed
    from public.list_items li
    join public.profiles p on p.user_id = li.user_id and p.visibility = 'public'
    where li.subject = s.subject
  ) l on true;
$$;

comment on function public.subject_counts(text[]) is
  'Combien de gens ont vu, aime, range une serie — parmi les profils publics UNIQUEMENT. '
  'Stable pour tout le monde, et sous-compte volontairement : voir 027_counts.sql.';

-- -----------------------------------------------------------------------------
-- F2 — abonnes et abonnements, en nombre
-- -----------------------------------------------------------------------------
--
-- ⚠️ La garde `can_see` est **dans** la fonction et non chez l'appelant : une regle de
-- visibilite ecrite dans un client est une regle qui se perime le jour ou un second client
-- l'oublie. C'est la meme raison qui a fait descendre `can_see` en fonction des `003`.
--
-- ⚠️ On compte **toutes** les lignes de `follows`, pas seulement celles des profils
-- publics — contrairement a `subject_counts` juste au-dessus, et la difference se defend :
-- « 12 abonnes » ne dit rien de qui ils sont, alors que « 1 personne a aime cette serie »
-- se recoupe avec un fil ou un seul nom apparait. Le nombre d'abonnes est d'ailleurs le
-- seul chiffre que la personne concernee peut deja obtenir elle-meme, par `followers()`.
create or replace function public.follow_counts(for_user uuid)
returns table (followers integer, following integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.follows f where f.followee_id = for_user)::integer,
    (select count(*) from public.follows f where f.follower_id = for_user)::integer
  where public.can_see(for_user);
$$;

comment on function public.follow_counts(uuid) is
  'Abonnes et abonnements d un profil, en nombre. Rend ZERO ligne si le lecteur n a pas le '
  'droit de voir ce profil — sinon le compteur serait un oracle. Voir 027_counts.sql.';

-- =============================================================================
-- Verification
-- =============================================================================
--
--   select * from public.subject_counts(array['tmdb:1396']);
--   select * from public.follow_counts('00000000-0000-0000-0000-000000000000');
--
--   Attendu : une ligne par sujet demande pour la premiere — meme a zero. Zero ligne pour
--   la seconde sur un identifiant inconnu, ce qui est le meme silence qu'un profil ferme.
-- =============================================================================

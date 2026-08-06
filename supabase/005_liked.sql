-- 005 — le coeur rejoint le fil d'activite.
--
-- `003_social.sql` fige les genres publiables par une contrainte `check`. Elle est la pour
-- une bonne raison — un client ne doit pas pouvoir inventer un genre que personne ne sait
-- afficher — mais elle a le defaut de sa qualite : **elle refuse aussi les genres legitimes
-- tant qu'on ne l'a pas rouverte**. Sans cette migration, poser un coeur echouerait a la
-- publication, silencieusement, du cote du client.
--
-- On REMPLACE la contrainte au lieu d'en ajouter une seconde : deux contraintes sur la meme
-- colonne se cumulent en ET, donc la premiere continuerait de refuser 'liked'.
--
-- ⚠️ Le pendant client est dans `src/social/client.ts` : `feed()` doit **ecarter** un genre
-- qu'il ne connait pas, sinon un ancien onglet qui recoit 'liked' cherche une cle de
-- dictionnaire absente et rend une ligne muette. La base s'ouvre, le client se protege.

alter table public.activity drop constraint if exists activity_kind_check;

alter table public.activity
  add constraint activity_kind_check
  check (kind in ('rated_season', 'finished', 'started', 'wanted', 'liked'));

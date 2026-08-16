import { expect, it } from 'vitest';
import { codeOf, filesUnder, pathOf } from './sources';

/**
 * Aucune cle de journal ne s'affiche a un humain.
 *
 * ## 🔴 Le defaut, constate en production et connecte
 *
 * Le 2026-08-16, en tete du fil de `/amis`, connecte :
 *
 *     TE  @test  wrote about  tmdb:94997
 *
 * Le lien menait bien a `/serie/94997`. Seule l'etiquette etait une cle de base de donnees.
 *
 * ## Pourquoi ca a tenu si longtemps
 *
 * Ce n'etait pas un oubli, c'etait une **decision ecrite**. `FriendsFeed` la portait mot pour
 * mot : *« sans instantane on montre la cle — le lien, lui, marche toujours »*. Elle etait
 * defendable en principe et fausse en pratique, parce qu'elle se declenche dans trois cas
 * cumules et frequents :
 *
 *   1. les critiques et les faits publies **avant le 2026-08-11** n'ont pas d'instantane
 *      (`PublishedReview.title` et `posterPath` datent de `018`) ;
 *   2. le repli sur le journal du **lecteur** ne marche que pour une serie qu'il suit deja —
 *      c'est-a-dire jamais dans le seul cas ou un fil sert a decouvrir ;
 *   3. il n'y avait pas de troisieme repli.
 *
 * `PublicProfile` documente deja le meme accident sur sa propre page (« la page affichait
 * `tmdb:94605` »), corrige une fois, et le dernier maillon etait reste dans quatre composants.
 *
 * ## ⚠️ Ce que cette garde ne prouve pas
 *
 * Elle lit la **source**, pas l'ecran : elle attrape la forme `?? quelquechose.subject`, qui
 * est celle qu'avaient les sept occurrences. Une autre facon d'ecrire le meme repli lui
 * echapperait. C'est la meme limite que `layout-collisions` enonce pour la mise en page — ce
 * qui se lit dans la source est garde ici, le reste se mesure au navigateur.
 */
it('aucun composant ne retombe sur une cle de journal pour nommer une oeuvre', () => {
  // ⚠️ `String.raw` : dans un gabarit ordinaire, `\.` devient un point qui matche tout, et la
  // garde passerait pour verte sur une source fautive. Piege deja rencontre le 2026-08-15 en
  // ecrivant la garde de `.show-header`.
  const REPLI = new RegExp(String.raw`\?\?\s*[A-Za-z_$][\w$]*\.subject\b`);

  const fautes = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .filter((file) => REPLI.test(codeOf(file)))
    .map((file) => pathOf(file));

  expect(
    fautes,
    'un titre absent se dit « une serie » (`feed.someSeries`), jamais « tmdb:94997 »',
  ).toEqual([]);

  // Ancrage : la loi ne vaut que si le remplacant existe vraiment. Sans ca, elle resterait
  // verte le jour ou la cle de dictionnaire disparaitrait — et les quatre composants
  // afficheraient alors une chaine vide, ce qui est pire qu'une cle.
  const porteurs = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .filter((file) => /feed\.someSeries/.test(codeOf(file)))
    .map((file) => pathOf(file));

  expect(porteurs.length, 'plus personne n’emploie le dernier recours').toBeGreaterThanOrEqual(3);
});

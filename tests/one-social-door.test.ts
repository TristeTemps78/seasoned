import { describe, expect, it } from 'vitest';
import { codeOf, filesUnder, pathOf } from './sources';

/**
 * Une seule porte vers le client social — et le jeton n'y est plus une dependance.
 *
 * ## 🔴 Ce que cette garde tient, mesure sur la production le 2026-08-17
 *
 * Chaque effet social dependait d'`accessToken`, qui vaut `undefined` au premier rendu puis
 * recoit la session. **Tout partait donc deux fois, la premiere en visiteur anonyme** :
 * <span>23</span> appels Supabase pour un profil (`profiles` x5, `activity` x5,
 * `favorites` x3, `tags` x3), 16 pour une fiche serie. C'est le cout par visiteur que ce
 * produit refuse depuis le premier jour, et il etait invisible : rien ne casse, tout est
 * simplement demande deux fois.
 *
 * ## ⚠️ Pourquoi une garde, et pas seulement un correctif
 *
 * Le correctif evident etait `if (!ready) return;` dans onze composants — c'est-a-dire une
 * regle que onze appelants doivent se rappeler. Ce depot a paye cette forme **deux fois** :
 * `onFailure` propage jusqu'a `socialFrom` sans un seul abonne, puis `failures.ts` qui a
 * choisi un canal de module *« parce qu'un contexte aurait demande de toucher les douze
 * fichiers »*.
 *
 * `useSocial` supprime le parametre plutot que d'ajouter une garde : il n'y a plus de jeton a
 * mettre dans un tableau de dependances. Cette garde empeche de le remettre — un `socialFrom`
 * appele directement depuis un composant ramenerait le defaut entier, et rien a l'ecran ne le
 * dirait.
 */

/**
 * Les deux seuls fichiers qui ont le droit de nommer `socialFrom` : celui qui la declare, et
 * la porte qui l'appelle.
 */
const LA_PORTE = 'app/social/useSocial.ts';
const LA_FABRIQUE = 'app/social/socialFrom.ts';

/**
 * ⚠️ **Une seconde garde a ete ecrite puis retiree, et il vaut mieux dire laquelle.**
 *
 * Elle interdisait `accessToken` dans tout tableau de dependances — la forme exacte du
 * defaut. Elle accusait `JournalSync`, qui n'a rien : ce composant passe le jeton **en
 * valeur** a `connectJournal`, un autre sous-systeme, et il ne part pas sans lui
 * (`accessToken === undefined` le coupe). Il ne peut donc pas lire en visiteur anonyme.
 *
 * Le depot a deja ecrit la lecon deux fois — *« une garde qui reclame une refonte sans rien
 * corriger est une garde qu'on apprend a ignorer »*, et la premiere version de
 * `layout-collisions` qui accusait sept fichiers sans defaut. Exempter `JournalSync`
 * l'aurait maquillee en regle generale alors qu'elle n'en est pas une. La garde ci-dessous
 * suffit : sans client, un jeton dans une dependance ne peut plus rien declencher.
 */
describe('une seule porte vers le client social', () => {
  it('🔴 aucun composant ne construit son client lui-meme', () => {
    const fautes = filesUnder('app')
      .filter((file) => pathOf(file) !== LA_PORTE && pathOf(file) !== LA_FABRIQUE)
      .filter((file) => /\bsocialFrom\s*\(/.test(codeOf(file)))
      .map((file) => pathOf(file));

    expect(
      fautes,
      'construire un client hors de `useSocial` remet le jeton dans une dependance — voir la mesure en tete de fichier',
    ).toEqual([]);
  });

  it('l’ancrage : la porte, elle, construit bien un client', () => {
    // Sans lui, les deux tests ci-dessus passeraient aussi le jour ou `socialFrom` serait
    // supprimee — ils compareraient deux fois la meme absence.
    const porte = filesUnder('app').find((file) => pathOf(file) === LA_PORTE);
    expect(porte, 'useSocial a disparu').toBeDefined();
    expect(codeOf(porte as string)).toMatch(/socialFrom\s*\(/);
  });
});

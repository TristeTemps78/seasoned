import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Le partage d'une critique en image.
 *
 * ## Ce qui se teste ici, et ce qui ne peut pas l'etre
 *
 * Le rendu d'un `<canvas>` n'existe pas sous jsdom : `getContext('2d')` y rend `null`.
 * Tester « l'image est belle » demanderait un vrai navigateur, et ce depot a deja mesure
 * ce que valent les verifications mal ancrees.
 *
 * Ce qui **peut** etre prouve, et qui porte tout le risque, c'est la regle : le bouton
 * n'existe que sur ses propres critiques. Elle ferme trois pieges d'un coup — texte masque
 * qui redevient lisible, mots d'autrui diffuses hors contexte, image impossible a masquer
 * alors que `/regles` promet le contraire — et elle est **structurelle**, donc lisible
 * dans la source.
 */
describe('on ne partage que sa propre critique', () => {
  const profile = readFileSync('app/components/PublicProfile.tsx', 'utf8');

  it('le bouton est conditionne a `isSelf`', () => {
    // On lit la condition telle qu'elle est ecrite : `{isSelf ? (<ShareReview …`.
    expect(profile).toMatch(/isSelf \?\s*\(\s*<ShareReview/);
  });

  it('et il n existe nulle part ailleurs — pas sur une fiche serie, pas dans le fil', () => {
    for (const path of [
      'app/components/Reviews.tsx',
      'app/components/Friends.tsx',
      'app/components/ReviewBody.tsx',
    ]) {
      expect(readFileSync(path, 'utf8')).not.toContain('ShareReview');
    }
  });

  /**
   * ⚠️ L'image recoit le texte **deja caviarde** (`shown.text` vient de
   * `redactReviewsAcross`), jamais le texte brut. Sur ses propres critiques la question ne
   * se pose pas — on ne se spoile pas soi-meme — mais la source doit rester lisible dans
   * ce sens-la le jour ou quelqu'un deplacera le bouton.
   */
  it('recoit le texte affiche, pas une autre source', () => {
    expect(profile).toMatch(/text=\{shown\.text\}/);
  });
});

/** Le coeur d'une critique — la boucle « quelqu'un t'a lu », fermee. */
describe('le coeur', () => {
  const reviews = readFileSync('app/components/Reviews.tsx', 'utf8');

  it('ne s affiche pas sans compte, ni sur sa propre critique', () => {
    // Un bouton qui ne peut pas marcher ne se degrade pas, il ne s'affiche pas ; et
    // s'aimer soi-meme serait un compteur qu'on s'incremente.
    expect(reviews).toMatch(/account !== undefined && account\.userId !== review\.authorId/);
  });

  it('lit les coeurs en UN appel pour toute la page', () => {
    expect(reviews).toContain('reviewLikes');
    // Un appel par critique serait N fois le cout ; la lecture vit hors de la boucle.
    expect(reviews.split('reviewLikes').length - 1).toBe(1);
  });
});

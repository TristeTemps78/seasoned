import { afterEach, describe, expect, it } from 'vitest';
import { legalIsComplete, looksLikeEmail, publisher } from '@/lib/legal';

/**
 * L'identite de l'editeur, et surtout **l'adresse de signalement**.
 *
 * Un seul defaut garde ici, et il s'est produit en production : une adresse mal saisie
 * etait publiee telle quelle, donc `/regles` annoncait une voie de recours qui ne
 * recevait rien (dette D19).
 */

const CONTACT = 'LEGAL_CONTACT_EMAIL';
const NAME = 'LEGAL_PUBLISHER_NAME';

afterEach(() => {
  delete process.env[CONTACT];
  delete process.env[NAME];
});

describe('l adresse de contact publiee', () => {
  it('🔴 une adresse malformee fait retomber la page sur son avertissement', () => {
    // La valeur **reellement observee** en production le 2026-08-03 : un point-virgule
    // parasite et `.co` au lieu de `.com`. Le module ne faisait qu'un `trim()`, donc la
    // page publiait une adresse morte en ayant l'air complete — pire que l'avertissement
    // qu'elle remplacait, puisqu'elle laissait croire qu'on pouvait signaler.
    process.env[CONTACT] = 'voltface@gmail.co;';
    expect(publisher().email).toBeUndefined();
  });

  it('🔴 et le compte reste ferme tant que l adresse ne tient pas', () => {
    // La consequence qui compte : sans voie de signalement, aucun contenu de tiers ne
    // doit s'ouvrir. Le controle doit donc traverser jusqu'a `legalIsComplete`, sans quoi
    // il ne protege que l'affichage.
    process.env[NAME] = 'Un editeur';
    process.env[CONTACT] = 'voltface@gmail.co;';
    expect(legalIsComplete()).toBe(false);
  });

  it('laisse passer une adresse ordinaire', () => {
    process.env[CONTACT] = 'contact@voltface.tv';
    expect(publisher().email).toBe('contact@voltface.tv');
  });

  it('⚠️ n invente pas une adresse a partir d une valeur vide', () => {
    process.env[CONTACT] = '   ';
    expect(publisher().email).toBeUndefined();
  });
});

describe('looksLikeEmail — ce qu il attrape, et ce qu il ne pretend pas savoir', () => {
  it('refuse les fautes de frappe qui se copient-collent', () => {
    for (const raw of [
      'voltface@gmail.co;',
      'voltface@gmail,com',
      'voltface@gmail com',
      'voltface@@gmail.com',
      '<voltface@gmail.com>',
      'voltface@localhost',
      '@gmail.com',
      'voltface@',
    ]) {
      expect(looksLikeEmail(raw), raw).toBe(false);
    }
  });

  it('accepte les formes valides, y compris les moins courantes', () => {
    for (const raw of [
      'a@b.co',
      'contact+dsa@voltface.tv',
      'nom.prenom@sous.domaine.example.org',
    ]) {
      expect(looksLikeEmail(raw), raw).toBe(true);
    }
  });

  it('⚠️ ne pretend pas que l adresse existe', () => {
    // Rien dans le code ne peut le dire. Ce controle attrape la faute de frappe — le cas
    // qui s'est produit —, pas une boite qui n'est pas relevee. Le noter ici evite qu'on
    // le prenne un jour pour une garantie de reception.
    expect(looksLikeEmail('personne@voltface.tv')).toBe(true);
  });
});

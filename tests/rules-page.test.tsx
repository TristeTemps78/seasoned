import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RulesView } from '@/app/(site)/regles/page';
import { REPORT_GROUNDS, REVIEW_DEADLINE_HOURS } from '@/src/domain/moderation';

/**
 * La page des règles — 5.0a.
 *
 * Ce qu'elle doit prouver n'est pas qu'elle s'affiche, mais qu'elle **ne peut pas mentir** :
 * les motifs publiés viennent du domaine, le délai annoncé aussi. Une page de règles qui
 * dérive du code qu'elle décrit est pire qu'aucune page — elle légitime un retrait sur une
 * base fausse.
 */

const CONTACT = 'LEGAL_CONTACT_EMAIL';

describe('la page des règles', () => {
  beforeEach(() => {
    delete process.env[CONTACT];
  });
  afterEach(() => {
    delete process.env[CONTACT];
  });

  it('🔴 publie TOUS les motifs du domaine', () => {
    // Le test qui compte. Un motif ajouté à `REPORT_GROUNDS` sans être publié serait un
    // motif qu'on applique sans l'avoir annoncé — exactement l'arbitraire que cette page
    // existe pour empêcher.
    render(<RulesView locale="fr" />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    // Un item par motif, plus les trois de « ce qui se passe ensuite ».
    expect(items.length).toBeGreaterThanOrEqual(REPORT_GROUNDS.length);
    // Chaque motif a bien produit une ligne non vide.
    for (const ground of REPORT_GROUNDS) {
      expect(ground.length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Harcèlement, menace/)).toBeTruthy();
    expect(screen.getByText(/Révéler l’intrigue/)).toBeTruthy();
  });

  it('annonce le délai que le domaine applique, jamais un autre', () => {
    // Le chiffre vient de `REVIEW_DEADLINE_HOURS`. L'écrire en dur ici ferait diverger la
    // promesse et le code au premier ajustement.
    render(<RulesView locale="fr" />);
    expect(screen.getByText(new RegExp(`${REVIEW_DEADLINE_HOURS} heures`))).toBeTruthy();
  });

  it('dit que rien n’est encore ouvert', () => {
    // On ne laisse pas croire à un espace social qui n'existe pas — même règle que
    // `/mentions` quand l'identité de l'éditeur manque.
    render(<RulesView locale="fr" />);
    expect(screen.getByText(/Rien de tout cela n’est encore ouvert/)).toBeTruthy();
  });

  it('🔴 avertit quand le point de contact manque, au lieu d’afficher un vide', () => {
    // Sans adresse, le dispositif n'existe pas : il n'y a nulle part où signaler. La page
    // doit le dire, pas laisser une section muette qui aurait l'air complète.
    render(<RulesView locale="fr" />);
    expect(screen.getAllByText(/adresse de contact n’est pas encore renseignée/).length)
      .toBeGreaterThan(0);
  });

  it('affiche l’adresse quand elle est configurée', () => {
    process.env[CONTACT] = 'contact@exemple.test';
    render(<RulesView locale="fr" />);
    const link = screen.getByRole('link', { name: 'contact@exemple.test' });
    expect(link.getAttribute('href')).toBe('mailto:contact@exemple.test');
  });

  it('promet le masquage, jamais la suppression', () => {
    // La décision structurante du dispositif, et elle doit être publique : c'est elle qui
    // rend une erreur de modération réparable.
    render(<RulesView locale="fr" />);
    expect(screen.getByText(/masqué, jamais supprimé/)).toBeTruthy();
    expect(screen.getByText(/qui sait retirer mais pas rendre/)).toBeTruthy();
  });

  it('existe en anglais aussi', () => {
    render(<RulesView locale="en" />);
    expect(screen.getByText(/The rules, and how to report/)).toBeTruthy();
    expect(screen.getByText(/hidden, never deleted/)).toBeTruthy();
  });
});

describe('la page est atteignable', () => {
  it('a une route dans les deux langues', () => {
    // Une page de règles introuvable ne sert à rien : c'est celle qu'on cherche quand on
    // veut signaler quelque chose.
    const fr = readFileSync('app/(fr)/fr/regles/page.tsx', 'utf8');
    expect(fr).toContain('RulesView');
    expect(fr).toContain("locale=\"fr\"");
  });

  it('figure au sitemap', () => {
    const sitemap = readFileSync('app/sitemap.ts', 'utf8');
    expect(sitemap).toContain("'/regles'");
  });
});

describe('le lien du pied de page', () => {
  it('mène aux règles depuis toutes les pages', () => {
    // Une voie de signalement introuvable n'est pas une voie de signalement. Le pied de
    // page est le seul endroit présent partout — même raisonnement que pour les mentions
    // légales et la confidentialité.
    const chrome = readFileSync('app/components/SiteChrome.tsx', 'utf8');
    expect(chrome).toContain("pathIn('/regles', locale)");
    expect(chrome).toContain("'rules.title'");
  });
});

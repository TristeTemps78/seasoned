import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RulesView } from '@/app/(site)/regles/page';
import { REPORT_GROUNDS } from '@/src/domain/moderation';

/**
 * La page des règles.
 *
 * Trois tests, pas dix. Vérifier qu'une page affiche le texte que je viens d'écrire dans le
 * dictionnaire ne prouve rien : si le texte change, le test change avec, et il n'a jamais
 * attrapé de défaut.
 *
 * **La règle appliquée ici : on garde un test si l'on sait nommer le bug qu'il attrape.**
 */

const CONTACT = 'LEGAL_CONTACT_EMAIL';

afterEach(() => {
  delete process.env[CONTACT];
});

describe('la page des règles', () => {
  it('publie autant de motifs que le domaine en connaît', () => {
    // Le bug : un motif ajouté au domaine et jamais annoncé, donc appliqué en douce.
    // (Le typage l'attrape déjà à la compilation — ceci le fige au cas où `GROUND_KEY`
    // deviendrait moins strict.)
    render(<RulesView locale="fr" />);
    const listed = screen.getAllByRole('listitem').length;
    expect(listed).toBeGreaterThanOrEqual(REPORT_GROUNDS.length);
  });

  it('avertit quand le point de contact manque', () => {
    // Le bug : une page de signalement sans adresse où signaler, qui a l'air complète.
    render(<RulesView locale="fr" />);
    expect(
      screen.getAllByText(/adresse de contact n’est pas encore renseignée/).length,
    ).toBeGreaterThan(0);
  });

  it('est atteignable depuis toutes les pages', () => {
    // Le bug : la page existe et personne ne peut la trouver. C'est arrivé au SEO du
    // 2026-08-01 — tout le dispositif en place, l'effet nul.
    const chrome = readFileSync('app/components/SiteChrome.tsx', 'utf8');
    expect(chrome).toContain("pathIn('/regles', locale)");
  });
});

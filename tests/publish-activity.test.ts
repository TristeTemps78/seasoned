import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 🔴 L'activite ne partait que depuis `/amis`.
 *
 * Mesure du 2026-08-10 sur la vraie base : deux comptes, trois critiques ecrites, et
 * **zero activite**. Terminer une serie depuis sa fiche sans retourner chez ses amis
 * laissait le fait dans le navigateur pour toujours.
 *
 * Rien ne pouvait le signaler : un fil vide et un fil qui n'a jamais rien recu donnent
 * exactement le meme ecran — le defaut de 10.0, sur un autre chemin.
 *
 * Ce test lit la source, comme `ordering-notice` et `no-hardcoded-strings` : ni le test du
 * domaine (`activity.test.ts`) ni celui d'un composant ne prouvent qu'une page **appelle**
 * quoi que ce soit, et c'est exactement le trou qu'`episodeMinutes` avait laisse.
 */
describe('l activite se publie depuis toutes les pages', () => {
  it('le chrome du site monte le publieur', () => {
    const chrome = readFileSync('app/components/SiteChrome.tsx', 'utf8');
    expect(chrome).toContain('<PublishActivity />');
  });

  it('le publieur projette bien le journal', () => {
    const source = readFileSync('app/components/PublishActivity.tsx', 'utf8');
    expect(source).toContain('projectActivity');
    expect(source).toContain('.publish(');
  });

  /**
   * ⚠️ Sans garde, chaque demi-etoile posee declencherait un envoi : le journal change a
   * chaque frappe. Le composant attend que ca se calme **et** ne renvoie que si la
   * projection a change.
   */
  it('n envoie pas a chaque frappe', () => {
    const source = readFileSync('app/components/PublishActivity.tsx', 'utf8');
    expect(source).toContain('setTimeout');
    expect(source).toContain('lastSent');
  });

  /**
   * ⚠️ On ne memorise que ce qui est **parti**. Sinon un echec reseau serait pris pour un
   * envoi reussi, et le fait ne repartirait jamais.
   */
  it('ne retient un envoi que s il a reussi', () => {
    const source = readFileSync('app/components/PublishActivity.tsx', 'utf8');
    expect(source).toMatch(/if \(ok\) lastSent\.current/);
  });
});

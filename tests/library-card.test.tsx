import { render, screen } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it } from 'vitest';
import { LibraryCard } from '@/app/components/LibraryCard';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { EMPTY_JOURNAL, journalKey, setPosition } from '@/src/domain/journal';
import type { JournalEntry, JournalSnapshot } from '@/src/domain/journal';
import type { LibraryItem } from '@/src/domain/library';
import type { Locale } from '@/lib/i18n';

/**
 * La vignette de la bibliotheque.
 *
 * Un seul sujet ici, et c'est celui qui a ete **constate au navigateur** : la vignette
 * affichait un statut fige dans la langue du geste, pas dans celle de la page.
 */

const BB = journalKey('1396');
const NOW = new Date('2026-08-03T12:00:00Z');

function entryOf(): JournalEntry {
  return setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW).entries[BB]!;
}

function itemWith(snapshot: JournalSnapshot): LibraryItem {
  // ⚠️ Sans position, la vignette affiche « S3E7 » et jamais le statut : le test
  // porterait alors sur une branche qui n'est pas celle qu'on veut garder.
  const entry: JournalEntry = { ...entryOf() };
  delete (entry as { position?: unknown }).position;
  return { key: BB, entry, snapshot, touchedAt: NOW.getTime() };
}

function renderIn(locale: Locale, snapshot: JournalSnapshot) {
  return render(
    <LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
      <LibraryCard item={itemWith(snapshot)} />
    </LocaleProvider>,
  );
}

describe('le statut de la vignette suit la langue de la PAGE', () => {
  const FRESH = { title: 'Breaking Bad', cachedAt: NOW.toISOString() };

  it('🔴 la bibliotheque anglaise n affiche pas « Entre deux saisons »', () => {
    // Le defaut exact, vu sur `/moi` en anglais : `statusLabel` etait memorise **deja
    // traduit**, avec la langue de la page ou le geste avait ete fait. La bibliotheque le
    // reaffichait tel quel. Invisible au typage — c'est une chaine des deux cotes.
    renderIn('en', {
      ...FRESH,
      status: 'between_seasons',
      statusLabel: 'Entre deux saisons',
    });

    expect(screen.getByText('Between seasons')).toBeDefined();
    expect(screen.queryByText('Entre deux saisons')).toBeNull();
  });

  it('et symetriquement, la bibliotheque francaise ne sert pas l anglais', () => {
    renderIn('fr', { ...FRESH, status: 'airing', statusLabel: 'Airing' });

    expect(screen.getByText('En diffusion')).toBeDefined();
    expect(screen.queryByText('Airing')).toBeNull();
  });

  it('⚠️ un journal ecrit AVANT `status` garde son libelle plutot que rien', () => {
    // « On migre ce qu'on controle » : ces journaux sont chez les gens, et on ne peut pas
    // les reecrire. Perdre le statut serait une regression pour eux — le repli doit tenir.
    renderIn('en', { ...FRESH, statusLabel: 'Entre deux saisons' });

    expect(screen.getByText('Entre deux saisons')).toBeDefined();
  });

  it('un instantane sans aucun statut ne fait pas disparaitre la vignette', () => {
    // Regle 4 : un journal ecrit par une version plus recente, qui connaitrait un
    // huitieme statut, se relit sans ce champ. On retombe sur « a voir », pas sur du vide
    // — perdre une vignette est un defaut d'affichage, perdre une serie suivie serait une
    // perte de donnee.
    renderIn('en', FRESH);

    expect(screen.getByText('Breaking Bad')).toBeDefined();
    expect(screen.getByText('to watch')).toBeDefined();
  });
});

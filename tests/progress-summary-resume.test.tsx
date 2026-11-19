import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressSummary } from '@/app/components/ProgressSummary';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { DICTIONARIES } from '@/lib/i18n';
import { parseJournal } from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

const seasons = [{ seasonNumber: 1, episodeCount: 4 }, { seasonNumber: 3, episodeCount: 7 }, { seasonNumber: 4, episodeCount: 0 }];

function renderSummary(locale: 'fr' | 'en' = 'fr') {
  render(<LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
    <ProgressSummary seriesId="1396" seasons={seasons} />
  </LocaleProvider>);
}

function savedPosition() {
  return parseJournal(window.localStorage.getItem(STORAGE_KEY) ?? '').entries['tmdb:1396']?.position;
}

describe('ProgressSummary — reprise en cours de série', () => {
  it('prévisualise la reprise avant de mémoriser uniquement le dernier épisode vu', async () => {
    renderSummary();
    fireEvent.click(await screen.findByRole('button', { name: 'J’en suis déjà à…' }));
    fireEvent.change(screen.getByLabelText('Saison'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Dernier épisode vu'), { target: { value: '5' } });
    expect(screen.getByText('À reprendre : S3E6')).toBeDefined();
    expect(savedPosition()).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma position' }));
    await waitFor(() => expect(savedPosition()).toMatchObject({ seasonNumber: 3, episodeNumber: 5 }));
    expect(screen.queryByRole('button', { name: 'J’en suis déjà à…' })).toBeNull();
  });

  it('saute les saisons absentes, ne propose pas les saisons sans épisodes et annule sans écrire', async () => {
    renderSummary('en');
    fireEvent.click(await screen.findByRole('button', { name: 'I’m already at…' }));
    expect(screen.getByLabelText('Season').querySelector('option[value="4"]')).toBeNull();
    fireEvent.change(screen.getByLabelText('Last episode watched'), { target: { value: '4' } });
    expect(screen.getByText('Resume at: S3E1')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(savedPosition()).toBeUndefined();
    expect(screen.queryByLabelText('Last episode watched')).toBeNull();
    expect(screen.getByRole('button', { name: 'I’ve started it' })).toBeDefined();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressSummary } from '@/app/components/ProgressSummary';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { DICTIONARIES } from '@/lib/i18n';
import { parseJournal } from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

const seasons = [{ seasonNumber: 1, episodeCount: 4 }, { seasonNumber: 3, episodeCount: 7 }, { seasonNumber: 4, episodeCount: 0 }];

const decision = { duration: '8 heures', status: 'Terminée', rating: '4,2 / 5', votes: '400 votes' };

function renderPilot(seriesId: string, episodeMinutes?: number) {
  render(<LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
    <ProgressSummary seriesId={seriesId} seasons={seasons} decision={decision}
      {...(episodeMinutes !== undefined ? { episodeMinutes } : {})} />
  </LocaleProvider>);
}

function renderSummary(locale: 'fr' | 'en' = 'fr') {
  render(<LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
    <ProgressSummary seriesId="1396" seasons={seasons} />
  </LocaleProvider>);
}

function savedPosition() {
  return parseJournal(window.localStorage.getItem(STORAGE_KEY) ?? '').entries['tmdb:1396']?.position;
}

describe('ProgressSummary — reprise en cours de série', () => {
  it.each(['95480', '42009', '84773'])('affiche les seuls repères de décision pour la fiche pilote %s', async (id) => {
    renderPilot(id);
    const heading = await screen.findByRole('heading', { name: 'Avant de te lancer' });
    expect(heading.parentElement?.textContent).toEqual(expect.stringContaining('8 heures'));
    expect(heading.parentElement?.textContent).toEqual(expect.stringContaining('Terminée'));
    expect(heading.parentElement?.textContent).toEqual(expect.stringContaining('4,2 / 5'));
    expect(heading.parentElement?.textContent).toEqual(expect.stringContaining('400 votes'));
  });

  it('exclut les autres fiches du pilote, même avec les mêmes repères', async () => {
    renderPilot('1396');
    await screen.findByRole('button', { name: 'J’en suis déjà à…' });
    expect(screen.queryByRole('heading', { name: 'Avant de te lancer' })).toBeNull();
  });

  it('remplace la décision par la reprise après enregistrement du dernier épisode vu', async () => {
    renderPilot('95480', 45);
    await screen.findByRole('heading', { name: 'Avant de te lancer' });
    fireEvent.click(screen.getByRole('button', { name: 'J’en suis déjà à…' }));
    fireEvent.change(screen.getByLabelText('Dernier épisode vu'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma position' }));
    expect(await screen.findByText('À reprendre : S3E1')).toBeDefined();
    expect(screen.getByText(/Temps restant estimé.*5 heures/)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Avant de te lancer' })).toBeNull();
  });

  it('estime les soirées par épisodes entiers, sans modifier la progression', async () => {
    renderPilot('95480', 45);
    fireEvent.click(await screen.findByRole('button', { name: 'J’en suis déjà à…' }));
    fireEvent.change(screen.getByLabelText('Dernier épisode vu'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma position' }));
    expect(await screen.findByRole('list', { name: 'Progression par saison' })).toBeDefined();
    const storage = window.localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByText('Plan de soirée'));
    fireEvent.click(screen.getByRole('button', { name: '90 min' }));
    expect(screen.getByText('Environ 4 soirées')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '30 min' }));
    expect(screen.getByText('Prévois un créneau plus long.')).toBeDefined();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(storage);
  });

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

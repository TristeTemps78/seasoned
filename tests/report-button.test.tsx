import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ReportButton } from '@/app/components/ReportButton';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { REPORT_GROUNDS } from '@/src/domain/moderation';
import { t } from '@/lib/i18n';

function open(onReport: (ground: string) => Promise<boolean>) {
  render(
    <LocaleProvider locale="fr">
      <ReportButton onReport={onReport} />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: t('fr', 'report.open') }));
}

it('propose exactement les motifs publies sur /regles', () => {
  // Le bug : un menu qui offre un motif que la page des regles n'annonce pas. Retirer pour
  // un motif non publie est l'arbitraire exact que /regles existe pour empecher — et
  // l'inverse, un motif publie qu'on ne peut pas invoquer, est une promesse vide.
  open(async () => true);

  for (const ground of REPORT_GROUNDS) {
    expect(screen.getByRole('button', { name: t('fr', `rules.ground.${ground}`) })).toBeTruthy();
  }
});

it('🔴 un signalement qui echoue le DIT, et laisse le panneau ouvert', async () => {
  // Le bug, refuse par le typage avant d'etre expedie : l'echec vivait dans la meme
  // variable que la phase, donc le panneau se refermait. La personne cliquait, tout
  // disparaissait, et rien n'etait parti.
  const onReport = vi.fn(async () => false);
  open(onReport);

  const first = REPORT_GROUNDS[0] ?? 'illegal';
  fireEvent.click(screen.getByRole('button', { name: t('fr', `rules.ground.${first}`) }));

  await waitFor(() => {
    expect(screen.getByText(t('fr', 'report.failed'))).toBeTruthy();
  });
  // Le panneau est toujours la : on peut reessayer sans le rouvrir.
  expect(screen.getByRole('button', { name: t('fr', 'report.cancel') })).toBeTruthy();
  expect(onReport).toHaveBeenCalledWith(first);
});

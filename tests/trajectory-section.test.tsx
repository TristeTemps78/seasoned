import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrajectorySection } from '@/app/components/TrajectorySection';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { computeTrajectory } from '@/src/domain/trajectory';
import type { CurrentSeasonVerdict } from '@/src/domain/current-season';
import type { EntryPoint } from '@/src/domain/entry-point';
import { EMPTY_JOURNAL, serializeJournal, setPosition } from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

/**
 * Le point d'entree et le verdict de saison en cours, testes sur leur **placement**.
 *
 * Le calcul est deja couvert, purement, par `entry-point.test.ts` et
 * `current-season.test.ts`. Ce qui reste a prouver est ce qu'aucun des deux ne voit :
 * qu'ils sont branches, et surtout **ou** ils apparaissent — la regle 7 d'`AGENTS.md` se
 * joue entierement la.
 */

const TRAJECTORY = computeTrajectory('1396', [
  { seasonNumber: 1, stars: 4 },
  { seasonNumber: 2, stars: 4.2 },
  { seasonNumber: 3, stars: 4.1 },
  { seasonNumber: 4, stars: 4.3 },
  { seasonNumber: 5, stars: 3.4 },
]);

const ENTRY: EntryPoint = {
  afterSeason: 1,
  afterEpisode: 4,
  startSeason: 1,
  startEpisode: 5,
  skipped: 4,
  before: 6.1,
  after: 8.4,
};

const CURRENT: CurrentSeasonVerdict = {
  seasonNumber: 5,
  airedEpisodes: 4,
  current: 6.5,
  reference: 8.1,
  gap: -1.6,
};

function renderSection(options: {
  readonly entryPoint?: EntryPoint;
  readonly currentSeason?: CurrentSeasonVerdict;
} = {}) {
  render(
    <LocaleProvider locale="fr">
      <TrajectorySection
        seriesId="1396"
        title="Breaking Bad"
        trajectory={TRAJECTORY}
        grid={[]}
        advice={undefined}
        entryPoint={options.entryPoint}
        currentSeason={options.currentSeason}
      />
    </LocaleProvider>,
  );
}

/** Le contenu du depliant, qui est present dans le HTML mais replie. */
function insideDisclosure(text: RegExp): boolean {
  const details = document.querySelector('details');
  return details !== null && details.textContent !== null && text.test(details.textContent);
}

/**
 * Attend que la note soit rendue **a l'endroit voulu**.
 *
 * ⚠️ Ne pas remplacer par `findByText` suivi d'une assertion sur le placement : la
 * premiere version faisait exactement cela, et **ne prouvait rien**. `useJournal` lit le
 * stockage de facon asynchrone ; au premier rendu la position est encore inconnue, donc
 * la note apparait dans le depliant. `findByText` resolvait sur ce rendu-la, avant que la
 * position n'arrive, et l'assertion suivante mesurait un etat transitoire.
 *
 * Constate en injectant le defaut : en supprimant purement et simplement le rendu hors
 * depliant, les six tests restaient verts. Un test qui ne tombe pas quand on casse ce
 * qu'il surveille est pire qu'un test absent — il donne une confiance imméritée.
 */
async function waitForPlacement(text: RegExp, expected: 'inside' | 'outside'): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText(text)).toBeDefined();
    expect(insideDisclosure(text)).toBe(expected === 'inside');
  });
}

describe('TrajectorySection — le point d’entree', () => {
  it('s’affiche hors du geste explicite', () => {
    // Il ne revele rien de l'intrigue et s'adresse a qui n'a pas commence : le cacher
    // derriere un depliant reviendrait a le refuser a son seul public.
    renderSection({ entryPoint: ENTRY });
    expect(screen.getByText(/Elle démarre lentement/)).toBeDefined();
    expect(screen.getByText(/Ça décolle à S1E5/)).toBeDefined();
    expect(insideDisclosure(/démarre lentement/)).toBe(false);
  });

  it('ne s’affiche pas quand il n’y en a pas', () => {
    renderSection();
    expect(screen.queryByText(/démarre lentement/)).toBeNull();
  });
});

describe('TrajectorySection — la saison en cours suit la regle de spoiler', () => {
  it('reste dans le depliant pour qui n’y est pas encore', async () => {
    // Position en saison 2, verdict sur la saison 5 : c'est un jugement sur son avenir.
    window.localStorage.setItem(
      STORAGE_KEY,
      serializeJournal(setPosition(EMPTY_JOURNAL, 'tmdb:1396', 2, 3)),
    );
    renderSection({ currentSeason: CURRENT });
    await waitForPlacement(/Saison 5 —/, 'inside');
  });

  it('sort du depliant pour qui est deja a jour', async () => {
    // Position en saison 5 : savoir que la saison en cours est en dessous n'est pas un
    // spoiler, c'est ce qu'il vient chercher chaque semaine.
    window.localStorage.setItem(
      STORAGE_KEY,
      serializeJournal(setPosition(EMPTY_JOURNAL, 'tmdb:1396', 5, 2)),
    );
    renderSection({ currentSeason: CURRENT });
    await waitForPlacement(/Saison 5 —/, 'outside');
  });

  it('reste dans le depliant faute de position declaree', async () => {
    renderSection({ currentSeason: CURRENT });
    await waitForPlacement(/Saison 5 —/, 'inside');
  });

  it('dit un fait sur les episodes sortis, jamais un pronostic', async () => {
    renderSection({ currentSeason: CURRENT });
    const note = await screen.findByText(/Saison 5 —/);
    expect(note.textContent).toContain('4 épisodes sortis');
    expect(note.textContent).toContain('1,6 sous la moyenne');
  });
});

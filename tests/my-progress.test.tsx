import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MyProgress } from '@/app/components/MyProgress';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n';
import {
  EMPTY_JOURNAL,
  serializeJournal,
  setPosition,
  setSeasonRating,
  type Journal,
} from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

/**
 * Les deux gestes de la vague A, verifies sur le rendu et non sur le calcul.
 *
 * Le calcul est deja couvert, purement, par `remaining.test.ts` et `nudge.test.ts`. Ce
 * qui reste a prouver est ce qu'aucun des deux ne peut voir : que les deux modules sont
 * **branches**. C'est exactement la faute que ce projet a commise trois fois —
 * `computeTrajectory` et `redactTrajectory` ont dormi des semaines, ecrits et testes,
 * appeles par rien. Un module teste mais jamais execute n'est pas une garantie.
 */

const SEASONS = [
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 12 },
  { seasonNumber: 3, episodeCount: 8 },
];

const SERIES = { title: 'Breaking Bad' };
const KEY = 'tmdb:1396';

function store(journal: Journal): void {
  window.localStorage.setItem(STORAGE_KEY, serializeJournal(journal));
}

function renderAt(locale: Locale = 'fr', episodeMinutes?: number) {
  render(
    <LocaleProvider locale={locale}>
      <MyProgress
        seriesId="1396"
        seasons={SEASONS}
        series={SERIES}
        {...(episodeMinutes !== undefined ? { episodeMinutes } : {})}
      />
    </LocaleProvider>,
  );
}

describe('MyProgress — ce qu’il reste, et ce qu’on peut noter', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('ne promet rien avant d’avoir lu le stockage', () => {
    // Afficher « vous n'avez rien vu » a quelqu'un qui a tout note serait la pire
    // premiere impression possible — et le serveur et le client rendraient deux
    // choses differentes.
    renderAt();
    expect(screen.queryByText(/Il vous reste/)).toBeNull();
  });

  it('chiffre ce qu’il reste une fois la position posee', async () => {
    store(setPosition(EMPTY_JOURNAL, KEY, 2, 5));
    renderAt('fr', 45);
    // 7 restants en S2 + 8 en S3 = 15 episodes, a 45 min = 11 h 15.
    expect(await screen.findByText(/Il vous reste 15 épisodes/)).toBeDefined();
  });

  it('donne le compte sans la duree quand TMDB n’en sait rien', async () => {
    store(setPosition(EMPTY_JOURNAL, KEY, 3, 7));
    renderAt('fr');
    expect(await screen.findByText(/Il vous reste 1 épisode/)).toBeDefined();
  });

  it('se tait quand il ne reste rien', async () => {
    store(setPosition(EMPTY_JOURNAL, KEY, 3, 8));
    renderAt('fr', 45);
    // Attendre que le composant ait lu le stockage, sinon on constate un silence qui
    // n'a pas encore de sens.
    expect(await screen.findByText(/Où j’en suis/)).toBeDefined();
    expect(screen.queryByText(/Il vous reste/)).toBeNull();
  });

  it('demande de noter la saison qu’on vient de finir', async () => {
    store(setPosition(EMPTY_JOURNAL, KEY, 1, 10));
    renderAt('fr');
    expect(await screen.findByText(/Vous venez de finir la saison 1/)).toBeDefined();
  });

  it('cesse de la demander une fois notee', async () => {
    const journal = setSeasonRating(setPosition(EMPTY_JOURNAL, KEY, 1, 10), KEY, 1, 4);
    store(journal);
    renderAt('fr');
    expect(await screen.findByText(/Où j’en suis/)).toBeDefined();
    expect(screen.queryByText(/Vous venez de finir/)).toBeNull();
  });

  it('parle la langue de la page', async () => {
    store(setPosition(EMPTY_JOURNAL, KEY, 2, 5));
    renderAt('en', 45);
    expect(await screen.findByText(/You have 15 episodes left/)).toBeDefined();
  });
});

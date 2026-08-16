import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResumeStrip } from '@/app/components/ResumeStrip';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import {
  EMPTY_JOURNAL,
  parseJournal,
  serializeJournal,
  setPosition,
  setSeasonRating,
  setSnapshot,
  type Journal,
} from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

/**
 * La bande de reprise — **le rappel que le produit s'autorise**.
 *
 * Ce qui se garde ici est la **jonction**, pas le calcul : `nextAfter` et `seasonToRate` ont
 * chacun leurs cas, purement testes ailleurs. Ce qu'aucun des deux ne peut voir, c'est
 * qu'ils sont branches **au meme endroit** — et c'est exactement la faute que ce depot a
 * commise cinq fois, dont `seasonToRate` elle-meme : ecrite, testee, et cablee a une seule
 * page pendant que le geste qui la declenche vivait ailleurs.
 */

const KEY = 'tmdb:1396';
const SEASONS = [
  { seasonNumber: 1, episodeCount: 7 },
  { seasonNumber: 2, episodeCount: 13 },
];

function journalAt(season: number, episode: number): Journal {
  const withPosition = setPosition(EMPTY_JOURNAL, KEY, season, episode);
  return setSnapshot(withPosition, KEY, { title: 'Breaking Bad', seasonSizes: SEASONS });
}

function store(journal: Journal): void {
  window.localStorage.setItem(STORAGE_KEY, serializeJournal(journal));
}

function read(): Journal {
  return parseJournal(window.localStorage.getItem(STORAGE_KEY));
}

function renderStrip() {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <ResumeStrip />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('avancer d un episode', () => {
  it('nomme l episode plutot que de dire « suivant »', async () => {
    store(journalAt(1, 3));
    renderStrip();
    expect(await screen.findByRole('button', { name: 'J’ai vu S1E4' })).toBeDefined();
  });

  it('ecrit la position au clic', async () => {
    store(journalAt(1, 3));
    renderStrip();
    fireEvent.click(await screen.findByRole('button', { name: 'J’ai vu S1E4' }));
    await waitFor(() => expect(read().entries[KEY]?.position?.episodeNumber).toBe(4));
  });
});

describe('🔴 la note se demande la ou le geste a lieu', () => {
  it('reclame la saison finie et non notee', async () => {
    // Le cas exact que ce lot repare : la saison 1 est entierement vue, personne ne l'a
    // notee, et jusqu'ici il fallait rouvrir la fiche pour qu'on le dise — c'est-a-dire
    // la navigation que le bouton d'a cote existe pour supprimer.
    store(journalAt(1, 7));
    renderStrip();
    expect(await screen.findByRole('radiogroup', { name: 'Note de la saison 1' })).toBeDefined();
  });

  it('ne reclame rien tant que la saison n est pas finie', async () => {
    store(journalAt(1, 6));
    renderStrip();
    await screen.findByRole('button', { name: 'J’ai vu S1E7' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('ne reclame plus une saison deja notee', async () => {
    store(setSeasonRating(journalAt(1, 7), KEY, 1, 4));
    renderStrip();
    await screen.findByRole('button', { name: 'J’ai vu S2E1' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('se tait sans decoupage connu — on ne sait pas ce qui est fini', async () => {
    // Meme condition que le bouton d'episode : sans `seasonSizes`, on ignore si S1E7 termine
    // sa saison. Reclamer une note serait deviner.
    store(setPosition(EMPTY_JOURNAL, KEY, 1, 7));
    renderStrip();
    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
  });
});

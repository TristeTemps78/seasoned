import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { WatchMenu } from '@/app/components/WatchMenu';
import {
  EMPTY_JOURNAL,
  parseJournal,
  serializeJournal,
  setPosition,
  setSnapshot,
  type Journal,
} from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

/**
 * L'action de l'en-tete — D12.
 *
 * « Sept liens de navigation, une recherche, et rien pour FAIRE quelque chose » : le geste
 * central du produit — celui de TV Time — n'existait qu'a deux endroits, la bande de reprise
 * de l'accueil et les vignettes de `/moi`.
 *
 * ⚠️ Ce qui se garde ici est **le cablage et le refus de deviner**, pas le calcul : `nextAfter`
 * et `buildLibrary` ont leurs cas ailleurs. Ce qu'aucun des deux ne voit, c'est qu'ils sont
 * branches a l'en-tete — la faute que ce depot a commise cinq fois.
 */

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));

const SEASONS = [
  { seasonNumber: 1, episodeCount: 7 },
  { seasonNumber: 2, episodeCount: 13 },
];

/**
 * ⚠️ `null` et non `undefined` pour « pas de decoupage », et ce n'est pas une preference :
 * en JavaScript, passer `undefined` a un parametre qui a une valeur par defaut **declenche la
 * valeur par defaut**. La premiere version de ce fichier passait `undefined` et recevait donc
 * les saisons — le test accusait le composant d'afficher un bouton qu'il n'affichait pas.
 */
function withSeries(
  journal: Journal,
  key: string,
  title: string,
  at: readonly [number, number],
  sizes: readonly { seasonNumber: number; episodeCount: number }[] | null = SEASONS,
): Journal {
  const placed = setPosition(journal, key, at[0], at[1]);
  return setSnapshot(placed, key, {
    title,
    ...(sizes === null ? {} : { seasonSizes: sizes }),
  });
}

function store(journal: Journal): void {
  window.localStorage.setItem(STORAGE_KEY, serializeJournal(journal));
}

function read(): Journal {
  return parseJournal(window.localStorage.getItem(STORAGE_KEY));
}

function mount() {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <WatchMenu locale="fr" />
    </LocaleProvider>,
  );
}

async function open() {
  fireEvent.click(await screen.findByRole('button', { expanded: false }));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('le volet « J’ai vu… »', () => {
  it('🔴 avance un episode SANS quitter la page', async () => {
    store(withSeries(EMPTY_JOURNAL, 'tmdb:1396', 'Breaking Bad', [1, 3]));
    mount();
    await open();

    fireEvent.click(await screen.findByRole('button', { name: 'J’ai vu S1E4' }));
    await waitFor(() =>
      expect(read().entries['tmdb:1396']?.position?.episodeNumber).toBe(4),
    );
  });

  it('nomme l’episode, jamais « suivant »', async () => {
    // Un tracker qui avance la mauvaise chose est pire qu'un tracker qu'on n'utilise pas —
    // et c'est le seul endroit du produit ou l'on ecrit sans voir la serie.
    store(withSeries(EMPTY_JOURNAL, 'tmdb:1396', 'Breaking Bad', [1, 7]));
    mount();
    await open();
    // Fin de la saison 1 : le suivant est S2E1, pas S1E8.
    expect(await screen.findByRole('button', { name: 'J’ai vu S2E1' })).toBeDefined();
  });

  it('🔴 pas de bouton quand le decoupage est inconnu, mais le lien reste', async () => {
    // Sans `seasonSizes`, on ne sait pas si S1E7 termine sa saison. Un bouton qui devine est
    // un bouton qui se trompe (regle du 2026-08-09) — et la serie doit rester atteignable.
    store(withSeries(EMPTY_JOURNAL, 'tmdb:1396', 'Breaking Bad', [1, 3], null));
    mount();
    await open();

    expect(await screen.findByRole('link', { name: 'Breaking Bad' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /J’ai vu S/ })).toBeNull();
  });

  it('sans rien a avancer, dit quoi faire — et le dit sans compte', async () => {
    // Regle 4. ⚠️ Aucun compte n'est simule dans ce fichier : ce volet lit le journal du
    // navigateur et n'appelle rien. C'est la seule action du produit qui marche deconnectee.
    mount();
    await open();

    expect(await screen.findByText(/Rien à avancer/)).toBeDefined();
    expect(
      screen.getByRole('link', { name: /Parcourir les séries/ }).getAttribute('href'),
    ).toBe('/fr/parcourir');
  });

  it('s’arrete a cinq series, et mene a la bibliotheque', async () => {
    let journal = EMPTY_JOURNAL;
    for (let i = 1; i <= 7; i += 1) {
      journal = withSeries(journal, `tmdb:${i}`, `Série ${i}`, [1, 2]);
    }
    store(journal);
    mount();
    await open();

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /J’ai vu S/ })).toHaveLength(5),
    );
    // Sans cette sortie, on croirait que la bibliotheque s'arrete a cinq elle aussi.
    expect(screen.getByRole('link', { name: /Toute ma bibliothèque/ }).getAttribute('href')).toBe(
      '/fr/moi',
    );
  });

  it('Escape referme et rend le focus au bouton', async () => {
    // Obligatoire dans le patron « divulgation » : sans le retour de focus, la tabulation
    // suivante repart du tout debut de la page. Meme exigence que `AccountMenu`.
    store(withSeries(EMPTY_JOURNAL, 'tmdb:1396', 'Breaking Bad', [1, 3]));
    mount();
    await open();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      const trigger = screen.getByRole('button', { expanded: false });
      expect(document.activeElement).toBe(trigger);
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MyProgress } from '@/app/components/MyProgress';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n';
import {
  EMPTY_JOURNAL,
  markCompleted,
  parseJournal,
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
  /**
   * 🔴 **Ce test etait CREUX.** Il faisait `expect(queryByText(/Il vous reste/)).toBeNull()`
   * sans rien attendre — or tant que le stockage n'est pas lu, `MyProgress` ne rend qu'un
   * `div` vide. L'absence etait donc l'etat par defaut, mesure **avant** toute lecture :
   * supprimer entierement la fonctionnalite « il vous reste » laissait ce test vert.
   *
   * L'invariante reelle n'est pas une absence, c'est une **presence** : le bloc qui attend
   * doit reserver la hauteur du bloc replie. Sans lui, la page saute quand le journal
   * arrive — le decalage de mise en page que la tache 1.24 avait supprime sur cette page
   * meme. C'est ce qu'on affirme maintenant, et c'est verifiable des le premier rendu.
   */
  it('reserve la place du bloc tant que le stockage n’est pas lu', () => {
    const { container } = render(
      <LocaleProvider locale="fr">
        <MyProgress seriesId="1396" seasons={SEASONS} series={SERIES} />
      </LocaleProvider>,
    );

    const attente = container.firstElementChild;
    expect(attente?.getAttribute('aria-hidden')).toBe('true');
    // La hauteur est celle du bloc replie : une valeur ronde ferait sauter la page.
    expect(attente?.className).toContain('h-[4.5rem]');
    // Et il ne promet rien — c'etait le propos du test d'origine, garde ici ou il a un sens.
    expect(attente?.textContent).toBe('');
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

  it('affiche le plan de rattrapage quand une date de retour est connue', async () => {
    // Prouve le **branchement**, que `catch-up.test.ts` ne peut pas voir. Trois modules
    // de ce projet ont dormi des semaines, ecrits et testes, appeles par rien.
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString();
    store(setPosition(EMPTY_JOURNAL, KEY, 2, 5));
    render(
      <LocaleProvider locale="fr">
        <MyProgress
          seriesId="1396"
          seasons={SEASONS}
          series={{ ...SERIES, nextEpisodeAt: soon }}
          episodeMinutes={45}
        />
      </LocaleProvider>,
    );
    // 15 épisodes restants sur 10 jours à 45 min : 68 min par jour, donc tenable.
    expect(await screen.findByText(/15 épisodes en 10 jours avant la suite/)).toBeDefined();
  });

  it('reconnait un rattrapage intenable au lieu de le presenter comme un plan', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    store(setPosition(EMPTY_JOURNAL, KEY, 1, 1));
    render(
      <LocaleProvider locale="fr">
        <MyProgress
          seriesId="1396"
          seasons={SEASONS}
          series={{ ...SERIES, nextEpisodeAt: soon }}
          episodeMinutes={50}
        />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/il faudrait/)).toBeDefined();
  });

  it('compte les visionnages acheves', async () => {
    // Prouve le branchement du rewatch. Le journal ne connaissait aucune notion de
    // revisionnage : la position etant un pointeur unique, recommencer ecrasait la
    // progression precedente et le fait etait perdu pour toujours.
    let journal = markCompleted(EMPTY_JOURNAL, KEY, new Date('2024-01-01T00:00:00Z'));
    journal = markCompleted(journal, KEY, new Date('2026-01-01T00:00:00Z'));
    store(journal);
    renderAt('fr');
    expect(await screen.findByText(/Vue 2 fois, en entier/)).toBeDefined();
  });

  it('reconnait un revisionnage en cours', async () => {
    let journal = markCompleted(EMPTY_JOURNAL, KEY, new Date('2024-01-01T00:00:00Z'));
    journal = setPosition(journal, KEY, 1, 2);
    store(journal);
    renderAt('fr');
    expect(await screen.findByText(/2e visionnage/)).toBeDefined();
  });

  it('parle la langue de la page', async () => {
    store(setPosition(EMPTY_JOURNAL, KEY, 2, 5));
    renderAt('en', 45);
    expect(await screen.findByText(/You have 15 episodes left/)).toBeDefined();
  });
});

describe('l’instantane memorise la forme de la serie, et une seule fois', () => {
  it('range les tailles de saisons, sans quoi /moi ne peut rien chiffrer', async () => {
    // `/moi` ne fait aucun appel : une position « S2E5 » y est incomptable sans savoir
    // combien d'episodes fait la saison 1. Ce que la page ne memorise pas ici manque
    // pour toujours a cette visite.
    store(setPosition(EMPTY_JOURNAL, KEY, 2, 5));
    renderAt('fr', 45);

    await waitFor(() => {
      const journal = parseJournal(window.localStorage.getItem(STORAGE_KEY));
      expect(journal.entries[KEY]?.snapshot?.seasonSizes).toEqual(SEASONS);
      expect(journal.entries[KEY]?.snapshot?.episodeMinutes).toBe(45);
    });
  });

  it('⚠️ n’ecrit pas en boucle', async () => {
    // `setSnapshot` reecrit **toujours**, avec un `cachedAt` neuf : un objet reconstruit
    // a chaque rendu provoquerait une ecriture par rendu, indefiniment. Le garde-fou est
    // la memoisation cote composant, plus la comparaison de contenu dans `isFresh` — et
    // ni l'une ni l'autre ne se voit en relisant le code.
    store(setPosition(EMPTY_JOURNAL, KEY, 2, 5));

    // Espionner le prototype et non l'instance : en jsdom, `localStorage` n'expose pas
    // ses methodes en propre, donc une reaffectation sur l'objet ne voit rien passer.
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    try {
      renderAt('fr', 45);
      await waitFor(() => {
        expect(
          parseJournal(window.localStorage.getItem(STORAGE_KEY)).entries[KEY]?.snapshot
            ?.seasonSizes,
        ).toBeDefined();
      });
      // Laisser passer plusieurs cycles : une boucle se verrait ici et nulle part avant.
      for (let i = 0; i < 5; i += 1) await Promise.resolve();

      const writes = spy.mock.calls.filter(([key]) => key === STORAGE_KEY).length;
      expect(writes).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});

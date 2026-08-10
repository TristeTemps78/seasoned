import { render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it } from 'vitest';
import { MyStats } from '@/app/components/MyStats';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import {
  EMPTY_JOURNAL,
  journalKey,
  markCompleted,
  serializeJournal,
  setPosition,
  setSnapshot,
  type Journal,
  type JournalSnapshot,
} from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';

/**
 * Le bilan personnel, verifie sur son **branchement** et sur son honnetete.
 *
 * Le calcul est deja couvert, purement, par `tally.test.ts`. Ce qui reste a prouver est ce
 * qu'aucun test pur ne peut voir : que le module est appele, que son silence est respecte,
 * et que la mention « au moins » accompagne bien le chiffre.
 *
 * ⚠️ **L'etat arrive de facon asynchrone.** `useJournal` lit le stockage apres le premier
 * rendu : au tout premier passage la bibliotheque n'a rien, donc `worthShowing` est faux et
 * le bilan est absent. Un `findByText` suivi d'une assertion resoudrait sur un rendu
 * intermediaire et ne prouverait rien — c'est exactement le defaut qui a laisse six tests
 * de placement verts alors que le code qu'ils surveillaient etait supprime. Toute
 * verification passe donc par `waitFor` sur la condition **finale**, et l'absence se
 * verifie apres avoir attendu qu'autre chose soit apparu.
 */

const BB = journalKey('1396');

/** Cinquante episodes de quarante minutes : trente-trois heures pour un passage. */
const SHAPE: Omit<JournalSnapshot, 'cachedAt'> = {
  title: 'Breaking Bad',
  episodeMinutes: 40,
  seasonSizes: Array.from({ length: 5 }, (_, i) => ({
    seasonNumber: i + 1,
    episodeCount: 10,
  })),
};

function store(journal: Journal): void {
  window.localStorage.setItem(STORAGE_KEY, serializeJournal(journal));
}

/**
 * ⚠️ Rend `MyStats` et non `Library` : le bilan a quitte la bibliotheque pour la face
 * « Mon bilan » (2026-08-03). Ces tests sont tombes au demenagement, ce qui est
 * exactement leur role — ils surveillent un branchement, pas une mise en page.
 */
function renderLibrary(locale: 'fr' | 'en' = 'fr') {
  render(
    <LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
      <MyStats />
    </LocaleProvider>,
  );
}

/** Une serie vue en entier, avec sa forme memorisee. */
function watched(journal: Journal, id: string, shape = SHAPE): Journal {
  const key = journalKey(id);
  let next = setPosition(journal, key, 5, 10, new Date('2026-07-01T10:00:00.000Z'));
  next = markCompleted(next, key, new Date('2026-07-02T10:00:00.000Z'));
  return setSnapshot(next, key, shape);
}

describe('le bilan personnel, branche sur le journal', () => {
  it('annonce le temps passe, et jamais sans « au moins »', async () => {
    store(watched(EMPTY_JOURNAL, '1396'));
    renderLibrary();

    // La condition finale elle-meme : le chiffre, et la reserve qui va avec.
    await waitFor(() => {
      expect(screen.getByText(/Au moins .*33 heures/)).toBeDefined();
    });
    expect(screen.getByRole('region', { name: 'Mon temps passé' })).toBeDefined();
  });

  it('nomme la serie qui pese le plus, et compte ses passages', async () => {
    let j = watched(EMPTY_JOURNAL, '1396');
    j = markCompleted(j, BB, new Date('2026-07-20T10:00:00.000Z'));
    j = watched(j, '1405', { ...SHAPE, title: 'Dexter', episodeMinutes: 10 });
    store(j);
    renderLibrary();

    await waitFor(() => {
      expect(screen.getByText(/Breaking Bad :.*vue 2 fois/)).toBeDefined();
    });
  });

  it('dit ce qu’il n’a pas pu compter', async () => {
    // Deux series vues, une seule chiffrable : la couverture est de 50 %, donc le bilan
    // parle — mais il doit avouer la seconde.
    let j = watched(EMPTY_JOURNAL, '1396');
    const other = journalKey('1405');
    j = setPosition(j, other, 3, 7, new Date('2026-07-01T10:00:00.000Z'));
    j = setSnapshot(j, other, { title: 'Dexter' });
    store(j);
    renderLibrary();

    await waitFor(() => {
      expect(screen.getByText(/1 série suivie n’a pas pu être comptée/)).toBeDefined();
    });
  });

  it('se tait sous le seuil de couverture', async () => {
    // Une serie chiffrable sur trois vues. Le chiffre existe, son affichage est refuse.
    let j = watched(EMPTY_JOURNAL, '1396');
    for (const id of ['1405', '1402']) {
      const key = journalKey(id);
      j = setPosition(j, key, 3, 7, new Date('2026-07-01T10:00:00.000Z'));
      j = setSnapshot(j, key, { title: `Serie ${id}` });
    }
    store(j);
    renderLibrary();

    // ⚠️ Attendre que l'ecran soit **charge** avant de conclure a une absence : sans
    // cela le test passerait sur le rendu vide, quel que soit le code du bilan. Le titre
    // de la face est present des que le journal est lu.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mon bilan' })).toBeDefined();
    });
    expect(screen.queryByRole('region', { name: 'Mon temps passé' })).toBeNull();
  });

  it('se tait quand rien n’a ete regarde', async () => {
    // Une serie seulement souhaitee : ne pas savoir la chiffrer n'est pas un manque.
    store(setSnapshot(setPosition(EMPTY_JOURNAL, BB, 1, 1), BB, SHAPE));
    renderLibrary();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mon bilan' })).toBeDefined();
    });
    // Quarante minutes : sous le seuil d'une heure.
    expect(screen.queryByRole('region', { name: 'Mon temps passé' })).toBeNull();
  });

  it('parle anglais sur une page anglaise', async () => {
    store(watched(EMPTY_JOURNAL, '1396'));
    renderLibrary('en');

    await waitFor(() => {
      expect(screen.getByText(/At least .*33 hours/)).toBeDefined();
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { WantButton } from '@/app/components/WantButton';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { EMPTY_JOURNAL, parseJournal, serializeJournal, setWanted } from '@/src/domain/journal';
import { STORAGE_KEY } from '@/src/journal/local';
import type { Journal } from '@/src/domain/journal';

/**
 * « Je veux la voir », depuis une affiche du catalogue.
 *
 * ## Ce que ce fichier garde, et pourquoi ce n'est pas « ca coche »
 *
 * Le geste ecrit **deux** choses, et la seconde est facile a oublier parce que rien ne la
 * reclame au moment ou on l'ecrit : l'entree (`setWanted`) et l'instantane (`rememberSnapshot`).
 * Sans le second, la serie arrive dans `/moi` sous le repli « Serie suivie », **sans titre ni
 * affiche** — un repli qui existe pour un instantane *expire*, pas pour une serie qu'on vient
 * d'ajouter. Le defaut serait invisible ici et visible deux pages plus loin.
 *
 * ⚠️ Et l'ordre compte : `rememberSnapshot` n'ecrit que si l'entree existe deja — c'est ce
 * qui l'empeche de constituer une base de metadonnees en passant sur une page. Inverser les
 * deux appels rendrait le titre silencieusement absent.
 */

const KEY = 'tmdb:108978';
const SERIES = { providerId: '108978', title: 'Reacher', posterPath: '/reacher.jpg' } as const;

function store(journal: Journal): void {
  window.localStorage.setItem(STORAGE_KEY, serializeJournal(journal));
}

/**
 * ⚠️ `parseJournal` rend **le journal**, pas un resultat enveloppe : `.journal` dessus vaut
 * `undefined`, donc une premiere version de cet utilitaire retombait silencieusement sur
 * `EMPTY_JOURNAL` et faisait echouer le test sur une ecriture pourtant correcte. C'est
 * `tryParseJournal` qui distingue « vide » de « illisible ».
 */
function read(): Journal {
  return parseJournal(window.localStorage.getItem(STORAGE_KEY));
}

function renderButton() {
  return render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <WantButton {...SERIES} />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('ajouter depuis le catalogue', () => {
  it('🔴 ecrit le titre et l affiche avec l envie', async () => {
    // Sans eux, `/moi` afficherait « Serie suivie » sur une vignette vide.
    store(EMPTY_JOURNAL);
    renderButton();

    const button = await screen.findByRole('button', { name: 'Je veux voir Reacher' });
    fireEvent.click(button);

    await waitFor(() => {
      const entry = read().entries[KEY];
      expect(entry?.wanted?.at).toBeDefined();
      expect(entry?.snapshot?.title).toBe('Reacher');
      expect(entry?.snapshot?.posterPath).toBe('/reacher.jpg');
    });
  });

  it('le bouton dit l etat, et nomme la serie', async () => {
    // Sur une rangee de douze vignettes, douze boutons qui s'annoncent « Je veux la voir »
    // sont douze fois le meme mot sans dire de quoi ils parlent.
    store(setWanted(EMPTY_JOURNAL, KEY, true));
    renderButton();

    const button = await screen.findByRole('button', { name: 'Retirer Reacher de mes envies' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('retire ce qu il a ajoute', async () => {
    store(setWanted(EMPTY_JOURNAL, KEY, true));
    renderButton();

    fireEvent.click(await screen.findByRole('button', { name: 'Retirer Reacher de mes envies' }));
    await waitFor(() => expect(read().entries[KEY]?.wanted).toBeUndefined());
  });
});

describe('🔴 rien tant que le journal n est pas lu', () => {
  it('ne montre pas « je veux la voir » sur une serie deja voulue', () => {
    // Une demi-seconde de mauvais libelle suffit pour qu'on clique et qu'on retire ce qu'on
    // voulait ajouter. Le premier rendu client est aussi celui du HTML servi — c'est la
    // condition pour que ces pages restent statiques.
    store(setWanted(EMPTY_JOURNAL, KEY, true));
    renderButton();

    expect(screen.queryByRole('button')).toBeNull();
  });
});

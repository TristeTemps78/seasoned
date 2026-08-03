import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setProvider } from '@/lib/catalog';
import { SeriesOrderings } from '@/app/components/SeriesOrderings';
import type { CatalogProvider, EpisodeGrouping } from '@/src/catalog/provider';
import { OrderingNotice } from '@/app/components/OrderingNotice';
import { findDivergentOrderings, type CandidateOrdering } from '@/src/domain/ordering';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

/**
 * Le bandeau des decoupages concurrents, teste sur ce que le calcul ne voit pas :
 * **qu'il est branche, et ce qu'il dit**.
 *
 * `ordering.test.ts` couvre deja le calcul, purement. Ce qui reste a prouver est
 * exactement ce qui a manque a `episodeMinutes` — livre, correct, et **jamais ecrit**.
 * Un module qui existe n'est pas un module qui est appele.
 *
 * Composant **serveur** : pas de `LocaleProvider`, la langue est un parametre. C'est le
 * signe qu'il ne coute aucun JavaScript au navigateur.
 */

/** Capture reelle de *Money Heist* (71446), 2026-08-03. */
const MONEY_HEIST_DEFAULT = { seasonCount: 3, episodeCount: 41 };
const MONEY_HEIST_GROUPS: readonly CandidateOrdering[] = [
  { id: 'a', name: 'Original Parts', kind: 4, groupCount: 5, episodeCount: 41 },
  { id: 'b', name: 'Parts (edited version)', kind: 4, groupCount: 5, episodeCount: 48 },
  { id: 'c', name: 'Seasons (edited version)', kind: 4, groupCount: 3, episodeCount: 48 },
  { id: 'd', name: 'Italian Parts', kind: 4, groupCount: 5, episodeCount: 48 },
];

function renderFor(
  shape: { seasonCount: number; episodeCount: number },
  candidates: readonly CandidateOrdering[],
  locale: Locale = DEFAULT_LOCALE,
) {
  const notice = findDivergentOrderings(shape, candidates);
  return render(
    <OrderingNotice
      notice={notice}
      seasonCount={shape.seasonCount}
      episodeCount={shape.episodeCount}
      locale={locale}
    />,
  );
}

describe('OrderingNotice', () => {
  it('annonce la convention suivie, avec les chiffres de la page', () => {
    // Le bandeau ne dit pas « erreur » : il dit lesquels de nos chiffres suivent quoi.
    // Nos chiffres ne sont pas faux — ce qui serait faux est de laisser croire qu'il
    // n'existe qu'un decoupage.
    renderFor(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS);
    expect(screen.getByText(/3 seasons · 41 episodes/)).toBeTruthy();
  });

  it('nomme les decoupages concurrents avec leurs chiffres', () => {
    // 🔴 Le cas qui justifie la feature : 5 parts / 48 episodes sur Netflix contre
    // 3 saisons / 41 chez nous. Quelqu'un qui dit « saison 4 » designe une saison qui
    // n'existe pas dans nos calculs.
    renderFor(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS);
    expect(screen.getByText(/Parts \(edited version\).*5 seasons, 48 episodes/)).toBeTruthy();
  });

  it('avertit que les numeros de saison ne correspondront pas', () => {
    renderFor(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS);
    expect(screen.getByText(/season numbers will not match/i)).toBeTruthy();
  });

  it('compte ceux qu’il ne nomme pas, sans mentir', () => {
    // Quatre divergent, trois sont nommes : le quatrieme doit etre annonce. Sur
    // *One Piece* il y en a quinze — un bandeau qui les listerait tous serait illisible,
    // et un bandeau qui les tairait ferait croire a trois.
    renderFor(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS);
    expect(screen.getByText(/and 1 other cut/i)).toBeTruthy();
  });

  it('ne parle pas d’autres decoupages quand il les nomme tous', () => {
    renderFor(MONEY_HEIST_DEFAULT, [MONEY_HEIST_GROUPS[1]!]);
    // ⚠️ Ancre sur « and N other » et non sur « other cut » : la mise en garde contient
    // deja « an**other cut** », et un motif trop large echouait ici — le test avait tort,
    // pas le composant.
    expect(screen.queryByText(/and \d+ other/i)).toBeNull();
  });

  it('🔴 ne rend RIEN quand rien ne diverge', () => {
    // Le cas courant, et le plus important : verifie sur six series reelles, trois se
    // taisent. Un bandeau affiche partout apprend a ne plus lire les bandeaux.
    const { container } = renderFor({ seasonCount: 8, episodeCount: 73 }, [
      // *Game of Thrones* : son unique groupe est l'ordre de diffusion, avec les speciaux.
      { id: 'got', name: 'Aired Order', kind: 1, groupCount: 9, episodeCount: 102 },
    ]);
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien non plus sans aucun decoupage connu', () => {
    const { container } = renderFor(MONEY_HEIST_DEFAULT, []);
    expect(container.firstChild).toBeNull();
  });

  it('parle francais sur une page francaise', () => {
    // Sixieme occurrence de la forme d'echec du projet si on l'oublie : un composant
    // anglais sur une page annoncee `lang="fr"`. Le test `no-hardcoded-strings` verifie
    // qu'aucune chaine n'est en dur ; celui-ci verifie que la bonne langue sort.
    renderFor(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS, 'fr');
    expect(screen.getByText(/Ce découpage n’est pas le seul/)).toBeTruthy();
    expect(screen.getByText(/3 saisons · 41 épisodes/)).toBeTruthy();
    expect(screen.getByText(/et 1 autre découpage/)).toBeTruthy();
  });

  it('accorde le singulier — « 1 saison », pas « 1 saisons »', () => {
    // Le desaccord commence a zero et se voit d'abord au singulier. `Intl.PluralRules`
    // est ce qui evite un ternaire ecrit par un francophone (`lib/i18n.ts`).
    renderFor({ seasonCount: 1, episodeCount: 6 }, [
      { id: 'x', name: 'Mini-serie recoupee', kind: 3, groupCount: 1, episodeCount: 12 },
    ], 'fr');
    expect(screen.getByText(/1 saison ·/)).toBeTruthy();
    expect(screen.queryByText(/1 saisons/)).toBeNull();
  });

  it('rend le nom du decoupage comme du TEXTE, jamais comme du balisage', () => {
    // Les noms viennent des contributeurs TMDB : c'est une entree non fiable, la meme
    // qui avait produit la XSS du JSON-LD. React echappe par defaut — ce test le fige,
    // pour qu'un futur `dangerouslySetInnerHTML` ne passe pas inapercu.
    const { container } = renderFor(MONEY_HEIST_DEFAULT, [
      {
        id: 'x',
        name: '<img src=x onerror=alert(1)>',
        kind: 4,
        groupCount: 5,
        episodeCount: 48,
      },
    ]);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeTruthy();
  });
});

/**
 * 🔴 La chaîne entière — fournisseur → cache → domaine → affichage.
 *
 * Les tests au-dessus prouvent que le composant sait afficher. `ordering.test.ts` prouve
 * que le calcul est juste. **Aucun des deux ne prouve que le fil existe** — et c'est
 * précisément ce qui manquait à `episodeMinutes`, livré correct et jamais écrit.
 *
 * `SeriesOrderings` est asynchrone mais ne rend que du synchrone : `render(await ...)`
 * traverse donc tout le chemin en une ligne.
 */
describe('SeriesOrderings — le fil du fournisseur jusqu’à l’écran', () => {
  /** Un fournisseur qui ne sait répondre qu'aux découpages. */
  function providerWith(groups: readonly EpisodeGrouping[]): CatalogProvider {
    return {
      name: 'fake',
      async search() { return []; },
      async getSeries() { throw new Error('non utilise'); },
      async getSeason() { throw new Error('non utilise'); },
      async discover() { return []; },
      async seriesByCreator() { return []; },
      async watchOptions() { return []; },
      async episodeGroups() { return groups; },
    } as unknown as CatalogProvider;
  }

  afterEach(() => {
    setProvider(undefined);
  });

  it('va chercher les découpages et les affiche', async () => {
    // Capture réelle de Money Heist, telle que TMDB la rend.
    setProvider(
      providerWith([
        { id: 'b', name: 'Parts (edited version)', kind: 4, groupCount: 5, episodeCount: 48 },
      ]),
    );

    render(await SeriesOrderings({ id: '71446', seasonCount: 3, episodeCount: 41, locale: 'fr' }));

    expect(screen.getByText(/Ce découpage n’est pas le seul/)).toBeTruthy();
    expect(screen.getByText(/Parts \(edited version\).*5 saisons, 48 épisodes/)).toBeTruthy();
  });

  it('ne rend rien quand le fournisseur ne connaît aucun découpage', async () => {
    setProvider(providerWith([]));
    const { container } = render(
      await SeriesOrderings({ id: '1402', seasonCount: 11, episodeCount: 177, locale: 'fr' }),
    );
    expect(container.firstChild).toBeNull();
  });
});

/**
 * Le dernier maillon que même le test ci-dessus ne voit pas : que **la page** appelle
 * `SeriesOrderings`.
 *
 * Lire la source est un procédé déjà employé dans ce dépôt (`no-hardcoded-strings`,
 * `no-journal-on-server`) et c'est le seul qui atteigne ce maillon-là sans monter un rendu
 * de page complet. C'est fruste, et ça vaut mieux que rien : sans lui, supprimer une ligne
 * de la page laisserait 650 tests verts.
 */
describe('la page série câble bien le bandeau', () => {
  it('rend SeriesOrderings', () => {
    const source = readFileSync('app/(site)/serie/[id]/page.tsx', 'utf8');
    expect(source).toContain("from '@/app/components/SeriesOrderings'");
    expect(source).toMatch(/<SeriesOrderings\b/);
  });

  it('et la version française hérite de la même vue', () => {
    // Elle réexporte `SeriesView` au lieu d'en tenir une copie : une seule page à câbler,
    // donc pas de langue oubliée. C'est la décision de `app/(fr)/fr/serie/[id]/page.tsx`,
    // et ce test la fige.
    const fr = readFileSync('app/(fr)/fr/serie/[id]/page.tsx', 'utf8');
    expect(fr).toContain("SeriesView");
    expect(fr.length).toBeLessThan(2_000);
  });
});

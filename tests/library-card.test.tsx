import { render, screen } from '@testing-library/react';
import { DICTIONARIES } from '../lib/i18n';
import { describe, expect, it } from 'vitest';
import { LibraryCard } from '@/app/components/LibraryCard';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { EMPTY_JOURNAL, journalKey, setPosition } from '@/src/domain/journal';
import type { JournalEntry, JournalSnapshot } from '@/src/domain/journal';
import type { LibraryItem } from '@/src/domain/library';
import type { Locale } from '@/lib/i18n';

/**
 * La vignette de la bibliotheque.
 *
 * Un seul sujet ici, et c'est celui qui a ete **constate au navigateur** : la vignette
 * affichait un statut fige dans la langue du geste, pas dans celle de la page.
 */

const BB = journalKey('1396');
const NOW = new Date('2026-08-03T12:00:00Z');

function entryOf(): JournalEntry {
  return setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW).entries[BB]!;
}

function itemWith(snapshot: JournalSnapshot): LibraryItem {
  // ⚠️ Sans position, la vignette affiche « S3E7 » et jamais le statut : le test
  // porterait alors sur une branche qui n'est pas celle qu'on veut garder.
  const entry: JournalEntry = { ...entryOf() };
  delete (entry as { position?: unknown }).position;
  return { key: BB, entry, snapshot, touchedAt: NOW.getTime() };
}

function renderIn(locale: Locale, snapshot: JournalSnapshot) {
  return render(
    <LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
      <LibraryCard item={itemWith(snapshot)} />
    </LocaleProvider>,
  );
}

describe('le statut de la vignette suit la langue de la PAGE', () => {
  const FRESH = { title: 'Breaking Bad', cachedAt: NOW.toISOString() };

  it('🔴 la bibliotheque anglaise n affiche pas « Entre deux saisons »', () => {
    // Le defaut exact, vu sur `/moi` en anglais : `statusLabel` etait memorise **deja
    // traduit**, avec la langue de la page ou le geste avait ete fait. La bibliotheque le
    // reaffichait tel quel. Invisible au typage — c'est une chaine des deux cotes.
    renderIn('en', {
      ...FRESH,
      status: 'between_seasons',
      statusLabel: 'Entre deux saisons',
    });

    expect(screen.getByText('Between seasons')).toBeDefined();
    expect(screen.queryByText('Entre deux saisons')).toBeNull();
  });

  it('et symetriquement, la bibliotheque francaise ne sert pas l anglais', () => {
    renderIn('fr', { ...FRESH, status: 'airing', statusLabel: 'Airing' });

    expect(screen.getByText('En diffusion')).toBeDefined();
    expect(screen.queryByText('Airing')).toBeNull();
  });

  it('⚠️ un journal ecrit AVANT `status` garde son libelle plutot que rien', () => {
    // « On migre ce qu'on controle » : ces journaux sont chez les gens, et on ne peut pas
    // les reecrire. Perdre le statut serait une regression pour eux — le repli doit tenir.
    renderIn('en', { ...FRESH, statusLabel: 'Entre deux saisons' });

    expect(screen.getByText('Entre deux saisons')).toBeDefined();
  });

  it('un instantane sans aucun statut ne fait pas disparaitre la vignette', () => {
    // Regle 4 : un journal ecrit par une version plus recente, qui connaitrait un
    // huitieme statut, se relit sans ce champ. On retombe sur « a voir », pas sur du vide
    // — perdre une vignette est un defaut d'affichage, perdre une serie suivie serait une
    // perte de donnee.
    renderIn('en', FRESH);

    expect(screen.getByText('Breaking Bad')).toBeDefined();
    expect(screen.getByText('to watch')).toBeDefined();
  });
});

/**
 * Le geste depuis la grille — voir `LibraryCard` pour ce qu'il repare.
 *
 * ⚠️ **La geometrie ne se garde pas ici** : elle a ete mesuree au navigateur (109 px de
 * tuile en 375 px, 81 px utiles, d'ou la coche et la coordonnee plutot que la phrase). Ce
 * qui se garde est ce qui se lit dans le rendu — **quand** le bouton existe, et le fait que
 * la phrase entiere reste son nom accessible.
 */
function itemAt(
  season: number,
  episode: number,
  extra: Partial<LibraryItem> = {},
): LibraryItem {
  const entry = setPosition(EMPTY_JOURNAL, BB, season, episode, NOW).entries[BB]!;
  return {
    key: BB,
    entry,
    snapshot: {
      title: 'Breaking Bad',
      cachedAt: NOW.toISOString(),
      seasonSizes: [
        { seasonNumber: 1, episodeCount: 7 },
        { seasonNumber: 2, episodeCount: 13 },
      ],
    },
    touchedAt: NOW.getTime(),
    ...extra,
  };
}

function renderItem(item: LibraryItem, locale: Locale = 'fr') {
  return render(
    <LocaleProvider locale={locale} messages={DICTIONARIES[locale]}>
      <LibraryCard item={item} />
    </LocaleProvider>,
  );
}

describe('avancer sans ouvrir la fiche', () => {
  it('🔴 la grille porte enfin un geste', () => {
    // Mesure au navigateur le 2026-08-16 : `/fr/moi` ne contenait **aucun** bouton. La
    // collection entiere n'etait qu'une table des matieres.
    renderItem(itemAt(1, 3));
    expect(screen.getByRole('button', { name: 'J’ai vu S1E4' })).toBeDefined();
  });

  it('bascule sur la saison suivante au dernier episode', () => {
    renderItem(itemAt(1, 7));
    expect(screen.getByRole('button', { name: 'J’ai vu S2E1' })).toBeDefined();
  });

  it('la phrase entiere reste le nom accessible, la coordonnee seule est a l ecran', () => {
    // Ce qui se raccourcit est le dessin, jamais ce que le bouton annonce a qui ne voit pas.
    renderItem(itemAt(2, 6));
    const button = screen.getByRole('button', { name: 'J’ai vu S2E7' });
    expect(button.textContent).toBe('S2E7');
  });

  it('🔴 rien sur une serie terminee ou abandonnee', () => {
    // La vignette contredirait la section qui la contient — le defaut exact que le repli
    // « a voir » avait deja produit ici, et qui « fait douter de tout le reste ».
    for (const kind of ['completed', 'abandoned'] as const) {
      const base = itemAt(1, 3);
      const { unmount } = renderItem({
        ...base,
        entry: { ...base.entry, decision: { kind, at: NOW.toISOString() } },
      });
      expect(screen.queryByRole('button', { name: /J’ai vu/ })).toBeNull();
      unmount();
    }
  });

  it('rien sans decoupage connu — un bouton qui devine se trompe', () => {
    const base = itemAt(1, 3);
    renderItem({ ...base, snapshot: { title: 'Breaking Bad', cachedAt: NOW.toISOString() } });
    expect(screen.queryByRole('button', { name: /J’ai vu/ })).toBeNull();
  });

  it('rien sur une serie qu on n a pas commencee', () => {
    // « Ce que je voulais voir » n'a pas de position : avancer n'a alors aucun sens, et
    // c'est cette condition — et non une prop passee par la rangee — qui l'exclut.
    const base = itemAt(1, 3);
    const entry = { ...base.entry };
    delete (entry as { position?: unknown }).position;
    renderItem({ ...base, entry });
    expect(screen.queryByRole('button', { name: /J’ai vu/ })).toBeNull();
  });
});

describe('le coeur, depuis la grille', () => {
  it('🔴 aimer une serie terminee n efface plus la marque « terminee »', () => {
    // Le defaut etait silencieux : les trois marques se disputaient un seul coin, en
    // cascade — aimee, sinon terminee, sinon abandonnee. Un gout et un fait ne s'excluent
    // pas, et personne ne remarque une information qui disparait.
    const base = itemAt(1, 3);
    renderItem({
      ...base,
      entry: {
        ...base.entry,
        decision: { kind: 'completed', at: NOW.toISOString() },
        liked: { at: NOW.toISOString() },
      },
    });

    // L'etat : la coche, en lecture seule, dans son coin.
    expect(document.querySelector('.poster-badge-tl')).not.toBeNull();
    // L'action : le coeur, enfonce, dans l'autre.
    const heart = screen.getByRole('button', { name: 'Ne plus aimer Breaking Bad' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });

  it('le bouton dit ce qu il fera, et nomme la serie', () => {
    // Sur une grille, quarante boutons qui s'annoncent « J'aime » sont quarante fois le
    // meme mot sans dire de quoi ils parlent.
    renderItem(itemAt(1, 3));
    const heart = screen.getByRole('button', { name: 'J’aime Breaking Bad' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
  });
});

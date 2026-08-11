import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';
import { Icon } from '@/app/components/Icon';

/**
 * Formulaire de recherche.
 *
 * Un `<form method="GET">` sans une ligne de JavaScript : la requete devient une URL,
 * donc une page indexable et partageable. C'est le canal d'acquisition n°1
 * et accessoirement la solution la moins chere.
 *
 * ⚠️ **L'action porte la langue.** Elle pointait `/recherche` en dur : chercher depuis
 * une page francaise renvoyait donc vers la page anglaise. Le francais avait une adresse
 * et aucun chemin n'y restait — c'est la suite exacte de la lecon de la bascule.
 */
export function SearchForm({ defaultValue = '', autoFocus = false, locale = DEFAULT_LOCALE }: {
  readonly defaultValue?: string;
  readonly autoFocus?: boolean;
  readonly locale?: Locale;
}) {
  return (
    // Le champ et son bouton forment **un seul objet** : deux rectangles separes par un
    // interstice se lisent comme deux controles sans rapport, et c'est le geste le plus
    // frequent du produit.
    <form
      action={pathIn('/recherche', locale)}
      method="GET"
      className="search-shell flex items-stretch gap-0 overflow-hidden panel bg-(--color-surface)/70"
    >
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={t(locale, 'search.placeholder')}
        aria-label={t(locale, 'search.submit')}
        className="search-input min-w-0 flex-1 bg-transparent px-4 py-3 text-inherit placeholder:text-(--color-muted) focus:outline-none"
      />
      <button
        type="submit"
        className="search-submit flex items-center gap-2 border-l border-(--color-edge) px-5 text-sm font-semibold text-(--color-volt) transition-colors hover:bg-(--color-volt) hover:text-(--color-ink)"
      >
        <Icon name="search" />
        {t(locale, 'search.submit')}
      </button>
    </form>
  );
}

import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';

/**
 * Formulaire de recherche.
 *
 * Un `<form method="GET">` sans une ligne de JavaScript : la requete devient une URL,
 * donc une page indexable et partageable. C'est le canal d'acquisition n°1
 * (`ROADMAP.md` §0.2) et accessoirement la solution la moins chere.
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
    <form action={pathIn('/recherche', locale)} method="GET" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={t(locale, 'search.placeholder')}
        aria-label={t(locale, 'search.submit')}
        className="flex-1 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-2.5 placeholder:text-(--color-muted) focus:outline-none focus:ring-2 focus:ring-(--color-live)/50"
      />
      <button
        type="submit"
        className="rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-2.5 text-sm font-medium hover:border-(--color-muted) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live)"
      >
        {t(locale, 'search.submit')}
      </button>
    </form>
  );
}

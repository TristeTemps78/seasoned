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
export function SearchForm({
  defaultValue = '',
  autoFocus = false,
  locale = DEFAULT_LOCALE,
  compact = false,
}: {
  readonly defaultValue?: string;
  readonly autoFocus?: boolean;
  readonly locale?: Locale;
  /**
   * La forme de l'en-tete — le meme formulaire, dans une ligne de 51 px.
   *
   * ⚠️ **Une variante et non un second composant.** Le second aurait diverge : c'est
   * exactement ce que `Lists` refuse de faire entre une liste vue du dedans et du dehors, et
   * ce qui a fait diverger `LibraryCard` de `SeriesCard` jusqu'a ce que l'un des deux montre
   * trois rectangles gris. Ici l'action, le nom du champ (`q`), la langue portee par l'action
   * et la micro-interaction d'inversion sont **les memes objets** — seules la hauteur et
   * l'etiquette du bouton changent.
   *
   * Le mot « Chercher » disparait du bouton : dans une barre a 311 px de marge, il coutait
   * 90 px pour redire ce que la loupe dit deja a cote d'un champ. Il reste le nom
   * accessible du bouton.
   */
  readonly compact?: boolean;
}) {
  return (
    // Le champ et son bouton forment **un seul objet** : deux rectangles separes par un
    // interstice se lisent comme deux controles sans rapport, et c'est le geste le plus
    // frequent du produit.
    <form
      action={pathIn('/recherche', locale)}
      method="GET"
      // ⚠️ `min-h-11` sur la forme compacte, mesure a l'ecran : sans elle le champ sortait a
      // **34 px** dans une barre ou l'onglet, le compte et les menus font tous 44. Le depot a
      // unifie les cinq `<select>` a 44 px le 2026-08-15 pour cette raison exacte, et un champ
      // de saisie est plus difficile a viser qu'un menu, pas moins.
      className={`search-shell flex items-stretch gap-0 overflow-hidden panel bg-(--color-surface)/70 ${
        compact ? 'min-h-11' : ''
      }`}
    >
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={t(locale, 'search.placeholder')}
        aria-label={t(locale, 'search.submit')}
        className={`search-input min-w-0 flex-1 bg-transparent text-inherit placeholder:text-(--color-muted) focus:outline-none ${
          compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-3'
        }`}
      />
      <button
        type="submit"
        className={`search-submit flex items-center gap-2 border-l border-(--color-edge) text-sm font-semibold text-(--color-volt) transition-colors hover:bg-(--color-volt) hover:text-(--color-ink) ${
          compact ? 'px-3' : 'px-5'
        }`}
      >
        <Icon name="search" />
        {compact ? (
          <span className="sr-only">{t(locale, 'search.submit')}</span>
        ) : (
          t(locale, 'search.submit')
        )}
      </button>
    </form>
  );
}

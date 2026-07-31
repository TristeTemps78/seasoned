/**
 * Formulaire de recherche.
 *
 * Un `<form method="GET">` sans une ligne de JavaScript : la requete devient une URL,
 * donc une page indexable et partageable. C'est le canal d'acquisition n°1
 * (`ROADMAP.md` §0.2) et accessoirement la solution la moins chere.
 */
export function SearchForm({ defaultValue = '', autoFocus = false }: {
  readonly defaultValue?: string;
  readonly autoFocus?: boolean;
}) {
  return (
    <form action="/recherche" method="GET" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Chercher une série…"
        aria-label="Chercher une série"
        className="flex-1 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-2.5 placeholder:text-(--color-muted) focus:outline-none focus:ring-2 focus:ring-(--color-live)/50"
      />
      <button
        type="submit"
        className="rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-2.5 text-sm font-medium hover:border-(--color-muted) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live)"
      >
        Chercher
      </button>
    </form>
  );
}

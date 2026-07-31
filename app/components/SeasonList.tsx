import type { NormalizedSeasons, SeasonWarningCode } from '@/src/domain/seasons';
import { formatDate } from '@/lib/format';

/**
 * Avertissements qui ont une valeur **pour un visiteur**.
 *
 * `normalizeSeasons` en produit six ; les autres (`empty_season`,
 * `non_contiguous_numbering`) sont du diagnostic d'integration et n'ont rien a faire
 * sous les yeux de quelqu'un qui veut savoir s'il regarde la serie.
 */
const VISIBLE_WARNINGS: ReadonlySet<SeasonWarningCode> = new Set([
  'possible_split_season',
  'unaired_season',
  'single_season',
]);

const WARNING_TEXT: Readonly<Record<string, (seasons: readonly number[]) => string>> = {
  possible_split_season: (s) =>
    `Saison${s.length > 1 ? 's' : ''} ${s.join(' et ')} probablement diffusée${s.length > 1 ? 's' : ''} en deux parties — le découpage du catalogue peut différer de celui du diffuseur.`,
  unaired_season: (s) =>
    `Saison${s.length > 1 ? 's' : ''} ${s.join(', ')} annoncée${s.length > 1 ? 's' : ''} mais pas encore diffusée${s.length > 1 ? 's' : ''}.`,
  single_season: () => 'Mini-série : une seule saison, et c’est toute l’histoire.',
};

export function SeasonList({ seasons }: { readonly seasons: NormalizedSeasons }) {
  const notes = seasons.warnings.filter((w) => VISIBLE_WARNINGS.has(w.code));

  return (
    <section className="space-y-4" aria-label="Saisons">
      <h2 className="text-lg font-semibold tracking-tight">Saisons</h2>

      {notes.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-(--color-warn)">
          {notes.map((w) => {
            const render = WARNING_TEXT[w.code];
            return (
              <li key={w.code}>
                {render !== undefined ? render(w.seasonNumbers) : w.detail}
              </li>
            );
          })}
        </ul>
      ) : null}

      {seasons.rateable.length === 0 ? (
        <p className="text-(--color-muted)">Rien n’a encore été diffusé.</p>
      ) : (
        <ol className="divide-y divide-(--color-edge) rounded-lg border border-(--color-edge) bg-(--color-surface)">
          {seasons.rateable.map((season) => (
            <li
              key={season.ref.seasonNumber}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="font-medium">Saison {season.ref.seasonNumber}</span>
              <span className="text-sm text-(--color-muted)">
                {season.episodeCount} épisode{season.episodeCount > 1 ? 's' : ''}
                {season.airedFrom !== undefined ? ` · ${formatDate(season.airedFrom)}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}

      {seasons.specials.length > 0 ? (
        <p className="text-sm text-(--color-muted)">
          Épisodes spéciaux disponibles, hors de la continuité principale.
        </p>
      ) : null}
    </section>
  );
}

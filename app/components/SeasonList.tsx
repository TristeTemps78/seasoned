import type { NormalizedSeasons, SeasonWarningCode } from '@/src/domain/seasons';
import { Poster } from '@/app/components/Poster';
import { formatDate } from '@/lib/format';
import { DEFAULT_LOCALE, localeTag, t, tn, type Locale } from '@/lib/i18n';

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

/**
 * « 2 et 3 » en francais, « 2 and 3 » en anglais, et autre chose ailleurs.
 *
 * `Intl.ListFormat` plutot qu'un `join(' et ')` : le separateur d'enumeration est une
 * regle de langue, et le coder en dur est la meme faute que la virgule decimale — un
 * francais qui affleure sur une page anglaise.
 */
function joinList(values: readonly (string | number)[], locale: Locale): string {
  const parts = values.map(String);
  try {
    return new Intl.ListFormat(localeTag(locale), {
      style: 'long',
      type: 'conjunction',
    }).format(parts);
  } catch {
    return parts.join(', ');
  }
}

export function SeasonList({ seasons, locale = DEFAULT_LOCALE }: {
  readonly seasons: NormalizedSeasons;
  readonly locale?: Locale;
}) {
  const notes = seasons.warnings.filter((w) => VISIBLE_WARNINGS.has(w.code));

  const describe = (code: SeasonWarningCode, numbers: readonly number[]): string | undefined => {
    const list = joinList(numbers, locale);
    switch (code) {
      case 'possible_split_season':
        return tn(locale, 'seasons.warn.split', numbers.length, { list });
      case 'unaired_season':
        return tn(locale, 'seasons.warn.unaired', numbers.length, { list });
      case 'single_season':
        return t(locale, 'seasons.warn.single');
      default:
        return undefined;
    }
  };

  return (
    <section className="space-y-4" aria-label={t(locale, 'seasons.title')}>
      <h2 className="section-heading">{t(locale, 'seasons.title')}</h2>

      {notes.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-(--color-warn)">
          {notes.map((w) => (
            <li key={w.code}>{describe(w.code, w.seasonNumbers) ?? w.detail}</li>
          ))}
        </ul>
      ) : null}

      {seasons.rateable.length === 0 ? (
        <p className="text-(--color-muted)">{t(locale, 'seasons.none')}</p>
      ) : (
        <ol className="divide-y divide-(--color-edge-quiet) panel">
          {seasons.rateable.map((season) => (
            <li
              key={season.ref.seasonNumber}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              {/* 🔴 **La seule liste d'objets du produit qui n'avait pas d'image**, et la
                  donnee etait la depuis toujours : TMDB rend un `poster_path` par saison,
                  que `toRawSeason` lisait puis jetait. Cinq lignes de texte pour l'unite
                  que ce produit revendique — *une serie n'est pas un long film*.

                  ⚠️ `w154` et pas plus : la vignette sert a reconnaitre, pas a regarder.
                  Le cadre garde le rapport 2:3 meme quand la saison n'a pas d'affiche,
                  sinon la rangee saute d'une ligne a l'autre. */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="poster-frame aspect-2/3 w-11 shrink-0">
                  <Poster
                    path={season.posterPath}
                    title={t(locale, 'seasons.seasonN', { n: season.ref.seasonNumber })}
                    size="w154"
                  />
                </div>
                <span className="font-medium">
                  {t(locale, 'seasons.seasonN', { n: season.ref.seasonNumber })}
                </span>
              </div>
              <span className="meta">
                {tn(locale, 'series.episodes', season.episodeCount)}
                {season.airedFrom !== undefined
                  ? ` · ${formatDate(season.airedFrom, locale)}`
                  : ''}
              </span>
            </li>
          ))}
        </ol>
      )}

      {seasons.specials.length > 0 ? (
        <p className="meta">{t(locale, 'seasons.specials')}</p>
      ) : null}
    </section>
  );
}

import type { NormalizedSeasons, SeasonWarningCode } from '@/src/domain/seasons';
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
      <h2 className="text-lg font-semibold tracking-tight">{t(locale, 'seasons.title')}</h2>

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
        <ol className="divide-y divide-(--color-edge) rounded-lg border border-(--color-edge) bg-(--color-surface)">
          {seasons.rateable.map((season) => (
            <li
              key={season.ref.seasonNumber}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="font-medium">
                {t(locale, 'seasons.seasonN', { n: season.ref.seasonNumber })}
              </span>
              <span className="text-sm text-(--color-muted)">
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
        <p className="text-sm text-(--color-muted)">{t(locale, 'seasons.specials')}</p>
      ) : null}
    </section>
  );
}

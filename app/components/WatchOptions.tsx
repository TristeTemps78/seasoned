'use client';

import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import type { MessageKey } from '@/lib/i18n';
import type { WatchOption } from '@/src/catalog/provider';
import { JUSTWATCH_ATTRIBUTION } from '@/src/catalog/provider';

const KIND_KEY: Readonly<Record<WatchOption['kind'], MessageKey>> = {
  flatrate: 'watch.flatrate',
  free: 'watch.free',
  ads: 'watch.ads',
  rent: 'watch.rent',
  buy: 'watch.buy',
};

/** Ordre d'affichage : du moins cher a l'utilisateur au plus cher. */
const ORDER: readonly WatchOption['kind'][] = ['flatrate', 'free', 'ads', 'rent', 'buy'];

/**
 * « FR » → « France » / « France » ; « US » → « États-Unis » / « United States ».
 *
 * Repli sur le code brut si le navigateur ne connait pas `DisplayNames` : deux lettres
 * restent lisibles, une exception ne l'est pas (`AGENTS.md` regle 4).
 */
function regionName(region: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

/**
 * Ou regarder la serie.
 *
 * Le dernier maillon de la decision que le reste de la page prepare : savoir qu'une
 * serie demande soixante-deux heures et decroche en saison 5 ne sert a rien si l'on
 * doit aller ailleurs pour savoir ou la voir.
 *
 * **Et surtout : celles que l'on a deja.** Une liste de dix services laisse le travail
 * au lecteur ; « vous l'avez » repond a la question. C'est la moitie manquante que
 * JustWatch ne peut pas fournir — elle est de notre cote, pas du sien.
 *
 * Les logos viennent du CDN de TMDB, jamais de chez nous — meme regle que les
 * affiches (`ROADMAP.md` §1.4).
 */
export function WatchOptions({ options, region }: {
  readonly options: readonly WatchOption[];
  /** Code ISO du pays interroge — la disponibilite n'a aucun sens sans lui. */
  readonly region: string;
}) {
  const { journal, ready } = useJournal();
  const { t, locale } = useT();
  if (options.length === 0) return null;

  const mine = new Set(journal.platforms ?? []);
  const available = ready
    ? options.filter((o) => o.kind === 'flatrate' && mine.has(o.providerName))
    : [];

  const groups = ORDER.map((kind) => ({
    kind,
    items: options.filter((o) => o.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="space-y-3" aria-label={t('watch.aria')}>
      <h2 className="section-heading">{t('watch.title')}</h2>

      {available.length > 0 ? (
        <p className="rounded-md bg-(--color-live)/10 px-3 py-2 text-sm text-(--color-live)">
          {t('watch.youHave', { list: available.map((o) => o.providerName).join(', ') })}
        </p>
      ) : null}

      <dl className="space-y-2">
        {groups.map(({ kind, items }) => (
          <div key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <dt className="label">
              {t(KIND_KEY[kind])}
            </dt>
            <dd className="flex flex-wrap items-center gap-2">
              {items.map((o) => {
                const owned = mine.has(o.providerName);
                return (
                  <span
                    key={o.providerName}
                    className={`inline-flex items-center gap-1.5 rounded-md border py-1 pl-1 pr-2.5 text-sm ${
                      owned
                        ? 'border-(--color-live)/40 bg-(--color-live)/10'
                        : 'border-(--color-edge) bg-(--color-surface)'
                    }`}
                  >
                    {o.logoPath !== undefined ? (
                      // eslint-disable-next-line @next/next/no-img-element -- CDN TMDB.
                      <img
                        src={`https://image.tmdb.org/t/p/w45${o.logoPath}`}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                        className="rounded"
                      />
                    ) : null}
                    {o.providerName}
                  </span>
                );
              })}
            </dd>
          </div>
        ))}
      </dl>

      {/* Obligation contractuelle : TMDB agrege ces donnees depuis JustWatch et
          impose de le citer partout ou elles apparaissent. */}
      {/* ⚠️ La region etait ecrite « en France » en dur, sur un site desormais servi en
          anglais : on annoncait la disponibilite francaise a des lecteurs americains,
          qui n'ont pas le meme catalogue. Le nom du pays passe par `Intl.DisplayNames`
          plutot que par le dictionnaire — traduire 249 pays a la main n'aurait aucun
          sens quand le navigateur sait deja le faire. */}
      <p className="text-xs text-(--color-muted)">
        {JUSTWATCH_ATTRIBUTION} {t('watch.region', { region: regionName(region, locale) })}
      </p>
    </section>
  );
}

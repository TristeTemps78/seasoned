import type { WatchOption } from '@/src/catalog/provider';
import { JUSTWATCH_ATTRIBUTION } from '@/src/catalog/provider';

const KIND_LABEL: Readonly<Record<WatchOption['kind'], string>> = {
  flatrate: 'Inclus dans l’abonnement',
  free: 'Gratuit',
  ads: 'Gratuit avec publicité',
  rent: 'En location',
  buy: 'À l’achat',
};

/** Ordre d'affichage : du moins cher a l'utilisateur au plus cher. */
const ORDER: readonly WatchOption['kind'][] = ['flatrate', 'free', 'ads', 'rent', 'buy'];

/**
 * Ou regarder la serie.
 *
 * Le dernier maillon de la decision que le reste de la page prepare : savoir qu'une
 * serie demande soixante-deux heures et decroche en saison 5 ne sert a rien si l'on
 * doit aller ailleurs pour savoir ou la voir.
 *
 * Les logos viennent du CDN de TMDB, jamais de chez nous — meme regle que les
 * affiches (`ROADMAP.md` §1.4).
 */
export function WatchOptions({ options }: { readonly options: readonly WatchOption[] }) {
  if (options.length === 0) return null;

  const groups = ORDER.map((kind) => ({
    kind,
    items: options.filter((o) => o.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="space-y-3" aria-label="Où regarder">
      <h2 className="text-lg font-semibold tracking-tight">Où la regarder</h2>

      <dl className="space-y-2">
        {groups.map(({ kind, items }) => (
          <div key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <dt className="text-xs uppercase tracking-wide text-(--color-muted)">
              {KIND_LABEL[kind]}
            </dt>
            <dd className="flex flex-wrap items-center gap-2">
              {items.map((o) => (
                <span
                  key={o.providerName}
                  className="inline-flex items-center gap-1.5 rounded-md border border-(--color-edge) bg-(--color-surface) py-1 pl-1 pr-2.5 text-sm"
                >
                  {o.logoPath !== undefined ? (
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
              ))}
            </dd>
          </div>
        ))}
      </dl>

      {/* Obligation contractuelle : TMDB agrege ces donnees depuis JustWatch et
          impose de le citer partout ou elles apparaissent. */}
      <p className="text-xs text-(--color-muted)">
        {JUSTWATCH_ATTRIBUTION} Disponibilité en France.
      </p>
    </section>
  );
}

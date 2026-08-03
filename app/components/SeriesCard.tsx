import Link from 'next/link';
import type { SeriesSummary } from '@/src/catalog/provider';
import type { StatusResult } from '@/src/domain/status';
import { Poster } from '@/app/components/Poster';
import { STATUS_TONE, shortStatus, year } from '@/lib/format';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { seriesPath } from '@/lib/routes';

/**
 * Le ton de la pastille posee **sur** l'affiche.
 *
 * Fond tres sombre et non colore : la pastille se lit par-dessus une image dont on ne
 * sait rien — elle peut etre blanche, saturee, ou chargee. Seuls le texte et le liseré
 * portent la couleur, ce qui garantit le contraste quelle que soit l'affiche dessous.
 */
const TONE_CHIP = {
  live: 'text-(--color-live) ring-(--color-live)/30',
  waiting: 'text-(--color-volt) ring-(--color-volt)/30',
  warning: 'text-(--color-warn) ring-(--color-warn)/30',
  neutral: 'text-(--color-text) ring-white/15',
} as const;

/**
 * Vignette de resultat.
 *
 * « L'affiche est l'interface » : elle n'est pas une decoration, elle est le moyen de
 * navigation. D'ou une carte qui n'est presque que l'affiche.
 *
 * ## Ce qui a change le 2026-08-03, et pourquoi
 *
 * Le statut vivait **sous** l'affiche, en gris, a la suite de l'annee. Autrement dit : la
 * seule information que ce produit sache donner et qu'aucun autre n'affiche — *« en
 * attente · 7 mois »* — etait peinte comme une metadonnee de second rang, et il fallait
 * lire une ligne de texte pour la trouver.
 *
 * Elle passe **sur** l'affiche, en pastille, avec la couleur de son ton et le chiffre en
 * grille monospace. Sur une rangee de vingt vignettes, on voit maintenant d'un coup d'oeil
 * ce qui est en cours, ce qui attend, et depuis combien de temps — sans lire.
 *
 * Le `status` reste optionnel : il coute un appel par serie, donc on ne l'hydrate que sur
 * les pages mises en cache (`lib/catalog.ts`, `withStatus`).
 */
export function SeriesCard({ series, status, locale = DEFAULT_LOCALE }: {
  readonly series: SeriesSummary;
  readonly status?: StatusResult;
  readonly locale?: Locale;
}) {
  const firstYear = year(series.firstAirDate);
  const badge = status !== undefined ? shortStatus(status, locale) : undefined;

  return (
    // Le lien reste dans la langue de la page : sans cela, chaque vignette de l'accueil
    // francais etait une sortie du francais.
    <Link
      href={seriesPath(series.providerId, locale)}
      className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-volt)"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-lg border border-(--color-edge) bg-(--color-surface) transition-colors group-hover:border-(--color-volt)/50">
        <Poster
          path={series.posterPath}
          title={series.title}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {/* Le degrade n'est pas un ornement : il garantit que la pastille reste lisible
            sur une affiche claire. Sans lui, un fond blanc rend le texte invisible. */}
        {badge !== undefined && status !== undefined ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent"
            />
            <span
              className={`numeric absolute bottom-2 left-2 right-2 truncate rounded px-1.5 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset backdrop-blur-[2px] ${
                TONE_CHIP[STATUS_TONE[status.status]]
              }`}
            >
              {badge}
            </span>
          </>
        ) : null}
      </div>

      {/* Deux lignes puis des points : « The Rookie : Le Flic de » coupe net ne designe
          plus aucune serie. Une hauteur fixe garde l'alignement des lignes de la grille
          quand un titre tient sur une ligne et le suivant sur deux. */}
      <p className="clamp-2 mt-2 min-h-[2.5rem] text-sm leading-snug font-semibold transition-colors group-hover:text-(--color-volt)">
        {series.title}
      </p>
      {firstYear !== undefined ? (
        <p className="numeric text-xs text-(--color-muted)">{firstYear}</p>
      ) : null}
    </Link>
  );
}

import type { SeriesWithStatus } from '@/lib/catalog';
import { RowHeader } from '@/app/components/RowHeader';
import { SeriesCard } from '@/app/components/SeriesCard';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

/**
 * Une rangee d'affiches qui defile — l'objet de base de la direction artistique.
 *
 * ## Pourquoi il sort de l'accueil
 *
 * Il y vivait en prive (`Row`, dans `app/(site)/page.tsx`), et il n'y avait aucune raison :
 * c'est le seul objet du produit qui sache montrer un paquet de series sans en faire une
 * grille plate, et **quatre faces sur six en avaient besoin** le jour ou elles ont cesse
 * d'etre un cartouche gris dans du vide. Le laisser prive aurait voulu dire l'ecrire une
 * seconde fois, avec ses deux classes, son en-tete et sa regle de taille d'affiche — soit
 * exactement le defaut que `RowHeader` venait de corriger entre l'accueil et la
 * bibliotheque.
 *
 * ## Ce qu'il fait, et qui n'est pas cosmetique
 *
 * Il **deborde du bord droit** de l'ecran. Une rangee qui se termine pile au bord se lit
 * comme finie ; une rangee coupee dit qu'il y en a plus, sans un mot. La gouttiere de
 * depart, elle, s'aligne sur la colonne de texte — voir `--rail-gutter`, qui etait faux
 * jusqu'au 2026-08-12 et collait la premiere affiche au bord de l'ecran.
 *
 * ## Le statut est optionnel, et c'est une question de cout
 *
 * `withStatus` coute **un appel par serie**. L'accueil peut se le permettre : il est en ISR
 * quotidien, donc c'est une soixantaine d'appels par jour quel que soit le trafic. Les
 * rangees de decouverte des faces s'en passent — elles servent a montrer des affiches, pas
 * a trancher si une serie est en attente, et la fiche serie le dira au clic.
 */
export function PosterRail({ title, subtitle, series, locale = DEFAULT_LOCALE, lead = false }: {
  readonly title: string;
  readonly subtitle: string;
  readonly series: readonly SeriesWithStatus[];
  readonly locale?: Locale;
  /** La rangee de tete : moins de colonnes, donc des affiches nettement plus grandes. */
  readonly lead?: boolean;
}) {
  // ⚠️ Le seul `return null` tolere du depot, et il ne contredit pas la regle 4 : une
  // rangee vide n'est pas un ecran vide. L'ecran qui l'accueille porte deja sa phrase et son
  // bouton — c'est le catalogue qui n'a rien renvoye, et annoncer la panne d'une rangee
  // decorative sous un ecran qui parle deja ne dit rien de plus a personne.
  if (series.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={title}>
      <RowHeader title={title} subtitle={subtitle} />
      <ul className={`rail ${lead ? 'rail-lead' : ''}`}>
        {series.map(({ summary, status }) => (
          <li key={summary.providerId}>
            <SeriesCard
              series={summary}
              locale={locale}
              // Les affiches du rail sont plus grandes que celles de l'ancienne grille :
              // elles n'ont plus a rentrer toutes en meme temps.
              size={lead ? 'w500' : 'w342'}
              {...(status !== undefined ? { status } : {})}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

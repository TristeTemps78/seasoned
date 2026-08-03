'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { upcomingFrom, type UpcomingEpisode } from '@/src/domain/calendar';
import { parseJournalKey } from '@/src/domain/journal';
import { CalendarExport } from '@/app/components/CalendarExport';
import { seriesPath } from '@/lib/routes';
import { formatDate } from '@/lib/format';

/**
 * La face « Calendrier » — ce qui revient, et quand.
 *
 * ## Ce qu'elle repare
 *
 * `src/domain/calendar.ts` existe depuis le 2026-08-03, avec douze tests, et ne servait
 * **qu'a fabriquer un fichier `.ics`**. Le produit savait donc repondre a « qu'est-ce qui
 * revient ? » et ne l'affichait nulle part : il fallait telecharger un fichier et ouvrir
 * une autre application pour lire ce qu'il avait deja calcule.
 *
 * C'est la forme d'echec la mieux documentee de ce projet — *un module teste mais jamais
 * affiche n'est pas une fonctionnalite*.
 *
 * ## Aucun appel reseau, ici non plus
 *
 * Tout vient des instantanes deposes en visitant les pages serie. Une serie dont
 * l'instantane a expire n'a plus de date connue et disparait de cette liste : c'est le
 * plafond contractuel qui s'applique (`AGENTS.md` regle 1), pas un oubli.
 *
 * L'export `.ics` reste propose **en bas** de l'ecran, et il lit exactement la meme liste
 * (`upcomingFrom`). Le rappel qui sonne reste delegue au calendrier que tout le monde a
 * deja — c'est le seul rappel que ce produit peut se payer.
 */
export function Agenda() {
  const { journal, ready } = useJournal();
  const { t } = useT();

  const upcoming = useMemo(() => upcomingFrom(journal, new Date()), [journal]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu : annoncer « aucune date » a quelqu'un qui suit
    // quarante series serait la pire premiere impression possible.
    return <div className="h-64" aria-hidden="true" />;
  }

  if (upcoming.length === 0) return <EmptyAgenda />;

  const now = new Date();
  const groups = groupByHorizon(upcoming, now);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="page-title">{t('agenda.title')}</h1>
        <p className="text-(--color-muted)">{t('agenda.lede')}</p>
      </header>

      {groups.map(({ labelKey, episodes }) =>
        episodes.length === 0 ? null : (
          <section key={labelKey} className="space-y-3" aria-label={t(labelKey)}>
            <h2 className="text-sm font-semibold tracking-wide text-(--color-muted) uppercase">
              {t(labelKey)}
            </h2>
            <ul className="divide-y divide-(--color-edge) rounded-lg border border-(--color-edge) bg-(--color-surface)">
              {episodes.map((episode) => (
                <Row key={episode.key} episode={episode} now={now} />
              ))}
            </ul>
          </section>
        ),
      )}

      <CalendarExport />
    </div>
  );
}

function Row({ episode, now }: { readonly episode: UpcomingEpisode; readonly now: Date }) {
  const { t, tn, locale } = useT();
  const days = daysUntil(episode.airsOn, now);
  const parsed = parseJournalKey(episode.key);

  const label =
    days === 0
      ? t('agenda.today')
      : days === 1
        ? t('agenda.tomorrow')
        : tn('agenda.inDays', days);

  const title =
    parsed === undefined ? (
      <span className="font-medium">{episode.title}</span>
    ) : (
      // La cle porte son fournisseur (`tmdb:1396`) : on ne fabrique jamais une URL a
      // partir d'un identifiant nu, meme ici.
      <Link
        href={seriesPath(parsed.providerId, locale)}
        className="font-medium hover:text-(--color-volt) transition-colors"
      >
        {episode.title}
      </Link>
    );

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      {title}
      <span className="flex items-baseline gap-3">
        <span className="text-sm text-(--color-muted)">{formatDate(episode.airsOn, locale)}</span>
        {/* Le temps restant est un chiffre : il va dans la grille, comme partout ailleurs. */}
        <span className="numeric text-sm text-(--color-volt)">{label}</span>
      </span>
    </li>
  );
}

/**
 * L'ecran vide, qui doit surtout **ne pas ressembler a une panne**.
 *
 * N'avoir aucune date est le cas le plus frequent, et il est normal : une date n'existe
 * qu'une fois la diffusion programmee. Le dire evite qu'on cherche le bogue.
 */
function EmptyAgenda() {
  const { t } = useT();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="page-title">{t('agenda.title')}</h1>
        <p className="text-(--color-muted)">{t('agenda.lede')}</p>
      </header>
      <div className="empty-state">
        <h2 className="empty-state-title">{t('agenda.empty.title')}</h2>
        <p className="empty-state-body">{t('agenda.empty.body')}</p>
      </div>
    </div>
  );
}

const DAY_MS = 86_400_000;

function daysUntil(when: Date, now: Date): number {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / DAY_MS));
}

type HorizonKey = 'agenda.thisWeek' | 'agenda.thisMonth' | 'agenda.later';

/**
 * Trois horizons, et pas une liste plate.
 *
 * « Dans 3 jours » et « dans 8 mois » ne se lisent pas de la meme facon : melanges, le
 * proche se noie dans le lointain. Trois groupes suffisent — en ajouter un quatrieme
 * decouperait sans rien clarifier.
 */
function groupByHorizon(
  episodes: readonly UpcomingEpisode[],
  now: Date,
): readonly { readonly labelKey: HorizonKey; readonly episodes: readonly UpcomingEpisode[] }[] {
  const week: UpcomingEpisode[] = [];
  const month: UpcomingEpisode[] = [];
  const later: UpcomingEpisode[] = [];

  for (const episode of episodes) {
    const days = daysUntil(episode.airsOn, now);
    if (days <= 7) week.push(episode);
    else if (days <= 31) month.push(episode);
    else later.push(episode);
  }

  return [
    { labelKey: 'agenda.thisWeek', episodes: week },
    { labelKey: 'agenda.thisMonth', episodes: month },
    { labelKey: 'agenda.later', episodes: later },
  ];
}

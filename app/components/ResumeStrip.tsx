'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { seriesPath } from '@/lib/routes';
import { parseJournalKey } from '@/src/domain/journal';
import { buildLibrary, nextToResume } from '@/src/domain/library';

/**
 * « Reprendre » — le rappel que le produit s'interdit d'envoyer.
 *
 * Les notifications generalisees sont ecartees (`ROADMAP.md` §3) : leur cout croit
 * avec le nombre d'utilisateurs, ce qui est exactement le mecanisme qui a tue TV Time
 * avec 26 millions d'installations. Le contre-sens utile : **la page d'accueil peut
 * etre le rappel**. Elle ne coute rien, ne demande aucune permission, ne reveille
 * personne — et se voit au moment ou l'on vient de toute facon.
 *
 * Le serveur ignore tout de cette bande : elle s'ajoute dans le navigateur, sur une
 * page qui reste statique et mise en cache pour tout le monde. Un visiteur sans
 * journal ne voit rien du tout.
 */
export function ResumeStrip() {
  const { journal, ready } = useJournal();
  const { t, tn, locale } = useT();
  const item = useMemo(() => nextToResume(buildLibrary(journal)), [journal]);

  if (!ready || item === undefined) return null;

  const parsed = parseJournalKey(item.key);
  if (parsed === undefined) return null;

  const position = item.entry.position;
  const title = item.snapshot?.title ?? t('resume.yourSeries');

  return (
    <Link
      href={seriesPath(parsed.providerId, locale)}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-3 text-sm hover:border-(--color-muted)"
    >
      <span className="text-(--color-muted)">
        {item.daysUntilNext !== undefined ? t('resume.returning') : t('resume.resume')}
      </span>
      <strong className="font-medium">{title}</strong>

      {item.daysUntilNext !== undefined ? (
        <span className="text-(--color-live)">
          {item.daysUntilNext === 0
            ? t('resume.today')
            : item.daysUntilNext === 1
              ? t('resume.tomorrow')
              : tn('resume.inDays', item.daysUntilNext)}
        </span>
      ) : position !== undefined ? (
        <span className="text-(--color-muted)">
          {t('resume.at', { s: position.seasonNumber, e: position.episodeNumber })}
        </span>
      ) : null}

      <span className="ml-auto text-xs text-(--color-muted)">{t('resume.library')}</span>
    </Link>
  );
}

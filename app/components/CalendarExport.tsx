'use client';

import { useMemo, useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { buildCalendar, upcomingFrom, type UpcomingEpisode } from '@/src/domain/calendar';

/**
 * Les dates de retour, deposees dans le calendrier qu'on a deja.
 *
 * ## Pourquoi ce n'est pas une notification
 *
 * La dette D9 est reelle : une saison sort tous les trimestres, et personne ne revient
 * spontanement entre-temps. La reponse attendue serait la notification push. Elle est
 * ecartee parce que **son cout croit avec le nombre d'utilisateurs** — serveur de push,
 * jetons a maintenir, permission a demander — et c'est exactement le mecanisme qui a tue
 * TV Time avec 26 millions d'installations.
 *
 * Le renversement : **le rappel existe deja, et quelqu'un d'autre le paie.** Tout le
 * monde a un calendrier qui sonne. Un fichier depose une fois continue de rappeler meme
 * si l'on ne rouvre pas le site pendant trois mois — ce qui est precisement le cas a
 * traiter, et ce qu'une notification liee a l'application ne fait pas mieux.
 *
 * Cout serveur : zero. Permission demandee : aucune. Donnee envoyee : aucune — le
 * fichier est fabrique dans le navigateur a partir du seul journal.
 *
 * ## Ce qu'il ne promet pas
 *
 * Une seule date par serie : celle que le catalogue annonce. Ce n'est pas la grille
 * complete d'une saison, et le texte ne le laisse pas croire.
 */
export function CalendarExport() {
  const { journal, ready } = useJournal();
  const { t, tn } = useT();
  const [saved, setSaved] = useState(false);

  // La meme fonction que la face « Calendrier » : les deux ecrans doivent lire
  // exactement la meme liste, sinon l'affiche et l'exporte divergent en silence.
  const upcoming = useMemo<readonly UpcomingEpisode[]>(
    () => upcomingFrom(journal, new Date()),
    [journal],
  );

  const download = () => {
    const ics = buildCalendar(upcoming, new Date());
    if (ics === undefined) return;
    // `text/calendar` et non `application/octet-stream` : c'est ce type qui declenche
    // l'ouverture dans l'application de calendrier plutot qu'un fichier inerte.
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voltface.ics';
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  // Rien a annoncer : aucune serie suivie n'a de date de retour connue. Proposer un
  // calendrier vide serait une promesse non tenue.
  if (!ready || upcoming.length === 0) return null;

  return (
    <section
      className="card space-y-3"
      aria-label={t('calendar.aria')}
    >
      <div>
        <h2 className="card-title">{t('calendar.title')}</h2>
        <p className="max-w-prose text-xs leading-relaxed text-(--color-muted)">
          {t('calendar.body')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={download}
          className="btn"
        >
          {t('calendar.download')}
        </button>
        <span className="meta-sm">
          {tn('calendar.count', upcoming.length)}
        </span>
        {saved ? (
          <span aria-live="polite" className="text-xs text-(--color-live)">
            {t('calendar.saved')}
          </span>
        ) : null}
      </div>
    </section>
  );
}

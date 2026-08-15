'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { EmptyState } from '@/app/components/EmptyState';
import { PageHeader } from '@/app/components/PageHeader';
import { PosterChip } from '@/app/components/PosterChip';
import { parseJournalKey } from '@/src/domain/journal';
import {
  buildTimeline,
  groupByDay,
  yearsInTimeline,
  type TimelineEvent,
  type TimelineKind,
} from '@/src/domain/timeline';
import { pathIn, seriesPath } from '@/lib/routes';
import { formatDate } from '@/lib/format';
import type { MessageKey, Params } from '@/lib/i18n/engine';
import type { DecisionKind } from '@/src/domain/types';

/**
 * Le journal date — la face manquante, et pourquoi ce n'en est pas une.
 *
 * ## Ce que cet ecran recolte
 *
 * Chaque fait du journal porte sa propre date depuis la v2 du format. C'etait une decision
 * de **fusion** — deux appareils se departagent fait par fait —, et elle avait un effet de
 * bord que personne n'avait releve : le journal **est** deja une chronologie. `/moi` la
 * range par serie, `/bilan` l'agrege, `/calendrier` regarde devant. Rien ne regardait
 * derriere. Le *Diary* de Letterboxd, lui, ne fait que ca, et c'est sa surface centrale.
 *
 * Aucune donnee nouvelle n'a ete ajoutee pour cet ecran. Voir `src/domain/timeline.ts`.
 *
 * ## ⛔ Pourquoi ce n'est PAS une septieme face
 *
 * `Faces.tsx` ecrit noir sur blanc : *« Le cube est complet — les six faces existent enfin
 * toutes »*, et la marque du produit **est** un cube. Un cube n'a pas sept faces : ajouter
 * un onglet ici ne couterait pas seulement de la largeur a un ruban qui n'en a plus (mesure
 * a 253 px en francais), il defairait la seule metaphore que le produit porte jusque dans
 * son nom.
 *
 * Le journal se rejoint donc depuis `/moi`, dont il est le revers exact — *ce que vous
 * suivez* d'un cote, *ce que vous avez fait* de l'autre — et depuis un profil (les onglets).
 * C'est aussi la place que Letterboxd lui donne : sous le profil, jamais dans la barre.
 *
 * ## 🔴 La seule chose que cet ecran n'a pas le droit de taire
 *
 * Une ligne reprise d'un import et une ligne vecue se ressemblent trait pour trait. Or
 * `importForeign` date **chaque** fait a l'instant de l'import : sans la mention, reprendre
 * dix ans de TV Time afficherait une journee ou l'on aurait regarde deux cents series, et
 * neuf annees vides avant. Ce n'est pas un defaut d'affichage, c'est le produit qui raconte
 * une vie qui n'a pas eu lieu — et c'est exactement pour cet ecran-la que `origin` a ete
 * pose le 2026-08-09, un an avant qu'il existe.
 */
export function Timeline() {
  const { journal, ready } = useJournal();
  const { t, locale } = useT();

  const [year, setYear] = useState<number | undefined>(undefined);
  const [kind, setKind] = useState<TimelineKind | undefined>(undefined);

  // Toute l'histoire, non filtree : c'est elle qui donne la liste des annees. La calculer
  // sur la vue filtree ferait disparaitre l'annee qu'on vient de choisir dès qu'elle ne
  // contient pas le genre selectionne — un filtre qui se saborde lui-meme.
  const all = useMemo(() => buildTimeline(journal), [journal]);
  const years = useMemo(() => yearsInTimeline(all), [all]);

  const shown = useMemo(
    () =>
      buildTimeline(journal, {
        ...(year !== undefined ? { year } : {}),
        ...(kind !== undefined ? { kinds: [kind] } : {}),
      }),
    [journal, year, kind],
  );

  const days = useMemo(() => groupByDay(shown), [shown]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu : annoncer « rien ici » a quelqu'un qui porte trois
    // ans d'historique serait la pire premiere impression possible. Meme reserve qu'`Agenda`.
    return <div className="h-64" aria-hidden="true" />;
  }

  if (all.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title={t('timeline.title')} lede={t('timeline.lede')} />
        <EmptyState
          label={t('timeline.title')}
          title={t('timeline.emptyTitle')}
          actions={
            <>
              <Link href={pathIn('/recherche', locale)} className="btn rounded-full">
                {t('timeline.findSeries')}
              </Link>
              <Link href={pathIn('/moi', locale)} className="btn rounded-full">
                {t('timeline.myLibrary')}
              </Link>
            </>
          }
        >
          {t('timeline.emptyBody')}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t('timeline.title')} lede={t('timeline.lede')}>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <label className="meta" htmlFor="timeline-year">
            {t('timeline.year')}
          </label>
          <select
            id="timeline-year"
            className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
            value={year ?? ''}
            onChange={(e) => setYear(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            {/* ⚠️ Les annees viennent du journal (`yearsInTimeline`), jamais d'une plage
                fabriquee : proposer 2019 a quelqu'un qui n'a rien note cette annee-la est
                une porte qui ne mene nulle part. */}
            <option value="">{t('timeline.allYears')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <label className="meta" htmlFor="timeline-kind">
            {t('timeline.kind')}
          </label>
          <select
            id="timeline-kind"
            className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
            value={kind ?? ''}
            onChange={(e) =>
              setKind(e.target.value === '' ? undefined : (e.target.value as TimelineKind))
            }
          >
            <option value="">{t('timeline.allKinds')}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(KIND_LABEL[k])}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      {days.length === 0 ? (
        // Le vide **du filtre**, qui n'est pas le vide du journal : ici le geste est deja a
        // l'ecran, deux cents pixels au-dessus. Une phrase suffit, un bouton menerait hors
        // de l'endroit ou l'action se trouve (`EmptyState`, sur `actions` facultatif).
        <EmptyState title={t('timeline.noMatchTitle')}>{t('timeline.noMatchBody')}</EmptyState>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day.on} className="band" aria-label={formatDate(new Date(day.on), locale)}>
              <h2 className="row-title">{formatDate(new Date(day.on), locale)}</h2>
              {/* ⚠️ Bornee, comme la liste du calendrier : sans `max-w`, la ligne herite de
                  la largeur de la colonne et les deux moities du message partent aux deux
                  bouts de l'ecran. La mesure est faite, elle est dans `Agenda.tsx`. */}
              <ul className="max-w-3xl divide-y divide-(--color-edge-quiet)">
                {day.events.map((event, i) => (
                  <Row key={`${event.kind}-${event.subject}-${event.at}-${i}`} event={event} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Les genres proposes au filtre, dans l'ordre du parcours d'une serie. */
const KINDS: readonly TimelineKind[] = [
  'wanted',
  'position',
  'rated_season',
  'rated_episode',
  'episode_mark',
  'reviewed',
  'liked',
  'decided',
  'completed',
];

const KIND_LABEL = {
  wanted: 'timeline.kind.wanted',
  position: 'timeline.kind.position',
  rated_season: 'timeline.kind.ratedSeason',
  rated_episode: 'timeline.kind.ratedEpisode',
  episode_mark: 'timeline.kind.episodeMark',
  reviewed: 'timeline.kind.reviewed',
  liked: 'timeline.kind.liked',
  decided: 'timeline.kind.decided',
  completed: 'timeline.kind.completed',
} as const;

/** Une ligne du journal : ce qui s'est passe, sur quoi, et l'affiche pour le reconnaitre. */
function Row({ event }: { readonly event: TimelineEvent }) {
  const { t, n, locale } = useT();
  const parsed = parseJournalKey(event.subject);
  const title = event.title ?? event.subject;

  const name =
    parsed === undefined ? (
      <span className="font-medium">{title}</span>
    ) : (
      // La cle porte son fournisseur : on ne fabrique jamais une URL depuis un identifiant
      // nu, meme ici.
      // ⚠️ `.tap-line` : le lien nu mesurait **20 px de haut** (mesure au navigateur), sous
      // les 24 px que le depot s'est fixes le 2026-08-13. La classe porte la regle une fois
      // pour tout le site plutot qu'un rembourrage recopie a chaque lien.
      <Link
        href={seriesPath(parsed.providerId, locale)}
        className="tap-line font-medium hover:text-(--color-volt)"
      >
        {title}
      </Link>
    );

  return (
    <li className="flex items-center gap-3 py-3">
      <PosterChip path={event.posterPath} title={title} />
      <div className="min-w-0 flex-1">
        <p className="truncate">{name}</p>
        <p className="meta-sm">
          {describe(event, t, n)}
          {/* 🔴 Jamais omis. Voir l'en-tete de ce fichier : sans cette mention, un import
              se lit comme une journee vecue. */}
          {event.imported ? (
            <>
              {' · '}
              <span className="text-(--color-warn)" title={t('timeline.importedWhy')}>
                {t('timeline.imported')}
              </span>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}

/**
 * La phrase d'un evenement.
 *
 * Une fonction et non une table de gabarits : la moitie des genres portent une saison, un
 * episode ou une note, et les interpoler demande de savoir lequel. Un `switch` exhaustif
 * fait de plus echouer la compilation le jour ou {@link TimelineKind} grandit — ce qu'une
 * table indexee ne ferait pas.
 */
function describe(
  event: TimelineEvent,
  t: (key: MessageKey, params?: Params) => string,
  n: (value: number, digits?: number) => string,
): string {
  switch (event.kind) {
    case 'wanted':
      return t('timeline.said.wanted');
    case 'liked':
      return t('timeline.said.liked');
    case 'position':
      return t('timeline.said.position', { s: event.season ?? 0, e: event.episode ?? 0 });
    case 'rated_season':
      return t('timeline.said.ratedSeason', { s: event.season ?? 0, n: n(event.stars ?? 0) });
    case 'rated_episode':
      return t('timeline.said.ratedEpisode', {
        s: event.season ?? 0,
        e: event.episode ?? 0,
        n: n(event.stars ?? 0),
      });
    case 'decided':
      return t('timeline.said.decided', { d: t(DECISION_LABEL[event.decision ?? 'continuing']) });
    case 'completed':
      return t('timeline.said.completed');
    case 'reviewed':
      return event.season === undefined
        ? t('timeline.said.reviewed')
        : t('timeline.said.reviewedSeason', { s: event.season });
    case 'episode_mark':
      return t(
        event.mark === 'skipped' ? 'timeline.said.skipped' : 'timeline.said.watchedAhead',
        { s: event.season ?? 0, e: event.episode ?? 0 },
      );
  }
}

/**
 * Les libelles de decision, **reutilises** de la carte de progression.
 *
 * Une table nommee plutot qu'une cle construite (`` `decision.${kind}` ``) : la cle construite
 * compile parce qu'une chaine est une chaine, et elle rendrait le libelle brut le jour ou un
 * cinquieme genre de decision arriverait sans traduction. La table, elle, ne compile plus.
 */
const DECISION_LABEL = {
  continuing: 'decision.continuing',
  paused: 'decision.paused',
  abandoned: 'decision.abandoned',
  completed: 'decision.completed',
} as const satisfies Record<DecisionKind, MessageKey>;

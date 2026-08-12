'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { upcomingFrom, type UpcomingEpisode } from '@/src/domain/calendar';
import { parseJournalKey } from '@/src/domain/journal';
import { CalendarExport } from '@/app/components/CalendarExport';
import { EmptyState } from '@/app/components/EmptyState';
import { PageHeader } from '@/app/components/PageHeader';
import { Poster } from '@/app/components/Poster';
import { pathIn, seriesPath } from '@/lib/routes';
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
 * plafond contractuel qui s'applique, pas un oubli.
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
    <div className="space-y-8">
      <PageHeader title={t('agenda.title')} lede={t('agenda.lede')} />

      {groups.map(({ labelKey, episodes }) =>
        episodes.length === 0 ? null : (
          <section key={labelKey} className="band" aria-label={t(labelKey)}>
            <h2 className="row-title">
              {t(labelKey)}
            </h2>
            {/**
             * 🔴 **712 px entre une serie et sa date, sur la page qui existe pour les
             * apparier.** Mesure au navigateur le 2026-08-12, fenetre 1440 :
             *
             *     ligne             x 160 → 1280   (1 120 px)
             *     « The Simpsons »  x 240 → 346
             *     « 27 septembre »  x 1058
             *
             * La liste heritait de la largeur de la colonne — celle qui porte des rangees
             * d'affiches —, et son `justify-between` envoyait donc les deux moities du
             * message aux deux bouts de l'ecran. C'est la meme mesure que la feuille applique
             * deja au texte (*« une phrase sur 1 248 px ne se lit pas »*), et elle vaut pour
             * une ligne de donnees autant que pour une phrase : l'oeil doit relier les deux,
             * pas les chercher.
             *
             * ⚠️ Le titre de la bande, lui, garde toute la largeur : c'est son filet qui
             * traverse la page et qui tient le rythme des autres faces. Seule la **liste** se
             * borne.
             */}
            <ul className="max-w-3xl divide-y divide-(--color-edge-quiet)">
              {episodes.map((episode) => (
                <Row
                  key={episode.key}
                  episode={episode}
                  now={now}
                  // ⚠️ Lu ici et **pas** ajoute a `UpcomingEpisode` : ce type sert aussi a
                  // fabriquer le `.ics`, ou une affiche n'a rien a faire.
                  posterPath={
                    journal.entries[episode.key]?.poster ??
                    journal.entries[episode.key]?.snapshot?.posterPath
                  }
                />
              ))}
            </ul>
          </section>
        ),
      )}

      <CalendarExport />
    </div>
  );
}

/**
 * Une ligne du calendrier — avec son affiche depuis le 2026-08-10. C'etait le seul ecran
 * entierement textuel du produit : on y cherchait sa serie **en lisant**, alors qu'on la
 * reconnait a son affiche partout ailleurs.
 *
 * ⚠️ Aucun appel : l'affiche est deja dans l'instantane depose par la fiche serie, et
 * `Poster` rend son monogramme quand elle manque.
 */
function Row({ episode, now, posterPath }: {
  readonly episode: UpcomingEpisode;
  readonly now: Date;
  readonly posterPath: string | undefined;
}) {
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
    <li className="flex items-center gap-4 py-3">
      {/* 🔴 **C'etait `w-9`, soit 36 px** — et le commentaire pretendait que c'etait « assez
          pour reconnaitre une affiche d'un coup d'oeil ». A 36 px de large, une affiche n'est
          pas reconnaissable : c'est un carre de couleur. Le calendrier redevenait ce qu'il
          etait avant qu'on lui donne des vignettes — un ecran ou l'on cherche sa serie **en
          lisant**.
          A 64 px la ligne reste une ligne (elle fait 96 px de haut, contre 54) et l'affiche
          redevient un objet qu'on identifie sans lire. */}
      {/* ⚠️ Un `div` et non un `span` : `Poster` rend une `div` quand l'affiche manque
          (le monogramme), et une `div` dans un `span` est un imbriquement invalide que
          rien ici ne signalerait. */}
      <div className="poster-frame aspect-2/3 w-16 shrink-0">
        <Poster path={posterPath} title={episode.title} size="w185" />
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
        {title}
        {/* ⚠️ **Quel** episode revient, et il manquait. La ligne disait « The Simpsons » et
            une date : de quoi noter le jour, pas de quoi savoir si c'est la reprise d'une
            saison ou son avant-dernier episode. Le code vit deja en clair dans quatre autres
            composants (`LibraryCard`, `EpisodeGrid`, la fiche serie) — ce n'est pas une
            phrase a traduire, c'est une coordonnee. */}
        {episode.seasonNumber !== undefined && episode.episodeNumber !== undefined ? (
          <span className="numeric meta-sm">
            S{episode.seasonNumber}E{episode.episodeNumber}
          </span>
        ) : null}
        {/* `ml-auto` et non `justify-between` sur le parent : avec un troisieme element, ce
            dernier repartissait les trois a intervalles egaux au lieu de tenir la date a
            droite. */}
        <span className="ml-auto flex items-baseline gap-3">
          <span className="meta">
            {formatDate(episode.airsOn, locale)}
          </span>
          {/* 🔴 Deux defauts sur la meme ligne, trouves en auditant `.numeric`.
              1. Le commentaire disait « le temps restant est un chiffre » — faux dans **deux
                 branches sur trois** : `label` vaut « aujourd'hui » ou « demain ». Le
                 monospace transformait ces mots en extrait de terminal, exactement ce qui
                 rendait `/bilan` laid.
              2. La couleur etait `--color-volt`, qui signifie desormais « vous » depuis le
                 basculement de l'accent au vert. Or une date de diffusion parle de la SERIE :
                 c'est `--color-live`, comme dans `LibraryCard` qui rend deja la meme phrase.
                 Le basculement de l'accent a rendu ce slip **visible**, il ne l'a pas cree. */}
          <span className="text-sm font-medium text-(--color-live)">{label}</span>
        </span>
      </div>
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
  const { t, locale } = useT();
  return (
    <div className="space-y-8">
      <PageHeader title={t('agenda.title')} lede={t('agenda.lede')} />
      {/* 🔴 Il n'y avait aucune action. L'ecran expliquait tres bien que le vide est normal —
          une date n'existe qu'une fois la diffusion programmee — et **s'arretait la**. Or
          c'est l'ecran d'arrivee de tout compte jeune sur cette face : la phrase repond a
          « est-ce casse ? », les boutons repondent a « et maintenant ? ». */}
      <EmptyState
        title={t('agenda.empty.title')}
        actions={
          <>
            <Link href={pathIn('/recherche', locale)} className="btn btn-primary">
              {t('tallyPage.empty.search')}
            </Link>
            <Link href={pathIn('/moi', locale)} className="btn">
              {t('gate.library')}
            </Link>
          </>
        }
      >
        {t('agenda.empty.body')}
      </EmptyState>
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

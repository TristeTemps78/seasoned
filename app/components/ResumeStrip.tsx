'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { seriesPath } from '@/lib/routes';
import { marksOf, parseJournalKey } from '@/src/domain/journal';
import { buildLibrary, nextToResume } from '@/src/domain/library';
import { nextAfter } from '@/src/domain/remaining';
import { seasonToRate } from '@/src/domain/nudge';
import { StarRating } from '@/app/components/StarRating';

/**
 * « Reprendre » — le rappel que le produit s'interdit d'envoyer.
 *
 * Les notifications generalisees sont ecartees : leur cout croit
 * avec le nombre d'utilisateurs, ce qui est exactement le mecanisme qui a tue TV Time
 * avec 26 millions d'installations. Le contre-sens utile : **la page d'accueil peut
 * etre le rappel**. Elle ne coute rien, ne demande aucune permission, ne reveille
 * personne — et se voit au moment ou l'on vient de toute facon.
 *
 * Le serveur ignore tout de cette bande : elle s'ajoute dans le navigateur, sur une
 * page qui reste statique et mise en cache pour tout le monde. Un visiteur sans
 * journal ne voit rien du tout.
 *
 * ## 🔴 Le rappel disait ou l'on en etait, et ne permettait pas d'avancer
 *
 * `CLAUDE.md` decrit le produit comme un mix Letterboxd × Serializd × **TV Time**, et le
 * geste central du troisieme est « j'ai vu le suivant ». Au 2026-08-16, depuis cette bande,
 * il coutait **trois navigations** : ouvrir la fiche, descendre jusqu'a la grille des
 * episodes, trouver la case. Le pointeur avait supprime la friction de la *saisie* — « un
 * pointeur, pas quarante-sept cases a cocher » — et l'avait laissee entiere sur le *retour*,
 * qui est pourtant ce que l'on fait le plus souvent : une fois par episode regarde.
 *
 * ⚠️ **Le bouton nomme l'episode** (« J'ai vu S3E8 ») plutot que de dire « suivant ». Un
 * tracker qui avance la mauvaise chose est pire qu'un tracker qu'on n'utilise pas, et c'est
 * le seul endroit du produit ou l'on ecrit dans le journal **sans voir la serie**.
 *
 * ⚠️ **Absent quand il ne peut pas marcher** (regle du 2026-08-09) : sans `seasonSizes` dans
 * l'instantane — journal ancien, ou instantane d'identite survivant a sa partie perissable —
 * on ne sait pas si S1E7 est le dernier de sa saison, donc on ne propose rien et la bande
 * reste ce qu'elle etait. Un bouton qui devine est un bouton qui se trompe.
 */
export function ResumeStrip() {
  const { journal, ready, setPosition, setSeasonRating } = useJournal();
  const { t, tn, locale } = useT();
  const item = useMemo(() => nextToResume(buildLibrary(journal)), [journal]);

  if (!ready || item === undefined) return null;

  const parsed = parseJournalKey(item.key);
  if (parsed === undefined) return null;

  const position = item.entry.position;
  const title = item.snapshot?.title ?? t('resume.yourSeries');

  /* Le decoupage vient de l'instantane que `buildLibrary` a **deja** filtre par age
     (`freshSnapshot`) : le relire ici serait refaire un travail fait (regle 3).

     ⚠️ Il peut etre vieux de six mois, et c'est assume par `freshSnapshot` : une saison
     passee ne change pas, seule celle en cours grossit. La consequence est donc bornee et
     connue — sur une serie en diffusion dont l'instantane a vieilli, le bouton peut proposer
     le premier episode de la saison suivante alors que la saison courante a gagne des
     episodes. C'est le sens d'erreur qu'on veut : il **sous-estime** ce qui reste, comme tout
     ce qui s'appuie sur ce champ, et le libelle nomme l'episode — donc l'ecart se voit avant
     le clic, au lieu d'etre ecrit en silence. */
  const sizes = item.snapshot?.seasonSizes;
  const next = sizes === undefined ? undefined : nextAfter(sizes, position);

  /**
   * 🔴 **Le produit connaissait le moment de noter, et ne le disait qu'a qui ouvrait la fiche.**
   *
   * `seasonToRate` existe, est testee, et n'etait branchee qu'a **un seul endroit** :
   * `MyProgress`, sur `/serie/[id]`. Or son propre en-tete dit que la note de saison est
   * *« l'unite de jugement du produit »* — elle alimente la trajectoire, le point d'arret, le
   * profil de gout — et que *« le moment ou une note a le plus de sens est exactement celui ou
   * l'on vient de terminer la saison »*.
   *
   * Depuis le 2026-08-16, ce moment se produit **ici** : le bouton « J'ai vu S2E13 » de cette
   * bande fait finir des saisons, et la bande ne demandait rien. Le rappel arrivait donc a la
   * seule condition de rouvrir la fiche — c'est-a-dire exactement la navigation que ce bouton
   * existe pour supprimer.
   *
   * ⚠️ Tout se calcule hors ligne : le decoupage vient de l'instantane, les notes et les
   * exceptions du journal. Aucun appel, sur une page qui reste statique.
   */
  const rated = new Set(
    Object.keys(item.entry.seasonRatings ?? {})
      .map(Number)
      .filter((n) => Number.isFinite(n)),
  );
  const toRate =
    sizes === undefined ? undefined : seasonToRate(sizes, position, rated, marksOf(item.entry));

  return (
    // 🔴 **Un conteneur, et le lien a l'interieur.** La bande entiere etait un `<a>` : y
    // poser un bouton aurait imbrique un controle dans un lien, ce que le HTML interdit et
    // que les navigateurs resolvent chacun a leur facon — un clic sur le bouton suivant
    // aussi le lien, sur certains.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 panel px-4 py-3 text-sm">
      <Link
        href={seriesPath(parsed.providerId, locale)}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 hover:text-(--color-volt)"
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
      </Link>

      {next === undefined ? (
        // Sans episode suivant connu, la bande reste ce qu'elle etait : un rappel qui mene
        // a la fiche. La mention de la bibliotheque garde sa place a droite.
        <span className="meta-sm">{t('resume.library')}</span>
      ) : (
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={() => setPosition(item.key, next.seasonNumber, next.episodeNumber)}
        >
          {t('resume.watched', { s: next.seasonNumber, e: next.episodeNumber })}
        </button>
      )}

      {/* La note demandee **la ou le geste a lieu**, et pas seulement sur la fiche.
          ⚠️ Sur sa propre ligne (`basis-full`) : cinq etoiles font 240 px — `.star-box` est a
          48 px depuis le 2026-08-13, parce qu'en dessous la demi-etoile tombe sous les 24 px
          de WCAG 2.5.8. A 375 px la bande en fait 343 : la rangee tient, mais uniquement si
          elle ne partage sa ligne avec rien. C'est aussi pourquoi cette meme rangee ne peut
          **pas** vivre sur une vignette de bibliotheque, qui fait 109 px. */}
      {toRate !== undefined ? (
        <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-(--color-volt)">{t('progress.rateSeason', { n: toRate })}</span>
          <StarRating
            value={item.entry.seasonRatings?.[String(toRate)]?.stars}
            label={t('rating.season', { n: toRate })}
            onChange={(stars) => setSeasonRating(item.key, toRate, stars)}
          />
        </div>
      ) : null}
    </div>
  );
}

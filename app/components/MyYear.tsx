'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { formatCommitment } from '@/lib/format';
import { parseJournalKey } from '@/src/domain/journal';
import { buildYearReview, yearsWithActivity } from '@/src/domain/year';
import { pathIn } from '@/lib/routes';
import { PosterChip } from '@/app/components/PosterChip';

/**
 * « Votre annee » — le bilan annuel.
 *
 * ## Ce qu'il annonce, et ce qu'il n'annonce pas
 *
 * Des **gestes**, pas des heures regardees : le journal sait quand vous avez note, aime,
 * termine ; il ne sait pas quand vous avez vu chaque episode. La seule grandeur en heures
 * est celle des series **terminees** dans l'annee, et sa phrase le dit — « les series que
 * vous avez terminees en 2026 pesent 340 h » est vrai, « vous avez regarde 340 h » ne l'est
 * pas. Voir `src/domain/year.ts`.
 *
 * ## Le selecteur ne propose que des annees vecues
 *
 * Offrir 2019 a quelqu'un qui n'a rien fait cette annee-la, c'est l'inviter a decouvrir un
 * ecran vide. Et il **disparait** quand il n'y a qu'une annee : un menu a un seul choix
 * n'est pas un choix.
 */
export function MyYear() {
  const tr = useT();
  const { t, n, locale } = tr;
  const { journal } = useJournal();

  const years = useMemo(() => yearsWithActivity(journal), [journal]);
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const year = chosen ?? years[0];

  const review = useMemo(
    () => (year === undefined ? undefined : buildYearReview(journal, year)),
    [journal, year],
  );

  // 🔴 Le silence vaut pour une annee qu'on n'a PAS demandee, jamais pour celle qu'on
  // vient de choisir. Vu a l'ecran : choisir 2025 faisait disparaitre le bloc **avec son
  // selecteur**, donc on ne pouvait plus revenir a 2026 sans recharger la page. Repondre
  // « rien a raconter » est une reponse ; retirer la question n'en est pas une.
  if (review === undefined) return null;
  if (!review.worthShowing && chosen === undefined) return null;
  const thin = !review.worthShowing;

  const best = review.best;
  const parsed = best === undefined ? undefined : parseJournalKey(best.key);

  return (
    <section className="band" aria-label={t('year.aria')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="row-title">{t('year.title', { year: String(review.year) })}</h2>
        {years.length > 1 ? (
          <select
            className="field"
            value={review.year}
            aria-label={t('year.pick')}
            onChange={(e) => setChosen(Number(e.target.value))}
          >
            {years.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {thin ? <p className="meta">{t('year.thin')}</p> : null}

      {/* 🔴 C'etaient **quatre phrases dans une liste a puces** — « 1 série menée au bout. »,
          « 2 saisons notées. » — sur l'ecran dont le sujet EST le chiffre. Une mesure ecrite
          en prose ne se lit pas comme une mesure : elle se lit comme une remarque.
          Les tuiles portent le nombre en grand et l'etiquette en petit, et chacune prend une
          teinte differente (`.tile:nth-child`). C'est la seule bande de couleur de la page. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ['year.stat.finished', review.finished],
          ['year.stat.rated', review.seasonsRated],
          ['year.stat.written', review.reviewsWritten],
          ['year.stat.liked', review.liked],
        ] as const)
          // ⚠️ Zero ne s'affiche pas : « 0 critique » annonce un manque, la ou l'absence de
          // tuile ne dit rien. C'est la regle « mieux vaut se taire que compter zero »,
          // deja appliquee au fil et au classement.
          .filter(([, valeur]) => valeur > 0)
          .map(([cle, valeur]) => (
            <div key={cle} className="tile">
              <dt className="label">{t(cle)}</dt>
              <dd className="tile-value">{n(valeur)}</dd>
            </div>
          ))}
      </dl>

      {/* ⚠️ « ce que pesent les series terminees », jamais « ce que vous avez regarde » :
          un visionnage acheve en janvier a pu commencer l'annee d'avant.

          🔴 **Et il obeit au masquage (4.6).** Sans cette condition, « je ne veux plus voir
          le temps passe » cachait le total de `MyTally` et laissait le meme genre de
          chiffre juste au-dessus, dans la carte voisine. Une preference qui ne vaut que
          pour un ecran sur deux n'est pas une preference, c'est un bouton decoratif.

          ⚠️ Le temps **a venir** (« il vous reste ~9 h ») n'est PAS concerne : ce n'est pas
          un compte de ce qu'on a consomme, c'est le prix d'entree d'une decision. Le
          reglage porte sur le regard en arriere, pas sur le calcul. */}
      {/* ⚠️ Plus de `numeric` ici : le monospace aligne des COLONNES de nombres. Sur une
          phrase — « les séries terminées cette année-là pèsent 12 heures » — il donne du code,
          et c'est ce que la capture du 2026-08-11 montrait juste sous les tuiles. */}
      {review.minutesOfFinished > 0 && journal.hideHours !== true ? (
        <p className="meta">
          {t('year.weight', {
            commitment: formatCommitment(review.minutesOfFinished, tr),
          })}
        </p>
      ) : null}

      {best !== undefined ? (
        // 🔴 C'etait une **petite affiche a cote d'une phrase de 14 px**, dans une rangee qui
        // laissait les deux tiers de la largeur vides — et dix lignes plus bas, la meme
        // affiche recommencait pour `MyTally`. Deux vignettes identiques, deux fois le meme
        // vide a droite : c'est ce que montre la capture du 2026-08-11.
        //
        // Ici c'est une **mise en avant** : l'etiquette annonce, le titre porte, et il porte
        // en gros. Le bloc n'est plus une ligne perdue mais le point d'arrivee du bilan de
        // l'annee — et il ne ressemble plus a celui de `MyTally`, qui met en avant un CHIFFRE.
        <div className="flex items-center gap-4">
          <PosterChip path={best.posterPath} title={best.title} wide />
          <div className="min-w-0">
            <p className="label">{t('year.best')}</p>
            {parsed === undefined ? (
              <p className="section-heading">{best.title}</p>
            ) : (
              <Link
                className="section-heading block transition-colors hover:text-(--color-volt)"
                href={pathIn(`/serie/${parsed.providerId}`, locale)}
              >
                {best.title}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

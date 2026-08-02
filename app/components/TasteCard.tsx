'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { severityOf, type TasteProfile } from '@/src/domain/taste';

/**
 * La forme d'un gout, rendue lisible.
 *
 * Le cinquieme ressort — se decouvrir soi-meme — et le seul qui ne demande **personne
 * d'autre** : la comparaison se fait avec le public du catalogue, qui est deja la.
 *
 * Le composant se tait quand le profil se tait. Annoncer « vous notez severement » a
 * quelqu'un qui a pose deux notes serait presenter du bruit comme un fait — meme
 * erreur que le point d'arret qui epargnait 8 % de la serie, et qu'on a appris a ne
 * pas afficher.
 */
export function TasteCard({ profile, journalTitles = {} }: {
  readonly profile: TasteProfile;
  /**
   * Titres memorises, par cle de journal.
   *
   * Passes plutot que relus : le profil est un objet **pur** du domaine, il ne connait
   * que des cles. Lui faire porter des titres le rendrait dependant des instantanes du
   * catalogue, donc de leur expiration.
   */
  readonly journalTitles?: Readonly<Record<string, string>>;
}) {
  const { t, tn, n } = useT();
  if (!profile.speaks) return null;

  const severity = severityOf(profile.gapToPublic);
  const gap = profile.gapToPublic;

  return (
    <section
      className="edge-lit space-y-3 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4"
      aria-label={t('taste.aria')}
    >
      <h2 className="text-sm font-semibold">{t('taste.title')}</h2>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {profile.averageStars !== undefined ? (
          <Figure label={t('taste.average')} value={`${n(profile.averageStars, 1)}/5`} />
        ) : null}

        {severity !== undefined && gap !== undefined && profile.comparedSeries > 0 ? (
          <Figure
            label={t('taste.vsPublic')}
            value={
              severity === 'aligned'
                ? t('taste.aligned')
                : `${gap > 0 ? '+' : '−'}${n(Math.abs(gap), 1)}`
            }
            hint={
              severity === 'aligned'
                ? tn('taste.onSeries', profile.comparedSeries)
                : severity === 'severe'
                  ? t('taste.severe')
                  : t('taste.generous')
            }
          />
        ) : null}

        {profile.completionRate !== undefined ? (
          <Figure
            label={t('taste.completedLabel')}
            value={`${Math.round(profile.completionRate * 100)} %`}
            hint={`${tn('taste.finished', profile.completed)}, ${tn('taste.dropped', profile.abandoned)}`}
          />
        ) : null}

        {/* Le trait de gout le plus difficile a falsifier : on ne revoit pas trois fois
            quarante heures par erreur. */}
        {profile.comfortSeries !== undefined ? (
          <Figure
            label={t('taste.rewatched')}
            value={
              journalTitles[profile.comfortSeries.key] ?? t('library.card.tracked')
            }
            hint={tn('taste.rewatchedTimes', profile.comfortSeries.times)}
          />
        ) : null}

        {profile.medianAbandonSeason !== undefined ? (
          // La donnee propre du produit : personne d'autre ne sait ou les gens lachent.
          <Figure
            label={t('taste.abandonAt')}
            value={t('taste.seasonN', { n: profile.medianAbandonSeason })}
            hint={t('taste.median')}
          />
        ) : null}
      </dl>

      <p className="text-xs text-(--color-muted)">
        {tn('taste.basis', profile.seasonRatings, {
          extra:
            profile.episodeRatings > 0
              ? tn('taste.basisEpisodes', profile.episodeRatings)
              : '',
        })}
      </p>
    </section>
  );
}

function Figure({ label, value, hint }: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-(--color-muted)">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
      {hint !== undefined ? (
        <dd className="text-xs text-(--color-muted)">{hint}</dd>
      ) : null}
    </div>
  );
}

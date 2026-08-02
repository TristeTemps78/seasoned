'use client';

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
export function TasteCard({ profile }: { readonly profile: TasteProfile }) {
  if (!profile.speaks) return null;

  const severity = severityOf(profile.gapToPublic);
  const gap = profile.gapToPublic;

  return (
    <section
      className="space-y-3 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4"
      aria-label="Mon goût"
    >
      <h2 className="text-sm font-semibold">La forme de mon goût</h2>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {profile.averageStars !== undefined ? (
          <Figure
            label="Ma moyenne"
            value={`${profile.averageStars.toFixed(1).replace('.', ',')}/5`}
          />
        ) : null}

        {severity !== undefined && gap !== undefined && profile.comparedSeries > 0 ? (
          <Figure
            label="Face au public"
            value={
              severity === 'aligned'
                ? 'aligné'
                : `${gap > 0 ? '+' : '−'}${Math.abs(gap).toFixed(1).replace('.', ',')}`
            }
            hint={
              severity === 'aligned'
                ? `sur ${profile.comparedSeries} séries`
                : severity === 'severe'
                  ? 'plus sévère'
                  : 'plus généreux'
            }
          />
        ) : null}

        {profile.completionRate !== undefined ? (
          <Figure
            label="Menées au bout"
            value={`${Math.round(profile.completionRate * 100)} %`}
            hint={`${profile.completed} finie${profile.completed > 1 ? 's' : ''}, ${profile.abandoned} abandonnée${profile.abandoned > 1 ? 's' : ''}`}
          />
        ) : null}

        {profile.medianAbandonSeason !== undefined ? (
          // La donnee propre du produit : personne d'autre ne sait ou les gens lachent.
          <Figure
            label="J’abandonne en"
            value={`saison ${profile.medianAbandonSeason}`}
            hint="en médiane"
          />
        ) : null}
      </dl>

      <p className="text-xs text-(--color-muted)">
        Calculé sur vos {profile.seasonRatings} note
        {profile.seasonRatings > 1 ? 's' : ''} de saison
        {profile.episodeRatings > 0 ? ` et ${profile.episodeRatings} d’épisode` : ''}.
        Rien de tout cela ne quitte ce navigateur.
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

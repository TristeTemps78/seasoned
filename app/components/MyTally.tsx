'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { formatCommitment } from '@/lib/format';
import type { Tally } from '@/src/domain/tally';

/**
 * Le temps passe, rendu lisible — et honnete sur ce qu'il ignore.
 *
 * ## Ce que ce composant refuse de faire
 *
 * **Annoncer un total.** Le chiffre est un minorant par construction : les instantanes
 * expirent au plafond contractuel, les series visitees avant que le journal memorise leur
 * forme n'ont rien a compter, et le catalogue ignore souvent la duree d'un episode. Ecrire
 * « 47 jours » serait donc faux, alors que « au moins 47 jours » est vrai. La difference
 * tient en deux mots et c'est toute la difference entre une mesure et une affirmation.
 *
 * Et il **se tait** quand le calcul ne couvre pas assez de series (`buildTally`) : un
 * minorant trop severe n'est plus prudent, c'est trompeur. Meme regle que le point d'arret
 * qui epargnait 8 % de la serie et qu'on a appris a ne pas afficher.
 *
 * ## Pourquoi il ne coute rien
 *
 * Tout vient du journal, dans le navigateur. Aucun appel, donc aucune facture par
 * utilisateur — la ou les statistiques equivalentes sont payantes chez le leader du domaine
 * voisin. Ce n'est pas une generosite : chez nous, ce calcul ne coute a personne.
 */
export function MyTally({ tally }: { readonly tally: Tally }) {
  const { t, tn, locale } = useT();
  if (!tally.worthShowing) return null;

  const heaviest = tally.heaviest;

  return (
    <section
      className="edge-lit space-y-3 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4"
      aria-label={t('tally.aria')}
    >
      <h2 className="text-sm font-semibold">{t('tally.title')}</h2>

      {/* Le seul chiffre du produit qui mérite de briller : il résume tout le reste.
          `glow` posé ailleurs perdrait son sens par saturation. */}
      <p className="numeric glow text-2xl font-semibold tracking-tight text-balance">
        {t('tally.atLeast', { commitment: formatCommitment(tally.minutes, locale) })}
      </p>

      <p className="text-sm text-(--color-muted)">
        {tn('tally.onSeries', tally.counted, {
          episodes: tn('tally.episodes', tally.episodes),
        })}
      </p>

      {heaviest !== undefined ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-(--color-muted)">
            {t('tally.heaviest')}
          </p>
          <p className="text-sm">
            {heaviest.passes > 1
              ? tn('tally.heaviestPasses', heaviest.passes, {
                  title: heaviest.title,
                  commitment: formatCommitment(heaviest.minutes, locale),
                })
              : t('tally.heaviestOnce', {
                  title: heaviest.title,
                  commitment: formatCommitment(heaviest.minutes, locale),
                })}
          </p>
        </div>
      ) : null}

      {/* Ce que le chiffre ne contient pas. Le taire ferait passer un minorant pour un
          total — exactement ce que le « au moins » ci-dessus s'emploie a eviter. */}
      {tally.uncounted > 0 ? (
        <p className="text-xs text-(--color-muted)">
          {tn('tally.missing', tally.uncounted)}
        </p>
      ) : null}

      <p className="text-xs text-(--color-muted)">{t('tally.private')}</p>
    </section>
  );
}

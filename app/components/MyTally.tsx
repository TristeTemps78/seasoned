'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { WhereItLives } from '@/app/components/WhereItLives';
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
  const { journal, setHideHours } = useJournal();
  if (!tally.worthShowing) return null;

  const heaviest = tally.heaviest;

  /**
   * ⚠️ **Masque, et le dit.** Retirer le bloc entier ferait disparaitre le moyen de le
   * ramener : quelqu'un qui a masque par curiosite n'aurait plus aucun endroit ou revenir
   * dessus. Un reglage qui se cache lui-meme n'est pas un reglage, c'est un piege.
   */
  if (journal.hideHours === true) {
    return (
      <section className="space-y-2 panel px-4 py-4" aria-label={t('tally.aria')}>
        <p className="text-sm text-(--color-muted)">{t('tally.hidden')}</p>
        <button type="button" className="btn text-xs" onClick={() => setHideHours(false)}>
          {t('tally.show')}
        </button>
      </section>
    );
  }

  return (
    <section
      className="edge-lit space-y-3 panel px-4 py-4"
      aria-label={t('tally.aria')}
    >
      <h2 className="card-title">{t('tally.title')}</h2>

      {/* `glow` est reserve a ce chiffre : pose ailleurs, il perdrait son sens par
          saturation. La taille et sa justification vivent avec `.tally-figure`. */}
      <p className="tally-figure numeric glow">
        {t('tally.atLeast', { commitment: formatCommitment(tally.minutes, locale) })}
      </p>

      <p className="text-sm text-(--color-muted)">
        {tn('tally.onSeries', tally.counted, {
          episodes: tn('tally.episodes', tally.episodes),
        })}
      </p>

      {/* D'ou vient une partie du chiffre (9.0) — meme honnetete que le « au moins »,
          appliquee a la provenance plutot qu'a la couverture. Silencieux quand rien n'a
          ete importe.

          🔴 **Cette ligne etait sous « Surtout », et l'ecran l'a montree fausse** : elle
          y suivait immediatement « Dexter : 30 heures », donc « dont 30 heures » se
          lisait comme portant sur Dexter — la seule serie que l'import n'avait PAS
          ecrite. Un qualificatif du total se place avec le total. */}
      {tally.declaredMinutes > 0 ? (
        <p className="text-xs text-(--color-muted)">
          {t('tally.declared', {
            commitment: formatCommitment(tally.declaredMinutes, locale),
          })}
        </p>
      ) : null}

      {heaviest !== undefined ? (
        <div>
          <p className="label">
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

      <p className="text-xs text-(--color-muted)">
        {t('tally.private')} <WhereItLives className="" />
      </p>

      {/* ⚠️ Le bouton vit **avec le chiffre**, pas dans une page de reglages : c'est en le
          voyant qu'on decide de ne plus le voir. Un reglage range ailleurs demande de
          savoir qu'il existe, donc il ne sert qu'a ceux que le chiffre ne derange pas. */}
      <button
        type="button"
        className="text-xs text-(--color-muted) underline decoration-dotted underline-offset-2 hover:text-(--color-text)"
        onClick={() => setHideHours(true)}
      >
        {t('tally.hide')}
      </button>
    </section>
  );
}

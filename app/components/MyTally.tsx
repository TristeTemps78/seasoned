'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { WhereItLives } from '@/app/components/WhereItLives';
import { PosterChip } from '@/app/components/PosterChip';
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
  const tr = useT();
  const { t, tn, n } = tr;
  const { journal, setHideHours } = useJournal();
  // 🔴 Meme conversion que `TasteCard` : un `return null` faisait disparaitre la section
  // plutot que d'expliquer pourquoi le total manque. Le chiffre est un minorant, et un
  // minorant trop severe serait trompeur — mais *dire qu'on ne peut pas encore le dire* est
  // exactement ce que le reste de ce composant fait deja avec « au moins » et « non compte ».
  if (!tally.worthShowing) {
    return (
      <section className="band" aria-label={t('tally.aria')}>
        <h2 className="row-title">{t('tally.title')}</h2>
        {/* ⚠️ **Deux raisons distinctes**, et il fallait les separer : « rien de chiffrable »
            et « pas assez de couverture » se corrigent par deux gestes differents. Le premier
            cas est celui de quelqu'un qui vient d'importer son historique — l'import ne peut
            pas inventer la forme des saisons — et lui dire « notez quelques series » serait
            faux, puisqu'il a tout fait. Ce diagnostic vivait dans `MyStats` ; il descend ici,
            aupres du chiffre qu'il explique, ou il reste atteignable. */}
        <p className="prose-note">
          {tally.counted === 0 && tally.uncounted > 0
            ? tn('tallyPage.empty.uncounted', tally.uncounted)
            : t('tally.pending', { n: n(tally.counted) })}
        </p>
      </section>
    );
  }

  const heaviest = tally.heaviest;

  /**
   * ⚠️ **Masque, et le dit.** Retirer le bloc entier ferait disparaitre le moyen de le
   * ramener : quelqu'un qui a masque par curiosite n'aurait plus aucun endroit ou revenir
   * dessus. Un reglage qui se cache lui-meme n'est pas un reglage, c'est un piege.
   */
  if (journal.hideHours === true) {
    return (
      <section className="band" aria-label={t('tally.aria')}>
        <p className="meta">{t('tally.hidden')}</p>
        <button type="button" className="btn text-xs" onClick={() => setHideHours(false)}>
          {t('tally.show')}
        </button>
      </section>
    );
  }

  return (
    <section
      // `card panel-lit` : c'est le chiffre qui repond a la question du nom du site, sur une
      // page qui n'a que trois bandes. (`glow` a ete retiree le 2026-08-11 avec le monospace :
      // le contient restait, elle, au meme poids que les deux autres.
      className="band"
      aria-label={t('tally.aria')}
    >
      <h2 className="row-title">{t('tally.title')}</h2>

      {/* 🔴 Ce chiffre etait en **monospace vert avec une lueur**. Le monospace sert a aligner
          des colonnes de nombres ; pose sur une phrase de 48 px il donne un terminal, et la
          lueur par-dessus en faisait une enseigne. C'est la ligne la plus visible de la page,
          donc celle qui rendait l'ecran laid.
          Elle prend la voix editoriale — c'est une **affirmation**, pas une mesure tabulaire. */}
      {/* 🔴 Le chiffre, le decompte et « surtout » etaient **trois blocs empiles**, et
          l'affiche flottait dans un quatrieme, plus bas, dans une petite rangee a elle. Sur
          une page etroite ca donnait deux vignettes identiques a dix lignes d'ecart, chacune
          perdue a cote de son bout de phrase.
          Un seul bloc, l'affiche a gauche : elle sert enfin le chiffre au lieu de l'illustrer
          plus loin, et la page occupe sa largeur. */}
      <div className="flex items-start gap-5">
        {heaviest !== undefined ? (
          <PosterChip path={heaviest.posterPath} title={heaviest.title} wide />
        ) : null}

        <div className="min-w-0 space-y-2">
          <p className="tally-figure">
            {t('tally.atLeast', { commitment: formatCommitment(tally.minutes, tr) })}
          </p>

          <p className="meta">
            {tn('tally.onSeries', tally.counted, {
              episodes: tn('tally.episodes', tally.episodes),
            })}
          </p>

          {heaviest !== undefined ? (
            <p className="text-sm">
              <span className="label">{t('tally.heaviest')}</span>{' '}
              {heaviest.passes > 1
                ? tn('tally.heaviestPasses', heaviest.passes, {
                    title: heaviest.title,
                    commitment: formatCommitment(heaviest.minutes, tr),
                  })
                : t('tally.heaviestOnce', {
                    title: heaviest.title,
                    commitment: formatCommitment(heaviest.minutes, tr),
                  })}
            </p>
          ) : null}
        </div>
      </div>

      {/* D'ou vient une partie du chiffre (9.0) — meme honnetete que le « au moins »,
          appliquee a la provenance plutot qu'a la couverture. Silencieux quand rien n'a
          ete importe.

          🔴 **Cette ligne etait sous « Surtout », et l'ecran l'a montree fausse** : elle
          y suivait immediatement « Dexter : 30 heures », donc « dont 30 heures » se
          lisait comme portant sur Dexter — la seule serie que l'import n'avait PAS
          ecrite. Un qualificatif du total se place avec le total. */}
      {tally.declaredMinutes > 0 ? (
        <p className="meta-sm">
          {t('tally.declared', {
            commitment: formatCommitment(tally.declaredMinutes, tr),
          })}
        </p>
      ) : null}

      {/* Ce que le chiffre ne contient pas. Le taire ferait passer un minorant pour un
          total — exactement ce que le « au moins » ci-dessus s'emploie a eviter. */}
      {tally.uncounted > 0 ? (
        <p className="meta-sm">
          {tn('tally.missing', tally.uncounted)}
        </p>
      ) : null}

      {/* 🔴 **Deux corrections successives sur la meme phrase, et la premiere etait mauvaise.**
          Elle etait d'abord concatenee : « …goes nowhere. kept on this device » — un point
          suivi d'une minuscule. Je les ai alors separees en deux lignes, ce qui a donne deux
          fragments orphelins empiles, visibles sur la capture du 2026-08-11 : pire que le
          defaut d'origine.
          La vraie cause etait dans le dictionnaire : `tally.private` finissait par un point
          alors que `lives.*` est ecrit pour **suivre une virgule**. Corrige la, les deux se
          recollent en une phrase.

          ⚠️ Et le pied de page tient sur UNE rangee : la mention a gauche, le geste a droite.
          Trois lignes grises empilees en bas d'un ecran se lisent comme des restes. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pt-1">
        <p className="meta-sm">
          {t('tally.private')} <WhereItLives className="" />
        </p>

      {/* ⚠️ Le bouton vit **avec le chiffre**, pas dans une page de reglages : c'est en le
          voyant qu'on decide de ne plus le voir. Un reglage range ailleurs demande de
          savoir qu'il existe, donc il ne sert qu'a ceux que le chiffre ne derange pas. */}
        <button
          type="button"
          className="quiet-action"
          onClick={() => setHideHours(true)}
        >
          {t('tally.hide')}
        </button>
      </div>
    </section>
  );
}

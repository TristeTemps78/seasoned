'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { faceOf } from '@/src/domain/face';
import { Mark } from '@/app/components/Mark';

/**
 * Votre face, en toutes lettres — sur l'ecran qui dit **qui vous etes**.
 *
 * ## Pourquoi ici plutot qu'ailleurs
 *
 * `/bilan` est le seul ecran du produit qui ne parle pas de series mais de **vous**, et il
 * etait presque vide (tache 7.6 : *« une carte, puis du vide sur 60 % de la hauteur —
 * probleme de contenu, pas de style : ne pas le decorer »*). La face n'est pas une
 * decoration, c'est du contenu, et c'est le seul de cet ecran qui ne soit pas un chiffre.
 *
 * ## Elle ne se tait pas ici, contrairement a partout ailleurs
 *
 * ⚠️ La pastille se tait quand il n'y a pas de face, parce qu'elle apparait dans des listes
 * ou l'on parle d'autre chose. Ici c'est l'inverse : la personne est venue pour ca, donc lui
 * afficher **rien** serait la laisser croire que l'ecran est casse. On dit *« pas encore, et
 * voila comment »* — ce qui est aussi la seule facon d'expliquer que la face se **merite**.
 *
 * C'est la meme regle que `MIN_SERIES_FOR_TASTE` applique a l'envers : on ne dit rien de
 * faux, mais on dit qu'on ne dit rien.
 */
export function MyFaceCard() {
  const { t } = useT();
  const { journal, ready } = useJournal();

  // Ne rien affirmer avant d'avoir lu le stockage — la meme retenue que `MyStats`.
  if (!ready) return null;

  const face = faceOf(journal);

  return (
    <section className="panel space-y-3 px-4 py-4" aria-label={t('face.title')}>
      <h2 className="card-title">{t('face.title')}</h2>
      {face === undefined ? (
        <p className="prose-note">{t('face.pending')}</p>
      ) : (
        <div className="flex items-center gap-4">
          {/* 🔴 **C'est le cube qui porte le poids visuel, pas un cran de titre.** Le reflexe
              serait d'ecrire le nom de la face en gros — donc un `<p>` qui joue un titre,
              exactement le defaut que `TrajectorySection` traine (tache 7.16) et que
              `no-adhoc-typography` ne peut pas voir, puisqu'il ne regarde que les `<h*>`.
              Le meme cube que dans l'en-tete, en plus grand : c'est **la meme information**,
              et la voir ici est ce qui apprend a la lire la-haut. */}
          <Mark className="size-12" face={face.id} />
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t(`face.${face.id}`)}</p>
            <p className="text-(--color-muted)">{t(`face.why.${face.id}`)}</p>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { faceOf } from '@/src/domain/face';
import { Mark } from '@/app/components/Mark';
import { FaceDot } from '@/app/components/FaceDot';

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
    <section className="band" aria-label={t('face.title')}>
      <h2 className="row-title">{t('face.title')}</h2>
      {face === undefined ? (
        // 🔴 C'etait **un paragraphe gris nu**, et c'est le premier bloc sous le titre de la
        // page — donc la premiere chose que voit quiconque ouvre `/bilan` sans avoir encore
        // de face, c'est-a-dire tout le monde au debut. Vu sur la capture du 2026-08-11.
        //
        // Le cube neutre reprend exactement le role qu'il joue dans l'etat forme : porter le
        // poids visuel. Et les trois pastilles montrent **ce qu'on peut devenir** — le texte
        // annonce une attente, elles disent a quoi elle mene. C'est du contenu, pas un
        // ornement, et ca n'a coute aucun composant nouveau.
        <div className="flex items-center gap-4">
          {/* Sans `face`, le cube rend ses trois facettes vives — l'etat d'avant 9.2, intact.
              L'opacite dit « pas encore » sans afficher un manque. */}
          <Mark className="size-12 opacity-45" />
          <div className="space-y-2">
            <p className="prose-note">{t('face.pending')}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {(['finisher', 'cutter', 'rewatcher'] as const).map((id) => (
                <li key={id} className="flex items-center gap-1.5 meta-sm">
                  <FaceDot face={id} />
                  {t(`face.${id}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
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

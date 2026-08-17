'use client';

import { useState } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';

/**
 * Le coeur d'une critique.
 *
 * ## Pourquoi il a quitte `Reviews.tsx`
 *
 * Il y vivait en prive, et il n'y avait donc de coeur **que sur la fiche serie** — c'est la
 * moitie du defaut F4 : `likeReview` et le tri « les plus aimees » existaient, mais ni le
 * profil ni la vitrine de l'accueil ne les portaient, donc on ne pouvait pas aimer une
 * critique **la ou on la decouvre**. L'autre moitie etait dans la base, et c'est `022`.
 *
 * Le recopier dans les deux autres surfaces aurait donne trois boutons a maintenir : ce
 * depot a deja paye cette forme-la deux fois (`LibraryCard`/`SeriesCard` fusionnes en
 * `PosterToggle`, et les deux « Write what I thought »).
 *
 * ## ⚠️ Le nombre ne s'affiche qu'a partir de un
 *
 * Exception assumee a la regle 4 (2026-08-11), et `CLAUDE.md` la cite. Un « 0 » colle a un
 * coeur n'ouvre rien : il n'a ni cause a expliquer, ni geste a proposer que le coeur
 * lui-meme ne propose deja. La regle demande qu'un ecran vide dise quoi faire ; elle ne
 * demande pas qu'un compteur affiche zero.
 *
 * ## ⚠️ Ce composant ne decide PAS s'il a le droit d'exister
 *
 * Un coeur exige un compte, et on n'aime pas sa propre critique. Ces deux conditions sont
 * chez l'appelant, parce qu'elles dependent de ce qu'il sait deja (`account`, l'auteur de la
 * ligne) — et parce qu'un bouton qui ne peut pas marcher ne se degrade pas, il ne s'affiche
 * pas (regle du 2026-08-09). Les mettre ici ferait rendre `null` a trois appelants qui
 * savaient tous les trois d'avance.
 */
export function ReviewHeart({
  count,
  mine,
  onToggle,
}: {
  readonly count: number;
  readonly mine: boolean;
  readonly onToggle: (next: boolean) => Promise<boolean>;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={mine}
      aria-label={t(mine ? 'review.unlike' : 'review.like')}
      onClick={() => {
        setBusy(true);
        void onToggle(!mine).finally(() => setBusy(false));
      }}
      // 🔴 **10 x 20 px** mesures sur la production le 2026-08-17, sur trois surfaces : un
      // bouton a glyphe unique est large comme son glyphe, et le plancher de 24 px que ce
      // depot s'applique depuis le 2026-08-13 n'avait jamais ete pose ici. `tap-line` porte
      // les deux dimensions depuis ce jour ; `justify-center` centre le coeur dans sa cible.
      className={`tap-line justify-center gap-1.5 text-sm ${
        mine ? 'text-(--color-volt)' : 'text-(--color-muted) hover:text-(--color-text)'
      }`}
    >
      <span aria-hidden="true">{mine ? '♥' : '♡'}</span>
      {count > 0 ? <span className="numeric">{count}</span> : null}
    </button>
  );
}

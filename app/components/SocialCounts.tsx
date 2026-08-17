'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';
import { useSocial } from '@/app/social/useSocial';
import { journalKey } from '@/src/domain/journal';
import type { SubjectCounts } from '@/src/social/client';

/**
 * **Combien de gens, ici, l'ont vue** — F1.
 *
 * ## 🔴 Le piege que ce composant a du contourner, et il avait deja ete refuse
 *
 * Le reflexe est `count(*)`. Sous RLS il rend un chiffre **differemment faux pour chaque
 * lecteur** : toutes les tables sociales portent `can_see(user_id)`, donc la base ne compte
 * que ce que *ce* lecteur a le droit de voir. Deux personnes lisant la meme fiche verraient
 * deux nombres, et aucun des deux ne serait « le » nombre. Le lot 10.2 l'a refuse pour cette
 * raison, a raison.
 *
 * `027_counts.sql` prend la sortie deja employee trois fois — `stop_map`,
 * `review_like_counts`, `review_like_counts_across` : une fonction `security definer` qui ne
 * rend que des agregats. Aucune identite n'en sort.
 *
 * ## ⚠️ Le chiffre est un PLANCHER, et la phrase doit le dire
 *
 * La fonction ne compte que les profils **`public`** : exactement ce qu'un inconnu pourrait
 * deja denombrer en ouvrant les profils un par un. C'est ce qui la rend stable pour tout le
 * monde sans rien reveler de neuf — un compte total trahirait, sur une base a deux comptes,
 * ce que des profils fermes ont fait. L'accroche annonce donc « au moins », et ce n'est pas
 * une precaution de style : annoncer un total serait faux.
 *
 * ## ⚠️ Silence a zero — l'exception nommee dans `CLAUDE.md`
 *
 * *Ce qui n'a litteralement rien derriere sur une page par ailleurs pleine.* « 0 personne
 * l'a regardee » sur une fiche serie n'apprend rien au lecteur et ne lui donne aucun geste :
 * la fiche porte deja douze blocs, dont celui qui lui propose de la commencer. Ce n'est pas
 * une porte fermee, c'est une phrase qui n'existe pas encore.
 */
export function SocialCounts({ seriesId }: { readonly seriesId: string }) {
  const { t, tn } = useT();
  const social = useSocial();
  const [counts, setCounts] = useState<SubjectCounts | undefined>(undefined);

  const key = journalKey(seriesId);

  useEffect(() => {
    if (social === undefined) return;
    let alive = true;
    // ⚠️ Un lot d'un seul sujet : la fonction est batie pour vingt affiches d'un catalogue,
    // et l'appeler ainsi ici garde **une** forme d'appel pour les deux surfaces.
    void social.subjectCounts([key]).then((rows) => {
      if (alive) setCounts(rows[0]);
    });
    return () => {
      alive = false;
    };
  }, [social, key]);

  if (counts === undefined) return null;
  const { watched, loved, listed } = counts;
  if (watched === 0 && loved === 0 && listed === 0) return null;

  return (
    <p className="meta flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="meta-sm">{t('counts.here')}</span>
      {watched > 0 ? <span>{tn('counts.watched', watched)}</span> : null}
      {loved > 0 ? <span>{tn('counts.loved', loved)}</span> : null}
      {listed > 0 ? <span>{tn('counts.listed', listed)}</span> : null}
    </p>
  );
}

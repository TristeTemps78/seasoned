'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { Menu } from '@/app/components/Menu';
import { ALL_REVIEW_SORTS, type ReviewSort } from '@/src/domain/review-order';
import type { MessageKey } from '@/lib/i18n/engine';

const SORT_LABEL = {
  recent: 'review.sortRecent',
  liked: 'review.sortLiked',
} as const satisfies Record<ReviewSort, MessageKey>;

/**
 * « Les plus recentes / les plus aimees ».
 *
 * ## Pourquoi c'est un composant et pas deux tableaux de libelles
 *
 * Le tri des critiques n'existait que sur la fiche serie (M3) : le profil public rendait
 * une liste dans l'ordre de la base. En le posant aussi sur le profil, la table
 * `ReviewSort → cle de traduction` allait etre ecrite une seconde fois — et ce depot a deja
 * trouve quatre fois la forme « une decision ecrite deux fois qui finit par diverger ».
 *
 * ⚠️ Le tri marche **sans compte**, contrairement au filtre d'audience : c'est pour ca que
 * ce sont deux menus separes sur la fiche serie, et que celui-ci peut vivre seul ici.
 */
export function ReviewSortMenu({
  id,
  value,
  onChange,
}: {
  readonly id: string;
  readonly value: ReviewSort;
  readonly onChange: (sort: ReviewSort) => void;
}) {
  const { t } = useT();

  return (
    <Menu
      id={id}
      label={t('review.sort')}
      value={value}
      onChange={(next) => onChange(next as ReviewSort)}
      options={ALL_REVIEW_SORTS.map((one) => ({ value: one, label: t(SORT_LABEL[one]) }))}
    />
  );
}

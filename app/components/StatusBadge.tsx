import type { StatusResult } from '@/src/domain/status';
import { STATUS_TONE, describeStatus, statusLabel } from '@/lib/format';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

/**
 * Les tons de la pastille.
 *
 * Le fond reste discret et c'est **l'arete** qui porte la couleur : sur une grille de
 * vingt vignettes, vingt pastilles pleines rivalisent avec les affiches, alors que
 * l'affiche est l'interface. Un seul etat s'autorise une lueur —
 * `live`, celui qui veut dire « ca se passe maintenant ».
 */
const TONE_CLASS = {
  live: 'bg-(--color-live)/10 text-(--color-live) border-(--color-live)/40 shadow-[0_0_12px_-4px_var(--color-live)]',
  waiting: 'bg-(--color-volt)/10 text-(--color-volt) border-(--color-volt)/40',
  warning: 'bg-(--color-warn)/10 text-(--color-warn) border-(--color-warn)/40',
  neutral: 'bg-(--color-surface) text-(--color-muted) border-(--color-edge)',
} as const;

/**
 * La pastille de statut reel.
 *
 * C'est le differenciateur immediat de la phase 1 : tous les trackers affichent
 * « running » sans distinguer « en diffusion » de « entre deux saisons » de « declaree
 * vivante et morte depuis dix-huit mois ». L'utilisateur ne sait
 * donc pas s'il attend ou s'il abandonne. Ici, on le lui dit.
 */
export function StatusBadge({ status, withDetail = false, locale = DEFAULT_LOCALE }: {
  readonly status: StatusResult;
  readonly withDetail?: boolean;
  readonly locale?: Locale;
}) {
  const tone = STATUS_TONE[status.status];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}
      >
        {statusLabel(status.status, locale)}
      </span>
      {withDetail ? (
        <span className="text-sm text-(--color-muted)">{describeStatus(status, locale)}</span>
      ) : null}
    </div>
  );
}

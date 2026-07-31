import type { StatusResult } from '@/src/domain/status';
import { STATUS_LABEL, STATUS_TONE, describeStatus } from '@/lib/format';

const TONE_CLASS = {
  live: 'bg-(--color-live)/15 text-(--color-live) border-(--color-live)/30',
  warning: 'bg-(--color-warn)/15 text-(--color-warn) border-(--color-warn)/30',
  neutral: 'bg-(--color-surface) text-(--color-muted) border-(--color-edge)',
} as const;

/**
 * La pastille de statut reel.
 *
 * C'est le differenciateur immediat de la phase 1 : tous les trackers affichent
 * « running » sans distinguer « en diffusion » de « entre deux saisons » de « declaree
 * vivante et morte depuis dix-huit mois » (`RESEARCH.md` §3.4). L'utilisateur ne sait
 * donc pas s'il attend ou s'il abandonne. Ici, on le lui dit.
 */
export function StatusBadge({ status, withDetail = false }: {
  readonly status: StatusResult;
  readonly withDetail?: boolean;
}) {
  const tone = STATUS_TONE[status.status];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}
      >
        {STATUS_LABEL[status.status]}
      </span>
      {withDetail ? (
        <span className="text-sm text-(--color-muted)">{describeStatus(status)}</span>
      ) : null}
    </div>
  );
}

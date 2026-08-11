import type { StatusResult } from '@/src/domain/status';
import { Icon, type IconName } from '@/app/components/Icon';
import { STATUS_TONE, type StatusTone, describeStatus, statusLabel } from '@/lib/format';
import { DEFAULT_LOCALE, type Locale, translatorFor } from '@/lib/i18n';

/**
 * Les tons de la pastille.
 *
 * 🔴 **Elles etaient des contours a 10 % de fond**, et l'ancien commentaire disait pourquoi :
 * « vingt pastilles pleines rivalisent avec les affiches, alors que l'affiche est
 * l'interface ». L'argument est reel — et il a produit quatre pastilles qui, a un metre de
 * l'ecran, se lisent toutes comme le meme petit rectangle gris. Or c'est *le differenciateur
 * du produit* : la seule chose qu'aucun autre tracker n'affiche.
 *
 * Elles passent donc en **aplat plein sur encre sombre** (decision de Tristan, 2026-08-11).
 * Le risque nomme par l'ancien commentaire n'est pas imaginaire : si une grille de vingt
 * vignettes devient illisible, c'est **la**, et pas ailleurs, qu'il faudra revenir.
 */
const TONE_CLASS = {
  live: 'bg-(--color-live) text-(--color-ink) border-(--color-live) shadow-[0_0_18px_-5px_var(--color-live)]',
  waiting: 'bg-(--color-volt) text-(--color-ink) border-(--color-volt)',
  warning: 'bg-(--color-warn) text-(--color-ink) border-(--color-warn)',
  // ⚠️ Le neutre reste sourd, et c'est le seul qui le doive : « terminee » est l'etat de la
  // moitie du catalogue. Peint en couleur, il ferait crier la page entiere — et une page ou
  // tout crie ne met plus rien en avant.
  neutral: 'bg-(--color-surface-2) text-(--color-muted) border-(--color-edge)',
} as const;

/**
 * L'icone de chaque ton — le second canal, et c'est une exigence d'accessibilite avant d'etre
 * un ornement.
 *
 * ⚠️ Quatre pastilles qui ne different que par leur **couleur** sont quatre pastilles
 * identiques pour un daltonien deuteranope — c'est-a-dire environ un homme sur douze. Le
 * libelle etait deja la, l'icone ajoute une forme reconnaissable d'un coup d'oeil, sans
 * lecture.
 */
const TONE_ICON = {
  live: 'broadcast',
  waiting: 'clock',
  warning: 'alert',
  neutral: 'check',
} as const satisfies Readonly<Record<StatusTone, IconName>>;

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
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}
      >
        <Icon name={TONE_ICON[tone]} />
        {statusLabel(status.status, translatorFor(locale))}
      </span>
      {withDetail ? (
        <span className="meta">{describeStatus(status, translatorFor(locale))}</span>
      ) : null}
    </div>
  );
}

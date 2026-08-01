/**
 * Mise en mots des donnees derivees.
 *
 * Ce module est la ou le differenciateur devient visible. `deriveStatus` sait deja
 * qu'une serie est declaree vivante et sans episode depuis dix-huit mois ; encore
 * faut-il le **dire**, au lieu d'afficher « running » comme tout le monde
 * (`RESEARCH.md` §3.4).
 *
 * Pur et sans dependance a l'horloge : tout instant vient du domaine.
 */

import type { RealStatus, StatusResult } from '../src/domain/status';
import type { SeriesShape } from '../src/domain/seasons';

/** Libelle court, pour une pastille. */
export const STATUS_LABEL: Readonly<Record<RealStatus, string>> = {
  airing: 'En diffusion',
  between_seasons: 'Entre deux saisons',
  awaiting_renewal: 'Sans nouvelle',
  ended: 'Terminée',
  cancelled: 'Annulée',
  upcoming: 'À venir',
  unknown: 'Statut inconnu',
};

/** Ton de la pastille — trois niveaux, pour ne pas peindre un sapin de Noël. */
export type StatusTone = 'live' | 'neutral' | 'warning';

export const STATUS_TONE: Readonly<Record<RealStatus, StatusTone>> = {
  airing: 'live',
  between_seasons: 'neutral',
  awaiting_renewal: 'warning',
  ended: 'neutral',
  cancelled: 'warning',
  upcoming: 'neutral',
  unknown: 'neutral',
};

function months(days: number): number {
  return Math.round(days / 30.44);
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n <= 1 ? singular : pluralForm;
}

/**
 * Phrase explicative du statut — la partie qui a de la valeur.
 *
 * Le cas qui compte est `awaiting_renewal` : les fournisseurs la declarent vivante, les
 * trackers affichent « running », et l'utilisateur ne sait pas s'il attend ou s'il
 * abandonne. On lui donne le chiffre.
 */
export function describeStatus(status: StatusResult): string {
  const since = status.daysSinceLastAired;
  const until = status.daysUntilNext;

  switch (status.status) {
    case 'airing': {
      if (until !== undefined && until >= 0) {
        const days = Math.ceil(until);
        if (days === 0) return 'Nouvel épisode aujourd’hui.';
        if (days === 1) return 'Nouvel épisode demain.';
        return `Nouvel épisode dans ${days} jours.`;
      }
      if (since !== undefined) {
        const days = Math.floor(since);
        if (days <= 1) return 'Un épisode vient de sortir.';
        return `Dernier épisode il y a ${days} jours.`;
      }
      return 'Des épisodes sortent en ce moment.';
    }

    case 'between_seasons': {
      if (since === undefined) return 'Saison terminée, la suite est attendue.';
      const m = months(since);
      return `Saison terminée il y a ${m} ${plural(m, 'mois', 'mois')}. La suite est attendue.`;
    }

    case 'awaiting_renewal': {
      if (since === undefined) return 'Annoncée comme revenant, sans signe de vie.';
      const m = months(since);
      // La formulation dit le fait et laisse conclure : on ne declare pas une serie
      // morte a la place de ses producteurs.
      return `Annoncée comme revenant, mais aucun épisode depuis ${m} mois.`;
    }

    case 'ended':
      return 'Terminée. Elle a une fin.';

    case 'cancelled':
      return 'Annulée. Elle peut s’arrêter sans conclusion.';

    case 'upcoming':
      return 'Annoncée, rien n’a encore été diffusé.';

    case 'unknown':
      return 'Données de diffusion insuffisantes pour trancher.';
  }
}

/**
 * Version courte du statut, pour une vignette.
 *
 * Porte **le chiffre**, pas seulement l'etat : c'est lui la valeur (`TASKS.md`,
 * « chasse au zombie »). « en attente · 11 mois » repond a la question du spectateur
 * — j'attends ou j'abandonne ? — la ou « Returning Series » ne dit rien.
 *
 * Renvoie `undefined` quand il n'y a rien d'utile a dire : une vignette muette vaut
 * mieux qu'une vignette qui repete l'evidence.
 */
export function shortStatus(status: StatusResult): string | undefined {
  const since = status.daysSinceLastAired;
  const until = status.daysUntilNext;

  switch (status.status) {
    case 'airing':
      if (until !== undefined && until >= 0) {
        const days = Math.ceil(until);
        if (days === 0) return 'ép. aujourd’hui';
        if (days === 1) return 'ép. demain';
        return `ép. dans ${days} j`;
      }
      return 'en cours';

    case 'between_seasons':
      return since === undefined ? 'en attente' : `en attente · ${months(since)} mois`;

    case 'awaiting_renewal':
      return since === undefined
        ? 'sans nouvelle'
        : `sans nouvelle · ${months(since)} mois`;

    case 'cancelled':
      return 'annulée';

    case 'upcoming':
      return 'à venir';

    // « Terminée » n'apprend rien d'urgent sur une vignette, et « statut inconnu »
    // encore moins : on laisse l'affiche parler.
    case 'ended':
    case 'unknown':
      return undefined;
  }
}

/**
 * Engagement total demande, en clair.
 *
 * La reponse a « ca vaut mes 40 heures ? ». On donne les heures, parce que c'est
 * l'unite dans laquelle les gens comptent leur temps libre — pas les minutes.
 */
export function formatCommitment(totalMinutes: number): string {
  const hours = Math.round(totalMinutes / 60);
  if (hours < 1) return 'moins d’une heure';
  if (hours < 48) return `${hours} ${plural(hours, 'heure', 'heures')}`;

  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (rest === 0) return `${hours} heures — ${days} jours pleins`;
  return `${hours} heures — ${days} jours et ${rest} h`;
}

/** Année d'une date, ou `undefined`. Sert aux titres et aux URL. */
export function year(date: Date | undefined): number | undefined {
  return date?.getUTCFullYear();
}

export const SHAPE_LABEL: Readonly<Record<SeriesShape, string>> = {
  miniseries: 'Mini-série',
  multi_season: 'Série',
  unknown: 'Série',
};

/** Date longue en français, en UTC pour rester stable d'un serveur à l'autre. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

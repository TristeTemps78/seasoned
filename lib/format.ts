/**
 * Mise en mots des donnees derivees.
 *
 * Ce module est la ou le differenciateur devient visible. `deriveStatus` sait deja
 * qu'une serie est declaree vivante et sans episode depuis dix-huit mois ; encore
 * faut-il le **dire**, au lieu d'afficher « running » comme tout le monde.
 *
 * Pur et sans dependance a l'horloge : tout instant vient du domaine.
 *
 * ## Pourquoi c'est **ce** module qu'on internationalise en premier
 *
 * Parce que c'est lui qui est indexe. Le domaine calcule sans langue — « il y a 26 mois »
 * est un nombre, pas une phrase — mais c'est ici que ce nombre devient le texte que
 * Google lit et qu'un lecteur reconnait. Traduire l'interface sans traduire ces
 * phrases-la donnerait un site anglais dont la seule chose qui le distingue reste en
 * francais.
 *
 * La locale est un **parametre avec valeur par defaut**, et non une variable de module :
 * un module a etat global rendrait ces fonctions dependantes de l'ordre d'appel, donc
 * intestables et fausses des que deux langues sont rendues dans le meme processus — ce
 * qui est exactement le cas d'un serveur.
 */

import type { RealStatus, StatusResult } from '../src/domain/status';
import { DEFAULT_LOCALE, localeTag, t, tn, type Locale } from './i18n';

/** Libelle court, pour une pastille. */
export function statusLabel(status: RealStatus, locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, `status.${status}`);
}

/** Ton de la pastille — trois niveaux, pour ne pas peindre un sapin de Noël. */
export type StatusTone = 'live' | 'waiting' | 'neutral' | 'warning';

export const STATUS_TONE: Readonly<Record<RealStatus, StatusTone>> = {
  airing: 'live',
  // ⚠️ `waiting` et non `neutral`, corrige le 2026-08-03. « En attente · 7 mois » est
  // **le differenciateur du produit** — la reponse chiffree que personne d'autre
  // n'affiche — et il etait peint en gris, c'est-a-dire comme une metadonnee de second
  // rang. Il porte desormais l'accent du produit : ni « ca se passe maintenant » (live),
  // ni « anomalie » (warning), mais **l'attente qualifiee**.
  between_seasons: 'waiting',
  awaiting_renewal: 'warning',
  ended: 'neutral',
  cancelled: 'warning',
  upcoming: 'waiting',
  unknown: 'neutral',
};

function months(days: number): number {
  return Math.round(days / 30.44);
}

/**
 * Phrase explicative du statut — la partie qui a de la valeur.
 *
 * Le cas qui compte est `awaiting_renewal` : les fournisseurs la declarent vivante, les
 * trackers affichent « running », et l'utilisateur ne sait pas s'il attend ou s'il
 * abandonne. On lui donne le chiffre.
 */
export function describeStatus(status: StatusResult, locale: Locale = DEFAULT_LOCALE): string {
  const since = status.daysSinceLastAired;
  const until = status.daysUntilNext;

  switch (status.status) {
    case 'airing': {
      if (until !== undefined && until >= 0) {
        const days = Math.ceil(until);
        if (days === 0) return t(locale, 'say.airing.today');
        if (days === 1) return t(locale, 'say.airing.tomorrow');
        return tn(locale, 'say.airing.inDays', days);
      }
      if (since !== undefined) {
        const days = Math.floor(since);
        if (days <= 1) return t(locale, 'say.airing.justAired');
        return tn(locale, 'say.airing.lastAired', days);
      }
      return t(locale, 'say.airing.plain');
    }

    case 'between_seasons': {
      if (since === undefined) return t(locale, 'say.between.plain');
      return tn(locale, 'say.between.since', months(since));
    }

    case 'awaiting_renewal': {
      if (since === undefined) return t(locale, 'say.awaiting.plain');
      // La formulation dit le fait et laisse conclure : on ne declare pas une serie
      // morte a la place de ses producteurs.
      return tn(locale, 'say.awaiting.since', months(since));
    }

    case 'ended':
      return t(locale, 'say.ended');

    case 'cancelled':
      return t(locale, 'say.cancelled');

    case 'upcoming':
      return t(locale, 'say.upcoming');

    case 'unknown':
      return t(locale, 'say.unknown');
  }
}

/**
 * Version courte du statut, pour une vignette.
 *
 * Porte **le chiffre**, pas seulement l'etat : c'est lui la valeur (
 * « chasse au zombie »). « en attente · 11 mois » repond a la question du spectateur
 * — j'attends ou j'abandonne ? — la ou « Returning Series » ne dit rien.
 *
 * Renvoie `undefined` quand il n'y a rien d'utile a dire : une vignette muette vaut
 * mieux qu'une vignette qui repete l'evidence.
 */
export function shortStatus(
  status: StatusResult,
  locale: Locale = DEFAULT_LOCALE,
): string | undefined {
  const since = status.daysSinceLastAired;
  const until = status.daysUntilNext;

  switch (status.status) {
    case 'airing':
      if (until !== undefined && until >= 0) {
        const days = Math.ceil(until);
        if (days === 0) return t(locale, 'chip.today');
        if (days === 1) return t(locale, 'chip.tomorrow');
        return tn(locale, 'chip.inDays', days);
      }
      return t(locale, 'chip.airing');

    case 'between_seasons':
      return since === undefined
        ? t(locale, 'chip.waiting')
        : tn(locale, 'chip.waitingSince', months(since));

    case 'awaiting_renewal':
      return since === undefined
        ? t(locale, 'chip.silent')
        : tn(locale, 'chip.silentSince', months(since));

    case 'cancelled':
      return t(locale, 'chip.cancelled');

    case 'upcoming':
      return t(locale, 'chip.upcoming');

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
export function formatCommitment(
  totalMinutes: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const hours = Math.round(totalMinutes / 60);
  if (hours < 1) return t(locale, 'commit.underHour');
  if (hours < 48) return tn(locale, 'commit.hours', hours);

  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  // Le nombre qui porte l'accord est le nombre de **jours** : c'est lui qu'on lit.
  if (rest === 0) return tn(locale, 'commit.days', days, { n: hours, d: days });
  return tn(locale, 'commit.daysAndHours', days, { n: hours, d: days, r: rest });
}

/** Année d'une date, ou `undefined`. Sert aux titres et aux URL. */
export function year(date: Date | undefined): number | undefined {
  return date?.getUTCFullYear();
}

/** Date longue, dans la langue demandee, en UTC pour rester stable d'un serveur a l'autre. */
export function formatDate(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

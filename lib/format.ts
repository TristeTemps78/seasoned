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
 * ## Ce qui se passe est **passe en parametre**, et jamais lu dans un etat de module
 *
 * Un module a etat global rendrait ces fonctions dependantes de l'ordre d'appel, donc
 * intestables et fausses des que deux langues sont rendues dans le meme processus — ce qui
 * est exactement le cas d'un serveur.
 *
 * ⚠️ **Un {@link Translator}, et plus une `Locale` (8.10).** Recevoir une langue obligeait ce
 * module a savoir ou trouver les phrases, donc a importer les deux dictionnaires — et six
 * composants client l'importent. Recevoir de quoi traduire supprime la dependance a la
 * source : un composant client passe son `useT()`, un composant serveur passe
 * `translatorFor(locale)`, et le navigateur ne charge que la langue de sa page.
 *
 * ⚠️ **Aucune valeur par defaut**, volontairement : une valeur par defaut exigerait un
 * dictionnaire ici, ce qui rouvrirait exactement ce qu'on vient de fermer. Le typage oblige
 * donc chaque appelant a dire dans quelle langue il ecrit — et c'est bien la question a
 * poser a un endroit qui produit du texte indexe.
 *
 * {@link formatDate} garde une `Locale` : elle formate une date, elle ne traduit rien.
 */

import type { RealStatus, StatusResult } from '../src/domain/status';
// ⚠️ Depuis `./i18n/engine` : ce module est appele par six composants **client**, et
// `./i18n` porte les deux dictionnaires (8.10). Les phrases arrivent desormais par le
// {@link Translator} qu'on lui passe — il ne sait plus d'ou elles viennent, et c'est
// exactement ce qui permet au navigateur de n'en charger qu'une langue.
import { DEFAULT_LOCALE, localeTag, type Locale, type Translator } from './i18n/engine';

/** Libelle court, pour une pastille. */
export function statusLabel(status: RealStatus, tr: Translator): string {
  return tr.t(`status.${status}`);
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
export function describeStatus(status: StatusResult, tr: Translator): string {
  const since = status.daysSinceLastAired;
  const until = status.daysUntilNext;

  switch (status.status) {
    case 'airing': {
      if (until !== undefined && until >= 0) {
        const days = Math.ceil(until);
        if (days === 0) return tr.t('say.airing.today');
        if (days === 1) return tr.t('say.airing.tomorrow');
        return tr.tn('say.airing.inDays', days);
      }
      if (since !== undefined) {
        const days = Math.floor(since);
        if (days <= 1) return tr.t('say.airing.justAired');
        return tr.tn('say.airing.lastAired', days);
      }
      return tr.t('say.airing.plain');
    }

    case 'between_seasons': {
      if (since === undefined) return tr.t('say.between.plain');
      return tr.tn('say.between.since', months(since));
    }

    case 'awaiting_renewal': {
      if (since === undefined) return tr.t('say.awaiting.plain');
      // La formulation dit le fait et laisse conclure : on ne declare pas une serie
      // morte a la place de ses producteurs.
      return tr.tn('say.awaiting.since', months(since));
    }

    case 'ended':
      return tr.t('say.ended');

    case 'cancelled':
      return tr.t('say.cancelled');

    case 'upcoming':
      return tr.t('say.upcoming');

    case 'unknown':
      return tr.t('say.unknown');
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
export function shortStatus(status: StatusResult, tr: Translator): string | undefined {
  const since = status.daysSinceLastAired;
  const until = status.daysUntilNext;

  switch (status.status) {
    case 'airing':
      if (until !== undefined && until >= 0) {
        const days = Math.ceil(until);
        if (days === 0) return tr.t('chip.today');
        if (days === 1) return tr.t('chip.tomorrow');
        return tr.tn('chip.inDays', days);
      }
      return tr.t('chip.airing');

    case 'between_seasons':
      return since === undefined
        ? tr.t('chip.waiting')
        : tr.tn('chip.waitingSince', months(since));

    case 'awaiting_renewal':
      return since === undefined
        ? tr.t('chip.silent')
        : tr.tn('chip.silentSince', months(since));

    case 'cancelled':
      return tr.t('chip.cancelled');

    case 'upcoming':
      return tr.t('chip.upcoming');

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
export function formatCommitment(totalMinutes: number, tr: Translator): string {
  const hours = Math.round(totalMinutes / 60);
  if (hours < 1) return tr.t('commit.underHour');
  if (hours < 48) return tr.tn('commit.hours', hours);

  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  // Le nombre qui porte l'accord est le nombre de **jours** : c'est lui qu'on lit.
  if (rest === 0) return tr.tn('commit.days', days, { n: hours, d: days });
  return tr.tn('commit.daysAndHours', days, { n: hours, d: days, r: rest });
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

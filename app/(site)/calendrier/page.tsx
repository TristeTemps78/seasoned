import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Agenda } from '@/app/components/Agenda';

/**
 * La face « Calendrier ».
 *
 * Statique comme `/moi`, et pour les memes raisons : le HTML est mis en cache au bord et
 * **partage entre tous les visiteurs**, donc aucun composant serveur ne doit lire un
 * journal. Tout le contenu arrive apres coup, dans le navigateur.
 *
 * ⚠️ **L'adresse reste `/calendrier` dans les deux langues.** C'est deliberement
 * incoherent avec l'anglais servi par defaut, et c'est la meme decision que `/serie/…` et
 * `/convertir` : les chemins du site sont en francais depuis le premier jour, et les
 * traduire casserait les URL deja indexees pour un gain nul — personne ne cherche un site
 * par la langue de son chemin.
 */
export const dynamic = 'force-static';

export function agendaMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'agenda.title'),
    // Vue d'un robot, cette page est vide par construction : son contenu vit dans le
    // journal du visiteur. La faire explorer gaspillerait le budget de crawl qui doit
    // aller sur `/serie/*`.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = agendaMetadata(DEFAULT_LOCALE);

export function AgendaView({ locale: _locale }: { readonly locale: Locale }) {
  // La locale voyage par le contexte (`LocaleProvider`), pose par la disposition racine :
  // `Agenda` est un composant client et lit `useT()`.
  return <Agenda />;
}

export default function CalendarPage() {
  return <AgendaView locale={DEFAULT_LOCALE} />;
}

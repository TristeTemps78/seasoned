import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Agenda } from '@/app/components/Agenda';
import { FaceDiscovery } from '@/app/components/FaceDiscovery';
import { PosterRail } from '@/app/components/PosterRail';
import { discover } from '@/lib/catalog';

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

/**
 * Un rendu par jour, pour la rangee de decouverte — **pas un par visite**.
 *
 * Le journal du visiteur continue d'arriver dans le navigateur ; ce qui se regenere ici, ce
 * sont les douze affiches proposees a qui n'en a pas encore. Un appel au catalogue par jour
 * et par face, quel que soit le trafic : le meme marche que l'accueil, qui en fait une
 * soixantaine.
 */
export const revalidate = 86_400;

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

export async function AgendaView({ locale }: { readonly locale: Locale }) {
  // ⚠️ `on_the_air` **page 2**, et pas la page 1 : l'accueil montre deja la premiere sous
  // « En cours de diffusion ». Un visiteur qui arrive par l'accueil puis ouvre le calendrier
  // verrait sinon les douze memes affiches, ce qui est exactement le defaut qu'on corrige.
  // C'est la source qui va a cette face : le calendrier parle de dates, ce sont les series
  // qui en ont.
  const airing = await discover('on_the_air', 2, locale);

  return (
    <>
      {/* La locale voyage par le contexte (`LocaleProvider`), pose par la disposition
          racine : `Agenda` est un composant client et lit `useT()`. */}
      <Agenda />

      <FaceDiscovery>
        <PosterRail
          title={t(locale, 'discovery.calendar.title')}
          subtitle={t(locale, 'discovery.calendar.subtitle')}
          series={airing.slice(0, 12).map((summary) => ({ summary }))}
          locale={locale}
        />
      </FaceDiscovery>
    </>
  );
}

export default function CalendarPage() {
  return <AgendaView locale={DEFAULT_LOCALE} />;
}

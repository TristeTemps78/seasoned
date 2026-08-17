import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { PublicProfile } from '@/app/components/PublicProfile';
import { handleFromPath } from '@/src/domain/handles';

/**
 * La page publique de quelqu'un — `/u/<nom>`.
 *
 * ## Pourquoi une route dynamique, alors que le depot compte ses invocations
 *
 * ⚠️ Meme motif que `/serie/[id]`, et pour la meme raison : `force-static` sans
 * `generateStaticParams` fait rendre la page **a la premiere demande** puis la sert depuis
 * le cache. `dynamicParams` restant vrai, un nom encore inconnu est rendu a la volee et mis
 * en cache a son tour. Ce n'est donc pas une invocation par visite — le cout que ce projet
 * refuse depuis le debut — mais une par nom, amortie ensuite.
 *
 * Et la coquille est **vide de donnees** : `can_see` depend de qui demande, donc deux
 * lecteurs ne voient pas le meme profil. Mettre en cache un contenu personnalise serait un
 * defaut de securite ; c'est le navigateur qui remplit, avec la session du lecteur.
 *
 * ## Jamais indexee, et c'est coherent
 *
 * `robots: index: false` — la visibilite par defaut d'un profil est `followers` (Q1), donc
 * un moteur, qui est un inconnu, ne verrait de toute facon rien. Indexer une page vide
 * n'apporte rien et ferait entrer les noms des gens dans les moteurs, ce que personne n'a
 * demande.
 */
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly handle: string }>;
}

/**
 * ⚠️ Meme raisonnement que pour une liste, et meme garde : le nom vient de l'adresse, verifie
 * par `handleFromPath`, et rien n'est lu en base — le contenu depend de qui regarde, donc
 * une carte de partage ne peut annoncer que ce que l'adresse dit deja.
 */
export function ProfileMetadata(locale: Locale, handle?: string): Metadata {
  const named = handle === undefined ? undefined : handleFromPath(handle);
  const title =
    named === undefined
      ? t(locale, 'profile.title')
      : t(locale, 'profile.share.title', { who: named });

  return {
    title,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: t(locale, 'profile.share.body'),
      type: 'profile',
    },
    twitter: { card: 'summary', title, description: t(locale, 'profile.share.body') },
  };
}

/* ⚠️ Pas de `metadata` constante a cote : Next refuse les deux exports ensemble, et c'est
   la fonction qui sait lire l'adresse. Le `ProfileMetadata` exporte reste la source des deux
   langues — la jumelle francaise l'appelle avec la sienne. */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return ProfileMetadata(DEFAULT_LOCALE, decodeURIComponent(handle));
}

/**
 * ⚠️ Aucune prop `locale` n'est passee au composant : il lit la sienne dans
 * `LocaleProvider`, pose par la disposition racine de chaque langue. La lui donner en plus
 * creerait deux sources de verite pour une meme information, et c'est celle qu'on oublie de
 * mettre a jour qui gagne.
 */
export async function ProfileView({ params }: { readonly params: PageProps['params'] }) {
  const { handle } = await params;
  return <PublicProfile handle={decodeURIComponent(handle)} />;
}

export default async function ProfilePage({ params }: PageProps) {
  return <ProfileView params={params} />;
}

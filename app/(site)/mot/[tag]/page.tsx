import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { WordPage } from '@/app/components/WordPage';

/**
 * La page d'un mot — `/mot/<mot>`.
 *
 * ## Meme motif de cache que `/u/[handle]`, et pour la meme raison
 *
 * `force-static` sans `generateStaticParams` : la coquille est rendue a la premiere demande
 * puis servie depuis le cache, et un mot encore inconnu est rendu a la volee. Ce n'est donc
 * pas une invocation par visite — le cout que ce projet refuse — mais une par mot, amortie
 * ensuite. La coquille est **vide de donnees** : `tags_select` porte `can_see`, donc deux
 * lecteurs ne voient pas la meme page, et mettre en cache un contenu personnalise serait un
 * defaut de securite.
 *
 * ## ⚠️ Jamais indexee, contrairement a une fiche serie
 *
 * `robots: index: false`. Un moteur est un inconnu : il ne verrait que les mots des profils
 * publics, c'est-a-dire une page a moitie vide dont le contenu depend du lecteur. Et surtout,
 * indexer les mots de quelqu'un ferait entrer son vocabulaire prive dans les moteurs, ce que
 * personne n'a demande — meme raisonnement que `/u/<nom>`.
 */
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly tag: string }>;
}

export function wordMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'word.title'),
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = wordMetadata(DEFAULT_LOCALE);

/**
 * ⚠️ Aucune prop `locale` : le composant lit la sienne dans `LocaleProvider`. La lui donner
 * en plus creerait deux sources de verite pour une meme information.
 */
export async function WordView({ params }: { readonly params: PageProps['params'] }) {
  const { tag } = await params;
  return <WordPage word={decodeURIComponent(tag)} />;
}

export default async function WordRoute({ params }: PageProps) {
  return <WordView params={params} />;
}

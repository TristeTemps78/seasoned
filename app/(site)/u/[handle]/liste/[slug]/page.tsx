import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { PublicList } from '@/app/components/PublicList';

/**
 * Une liste, seule, a son adresse — `/u/<nom>/liste/<slug>`.
 *
 * ## Pourquoi elle est imbriquee sous le profil et non a la racine
 *
 * Une liste n'existe que par la personne qui la tient : deux `slug` identiques chez deux
 * auteurs sont deux listes differentes, et la cle primaire de `lists` est bien
 * `(user_id, slug)`. Une adresse `/liste/<slug>` devrait donc porter le nom de l'auteur
 * ailleurs, en parametre — ce qui donnerait deux facons d'ecrire la meme chose.
 *
 * ## Meme motif de cache que `/u/[handle]` et `/serie/[id]`
 *
 * ⚠️ `force-static` **sans** `generateStaticParams` : la page est rendue a la premiere demande
 * puis servie depuis le cache, et `dynamicParams` restant vrai, une liste encore inconnue est
 * rendue a la volee. Ce n'est pas une invocation par visite — le cout que ce projet refuse
 * depuis le debut — mais une par liste, amortie ensuite.
 *
 * Et la coquille est **vide de donnees** : `can_see` depend de qui demande, donc deux lecteurs
 * ne voient pas la meme liste. Mettre en cache un contenu personnalise serait un defaut de
 * securite ; c'est le navigateur qui remplit, avec la session du lecteur.
 *
 * ## Jamais indexee, pour la meme raison que le profil
 *
 * La visibilite par defaut d'un profil est `followers` (Q1), donc un moteur — qui est un
 * inconnu — ne verrait rien. Indexer une page vide n'apporte rien et ferait entrer les noms
 * des gens dans les moteurs, ce que personne n'a demande.
 */
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly handle: string; readonly slug: string }>;
}

export function ListMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'list.title'),
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = ListMetadata(DEFAULT_LOCALE);

/**
 * ⚠️ Aucune prop `locale` n'est passee au composant : il lit la sienne dans `LocaleProvider`.
 * La lui donner en plus creerait deux sources de verite pour une meme information, et c'est
 * celle qu'on oublie de mettre a jour qui gagne.
 */
export async function ListView({ params }: { readonly params: PageProps['params'] }) {
  const { handle, slug } = await params;
  return <PublicList handle={decodeURIComponent(handle)} slug={decodeURIComponent(slug)} />;
}

export default async function ListPage({ params }: PageProps) {
  return <ListView params={params} />;
}

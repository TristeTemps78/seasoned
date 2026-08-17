import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { PublicList } from '@/app/components/PublicList';
import { handleFromPath } from '@/src/domain/handles';

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

/**
 * 🔴 **Une liste se fabrique pour quelqu'un, donc on l'envoie — et l'apercu du lien parlait
 * du site.** Mesure le 2026-08-18 sur la production : `og:title` valait « Voltface —
 * est-ce que ca vaut le coup ? » et la description celle de l'accueil. Le destinataire d'une
 * liste voyait donc une carte qui ne disait rien de ce qu'on venait de lui envoyer — sur la
 * seule surface du produit dont l'existence entiere tient au partage (F5, F9).
 *
 * ⚠️ **Le nom vient de l'adresse, et il est verifie.** `dynamicParams` laisse arriver
 * n'importe quelle chaine : la recopier dans une carte de partage reviendrait a laisser
 * ecrire l'apercu par celui qui envoie le lien. `handleFromPath` rend `undefined` si la forme
 * n'est pas celle d'un handle, et le titre retombe alors sur le generique — vrai, lui.
 *
 * ⚠️ **Aucune lecture de base.** Le vrai titre de la liste est derriere RLS, donc il
 * demanderait un appel par page servie a un lecteur anonyme — le cout par visite que ce
 * produit refuse. Ce qu'on annonce est ce que l'adresse dit deja : de qui elle vient.
 */
export function ListMetadata(locale: Locale, handle?: string): Metadata {
  const named = handle === undefined ? undefined : handleFromPath(handle);
  const title =
    named === undefined ? t(locale, 'list.title') : t(locale, 'list.share.title', { who: named });

  return {
    title,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: t(locale, 'list.share.body'),
      type: 'website',
    },
    twitter: { card: 'summary', title, description: t(locale, 'list.share.body') },
  };
}

export const metadata: Metadata = ListMetadata(DEFAULT_LOCALE);

/**
 * ⚠️ Les metadonnees sont **par requete** ici, alors que la page reste `force-static` : Next
 * les calcule au rendu de la coquille, qui est mise en cache par adresse. Une liste servie
 * mille fois n'en coute donc pas mille.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return ListMetadata(DEFAULT_LOCALE, decodeURIComponent(handle));
}

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

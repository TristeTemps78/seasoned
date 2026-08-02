import type { Metadata } from 'next';
import { SeriesView, seriesMetadata } from '@/app/(site)/serie/[id]/page';

/**
 * La meme page serie, en francais.
 *
 * ## Pourquoi ce fichier ne contient presque rien
 *
 * Une traduction ne doit pas etre une copie. Deux fichiers de trois cents lignes qui
 * disent la meme chose divergent en quelques semaines : on corrige un defaut d'un cote,
 * on l'oublie de l'autre, et la version la moins visitee devient la plus fausse — ce qui
 * est exactement le sort qui attend une langue secondaire. Ici, la vue et les
 * metadonnees sont **les memes fonctions**, appelees avec une autre langue. Il n'y a
 * qu'un seul endroit ou corriger quoi que ce soit.
 *
 * Le budget est identique a celui de la version anglaise, et pour la meme raison :
 * `force-static` plus `revalidate` (cf. la route anglaise). Une langue de plus ne coute
 * que les series **reellement visitees** dans cette langue — le rendu est a la demande,
 * rien n'est pre-genere.
 */
export const revalidate = 86_400;
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return seriesMetadata(id, 'fr');
}

export default async function FrenchSeriesPage({ params }: PageProps) {
  const { id } = await params;
  return <SeriesView id={id} locale="fr" />;
}

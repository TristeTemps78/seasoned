import type { Metadata } from 'next';
import { ListMetadata, ListView } from '@/app/(site)/u/[handle]/liste/[slug]/page';

/**
 * Une liste seule, en francais.
 *
 * ⚠️ Le jumeau exact de `/u/[handle]/liste/[slug]` : seule la disposition racine change, et
 * c'est elle qui porte `lang` et le fournisseur de langue. Voir l'original pour le motif de
 * cache et la raison pour laquelle la page n'est pas indexee.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = ListMetadata('fr');

interface PageProps {
  readonly params: Promise<{ readonly handle: string; readonly slug: string }>;
}

export default async function FrenchListPage({ params }: PageProps) {
  return <ListView params={params} />;
}

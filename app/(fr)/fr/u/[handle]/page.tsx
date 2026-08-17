import type { Metadata } from 'next';
import { ProfileMetadata, ProfileView } from '@/app/(site)/u/[handle]/page';

/**
 * La page publique de quelqu'un, en francais.
 *
 * ⚠️ Le jumeau exact de `/u/[handle]` : seule la disposition racine change, et c'est elle
 * qui porte `lang` et le fournisseur de langue. Voir l'original pour le motif de cache et la
 * raison pour laquelle la page n'est pas indexee.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = ProfileMetadata('fr');

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return ProfileMetadata('fr', decodeURIComponent(handle));
}

interface PageProps {
  readonly params: Promise<{ readonly handle: string }>;
}

export default async function FrenchProfilePage({ params }: PageProps) {
  return <ProfileView params={params} />;
}

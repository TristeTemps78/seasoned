import type { Metadata } from 'next';
import { PersonView, personMetadata } from '@/app/(site)/personne/[id]/page';

/** Une personne, en francais — meme composant, autre langue. */
export const revalidate = 86_400;
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return personMetadata(id, 'fr');
}

export default async function FrenchPersonPage({ params }: PageProps) {
  const { id } = await params;
  return <PersonView id={id} locale="fr" />;
}

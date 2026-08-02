import type { Metadata } from 'next';
import { ConvertView, convertMetadata } from '@/app/(site)/convertir/page';

/** La page de reprise d'historique, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = convertMetadata('fr');

export default function FrenchConvertPage() {
  return <ConvertView locale="fr" />;
}

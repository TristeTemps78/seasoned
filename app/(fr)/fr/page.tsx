import type { Metadata } from 'next';
import { Home } from '@/app/(site)/page';
import { alternatesFor } from '@/lib/routes';

/** L'accueil en francais — meme composant, autre langue. Voir `app/fr/serie/[id]`. */
export const revalidate = 86_400;

export const metadata: Metadata = { alternates: alternatesFor('/', 'fr') };

export default async function FrenchHomePage() {
  return <Home locale="fr" />;
}

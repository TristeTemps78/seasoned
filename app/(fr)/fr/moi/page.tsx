import type { Metadata } from 'next';
import { LibraryView, libraryMetadata } from '@/app/(site)/moi/page';

/** Ma bibliotheque, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = libraryMetadata('fr');

export default function FrenchLibraryPage() {
  return <LibraryView locale="fr" />;
}

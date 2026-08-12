import type { Metadata } from 'next';
import { LibraryView, libraryMetadata } from '@/app/(site)/moi/page';

/** Ma bibliotheque, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

/** Meme regeneration quotidienne que la route anglaise : la rangee de decouverte en vit. */
export const revalidate = 86_400;

export const metadata: Metadata = libraryMetadata('fr');

export default function FrenchLibraryPage() {
  return <LibraryView locale="fr" />;
}

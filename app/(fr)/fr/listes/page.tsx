import type { Metadata } from 'next';
import { ListsView, listsMetadata } from '@/app/(site)/listes/page';

/** Mes listes, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = listsMetadata('fr');

export default function FrenchListsPage() {
  return <ListsView locale="fr" />;
}

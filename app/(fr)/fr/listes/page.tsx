import type { Metadata } from 'next';
import { ListsView, listsMetadata } from '@/app/(site)/listes/page';

/** Mes listes, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

/** Meme regeneration quotidienne que la route anglaise : la rangee de decouverte en vit. */
export const revalidate = 86_400;

export const metadata: Metadata = listsMetadata('fr');

export default function FrenchListsPage() {
  return <ListsView locale="fr" />;
}

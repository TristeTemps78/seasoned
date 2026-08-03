import type { Metadata } from 'next';
import { FriendsView, friendsMetadata } from '@/app/(site)/amis/page';

/** Mes amis, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = friendsMetadata('fr');

export default function FrenchFriendsPage() {
  return <FriendsView locale="fr" />;
}

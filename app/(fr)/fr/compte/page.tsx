import type { Metadata } from 'next';
import { AccountView, accountMetadata } from '@/app/(site)/compte/page';

/** Mon compte, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = accountMetadata('fr');

export default function FrenchAccountPage() {
  return <AccountView locale="fr" />;
}

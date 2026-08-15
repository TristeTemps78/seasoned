import type { Metadata } from 'next';
import { JournalView, journalMetadata } from '@/app/(site)/journal/page';

/** Le journal date, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = journalMetadata('fr');

export default function FrenchJournalPage() {
  return <JournalView />;
}

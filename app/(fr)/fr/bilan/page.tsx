import type { Metadata } from 'next';
import { TallyView, tallyMetadata } from '@/app/(site)/bilan/page';

/** Mon bilan, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = tallyMetadata('fr');

export default function FrenchTallyPage() {
  return <TallyView locale="fr" />;
}

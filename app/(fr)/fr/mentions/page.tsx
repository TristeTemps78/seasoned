import type { Metadata } from 'next';
import { LegalView, legalMetadata } from '@/app/(site)/mentions/page';

/** Mentions legales, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = legalMetadata('fr');

export default function FrenchLegalPage() {
  return <LegalView locale="fr" />;
}

import type { Metadata } from 'next';
import { PrivacyView, privacyMetadata } from '@/app/(site)/confidentialite/page';

/** Confidentialite, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = privacyMetadata('fr');

export default function FrenchPrivacyPage() {
  return <PrivacyView locale="fr" />;
}

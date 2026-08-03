import type { Metadata } from 'next';
import { RulesView, rulesMetadata } from '@/app/(site)/regles/page';

/** Les regles et le point de contact, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = rulesMetadata('fr');

export default function FrenchRulesPage() {
  return <RulesView locale="fr" />;
}

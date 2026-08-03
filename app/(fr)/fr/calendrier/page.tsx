import type { Metadata } from 'next';
import { AgendaView, agendaMetadata } from '@/app/(site)/calendrier/page';

/** Le calendrier, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

export const metadata: Metadata = agendaMetadata('fr');

export default function FrenchCalendarPage() {
  return <AgendaView locale="fr" />;
}

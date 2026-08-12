import type { Metadata } from 'next';
import { AgendaView, agendaMetadata } from '@/app/(site)/calendrier/page';

/** Le calendrier, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

/** Meme regeneration quotidienne que la route anglaise : la rangee de decouverte en vit. */
export const revalidate = 86_400;

export const metadata: Metadata = agendaMetadata('fr');

export default function FrenchCalendarPage() {
  return <AgendaView locale="fr" />;
}

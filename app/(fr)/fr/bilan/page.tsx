import type { Metadata } from 'next';
import { TallyView, tallyMetadata } from '@/app/(site)/bilan/page';

/** Mon bilan, en francais — meme composant, autre langue. */
export const dynamic = 'force-static';

/** Meme regeneration quotidienne que la route anglaise : la rangee de decouverte en vit. */
export const revalidate = 86_400;

export const metadata: Metadata = tallyMetadata('fr');

export default function FrenchTallyPage() {
  return <TallyView locale="fr" />;
}

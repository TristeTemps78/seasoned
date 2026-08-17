import type { Metadata } from 'next';
import { WordView, wordMetadata } from '@/app/(site)/mot/[tag]/page';

/**
 * La page d'un mot, en francais.
 *
 * ⚠️ Le jumeau exact de `/mot/[tag]` : seule la disposition racine change, et c'est elle qui
 * porte `lang` et le fournisseur de langue. Voir l'original pour le motif de cache et la
 * raison pour laquelle la page n'est pas indexee.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = wordMetadata('fr');

interface PageProps {
  readonly params: Promise<{ readonly tag: string }>;
}

export default async function FrenchWordRoute({ params }: PageProps) {
  return <WordView params={params} />;
}

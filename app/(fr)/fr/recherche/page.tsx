import type { Metadata } from 'next';
import { SearchView, searchMetadata } from '@/app/(site)/recherche/page';

/** La recherche en francais — meme composant, autre langue. */
interface PageProps {
  readonly searchParams: Promise<{ readonly q?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return searchMetadata(q, 'fr');
}

export default async function FrenchSearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <SearchView query={q?.trim() ?? ''} locale="fr" />;
}

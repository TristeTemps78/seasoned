import type { Metadata } from 'next';
import { SearchView, readPage, searchMetadata } from '@/app/(site)/recherche/page';

/** La recherche en francais — meme composant, autre langue. */
interface PageProps {
  readonly searchParams: Promise<{ readonly q?: string; readonly page?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return searchMetadata(q, 'fr');
}

export default async function FrenchSearchPage({ searchParams }: PageProps) {
  const { q, page } = await searchParams;
  // ⚠️ La borne vient du **meme** lecteur que la page anglaise : deux copies d'une borne
  // finissent par diverger, et c'est celle qu'on oublie qui laisse passer `?page=999999`.
  return <SearchView query={q?.trim() ?? ''} locale="fr" page={readPage(page)} />;
}

import type { Metadata } from 'next';
import { BrowseView, browseMetadata } from '@/app/(site)/parcourir/page';

/** Parcourir, en francais — meme composant, autre langue. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = browseMetadata('fr');

export default async function FrenchBrowsePage({ searchParams }: {
  readonly searchParams: Promise<{
    readonly genre?: string;
    readonly annees?: string;
    readonly tri?: string;
    readonly etat?: string;
    readonly page?: string;
  }>;
}) {
  return <BrowseView params={await searchParams} locale="fr" />;
}

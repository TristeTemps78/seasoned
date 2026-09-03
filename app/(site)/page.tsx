import type { Metadata } from 'next';
import { Home } from '@/app/components/Home';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { alternatesFor } from '@/lib/routes';

/**
 * Regeneration quotidienne.
 *
 * Deux appels par jour au total pour toute la page d'accueil, quel que soit le
 * trafic.
 */
export const revalidate = 86_400;

export const metadata: Metadata = { alternates: alternatesFor('/', DEFAULT_LOCALE) };

export default async function HomePage() {
  return <Home locale={DEFAULT_LOCALE} />;
}

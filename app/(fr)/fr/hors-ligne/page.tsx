import type { Metadata } from 'next';
import { OfflineView, offlineMetadata } from '@/app/(site)/hors-ligne/page';

/**
 * La page hors ligne, en francais.
 *
 * Elle doit exister dans les deux langues pour une raison concrete : le service worker
 * sert **cette adresse** en secours, et un lecteur francais tombant sur un ecran anglais
 * au moment ou le reseau lache aurait toutes les raisons de croire le site casse.
 */
export const metadata: Metadata = offlineMetadata('fr');

export default function FrenchOfflinePage() {
  return <OfflineView locale="fr" />;
}

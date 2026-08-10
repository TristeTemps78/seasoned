import { SiteChrome, siteMetadata, siteViewport } from '@/app/components/SiteChrome';
import { MessagesFr } from '@/app/i18n/MessagesFr';
import '../globals.css';

/** La disposition racine francaise. Voir `app/(site)/layout.tsx`. */
export const metadata = siteMetadata('fr');
export const viewport = siteViewport;

export default function FrenchRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale="fr" Messages={MessagesFr}>{children}</SiteChrome>;
}

import { SiteChrome, siteMetadata, siteViewport } from '@/app/components/SiteChrome';
import '../globals.css';

/** La disposition racine francaise. Voir `app/(site)/layout.tsx`. */
export const metadata = siteMetadata('fr');
export const viewport = siteViewport;

export default function FrenchRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale="fr">{children}</SiteChrome>;
}

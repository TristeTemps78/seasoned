import { SiteChrome, siteMetadata, siteViewport } from '@/app/components/SiteChrome';
import { MessagesEn } from '@/app/i18n/MessagesEn';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import '../globals.css';

/**
 * La disposition racine de la langue par defaut.
 *
 * Trois lignes, parce que tout ce qui pourrait diverger entre les langues vit dans
 * {@link SiteChrome}. Deux dispositions racines existent — une par langue — parce qu'une
 * page ne porte qu'un seul `<html>`, et que son attribut `lang` doit dire la langue
 * reellement servie.
 */
export const metadata = siteMetadata(DEFAULT_LOCALE);
export const viewport = siteViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale={DEFAULT_LOCALE} Messages={MessagesEn}>{children}</SiteChrome>;
}

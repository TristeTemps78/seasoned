import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { AuthCallback } from '@/app/components/AuthCallback';

/**
 * Le retour du lien de connexion.
 *
 * ⚠️ **Statique.** Le `code` arrive dans l'URL du navigateur et le verificateur PKCE est
 * dans son `localStorage` : le serveur n'a rien a apporter a cet echange, donc on ne
 * l'invoque pas. Voir `app/components/AuthCallback.tsx` pour ce que ca evite.
 */
export const dynamic = 'force-static';

export function AuthCallbackMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'account.title'),
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = AuthCallbackMetadata(DEFAULT_LOCALE);

export function AuthCallbackView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="space-y-6">
      <h1 className="page-title">{t(locale, 'account.title')}</h1>
      <AuthCallback />
    </div>
  );
}

export default function AuthCallbackPage() {
  return <AuthCallbackView locale={DEFAULT_LOCALE} />;
}

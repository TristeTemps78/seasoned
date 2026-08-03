import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { AccountPanel } from '@/app/components/AccountPanel';

/**
 * La face cachee : le compte.
 *
 * ⚠️ **`force-static` comme tout le reste**, et c'est le point qui merite d'etre defendu :
 * l'authentification ne rend aucune page dynamique ici. La session vit dans le navigateur,
 * le serveur ne la voit jamais, et cette page est donc servie par le CDN exactement comme
 * `/moi`. Le motif complet — et pourquoi `@supabase/ssr` est refuse — est dans
 * `src/auth/client.ts`.
 *
 * Ce n'est pas une face du cube : on ne se demande pas « ou en est mon compte » a un
 * moment de la journee. C'est un reglage, et les reglages vivent dans le profil.
 */
export const dynamic = 'force-static';

export function accountMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'account.title'),
    // Rien a indexer : la page est vide pour qui n'est pas connecte, et personnelle
    // pour qui l'est.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = accountMetadata(DEFAULT_LOCALE);

export function AccountView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t(locale, 'account.title')}</h1>
        <p className="max-w-prose text-(--color-muted)">{t(locale, 'account.lede')}</p>
      </header>
      <AccountPanel />
    </div>
  );
}

export default function AccountPage() {
  return <AccountView locale={DEFAULT_LOCALE} />;
}

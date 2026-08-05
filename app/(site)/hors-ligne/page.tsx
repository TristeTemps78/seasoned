import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';

/**
 * La page servie quand il n'y a plus de reseau et rien en cache.
 *
 * Elle dit surtout une chose utile : **votre bibliotheque, elle, fonctionne**. Le
 * journal vit dans le navigateur, donc `/moi` s'affiche entierement hors ligne des
 * lors que la page a ete visitee une fois. C'est le seul endroit du site dont on peut
 * promettre cela, et c'est exactement ce qu'on attend d'une application installee.
 */
export function offlineMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'offline.title'),
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = offlineMetadata(DEFAULT_LOCALE);

export function OfflineView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="empty-state my-12">
      <h1 className="page-title">{t(locale, 'offline.heading')}</h1>
      <p className="empty-state-body">{t(locale, 'offline.body')}</p>
      {/* Les memes utilitaires que `EmptyLibrary`, au caractere pres — cf. `globals.css`. */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href={pathIn('/moi', locale)} className="btn btn-primary">
          {t(locale, 'offline.open')}
        </Link>
      </div>
    </div>
  );
}

export default function OfflinePage() {
  return <OfflineView locale={DEFAULT_LOCALE} />;
}

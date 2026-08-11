import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Lists } from '@/app/components/Lists';
import { PageHeader } from '@/app/components/PageHeader';

/**
 * La face « Mes listes ».
 *
 * Statique comme les autres faces : le HTML est mis en cache au bord et partage entre tous
 * les visiteurs. Ce sont les listes de **qui demande** qui varient, donc elles arrivent
 * cote navigateur — un rendu serveur devrait etre refait par visiteur, c'est-a-dire le cout
 * par utilisateur qui a tue TV Time.
 */
export const dynamic = 'force-static';

export function listsMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'listsPage.title'),
    // Vide pour un robot : le contenu depend du compte qui regarde.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = listsMetadata(DEFAULT_LOCALE);

export function ListsView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="space-y-8">
      <PageHeader title={t(locale, 'listsPage.title')} lede={t(locale, 'listsPage.intro')} />
      <Lists />
    </div>
  );
}

export default function ListsPage() {
  return <ListsView locale={DEFAULT_LOCALE} />;
}

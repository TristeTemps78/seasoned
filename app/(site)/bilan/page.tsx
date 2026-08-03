import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { MyStats } from '@/app/components/MyStats';

/**
 * La face « Mon bilan ».
 *
 * Statique, comme `/moi` et `/calendrier` : le HTML est mis en cache au bord et partage
 * entre tous les visiteurs, donc aucun composant serveur ne lit de journal.
 */
export const dynamic = 'force-static';

export function tallyMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'tallyPage.title'),
    // Vide pour un robot : le contenu vit dans le journal du visiteur.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = tallyMetadata(DEFAULT_LOCALE);

export function TallyView({ locale: _locale }: { readonly locale: Locale }) {
  return <MyStats />;
}

export default function TallyPage() {
  return <TallyView locale={DEFAULT_LOCALE} />;
}

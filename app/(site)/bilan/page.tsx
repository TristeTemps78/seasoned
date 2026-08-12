import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { MyStats } from '@/app/components/MyStats';
import { FaceDiscovery } from '@/app/components/FaceDiscovery';
import { PosterRail } from '@/app/components/PosterRail';
import { discover } from '@/lib/catalog';

/**
 * La face « Mon bilan ».
 *
 * Statique, comme `/moi` et `/calendrier` : le HTML est mis en cache au bord et partage
 * entre tous les visiteurs, donc aucun composant serveur ne lit de journal.
 */
export const dynamic = 'force-static';

/** Un rendu par jour pour la rangee de decouverte — voir `/calendrier`. */
export const revalidate = 86_400;

export function tallyMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'tallyPage.title'),
    // Vide pour un robot : le contenu vit dans le journal du visiteur.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = tallyMetadata(DEFAULT_LOCALE);

export async function TallyView({ locale }: { readonly locale: Locale }) {
  // ⚠️ Le **fond de catalogue**, pas les tendances : le bilan a besoin de series qu'on a
  // deja finies, pas de celles qui sortent. « Vous en avez forcement fini une » ne se dit
  // qu'avec des series que tout le monde a vues — et ca donne a cette face une matiere que
  // ni l'accueil ni les trois autres ne montrent.
  const known = await discover('popular', 1, locale);

  return (
    <>
      <MyStats />

      <FaceDiscovery>
        <PosterRail
          title={t(locale, 'discovery.tally.title')}
          subtitle={t(locale, 'discovery.tally.subtitle')}
          series={known.slice(0, 12).map((summary) => ({ summary }))}
          locale={locale}
        />
      </FaceDiscovery>
    </>
  );
}

export default function TallyPage() {
  return <TallyView locale={DEFAULT_LOCALE} />;
}

import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Lists } from '@/app/components/Lists';
import { DiscoverLists } from '@/app/components/DiscoverLists';
import { PageHeader } from '@/app/components/PageHeader';
import { FaceDiscovery } from '@/app/components/FaceDiscovery';
import { PosterRail } from '@/app/components/PosterRail';
import { discover } from '@/lib/catalog';

/**
 * La face « Mes listes ».
 *
 * Statique comme les autres faces : le HTML est mis en cache au bord et partage entre tous
 * les visiteurs. Ce sont les listes de **qui demande** qui varient, donc elles arrivent
 * cote navigateur — un rendu serveur devrait etre refait par visiteur, c'est-a-dire le cout
 * par utilisateur qui a tue TV Time.
 */
export const dynamic = 'force-static';

/** Un rendu par jour pour la rangee de decouverte — voir `/calendrier`. */
export const revalidate = 86_400;

export function listsMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'listsPage.title'),
    // Vide pour un robot : le contenu depend du compte qui regarde.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = listsMetadata(DEFAULT_LOCALE);

export async function ListsView({ locale }: { readonly locale: Locale }) {
  // ⚠️ `trending` **page 2** : la page 1 est la rangee « Cette semaine » de l'accueil. Une
  // liste se compose de ce dont on parle, d'ou les tendances plutot que le fond de
  // catalogue — qui est, lui, la matiere du bilan.
  const talked = await discover('trending', 2, locale);

  return (
    <div className="space-y-8">
      <PageHeader title={t(locale, 'listsPage.title')} lede={t(locale, 'listsPage.intro')} />

      {/* ⚠️ Meme place et meme condition que sur `/amis`, pour la meme mesure : cette face est
          fermee par le **compte** et non par le journal, et la rangee posee en dernier tombait
          sous le pli. Voir `FaceDiscovery`. */}
      <FaceDiscovery gate="account">
        <PosterRail
          title={t(locale, 'discovery.lists.title')}
          subtitle={t(locale, 'discovery.lists.subtitle')}
          series={talked.slice(0, 12).map((summary) => ({ summary }))}
          locale={locale}
        />
      </FaceDiscovery>

      <Lists />

      {/* ⚠️ **Apres les siennes, et sans compte.** La page ne parlait que de ce qu'un visiteur
          n'avait pas ; les listes des profils publics etaient deja lisibles par lui et
          n'etaient montrees nulle part. En dernier parce que ses propres listes passent
          devant celles des autres — mais present pour tout le monde, connecte ou non. */}
      <DiscoverLists />
    </div>
  );
}

export default function ListsPage() {
  return <ListsView locale={DEFAULT_LOCALE} />;
}

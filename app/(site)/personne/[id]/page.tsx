import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { person } from '@/lib/catalog';
import { PageHeader } from '@/app/components/PageHeader';
import { SeriesCard } from '@/app/components/SeriesCard';
import { EmptyState } from '@/app/components/EmptyState';
import { alternatesFor } from '@/lib/routes';
import { DEFAULT_LOCALE, t, tn, type Locale } from '@/lib/i18n';

/**
 * Une personne, et ce qu'on peut voir d'elle.
 *
 * ## 🔴 Le defaut que cette route ferme
 *
 * Le generique de chaque fiche affiche douze visages, **aucun cliquable**. Le `CLAUDE.md`
 * rangeait `Cast` dans les trois silences assumes — « ce qui n'a litteralement rien
 * derriere ». Le classement ne tenait pas : `alsoByCreators` interroge deja
 * `/person/{id}/tv_credits` pour rendre « du meme createur », donc la donnee existe et sait
 * produire une page. Ce n'etait pas « rien derriere », c'etait « pas encore construit ».
 *
 * Et c'est un chemin de parcours entier qui manquait : chez la reference, un nom d'acteur
 * mene a sa filmographie, et c'est par la qu'on trouve la serie suivante quand on n'a pas de
 * titre en tete. La fiche serie renvoyait vers d'autres fiches par un seul fil — le createur.
 *
 * ## Aussi statique que la fiche serie, et pour la meme raison
 *
 * Le contenu est le meme pour tout le monde : aucune donnee de journal, aucune session. La
 * page est donc prerendue et servie depuis le cache de bord, comme `/serie/[id]`. C'est
 * l'invariant de cout du produit, et une route de plus n'a pas a y deroger.
 */
export const revalidate = 86_400;
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export async function personMetadata(id: string, locale: Locale): Promise<Metadata> {
  const found = await person(id, locale);
  if (found === undefined) return { title: t(locale, 'person.unknownTitle') };
  return {
    title: found.name,
    description: t(locale, 'person.description', { name: found.name }),
    alternates: alternatesFor(`/personne/${id}`, locale),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return personMetadata(id, DEFAULT_LOCALE);
}

export async function PersonView({ id, locale }: {
  readonly id: string;
  readonly locale: Locale;
}) {
  const found = await person(id, locale);
  // Une identite que le catalogue ne connait pas est une 404 legitime, indexable comme telle.
  if (found === undefined) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={found.name}
        lede={tn(locale, 'person.count', found.series.length)}
      />

      {found.series.length === 0 ? (
        /* ⚠️ Ca arrive vraiment : TMDB porte des identites creditees au cinema et pas a la
           television, et ce produit ne connait que la television. La phrase le dit — sans
           bouton, parce que la barre de navigation est le geste, et qu'aucun autre chemin
           n'existe depuis une personne dont on ne peut rien montrer. */
        <EmptyState title={t(locale, 'person.noneTitle')}>
          {t(locale, 'person.noneBody')}
        </EmptyState>
      ) : (
        // La grille partagee, jamais une grille locale : c'est le defaut pour lequel
        // `.poster-grid` a ete extraite.
        <ul className="bleed poster-grid">
          {found.series.map((summary) => (
            <li key={summary.providerId}>
              <SeriesCard series={summary} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  return <PersonView id={id} locale={DEFAULT_LOCALE} />;
}

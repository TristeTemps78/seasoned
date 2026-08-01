import { discover } from '@/lib/catalog';
import { SearchForm } from '@/app/components/SearchForm';
import { SeriesCard } from '@/app/components/SeriesCard';

/**
 * Regeneration quotidienne.
 *
 * Deux appels par jour au total pour toute la page d'accueil, quel que soit le
 * trafic (`ROADMAP.md` §1.4).
 */
export const revalidate = 86_400;

export default async function HomePage() {
  // Correctif de l'audit du 2026-08-01 : sans ces liens, **aucune page serie n'etait
  // atteignable** depuis une page indexable — sitemap a une seule URL, `/recherche`
  // en `Disallow`, zero lien sortant. Le canal d'acquisition n°1 etait un cul-de-sac.
  const [trending, onTheAir] = await Promise.all([
    discover('trending'),
    discover('on_the_air'),
  ]);

  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-2xl space-y-8 pt-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Une série n’est pas un long film.
          </h1>
          {/* Formulation revue le 2026-08-01 : la verification en reel a montre que la
              valeur n'est pas le cas extreme (la serie declaree vivante et morte depuis
              deux ans) mais le **temps ecoule chiffre**, qui vaut pour toutes les series
              en attente. Voir TASKS.md, « chasse au zombie ». */}
          <p className="text-(--color-muted) leading-relaxed">
            On ne demande pas à une série si elle est bien. On demande{' '}
            <em>si elle le reste</em> — combien de temps elle prend, où elle décroche,
            et depuis combien de temps on attend la suite.
          </p>
        </div>

        <SearchForm />
      </section>

      <Row
        title="Cette semaine"
        subtitle="Ce dont tout le monde parle en ce moment."
        series={trending}
      />

      <Row
        title="En cours de diffusion"
        subtitle="Là où savoir depuis combien de temps on attend change quelque chose."
        series={onTheAir}
      />

      {trending.length === 0 && onTheAir.length === 0 ? (
        <p className="text-(--color-warn)">
          Le catalogue est momentanément indisponible. La recherche fonctionne peut-être
          encore.
        </p>
      ) : null}
    </div>
  );
}

function Row({ title, subtitle, series }: {
  readonly title: string;
  readonly subtitle: string;
  readonly series: readonly Awaited<ReturnType<typeof discover>>[number][];
}) {
  if (series.length === 0) return null;

  return (
    <section className="space-y-4" aria-label={title}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-(--color-muted)">{subtitle}</p>
      </div>
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
        {series.slice(0, 12).map((s) => (
          <li key={s.providerId}>
            <SeriesCard series={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

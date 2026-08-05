import { discover, waitingSeries, withStatus, type SeriesWithStatus } from '@/lib/catalog';
import { SearchForm } from '@/app/components/SearchForm';
import { RowHeader } from '@/app/components/RowHeader';
import { SeriesCard } from '@/app/components/SeriesCard';
import { ResumeStrip } from '@/app/components/ResumeStrip';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/routes';
import type { Metadata } from 'next';

/**
 * Regeneration quotidienne.
 *
 * Deux appels par jour au total pour toute la page d'accueil, quel que soit le
 * trafic (`ROADMAP.md` §1.4).
 */
export const revalidate = 86_400;

export const metadata: Metadata = { alternates: alternatesFor('/', DEFAULT_LOCALE) };

export default async function HomePage() {
  return <Home locale={DEFAULT_LOCALE} />;
}

/** L'accueil, dans une langue. Reutilise tel quel par la route francaise. */
export async function Home({ locale }: { readonly locale: Locale }) {
  // Correctif de l'audit du 2026-08-01 : sans ces liens, **aucune page serie n'etait
  // atteignable** depuis une page indexable — sitemap a une seule URL, `/recherche`
  // en `Disallow`, zero lien sortant. Le canal d'acquisition n°1 etait un cul-de-sac.
  const [rawTrending, rawOnTheAir] = await Promise.all([
    discover('trending', 1, locale),
    discover('on_the_air', 1, locale),
  ]);

  // Hydratation du statut reel : un appel par serie, mais la page est en ISR
  // quotidien — le total reste de l'ordre de 60 appels par JOUR, quel que soit le
  // trafic (`ROADMAP.md` §1.4). C'est ce qui rend la promesse visible **avant** le clic.
  const [trending, onTheAir, waiting] = await Promise.all([
    withStatus(rawTrending.slice(0, 12), new Date(), locale),
    withStatus(rawOnTheAir.slice(0, 12), new Date(), locale),
    waitingSeries(12, new Date(), locale),
  ]);

  return (
    <div className="space-y-12">
      {/* ⚠️ Compact **a dessein**. La premiere version occupait la hauteur entiere d'un
          ecran de 800 px pour trois lignes de texte : on arrivait sur le produit sans voir
          une seule serie. Or les series **sont** le produit, et l'accueil doit prouver ce
          qu'il annonce dans la meme vue que l'annonce. */}
      <section className="max-w-2xl space-y-5 pt-2">
        <div className="space-y-3">
          <h1 className="hero-title">
            {t(locale, 'home.h1')}
          </h1>
          {/* Formulation revue le 2026-08-01 : la verification en reel a montre que la
              valeur n'est pas le cas extreme (la serie declaree vivante et morte depuis
              deux ans) mais le **temps ecoule chiffre**, qui vaut pour toutes les series
              en attente. Voir TASKS.md, « chasse au zombie ». */}
          <p className="text-(--color-muted) leading-relaxed text-pretty">
            {t(locale, 'home.lede.before')}
            <em>{t(locale, 'home.lede.em')}</em>
            {t(locale, 'home.lede.after')}
          </p>
        </div>

        <SearchForm locale={locale} />

        {/* Le rappel que le produit s'interdit d'envoyer par notification : il ne
            coute rien, ne reveille personne, et ne s'affiche que pour qui a deja un
            journal. La page, elle, reste statique pour tout le monde. */}
        <ResumeStrip />
      </section>

      {/* Cette rangee passe en premier a dessein : c'est la seule qui montre ce que
          fait le produit. Les deux autres ne contiennent, par construction, que des
          series actives — verifie en ligne le 2026-08-01. */}
      <Row
        title={t(locale, 'home.waiting.title')}
        subtitle={t(locale, 'home.waiting.subtitle')}
        series={waiting}
        locale={locale}
      />

      <Row
        title={t(locale, 'home.week.title')}
        subtitle={t(locale, 'home.week.subtitle')}
        series={trending}
        locale={locale}
      />

      <Row
        title={t(locale, 'home.airing.title')}
        subtitle={t(locale, 'home.airing.subtitle')}
        series={onTheAir}
        locale={locale}
      />

      {trending.length === 0 && onTheAir.length === 0 && waiting.length === 0 ? (
        <p className="text-(--color-warn)">{t(locale, 'home.unavailable')}</p>
      ) : null}
    </div>
  );
}

function Row({ title, subtitle, series, locale }: {
  readonly title: string;
  readonly subtitle: string;
  readonly series: readonly SeriesWithStatus[];
  readonly locale: Locale;
}) {
  if (series.length === 0) return null;

  return (
    <section className="space-y-4" aria-label={title}>
      <RowHeader title={title} subtitle={subtitle} />
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
        {series.map(({ summary, status }) => (
          <li key={summary.providerId}>
            <SeriesCard
              series={summary}
              locale={locale}
              {...(status !== undefined ? { status } : {})}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

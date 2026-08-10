import Link from 'next/link';
import {
  backdropDimensions,
  backdropUrl,
  discover,
  posterDimensions,
  posterUrl,
  waitingSeries,
  withStatus,
  type SeriesWithStatus,
} from '@/lib/catalog';
import { SearchForm } from '@/app/components/SearchForm';
import { RowHeader } from '@/app/components/RowHeader';
import { SeriesCard } from '@/app/components/SeriesCard';
import { StatusBadge } from '@/app/components/StatusBadge';
import { ResumeStrip } from '@/app/components/ResumeStrip';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor, seriesPath } from '@/lib/routes';
import type { Metadata } from 'next';

/**
 * Regeneration quotidienne.
 *
 * Deux appels par jour au total pour toute la page d'accueil, quel que soit le
 * trafic.
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
  // trafic. C'est ce qui rend la promesse visible **avant** le clic.
  const [trending, onTheAir, waiting] = await Promise.all([
    withStatus(rawTrending.slice(0, 12), new Date(), locale),
    withStatus(rawOnTheAir.slice(0, 12), new Date(), locale),
    waitingSeries(12, new Date(), locale),
  ]);

  // La mise en avant demande une banniere : on prend la premiere serie en attente qui en
  // ait une, et non simplement la premiere. ⚠️ **Aucun appel supplementaire** —
  // `backdrop_path` voyage deja dans la reponse de `discover` (verifie sur les reponses en
  // cache le 2026-08-10). Sans aucune banniere disponible, `featured` reste indefini et
  // l'accueil retrouve exactement sa forme d'avant : c'est un repli, pas un trou.
  const featured = waiting.find((item) => item.summary.backdropPath !== undefined);
  // Huit et non onze : la rangee de tete rend quatre colonnes, donc onze vignettes y
  // laissent une derniere ligne de trois — un trou d'une affiche sur deux, en plein milieu
  // de la page. Huit remplissent exactement deux lignes. Les rangees denses, elles, en
  // rendent six par ligne et gardent leurs douze.
  const rest = waiting.filter((item) => item !== featured).slice(0, 8);

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
              en attente. Voir, « chasse au zombie ». */}
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

      {/* La preuve, avant la liste.

          🔴 Mesure du 2026-08-10 : l'accueil rendait quatre blocs empiles de 183, **348, 664
          et 664 px** — trois rangees strictement identiques sous un chapeau de texte. Rien
          n'y disait par quoi commencer, et la seule chose que ce produit sache faire et
          qu'aucun autre n'affiche — « en attente, depuis 14 mois » — etait une pastille de
          11 px collee au bas d'une affiche de 150 px.

          On promeut donc **une** serie en attente : sa banniere en pleine largeur, son
          statut en toutes lettres. Elle sort de la rangee (`rest`) au lieu de s'y ajouter —
          la montrer deux fois sur le meme ecran ferait douter qu'il s'agisse de la meme. */}
      {featured !== undefined ? (
        <Featured
          item={featured}
          label={t(locale, 'home.waiting.title')}
          locale={locale}
        />
      ) : null}

      {/* Cette rangee passe en premier a dessein : c'est la seule qui montre ce que
          fait le produit. Les deux autres ne contiennent, par construction, que des
          series actives — verifie en ligne le 2026-08-01. */}
      {/* ⚠️ `lead` : affiches d'environ 300 px contre 190 pour les suivantes. La difference
          de taille dit ce qu'aucun sous-titre ne disait — par ou commencer. */}
      <Row
        title={t(locale, 'home.waiting.title')}
        subtitle={t(locale, 'home.waiting.subtitle')}
        series={rest}
        locale={locale}
        lead
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

/**
 * La serie mise en avant — **le point focal que l'accueil n'avait pas**.
 *
 * ## Pourquoi celle-ci et pas une autre
 *
 * C'est une serie *en attente*, donc celle qui porte le differenciateur du produit : le
 * temps ecoule depuis le dernier episode, chiffre. Mettre en avant une serie « tendance »
 * montrerait ce que tout le monde montre deja.
 *
 * ## Ce qu'elle ne fait pas
 *
 * **Aucune chaine nouvelle.** L'etiquette est celle de la rangee dont elle sort, le statut
 * est rendu par `StatusBadge` — le meme composant que la fiche serie, dans les memes mots.
 * Un bloc de mise en avant qui inventerait son vocabulaire dirait la meme chose deux
 * facons, et c'est exactement ce que `no-hardcoded-strings` existe pour empecher.
 *
 * ⚠️ **Le lien enveloppe le titre seul, pas le bloc.** Un `<a>` qui contient une image, un
 * badge et un synopsis annonce au lecteur d'ecran une seule cible dont le nom fait trois
 * phrases. Le titre est la cible, et il est assez grand pour etre vise.
 */
function Featured({ item, label, locale }: {
  readonly item: SeriesWithStatus;
  readonly label: string;
  readonly locale: Locale;
}) {
  const { summary, status } = item;
  const backdrop = backdropUrl(summary.backdropPath, 'w1280');
  const poster = posterUrl(summary.posterPath, 'w342');

  return (
    <section className="bleed art-bed py-10 sm:py-14" aria-label={summary.title}>
      {backdrop !== undefined ? (
        // Le plus gros element de l'ecran, donc celui que Google chronometre : priorite
        // haute, dimensions declarees, et `srcSet` pour ne pas servir 1280 px a un
        // telephone qui en affiche 360.
        // eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous.
        <img
          src={backdrop}
          srcSet={`${backdropUrl(summary.backdropPath, 'w780')} 780w, ${backdrop} 1280w`}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
          width={backdropDimensions('w1280').width}
          height={backdropDimensions('w1280').height}
        />
      ) : null}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {poster !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous.
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            width={posterDimensions('w342').width}
            height={posterDimensions('w342').height}
            className="hidden w-40 shrink-0 rounded-lg border border-(--color-edge) shadow-[0_1.5rem_3rem_-1rem_rgba(0,0,0,0.75)] sm:block"
          />
        ) : null}

        <div className="max-w-2xl space-y-3">
          <p className="label">{label}</p>
          <h2 className="hero-title">
            <Link
              href={seriesPath(summary.providerId, locale)}
              className="transition-colors hover:text-(--color-volt)"
            >
              {summary.title}
            </Link>
          </h2>
          {status !== undefined ? (
            <StatusBadge status={status} withDetail locale={locale} />
          ) : null}
          {summary.overview !== undefined ? (
            <p className="prose-note clamp-3">{summary.overview}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Row({ title, subtitle, series, locale, lead = false }: {
  readonly title: string;
  readonly subtitle: string;
  readonly series: readonly SeriesWithStatus[];
  readonly locale: Locale;
  /** La rangee de tete : moins de colonnes, donc des affiches nettement plus grandes. */
  readonly lead?: boolean;
}) {
  if (series.length === 0) return null;

  return (
    // ⚠️ `.bleed` : la grille sort de la colonne de lecture, le texte n'en sort jamais.
    // C'est la regle, et elle vaut mieux qu'un elargissement general — une phrase rendue
    // sur 1248 px ne se lit pas, ce que `.prose-note` dit deja.
    <section className="bleed space-y-4" aria-label={title}>
      <RowHeader title={title} subtitle={subtitle} />
      <ul className={`poster-grid ${lead ? 'poster-grid-lead' : ''}`}>
        {series.map(({ summary, status }) => (
          <li key={summary.providerId}>
            <SeriesCard
              series={summary}
              locale={locale}
              // Une affiche de 300 px rendue depuis un fichier de 342 est a la limite du
              // flou ; la grille dense, elle, n'a aucune raison de telecharger 500.
              size={lead ? 'w500' : 'w342'}
              {...(status !== undefined ? { status } : {})}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { ReactNode } from 'react';
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
import { PosterRail } from '@/app/components/PosterRail';
import { DiscoverReviews } from '@/app/components/DiscoverReviews';
import { StatusBadge } from '@/app/components/StatusBadge';
import { ResumeStrip } from '@/app/components/ResumeStrip';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor, pathIn, seriesPath } from '@/lib/routes';
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

  // La premiere serie en attente **qui ait une banniere**, pas simplement la premiere.
  // ⚠️ Aucun appel de plus : `backdrop_path` voyage deja dans la reponse de `discover`.
  // Sans banniere nulle part, `featured` reste indefini et l'accueil retrouve sa forme
  // d'avant — un repli, pas un trou.
  const featured = waiting.find((item) => item.summary.backdropPath !== undefined);
  // Huit, parce que la rangee de tete a quatre colonnes : onze y laisseraient une derniere
  // ligne de trois. Les rangees denses en rendent six et gardent leurs douze.
  const rest = waiting.filter((item) => item !== featured).slice(0, 8);

  return (
    <div className="space-y-12">
      {/* ⚠️ Compact **a dessein**. La premiere version occupait la hauteur entiere d'un
          ecran de 800 px pour trois lignes de texte : on arrivait sur le produit sans voir
          une seule serie. Or les series **sont** le produit, et l'accueil doit prouver ce
          qu'il annonce dans la meme vue que l'annonce. */}
      <Featured
        item={featured}
        label={t(locale, 'home.waiting.title')}
        locale={locale}
      >
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

        {/* ⚠️ **La seconde porte, et le produit n'en avait qu'une.** Le champ ci-dessus exige
            de connaitre le titre ; c'est la moitie des envies de serie, pas toutes. Sous le
            champ et non a cote : chercher reste le geste principal, parcourir est ce qu'on
            fait quand on n'a pas de titre en tete. */}
        <p className="text-center">
          <Link
            href={pathIn('/parcourir', locale)}
            className="meta tap-line hover:text-(--color-text)"
          >
            {t(locale, 'home.browse')}
          </Link>
        </p>

        {/* Le rappel que le produit s'interdit d'envoyer par notification : il ne
            coute rien, ne reveille personne, et ne s'affiche que pour qui a deja un
            journal. La page, elle, reste statique pour tout le monde. */}
        <ResumeStrip />
      </Featured>

      {/* Cette rangee passe en premier a dessein : c'est la seule qui montre ce que
          fait le produit. Les deux autres ne contiennent, par construction, que des
          series actives — verifie en ligne le 2026-08-01. `lead` lui donne des affiches
          de 300 px contre 190, ce qui dit par ou commencer sans l'ecrire. */}
      <PosterRail
        title={t(locale, 'home.waiting.title')}
        subtitle={t(locale, 'home.waiting.subtitle')}
        series={rest}
        locale={locale}
        lead
      />

      <PosterRail
        title={t(locale, 'home.week.title')}
        subtitle={t(locale, 'home.week.subtitle')}
        series={trending}
        locale={locale}
      />

      <PosterRail
        title={t(locale, 'home.airing.title')}
        subtitle={t(locale, 'home.airing.subtitle')}
        series={onTheAir}
        locale={locale}
      />

      {/* 🔴 **Rien ne menait aux ecrits des autres.** `<Reviews />` n'etait monte qu'a une
          ligne du depot — la fiche serie — donc lire quelqu'un supposait de savoir d'avance
          sur quelle serie regarder. Les listes ont eu leur vitrine, les critiques non, alors
          qu'elles sont la moitie de la cible.

          En bas de l'accueil et non en haut : les trois rangees au-dessus repondent a « quoi
          regarder », qui est la question qu'on se pose en arrivant. Celle-ci repond a « qui
          suivre », qui vient apres — et se tait tant qu'il n'y a rien a lire. */}
      <DiscoverReviews />

      {trending.length === 0 && onTheAir.length === 0 && waiting.length === 0 ? (
        <p className="text-(--color-warn)">{t(locale, 'home.unavailable')}</p>
      ) : null}
    </div>
  );
}

/**
 * La serie mise en avant — une serie *en attente*, donc celle qui porte le differenciateur
 * du produit. Une « tendance » montrerait ce que tout le monde montre deja.
 *
 * Aucune chaine nouvelle : l'etiquette vient de la rangee dont elle sort, le statut de
 * `StatusBadge`, comme sur la fiche serie.
 *
 * ⚠️ **Le lien enveloppe le titre seul, pas le bloc** : un `<a>` contenant image, badge et
 * synopsis annonce au lecteur d'ecran une cible dont le nom fait trois phrases.
 */
function Featured({ item, label, locale, children }: {
  /** ⚠️ Optionnel : sans banniere dans tout le catalogue, l'accroche doit **quand meme**
      s'afficher. C'est le repli, pas un trou. */
  readonly item: SeriesWithStatus | undefined;
  readonly label: string;
  readonly locale: Locale;
  /** L'accroche du site — titre, phrase, recherche. Voir le commentaire du composant. */
  readonly children: ReactNode;
}) {
  const summary = item?.summary;
  const status = item?.status;
  const backdrop = backdropUrl(summary?.backdropPath, 'w1280');
  const poster = posterUrl(summary?.posterPath, 'w342');

  return (
    <section
      className="bleed art-bed py-10 sm:py-16"
      aria-label={summary?.title ?? t(locale, 'home.h1')}
    >
      {backdrop !== undefined ? (
        // Le plus gros element de l'ecran, donc celui que Google chronometre : priorite
        // haute, dimensions declarees, et `srcSet` pour ne pas servir 1280 px a un
        // telephone qui en affiche 360.
        // eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous.
        <img
          src={backdrop}
          srcSet={`${backdropUrl(summary?.backdropPath, 'w780')} 780w, ${backdrop} 1280w`}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
          width={backdropDimensions('w1280').width}
          height={backdropDimensions('w1280').height}
        />
      ) : null}

      {/* L'accroche du site, **posee sur la banniere** et non au-dessus d'elle. C'est le
          correctif du 2026-08-11 : vu a l'ecran, le premier ecran de l'accueil ne contenait
          aucune image — un titre, un paragraphe et un champ de recherche sur du noir. Il
          fallait defiler pour voir une seule serie, sur un produit dont les series SONT le
          sujet. Le commentaire de la version precedente decrivait deja ce defaut et l'avait
          corrige a moitie : la preuve etait descendue sous la ligne de flottaison. */}
      {/* ⚠️ **Centre**, a la demande de Tristan (2026-08-11) : l'accroche est la seule chose de
          la page qui s'adresse au visiteur plutot que de lui montrer quelque chose. Centree,
          elle se lit comme une adresse ; alignee a gauche, elle se lisait comme le debut d'un
          article. Le reste de la page — banniere, rails — reste aligne a gauche : ce sont des
          objets qu'on parcourt, et centrer une grille casse la ligne de depart du regard. */}
      <div className="mx-auto max-w-2xl space-y-5 text-center">{children}</div>

      {summary === undefined ? null : (
      <div className="mt-10 flex flex-col gap-6 sm:mt-14 sm:flex-row sm:items-end">
        {poster !== undefined ? (
          // 🔴 **C'etait `panel`, et c'etait la seule affiche du produit qui ne soit pas un
          // objet.** Constate en mesurant le DOM le 2026-08-11 : les six premieres images de
          // l'accueil, celle-ci a un parent `panel …`, les cinq suivantes un parent
          // `poster-frame aspect-2/3`. Or `poster-frame` est ce que `editorial-voice` appelle
          // « l'affiche est un objet, pas un rectangle » — anneau clair, double ombre, puits
          // sombre, et le leger soulevement au survol.
          //
          // L'incoherence tombait au pire endroit : c'est la **premiere affiche qu'un visiteur
          // voit**, la plus grande de la mise en avant, et la seule posee sur une banniere —
          // c'est-a-dire celle qui a le plus besoin de se decoller du fond.
          <div className="poster-frame aspect-2/3 hidden w-40 shrink-0 self-end sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous. */}
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              width={posterDimensions('w342').width}
              height={posterDimensions('w342').height}
              className="h-full w-full object-cover"
            />
          </div>
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
      )}
    </section>
  );
}


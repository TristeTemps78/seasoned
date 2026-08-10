import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  alsoByCreators,
  backdropDimensions,
  backdropUrl,
  episodeRatings,
  getSeriesPageData,
  posterDimensions,
  posterUrl,
  publicTrajectory,
  watchOptions,
  artwork,
  SERVED_WATCH_REGIONS,
} from '@/lib/catalog';
import { SeriesCard } from '@/app/components/SeriesCard';
import { formatCommitment, formatDate, statusLabel, year } from '@/lib/format';
import { DEFAULT_LOCALE, localeTag, t, tn, watchRegion, type Locale, translatorFor } from '@/lib/i18n';
import { judgeCurrentSeason } from '@/src/domain/current-season';
import { findEntryPoint } from '@/src/domain/entry-point';
import { stopPointAdvice } from '@/src/domain/stop-point';
import { serializeJsonLd } from '@/lib/jsonld';
import { alternatesFor } from '@/lib/routes';
import { TmdbError } from '@/src/catalog/tmdb';
import { starsFromTen } from '@/src/domain/rating-scale';
import { StatusBadge } from '@/app/components/StatusBadge';
import { SeasonList } from '@/app/components/SeasonList';
import { StopMap } from '@/app/components/StopMap';
import { TrajectorySection } from '@/app/components/TrajectorySection';
import { WatchOptions } from '@/app/components/WatchOptions';
import { SeriesOrderings } from '@/app/components/SeriesOrderings';
import { MyProgress } from '@/app/components/MyProgress';
import { Reviews } from '@/app/components/Reviews';
import { SeriesPeople } from '@/app/components/SeriesPeople';
import { AddToList } from '@/app/components/AddToList';
import { ChooseArtwork } from '@/app/components/ChooseArtwork';
import { legalIsComplete } from '@/lib/legal';

/**
 * Regeneration toutes les 24 h.
 *
 * C'est une decision de budget, pas de fraicheur : la page est
 * servie depuis le cache de bord, donc le trafic ne declenche pas d'appel a TMDB. Une
 * grille de diffusion ne bouge pas plus d'une fois par jour.
 */
export const revalidate = 86_400;

/**
 * ⚠️ Indispensable, et pas une optimisation.
 *
 * `revalidate` **ne suffit pas** sur une route dynamique : sans `generateStaticParams`,
 * Next la rend a la demande et ne la met jamais en cache. Verifie en production le
 * 2026-08-02 — la page repondait `X-Vercel-Cache: MISS` et `Cache-Control: no-store`
 * pendant que l'accueil, route statique, repondait `PRERENDER`.
 *
 * `force-static` retablit le comportement attendu : rendu a la premiere demande, puis
 * servi depuis le cache jusqu'a expiration. `dynamicParams` restant vrai par defaut,
 * une serie encore inconnue est rendue a la volee puis mise en cache a son tour — on
 * ne pre-genere donc rien, ce que le budget interdirait de toute facon.
 */
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Charge la page, en distinguant les deux echecs possibles.
 *
 * `'missing'` — la serie n'existe pas : c'est une 404 legitime, indexable comme telle.
 * `'unavailable'` — le catalogue est en panne ou mal configure : surtout **pas** une
 * 404, qui dirait a un moteur de recherche de desindexer une page valide. On degrade.
 */
/**
 * Un identifiant de serie est un entier positif.
 *
 * Sans cette verification, `/serie/1396%2F..%2F..%2Fetc` repondait **200** au lieu de
 * 404 (constate en production le 2026-08-02) : l'appel partait chez le fournisseur,
 * echouait, et la page de repli « catalogue indisponible » etait servie avec un code
 * de succes. Une URL inventee devenait ainsi une page indexable — de quoi remplir
 * l'index de pages vides.
 */
function isValidSeriesId(id: string): boolean {
  return /^[0-9]+$/.test(id);
}

async function load(id: string, locale: Locale) {
  if (!isValidSeriesId(id)) return { kind: 'missing' as const };
  try {
    return { kind: 'ok' as const, data: await getSeriesPageData(id, new Date(), locale) };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) {
      return { kind: 'missing' as const };
    }
    return { kind: 'unavailable' as const };
  }
}

/**
 * Les metadonnees d'une page serie, dans une langue.
 *
 * Exportee pour que la route francaise (`app/fr/serie/[id]`) serve **exactement** la
 * meme page dans une autre langue, au lieu d'en entretenir une copie qui divergera.
 */
export async function seriesMetadata(id: string, locale: Locale): Promise<Metadata> {
  const loaded = await load(id, locale);
  if (loaded.kind !== 'ok') return { title: t(locale, 'series.unavailableTitle') };

  const { detail, seasons, status, episodeCount, totalRuntimeMinutes } = loaded.data;
  const started = year(detail.firstAirDate);

  // La description est ecrite pour la page de resultats d'un moteur : elle repond
  // immediatement aux deux questions qu'on pose a une serie — ou elle en est, et
  // combien elle coute. C'est le canal d'acquisition n°1.
  const parts = [
    statusLabel(status.status, translatorFor(locale)).toLowerCase(),
    tn(locale, 'series.seasons', seasons.rateable.length),
    tn(locale, 'series.episodes', episodeCount),
    ...(totalRuntimeMinutes !== undefined
      ? [formatCommitment(totalRuntimeMinutes, translatorFor(locale))]
      : []),
  ];

  const title = started !== undefined ? `${detail.title} (${started})` : detail.title;
  const description = `${detail.title} — ${parts.join(', ')}.`;
  const image = posterUrl(detail.posterPath, 'w500');
  // Canonique **de cette langue**, et declaration reciproque des autres. Pointer toutes
  // les canoniques vers l'anglais reviendrait a demander la desindexation du francais.
  const alternates = alternatesFor(`/serie/${id}`, locale);

  return {
    title,
    description,
    alternates,
    // Un lien partage sans apercu ne circule pas. L'affiche est verticale (2:3),
    // d'ou `summary` et non `summary_large_image` : une carte large la rognerait.
    openGraph: {
      type: 'video.tv_show',
      title,
      description,
      url: alternates.canonical,
      locale: localeTag(locale).replace('-', '_'),
      ...(image !== undefined
        ? { images: [{ url: image, ...posterDimensions('w500'), alt: detail.title }] }
        : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(image !== undefined ? { images: [image] } : {}),
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return seriesMetadata(id, DEFAULT_LOCALE);
}

export async function SeriesView({ id, locale }: {
  readonly id: string;
  readonly locale: Locale;
}) {
  const loaded = await load(id, locale);

  if (loaded.kind === 'missing') notFound();
  if (loaded.kind === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl py-12 space-y-4">
        <h1 className="page-title">
          {t(locale, 'series.unavailableHeading')}
        </h1>
        <p className="text-(--color-muted)">{t(locale, 'series.unavailableBody')}</p>
      </div>
    );
  }

  const { detail, seasons, status, episodeCount, totalRuntimeMinutes } = loaded.data;
  const poster = posterUrl(detail.posterPath, 'w342');
  // ⚠️ Arrive dans la **meme** reponse que le reste de la fiche : la montrer ne coute pas un
  // appel de plus. Souvent absente — le repli sur la mise en page nue est la voie courante,
  // pas l'exception.
  const backdrop = backdropUrl(detail.backdropPath, 'w1280');
  const started = year(detail.firstAirDate);
  // Sur la meme echelle que les notes de l'utilisateur : comparer un 8,4/10 a un
  // 4,5/5 ne veut rien dire, et la conversion doit se faire une seule fois.
  const publicStars = starsFromTen(detail.voteAverage);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: detail.title,
    ...(detail.overview !== undefined ? { description: detail.overview } : {}),
    ...(started !== undefined ? { datePublished: String(started) } : {}),
    numberOfSeasons: seasons.rateable.length,
    numberOfEpisodes: episodeCount,
  };

  return (
    <article className="space-y-10">
      <script
        type="application/ld+json"
        // ⚠️ `serializeJsonLd` et non `JSON.stringify` : ce dernier n'echappe pas `<`,
        // donc un titre TMDB valant `</script><script>…` refermait la balise et faisait
        // executer ce qui suit — sur toutes les pages servies depuis le cache de bord.
        // Les titres viennent de contributeurs : au sens de la securite, c'est une
        // entree non fiable, et le parsing tolerant ne protege que du mal forme.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* ⚠️ `-mt-8` annule le `py-8` de `<main>` : sans lui, une bande d'encre separait la
          banniere de la barre de navigation, ce qui la faisait lire comme une image collee
          dans la page. Avec, elle passe **sous** la barre translucide, qui la floute.

          ⚠️ **Le repli est la mise en page d'avant, au pixel pres** : sans banniere, ni
          `.bleed` ni `.art-bed`. C'est le cas courant, pas l'exception. */}
      <header
        className={
          backdrop !== undefined ? 'bleed art-bed -mt-8 pt-8 pb-6 sm:pt-12 sm:pb-10' : ''
        }
      >
        {backdrop !== undefined ? (
          // Desormais le plus gros element de l'ecran, donc celui que Google chronometre.
          // eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous.
          <img
            src={backdrop}
            srcSet={`${backdropUrl(detail.backdropPath, 'w780')} 780w, ${backdrop} 1280w`}
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
          // Les dimensions declarees empechent la page de sauter quand l'affiche arrive.
          //
          // ⚠️ **`sm:w-56` et non `w-36` : l'agrandissement ne coute pas un octet.** Mesure du
          // 2026-08-07 sur la page servie : l'affiche etait rendue a **144 px de large, soit
          // 14 % de la colonne**, alors que le fichier telecharge fait deja **342 px**. On
          // payait donc une image 2,4 fois plus grande que ce qu'on montrait, sur la page dont
          // la regle fondatrice est « l'affiche est l'interface ». A
          // 224 px elle occupe 22 % de la colonne — l'ordre de grandeur de Letterboxd, la
          // reference choisie — et reste **sous** la resolution du fichier, donc nette.
          //
          // Le mobile garde `w-36` : sous 640 px la disposition passe en colonne, et cet
          // ecran-la n'a pas encore ete regarde a l'oeil. On ne change pas ce qu'on n'a pas vu.
          //
          // ⚠️ `fetchPriority` est parti a la banniere : deux images en priorite haute ne
          // priorisent rien. `panel` porte la matiere commune, elevation comprise — c'est
          // elle qui decolle l'affiche du visuel derriere.
          <img
            src={poster}
            alt=""
            decoding="async"
            width={posterDimensions('w342').width}
            height={posterDimensions('w342').height}
            className="panel w-36 shrink-0 self-start sm:w-56 sm:self-end"
          />
        ) : null}

        <div className="space-y-4">
          <div>
            {/* `.hero-title` : sur une image de 1248 px, les 1,75 rem de `.page-title` se
                perdent. */}
            <h1 className="hero-title">
              {detail.title}
              {started !== undefined ? (
                <span className="ml-2 font-normal text-(--color-muted)">{started}</span>
              ) : null}
            </h1>
            {detail.originalTitle !== undefined && detail.originalTitle !== detail.title ? (
              <p className="text-sm text-(--color-muted)">{detail.originalTitle}</p>
            ) : null}
          </div>

          {/* Le differenciateur immediat : personne n'affiche correctement la
              difference entre « entre deux saisons » et « morte depuis 18 mois ». */}
          {/* ⚠️ `locale` n'etait pas transmis : le badge — le differenciateur meme du
              produit — s'affichait en anglais sur les pages francaises. Un defaut que
              ni le typage ni les tests ne pouvaient voir, la valeur par defaut etant
              legale. */}
          <StatusBadge status={status} withDetail locale={locale} />

          {/* La seule information du site qui donne une raison de revenir a une date
              precise. « Dans trois jours » laissait le lecteur calculer et ignorer de
              quel episode il s'agit. */}
          {/* ⚠️ Le liseré vert et non le halo volt : « une couleur, un sens » — le vert parle
              de la SERIE (elle diffuse, la date tombe), le volt parle de VOUS. Poser ici
              l'emphase volt dirait que cette date vous concerne personnellement, ce qu'aucune
              page partagee entre tous les visiteurs ne peut savoir. */}
          {detail.nextEpisode !== undefined ? (
            <p className="rounded-md border-l-2 border-(--color-live) bg-(--color-live)/10 px-3 py-2 text-sm">
              <strong className="numeric">
                S{detail.nextEpisode.seasonNumber}E{detail.nextEpisode.episodeNumber}
              </strong>
              {detail.nextEpisode.title !== undefined
                ? ` — ${detail.nextEpisode.title}`
                : ''}{' '}
              <span className="text-(--color-muted)">
                {t(locale, 'series.airsOn', {
                  date: formatDate(detail.nextEpisode.airsOn, locale),
                })}
              </span>
            </p>
          ) : null}

          {detail.overview !== undefined ? (
            <p className="prose-note">
              {detail.overview}
            </p>
          ) : null}
        </div>
        </div>
      </header>

      <section aria-label={t(locale, 'series.demands')}>
        {/* Titre masque visuellement : les chiffres se lisent d'eux-memes, mais la
            structure du document doit rester coherente pour qui navigue au clavier
            ou au lecteur d'ecran — et pour les moteurs, qui lisent la hierarchie. */}
        <h2 className="sr-only">{t(locale, 'series.demands')}</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t(locale, 'stat.seasons')} value={String(seasons.rateable.length)} />
          <Stat label={t(locale, 'stat.episodes')} value={String(episodeCount)} />
          {totalRuntimeMinutes !== undefined ? (
            // Le tilde n'est pas cosmetique : le total est une estimation (mediane
            // d'une saison x nombre d'episodes), et l'annoncer comme exact serait
            // mentir sur la seule promesse chiffree de la page d'accueil.
            <Stat
              label={t(locale, 'stat.commitment')}
              value={`~ ${formatCommitment(totalRuntimeMinutes, translatorFor(locale))}`}
              emphasis
            />
          ) : null}
          {detail.lastAiredAt !== undefined ? (
            <Stat
              label={t(locale, 'stat.lastEpisode')}
              value={formatDate(detail.lastAiredAt, locale)}
            />
          ) : null}
        </dl>
      </section>

      {/* Le seul element de la page qui vous connaisse. Il s'ajoute cote navigateur :
          la page elle-meme reste statique et mise en cache, et **aucune donnee de
          journal ne traverse le serveur** — le HTML est partage entre tous les
          visiteurs par le cache de bord. */}
      {/* Les douze blocs de la page se lisaient comme une seule coulee. Le decoupage qui
          suit est **semantique** — la serie · vous · les autres · le detail · ailleurs — et
          il etait deja ecrit dans les commentaires de ce fichier sans rien rendre visible.
          Quatre coupures, pas douze : une ligne entre chaque bloc redessinerait un tableau. */}
      <div className="section-rule space-y-10">
      <MyProgress
        canPublish={legalIsComplete()}
        seriesId={id}
        seasons={seasons.rateable.map((s) => ({
          seasonNumber: s.ref.seasonNumber,
          episodeCount: s.episodeCount,
        }))}
        // Ce que la page sait deja : memorise tel quel, la bibliotheque pourra
        // dessiner cette serie sans un seul appel (`src/domain/library.ts`).
        series={{
          title: detail.title,
          ...(detail.posterPath !== undefined ? { posterPath: detail.posterPath } : {}),
          // Le statut **brut** : la bibliotheque le traduira dans SA langue. Memoriser
          // « Entre deux saisons » figerait ici la langue de cette page-ci.
          status: status.status,
          // ⚠️ Le libelle continue d'etre ecrit, et ce n'est pas une redondance : un
          // autre appareil peut tourner sur une version anterieure et ne lire que lui.
          // On migre ce qu'on controle ; le reste doit continuer de fonctionner.
          statusLabel: statusLabel(status.status, translatorFor(locale)),
          ...(detail.nextEpisode !== undefined
            ? { nextEpisodeAt: detail.nextEpisode.airsOn.toISOString() }
            : {}),
          ...(publicStars !== undefined ? { publicStars } : {}),
        }}
        // Mediane deduite du total : `lib/catalog.ts` l'a deja calculee sur une saison
        // representative, la redemander couterait un appel pour rien.
        {...(totalRuntimeMinutes !== undefined && episodeCount > 0
          ? { episodeMinutes: totalRuntimeMinutes / episodeCount }
          : {})}
      />

      {/* Juste apres les chiffres qu'il qualifie : il ne dit pas « erreur », il dit
          quelle convention ces chiffres suivent. Se tait sur la majorite des series. */}
      {/* Ce que les autres ont ecrit. Sous la progression : on lit l'avis des gens APRES
          avoir pu dire ou l'on en est, sans quoi le caviardage n'a rien sur quoi se regler.
          Composant client, chargement paresseux, aucune route serveur — la page reste
          `force-static`. */}
      {/* Ranger une serie est un geste de **consultation**, pas de progression : on le fait
          avant d'avoir commence, souvent sans avoir d'avis. Il vit donc avec les critiques
          et non dans la carte de progression. Silencieux sans compte. */}
      {/* ⚠️ Charge en parallele du reste : les visuels sont un appel de plus, et personne
          ne doit attendre une affiche pour lire une critique. Se tait quand la serie n'a
          qu'un visuel — un selecteur a un element est un bouton qui ne fait rien. */}
      <SeriesArtworkChoice id={id} />

      <AddToList seriesId={id} />
      </div>

      {/* Les autres. */}
      <div className="section-rule space-y-10">
      <Reviews seriesId={id} />

      {/* Apres les critiques, et non avant : on lit d'abord ce que disent les gens qu'on a
          choisi de suivre, puis on decouvre les autres. C'est l'inverse de `/amis`, ou
          `Discover` passe **devant** le fil — mais la, le fil est vide au demarrage et la
          page serait blanche ; ici la page est pleine de toute facon. */}
      <SeriesPeople seriesId={id} />
      </div>

      {/* Le detail — ce qu'on vient chercher une fois la decision prise. */}
      <div className="section-rule space-y-10">
      <SeriesOrderings
        id={id}
        seasonCount={seasons.rateable.length}
        episodeCount={episodeCount}
        locale={locale}
      />

      <WatchHere id={id} locale={locale} />

      <Trajectory
        id={id}
        title={detail.title}
        seasons={seasons}
        locale={locale}
        episodeCount={episodeCount}
        {...(totalRuntimeMinutes !== undefined ? { totalRuntimeMinutes } : { totalRuntimeMinutes: undefined })}
        airingSeason={detail.nextEpisode?.seasonNumber}
      />

      <SeasonList seasons={seasons} locale={locale} />
      </div>

      {/* Ailleurs — la seule sortie de la page. */}
      <div className="section-rule">
        <AlsoByCreators detail={detail} locale={locale} />
      </div>
    </article>
  );
}

export default async function SeriesPage({ params }: PageProps) {
  const { id } = await params;
  return <SeriesView id={id} locale={DEFAULT_LOCALE} />;
}

/**
 * Le seul maillage interne du site.
 *
 * Une page serie ne renvoyait vers aucune autre : cul-de-sac pour le visiteur comme
 * pour le crawl. « Du meme createur » est un **credit de production**, pas un calcul
 * de similarite — ce qui le distingue de la recommandation algorithmique, ecartee
 * par
 */
async function AlsoByCreators({ detail, locale }: {
  readonly detail: Awaited<ReturnType<typeof getSeriesPageData>>['detail'];
  readonly locale: Locale;
}) {
  const others = await alsoByCreators(detail, 6, locale);
  if (others.length === 0) return null;

  const names = (detail.creators ?? [])
    .slice(0, 2)
    .map((c) => c.name)
    .join(t(locale, 'join.and'));

  return (
    // Meme regle que partout : une grille d'affiches sort de la colonne de lecture.
    <section className="bleed space-y-4" aria-label={t(locale, 'series.sameCreator')}>
      <div>
        <h2 className="section-heading">
          {t(locale, 'series.sameCreator')}
        </h2>
        {names.length > 0 ? (
          <p className="text-sm text-(--color-muted)">{names}</p>
        ) : null}
      </div>
      <ul className="poster-grid">
        {others.map((series) => (
          <li key={series.providerId}>
            <SeriesCard series={series} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ou regarder la serie — le dernier maillon de la decision.
 *
 * ⚠️ **La region suit la langue, faute de mieux — et ce n'est plus qu'un repli.** Un
 * francophone belge n'a pas le catalogue francais (`lib/i18n.ts`, {@link watchRegion}).
 * Depuis le 2026-08-10, on ne le devine plus : on sert {@link SERVED_WATCH_REGIONS} et le
 * navigateur garde les pays que la personne a choisis. La langue ne decide que du repli,
 * pour qui n'a rien choisi.
 *
 * ⚠️ **Le serveur ne peut PAS lire les pays choisis** : ils vivent dans le journal, donc
 * dans le navigateur. Les lire ici rendrait la page personnelle, c'est-a-dire une
 * invocation par visite — le cout que ce depot refuse partout.
 */
/**
 * Les visuels proposes pour cette serie.
 *
 * ⚠️ La partie **asynchrone** est isolee dans son propre composant, comme
 * `SeriesOrderings` : c'est ce qui permet a `render(await …)` de traverser fournisseur →
 * cache → ecran dans un test, et c'est le maillon qu'`episodeMinutes` n'avait pas.
 */
async function SeriesArtworkChoice({ id }: { readonly id: string }) {
  const visuals = await artwork(id);
  return (
    // ⚠️ On passe l'identifiant, **pas** la cle de journal : la fabriquer ici obligerait ce
    // module serveur a importer `src/domain/journal`, ce que `no-journal-on-server`
    // interdit — et cette garde a attrape l'import a la seconde ou il a ete ecrit.
    <ChooseArtwork
      seriesId={id}
      posters={visuals.posters}
      backdrops={visuals.backdrops}
    />
  );
}

async function WatchHere({ id, locale }: {
  readonly id: string;
  readonly locale: Locale;
}) {
  return (
    <WatchOptions
      byRegion={await watchOptions(id, SERVED_WATCH_REGIONS)}
      fallbackRegion={watchRegion(locale)}
    />
  );
}

/**
 * La trajectoire, **coupee a l'horizon du spectateur**.
 *
 * La regle du spoiler : rien qui depasse la position du
 * spectateur ne s'affiche sans qu'il le demande. Or la courbe est elle-meme un
 * spoiler — montrer qu'elle s'effondre en saison 5 est une information que quelqu'un
 * en saison 2 n'a pas demandee, et le decrochage annonce en toutes lettres qu'il va
 * etre decu, et quand.
 *
 * Ce composant ne fait que **charger** : c'est `TrajectorySection`, cote navigateur,
 * qui decide de ce qui s'affiche — lui seul connait la position, qui ne doit jamais
 * traverser le serveur. Sans position, tout reste derriere le geste explicite ; avec,
 * la courbe se decouvre a mesure qu'on avance.
 */
async function Trajectory({ id, title, seasons, totalRuntimeMinutes, episodeCount, locale, airingSeason }: {
  readonly id: string;
  readonly title: string;
  readonly seasons: Awaited<ReturnType<typeof getSeriesPageData>>['seasons'];
  readonly totalRuntimeMinutes: number | undefined;
  readonly episodeCount: number;
  readonly locale: Locale;
  /** Saison en cours de diffusion, quand un episode est annonce. */
  readonly airingSeason: number | undefined;
}) {
  // Les deux partagent le meme cache de saisons : afficher la grille en plus de la
  // courbe ne coute pas un appel supplementaire.
  const [trajectory, grid] = await Promise.all([
    publicTrajectory(id, seasons, locale),
    episodeRatings(id, seasons, locale),
  ]);
  if (trajectory === undefined) return null;

  const advice = stopPointAdvice(trajectory, seasons, totalRuntimeMinutes, episodeCount);
  // Aucun appel supplementaire : la grille est deja chargee pour l'affichage, et le
  // point d'entree n'est qu'une lecture de plus sur les memes donnees.
  const rated = grid.flatMap((season) => season.episodes);
  const entry = findEntryPoint(rated);
  // La saison en cours est celle du prochain episode annonce. Deduire « la plus haute
  // saison notee » serait faux : le catalogue annonce parfois la suivante avant qu'elle
  // ne soit diffusee.
  const current =
    airingSeason !== undefined ? judgeCurrentSeason(rated, airingSeason) : undefined;

  return (
    <>
      <TrajectorySection
        seriesId={id}
        title={title}
        trajectory={trajectory}
        grid={grid}
        advice={advice}
        entryPoint={entry}
        currentSeason={current}
      />
      {/* Juste sous la courbe publique, parce que c'est la **meme question** posee a une
          autre matiere : celle-la dit ce que pensent ceux qui sont restes, celle-ci ou les
          autres sont partis. Les separer les rendrait incomparables.

          Les saisons descendent dans la forme legere que `MyProgress` recoit deja
          (`SeasonSize`) : l'objet de catalogue ne traverse pas jusqu'au navigateur. */}
      <StopMap
        seriesId={id}
        seasons={seasons.rateable.map((s) => ({
          seasonNumber: s.ref.seasonNumber,
          episodeCount: s.episodeCount,
        }))}
        episodeCount={episodeCount}
      />
    </>
  );
}

/**
 * Un chiffre de la fiche.
 *
 * ## `emphasis` designe **la** reponse de la page, et une seule
 *
 * « ~ 50 heures — 2 jours et 2 h » repond a la question que pose le nom du site. Elle
 * s'affichait avec exactement le meme poids visuel que « 29 septembre 2013 » : quatre
 * cartes identiques, dont une seule comptait. Le regard n'avait aucune raison d'aller au
 * bon endroit.
 *
 * Elle porte donc l'accent du produit, la grille monospace et un liseré lumineux — et les
 * trois autres restent volontairement plates. Mettre deux chiffres en avant reviendrait a
 * n'en mettre aucun.
 */
function Stat({ label, value, emphasis = false }: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}) {
  return (
    <div
      // 🔴 `panel-lit` et non trois utilitaires. La version precedente ecrivait
      // `shadow-[0_0_24px_-12px_…]`, c'est-a-dire un `box-shadow` **complet** — et un
      // utilitaire gagne sur la couche `components`. Elle effacait donc l'elevation
      // partagee, ce qui faisait de la seule tuile qui compte **la seule tuile plate de la
      // page**. Exactement le defaut que `--halo` existe pour rendre impossible.
      //
      // Le fond volt reste un utilitaire : c'est la seule chose que `.panel-lit` ne fasse
      // pas, et il ne se compose avec rien.
      className={`tile ${emphasis ? 'panel-lit bg-(--color-volt)/[0.06]' : ''}`}
    >
      <dt className={`label ${emphasis ? 'text-(--color-volt)/80' : ''}`}>{label}</dt>
      <dd
        className={`tile-value ${
          emphasis ? 'font-semibold text-(--color-volt)' : 'text-base text-(--color-text)'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

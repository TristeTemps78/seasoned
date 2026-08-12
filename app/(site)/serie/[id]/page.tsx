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
import { Cast } from '@/app/components/Cast';
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

  /*
   * 🔴 **`space-y-10` a fait exactement au parent ce qu'il avait fait a l'enfant.** Mesure au
   * DOM le 2026-08-12, sur `/fr/serie/1396` :
   *
   *     article.space-y-10 > enfants   margin-block-start  0px   (tous, le PREMIER compris)
   *     .show-hero                     margin-top          0px   au lieu de -2rem
   *
   * L'utilitaire de Tailwind 4 ne pose pas son espacement sur « chaque enfant suivant » : il
   * pose `margin-block-start: 0` **et** `margin-block-end` sur chaque enfant sauf le dernier.
   * Le premier enfant est donc remis a zero lui aussi — et `.show-hero`, cree le 2026-08-11
   * precisement pour sortir `.show-header-overlap` de ce piege, y est tombe a son tour, un
   * niveau plus haut. Le `-2rem` qui doit faire partir la banniere sous la barre translucide
   * n'avait jamais ete rendu.
   *
   * `gap` et non `space-y` : un ecart de disposition ne se negocie pas avec les marges des
   * enfants, donc il n'y a plus rien a ecraser. C'est la meme correction structurelle qu'au
   * 2026-08-11, portee cette fois au bon niveau.
   */
  return (
    <article className="flex flex-col gap-10">
      <script
        type="application/ld+json"
        // ⚠️ `serializeJsonLd` et non `JSON.stringify` : ce dernier n'echappe pas `<`,
        // donc un titre TMDB valant `</script><script>…` refermait la balise et faisait
        // executer ce qui suit — sur toutes les pages servies depuis le cache de bord.
        // Les titres viennent de contributeurs : au sens de la securite, c'est une
        // entree non fiable, et le parsing tolerant ne protege que du mal forme.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* 🔴 **La bande et l'en-tete sont UN SEUL enfant du document depuis le 2026-08-11**, et
          c'est ce qui fait enfin exister le chevauchement.

          Ils etaient deux freres de l'`<article className="space-y-10">`. Or l'utilitaire
          d'espacement de Tailwind 4 pose `margin-block-start: 0` sur chaque enfant suivant, et
          ecrasait donc le `margin-top: -9rem` de `.show-header-overlap` — mesure au DOM :
          `getComputedStyle(header).marginTop === "0px"`. La banniere finissait a `y=588`,
          l'en-tete commencait a `y=628` : quarante pixels de vide la ou le code promettait
          cent pixels de recouvrement. **La fiche de film n'avait jamais ete rendue une fois.**

          ⚠️ La correction est **structurelle** : gagner la cascade a coups de specificite
          laisserait le piege arme pour le prochain `space-y`. Voir `.show-hero`.

          ⚠️ `.show-hero` porte le `-2rem` qui annule le `py-8` de `<main>` : sans lui, une
          bande d'encre separe la banniere de la barre de navigation, ce qui la fait lire comme
          une image collee dans la page. **Uniquement s'il y a une banniere** — sinon le titre
          passerait sous la navigation, et le cas est courant. */}
      <div className={backdrop !== undefined ? 'show-hero' : undefined}>
        {backdrop !== undefined ? (
          <div className="show-backdrop" aria-hidden="true">
            {/* Le plus gros element de l'ecran, donc celui que Google chronometre. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous. */}
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
          </div>
        ) : null}

      <header
        className={`show-header ${backdrop !== undefined ? 'show-header-overlap' : ''}`}
      >
        {poster !== undefined ? (
          // Les dimensions declarees empechent la page de sauter quand l'affiche arrive.
          //
          // ⚠️ **`sm:w-full` : c'est la GRILLE qui fixe la largeur desormais** (14 rem), plus
          // l'image. L'ancienne version portait `sm:w-56` en dur a cote d'un conteneur en
          // `flex` — deux endroits decidaient de la meme chose, et la colonne de texte se
          // decalait d'une serie a l'autre selon que l'affiche existait ou non.
          //
          // Elle porte `.poster-frame` comme toutes les autres du produit : anneau clair,
          // double ombre, puits sombre. Elle mord dans la banniere, donc elle doit se lire
          // comme un objet POSE dessus — c'est tout l'effet recherche.
          //
          // ⚠️ `fetchPriority` est parti a la banniere : deux images en priorite haute ne
          // priorisent rien. `panel` porte la matiere commune, elevation comprise — c'est
          // elle qui decolle l'affiche du visuel derriere.
          <div className="poster-frame aspect-2/3 w-32 self-start sm:w-full">
            <img
              src={poster}
              alt=""
              decoding="async"
              width={posterDimensions('w342').width}
              height={posterDimensions('w342').height}
              className="h-full w-full object-cover"
            />
          </div>
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
              <p className="meta">{detail.originalTitle}</p>
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

          {/* =============================================================================
              🔴 CE QUE LA SERIE VOUS DEMANDE — remonte de 830 px, et cesse d'etre illisible
              =============================================================================

              Ce bloc vivait dans la colonne laterale, et les deux defauts s'additionnaient :

                - **il etait trop bas.** Mesure au DOM : `y=1681` sur un document de 3764, soit
                  plus de deux ecrans de 720 px sous le titre. Le seul chiffre que ce produit
                  affiche et qu'aucun concurrent ne calcule etait derriere un mur de 636 px de
                  photos d'acteurs ;
                - **il etait illisible.** Quatre tuiles de 64 px de large dans une colonne de
                  304, libelles coupes. Voir `.series-measures` pour la mesure complete.

              Il ferme donc l'en-tete : *qu'est-ce que c'est → dans quel etat → quand revient
              le prochain → de quoi ca parle → **ce que ca vous coute***. La derniere ligne est
              la chute, et elle touche « Ou j'en suis » qui commence juste dessous.

              ⚠️ Il reste un `<section>` avec son titre pour lecteur d'ecran : le remonter ne
              doit pas le sortir de la hierarchie du document, que les moteurs lisent. */}
          <section aria-label={t(locale, 'series.demands')}>
            {/* Titre masque visuellement : les chiffres se lisent d'eux-memes, mais la
                structure du document doit rester coherente pour qui navigue au clavier
                ou au lecteur d'ecran — et pour les moteurs, qui lisent la hierarchie. */}
            <h2 className="sr-only">{t(locale, 'series.demands')}</h2>
            <dl className="series-measures">
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
        </div>
      </header>
      </div>


      {/* =============================================================================
          🔴 DEUX COLONNES — la fiche cesse d'etre une colonne unique
          =============================================================================

          « Il y a encore trop de linearite. » Le mot etait juste et la cause etait simple :
          **tout le produit tenait dans une seule colonne**, section apres section, du haut
          vers le bas. Onze blocs a la file, tous de la meme largeur.

          A gauche, ce qui vous concerne et ne bouge pas : les mesures de la serie, votre
          progression, vos listes. **Colle** au defilement, donc toujours atteignable pendant
          qu'on parcourt le generique ou les critiques a droite.

          ⚠️ La colonne laterale est **premiere dans le document**. Sous 64 rem la grille
          retombe en une colonne, et c'est l'ordre du DOM qui decide : votre progression doit
          arriver avant les critiques des autres sur un telephone. */}
      <div className="series-split">
        <aside className="series-aside">
      {/* ⚠️ « Ce que la serie vous demande » **est parti d'ici** et ferme desormais l'en-tete.
          Cette colonne ne porte plus que ce qui est a VOUS : votre progression, votre affiche,
          vos listes. C'est ce qui la rend nommable en un mot, et ce qui explique qu'elle passe
          en premier dans le document sur un telephone. */}

      {/* Le seul element de la page qui vous connaisse. Il s'ajoute cote navigateur :
          la page elle-meme reste statique et mise en cache, et **aucune donnee de
          journal ne traverse le serveur** — le HTML est partage entre tous les
          visiteurs par le cache de bord. */}
      {/* Les douze blocs de la page se lisaient comme une seule coulee. Le decoupage qui
          suit est **semantique** — la serie · vous · les autres · le detail · ailleurs — et
          il etait deja ecrit dans les commentaires de ce fichier sans rien rendre visible.
          Quatre coupures, pas douze : une ligne entre chaque bloc redessinerait un tableau. */}
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
        </aside>

        {/* =============================================================================
            A droite : les faits d'abord, les avis ensuite
            =============================================================================

            🔴 Cette colonne s'ouvrait sur `Reviews`. Depuis que les critiques ne se taisent
            plus a zero (2026-08-11), son premier element est donc, sur la quasi-totalite du
            catalogue, **un encart vide** — mesure a 198 px de haut sur `/serie/1396`. Ouvrir
            la moitie principale de la page sur une boite qui dit « personne n'a encore ecrit »
            etait le prix a payer de la conversion, et il ne se paie pas ici.

            L'ordre suit desormais la question que la page sert : *puis-je la voir* (ou), *est-ce
            qu'elle tient* (la trajectoire, le differenciateur), *comment elle est faite* (les
            saisons, les montages), et enfin *qu'en disent les gens*. Les faits avant les avis —
            c'est deja l'ordre que la colonne de gauche applique en faisant passer votre
            position avant les critiques des autres. */}
        <div className="series-main">
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

      {/* Le detail des montages — ce qu'on vient verifier une fois la decision prise. */}
      <SeriesOrderings
        id={id}
        seasonCount={seasons.rateable.length}
        episodeCount={episodeCount}
        locale={locale}
      />

      <Reviews seriesId={id} />

      {/* Apres les critiques, et non avant : on lit d'abord ce que disent les gens qu'on a
          choisi de suivre, puis on decouvre les autres. C'est l'inverse de `/amis`, ou
          `Discover` passe **devant** le fil — mais la, le fil est vide au demarrage et la
          page serait blanche ; ici la page est pleine de toute facon. */}
      <SeriesPeople seriesId={id} />
        </div>
      </div>

      {/* =============================================================================
          Le generique et le voisinage — le detail qu'on regarde APRES avoir decide
          =============================================================================

          🔴 `Cast` etait rendu **avant** les deux colonnes, et son commentaire assumait la
          decision : *« un visage repond a quelle est cette serie […] c'est la raison pour
          laquelle la reference le place haut »*. Mesure au DOM le 2026-08-11 : la rangee
          occupait **636 px** entre le synopsis et tout le reste, et repoussait « ce que la
          serie vous demande » a `y=1681`.

          C'est-a-dire que le bloc le plus banal de la page — celui que TMDB, Wikipedia,
          Allocine et Netflix affichent tous a l'identique — se payait deux ecrans de
          defilement, pris sur le seul bloc qu'aucun d'eux n'affiche. La regle 3 du projet dit
          *ne pas refaire ce qui existe deja* ; elle ne dit pas de lui donner la meilleure
          place.

          Il descend donc avec « du meme createur » : deux rangees pleine largeur, meme
          nature — le voisinage d'une serie, qu'on parcourt une fois la decision prise.
          ⚠️ **Hors des deux colonnes** : ce sont des grilles d'affiches, et les coincer dans
          1 fr les reduirait a trois vignettes. */}
      <div className="section-rule space-y-10">
        <Cast cast={detail.cast ?? []} locale={locale} />
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
          <p className="meta">{names}</p>
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

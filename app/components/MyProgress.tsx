'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { WhereItLives } from '@/app/components/WhereItLives';
import { StarRating } from '@/app/components/StarRating';
import { ReviewEditor } from '@/app/components/ReviewEditor';
import {
  completionCount,
  favoritesOf,
  hasCompletionOn,
  MAX_FAVORITES,
  isRewatching,
  journalKey,
  marksOf,
  suggestedSeasonRating,
  type JournalSnapshot,
} from '@/src/domain/journal';
import { catchUpPlan } from '@/src/domain/catch-up';
import { seasonToRate } from '@/src/domain/nudge';
import { remainingAfter } from '@/src/domain/remaining';
import { formatCommitment } from '@/lib/format';
import { pathIn } from '@/lib/routes';

export interface SeasonShape {
  readonly seasonNumber: number;
  readonly episodeCount: number;
}

/**
 * Ce que la page sait deja de la serie, et qu'il suffit de memoriser.
 *
 * ⚠️ **Derive de {@link JournalSnapshot}, jamais recopie.** Ce type en etait une copie
 * manuelle, donc un champ ajoute a l'instantane n'arrivait pas jusqu'ici : le typage
 * refusait alors de le transmettre, et la page perdait la valeur. C'est le meme accident
 * que l'oubli d'un champ dans `isFresh`, mais du cote de l'ecriture — et il s'agissait de
 * garder **deux** listes d'accord a la main.
 *
 * Les deux champs retires sont ceux que cette couche ne connait pas : `cachedAt` est pose
 * par le journal a l'ecriture, et `seasonSizes` se deduit de la prop `seasons`.
 */
export type SeriesShape = Omit<JournalSnapshot, 'cachedAt' | 'seasonSizes'>;

/**
 * Ce que le produit retient de vous, sur une serie.
 *
 * Les gestes sont ranges par friction croissante, et le
 * premier d'entre eux a longtemps manque :
 *
 *   0. **« je veux la voir »** — ne suppose rien, ni d'avoir commence, ni d'avoir un
 *      avis. C'est le seul geste possible pour la quasi-totalite des arrivants, qui
 *      viennent d'un moteur de recherche et n'ont pas vu la serie. Sans lui, le
 *      produit demandait de finir avant de pouvoir commencer ;
 *   1. **la position** — un geste, et tout ce qui precede est implicitement vu ;
 *   2. **la note de saison** — un tap de plus, et seulement si on le veut ;
 *   3. **la decision** — continuer, mettre en pause, abandonner.
 *
 * Personne ne voit le niveau au-dessus de celui qu'il a choisi.
 *
 * Tout est garde dans le navigateur. Aucun compte, aucune donnee envoyee nulle part —
 * et la page qui l'accueille reste statique et mise en cache.
 */
export function MyProgress({ seriesId, seasons, series, episodeMinutes, canPublish = false }: {
  readonly seriesId: string;
  readonly seasons: readonly SeasonShape[];
  readonly series: SeriesShape;
  /**
   * Duree mediane d'un episode. Absente sur les series dont TMDB ne dit rien — et
   * c'est le cas courant, pas l'exception.
   */
  readonly episodeMinutes?: number;
  /** Le verrou legal est-il leve ? Ecrire est toujours possible ; publier, non. */
  readonly canPublish?: boolean;
}) {
  const {
    journal,
    ready,
    setPosition,
    setSeasonRating,
    setDecision,
    setWanted,
    setLiked,
    watchAgain,
    toggleFavorite,
    rememberSnapshot,
  } = useJournal();
  const tr = useT();
  const { t, tn, n, locale } = tr;

  // Jamais l'identifiant nu : les cles du journal portent leur fournisseur, pour qu'un
  // changement de catalogue reste un remappage et non une perte (`journal.ts`).
  const key = journalKey(seriesId);
  const entry = journal.entries[key];
  const position = entry?.position;
  const tracked = entry !== undefined;

  // Ce qu'on memorise : ce que la page sait deja, **plus la forme de la serie**.
  //
  // Les deux morceaux de cette forme sont deja la, en props. Sans eux dans l'instantane,
  // `/moi` ne peut pas traduire « saison 3, episode 7 » en un temps passe — il ne fait
  // aucun appel reseau, donc ce qu'il n'a pas ici, il ne l'aura jamais pour cette visite.
  //
  // ⚠️ **`episodeMinutes` doit etre recopie explicitement.** Il arrive en prop **a cote**
  // de `series`, pas dedans : le type l'acceptait, la page ne le remplissait pas, et le
  // champ ajoute a l'instantane le matin meme n'etait donc **jamais ecrit**. Trouve par
  // ce test et par lui seul — une verification au navigateur ne pouvait pas le voir,
  // puisque le journal de test portait deja la valeur qu'on croyait ecrire.
  //
  // ⚠️ **Memoise, et ce n'est pas une optimisation** : `setSnapshot` reecrit toujours, avec
  // un `cachedAt` neuf. Un objet reconstruit a chaque rendu ferait donc une ecriture dans
  // `localStorage` a chaque rendu, indefiniment. `series` et `seasons` viennent d'un
  // composant serveur, leurs references sont stables ; l'objet fusionne doit l'etre aussi.
  const toRemember = useMemo(
    () => ({
      ...series,
      seasonSizes: seasons,
      ...(episodeMinutes !== undefined ? { episodeMinutes } : {}),
    }),
    [series, seasons, episodeMinutes],
  );

  // N'ecrit que si l'entree existe deja : passer sur une page ne doit pas remplir le
  // journal, ni constituer une base de metadonnees que le contrat interdit.
  useEffect(() => {
    if (!ready || !tracked) return;
    rememberSnapshot(key, toRemember);
  }, [ready, tracked, key, toRemember, rememberSnapshot]);

  // Tant que le stockage n'a pas ete lu, on n'affiche rien : dire « vous n'avez rien
  // vu » a quelqu'un qui a tout note serait pire que d'attendre un instant.
  //
  // La hauteur reservee est celle du bloc **replie**, pas une valeur ronde : la
  // premiere version reservait 96 px pour un bloc qui en fait bien plus, et
  // reintroduisait ainsi le decalage de mise en page que la tache 1.24 avait supprime
  // sur cette page meme.
  if (!ready || seasons.length === 0) {
    return <div className="h-[4.5rem]" aria-hidden="true" />;
  }

  const current = seasons.find((s) => s.seasonNumber === position?.seasonNumber);

  // Ce qu'il reste, et la saison qu'on peut noter maintenant : deux calculs purs, tires
  // de la seule position. Le serveur n'en sait rien et n'a pas a en savoir.
  // ⚠️ Les marques passent ICI, sinon la feature n'existe qu'en base : « il vous reste
  // 12 episodes » continuerait de compter ceux qu'on vient de declarer sauter. Ce depot a
  // livre `ordering.ts` et `episodeMinutes` morts-nes exactement comme ca.
  const marks = marksOf(entry);
  const left = remainingAfter(seasons, position, episodeMinutes, marks);
  const rated = new Set(
    Object.keys(entry?.seasonRatings ?? {})
      .map(Number)
      .filter((n) => Number.isFinite(n)),
  );
  const toRate = seasonToRate(seasons, position, rated, marks);

  // Le revisionnage : le seul comportement qui distingue une serie aimee d'une serie
  // simplement finie. Une note de cinq etoiles se pose une fois ; un troisieme passage
  // est bien plus difficile a falsifier.
  const passes = completionCount(entry);
  const again = isRewatching(entry);
  // ⚠️ `markCompleted` est idempotent dans la journee. Proposer le geste un jour ou il ne
  // peut rien ecrire donnerait un bouton **qui a l'air de marcher** — la forme la plus
  // insidieuse du bouton mort, et celle que la regle du 2026-08-09 vise sans la nommer.
  const passedToday = hasCompletionOn(entry, new Date());

  // La carte de visite : quatre au plus, donc l'interface doit connaitre l'etat courant
  // avant de proposer le geste.
  const favorites = favoritesOf(journal);
  const pinned = favorites.includes(key);

  // « 14 episodes en 12 jours » : ce qui reste, rapporte a la date de retour. Croiser
  // les deux transforme une bibliotheque en plan — et ne coute rien, tout est deja la.
  const plan = catchUpPlan(
    left,
    series.nextEpisodeAt !== undefined ? new Date(series.nextEpisodeAt) : undefined,
    new Date(),
    episodeMinutes,
  );

  return (
    <section
      // ⚠️ `card panel-lit` : c'est **le seul bloc de la fiche qui vous connaisse**, donc
      // celui vers lequel le regard doit aller une fois la decision prise. Il portait
      // `edge-lit` — le liseré sans le halo — ce qui le laissait au meme poids que les onze
      // autres surfaces de la page. `card` porte la forme et le rembourrage, `panel-lit`
      // n'ajoute que l'emphase : deux formes nommees qui se composent, aucun utilitaire.
      className="band"
      aria-label={t('progress.aria')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="row-title">{t('progress.title')}</h2>
        <WhereItLives />
      </div>

      {/* ⚠️ Volt et non vert : un revisionnage est un fait **sur vous**, pas sur la serie.
          Le vert dit « en diffusion » sur les vignettes et dans le calendrier ; l'employer
          ici lui donnerait un second sens. */}
      {passes > 0 ? (
        <p className="text-sm text-(--color-volt)">
          {again ? tn('rewatch.again', passes + 1) : tn('rewatch.done', passes)}
          {/* Dire que le passage du jour est enregistre, faute de quoi l'absence du bouton
              juste en dessous se lirait comme une fonctionnalite manquante et non comme un
              geste deja fait. */}
          {passedToday ? <span className="meta-sm"> · {t('rewatch.today')}</span> : null}
        </p>
      ) : null}

      {/* Le carnet — le premier champ de texte libre du produit. Place ici, sous les
          gestes, parce qu'ecrire demande plus que tout le reste : personne ne doit tomber
          dessus avant d'avoir eu le geste a un tap. */}
      {/* Niveau 0 — le geste qui ne suppose rien. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={entry?.wanted !== undefined}
          onClick={() => setWanted(key, entry?.wanted === undefined)}
          // ⚠️ Aucune classe conditionnelle : `.btn[aria-pressed='true']` porte l'etat
          // choisi. L'apparence derive donc de l'attribut d'accessibilite au lieu de le
          // doubler — deux sources pour un meme etat finissent toujours par diverger, et
          // c'est l'attribut, pas la classe, qui dit la verite a un lecteur d'ecran.
          className="btn rounded-full"
        >
          {entry?.wanted !== undefined ? t('progress.wanted') : t('progress.want')}
        </button>

        {/* Le coeur — l'attachement, qui n'est pas la note.
            Il est offert **sans condition de position** : on peut aimer une serie qu'on n'a
            pas finie, et meme une qu'on n'a pas commencee mais qu'on connait deja. Le
            reserver a ceux qui ont pose une position en ferait une recompense de fin de
            parcours, ce qu'il n'est pas. */}
        <button
          type="button"
          aria-pressed={entry?.liked !== undefined}
          onClick={() => setLiked(key, entry?.liked === undefined)}
          className="btn rounded-full"
        >
          <span aria-hidden="true">{entry?.liked !== undefined ? '♥' : '♡'}</span>{' '}
          {entry?.liked !== undefined ? t('progress.liked') : t('progress.like')}
        </button>

        {/* 🔴 Le revisionnage : le format le retient depuis la v3 (`completions` est une
            LISTE de dates), et rien ne savait en ecrire une seconde. Le seul chemin etait
            `setDecision(key, 'completed')` — donc une fois, au moment ou l'on declare la
            serie finie. Revoir *The Office* une troisieme fois n'avait aucun endroit ou
            aller, alors que c'est le fait le plus difficile a falsifier du produit.

            Condition : au moins un passage acheve. « Revue » ne veut rien dire avant
            d'avoir ete vue une fois, et le geste de la premiere fois existe deja plus bas
            (la decision « terminee »). Deux boutons pour le meme fait dedoubleraient la
            question sans rien ajouter.

            Absent le jour ou un passage est deja enregistre : voir `passedToday`. */}
        {/* Epingler — la carte de visite. Le geste vit ici et **pas** sur `/moi` : on decide
            qu'une serie vous represente en la regardant, pas en parcourant une grille. Ce
            qui reste sur `/moi`, c'est l'affichage et le decrochage.

            ⚠️ Le bouton disparait quand quatre series sont deja epinglees ET que celle-ci
            n'en fait pas partie : `toggleFavorite` rend alors le journal inchange, donc le
            proposer donnerait un bouton qui a l'air de marcher — exactement ce que
            `passedToday` evite deux lignes plus bas. La phrase qui le remplace dit la
            condition et ou la lever (regle 4 : une porte nommee n'est pas un bouton mort). */}
        {pinned || favorites.length < MAX_FAVORITES ? (
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => toggleFavorite(key)}
            className="btn rounded-full"
          >
            {pinned ? t('favorites.pinned') : t('favorites.pin')}
          </button>
        ) : (
          <span className="meta-sm">
            {t('favorites.full')}{' '}
            <Link href={pathIn('/moi', locale)} className="tap-line underline hover:text-(--color-text)">
              {t('favorites.manage')}
            </Link>
          </span>
        )}

        {passes > 0 && !passedToday ? (
          <button
            type="button"
            onClick={() => watchAgain(key)}
            className="btn rounded-full"
          >
            {t('rewatch.mark')}
          </button>
        ) : null}

        {position === undefined ? (
          <button
            type="button"
            onClick={() => setPosition(key, seasons[0]?.seasonNumber ?? 1, 1)}
            className="btn rounded-full"
          >
            {t('progress.start')}
          </button>
        ) : null}
      </div>

      {/* Le chiffre du produit, enfin soustrait. « ~62 h » ne parle qu'a un arrivant :
          des qu'on a commence, c'est un cout deja paye en partie. Or c'est au milieu
          d'une serie qu'on se demande si on la finit. */}
      {left !== undefined && !left.done ? (
        <p className="border-t border-(--color-edge) pt-3 text-sm">
          {t('progress.remaining', {
            episodes: tr.tn('series.episodes', left.episodes),
            time:
              left.minutes !== undefined
                ? `~ ${formatCommitment(left.minutes, tr)}`
                : '—',
          })}
        </p>
      ) : null}

      {/* Le plan de rattrapage. Il s'affiche meme quand il est intenable : « il faudrait
          5 h par jour » est precisement l'information qui evite un marathon perdu
          d'avance. Le domaine donne le chiffre, c'est ici qu'on choisit la formulation. */}
      {plan !== undefined ? (
        <p
          className={`text-sm ${plan.withinReach ? 'text-(--color-live)' : 'text-(--color-warn)'}`}
        >
          {plan.minutesPerDay !== undefined
            ? t(plan.withinReach ? 'catchup.pace' : 'catchup.tight', {
                episodes: tr.tn('series.episodes', plan.episodes),
                days: tr.tn('catchup.days', plan.days),
                time: formatCommitment(plan.minutesPerDay, tr),
              })
            : t('catchup.plain', {
                episodes: tr.tn('series.episodes', plan.episodes),
                days: tr.tn('catchup.days', plan.days),
              })}
        </p>
      ) : null}

      {/* Niveau 1 — la position, qui n'apparait qu'une fois la serie commencee. */}
      {position !== undefined ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-(--color-edge) pt-3">
          <label className="meta" htmlFor="season">
            {t('progress.season')}
          </label>
          <select
            id="season"
            className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
            value={position.seasonNumber}
            onChange={(e) => {
              const season = Number(e.target.value);
              if (Number.isNaN(season)) return;
              setPosition(key, season, 1);
            }}
          >
            {seasons.map((s) => (
              <option key={s.seasonNumber} value={s.seasonNumber}>
                {s.seasonNumber}
              </option>
            ))}
          </select>

          {current !== undefined ? (
            <>
              <label className="meta" htmlFor="episode">
                {t('progress.episode')}
              </label>
              <select
                id="episode"
                className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
                value={position.episodeNumber}
                onChange={(e) =>
                  setPosition(key, current.seasonNumber, Number(e.target.value))
                }
              >
                {Array.from({ length: current.episodeCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="meta-sm">{t('progress.orGrid')}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Niveau 2 : les notes de saison. Jamais au-dela de la position — la regle de
          spoiler vaut aussi pour la saisie : proposer de noter la saison 6 dit qu'elle
          existe. */}
      {position !== undefined ? (
        <div className="space-y-2 border-t border-(--color-edge) pt-3">
          <p className="label">
            {t('progress.seasonRatings')}
          </p>

          {/* Le moment ou une note a le plus de sens est celui ou l'on vient de finir
              la saison. Le produit connaissait ce moment et n'en faisait rien : la
              note de saison etait offerte, jamais demandee. Un seul rappel a la fois —
              en reclamer six n'en ferait satisfaire aucun. */}
          {toRate !== undefined ? (
            <p className="text-sm text-(--color-volt)">
              {t('progress.rateSeason', { n: toRate })}
            </p>
          ) : null}
          <ul className="space-y-1">
            {seasons
              .filter((s) => s.seasonNumber <= position.seasonNumber)
              .map((s) => {
                const rating = entry?.seasonRatings?.[String(s.seasonNumber)];
                const suggestion = suggestedSeasonRating(entry, s.seasonNumber);
                return (
                  <li key={s.seasonNumber} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-16 shrink-0 text-(--color-muted)">
                      {t('progress.seasonN', { n: s.seasonNumber })}
                    </span>
                    <StarRating
                      value={rating?.stars}
                      label={t('rating.season', { n: s.seasonNumber })}
                      onChange={(stars) => setSeasonRating(key, s.seasonNumber, stars)}
                    />
                    {/* On signale, on ne repare pas en silence :
                        des episodes notes suggerent une note de saison, ils ne
                        l'ecrivent pas. */}
                    <ReviewEditor
                      seriesId={seriesId}
                      seasonNumber={s.seasonNumber}
                      canPublish={canPublish}
                    />
                    {rating === undefined && suggestion !== undefined ? (
                      <button
                        type="button"
                        onClick={() => setSeasonRating(key, s.seasonNumber, suggestion)}
                        className="quiet-action"
                      >
                        {t('progress.suggest', { v: n(suggestion, 1) })}
                      </button>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {/* Niveau 3 : la decision, qui est la donnee propre du produit. */}
      {position !== undefined ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-(--color-edge) pt-3">
          {(
            [
              ['continuing', 'decision.continuing'],
              ['paused', 'decision.paused'],
              ['abandoned', 'decision.abandoned'],
              ['completed', 'decision.completed'],
            ] as const
          ).map(([kind, label]) => {
            const active = entry?.decision?.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => setDecision(key, active ? undefined : kind)}
                className="btn rounded-full px-3 py-1 text-xs"
              >
                {t(label)}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* La critique de la serie entiere. Sous tout le reste, et c'est voulu : ecrire coute
          plus que n'importe quel geste au-dessus, et personne ne doit tomber dessus avant
          d'avoir eu la version a un tap. */}
      <ReviewEditor seriesId={seriesId} canPublish={canPublish} />
    </section>
  );
}

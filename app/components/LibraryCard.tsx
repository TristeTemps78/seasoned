'use client';

import Link from 'next/link';
import { Poster } from '@/app/components/Poster';
import { statusLabel } from '@/lib/format';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { pathIn, seriesPath } from '@/lib/routes';
import { parseJournalKey } from '@/src/domain/journal';
import { nextAfter } from '@/src/domain/remaining';
import type { LibraryItem } from '@/src/domain/library';
import { Icon } from '@/app/components/Icon';

/**
 * Une vignette de la bibliotheque.
 *
 * Volontairement proche de `SeriesCard` sans la reutiliser : celle-ci ne connait pas
 * de `SeriesSummary`, elle ne dispose que de ce que le journal a memorise. C'est
 * precisement ce qui permet a la bibliotheque de s'afficher **sans un seul appel** —
 * la condition pour qu'elle tienne a cent mille utilisateurs.
 *
 * Une serie dont l'instantane a expire garde sa place : on affiche son identifiant
 * plutot que de la faire disparaitre. Perdre une vignette est un defaut d'affichage ;
 * perdre une serie suivie serait une perte de donnee.
 *
 * ## 🔴 On ne pouvait rien faire depuis la bibliotheque, seulement y naviguer
 *
 * Mesure au navigateur le 2026-08-16, `/fr/moi` en 1280 px : **zero bouton** dans toute la
 * grille. Chez Letterboxd, chaque affiche porte ses gestes ; ici la collection entiere etait
 * une table des matieres — la seule chose qu'on puisse en faire est d'ouvrir une fiche.
 *
 * Le meme bouton que la bande de l'accueil, avec la meme fonction de domaine
 * ({@link nextAfter}) et le meme libelle nomme (« J'ai vu S3E5 ») : c'est le geste le plus
 * repete du produit, et il n'avait qu'un seul point d'entree — la premiere serie a reprendre.
 * Les quarante autres demandaient toujours trois navigations.
 *
 * ⚠️ **La vignette decide seule, et deux conditions suffisent** — c'est ce qui evite une prop
 * `showAction` que chaque rangee devrait penser a passer. Il faut une position (donc rien sur
 * « ce que je voulais voir », qui n'en a pas) et **aucune decision terminale** : proposer
 * « J'ai vu S4E1 » sur une serie rangee dans « terminees et abandonnees » contredirait la
 * section qui la contient — exactement le defaut que le repli « a voir » avait deja produit
 * ici, et qui *« fait douter de tout le reste »*.
 */
export function LibraryCard({ item, lead = false }: {
  readonly item: LibraryItem;
  /** Rendue dans la rangee de tete : l'affiche y fait ~300 px, `w342` y serait flou. */
  readonly lead?: boolean;
}) {
  const tr = useT();
  const { t, tn, locale } = tr;
  const { setPosition } = useJournal();
  const parsed = parseJournalKey(item.key);
  const href =
    parsed !== undefined ? seriesPath(parsed.providerId, locale) : pathIn('/', locale);
  const position = item.entry.position;

  // 🔴 Le statut brut d'abord, traduit dans la langue de CETTE page ; le libelle fige en
  // repli, pour les journaux ecrits avant que `status` existe. Sans cette priorite, une
  // note posee depuis une page francaise faisait dire « Entre deux saisons » a la
  // bibliotheque anglaise — constate au navigateur, pas deduit.
  const snapshotStatus =
    item.snapshot?.status !== undefined
      ? statusLabel(item.snapshot.status, tr)
      : item.snapshot?.statusLabel;

  const decision = item.entry.decision?.kind;
  const decisionLabel =
    decision === 'completed'
      ? t('decision.completed')
      : decision === 'abandoned'
        ? t('decision.abandoned')
        : decision === 'paused'
          ? t('decision.paused')
          : undefined;

  /* Le prochain episode, ou rien — voir l'en-tete de ce fichier pour les deux conditions.
     ⚠️ Les tailles de saison viennent de l'instantane que `buildLibrary` a **deja** filtre
     par age : sans elles (journal ancien, instantane pose avant que `seasonSizes` existe) on
     ne sait pas si S1E7 finit sa saison, donc aucun bouton. Un bouton qui devine se trompe. */
  const done = decision === 'completed' || decision === 'abandoned';
  const sizes = item.snapshot?.seasonSizes;
  const next = done || sizes === undefined ? undefined : nextAfter(sizes, position);

  return (
    // 🔴 **Un conteneur, et le lien a l'interieur.** La vignette entiere etait un `<a>` : y
    // poser un bouton aurait imbrique un controle dans un lien, ce que le HTML interdit et
    // que les navigateurs resolvent chacun a leur facon. Meme restructuration que la bande de
    // l'accueil, pour la meme raison.
    <div>
    <Link
      href={href}
      className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live)"
    >
      <div className="poster-frame aspect-2/3">
        {/* ⚠️ L'affiche **choisie** passe devant celle du catalogue. C'est tout l'interet
            de la feature : elle doit se voir dans la bibliotheque, pas seulement sur la
            fiche ou on l'a choisie. */}
        <Poster
          path={item.entry.poster ?? item.snapshot?.posterPath}
          title={item.snapshot?.title ?? t('library.card.tracked')}
          size={lead ? 'w500' : 'w342'}
          className="transition-opacity group-hover:opacity-85"
        />

        {/* Ce que cette affiche sait de MOI, et que la meme affiche dans le catalogue ignore.
            ⚠️ `aria-hidden` : les trois faits sont ecrits en toutes lettres sous la vignette. */}
        {item.entry.liked?.at !== undefined ? (
          <span className="poster-badge poster-badge-tr poster-badge-liked" aria-hidden="true">
            <Icon name="heart" />
          </span>
        ) : decision === 'completed' ? (
          <span className="poster-badge poster-badge-tr poster-badge-done" aria-hidden="true">
            <Icon name="check" />
          </span>
        ) : decision === 'abandoned' ? (
          // ⚠️ Une croix et non une absence : la carte des abandons est la donnee propriete du
          // produit, et une serie lachee doit se reconnaitre d'un coup d'oeil dans la grille.
          <span className="poster-badge poster-badge-tr text-(--color-muted)" aria-hidden="true">
            <Icon name="close" />
          </span>
        ) : null}

        {/* La position, en bas — une progression se lit de gauche a droite. Absente pour une
            serie qu'on n'a pas commencee : un « S0E0 » serait pire que rien. */}
        {position !== undefined ? (
          <span className="poster-progress numeric" aria-hidden="true">
            S{position.seasonNumber}E{position.episodeNumber}
          </span>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
        {item.snapshot?.title ?? t('library.card.tracked')}
      </p>

      <p className="meta-sm">
        {item.daysUntilNext !== undefined ? (
          // Le chiffre est la valeur : « dans 3 jours » repond a la question qu'on se
          // pose, la ou « en cours » ne dit rien.
          <span className="text-(--color-live)">
            {item.daysUntilNext === 0
              ? t('library.card.today')
              : item.daysUntilNext === 1
                ? t('library.card.tomorrow')
                : tn('library.card.inDays', item.daysUntilNext)}
          </span>
        ) : position !== undefined ? (
          // Une coordonnee, donc en grille : sur une colonne de vignettes, « S3E7 » et
          // « S10E12 » cessent de danser d'une ligne a l'autre.
          <span className="numeric">
            S{position.seasonNumber}E{position.episodeNumber}
          </span>
        ) : (
          // ⚠️ La decision passe **avant** le repli « a voir ». Trouve a la
          // verification : une serie rangee dans « Terminees et abandonnees » affichait
          // « a voir » des que son instantane n'avait pas de libelle de statut — ce qui
          // arrive des qu'il expire. La vignette contredisait alors la section qui la
          // contient, et c'est le genre de detail qui fait douter de tout le reste.
          decisionLabel ?? snapshotStatus ?? t('library.card.toWatch')
        )}
      </p>
    </Link>

    {/* ⚠️ **`.btn` et non `.btn-primary`.** Quarante vignettes portant chacune un aplat volt
        feraient de la bibliotheque un tableau de bord — le critere d'echec que le brief nomme.
        L'action affirmative garde son poids la ou il n'y en a qu'une par ecran.

        🔴 **Le libelle en toutes lettres ne tient pas, et c'est mesure.** La bande de
        l'accueil dit « J'ai vu S3E5 » sur toute la largeur de la page ; ici la tuile fait
        **109 px** en 375 px (trois colonnes), soit 81 px utiles. « J'ai vu S1E3 » y tient
        (71 px), « J'ai vu S10E12 » non (95 px) — donc le bouton passait a deux lignes **selon
        la saison ou l'on en est**, et la grille devenait inegale pour une raison que le
        lecteur ne peut pas deviner. En anglais, « I watched » deborde encore plus tot.

        La coche et la coordonnee, elles, font la **meme largeur dans les deux langues** : le
        pictogramme porte le geste, `S10E12` porte l'episode, et le tout tient a 78 px. C'est
        deja l'idiome de la tuile — la position juste au-dessus est ecrite pareil, en
        `.numeric`, precisement pour que « S3E7 » et « S10E12 » cessent de danser.

        ⚠️ **La phrase entiere reste le nom accessible** (`aria-label`), et c'est celle de la
        bande au mot pres : ce qui se raccourcit est le dessin, jamais ce que le bouton
        annonce a qui ne voit pas la tuile. Meme patron que l'icone de recherche de
        l'en-tete. */}
    {next !== undefined ? (
      <button
        type="button"
        className="btn mt-2 w-full justify-center"
        aria-label={t('resume.watched', { s: next.seasonNumber, e: next.episodeNumber })}
        onClick={() => setPosition(item.key, next.seasonNumber, next.episodeNumber)}
      >
        <Icon name="check" />
        <span className="numeric" aria-hidden="true">
          S{next.seasonNumber}E{next.episodeNumber}
        </span>
      </button>
    ) : null}
    </div>
  );
}

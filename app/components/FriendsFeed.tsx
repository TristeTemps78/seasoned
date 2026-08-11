'use client';

import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { parseJournalKey, type Journal } from '@/src/domain/journal';
import type { FeedEntry } from '@/src/domain/feed';
import type { FeedItem, PublishedReview } from '@/src/social/client';
import type { Redacted } from '@/src/domain/spoiler';
import { Avatar } from '@/app/components/Avatar';
import { EmptyState } from '@/app/components/EmptyState';
import { PosterChip } from '@/app/components/PosterChip';
import { ReportButton } from '@/app/components/ReportButton';
import { ReviewBody } from '@/app/components/ReviewBody';
import { pathIn } from '@/lib/routes';

/**
 * Le fil — les faits et les critiques des gens qu'on suit, dans l'ordre.
 *
 * ## Pourquoi il sort de `Friends.tsx`
 *
 * `Friends.tsx` faisait **557 lignes** et portait cinq sujets sans rapport : reclamer un nom,
 * suivre quelqu'un, chercher un profil, la manche du jour, et ce fil. Le plus gros fichier du
 * depot, et le seul ou l'on ne pouvait pas changer une chose sans relire les quatre autres.
 *
 * ⚠️ **Extraction pure** : aucune logique deplacee, aucun comportement change. Le caviardage,
 * la fusion et la lecture restent chez le parent — ce composant ne fait que **rendre** ce
 * qu'on lui donne. C'est la seule facon de segmenter sans risquer de deplacer un defaut.
 *
 * ⚠️ Le signalement passe par une **prop** et non par le client social : sans ca il faudrait
 * transmettre `client` et `userId` pour une seule ligne, c'est-a-dire donner a un composant de
 * rendu de quoi ecrire dans la base.
 */
export function FriendsFeed({
  timeline,
  unreadable,
  journal,
  onReport,
}: {
  /* ⚠️ `FeedEntry` est **generique** sur le fait et la critique : on l'instancie avec les
     types du client social plutot que d'inventer un alias. Un alias local aurait diverge le
     jour ou l'un des deux gagne un champ — exactement ce que la generique existe pour eviter.

     ⚠️ La critique est **caviardee** (`Redacted`), jamais brute : le parent masque ce que le
     lecteur n'a pas atteint AVANT de passer le fil. Prendre `PublishedReview` ici compilerait
     et laisserait ce composant capable d'afficher un texte non caviarde — le typage est ce qui
     rend cette erreur impossible plutot qu'improbable. */
  readonly timeline: readonly FeedEntry<FeedItem, Redacted<PublishedReview>>[];
  /** Vrai quand la lecture a **echoue** — a distinguer d'un fil vide. Voir le corps. */
  readonly unreadable: boolean;
  /** Sert au repli de titre pour les series que le lecteur a deja. */
  readonly journal: Journal;
  readonly onReport: (authorId: string, ground: string) => Promise<boolean>;
}) {
  const { t, locale } = useT();

  return (
    <section className="space-y-3">
      <h2 className="section-heading">{t('friends.feed.title')}</h2>
      {timeline.length === 0 ? (
        // ⚠️ Mieux vaut se taire que compter zero : un fil vide dit quoi faire, il
        // n'affiche pas « 0 activite ». Mais il ne doit pas dire « rien a lire » quand
        // la verite est « je n'ai pas pu lire » — c'est le defaut de 10.0, et la seule
        // facon de ne pas le refaire est que l'ecran connaisse la difference.
        // ⚠️ **Sans actions, contrairement aux quatre autres ecrans vides.** La regle posee le
        // 2026-08-11 est qu'un ecran vide porte une action ; elle ne dit pas qu'il porte un
        // *lien*. Les deux gestes que la phrase nomme — suivre quelqu'un, donner son nom —
        // sont le formulaire et `Discover`, a deux cents pixels au-dessus, sur cette meme
        // page. Un bouton qui menerait ailleurs ferait sortir de l'ecran ou l'action se
        // trouve. C'est pourquoi `EmptyState` rend `actions` **optionnel** : ce qu'on corrige
        // est un ecran sans issue, pas un ecran sans bouton.
        <EmptyState status={unreadable}>
          {t(unreadable ? 'friends.feed.unreadable' : 'friends.feed.empty')}
        </EmptyState>
      ) : (
        <ul>
          {timeline.map((entry, index) => {
            if (entry.of === 'review') {
              const review = entry.review;
              const parsed = parseJournalKey(review.subject);
              // Le titre vient de **mon** instantane local, jamais d'un appel catalogue :
              // une requete par ligne de fil est le cout par utilisateur que ce produit
              // refuse. Sans instantane on montre la cle — le lien, lui, marche toujours.
              // ⚠️ L'instantane publie **d'abord**, le journal du lecteur ensuite. L'ordre
              // inverse laissait « tmdb:94997 » a l'ecran pour toute serie que le lecteur
              // n'avait pas deja — c'est-a-dire dans le seul cas ou un fil sert a decouvrir.
              const title = review.title ?? journal.entries[review.subject]?.snapshot?.title;
              const poster =
                review.posterPath ?? journal.entries[review.subject]?.snapshot?.posterPath;

              return (
                <li
                  key={`review-${review.authorId}-${review.subject}-${review.target}-${index}`}
                  className="feed-row space-y-2 text-sm"
                >
                  {/* ⚠️ `flex-wrap` et non une colonne : la ligne porte le pseudo, le verbe et
                      le titre de la serie, qui doivent rester **une phrase**. Une colonne les
                      empilerait en trois fragments qui ne se lisent plus ensemble. Les `{' '}`
                      qui suivent deviennent des elements de flex vides — la specification dit
                      qu'un element anonyme fait de blanc seul n'est pas rendu, donc ils ne
                      creusent aucun trou. */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {poster === undefined ? null : (
                      <PosterChip path={poster} title={title ?? review.subject} />
                    )}
                    <Avatar handle={review.handle} face={review.face} />
                    <Link
                      href={pathIn(`/u/${review.handle}`, locale)}
                      className="font-medium hover:text-(--color-volt)"
                    >
                      @{review.handle}
                    </Link>{' '}
                    {t('friends.item.reviewed')}{' '}
                    {parsed === undefined ? (
                      <span className="font-medium">{title ?? review.subject}</span>
                    ) : (
                      <Link
                        href={pathIn(`/serie/${parsed.providerId}`, locale)}
                        className="font-medium hover:text-(--color-volt)"
                      >
                        {title ?? review.subject}
                      </Link>
                    )}
                    <ReportButton
                      onReport={(ground) => onReport(review.authorId, ground)}
                    />
                  </div>
                  <ReviewBody
                    hidden={review.hidden === true}
                    text={review.text}
                    hiddenText={review.hiddenText ?? ''}
                    throughSeason={review.throughSeason}
                  />
                </li>
              );
            }

            const item = entry.fact;
            // 🔴 Le bloc « fait » ne nommait **pas du tout** la serie : la ligne disait
            // « @x a note la saison 1 — 4,5 ★ » sans jamais dire de quelle serie. Pire que
            // la cle brute des critiques, et invisible au HTML — il faut le lire a l'ecran.
            const factTitle = item.title ?? journal.entries[item.subject]?.snapshot?.title;
            const factPoster =
              item.posterPath ?? journal.entries[item.subject]?.snapshot?.posterPath;
            const factParsed = parseJournalKey(item.subject);
            return (
              <li
                key={`${item.handle}-${item.subject}-${item.kind}-${item.happenedOn}-${index}`}
                className="feed-row flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                {factPoster === undefined ? null : (
                  <PosterChip path={factPoster} title={factTitle ?? item.subject} />
                )}
                <Avatar handle={item.handle} face={item.face} />{' '}
                <Link
                  href={pathIn(`/u/${item.handle}`, locale)}
                  className="font-medium hover:text-(--color-volt)"
                >
                  @{item.handle}
                </Link>{' '}
                {t(`friends.item.${item.kind}`)}{' '}
                {/* ⚠️ Le titre n'est rendu que s'il est **connu** : ecrire la cle a la place
                    serait revenir au defaut qu'on corrige. Sans titre, la phrase reste
                    « @x a termine » — incomplete, mais jamais absurde. */}
                {factTitle === undefined ? null : factParsed === undefined ? (
                  <span className="font-medium">{factTitle}</span>
                ) : (
                  <Link
                    href={pathIn(`/serie/${factParsed.providerId}`, locale)}
                    className="font-medium hover:text-(--color-volt)"
                  >
                    {factTitle}
                  </Link>
                )}{' '}
                {item.season !== undefined && item.stars !== undefined
                  ? t('friends.item.season', {
                      season: String(item.season),
                      stars: item.stars.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB'),
                    })
                  : null}
                {/* ⚠️ Sur chaque ligne, et non dans un menu de profil : on signale ce qu'on
                    vient de lire, au moment ou on le lit. Une voie de signalement qui
                    demande de retrouver la personne ailleurs n'en est pas une — c'est le
                    meme raisonnement qui a mis `/regles` en pied de page de tout le site. */}
                <ReportButton
                  onReport={(ground) => onReport(item.authorId, ground)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

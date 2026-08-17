'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { useAuth } from '@/app/auth/AuthProvider';
import { EmptyState } from '@/app/components/EmptyState';
import { ReportButton } from '@/app/components/ReportButton';
import { FaceDot } from '@/app/components/FaceDot';
import { Menu } from '@/app/components/Menu';
import { journalKey } from '@/src/domain/journal';
import { redactReviews } from '@/src/domain/spoiler';
import {
  ALL_REVIEW_AUDIENCES,
  CONTROLS_FROM,
  orderReviews,
  type ReviewAudience,
  type ReviewSort,
} from '@/src/domain/review-order';
import { ReviewHeart } from '@/app/components/ReviewHeart';
import { ReviewSortMenu } from '@/app/components/ReviewSortMenu';
import { ReviewComments } from '@/app/components/ReviewComments';
import { type PublishedReview, type ReviewComment, type ReviewLikes } from '@/src/social/client';
import { formatDate } from '@/lib/format';
import type { MessageKey } from '@/lib/i18n/engine';
import { pathIn } from '@/lib/routes';
import { useSocial } from '@/app/social/useSocial';

const AUDIENCE_LABEL = {
  everyone: 'review.audienceEveryone',
  following: 'review.audienceFollowing',
  mine: 'review.audienceMine',
} as const satisfies Record<ReviewAudience, MessageKey>;

/**
 * Ce que les autres ont ecrit — caviarde par la position du lecteur.
 *
 * ## Le caviardage se fait ICI, dans le navigateur
 *
 * Le serveur envoie les critiques sans savoir ou en est celui qui les lit, et c'est
 * exactement ce qui empeche sa position de fuir : il n'a rien a demander. Le filtre est
 * `redactReviews`, dans le domaine ( — jamais dans la couche de rendu).
 *
 * ⚠️ Le texte masque n'est **pas** rendu puis cache en CSS : il ne descend pas dans le DOM.
 * Un `display:none` se lit dans l'inspecteur, se copie, et se retrouve dans le presse-papier
 * d'un « tout selectionner ».
 *
 * ## Chargement paresseux, et zero route serveur
 *
 * La page reste `force-static` et mise en cache au bord. La lecture part du navigateur au
 * moment ou l'on descend jusqu'ici — donc elle ne coute rien a ceux qui ne descendent pas,
 * et rien du tout a Vercel.
 */
export function Reviews({ seriesId }: { readonly seriesId: string }) {
  const { account } = useAuth();
  const { journal, ready, withholdReview } = useJournal();
  const { t, tn, locale } = useT();
  const [reviews, setReviews] = useState<readonly PublishedReview[] | undefined>(undefined);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [likes, setLikes] = useState<Readonly<Record<string, ReviewLikes>>>({});
  /**
   * Les reponses de TOUTE la fiche, en un appel — voir `commentsOn`.
   *
   * ⚠️ Un appel par critique serait dix appels sur une fiche qui en porte dix, et c'est
   * exactement ce que `015` interdit pour les coeurs. Le regroupement se fait au rendu.
   */
  const [comments, setComments] = useState<readonly ReviewComment[]>([]);
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [audience, setAudience] = useState<ReviewAudience>('everyone');
  /**
   * Le retrait, en deux temps — **F10**.
   *
   * `undefined` : rien n'est en cours. Une cle `auteur:cible` : cette critique attend sa
   * confirmation. Un `window.confirm` aurait tenu en une ligne et il est le seul dialogue que
   * ce produit s'interdit partout ailleurs — il bloque la page, il ne se traduit pas, et son
   * libelle ne peut pas dire *ce qui tombe avec le texte*.
   */
  const [removing, setRemoving] = useState<string | undefined>(undefined);
  /** Le retrait qui n'est pas parti. Une ecriture ratee n'a aucun ecran par elle-meme. */
  const [removeFailed, setRemoveFailed] = useState(false);
  /** Le retrait qui est parti — dit une fois, la ou le texte etait. */
  const [removedNote, setRemovedNote] = useState(false);
  /** Les identifiants des gens qu'on suit. Vide tant qu'on ne les a pas — jamais devine. */
  const [followed, setFollowed] = useState<ReadonlySet<string> | undefined>(undefined);

  const key = journalKey(seriesId);
  const social = useSocial();
  const userId = account?.userId;

  useEffect(() => {
    // ⚠️ Aucun compte n'est requis pour LIRE : c'est RLS qui decide, et un profil `public`
    // est lisible par un visiteur anonyme. Exiger une session ici fermerait les critiques a
    // l'audience qui vient du moteur de recherche — celle pour qui elles sont ecrites.

    if (social === undefined) return;

    let alive = true;
    void social.reviewsFor(key).then((rows) => {
      if (alive) setReviews(rows);
    });
    // Les coeurs en parallele : un seul appel pour toute la page, et il ne doit pas
    // retarder l'affichage des textes.
    void social.reviewLikes(key).then((rows) => {
      if (!alive) return;
      setLikes(Object.fromEntries(rows.map((one) => [`${one.authorId}:${one.target}`, one])));
    });
    // Les reponses aussi, et pour la meme raison : un appel pour la fiche entiere.
    void social.commentsOn(key).then((rows) => {
      if (alive) setComments(rows);
    });
    return () => {
      alive = false;
    };
  }, [social, key]);

  /**
   * Qui je suis — **lu seulement le jour ou l'on s'en sert**.
   *
   * ⚠️ Un appel de plus au chargement de chaque fiche serie serait un cout par visiteur pour
   * un filtre que presque personne n'ouvre : c'est le meme raisonnement qui met les critiques
   * elles-memes en chargement paresseux, et celui qui a fait choisir une jointure PostgREST
   * plutot qu'une requete par ami. On paie quand on demande.
   *
   * ⚠️ Une seule fois : `followed !== undefined` coupe l'effet, donc revenir sur « les gens
   * que je suis » apres etre passe par « tout le monde » ne relit rien.
   */
  useEffect(() => {
    if (audience !== 'following' || followed !== undefined || userId === undefined) return;

    if (social === undefined) return;

    let alive = true;
    void social.following(userId).then((rows) => {
      if (alive) setFollowed(new Set(rows.map((profile) => profile.userId)));
    });
    return () => {
      alive = false;
    };
  }, [audience, followed, userId, social]);

  // Rien tant qu'on ne sait pas : annoncer « personne n'a rien ecrit » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  // ⚠️ `reviews === undefined` couvre aussi l'installation sans base : `socialFrom` rend
  // `undefined`, l'etat ne bouge jamais, et la section reste absente — ce qui est juste.
  if (!ready || reviews === undefined) return null;

  // 🔴 **A zero, c'etait `return null` — et la phrase existait deja.** `review.none`
  // (« Personne n'a encore ecrit sur cette serie. ») etait ecrite dans les deux dictionnaires
  // et **appelee nulle part** : une chaine traduite deux fois pour un ecran qui refusait de
  // l'afficher. Le symptome exact de la doctrine qu'on demonte.
  //
  // Le cout etait le plus eleve du produit : sur une fiche serie sans critique — c'est-a-dire
  // presque toutes aujourd'hui —, la colonne de droite commencait par du **vide**, donc rien
  // n'indiquait nulle part que ce produit sache ecrire. Or ecrire est la moitie de la cible
  // (*« un mix Letterboxd × Serializd × TV Time »*), et c'est la seule chose ici qui ne
  // demande **aucun compte** : la critique se pose dans le journal, sur cette page, hors ligne.
  if (reviews.length === 0) {
    return (
      <section className="space-y-3" aria-label={t('review.title')}>
        <h2 className="section-heading">{t('review.title')}</h2>
        {/* ⚠️ La phrase du retrait doit vivre **ici aussi** : retirer sa seule critique vide
            la liste, donc l'ecran bascule sur ce retour anticipe. Ne la poser que dans la
            branche pleine la ferait disparaitre exactement quand elle est la plus utile. */}
        {removedNote ? <p className="meta">{t('review.removeKept')}</p> : null}
        {/* ⚠️ Sans `title` : la section qui l'entoure porte deja le sien, et un second niveau
            de titre y decrirait une hierarchie qui n'existe pas. Sans actions non plus — le
            champ d'ecriture est sur cette page, dans « Ou j'en suis », et la phrase l'y
            envoie par son nom plutot que par un lien qui ferait sortir de l'ecran. */}
        <EmptyState>
          {t('review.none')} {t('review.beFirst')}
        </EmptyState>
      </section>
    );
  }

  const position = journal.entries[key]?.position;
  const visible = redactReviews(
    reviews,
    position === undefined
      ? undefined
      : {
          at: { seriesId, seasonNumber: position.seasonNumber, episodeNumber: position.episodeNumber },
          declaredAt: new Date(position.declaredAt),
        },
  );

  const listed = orderReviews(
    visible,
    { sort, audience },
    {
      ...(userId !== undefined ? { me: userId } : {}),
      ...(followed !== undefined ? { followed } : {}),
      hearts: (review) => likes[`${review.authorId}:${review.target}`]?.likes ?? 0,
    },
  );

  // ⚠️ Le seuil se compte sur **tout ce qui est charge**, jamais sur la liste filtree : sinon
  // les commandes disparaitraient des qu'un filtre rend moins de cinq lignes, et il n'y aurait
  // plus de quoi revenir — un cul-de-sac fabrique par son propre filtre, exactement celui que
  // `f6e58e8` vient de retirer de la recherche.
  const withControls = reviews.length >= CONTROLS_FROM;

  // Attendre de savoir qui l'on suit avant de conclure que personne n'a ecrit. Meme regle
  // qu'au chargement des critiques plus haut : annoncer un vide avant d'avoir lu est un
  // mensonge, et c'est le seul silence que la regle 4 autorise — celui de ce qu'on ignore.
  const waiting = audience === 'following' && followed === undefined;

  return (
    <section className="space-y-3" aria-label={t('review.title')}>
      <h2 className="section-heading">{t('review.title')}</h2>

      {removedNote ? <p className="meta">{t('review.removeKept')}</p> : null}

      {withControls ? (
        // ⚠️ **Des menus dans une colonne qui porte deja onze blocs.** Cinq boutons sur deux
        // rangees faisaient 96 px de haut ; deux menus en font 44, sur une seule ligne. Ici
        // la place ne se dispute pas avec un catalogue mais avec « Ou j'en suis », la
        // trajectoire et les saisons — tout ce que quelqu'un est venu lire.
        <div className="flex flex-wrap items-center gap-2">
          <ReviewSortMenu id="reviews-sort" value={sort} onChange={setSort} />
          {/* ⚠️ Sans compte, « les gens que je suis » et « les miennes » ne peuvent rien
              rendre : le menu entier ne s'affiche pas, plutot que de proposer deux options
              qui ne marchent pas (regle du 2026-08-09). Le tri, lui, marche pour tout le
              monde — c'est pourquoi ce sont deux menus et non un seul. */}
          {account !== undefined ? (
            <Menu
              id="reviews-audience"
              label={t('review.audience')}
              value={audience}
              onChange={(value) => setAudience(value as ReviewAudience)}
              options={ALL_REVIEW_AUDIENCES.map((one) => ({
                value: one,
                label: t(AUDIENCE_LABEL[one]),
              }))}
            />
          ) : null}
        </div>
      ) : null}

      {/* ⚠️ Le compte n'apparait qu'avec les commandes, et c'est pour lui aussi que le seuil
          existe : au-dessus de trois textes qu'on voit tous, « 3 critiques » n'apprend rien.
          Des qu'un filtre est actif, il est la seule chose qui dise **ce que le filtre a
          fait** — sans lui la liste raccourcit sans explication, et on croit avoir perdu des
          critiques. */}
      {withControls && !waiting && listed.length > 0 ? (
        <p className="meta">{tn('review.count', listed.length)}</p>
      ) : null}

      {waiting ? null : listed.length === 0 ? (
        /* Le vide **du filtre**, jamais celui de la serie : elle a des critiques, on vient
           d'en demander une part qui n'existe pas. Le geste qui en sort est la rangee
           juste au-dessus — mais il faut deux clics pour le trouver, donc on le pose. */
        <EmptyState
          actions={
            <button
              type="button"
              onClick={() => setAudience('everyone')}
              className="btn rounded-full"
            >
              {t('review.showEveryone')}
            </button>
          }
        >
          {t(audience === 'mine' ? 'review.noneMine' : 'review.noneFollowing')}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {listed.map((review) => {
            const id = `${review.authorId}:${review.target}`;
            const shown = revealed.has(id);
            return (
              <li key={id} className="card space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* 🔴 C'etait un `<span>` : on lisait quelqu'un sans pouvoir ouvrir son
                      profil. La fiche serie est pourtant le premier endroit ou l'on croise
                      un inconnu dont l'avis nous interesse — c'est LA porte de decouverte,
                      et elle etait fermee. */}
                  <span className="flex items-center gap-1.5">
                    {/* La face de l'auteur (9.4) : sur une fiche serie, savoir que l'avis vient
                        de quelqu'un qui coupe tot ou de quelqu'un qui va au bout **change la
                        lecture de l'avis**. C'est le seul endroit ou la pastille informe le
                        contenu au lieu de decorer un nom. */}
                    <FaceDot face={review.face} />
                    <Link
                      href={pathIn(`/u/${review.handle}`, locale)}
                      className="tap-line text-sm font-medium hover:text-(--color-volt)"
                    >
                      @{review.handle}
                    </Link>
                    {/* 🔴 `publishedAt` etait dans le type depuis `006_reviews.sql`, lu par
                        `#reviews`, trie par la base — et **jamais affiche**. Une critique sans
                        date ne se situe pas : on ne sait pas si l'avis porte sur la saison
                        diffusee la semaine derniere ou sur celle d'il y a six ans, ce qui est
                        la premiere chose qu'on veut savoir d'un avis sur une serie en cours.
                        C'est aussi la colonne que le tri « les plus recentes » manipule : la
                        commande existait au-dessus d'un critere invisible. */}
                    <time dateTime={review.publishedAt} className="meta-sm">
                      {formatDate(new Date(review.publishedAt), locale)}
                    </time>
                  </span>
                  {/* Signaler exige un compte : c'est l'auteur du signalement que la base
                      enregistre, et un signalement anonyme n'est pas examinable. */}
                  {account !== undefined ? (
                    <ReportButton
                      onReport={async (ground) => {
                        if (social === undefined) return false;
                        return social.report(account.userId, review.authorId, ground);
                      }}
                    />
                  ) : null}
                </div>

                {review.hidden === true && !shown ? (
                  <div className="space-y-2">
                    {/* Le fait reste, le contenu non. Retirer la ligne entiere ferait un fil a
                        trous, qui est lui-meme un indice — savoir qu'il EXISTE une critique de
                        la saison 6 n'en revele pas le contenu. */}
                    <p className="meta">
                      {review.target === 'series'
                        ? t('review.hiddenSeries')
                        : t('review.hidden', { n: review.throughSeason })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setRevealed((current) => new Set(current).add(id))}
                      className="btn rounded-full"
                    >
                      {t('review.reveal')}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-line">
                    {shown ? (review.hiddenText ?? review.text) : review.text}
                  </p>
                )}

                {/* ⚠️ Le coeur est **sous** le texte, jamais a cote du nom : on aime ce qu'on
                    vient de lire. Place en tete, il inviterait a aimer sans lire.

                    ⚠️ Il exige un compte, et ne s'affiche pas sans — un bouton qui ne peut
                    pas marcher ne se degrade pas, il ne s'affiche pas (regle du 2026-08-09).
                    On ne peut pas non plus aimer sa propre critique : ce serait un compteur
                    qu'on s'incremente soi-meme. */}
                {/* 🔴 **F10 — retirer sa propre critique.** `006_reviews.sql` porte
                    `reviews_delete` depuis le premier jour : la base autorisait, **rien
                    n'appelait**. Une critique publiee etait donc definitive du point de vue
                    de la personne qui l'avait ecrite, alors que « Retirer ma reponse » existe
                    depuis `024` pour un message de 600 caracteres.

                    ⚠️ **En deux temps, et le second libelle dit ce qui tombe avec le texte** :
                    `015` et `024` accrochent les coeurs et les reponses a la cle naturelle de
                    la critique, donc la cascade les emporte. L'apprendre apres coup serait une
                    perte que personne n'a acceptee.

                    ⚠️ **Deux ecritures, et le journal en fait partie** : sans le drapeau,
                    `Friends.refresh()` republierait la critique a la prochaine ouverture de
                    `/amis`. Le texte, lui, reste — voir `/regles`. */}
                {account !== undefined && account.userId === review.authorId ? (
                  <div className="space-y-1">
                    {removing === id ? (
                      <p className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="quiet-action text-(--color-warn)"
                          onClick={async () => {
                            if (social === undefined) return;
                            const ok = await social.unpublishReview(
                              account.userId,
                              key,
                              review.target,
                            );
                            setRemoveFailed(!ok);
                            if (!ok) return;
                            withholdReview(key, review.target);
                            setRemoving(undefined);
                            // Ce qui vient de se passer se dit **la ou la ligne etait** : le
                            // texte a disparu de l'ecran, et sans un mot on ne peut pas
                            // savoir s'il est parti d'ici ou de partout. La phrase repete la
                            // seule chose qui compte — le journal l'a toujours.
                            setRemovedNote(true);
                            // On retire de l'ecran plutot que de relire : la ligne vient de
                            // partir, et une lecture de plus dirait la meme chose en un appel.
                            setReviews((current) =>
                              current?.filter(
                                (one) =>
                                  one.authorId !== review.authorId ||
                                  one.target !== review.target,
                              ),
                            );
                            setComments((current) =>
                              current.filter(
                                (one) =>
                                  one.reviewAuthorId !== review.authorId ||
                                  one.target !== review.target,
                              ),
                            );
                          }}
                        >
                          {t('review.removeConfirm')}
                        </button>
                        <button
                          type="button"
                          className="quiet-action"
                          onClick={() => setRemoving(undefined)}
                        >
                          {t('review.removeCancel')}
                        </button>
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="quiet-action"
                        onClick={() => {
                          setRemoveFailed(false);
                          setRemoving(id);
                        }}
                      >
                        {t('review.remove')}
                      </button>
                    )}
                    {/* Une ecriture ratee n'a **aucun** ecran par elle-meme : le geste a
                        l'air d'avoir marche. C'est la distinction que `onFailure` documente. */}
                    {removeFailed && removing === id ? (
                      <p className="text-sm text-(--color-warn)">{t('review.removeFailed')}</p>
                    ) : null}
                  </div>
                ) : null}

                {account !== undefined && account.userId !== review.authorId ? (
                  <ReviewHeart
                    count={likes[id]?.likes ?? 0}
                    mine={likes[id]?.mine ?? false}
                    onToggle={async (next) => {
                      if (social === undefined) return false;
                      const ok = await social.likeReview(
                        account.userId,
                        review.authorId,
                        key,
                        review.target,
                        next,
                      );
                      if (ok) {
                        setLikes((current) => ({
                          ...current,
                          [id]: {
                            authorId: review.authorId,
                            target: review.target,
                            // On ajuste **localement** plutot que de relire : une lecture de
                            // plus par clic couterait un appel pour un chiffre qu'on connait.
                            likes: (current[id]?.likes ?? 0) + (next ? 1 : -1),
                            mine: next,
                          },
                        }));
                      }
                      return ok;
                    }}
                  />
                ) : null}

                {/* 🔴 **F5 — repondre a une critique.** Rien nulle part jusqu'au 2026-08-17.
                    Voir `024_review_comments.sql` pour ce qui a ete refuse avec : aucun
                    pouvoir de masquage cote client, et l'auteur de la critique ne peut PAS
                    effacer les reponses des autres.

                    ⚠️ **Le fil suit l'etat du texte.** Une reponse parle de ce qu'elle
                    commente : l'afficher sous une critique caviardee revelerait par la bande
                    ce que le caviardage protege — « il se passe quelque chose a la saison 6 »
                    suffit a gacher. Masque avec elle, revele avec elle. */}
                {review.hidden === true && !shown ? null : (
                  <ReviewComments
                    review={{
                      authorId: review.authorId,
                      subject: key,
                      target: review.target,
                    }}
                    comments={comments.filter(
                      (one) =>
                        one.reviewAuthorId === review.authorId && one.target === review.target,
                    )}
                    onSend={async (body) => {
                      if (social === undefined || account === undefined) return false;
                      const ok = await social.comment(
                        account.userId,
                        { authorId: review.authorId, subject: key, target: review.target },
                        body,
                        locale,
                      );
                      // On relit plutot que d'ajouter localement : la ligne posee porte un
                      // identifiant et une date que seule la base connait, et les inventer
                      // ferait diverger l'ecran de ce qui est ecrit.
                      if (ok) setComments(await social.commentsOn(key));
                      return ok;
                    }}
                    onRemove={async (id) => {
                      if (social === undefined) return false;
                      const ok = await social.removeComment(id);
                      if (ok) setComments((current) => current.filter((one) => one.id !== id));
                      return ok;
                    }}
                    onReport={async (authorId, ground) => {
                      if (social === undefined || account === undefined) return false;
                      return social.report(account.userId, authorId, ground);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

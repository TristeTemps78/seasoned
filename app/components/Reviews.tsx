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
  ALL_REVIEW_SORTS,
  orderReviews,
  type ReviewAudience,
  type ReviewSort,
} from '@/src/domain/review-order';
import { type PublishedReview, type ReviewLikes } from '@/src/social/client';
import { formatDate } from '@/lib/format';
import type { MessageKey } from '@/lib/i18n/engine';
import { pathIn } from '@/lib/routes';
import { socialFrom } from '@/app/social/socialFrom';

/**
 * A partir de combien de critiques les commandes apparaissent.
 *
 * ⚠️ **Ce n'est pas une economie de pixels, c'est la regle 4 lue a l'endroit.** Elle demande
 * qu'un ecran sans issue dise quoi faire ; elle ne demande pas qu'un tri s'affiche au-dessus
 * de deux textes — `CLAUDE.md` le dit pour le compteur de coeurs a zero, et c'est le meme
 * cas. Trier trois critiques ne repond a aucune question qu'on se pose, et la colonne de la
 * fiche serie porte deja onze blocs.
 *
 * Cinq, comme le seuil de `stop_map()` : c'est deja le nombre a partir duquel ce produit
 * considere qu'une liste devient une population.
 */
const CONTROLS_FROM = 5;

const SORT_LABEL = {
  recent: 'review.sortRecent',
  liked: 'review.sortLiked',
} as const satisfies Record<ReviewSort, MessageKey>;

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
  const { journal, ready } = useJournal();
  const { t, tn, locale } = useT();
  const [reviews, setReviews] = useState<readonly PublishedReview[] | undefined>(undefined);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [likes, setLikes] = useState<Readonly<Record<string, ReviewLikes>>>({});
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [audience, setAudience] = useState<ReviewAudience>('everyone');
  /** Les identifiants des gens qu'on suit. Vide tant qu'on ne les a pas — jamais devine. */
  const [followed, setFollowed] = useState<ReadonlySet<string> | undefined>(undefined);

  const key = journalKey(seriesId);
  const accessToken = account?.accessToken;
  const userId = account?.userId;

  useEffect(() => {
    // ⚠️ Aucun compte n'est requis pour LIRE : c'est RLS qui decide, et un profil `public`
    // est lisible par un visiteur anonyme. Exiger une session ici fermerait les critiques a
    // l'audience qui vient du moteur de recherche — celle pour qui elles sont ecrites.

    const social = socialFrom(accessToken);
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
    return () => {
      alive = false;
    };
  }, [accessToken, key]);

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

    const social = socialFrom(accessToken);
    if (social === undefined) return;

    let alive = true;
    void social.following(userId).then((rows) => {
      if (alive) setFollowed(new Set(rows.map((profile) => profile.userId)));
    });
    return () => {
      alive = false;
    };
  }, [audience, followed, userId, accessToken]);

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

      {withControls ? (
        // ⚠️ **Des menus dans une colonne qui porte deja onze blocs.** Cinq boutons sur deux
        // rangees faisaient 96 px de haut ; deux menus en font 44, sur une seule ligne. Ici
        // la place ne se dispute pas avec un catalogue mais avec « Ou j'en suis », la
        // trajectoire et les saisons — tout ce que quelqu'un est venu lire.
        <div className="flex flex-wrap items-center gap-2">
          <Menu
            id="reviews-sort"
            label={t('review.sort')}
            value={sort}
            onChange={(value) => setSort(value as ReviewSort)}
            options={ALL_REVIEW_SORTS.map((one) => ({ value: one, label: t(SORT_LABEL[one]) }))}
          />
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
                      className="text-sm font-medium hover:text-(--color-volt)"
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
                        const social = socialFrom(accessToken);
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
                {account !== undefined && account.userId !== review.authorId ? (
                  <LikeButton
                    count={likes[id]?.likes ?? 0}
                    mine={likes[id]?.mine ?? false}
                    onToggle={async (next) => {
                      const social = socialFrom(accessToken);
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Le coeur d'une critique.
 *
 * ⚠️ **Le nombre ne s'affiche qu'a partir de un**, et c'est une exception assumee a la
 * regle 4 (2026-08-11). Un « 0 » colle a un coeur n'ouvre rien : il n'a ni cause a
 * expliquer, ni geste a proposer que le coeur lui-meme ne propose deja. La regle demande
 * qu'un ecran vide dise quoi faire ; elle ne demande pas qu'un compteur affiche zero.
 */
function LikeButton({
  count,
  mine,
  onToggle,
}: {
  readonly count: number;
  readonly mine: boolean;
  readonly onToggle: (next: boolean) => Promise<boolean>;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={mine}
      aria-label={t(mine ? 'review.unlike' : 'review.like')}
      onClick={() => {
        setBusy(true);
        void onToggle(!mine).finally(() => setBusy(false));
      }}
      className={`inline-flex items-center gap-1.5 text-sm ${
        mine ? 'text-(--color-volt)' : 'text-(--color-muted) hover:text-(--color-text)'
      }`}
    >
      <span aria-hidden="true">{mine ? '♥' : '♡'}</span>
      {count > 0 ? <span className="numeric">{count}</span> : null}
    </button>
  );
}

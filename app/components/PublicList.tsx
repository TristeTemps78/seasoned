'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { parseJournalKey } from '@/src/domain/journal';
import { formatDate } from '@/lib/format';
import { pathIn } from '@/lib/routes';
import { type DiscoverableList, type SeriesRef } from '@/src/social/client';
import { resolveSeriesRef } from '@/app/components/seriesRef';
import { LIST_TITLE_MAX, uniqueSlug } from '@/src/domain/lists';
import { useSocialRead } from '@/app/social/useSocial';
import { EmptyState } from '@/app/components/EmptyState';
import { FaceDot } from '@/app/components/FaceDot';
import { PageHeader } from '@/app/components/PageHeader';
import { PosterChip } from '@/app/components/PosterChip';

/**
 * Une liste, seule, a son adresse — `/u/<nom>/liste/<slug>`.
 *
 * ## 🔴 La decision qu'on renverse, et elle etait ecrite
 *
 * `DiscoverLists.tsx` documentait le choix inverse : une liste n'existe que **groupee**, sous
 * un onglet de profil. Le raisonnement tenait — une liste se lit dans le contexte de qui la
 * tient — et il interdisait le seul geste que « faire une liste pour quelqu'un » suppose :
 * **l'envoyer**. On partageait un profil en disant « c'est la troisieme ».
 *
 * C'est la meme forme que la doctrine du silence abattue le 2026-08-11 : une regle vraie sur
 * la lecture, appliquee a un cas qu'elle n'avait pas regarde — le partage.
 *
 * ## ⚠️ « Inconnue » et « invisible » se disent pareil, et c'est deliberé
 *
 * Exactement le raisonnement de `PublicProfile` : distinguer les deux ferait de cette adresse
 * un **oracle a listes** — on testerait des identifiants un par un pour savoir lesquels
 * existent chez quelqu'un dont on ne voit rien. `lists_select` porte `can_see(user_id)`, donc
 * la base rend simplement zero ligne, et une seule phrase couvre les deux cas.
 *
 * ## Le rendu vient du navigateur, pas du serveur
 *
 * Meme motif que `/u/<nom>` : deux lecteurs ne voient pas la meme liste, puisque `can_see`
 * depend de qui demande. Mettre en cache un contenu personnalise serait un defaut de
 * securite ; la coquille est prerendue, le navigateur remplit avec la session du lecteur.
 */
export function PublicList({ handle, slug }: {
  readonly handle: string;
  readonly slug: string;
}) {
  const { t, tn, locale } = useT();
  const { configured, ready } = useAuth();
  const { journal } = useJournal();

  const [list, setList] = useState<DiscoverableList | undefined>(undefined);
  const [items, setItems] = useState<readonly SeriesRef[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Les coeurs de cette liste : combien, et si j'en fais partie (N3). */
  const [likes, setLikes] = useState<{ readonly count: number; readonly mine: boolean }>({
    count: 0,
    mine: false,
  });
  /**
   * Ou en est la reprise — F5.
   *
   * `undefined` : rien fait. `'copying'` : en cours. `'done'` : la copie est chez moi, et
   * l'ecran doit le **dire** — une copie silencieuse laisse croire que le bouton n'a rien
   * fait, et on recliquerait pour en fabriquer une deuxieme.
   */
  const [copy, setCopy] = useState<'copying' | 'done' | 'failed' | undefined>(undefined);
  /** Le slug de la copie, pour pouvoir l'ouvrir tout de suite. */
  const [copied, setCopied] = useState<string | undefined>(undefined);

  const { account } = useAuth();
  /**
   * 🔴 Meme defaut que sur un profil, mesure le meme jour : « Cette liste ne s'ouvre pas »
   * etait aussi l'ecran d'une panne reseau. La phrase est deliberement ambigue entre
   * « elle n'existe pas » et « on ne vous la montre pas » — pour ne pas devenir un oracle a
   * listes —, et une panne s'etait glissee dans la meme phrase.
   */
  const { social, unreadable, reset } = useSocialRead();
  const myId = account?.userId;

  const load = useCallback(async () => {
    // ⚠️ Construit meme sans compte : une liste d'un profil `public` se lit par un visiteur
    // anonyme, et c'est RLS qui tranche. Exiger une session fermerait la page a exactement
    // les gens qu'un lien de partage amene — c'est-a-dire a son seul public.
    if (social === undefined) {
      setLoaded(true);
      return;
    }
    reset();
    const found = await social.listBy(handle, slug);
    setList(found);
    setLoaded(true);
    if (found === undefined) return;
    // Les deux ensemble : le contenu et les coeurs s'affichent au meme endroit, et les
    // enchainer ferait apparaitre le compte apres la liste qu'il decrit.
    const [content, hearts] = await Promise.all([
      social.listItems(found.authorId, slug),
      social.listLikes(found.authorId),
    ]);
    setItems(content);
    const mine = hearts.find((one) => one.slug === slug);
    if (mine !== undefined) setLikes({ count: mine.likes, mine: mine.mine });
  }, [handle, slug, social, reset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!configured) return <p className="prose-note">{t('account.unavailable.body')}</p>;
  // Le silence tant qu'on ne sait pas : annoncer « cette liste n'existe pas » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  if (!ready || !loaded) return <div className="h-64" aria-hidden="true" />;

  if (list === undefined && unreadable) {
    return (
      <EmptyState
        status
        title={t('list.unreadable.title')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            {t('friends.unreadable.retry')}
          </button>
        }
      >
        {t('list.unreadable.body')}
      </EmptyState>
    );
  }

  if (list === undefined) {
    return (
      <EmptyState
        title={t('list.unknown.title')}
        actions={
          /* ⚠️ Vers `/listes` et non vers le profil : on ne sait pas si ce nom existe, et
             proposer « voir son profil » affirmerait qu'il existe — ce serait redonner par la
             porte de sortie l'oracle que la phrase vient de refuser. */
          <Link className="btn btn-primary" href={pathIn('/listes', locale)}>
            {t('list.unknown.browse')}
          </Link>
        }
      >
        {t('list.unknown.body')}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      {/* ⚠️ `PageHeader` et pas un en-tete a la main — la garde `layout-collisions` m'a repris
          des le premier `npm run check`, et elle a raison : six faces avaient diverge sur les
          trois seules choses qu'un en-tete decide. La note de la liste **est** l'accroche ; le
          reste (auteur, compte, date) descend en enfant. */}
      <PageHeader title={list.title} {...(list.note !== undefined ? { lede: list.note } : {})}>
        {/* Le nom de l'auteur est un LIEN, et c'est la moitie de l'interet d'une liste seule :
            on arrive par un partage, on repart chez la personne. */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 meta">
          <span className="flex items-center gap-1.5">
            <FaceDot face={list.face} />
            <Link
              className="tap-line font-medium hover:text-(--color-volt)"
              href={pathIn(`/u/${list.handle}`, locale)}
            >
              @{list.handle}
            </Link>
          </span>
          <span>{tn('lists.count', list.count)}</span>
          <time dateTime={list.updatedAt}>
            {t('lists.updated', { date: formatDate(new Date(list.updatedAt), locale) })}
          </time>
        </p>

        {/* =============================================================================
            🔴 UNE LISTE AVAIT UNE ADRESSE, ET RIEN POUR Y REAGIR
            =============================================================================

            Depuis le 2026-08-16, une critique porte un coeur et des reponses ; une liste
            porte une adresse partageable — c'est-a-dire qu'on l'envoie a quelqu'un — et
            celui qui la recevait n'avait **aucun** moyen de repondre autrement qu'en dehors
            du produit. La seule surface faite pour etre envoyee etait la seule sans retour.

            ⚠️ Deux gestes et pas trois : le coeur (`028`) et la reprise. **Les reponses sont
            refusees**, et c'est ecrit dans `028_list_likes.sql` — un fil de discussion est
            une surface de moderation entiere, et personne n'a encore demande a discuter une
            liste. Le jour ou l'on voudra, `024` est le patron a recopier.

            ⚠️ Les deux exigent un compte et ne s'affichent pas sans : *un bouton qui ne peut
            pas marcher ne se degrade pas, il ne s'affiche pas* (regle du 2026-08-09).
            `list_likes_insert` exige en plus un handle, comme `015`. */}
        {/* ⚠️ **Le proprietaire n'avait aucune issue depuis sa propre liste.** Les deux
            gestes ci-dessous ne s'adressent qu'aux autres — c'est juste —, mais celui qui
            ouvre la sienne (par exemple pour verifier le lien qu'il vient d'envoyer) se
            retrouvait devant une page sans un seul bouton. Le geste existe, il vit sur
            `/listes`, et une phrase l'y envoie plutot que de le recopier ici. */}
        {myId !== undefined && myId === list.authorId ? (
          <p className="pt-1 meta">
            <Link
              className="tap-line underline hover:text-(--color-volt)"
              href={pathIn('/listes', locale)}
            >
              {t('list.mineEdit')}
            </Link>
          </p>
        ) : null}

        {/* Regle 4 : *un ecran sans issue, pas un ecran sans bouton.* Une liste s'ouvre
            surtout par un lien recu — donc le plus souvent **sans compte**. Ne rien afficher
            laissait croire qu'une liste ne se reprend pas ; le bouton, lui, ne peut pas
            marcher (`list_likes_insert` et `lists_insert` exigent une session). On nomme donc
            la porte et sa condition, ce qui n'est pas un bouton mort. */}
        {myId === undefined ? (
          <p className="pt-1 meta-sm">
            {t('list.needAccount')}{' '}
            <Link
              className="tap-line underline hover:text-(--color-volt)"
              href={pathIn('/compte', locale)}
            >
              {t('comments.openOne')}
            </Link>
          </p>
        ) : null}

        {myId !== undefined && myId !== list.authorId ? (
          <p className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              className={`btn rounded-full ${likes.mine ? 'btn-primary' : ''}`}
              aria-pressed={likes.mine}
              onClick={async () => {
                if (social === undefined) return;
                const next = !likes.mine;
                const ok = await social.likeList(myId, list.authorId, slug, next);
                // On ajuste **localement** plutot que de relire : une lecture de plus par
                // clic couterait un appel pour un chiffre qu'on connait deja. Meme choix que
                // le coeur d'une critique.
                if (ok) {
                  setLikes((current) => ({
                    count: Math.max(0, current.count + (next ? 1 : -1)),
                    mine: next,
                  }));
                }
              }}
            >
              {likes.mine ? t('list.unlike') : t('list.like')}
              {likes.count > 0 ? <span className="ps-2">{likes.count}</span> : null}
            </button>

            {/* F5 — la reprise. Copier une liste chez soi pour la suivre est le geste qui
                fait circuler les listes : sans lui, une liste partagee se lit et se referme.

                ⚠️ Une **copie**, jamais un abonnement : voir `copyList`. Ce qui est repris
                est a soi — on peut y ajouter, en retirer, la renommer. */}
            {copied === undefined ? (
              <button
                type="button"
                className="btn rounded-full"
                disabled={copy === 'copying'}
                onClick={async () => {
                  if (social === undefined) return;
                  setCopy('copying');
                  // ⚠️ Le slug se decide contre **mes** listes, pas contre celles de
                  // l'auteur : deux listes de meme titre sont deux listes, et `createList`
                  // s'interdit tout `upsert` — le suffixe vient du domaine, en amont et
                  // visiblement.
                  const existing = await social.listsBy(myId);
                  const wanted = uniqueSlug(slug, new Set(existing.map((one) => one.slug)));
                  const ok = await social.copyList(
                    myId,
                    {
                      slug: wanted,
                      // Le titre dit d'ou elle vient : une copie sans provenance devient,
                      // au bout de trois, une liste dont on ne sait plus qui l'a faite.
                      title: t('list.copyTitle', { title: list.title, who: list.handle }).slice(
                        0,
                        LIST_TITLE_MAX,
                      ),
                    },
                    items,
                  );
                  setCopy(ok ? 'done' : 'failed');
                  if (ok) setCopied(wanted);
                }}
              >
                {copy === 'copying' ? t('list.copying') : t('list.copy')}
              </button>
            ) : (
              // Ce qui vient de se passer se dit, **avec le chemin vers la copie** : une
              // reprise qui ne mene nulle part laisse chercher ou la liste est partie.
              <span className="flex flex-wrap items-center gap-2 meta">
                {t('list.copied')}
                <Link
                  className="tap-line underline hover:text-(--color-volt)"
                  href={pathIn('/listes', locale)}
                >
                  {t('list.copied.open')}
                </Link>
              </span>
            )}

            {copy === 'failed' ? (
              <span className="text-sm text-(--color-warn)">{t('list.copyFailed')}</span>
            ) : null}
          </p>
        ) : null}
      </PageHeader>

      {items.length === 0 ? (
        // ⚠️ Sans action : le lecteur ne peut rien pour une liste que quelqu'un d'autre a
        // laissee vide, et le lien vers son profil est deja dans l'en-tete juste au-dessus.
        // *Un ecran sans issue, pas un ecran sans bouton.*
        <EmptyState>{t('lists.empty')}</EmptyState>
      ) : (
        // La grille partagee, jamais une grille locale : c'est le defaut pour lequel
        // `.poster-grid` a ete extraite.
        <ul className="poster-grid">
          {items.map((entry) => {
            const parsed = parseJournalKey(entry.subject);
            // Meme resolution que partout : l'instantane de la ligne d'abord (020), le journal
            // du lecteur ensuite pour le fond d'avant. Une liste qu'on decouvre est faite de
            // ce qu'on ne connait pas — c'est exactement le cas ou le repli ne suffit pas.
            const { title, posterPath } = resolveSeriesRef(entry, journal, t('feed.someSeries'));
            const chip = <PosterChip path={posterPath} title={title} wide />;
            return (
              <li key={entry.subject} className="space-y-1">
                {parsed === undefined ? (
                  chip
                ) : (
                  <Link
                    href={pathIn(`/serie/${parsed.providerId}`, locale)}
                    className="block"
                    aria-label={title}
                  >
                    {chip}
                  </Link>
                )}
                <p className="clamp-2 meta-sm">{title}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

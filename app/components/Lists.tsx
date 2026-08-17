'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { checkList, uniqueSlug, type ListRejection } from '@/src/domain/lists';
import {
  ALL_LIST_SORTS,
  DEFAULT_LIST_SORT,
  isListSort,
  orderLists,
  type ListSort,
} from '@/src/domain/list-order';
import { parseJournalKey, seriesEntries, type Journal } from '@/src/domain/journal';
import { formatDate } from '@/lib/format';
// ⚠️ Le moteur, jamais `@/lib/i18n` : celui-ci importe les deux dictionnaires, et ce
// composant est client — il les remettrait tous les deux dans le paquet de `/listes` (8.10,
// `i18n-split.test.ts`, qui l'a effectivement attrape ici).
import { localeTag } from '@/lib/i18n/engine';
import { pathIn } from '@/lib/routes';
import { Menu } from '@/app/components/Menu';
import { type SeriesRef, type SeriesList } from '@/src/social/client';
import { resolveSeriesRef } from '@/app/components/seriesRef';
import { useSocial } from '@/app/social/useSocial';
import { AccountGate } from '@/app/components/AccountGate';
import { EmptyState } from '@/app/components/EmptyState';
import { PosterChip } from '@/app/components/PosterChip';

/**
 * Les listes — les miennes quand `ownerId` est absent, celles de quelqu'un sinon.
 *
 * ## Un seul composant pour les deux, et ce n'est pas de l'economie de fichiers
 *
 * Une liste vue de l'exterieur et une liste vue de l'interieur ne different que par trois
 * boutons. En ecrire deux versions, c'est se garantir qu'un jour l'une affichera le nombre
 * d'elements et pas l'autre — la mecanique exacte qui a fait diverger `LibraryCard` et
 * `SeriesCard` jusqu'a ce que l'un des deux montre trois rectangles gris.
 *
 * ## 🔴 « Le titre n'est PAS dans la liste, et ne peut pas y etre » — c'etait ecrit ici
 *
 * Ce fichier a porte cette phrase jusqu'au 2026-08-16, avec son raisonnement : ranger le
 * titre dans `list_items` serait stocker de la metadonnee TMDB, donc violer la regle 1 — le
 * catalogue est loue, pas possede. Le titre venait donc du journal du **lecteur**, avec un
 * repli pour le reste.
 *
 * ⚠️ **La premisse etait juste et la conclusion fausse**, et `018` avait deja tranche la
 * meme question dans l'autre sens quatre jours plus tot pour `activity` et `reviews` : un
 * titre est une donnee **publique du catalogue**, derivable de `subject` par un appel TMDB
 * anonyme. En garder un **instantane** — ce que la personne avait sous les yeux — n'est pas
 * constituer une base de metadonnees, c'est dater un geste. La regle 1 interdit de posseder
 * le catalogue, pas de se souvenir de ce qu'on a range.
 *
 * Ce que la doctrine coutait, mesure : sur `/listes`, chaque carte d'une liste qu'on
 * decouvre annoncait quatre fois « Tracked series » — *une liste qu'on decouvre est faite de
 * ce qu'on ne connait pas*. Le cout etait donc maximal exactement la ou la fonctionnalite
 * sert. Voir `020_list_items_titre.sql` et `resolveSeriesRef`.
 */
/**
 * Ce qu'une liste rangerait — avec de **vraies** series, celles du lecteur.
 *
 * ## Pourquoi ce n'est pas du faux contenu
 *
 * `Faces.tsx` pose la regle et elle tient : *« on ne remplit pas une face de faux contenu »*.
 * Une capture inventee, un exemple de liste fabrique, des pseudos plausibles — tout cela
 * ment, et le mensonge se paie au premier clic. Ici rien n'est invente : ce sont les series
 * du journal de **celui qui regarde**, lues dans son navigateur, sans compte et sans appel.
 *
 * C'est la difference entre *decrire* une fonctionnalite et la *montrer avec ce qu'on a deja*
 * — et c'est la seule facon d'expliquer une liste a quelqu'un qui n'en a jamais tenu.
 *
 * ⚠️ **Silencieux quand le journal est vide**, et c'est un des rares silences qui restent
 * justes : il n'y a alors litteralement rien a montrer, et la porte au-dessus dit deja tout.
 */
function ListPreview({ journal }: { readonly journal: Journal }) {
  const { t, tn } = useT();

  // Seules celles dont on connait le titre : sans instantane, la vignette serait un
  // monogramme sur une cle brute — c'est-a-dire une demonstration qui dessert.
  const shown = seriesEntries(journal)
    .flatMap(([key, entry]) => {
      const title = entry.snapshot?.title;
      return title === undefined
        ? []
        : [{ key, title, posterPath: entry.snapshot?.posterPath }];
    })
    .slice(0, 8);

  if (shown.length === 0) return null;

  return (
    <section className="band" aria-label={t('lists.preview.title')}>
      <h2 className="row-title">{t('lists.preview.title')}</h2>
      <p className="meta">{tn('lists.preview.body', shown.length)}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-3">
        {shown.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <PosterChip path={item.posterPath} title={item.title} />
            <span className="text-sm">{item.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Lists({ ownerId, ownerHandle }: {
  readonly ownerId?: string;
  /**
   * Le nom de l'auteur, quand l'appelant le connait deja — ce qui rend chaque titre cliquable
   * vers `/u/<nom>/liste/<slug>`.
   *
   * ⚠️ Il n'est pas deduit d'`ownerId` : une liste a besoin du **nom** pour avoir une adresse,
   * et le resoudre ici demanderait un appel de plus par montage. `PublicProfile` l'a deja ;
   * sur ses propres listes, il est lu une seule fois dans le meme paquet que les listes.
   */
  readonly ownerHandle?: string;
}) {
  const { t, tn, locale } = useT();
  const { configured, ready, account } = useAuth();
  const { journal } = useJournal();

  /**
   * Le tri demande — voir `src/domain/list-order.ts` pour le defaut qu'il repare.
   *
   * ⚠️ Dans l'etat React et **pas dans l'adresse**, contrairement a `/parcourir` : les listes
   * sont deja toutes dans le navigateur au moment ou l'on descend jusqu'a elles. Trier
   * cinquante cartes en memoire ne coute aucun appel et ne peut pas faire sortir `/listes` de
   * `○ Static` — c'est le meme arbitrage que les commandes de critiques, et pour les memes
   * raisons mesurees.
   */
  const [sort, setSort] = useState<ListSort>(DEFAULT_LIST_SORT);

  const [lists, setLists] = useState<readonly SeriesList[]>([]);
  /**
   * ⚠️ **Range une fois par changement de tri, et non a chaque rendu.**
   *
   * Ce composant se rend a chaque depliage de carte (`open`), a chaque chargement du contenu
   * d'une liste (`items`), a chaque frappe dans le formulaire de creation (`title`, `note`).
   * Le rangement etait ecrit dans le JSX : il repartait donc a chaque touche tapee, en
   * construisant a chaque fois un `Intl.Collator` neuf — l'objet le plus cher de la fonction.
   * Meme discipline que `buildLibrary` dans `Library.tsx`, et pour la meme raison ecrite la :
   * *« le rangement traverse toutes les entrees, il n'a aucune raison de recommencer a chaque
   * rendu »*.
   */
  const ordered = useMemo(() => orderLists(lists, sort, localeTag(locale)), [lists, sort, locale]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Readonly<Record<string, readonly SeriesRef[]>>>({});
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<ListRejection | 'failed' | undefined>(undefined);
  /**
   * Le formulaire de creation est-il demande ?
   *
   * ⚠️ Il n'est pas la seule condition : il s'ouvre **aussi** tant qu'il n'y a aucune liste
   * (voir le rendu). Un etat qui vaudrait « ouvert » ou « ferme » tout seul obligerait a le
   * poser a l'initialisation, avant que `listsBy` ait repondu — donc a deviner.
   */
  const [creating, setCreating] = useState(false);
  /** Le nom de l'auteur, donne par l'appelant ou lu une fois — voir `ownerHandle`. */
  const [handle, setHandle] = useState<string | undefined>(ownerHandle);

  const social = useSocial();
  const myId = account?.userId;
  const subjectId = ownerId ?? myId;
  const editable = ownerId === undefined || ownerId === myId;

  const clientFor = useCallback(() => {
    // ⚠️ Construit **meme sans compte** : une liste d'un profil `public` se lit par un
    // visiteur anonyme, et c'est RLS qui tranche. Exiger une session fermerait la page a
    // exactement les gens qu'un lien de partage amene.
    return social;
  }, [social]);

  const load = useCallback(async () => {
    const social = clientFor();
    if (social === undefined || subjectId === undefined) {
      setLoaded(true);
      return;
    }
    // ⚠️ Le nom part **avec** les listes et non apres : enchainer les deux ferait apparaitre
    // les cartes muettes puis cliquables, donc bouger une cible sous le doigt. Et il n'est
    // demande que s'il manque — sur un profil, l'appelant l'a deja.
    const [found, mine] = await Promise.all([
      social.listsBy(subjectId),
      ownerHandle === undefined && myId !== undefined
        ? social.myProfile(myId)
        : Promise.resolve(undefined),
    ]);
    setLists(found);
    if (mine !== undefined) setHandle(mine.handle);
    setLoaded(true);
  }, [clientFor, subjectId, ownerHandle, myId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (slug: string) => {
      if (open === slug) {
        setOpen(undefined);
        return;
      }
      setOpen(slug);
      const social = clientFor();
      if (social === undefined || subjectId === undefined || items[slug] !== undefined) return;
      const found = await social.listItems(subjectId, slug);
      setItems((current) => ({ ...current, [slug]: found }));
    },
    [open, clientFor, subjectId, items],
  );

  const create = useCallback(async () => {
    const checked = checkList(title, note);
    if (!checked.ok) {
      setError(checked.reason);
      return;
    }
    const social = clientFor();
    if (social === undefined || myId === undefined) return;

    // Le suffixe vient du domaine, pas d'un `upsert` : deux listes de meme titre sont deux
    // listes, et un `merge-duplicates` ecraserait la premiere en silence.
    const slug = uniqueSlug(checked.slug, new Set(lists.map((l) => l.slug)));
    const ok = await social.createList(myId, {
      slug,
      title: checked.title,
      ...(checked.note !== undefined ? { note: checked.note } : {}),
    });
    if (!ok) {
      setError('failed');
      return;
    }
    setTitle('');
    setNote('');
    setError(undefined);
    // La liste creee devient le sujet de la page : le formulaire se replie derriere son
    // bouton, sinon on lit sa propre creation par-dessus deux champs vides.
    setCreating(false);
    await load();
  }, [title, note, clientFor, myId, lists, load]);

  const remove = useCallback(
    async (slug: string, subject: string) => {
      const social = clientFor();
      if (social === undefined || myId === undefined) return;
      if (!(await social.removeFromList(myId, slug, subject))) return;
      setItems((current) => ({
        ...current,
        [slug]: (current[slug] ?? []).filter((entry) => entry.subject !== subject),
      }));
      await load();
    },
    [clientFor, myId, load],
  );

  const drop = useCallback(
    async (slug: string) => {
      const social = clientFor();
      if (social === undefined || myId === undefined) return;
      if (!(await social.deleteList(myId, slug))) return;
      setOpen(undefined);
      await load();
    },
    [clientFor, myId, load],
  );

  if (!configured) return <p className="prose-note">{t('account.unavailable.body')}</p>;
  // Le silence tant qu'on ne sait pas : annoncer « aucune liste » avant d'avoir lu serait
  // le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  if (!ready || !loaded) return <div className="h-48" aria-hidden="true" />;
  // 🔴 **C'etait une phrase grise, seule sur la page** — la deuxieme des six faces a mener a
  // un cul-de-sac sans un bouton. Elle disait pourtant la bonne chose (*« une liste que
  // personne ne peut lire n'est pas une liste »*) ; ce qui manquait n'etait pas l'explication,
  // c'etait la porte, et de quoi voir a quoi elle mene.
  if (editable && myId === undefined) {
    return (
      <div className="space-y-8">
        <AccountGate
          title={t('lists.gate.title')}
          body={t('lists.gate.body')}
          secondaryHref="/moi"
          secondaryLabel={t('gate.library')}
        />
        <ListPreview journal={journal} />
      </div>
    );
  }

  // Deploye tant qu'il n'y a rien a montrer, replie des qu'il y a des listes a lire.
  const formOpen = creating || lists.length === 0;

  return (
    <div className="space-y-6">
      {/* 🔴 **Le formulaire etait deploye en permanence, et en tete.** Deux champs et un
          bouton occupaient le haut de la page avant la premiere liste — c'est-a-dire que la
          face « Mes listes » s'ouvrait sur la creation d'une liste plutot que sur les siennes.
          Le geste le plus rare tenait la meilleure place.

          ⚠️ Il reste **deploye tant qu'il n'y a aucune liste** : la, creer est la seule chose
          a faire, et le replier derriere un bouton ajouterait un clic a l'unique geste
          possible. La forme suit l'etat, elle n'est pas la meme pour tout le monde. */}
      {editable ? (
        formOpen ? (
          <section className="card space-y-3" aria-label={t('lists.newAria')}>
            <h2 className="card-title">{t('lists.new')}</h2>
            <input
              className="field w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('lists.titlePlaceholder')}
              aria-label={t('lists.titleLabel')}
            />
            <input
              className="field w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('lists.notePlaceholder')}
              aria-label={t('lists.noteLabel')}
            />
            {error !== undefined ? (
              <p className="text-sm text-(--color-warn)">{t(`lists.error.${error}`)}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={create}>
                {t('lists.create')}
              </button>
              {lists.length > 0 ? (
                <button type="button" className="btn" onClick={() => setCreating(false)}>
                  {t('lists.cancel')}
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={false}
            onClick={() => setCreating(true)}
          >
            {t('lists.new')}
          </button>
        )
      ) : null}

      {/* Le tri, absent tant qu'il n'y a qu'une liste : un menu qui ne peut rien reordonner
          est un bouton qui ne fait rien, et il apprendrait a ignorer la ligne le jour ou elle
          servira. Meme condition que le filtre par mot de la bibliotheque.

          ⚠️ **Il ne va PAS sur les listes des autres** (`DiscoverLists`), et ce n'est pas un
          oubli : cette section est deja un choix editorial — les douze listes publiques les
          plus recemment modifiees, c'est-a-dire ce qui est vivant. Les trier par taille
          montrerait « la plus grande des douze plus recentes », un classement qui a l'air
          d'en etre un et n'en est pas. */}
      {lists.length > 1 ? (
        <Menu
          id="lists-sort"
          label={t('browse.sort')}
          value={sort}
          /* ⚠️ `isListSort` et non `value as ListSort` : `Menu` rend une `string`, et une
             assertion de type est une **affirmation**, pas une verification — elle laisserait
             entrer n'importe quoi si les options et le type divergeaient un jour. La garde
             coute une comparaison, et elle donne enfin un appelant a une fonction que l'audit
             de ce jour a trouvee ecrite, testee, et invoquee nulle part. */
          onChange={(value) => setSort(isListSort(value) ? value : DEFAULT_LIST_SORT)}
          options={ALL_LIST_SORTS.map((option) => ({
            value: option,
            label: t(`lists.sort.${option}`),
          }))}
        />
      ) : null}

      {lists.length === 0 ? (
        // ⚠️ Sans action pour le proprietaire : le formulaire de creation est deploye juste
        // au-dessus, sur cette meme page. *Un ecran sans issue, pas un ecran sans bouton.*
        // Et sans action pour un visiteur non plus : il ne peut rien pour les listes que
        // quelqu'un d'autre n'a pas faites.
        <EmptyState>{editable ? t('lists.none') : t('lists.noneOther')}</EmptyState>
      ) : (
        // ⚠️ Une **grille** et non une pile : une liste est un objet qu'on parcourt du regard
        // pour choisir, pas un article qu'on lit de haut en bas. Empilees pleine largeur, dix
        // listes demandent dix ecrans de defilement pour en trouver une.
        <ul className="grid gap-3 sm:grid-cols-2">
          {ordered.map((list) => {
            const shown = items[list.slug] ?? [];
            const isOpen = open === list.slug;

            return (
              <li key={list.slug} className="card space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {/* 🔴 **Une liste n'avait pas d'adresse.** Le titre etait du texte, et
                      partager « la troisieme liste de @machin » demandait d'envoyer un profil
                      avec une consigne. Depuis le 2026-08-17 chaque liste a la sienne.
                      ⚠️ Le lien n'apparait que si le nom est connu — un lien vers
                      `/u/undefined/liste/...` serait un bouton qui ne peut pas marcher. */}
                  <h3 className="card-title">
                    {handle === undefined ? (
                      list.title
                    ) : (
                      <Link
                        className="tap-line hover:text-(--color-volt)"
                        href={pathIn(`/u/${handle}/liste/${list.slug}`, locale)}
                      >
                        {list.title}
                      </Link>
                    )}
                  </h3>
                  <span className="meta-sm">
                    {tn('lists.count', list.count)}
                  </span>
                </div>

                {/* 🔴 **La date etait demandee a la base et jetee.** `listsBy` selectionne
                    `updated_at` et ordonne dessus, le type le porte, et aucun `.tsx` du depot
                    ne le lisait au 2026-08-16 : l'ordre des cartes changeait sous les yeux du
                    lecteur — ajouter une serie remonte sa liste — sans que rien ne dise
                    pourquoi. Meme forme que la note du public, le creux de la trajectoire et
                    la date d'une critique : la donnee etait deja payee. */}
                <p className="meta-sm">
                  {t('lists.updated', { date: formatDate(new Date(list.updatedAt), locale) })}
                </p>

                {list.note !== undefined ? (
                  <p className="meta">{list.note}</p>
                ) : null}

                {/* 🔴 **La carte ne montrait aucune serie.** Un titre, une phrase, un nombre :
                    sur un produit dont le sujet est ce qu'on regarde, une liste se lisait comme
                    une liste de courses, et savoir ce qu'il y avait dedans demandait de les
                    ouvrir une par une.

                    ⚠️ **Zero requete de plus** : les quatre cles arrivent dans la meme reponse
                    que le compte, par un second embarquement (`SeriesList.preview`). L'appel
                    par liste etait la solution evidente et c'est exactement ce que le type
                    s'interdit — *dix listes en feraient onze*. La requete a ete verifiee contre
                    la vraie base avant d'etre ecrite.

                    ⚠️ L'affiche venait de l'instantane du **lecteur** — donc jamais chez
                    quelqu'un d'autre. Depuis `020` la ligne voyage avec la sienne, et
                    `resolveSeriesRef` ne retombe sur le journal que pour le fond d'avant. */}
                {list.preview.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {list.preview.map((entry) => {
                      const parsed = parseJournalKey(entry.subject);
                      const { title: seriesTitle, posterPath } = resolveSeriesRef(
                        entry,
                        journal,
                        t('library.card.tracked'),
                      );
                      const chip = <PosterChip path={posterPath} title={seriesTitle} wide />;
                      return (
                        <li key={entry.subject}>
                          {parsed === undefined ? (
                            chip
                          ) : (
                            <Link
                              href={pathIn(`/serie/${parsed.providerId}`, locale)}
                              aria-label={seriesTitle}
                            >
                              {chip}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn"
                    aria-expanded={isOpen}
                    onClick={() => toggle(list.slug)}
                  >
                    {isOpen ? t('lists.close') : t('lists.open')}
                  </button>
                  {/* ⚠️ `quiet-action` et non `.btn` : supprimer une liste est **irreversible**
                      (la cascade est dans le SQL), et lui donner le meme poids visuel que
                      « Voir » met un geste sans retour a cote d'un geste sans consequence. */}
                  {editable ? (
                    <button type="button" className="quiet-action" onClick={() => drop(list.slug)}>
                      {t('lists.delete')}
                    </button>
                  ) : null}
                </div>

                {isOpen ? (
                  shown.length === 0 ? (
                    <p className="meta">{t('lists.empty')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {shown.map((entry) => {
                        const parsed = parseJournalKey(entry.subject);
                        const { title: seriesTitle, posterPath } = resolveSeriesRef(
                          entry,
                          journal,
                          t('library.card.tracked'),
                        );

                        return (
                          <li
                            key={entry.subject}
                            className="flex items-center justify-between gap-3"
                          >
                            {/* Une liste de series sans une seule affiche est une liste de
                                courses. ⚠️ L'affiche venait du seul journal du lecteur : ouvrir
                                la liste de quelqu'un d'autre rendait autant de monogrammes
                                qu'elle contient de series qu'on ne suit pas. Depuis `020` elle
                                voyage avec la ligne — voir `resolveSeriesRef`. */}
                            <span className="flex min-w-0 items-center gap-3">
                              <PosterChip path={posterPath} title={seriesTitle} />
                              {parsed === undefined ? (
                                <span className="text-sm">{seriesTitle}</span>
                              ) : (
                                <Link
                                  className="text-sm font-medium hover:text-(--color-volt)"
                                  href={pathIn(`/serie/${parsed.providerId}`, locale)}
                                >
                                  {seriesTitle}
                                </Link>
                              )}
                            </span>
                            {editable ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => remove(list.slug, entry.subject)}
                              >
                                {t('lists.remove')}
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { authConfigFromEnv } from '@/src/auth/client';
import { checkList, uniqueSlug, type ListRejection } from '@/src/domain/lists';
import { parseJournalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import { SocialClient, type SeriesList } from '@/src/social/client';

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
 * ## ⚠️ Le titre d'une serie n'est PAS dans la liste, et ne peut pas y etre
 *
 * `list_items` ne porte qu'une cle de journal (`tmdb:1396`). Y ranger le titre serait
 * stocker durablement une metadonnee TMDB, ce que la regle 1 interdit — le catalogue est
 * loue, pas possede. Le titre vient donc de l'instantane du **lecteur** quand il l'a, et a
 * defaut on affiche le repli deja employe par `LibraryCard`, avec le lien vers la fiche ou
 * le vrai titre vit.
 *
 * C'est le meme arbitrage que `PublicProfile` fait deja pour les critiques. Le cout est
 * visible sur la liste de quelqu'un dont on ne suit aucune serie ; le prix de l'inverse
 * serait une base de metadonnees que le contrat nous interdit de constituer.
 */
export function Lists({ ownerId }: { readonly ownerId?: string }) {
  const { t, tn, locale } = useT();
  const { configured, ready, account } = useAuth();
  const { journal } = useJournal();

  const [lists, setLists] = useState<readonly SeriesList[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<ListRejection | 'failed' | undefined>(undefined);

  const accessToken = account?.accessToken;
  const myId = account?.userId;
  const subjectId = ownerId ?? myId;
  const editable = ownerId === undefined || ownerId === myId;

  const clientFor = useCallback(() => {
    const config = authConfigFromEnv();
    if (config === undefined) return undefined;
    // ⚠️ Construit **meme sans compte** : une liste d'un profil `public` se lit par un
    // visiteur anonyme, et c'est RLS qui tranche. Exiger une session fermerait la page a
    // exactement les gens qu'un lien de partage amene.
    return new SocialClient({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: () => accessToken,
    });
  }, [accessToken]);

  const load = useCallback(async () => {
    const social = clientFor();
    if (social === undefined || subjectId === undefined) {
      setLoaded(true);
      return;
    }
    setLists(await social.listsBy(subjectId));
    setLoaded(true);
  }, [clientFor, subjectId]);

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
    await load();
  }, [title, note, clientFor, myId, lists, load]);

  const remove = useCallback(
    async (slug: string, subject: string) => {
      const social = clientFor();
      if (social === undefined || myId === undefined) return;
      if (!(await social.removeFromList(myId, slug, subject))) return;
      setItems((current) => ({
        ...current,
        [slug]: (current[slug] ?? []).filter((s) => s !== subject),
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
  if (editable && myId === undefined) {
    return <p className="prose-note">{t('lists.needAccount')}</p>;
  }

  return (
    <div className="space-y-6">
      {editable ? (
        <section className="panel space-y-3 px-4 py-4" aria-label={t('lists.newAria')}>
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
          <button type="button" className="btn" onClick={create}>
            {t('lists.create')}
          </button>
        </section>
      ) : null}

      {lists.length === 0 ? (
        <p className="prose-note">{editable ? t('lists.none') : t('lists.noneOther')}</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => {
            const shown = items[list.slug] ?? [];
            const isOpen = open === list.slug;

            return (
              <li key={list.slug} className="panel space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="card-title">{list.title}</h3>
                  <span className="text-xs text-(--color-muted)">
                    {tn('lists.count', list.count)}
                  </span>
                </div>

                {list.note !== undefined ? (
                  <p className="text-sm text-(--color-muted)">{list.note}</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn"
                    aria-expanded={isOpen}
                    onClick={() => toggle(list.slug)}
                  >
                    {isOpen ? t('lists.close') : t('lists.open')}
                  </button>
                  {editable ? (
                    <button type="button" className="btn" onClick={() => drop(list.slug)}>
                      {t('lists.delete')}
                    </button>
                  ) : null}
                </div>

                {isOpen ? (
                  shown.length === 0 ? (
                    <p className="text-sm text-(--color-muted)">{t('lists.empty')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {shown.map((subject) => {
                        const parsed = parseJournalKey(subject);
                        const seriesTitle =
                          journal.entries[subject]?.snapshot?.title ?? t('library.card.tracked');

                        return (
                          <li key={subject} className="flex items-center justify-between gap-3">
                            {parsed === undefined ? (
                              <span className="text-sm">{seriesTitle}</span>
                            ) : (
                              <Link
                                className="text-sm hover:text-(--color-volt)"
                                href={pathIn(`/serie/${parsed.providerId}`, locale)}
                              >
                                {seriesTitle}
                              </Link>
                            )}
                            {editable ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => remove(list.slug, subject)}
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

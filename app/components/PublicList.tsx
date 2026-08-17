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
import { socialFrom } from '@/app/social/socialFrom';
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
  const { configured, ready, account } = useAuth();
  const { journal } = useJournal();

  const [list, setList] = useState<DiscoverableList | undefined>(undefined);
  const [items, setItems] = useState<readonly SeriesRef[]>([]);
  const [loaded, setLoaded] = useState(false);

  const accessToken = account?.accessToken;

  const load = useCallback(async () => {
    // ⚠️ Construit meme sans compte : une liste d'un profil `public` se lit par un visiteur
    // anonyme, et c'est RLS qui tranche. Exiger une session fermerait la page a exactement
    // les gens qu'un lien de partage amene — c'est-a-dire a son seul public.
    const social = socialFrom(accessToken);
    if (social === undefined) {
      setLoaded(true);
      return;
    }
    const found = await social.listBy(handle, slug);
    setList(found);
    setLoaded(true);
    if (found === undefined) return;
    setItems(await social.listItems(found.authorId, slug));
  }, [handle, slug, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!configured) return <p className="prose-note">{t('account.unavailable.body')}</p>;
  // Le silence tant qu'on ne sait pas : annoncer « cette liste n'existe pas » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  if (!ready || !loaded) return <div className="h-64" aria-hidden="true" />;

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

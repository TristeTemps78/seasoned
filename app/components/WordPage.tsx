'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { useSocialRead } from '@/app/social/useSocial';
import { EmptyState } from '@/app/components/EmptyState';
import { FaceDot } from '@/app/components/FaceDot';
import { PosterChip } from '@/app/components/PosterChip';
import { PageHeader } from '@/app/components/PageHeader';
import { parseJournalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import type { TaggedByAuthor } from '@/src/social/client';

/**
 * **La page d'un mot** — `/mot/<mot>`.
 *
 * ## 🔴 Ce qui manquait, et pourquoi un mot sans page ne sert a rien
 *
 * `023` a publie les mots le 2026-08-16 et un onglet de profil les montre groupes. Il
 * n'existait **ni page par mot, ni recherche par mot** : le vocabulaire de quelqu'un
 * s'arretait a son profil, donc aucune facon de croiser deux personnes qui rangent sous
 * « le dimanche ». Chez la reference, un mot est un **index navigable**, et c'est tout son
 * interet — *le vocabulaire de quelqu'un ne vaut que confronte a celui des autres.*
 *
 * ## La page est rangee PAR PERSONNE, et c'est la decision
 *
 * Une grille de series melangees aurait ete plus courte a ecrire et elle aurait perdu le
 * sujet : ce qu'on vient voir n'est pas « quelles series sont marquees confort », c'est
 * **ce que ce mot veut dire pour chacun**. Deux personnes qui rangent la meme serie sous le
 * meme mot est une information ; la meme affiche affichee deux fois n'en est pas une.
 *
 * ⚠️ **Aucun controle de visibilite ici** : `tags_select` porte `can_see(user_id)`. Un mot
 * pose par quelqu'un qu'on ne peut pas voir n'arrive jamais — et la page ne dit pas qu'il
 * existe. C'est la meme regle que `searchLists`, et la refaire ici en donnerait deux.
 */
export function WordPage({ word }: { readonly word: string }) {
  const { t, tn, locale } = useT();
  const { social, unreadable, reset } = useSocialRead();
  const [rows, setRows] = useState<readonly TaggedByAuthor[] | undefined>(undefined);

  useEffect(() => {
    if (social === undefined) return;
    let alive = true;
    reset();
    void social.tagged(word).then((found) => {
      if (alive) setRows(found);
    });
    return () => {
      alive = false;
    };
  }, [social, word]);

  // Le silence tant qu'on ne sait pas : annoncer « personne » avant d'avoir lu serait le
  // meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  if (rows === undefined) return <div className="h-64" aria-hidden="true" />;

  // Par personne, la plus fournie d'abord. Le regroupement vit ici parce qu'il **est** la
  // page — le client rend la liste telle quelle, comme `tagsBy` (voir son commentaire).
  const byAuthor = new Map<string, TaggedByAuthor[]>();
  for (const row of rows) {
    const kept = byAuthor.get(row.handle);
    if (kept === undefined) byAuthor.set(row.handle, [row]);
    else kept.push(row);
  }
  const people = [...byAuthor.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-6">
      {/* ⚠️ `PageHeader` et non un `<h1>` a la main : la garde `layout-collisions` l'exige, et
          la raison est mesuree — un en-tete ecrit a la main derive, et l'accroche s'etale sur
          1120 px la ou le patron la borne.

          Le mot est affiche **tel qu'il a ete tape par quelqu'un**, jamais la version de
          l'URL : c'est son vocabulaire, et le remettre en minuscules le reecrirait. */}
      <PageHeader
        title={rows[0]?.tag ?? word}
        {...(rows.length > 0
          ? { lede: `${tn('word.people', people.length)} · ${tn('word.series', rows.length)}` }
          : {})}
      />

      {rows.length === 0 ? (
        /* Regle 4 : un ecran qui n'a rien a montrer dit quoi faire. Le geste n'est pas sur
           cette page — un mot se pose depuis la fiche d'une serie —, donc on le nomme et on
           donne le chemin. */
        <EmptyState
          status={unreadable}
          title={t(unreadable ? 'read.failed.title' : 'word.none.title')}
          actions={
            <Link href={pathIn('/parcourir', locale)} className="btn btn-primary">
              {t('word.none.browse')}
            </Link>
          }
        >
          {t('word.none.body')}
        </EmptyState>
      ) : (
        <ul className="space-y-6">
          {people.map(([handle, entries]) => (
            <li key={handle} className="space-y-2">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <FaceDot face={entries[0]?.face} />
                <Link
                  href={pathIn(`/u/${handle}`, locale)}
                  className="tap-line card-title hover:text-(--color-volt)"
                >
                  @{handle}
                </Link>
                <span className="meta-sm">{tn('word.series', entries.length)}</span>
              </p>
              <ul className="flex flex-wrap gap-2">
                {entries.map((one) => {
                  const parsed = parseJournalKey(one.subject);
                  // Le titre vient de l'instantane publie avec le mot (`023`), jamais du
                  // journal du lecteur : cette page est lue par des gens qui ne suivent pas
                  // les memes series, et c'est exactement le defaut que `018` et `020` ont
                  // paye deux fois.
                  const title = one.title ?? t('feed.someSeries');
                  return (
                    <li key={`${handle}:${one.subject}`}>
                      {parsed === undefined ? (
                        <PosterChip path={one.posterPath} title={title} wide />
                      ) : (
                        <Link
                          href={pathIn(`/serie/${parsed.providerId}`, locale)}
                          className="block"
                          aria-label={title}
                        >
                          <PosterChip path={one.posterPath} title={title} wide />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

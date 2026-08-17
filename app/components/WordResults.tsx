'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { useSocial } from '@/app/social/useSocial';
import { pathIn } from '@/lib/routes';

/**
 * Les mots, dans les resultats de recherche — **le cinquieme index** (F4, N2).
 *
 * ## Pourquoi un mot se cherche, alors qu'il ne se lit pas seul
 *
 * Un mot n'est pas un contenu : c'est une **entree**. Le chercher n'a d'interet que parce
 * qu'il mene a la page ou plusieurs vocabulaires se croisent — c'est tout ce que N2
 * demandait, et c'est pourquoi ces resultats sont des liens et non des listes de series.
 *
 * ⚠️ **Rendre directement les series ferait doublon** avec la recherche de series, qui est
 * au-dessus sur la meme page. Ici on rend des mots, avec ce qu'ils portent.
 *
 * ⚠️ Le compte affiche est celui de **ce que le lecteur peut voir** : `tags_select` porte
 * `can_see`, donc deux lecteurs verront deux chiffres. C'est assume et c'est le seul chiffre
 * honnete — un compte stable demanderait une fonction `security definer` de plus pour une
 * information qui ne decide de rien.
 */
export function WordResults({ query }: { readonly query: string }) {
  const { t, tn, locale } = useT();
  const [words, setWords] = useState<readonly { readonly tag: string; readonly count: number }[]>(
    [],
  );

  const social = useSocial();

  useEffect(() => {
    if (social === undefined) return;

    let alive = true;
    void social.searchTags(query).then((rows) => {
      if (alive) setWords(rows);
    });
    return () => {
      alive = false;
    };
  }, [social, query]);

  // Silencieux quand il n'y a rien, comme les trois autres index de cette page.
  if (words.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={t('word.search')}>
      <h2 className="section-heading">{t('word.search')}</h2>
      <ul className="flex flex-wrap gap-2">
        {words.map((word) => (
          <li key={word.tag}>
            <Link
              href={pathIn(`/mot/${encodeURIComponent(word.tag)}`, locale)}
              className="btn rounded-full"
            >
              {word.tag}
              <span className="meta-sm ps-2">{tn('word.searchCount', word.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

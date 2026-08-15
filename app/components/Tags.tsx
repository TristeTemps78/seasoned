'use client';

import { useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { journalKey, MAX_TAG_CHARS, normalizeTag, tagCounts, tagsOf } from '@/src/domain/journal';

/**
 * Vos mots sur une serie.
 *
 * ## Ce que les tags ajoutent, et que rien d'autre ne fait
 *
 * Le produit sait deja ranger par **fait** : ou j'en suis, ce que j'en pense, si je l'ai
 * finie. Il ne savait pas ranger par **raison** — « a revoir avec Lea », « le dimanche »,
 * « lachee mais je devrais reprendre ». Ce sont des categories que seul le lecteur peut
 * nommer, et qu'aucune taxonomie de catalogue ne remplacera : TMDB connait « Drame », pas
 * « quand je n'ai pas la tete a suivre une intrigue ».
 *
 * ## 🔴 La liste des tags deja employes n'est pas un confort
 *
 * Sans elle, chacun retape ses tags de memoire et fabrique `a revoir`, `à revoir` et
 * `revoir` — trois categories pour une intention, donc un filtre qui ne rend jamais la bonne
 * liste. La suggestion par frequence **propose le mot qu'on emploie deja**, ce qui est la
 * seule facon de faire converger un vocabulaire libre sans l'imposer.
 *
 * La normalisation ({@link normalizeTag}) couvre la casse et les espaces ; elle ne peut rien
 * contre les accents ni les synonymes, et c'est voulu — « science-fiction » et « a revoir »
 * sont des tags legitimes, les mutiler serait reecrire le vocabulaire de quelqu'un.
 *
 * ## Sans compte, comme tout le reste
 *
 * Les tags vivent dans le journal, donc dans ce navigateur. Rien ne part nulle part, et la
 * page qui accueille ce composant reste statique.
 */
export function Tags({ seriesId }: { readonly seriesId: string }) {
  const { journal, ready, setTag } = useJournal();
  const { t, tn } = useT();
  const [draft, setDraft] = useState('');

  const key = journalKey(seriesId);
  const entry = journal.entries[key];
  const mine = tagsOf(entry);

  // Les tags employes ailleurs dans le journal, hors ceux deja poses ici : proposer un tag
  // qui est deja sur la serie serait un bouton qui ne fait rien.
  const suggestions = tagCounts(journal)
    .filter(({ tag }) => !mine.includes(tag))
    .slice(0, 8);

  if (!ready) return <div className="h-24" aria-hidden="true" />;

  const add = (raw: string) => {
    if (normalizeTag(raw) === undefined) return;
    setTag(key, raw, true);
    setDraft('');
  };

  return (
    <section className="space-y-3 border-t border-(--color-edge) pt-3" aria-label={t('tags.title')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label">{t('tags.title')}</p>
        <p className="meta-sm">{t('tags.why')}</p>
      </div>

      {mine.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {mine.map((tag) => (
            <li key={tag}>
              {/* Le tag EST le bouton qui le retire : une pastille plus une croix ferait deux
                  cibles de 24 px la ou une seule suffit, sur une ligne qui en porte souvent
                  six. Le libelle accessible dit ce que le clic fait, ce que la pastille
                  seule ne dirait pas. */}
              <button
                type="button"
                onClick={() => setTag(key, tag, false)}
                aria-label={t('tags.remove', { tag })}
                className="btn rounded-full text-xs"
              >
                {tag}
                <span aria-hidden="true"> ×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="sr-only" htmlFor={`tag-${seriesId}`}>
          {t('tags.title')}
        </label>
        <input
          id={`tag-${seriesId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TAG_CHARS}
          placeholder={t('tags.placeholder')}
          className="min-w-0 flex-1 rounded-md border border-(--color-edge) bg-(--color-ink) px-3 py-2 text-sm"
        />
        {/* ⚠️ Desactive plutot qu'absent : le champ juste a cote dit deja quoi faire, donc
            la condition se lit sans phrase. C'est le seul cas ou un bouton inerte informe
            mieux qu'une porte nommee — il apparait et disparait au rythme de la frappe. */}
        <button type="submit" disabled={normalizeTag(draft) === undefined} className="btn rounded-full">
          {t('tags.add')}
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="space-y-1">
          <p className="meta-sm">{t('tags.reuse')}</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map(({ tag, count }) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => add(tag)}
                  className="btn rounded-full text-xs"
                  // Le compte n'est pas decoratif : il dit lequel de vos mots est votre mot.
                  title={tn('tags.usedOn', count, { n: count })}
                >
                  + {tag}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

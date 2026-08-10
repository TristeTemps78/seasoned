'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { journalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import { type SeriesList } from '@/src/social/client';
import { socialFrom } from '@/app/social/socialFrom';

/**
 * « Ajouter a une liste », depuis la fiche serie.
 *
 * ## Sans ce bouton, les listes ne sont pas une fonctionnalite
 *
 * `/listes` sait creer et vider une liste, mais **la remplir se fait la ou l'on rencontre
 * une serie** — c'est-a-dire ici. Livrer le schema, le client et l'ecran de gestion sans ce
 * bouton aurait produit exactement ce que ce depot a deja livre six fois : du code juste que
 * personne ne peut atteindre.
 *
 * ## Il se tait pour qui n'a pas de compte, et ne propose rien a qui n'a pas de liste
 *
 * Une liste vit sur le serveur (`007_lists.sql`), donc elle suppose un compte — contrairement
 * a tout le reste de la fiche serie, qui marche hors ligne. Plutot qu'un bouton qui ouvre une
 * invitation a s'inscrire au milieu d'une page de consultation, le composant **ne s'affiche
 * pas**. C'est la regle du produit : *mieux vaut se taire que montrer une porte fermee.*
 */
export function AddToList({ seriesId }: { readonly seriesId: string }) {
  const { t, locale } = useT();
  const { configured, ready, account } = useAuth();

  const [lists, setLists] = useState<readonly SeriesList[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  const accessToken = account?.accessToken;
  const userId = account?.userId;
  const subject = journalKey(seriesId);

  useEffect(() => {
    let alive = true;
    if (userId === undefined) {
      setLoaded(true);
      return;
    }
    const social = socialFrom(accessToken);
    if (social === undefined) return;
    void social.listsBy(userId).then((rows) => {
      if (!alive) return;
      setLists(rows);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, accessToken]);

  const add = useCallback(
    async (slug: string) => {
      if (userId === undefined) return;
      const social = socialFrom(accessToken);
      if (social === undefined) return;
      // ⚠️ L'ajout est **idempotent** cote base (`merge-duplicates`) : cliquer deux fois ne
      // remonte pas une erreur de cle dupliquee pour un geste sans consequence.
      if (await social.addToList(userId, slug, subject)) {
        setAdded((current) => new Set([...current, slug]));
      }
    },
    [userId, accessToken, subject],
  );

  // Silencieux sans compte, sans configuration, ou tant qu'on ne sait pas.
  if (!configured || !ready || userId === undefined || !loaded) return null;

  return (
    <div className="space-y-2">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('addToList.label')}
      </button>

      {open ? (
        lists.length === 0 ? (
          // On ne propose pas de creer une liste ici : ce serait un second formulaire a tenir
          // d'accord avec celui de `/listes`. Un lien y mene.
          <p className="text-sm text-(--color-muted)">
            {t('addToList.none')}{' '}
            <Link className="underline hover:text-(--color-volt)" href={pathIn('/listes', locale)}>
              {t('addToList.goToLists')}
            </Link>
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {lists.map((list) => (
              <li key={list.slug}>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={added.has(list.slug)}
                  onClick={() => add(list.slug)}
                >
                  {added.has(list.slug) ? t('addToList.added', { title: list.title }) : list.title}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

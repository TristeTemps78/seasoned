'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { journalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import { type SeriesList } from '@/src/social/client';
import { useSocialRead } from '@/app/social/useSocial';

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
 * ## 🔴 « Mieux vaut se taire que montrer une porte fermee » — la regle a saute
 *
 * Une liste vit sur le serveur (`007_lists.sql`), donc elle suppose un compte — contrairement
 * a tout le reste de la fiche serie, qui marche hors ligne. Ce fichier en tirait la conclusion
 * inverse de la bonne : plutot qu'un bouton qui ne peut pas marcher, **rien**.
 *
 * Le raisonnement confondait deux choses. Un bouton qui echoue en silence ment, et il faut
 * effectivement le retirer — c'est la regle du 2026-08-09, et elle vaut toujours (voir le
 * bouton Google de `SignIn`). Mais une **porte nommee, avec sa condition dite et son chemin
 * cliquable** ne ment pas : elle informe. Et sans elle, un visiteur sans compte ne voyait
 * nulle part que ce produit sait tenir des listes — donc n'avait aucune raison d'ouvrir un
 * compte pour en tenir une. C'est la decision de Tristan du 2026-08-11 : *« sinon les gens ne
 * viendraient pas si on tait tout »*.
 */
export function AddToList({
  seriesId,
  title,
  posterPath,
}: {
  readonly seriesId: string;
  /**
   * Le titre sous les yeux au moment du rangement — il part avec la ligne.
   *
   * ⚠️ **Sans lui, la liste ne sait pas se nommer chez les autres** : la carte resolvait ses
   * vignettes depuis le journal du lecteur, donc affichait « Tracked series » pour toute
   * serie qu'il ne suit pas. Voir `020_list_items_titre.sql` et `ListEntry`.
   */
  readonly title: string;
  readonly posterPath?: string;
}) {
  const { t, locale } = useT();
  const { configured, ready, account } = useAuth();

  const [lists, setLists] = useState<readonly SeriesList[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  // ⚠️ Voir `useSocialRead` : sans lui, « vous n'avez pas encore de liste » s'affichait
  // aussi quand la lecture avait echoue — et le lien invitait alors a en creer une
  // deuxieme par-dessus la premiere.
  const { social, unreadable } = useSocialRead();
  const userId = account?.userId;
  const subject = journalKey(seriesId);

  useEffect(() => {
    let alive = true;
    if (userId === undefined) {
      setLoaded(true);
      return;
    }
    if (social === undefined) return;
    void social.listsBy(userId).then((rows) => {
      if (!alive) return;
      setLists(rows);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, social]);

  const add = useCallback(
    async (slug: string) => {
      if (userId === undefined) return;
      if (social === undefined) return;
      // ⚠️ L'ajout est **idempotent** cote base (`ignore-duplicates` — la cle *est* le fait
      // entier) : cliquer deux fois ne remonte pas une erreur de cle dupliquee pour un geste
      // sans consequence. Corollaire : le second clic n'ecrit pas non plus l'instantane.
      if (
        await social.addToList(userId, slug, subject, {
          title,
          ...(posterPath !== undefined ? { posterPath } : {}),
        })
      ) {
        setAdded((current) => new Set([...current, slug]));
      }
    },
    [userId, social, subject, title, posterPath],
  );

  // Tant qu'on ne sait pas, on ne dit rien — la seule retenue qui reste ici.
  if (!configured || !ready || !loaded) return null;

  // 🔴 **C'etait `return null`, et c'etait la regle citee en tete de ce fichier.** Sur toutes
  // les fiches series, un visiteur sans compte ne voyait donc *aucune trace* que les listes
  // existent — et n'avait par consequent aucune raison d'en ouvrir un. Une porte fermee qu'on
  // ne voit pas n'est pas une porte, c'est un mur.
  //
  // ⚠️ Une ligne, pas un encart : la fiche serie est une page de consultation, et une
  // invitation a s'inscrire en pleine page y serait le bandeau que tout le monde ferme. Le
  // geste est nomme, la condition est dite, le chemin est cliquable — rien de plus.
  if (userId === undefined) {
    return (
      <p className="meta">
        {t('addToList.locked')}{' '}
        <Link className="tap-line underline hover:text-(--color-volt)" href={pathIn('/compte', locale)}>
          {t('addToList.signIn')}
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('addToList.label')}
      </button>

      {open ? (
        lists.length === 0 ? (
          // On ne propose pas de creer une liste ici : ce serait un second formulaire a tenir
          // d'accord avec celui de `/listes`. Un lien y mene.
          <p className="meta" {...(unreadable ? { role: 'status' as const } : {})}>
            {t(unreadable ? 'read.failed' : 'addToList.none')}{' '}
            <Link className="tap-line underline hover:text-(--color-volt)" href={pathIn('/listes', locale)}>
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

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { buildLibrary } from '@/src/domain/library';
import { nextAfter } from '@/src/domain/remaining';
import { parseJournalKey } from '@/src/domain/journal';
import { pathIn, seriesPath } from '@/lib/routes';
import { Icon } from '@/app/components/Icon';
import type { Locale } from '@/lib/i18n';

/**
 * Combien de series le volet propose d'avancer.
 *
 * ⚠️ Cinq, et pas la bibliotheque entiere : ce volet est un **raccourci**, pas une page. Au
 * dela, on ne choisit plus, on cherche — et chercher a sa place `/moi`, qui range quarante
 * series avec ses filtres. La derniere ligne y mene.
 */
const AT_MOST = 5;

/**
 * « J'ai vu… » — la seule action de l'en-tete.
 *
 * ## 🔴 D12 : sept liens de navigation, une recherche, et rien pour FAIRE quelque chose
 *
 * Releve le 2026-08-16. Letterboxd garde un bouton vert « + LOG » sur toutes ses pages, et
 * c'est le geste central de son produit. Ici le geste central est celui de TV Time — *« j'ai
 * vu le suivant »* — et il n'existait qu'a deux endroits : la bande de reprise de l'accueil
 * (une seule serie) et les vignettes de `/moi`. Depuis une fiche de serie, depuis une
 * recherche, depuis un profil, avancer d'un episode demandait de revenir en arriere.
 *
 * ## Pourquoi ce n'est PAS la recherche deguisee
 *
 * La reponse facile etait un bouton « Noter une serie » qui ouvre le champ de recherche. Ca
 * n'aurait rien ajoute : chercher une serie et noter une serie menent a la meme page, donc ce
 * bouton aurait double celui d'a cote. Ce volet fait ce que la recherche ne peut pas faire —
 * **ecrire dans le journal sans quitter la page**.
 *
 * ## ⚠️ Il marche sans compte, et c'est le point
 *
 * Le journal vit dans le navigateur : ce volet lit `buildLibrary` et ecrit par `setPosition`,
 * sans un seul appel reseau. C'est la seule action du produit qui n'a besoin de rien — et
 * l'en-tete est exactement l'endroit ou ca doit se voir.
 *
 * ## ⚠️ Le bouton nomme l'episode
 *
 * « J'ai vu S3E8 », jamais « suivant » : *un tracker qui avance la mauvaise chose est pire
 * qu'un tracker qu'on n'utilise pas*, et c'est la regle que `ResumeStrip` a posee le
 * 2026-08-16 pour le meme geste. Une serie dont l'instantane ne porte pas le decoupage
 * (`seasonSizes`) n'a donc **pas** de bouton : elle garde son lien vers la fiche. Un bouton
 * qui devine est un bouton qui se trompe.
 *
 * ## Un volet, pas un `role="menu"`
 *
 * Meme patron que `AccountMenu`, et pour les memes raisons ecrites la-bas : divulgation,
 * `Escape` qui rend le focus, clic dehors, fermeture au changement de page.
 */
export function WatchMenu({ locale }: { readonly locale: Locale }) {
  const { t } = useT();
  const { journal, ready, setPosition } = useJournal();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  /**
   * Ce qu'on peut avancer, dans l'ordre ou la bibliotheque le propose deja.
   *
   * ⚠️ `useMemo` sur le journal : cet en-tete est sur toutes les pages et se rend a chaque
   * navigation. `buildLibrary` traverse toutes les entrees — le rejouer a chaque rendu est
   * exactement la faute que `Lists.tsx` a payee sur `orderLists`, en reconstruisant un
   * collateur a chaque touche tapee.
   */
  const rows = useMemo(() => {
    const library = buildLibrary(journal);
    // « Ce qui revient » d'abord, puis « ce que j'avais commence » : le meme ordre que
    // `nextToResume`, qui est celui de l'urgence.
    return [...library.returning, ...library.resuming]
      .flatMap((item) => {
        const parsed = parseJournalKey(item.key);
        const sizes = item.snapshot?.seasonSizes;
        if (parsed === undefined) return [];
        return [
          {
            key: item.key,
            id: parsed.providerId,
            title: item.snapshot?.title ?? t('resume.yourSeries'),
            next: sizes === undefined ? undefined : nextAfter(sizes, item.entry.position),
          },
        ];
      })
      .slice(0, AT_MOST);
  }, [journal, t]);

  // Le volet ne survit pas a la page : l'en-tete est le meme noeud d'une page a l'autre.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      if (box.current?.contains(event.target as Node) === true) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // Tant que le journal n'est pas lu, le bouton mentirait sur ce qu'il contient : il dirait
  // « rien a avancer » a quelqu'un qui suit quarante series. Meme silence que partout — celui
  // de ce qu'on ignore encore, le seul que la regle 4 autorise.
  if (!ready) return null;

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="watch-menu"
        onClick={() => setOpen((was) => !was)}
        ref={trigger}
        // ⚠️ `nav-target` comme ses voisins pour la hauteur de cible, et le seul accent de la
        // barre : c'est l'action, et une action qui ressemble a un lien n'en est pas une.
        className="nav-target flex shrink-0 items-center justify-center gap-1.5 meta-sm text-(--color-volt) hover:text-(--color-text)"
      >
        <Icon name="check" />
        <span className="hidden sm:inline">{t('advance.nav')}</span>
        <span className="sr-only sm:hidden">{t('advance.nav')}</span>
      </button>

      {open ? (
        <nav id="watch-menu" aria-label={t('advance.aria')} className="nav-menu panel">
          {rows.length === 0 ? (
            // Regle 4 : un ecran qui n'a rien a montrer dit quoi faire. Ici il y a bien une
            // issue, et elle est ailleurs — donc elle est nommee et cliquable.
            <div className="space-y-2 px-3 py-3">
              <p className="meta-sm">{t('advance.none')}</p>
              <Link className="btn btn-primary" href={pathIn('/parcourir', locale)}>
                {t('advance.browse')}
              </Link>
            </div>
          ) : (
            <ul>
              {rows.map((row) => {
                // ⚠️ Extrait dans une constante et non lu par `row.next` dans le gestionnaire :
                // TypeScript perd le retrecissement des qu'il traverse une fermeture, et
                // `row.next!` serait une affirmation la ou une verification coute une ligne.
                const next = row.next;
                return (
                  <li key={row.key} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Link
                      href={seriesPath(row.id, locale)}
                      className="min-w-0 flex-1 truncate text-sm hover:text-(--color-volt)"
                    >
                      {row.title}
                    </Link>
                    {/* Absent quand on ne connait pas le decoupage : le lien ci-contre reste,
                        et la fiche porte la grille. Voir l'en-tete de ce fichier. */}
                    {next === undefined ? null : (
                      <button
                        type="button"
                        className="btn shrink-0"
                        onClick={() =>
                          setPosition(row.key, next.seasonNumber, next.episodeNumber)
                        }
                      >
                        {t('resume.watched', {
                          s: next.seasonNumber,
                          e: next.episodeNumber,
                        })}
                      </button>
                    )}
                  </li>
                );
              })}
              {/* La sortie vers la page qui range tout : ce volet s'arrete a cinq, et sans
                  cette ligne on croirait que la bibliotheque s'y arrete aussi. */}
              <li>
                <Link className="nav-menu-item" href={pathIn('/moi', locale)}>
                  {t('advance.all')}
                </Link>
              </li>
            </ul>
          )}
        </nav>
      ) : null}
    </div>
  );
}

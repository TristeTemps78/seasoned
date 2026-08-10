'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import type { Locale } from '@/lib/i18n';

/**
 * Les faces du cube, en barre de navigation.
 *
 * ## Pourquoi quatre et pas six
 *
 * Le cube en a six, et en nomme six. Deux d'entre elles —
 * *Mes amis* et *Les listes* — **n'ont aucun contenu tant qu'il n'y a pas de comptes**.
 *
 * Les livrer en coquilles vides serait exactement ce que le document s'interdit : *« on ne
 * remplit pas une face de faux contenu »*. Et une barre dont un tiers des entrees mene a
 * « bientot » apprend surtout a ne plus cliquer dessus.
 *
 * Elles arrivent donc **avec leur lot**, quand elles auront quelque chose a montrer. Le
 * logo garde ses six faces : la marque n'a pas besoin que la navigation lui obeisse.
 *
 * ## Ce qui n'est pas une face, et pourquoi
 *
 * - **La recherche** est partout. En faire une face ajouterait un clic a l'action la plus
 *   frequente du produit.
 * - **`/convertir`** est une porte d'entree indexable, pas une piece : sa valeur entiere
 *   est d'etre trouvee depuis un moteur par les orphelins de TV Time. Dans une barre, elle
 *   occuperait une place pour un geste qu'on fait une fois dans sa vie.
 */
interface Face {
  readonly path: string;
  readonly labelKey:
    | 'face.discover'
    | 'face.library'
    | 'face.calendar'
    | 'face.tally'
    | 'face.lists'
    | 'face.friends';
}

const FACES: readonly Face[] = [
  { path: '/', labelKey: 'face.discover' },
  { path: '/moi', labelKey: 'face.library' },
  { path: '/calendrier', labelKey: 'face.calendar' },
  { path: '/bilan', labelKey: 'face.tally' },
  // ⚠️ La cinquieme face n'apparait qu'ici, et **pas avant aujourd'hui** : elle avait ete
  // ecartee le 2026-08-03 parce qu'une barre dont un tiers mene a « bientot » apprend a ne
  // plus cliquer dessus. Elle mene desormais quelque part — un ecran qui dit quoi faire
  // quand on n'a encore suivi personne, ce qui n'est pas la meme chose que « bientot ».
  { path: '/amis', labelKey: 'face.friends' },
  // La sixieme, pour la meme raison et au meme moment que la cinquieme : les listes ont
  // desormais un ecran qui fait quelque chose. **Le cube est complet** — les six faces de
  // existent enfin toutes.
  { path: '/listes', labelKey: 'face.lists' },
];

export function Faces({ locale }: { readonly locale: Locale }) {
  const { t } = useT();
  const pathname = usePathname();

  return (
    // ⚠️ Ni bordure ni conteneur propre : cette barre vit **dans** la ligne de l'en-tete
    // depuis le 2026-08-03. Deux rangees de chrome superposees repoussaient le titre de la
    // page a 270 px du haut de l'ecran — avant tout contenu, sur toutes les pages.
    <nav aria-label={t('faces.aria')} className="-mx-1 min-w-0 flex-1">
      <ul className="flex gap-1 overflow-x-auto">
        {FACES.map((face) => {
          const href = pathIn(face.path, locale);
          // Comparaison exacte : `/moi` ne doit pas s'allumer sur `/moi/quelque-chose`
          // par un `startsWith`, et la racine s'allumerait sur **tout** le site.
          const active = pathname === href;

          return (
            <li key={face.path}>
              <Link
                href={href}
                {...(active ? { 'aria-current': 'page' as const } : {})}
                className={`inline-block border-b-2 px-3 py-4 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'border-(--color-volt) text-(--color-text)'
                    : 'border-transparent text-(--color-muted) hover:text-(--color-text)'
                }`}
              >
                {t(face.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

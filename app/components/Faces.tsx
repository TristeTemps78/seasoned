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
 * Le cube en a six, et `docs/ARCHITECTURE-APP.md` §2 en nomme six. Deux d'entre elles —
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
  readonly labelKey: 'face.discover' | 'face.library' | 'face.calendar' | 'face.tally';
}

const FACES: readonly Face[] = [
  { path: '/', labelKey: 'face.discover' },
  { path: '/moi', labelKey: 'face.library' },
  { path: '/calendrier', labelKey: 'face.calendar' },
  { path: '/bilan', labelKey: 'face.tally' },
];

export function Faces({ locale }: { readonly locale: Locale }) {
  const { t } = useT();
  const pathname = usePathname();

  return (
    <nav aria-label={t('faces.aria')} className="border-b border-(--color-edge)">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
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
                className={`inline-block border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ${
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

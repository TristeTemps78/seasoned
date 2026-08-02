'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale, type Locale } from '@/lib/i18n';
import { languageLinks } from '@/lib/routes';

/**
 * Changer de langue, explicitement.
 *
 * ## Pourquoi un lien, et jamais une detection
 *
 * On pourrait deviner la langue depuis `Accept-Language` et rediriger. C'est le reflexe,
 * et c'est refuse ici pour trois raisons cumulees (detaillees dans `lib/routes.ts`) : un
 * middleware s'execute a chaque requete et casse le cache de bord — donc le budget ;
 * Googlebot explore depuis les Etats-Unis et ne verrait jamais les pages francaises ; et
 * atterrir en francais apres avoir clique sur un lien anglais est un bug du point de vue
 * de celui qui a clique.
 *
 * ## Il garde la page
 *
 * Changer de langue depuis une fiche de serie mene a **la meme fiche** dans l'autre
 * langue, pas a l'accueil. C'est la petite trahison la plus courante des sites
 * multilingues, et elle coute exactement une ligne a eviter.
 *
 * Composant client parce qu'il lui faut le chemin courant. Il ne rend rien tant qu'il n'y
 * a qu'une langue : un selecteur a un seul choix est un ornement.
 */
export function LanguagePicker() {
  const pathname = usePathname() ?? '/';

  if (SUPPORTED_LOCALES.length < 2) return null;

  // Le chemin courant porte deja son prefixe de langue ; on le retire pour retrouver le
  // chemin « nu », seul a savoir se decliner dans toutes les langues.
  const segments = pathname.split('/').filter((s) => s.length > 0);
  const first = segments[0];
  const current: Locale = isLocale(first) ? first : DEFAULT_LOCALE;
  const bare = isLocale(first) ? `/${segments.slice(1).join('/')}` : pathname;

  return (
    <nav aria-label="Language" className="flex items-center gap-2 text-xs">
      {languageLinks(bare === '/' ? '/' : bare, current).map((link) => (
        <Link
          key={link.locale}
          href={link.href}
          // `hrefLang` dit au navigateur et aux moteurs ce qu'il y a au bout du lien.
          hrefLang={link.locale}
          aria-current={link.current ? 'true' : undefined}
          className={
            link.current
              ? 'font-semibold text-(--color-text)'
              : 'text-(--color-muted) hover:text-(--color-text)'
          }
        >
          {link.locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}

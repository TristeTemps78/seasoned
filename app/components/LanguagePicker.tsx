'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
// ⚠️ Le moteur, pas `@/lib/i18n` : ce selecteur est sur **toutes** les pages, donc le
// rapatriement des deux dictionnaires y aurait ete total (8.10, `i18n-split.test.ts`).
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale, type Locale } from '@/lib/i18n/engine';
import { useT } from '@/app/i18n/LocaleProvider';
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
  const { t } = useT();
  const pathname = usePathname() ?? '/';

  if (SUPPORTED_LOCALES.length < 2) return null;

  // Le chemin courant porte deja son prefixe de langue ; on le retire pour retrouver le
  // chemin « nu », seul a savoir se decliner dans toutes les langues.
  const segments = pathname.split('/').filter((s) => s.length > 0);
  const first = segments[0];
  const current: Locale = isLocale(first) ? first : DEFAULT_LOCALE;
  const bare = isLocale(first) ? `/${segments.slice(1).join('/')}` : pathname;

  return (
    // ⚠️ Ce libelle etait ecrit en dur, en anglais, sur les deux langues. Il a survecu a
    // l'audit i18n parce que `no-hardcoded-strings` ne detecte le francais que **par ses
    // accents** : une chaine anglaise lui echappe, et le fichier le dit lui-meme.
    <nav aria-label={t('nav.language.aria')} className="flex items-center gap-2 text-xs">
      {/*
       * 🔴 **La langue courante etait un lien vers la page qu'on regarde deja.** Sur deux
       * langues, ce selecteur en affichait donc toujours un pour rien : « FR » en gras quand
       * on lisait le francais, dont le seul effet possible etait de recharger la meme page.
       *
       * Mesure du 2026-08-13, `/fr` en 375 px : le ruban des faces ne montrait **qu'un**
       * libelle entier sur six (« Decouvrir »), 404 px caches sur 625. Les deux liens de
       * langue prenaient 56 px de cette ligne, dont la moitie ne menait nulle part. On garde
       * ceux vers lesquels on peut aller — la langue courante est deja dite par `<html lang>`,
       * par l'URL et par la page elle-meme.
       *
       * ⚠️ Le filtre est sur `current`, pas sur un index : le jour ou une troisieme langue
       * arrive, il en reste deux et la regle tient toujours.
       */}
      {languageLinks(bare === '/' ? '/' : bare, current)
        .filter((link) => !link.current)
        .map((link) => (
          <Link
            key={link.locale}
            href={link.href}
            // `hrefLang` dit au navigateur et aux moteurs ce qu'il y a au bout du lien.
            hrefLang={link.locale}
            // ⚠️ `.nav-target` : « FR » et « EN » faisaient 15 et 16 px de cote, mesures le
            // 2026-08-13. Deux mots de deux lettres n'ont pas de cible naturelle — il faut la
            // leur donner, comme a l'icone du compte juste a cote.
            className="nav-target inline-flex items-center justify-center text-(--color-muted) hover:text-(--color-text)"
          >
            {link.locale.toUpperCase()}
          </Link>
        ))}
    </nav>
  );
}

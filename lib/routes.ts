/**
 * Les adresses, et leurs equivalents dans les autres langues.
 *
 * ## La decision qui structure ce module : l'anglais n'a pas de prefixe
 *
 * `/serie/1396` sert l'anglais, `/fr/serie/1396` le francais. La symetrie (`/en/…` et
 * `/fr/…`) serait plus elegante a lire, et **casserait toutes les URL deja indexees** —
 * le site est en ligne depuis le 2026-08-01 avec un sitemap soumis. Le SEO etant le canal
 * d'acquisition n°1, sacrifier l'indexation acquise pour une symetrie de code serait payer
 * tres cher un confort de lecture. L'asymetrie est le prix de la continuite.
 *
 * ## ⛔ Ce que ce module ne fera jamais : deviner
 *
 * Aucune redirection selon `Accept-Language`. C'est le reflexe naturel et c'est le mauvais
 * choix, pour trois raisons qui se cumulent :
 *
 * 1. **Le cache.** Un middleware s'execute a *chaque* requete, y compris celles que le CDN
 *    servirait sans nous : une invocation facturee par visite, soit exactement le cout par
 *    utilisateur que `ROADMAP.md` §1.4 interdit.
 * 2. **Le referencement.** Googlebot explore majoritairement depuis les Etats-Unis avec un
 *    `Accept-Language` anglais. Redirige, il pourrait ne **jamais** voir les pages
 *    francaises : on aurait traduit pour un moteur qui l'ignorerait.
 * 3. **L'utilisateur.** Cliquer sur un lien anglais partage par quelqu'un et atterrir en
 *    francais est un bug, pas une attention.
 *
 * Les adresses sont explicites, et changer de langue est **un lien qu'on clique**.
 *
 * Module pur : aucun reseau, aucune horloge, aucun acces a la requete. Testable seul.
 */

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeTag, type Locale } from './i18n';

/** Prefixe d'URL d'une langue. Vide pour la langue par defaut — voir en tete de module. */
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

/**
 * Chemin d'une page, dans une langue.
 *
 * @param path chemin **sans** prefixe de langue, commencant par `/` (`/serie/1396`).
 */
export function pathIn(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  // La racine est un cas a part : `/fr/` avec une barre finale et `/fr` sont deux URL
  // pour une meme page, et un moteur peut les compter deux fois.
  if (clean === '/') return localePrefix(locale) === '' ? '/' : localePrefix(locale);
  return `${localePrefix(locale)}${clean}`;
}

/** Chemin d'une page serie. Le seul endroit qui connaisse cette forme d'URL. */
export function seriesPath(id: string, locale: Locale = DEFAULT_LOCALE): string {
  return pathIn(`/serie/${id}`, locale);
}

/**
 * Le bloc `alternates` d'une page, pret pour les metadonnees de Next.
 *
 * ## Pourquoi chaque version se declare **elle-meme**
 *
 * Une declaration `hreflang` doit etre **reciproque et auto-referente** : chaque version
 * liste toutes les versions, y compris la sienne. Une declaration non reciproque est
 * purement et simplement **ignoree** par Google — et c'est l'erreur classique, parce
 * qu'elle est silencieuse : la balise est presente, elle a l'air juste, elle ne sert a
 * rien. C'est exactement la forme d'echec que le projet a deja rencontree deux fois
 * (« auditer le resultat, jamais l'intention »).
 *
 * `x-default` designe la version servie a qui ne correspond a aucune langue declaree.
 * C'est l'anglais, pour la meme raison qu'il est la langue par defaut.
 *
 * @param path chemin sans prefixe de langue.
 * @param locale la langue de **cette** page — celle qui portera l'URL canonique.
 */
export function alternatesFor(
  path: string,
  locale: Locale = DEFAULT_LOCALE,
): {
  readonly canonical: string;
  readonly languages: Readonly<Record<string, string>>;
} {
  const languages: Record<string, string> = {};
  for (const other of SUPPORTED_LOCALES) {
    // La cle est l'etiquette complete (`en-US`), plus precise que la seule langue et
    // acceptee partout.
    languages[localeTag(other)] = pathIn(path, other);
  }
  languages['x-default'] = pathIn(path, DEFAULT_LOCALE);

  return { canonical: pathIn(path, locale), languages };
}

/**
 * La meme page dans l'autre langue — de quoi dessiner le selecteur.
 *
 * Rend toutes les langues, celle en cours comprise : un selecteur qui masque la langue
 * courante ne dit pas dans quelle langue on est.
 */
export function languageLinks(
  path: string,
  current: Locale,
): readonly { readonly locale: Locale; readonly href: string; readonly current: boolean }[] {
  return SUPPORTED_LOCALES.map((locale) => ({
    locale,
    href: pathIn(path, locale),
    current: locale === current,
  }));
}

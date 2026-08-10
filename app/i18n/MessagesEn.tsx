'use client';

import { EN } from '@/lib/i18n/en';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';

/**
 * L'anglais, et **rien d'autre**, dans le paquet de la route anglaise (8.10).
 *
 * ## Pourquoi un fichier par langue plutot qu'un `locale === 'fr' ? …`
 *
 * Parce qu'un `import` statique ne se choisit pas a l'execution : les deux branches d'un
 * ternaire sont dans le paquet, meme celle qui ne s'execute jamais. Seule la **portee** d'un
 * import decide de ce qui est telecharge — et cette portee, en Next, est la route.
 *
 * `app/(site)/layout.tsx` importe celui-ci, `app/(fr)/layout.tsx` importe l'autre, et
 * `SiteChrome` n'en connait aucun : il recoit le composant en prop. C'est ce qui garde une
 * seule enveloppe pour les deux langues sans remettre les deux dictionnaires dans les deux
 * paquets.
 *
 * ⚠️ **Ne rien mettre d'autre ici.** Ce module existe pour etre le seul endroit d'ou l'anglais
 * est joignable ; tout ce qu'on y ajouterait deviendrait, lui aussi, propre a une langue.
 */
export function MessagesEn({ children }: { readonly children: React.ReactNode }) {
  return (
    <LocaleProvider locale="en" messages={EN}>
      {children}
    </LocaleProvider>
  );
}

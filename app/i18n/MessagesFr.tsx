'use client';

import { FR } from '@/lib/i18n/fr';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';

/** Le francais, et rien d'autre, dans le paquet de `/fr`. Voir `MessagesEn.tsx`. */
export function MessagesFr({ children }: { readonly children: React.ReactNode }) {
  return (
    <LocaleProvider locale="fr" messages={FR}>
      {children}
    </LocaleProvider>
  );
}

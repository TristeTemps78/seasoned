import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Timeline } from '@/app/components/Timeline';

/**
 * Le journal date.
 *
 * Statique comme `/moi`, `/bilan` et `/calendrier` : le HTML est mis en cache au bord et
 * partage entre tous les visiteurs, donc **aucun composant serveur ne lit de journal**.
 * Tout le contenu de cette page arrive cote navigateur.
 *
 * ⚠️ Le repertoire `app/journal/` existe deja — il porte le store, pas une route (aucun
 * `page.tsx`). Les deux repondent bien a l'URL `/journal` sans se marcher dessus, et c'est
 * le mot juste des deux cotes : ce qu'on tient, et ce qui le range.
 */
export const dynamic = 'force-static';

export function journalMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'timeline.title'),
    // Vide pour un robot : le contenu vit dans le journal du visiteur, pas dans le HTML.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = journalMetadata(DEFAULT_LOCALE);

export function JournalView() {
  return <Timeline />;
}

export default function JournalPage() {
  return <JournalView />;
}

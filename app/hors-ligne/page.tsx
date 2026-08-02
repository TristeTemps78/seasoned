import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * La page servie quand il n'y a plus de reseau et rien en cache.
 *
 * Elle dit surtout une chose utile : **votre bibliotheque, elle, fonctionne**. Le
 * journal vit dans le navigateur, donc `/moi` s'affiche entierement hors ligne des
 * lors que la page a ete visitee une fois. C'est le seul endroit du site dont on peut
 * promettre cela, et c'est exactement ce qu'on attend d'une application installee.
 */
export const metadata: Metadata = {
  title: 'Hors ligne',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Pas de réseau</h1>
      <p className="leading-relaxed text-(--color-muted)">
        Le catalogue a besoin d’une connexion. Votre bibliothèque, elle, est gardée dans
        ce navigateur&nbsp;: elle reste consultable.
      </p>
      <Link
        href="/moi"
        className="inline-block rounded-md border border-(--color-edge) bg-(--color-surface) px-4 py-2 text-sm hover:border-(--color-muted)"
      >
        Ouvrir ma bibliothèque
      </Link>
    </div>
  );
}

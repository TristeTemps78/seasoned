import type { Metadata } from 'next';
import Link from 'next/link';
import { TMDB_ATTRIBUTION } from '@/src/catalog/provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'seasoned — est-ce que ça vaut le coup ?',
    template: '%s — seasoned',
  },
  description:
    'Où en est une série, combien de temps elle demande, et jusqu’où elle reste bonne.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-(--color-edge)">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-baseline gap-4">
            <Link href="/" className="font-semibold tracking-tight">
              seasoned
            </Link>
            <span className="text-sm text-(--color-muted)">
              est-ce que ça vaut le coup&nbsp;?
            </span>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>

        <footer className="border-t border-(--color-edge) mt-12">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-(--color-muted) space-y-1">
            {/* Obligation contractuelle TMDB, pas un choix de mise en page :
                le texte doit accompagner toute donnee TMDB affichee. */}
            <p>{TMDB_ATTRIBUTION}</p>
            <p>
              Ce produit utilise l’API TMDB sans être approuvé ni certifié par TMDB.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

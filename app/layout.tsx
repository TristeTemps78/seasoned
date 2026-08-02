import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { TMDB_ATTRIBUTION } from '@/src/catalog/provider';
import { siteUrl } from '@/lib/site';
import { ServiceWorker } from '@/app/components/ServiceWorker';
import { DataSafety } from '@/app/components/DataSafety';
import './globals.css';

const DESCRIPTION =
  'Où en est une série, combien de temps elle demande, et jusqu’où elle reste bonne.';

export const metadata: Metadata = {
  // `metadataBase` rend absolues les URL relatives des pages — sans lui, les URL
  // canoniques et les images de partage sortent brisees.
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'seasoned — est-ce que ça vaut le coup ?',
    template: '%s — seasoned',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'seasoned',
    locale: 'fr_FR',
    title: 'seasoned — est-ce que ça vaut le coup ?',
    description: DESCRIPTION,
  },
  twitter: { card: 'summary' },

  // iOS n'a jamais lu le manifeste : il lui faut ses propres balises, sinon
  // « Sur l'écran d'accueil » produit un marque-page, pas une application. C'est la
  // moitie de la promesse multiplateforme (A8), et elle tient en trois lignes.
  appleWebApp: {
    capable: true,
    title: 'seasoned',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Next 16 n'emet plus que le nom standardise `mobile-web-app-capable` — verifie
  // dans le HTML servi. Les iPhone anterieurs a iOS 16.4, qui ne lisent pas le
  // manifeste, ne connaissent que l'ancien nom : sans lui, « Sur l'ecran d'accueil »
  // y ouvre une fenetre de navigateur au lieu d'une application.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

/**
 * Couleur de la barre systeme quand l'application est installee.
 *
 * Doit valoir `--color-ink` : sans elle, une bande blanche encadre l'application sur
 * Android, ce qui la fait immediatement lire comme un site ouvert dans un navigateur.
 */
export const viewport: Viewport = {
  themeColor: '#0f1115',
  colorScheme: 'dark',
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
            <span className="hidden text-sm text-(--color-muted) sm:inline">
              est-ce que ça vaut le coup&nbsp;?
            </span>
            {/* Le seul lien permanent vers ce que le produit retient de vous. Sans
                lui, la bibliotheque n'existe que pour qui connait son adresse. */}
            <Link
              href="/moi"
              className="ml-auto text-sm text-(--color-muted) hover:text-(--color-text)"
            >
              Ma bibliothèque
            </Link>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
          {/* Au-dessus du contenu, et sur toutes les pages : le risque de perte ne
              depend pas de l'endroit ou l'on se trouve. Ne rend rien tant qu'il n'y a
              rien a perdre, ni si l'application est deja installee. */}
          <DataSafety />
          {children}
        </main>

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

        <ServiceWorker />
      </body>
    </html>
  );
}

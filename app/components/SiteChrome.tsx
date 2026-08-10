import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { TMDB_ATTRIBUTION } from '@/src/catalog/provider';
import { PRODUCT_NAME, siteUrl } from '@/lib/site';
import { ServiceWorker } from '@/app/components/ServiceWorker';
import { DataSafety } from '@/app/components/DataSafety';
import { PublishActivity } from '@/app/components/PublishActivity';
import { LanguagePicker } from '@/app/components/LanguagePicker';
import { MyFace } from '@/app/components/MyFace';
import { Faces } from '@/app/components/Faces';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';
import { AuthProvider } from '@/app/auth/AuthProvider';
import { JournalSync } from '@/app/components/JournalSync';
import { localeTag, t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';
import { instrumentSans, plexMono } from '@/app/fonts';

/**
 * L'enveloppe du site — en-tete, contenu, pied de page — dans une langue.
 *
 * ## Pourquoi elle est ici et non dans un `layout.tsx`
 *
 * Parce qu'il y a **deux** dispositions racines, une par langue, et qu'un seul element
 * `<html>` peut exister par page. L'attribut `lang` doit dire la langue **reellement
 * servie** : `/fr` a longtemps rendu du francais en s'annoncant `lang="en"` — ce qui fait
 * lire le francais avec la phonetique anglaise par un lecteur d'ecran, et brouille le
 * signal envoye aux moteurs.
 *
 * Ce defaut ne se voyait ni au typage, ni aux tests, ni au build : uniquement dans le
 * HTML servi. C'est la troisieme fois que ce projet le constate — **auditer le resultat,
 * jamais l'intention**.
 *
 * Les deux dispositions racines n'ont donc chacune que trois lignes, et tout ce qui
 * pourrait diverger entre elles vit ici.
 *
 * ## Le fournisseur de langue enveloppe tout, et ne coute rien
 *
 * `LocaleProvider` est un composant client, mais il recoit `children` **en prop** : Next
 * rend alors les enfants sur le serveur et les insere tels quels. Envelopper tout l'arbre
 * ne le fait donc pas basculer cote client — c'est le seul detail qui rend cette solution
 * acceptable ici, et il merite d'etre ecrit parce qu'il n'est pas evident.
 */
export function SiteChrome({ locale, children }: {
  readonly locale: Locale;
  readonly children: React.ReactNode;
}) {
  return (
    // Les deux variables de police vivent sur `<html>` : c'est le seul element commun aux
    // deux dispositions racines, donc le seul endroit ou les poser une fois pour les deux
    // langues. Les classes de `next/font` n'ont pas d'effet visuel par elles-memes — elles
    // declarent `--font-voltface-*`, que `@theme` branche sur `font-sans` et `font-mono`.
    <html lang={locale} className={`${instrumentSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen flex flex-col">
      <LocaleProvider locale={locale}>
        {/* Même patron que `LocaleProvider` : composant client qui reçoit `children` en
            prop, donc l'arbre reste rendu par le serveur et les pages restent statiques.
            La session est lue dans un `useEffect`, jamais au rendu. */}
        <AuthProvider>
        {/* Le liseré supérieur est la seule signature permanente de la direction
            artistique : un arc électrique en haut de chaque page, et rien d'autre qui
            brille tant qu'on n'interagit pas. */}
        <header className="border-b border-(--color-edge) bg-(--color-ink)/70 backdrop-blur-sm sticky top-0 z-20 edge-lit">
          {/* ⚠️ **Une seule rangee**, depuis le 2026-08-03. La marque et les faces
              vivaient sur deux lignes empilees : avec le bandeau de sauvegarde, le titre
              de la page commencait a 270 px du haut, sur toutes les pages. Deux rangees de
              chrome avant le moindre contenu, c'est ce qui fait qu'un produit ressemble a
              un site et pas a une application. */}
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4">
            {/* Le logo ramene a l'accueil **de la langue courante** : renvoyer un
                lecteur francais vers l'accueil anglais serait le sortir de sa langue
                sans qu'il l'ait demande. */}
            <Link
              href={pathIn('/', locale)}
              // ⚠️ Cachee sous 640 px, et ce n'est pas un sacrifice : le premier onglet mene
              // exactement au meme endroit. Sur un telephone, la garder volait au ruban
              // d'onglets la moitie de la largeur qu'il lui reste.
              // ⚠️ Le cube reste visible sous 640 px, le mot non. Le nom en toutes lettres
              // volait au ruban d'onglets la moitie de sa largeur ; un carre de 26 px ne
              // coute rien, et c'est justement sur un telephone qu'on a besoin de savoir
              // d'un coup d'oeil ou l'on est.
              className="flex shrink-0 items-center gap-2 font-semibold tracking-[0.18em] uppercase text-(--color-text) transition-colors hover:text-(--color-volt)"
            >
              {/* 🔴 `MyFace` et non `Mark` : cette enveloppe est un composant **serveur**,
                  qui ne peut pas lire le journal (`no-journal-on-server`). La coquille
                  cliente est ce qui permet a la marque de porter la face sans qu'un seul
                  ecran ait a etre modifie — elle est deja sur toutes les pages. */}
              <MyFace />
              <span className="hidden sm:inline">{PRODUCT_NAME}</span>
            </Link>

            {/* Les faces du cube. Dans l'en-tete et non en bas d'ecran : le site est
                d'abord visite depuis un moteur de recherche, ou une barre flottante
                masquerait du contenu indexe sans rien apporter. */}
            <Faces locale={locale} />

            {/* ⚠️ Ici et **pas** dans la barre de faces : une face repond a une question
                qu'on se pose a un moment de la journee, et « ou en est mon compte » n'en
                est pas une. Un reglage se range avec les reglages. */}
            <Link
              href={pathIn('/compte', locale)}
              className="shrink-0 text-xs text-(--color-muted) hover:text-(--color-text)"
            >
              {t(locale, 'account.nav')}
            </Link>
            <LanguagePicker />
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
          {/* Au-dessus du contenu, et sur toutes les pages : le risque de perte ne
              depend pas de l'endroit ou l'on se trouve. Ne rend rien tant qu'il n'y a
              rien a perdre, ni si l'application est deja installee. */}
          <DataSafety />
          {/* Invisible, sans rendu : il pousse l'activite publiable depuis N'IMPORTE
              quelle page. Avant, elle ne partait que depuis `/amis` — terminer une serie
              sur sa fiche sans y retourner laissait le fait dans le navigateur pour
              toujours. */}
          <PublishActivity />
          {children}
        </main>

        <footer className="border-t border-(--color-edge) mt-12">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-(--color-muted) space-y-1">
            {/* Un lien depuis chaque page, et pas seulement depuis la bibliotheque :
                ceux qui cherchent ou remettre leur historique n'ont, par definition,
                pas encore de bibliotheque. Et un moteur ne trouve une page que si
                quelque chose y mene — c'est la lecon de l'audit SEO du 2026-08-01. */}
            <p>
              <Link href={pathIn('/convertir', locale)} className="hover:text-(--color-text)">
                {t(locale, 'nav.convert')}
              </Link>
            </p>
            {/* Les trois pages que la loi exige d'atteindre. Dans le pied de page et
                sur **toutes** les pages : une obligation legale qui ne serait accessible
                que depuis une seule vue n'est pas accessible.
                `/regles` s'y ajoute avec 5.0a — c'est la page qu'on cherche quand on veut
                signaler quelque chose, et une voie de signalement introuvable n'est pas
                une voie de signalement. */}
            <p className="flex flex-wrap gap-x-4">
              <Link href={pathIn('/mentions', locale)} className="hover:text-(--color-text)">
                {t(locale, 'legal.title')}
              </Link>
              <Link
                href={pathIn('/confidentialite', locale)}
                className="hover:text-(--color-text)"
              >
                {t(locale, 'privacy.title')}
              </Link>
              <Link href={pathIn('/regles', locale)} className="hover:text-(--color-text)">
                {t(locale, 'rules.title')}
              </Link>
            </p>
            {/* Obligation contractuelle TMDB, pas un choix de mise en page :
                le texte doit accompagner toute donnee TMDB affichee. */}
            <p>{TMDB_ATTRIBUTION}</p>
            <p>{t(locale, 'footer.disclaimer')}</p>
          </div>
        </footer>

        <ServiceWorker />
        {/* Relie le compte a son journal, et pose la question de l'appareil partage. Rend
            `null` tant qu'il n'y a rien a arbitrer. */}
        <JournalSync />
        </AuthProvider>
      </LocaleProvider>
      </body>
    </html>
  );
}

/** Les metadonnees communes, dans une langue. */
export function siteMetadata(locale: Locale): Metadata {
  const description = t(locale, 'meta.description');
  const title = `${PRODUCT_NAME} — ${t(locale, 'nav.tagline')}`;

  return {
    // `metadataBase` rend absolues les URL relatives des pages — sans lui, les URL
    // canoniques et les images de partage sortent brisees.
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s — ${PRODUCT_NAME}` },
    description,
    openGraph: {
      type: 'website',
      siteName: PRODUCT_NAME,
      locale: localeTag(locale).replace('-', '_'),
      title,
      description,
    },
    twitter: { card: 'summary' },

    // iOS n'a jamais lu le manifeste : il lui faut ses propres balises, sinon
    // « Sur l'écran d'accueil » produit un marque-page, pas une application. C'est la
    // moitie de la promesse multiplateforme (A8), et elle tient en trois lignes.
    appleWebApp: {
      capable: true,
      title: PRODUCT_NAME,
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
}

/**
 * Couleur de la barre systeme quand l'application est installee.
 *
 * Doit valoir `--color-ink` : sans elle, une bande blanche encadre l'application sur
 * Android, ce qui la fait immediatement lire comme un site ouvert dans un navigateur.
 */
export const siteViewport: Viewport = {
  // ⚠️ Doit suivre `--color-ink` de `globals.css`. Restee sur l'ancienne teinte lors
  // du passage a la DA cyberpunk : l'application installee encadrait un fond qui
  // n'existait plus nulle part ailleurs.
  themeColor: '#08090e',
  colorScheme: 'dark',
};

import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { TMDB_ATTRIBUTION } from '@/src/catalog/provider';
import { PRODUCT_NAME, siteUrl } from '@/lib/site';
import { ServiceWorker } from '@/app/components/ServiceWorker';
import { DataSafety } from '@/app/components/DataSafety';
import { PublishActivity } from '@/app/components/PublishActivity';
import { LanguagePicker } from '@/app/components/LanguagePicker';
import { MyFace } from '@/app/components/MyFace';
import { FaceSwitch } from '@/app/components/FaceSwitch';
import { Faces } from '@/app/components/Faces';
import { AccountMenu } from '@/app/components/AccountMenu';
import { SearchForm } from '@/app/components/SearchForm';
import { Icon } from '@/app/components/Icon';
import { AuthProvider } from '@/app/auth/AuthProvider';
import { JournalSync } from '@/app/components/JournalSync';
import { localeTag, t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';
import { instrumentSans, newsreader, plexMono } from '@/app/fonts';

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
 * `Messages` est un composant client, mais il recoit `children` **en prop** : Next
 * rend alors les enfants sur le serveur et les insere tels quels. Envelopper tout l'arbre
 * ne le fait donc pas basculer cote client — c'est le seul detail qui rend cette solution
 * acceptable ici, et il merite d'etre ecrit parce qu'il n'est pas evident.
 */
export function SiteChrome({ locale, Messages, children }: {
  readonly locale: Locale;
  /**
   * Le fournisseur de phrases de **cette** langue (8.10).
   *
   * ⚠️ **Une prop et pas un `import`**, et c'est tout l'objet de 8.10 : un `import` ici
   * serait dans le paquet des deux routes, donc les deux dictionnaires y seraient aussi.
   * Chaque disposition racine importe le sien et le passe ; cette enveloppe reste unique,
   * et chaque route ne telecharge que sa langue.
   *
   * Passer un composant d'un module serveur a un autre est du JavaScript ordinaire : la
   * reference client ne se materialise qu'a l'endroit ou elle est rendue, c'est-a-dire ici.
   */
  readonly Messages: (props: { readonly children: React.ReactNode }) => React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    // Les deux variables de police vivent sur `<html>` : c'est le seul element commun aux
    // deux dispositions racines, donc le seul endroit ou les poser une fois pour les deux
    // langues. Les classes de `next/font` n'ont pas d'effet visuel par elles-memes — elles
    // declarent `--font-voltface-*`, que `@theme` branche sur `font-sans` et `font-mono`.
    <html lang={locale} className={`${instrumentSans.variable} ${newsreader.variable} ${plexMono.variable}`}>
      <body className="min-h-screen flex flex-col">
      <Messages>
        {/* Même patron que `LocaleProvider` : composant client qui reçoit `children` en
            prop, donc l'arbre reste rendu par le serveur et les pages restent statiques.
            La session est lue dans un `useEffect`, jamais au rendu. */}
        <AuthProvider>
        {/* Le liseré supérieur est la seule signature permanente de la direction
            artistique : un arc électrique en haut de chaque page, et rien d'autre qui
            brille tant qu'on n'interagit pas. */}
        {/* ⚠️ Sans l'ombre, le contenu **disparaissait** sous la barre au lieu de passer
            dessous. Le flou passe a `md` : a `sm`, une banniere restait lisible au travers
            et brouillait les onglets. */}
        {/* Le tout premier noeud focalisable de la page — voir `.skip-link`. Invisible tant
            qu'on ne tabule pas dessus, et il doit rester **avant** l'en-tete : place apres,
            il ne ferait economiser aucun des liens qu'il sert a sauter. */}
        <a href="#contenu" className="skip-link">
          {t(locale, 'nav.skip')}
        </a>
        <header className="border-b border-(--color-edge) bg-(--color-ink)/70 backdrop-blur-md shadow-[0_0.5rem_1.5rem_-0.5rem_rgb(0_0_0/0.8)] sticky top-0 z-20 edge-lit">
          {/* ⚠️ **Une seule rangee**, depuis le 2026-08-03. La marque et les faces
              vivaient sur deux lignes empilees : avec le bandeau de sauvegarde, le titre
              de la page commencait a 270 px du haut, sur toutes les pages. Deux rangees de
              chrome avant le moindre contenu, c'est ce qui fait qu'un produit ressemble a
              un site et pas a une application. */}
          {/* ⚠️ `max-w-7xl` et non `max-w-5xl` : la barre doit s'aligner sur les grilles
              d'affiches, qui sortent desormais de la colonne de lecture (`.bleed`, 80 rem).
              Restee a 1024 px, elle laissait la marque flotter a 128 px du bord d'une
              rangee pleine largeur — le genre de decalage que tout le monde voit sans
              savoir le nommer. C'est la meme valeur que `--w-bleed`, et c'est ce qui les
              tient ensemble. */}
          {/* ⚠️ `gap-2` sous 640 px, et c'est la contrepartie exacte du correctif de cible du
              2026-08-13 : porter le compte et les deux langues a 24 px de large a repris
              27 px au ruban d'onglets, qui n'en a aucun a perdre. Les trois gouttieres de
              l'en-tete en rendent 24. Meme arbitrage que le `px-2` des onglets, et pour la
              meme raison mesuree : sur un telephone, cette ligne est un budget en pixels. */}
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:gap-4">
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

            {/* 🔴 **La recherche n'etait PAS partout.** `Faces.tsx` justifie de ne pas lui
                donner d'onglet par *« la recherche est partout, en faire une face ajouterait
                un clic a l'action la plus frequente du produit »* — phrase restee vraie d'une
                version anterieure. Compte le 2026-08-16 : `SearchForm` etait monte sur **trois
                routes sur dix-huit** — l'accueil, `/recherche` et la 404. Depuis une fiche de
                serie, `/moi`, `/calendrier`, `/bilan`, `/amis` ou `/listes`, chercher demandait
                de revenir a l'accueil. C'est le meme genre de defaut que le titre des critiques
                qui annoncait un filtre inexistant : l'argument qui ecarte un onglet devient faux
                le jour ou ce qu'il invoque disparait.

                ⚠️ **Deux formes, une seule a la fois, et c'est mesure.** A 1280 px le ruban des
                faces a **311 px de libre** (six onglets = 653 px pour 964 disponibles) : un
                champ y tient sans rien voler. A 400 px il en cache deja 342 — il n'y a rien a
                prendre, donc l'icone seule, qui mene a la page ou le champ a toute la largeur.
                `hidden`/`lg:hidden` et non `sr-only` : `display: none` sort du parcours de
                tabulation, alors qu'un champ `sr-only` resterait focalisable et muet — le
                defaut exact que `a11y-hidden-controls` garde. */}
            <div className="hidden min-w-0 shrink lg:block lg:w-56">
              <SearchForm locale={locale} compact />
            </div>
            <Link
              href={pathIn('/recherche', locale)}
              className="nav-target flex shrink-0 items-center justify-center meta-sm hover:text-(--color-text) lg:hidden"
            >
              <Icon name="search" />
              <span className="sr-only">{t(locale, 'search.submit')}</span>
            </Link>

            {/* ⚠️ Ici et **pas** dans la barre de faces : une face repond a une question
                qu'on se pose a un moment de la journee, et « ou en est mon compte » n'en
                est pas une. Un reglage se range avec les reglages.

                ⚠️ Un **volet** depuis le 2026-08-16, et il garde exactement la cible du lien
                qu'il remplace (icone seule sous 640 px, mot a cote au-dela) : la barre est un
                budget en pixels, ce menu ouvre quatre destinations sans en prendre un de plus.
                Voir `AccountMenu` pour les quatre, et pour ce qu'elles avaient de commun —
                aucune porte. */}
            <AccountMenu locale={locale} />
            <LanguagePicker />
          </div>
        </header>

        {/* ⚠️ `max-w-6xl` et non `5xl` depuis le 2026-08-11 : a 1024 px, la colonne laissait
            un tiers de l'ecran vide a droite sur un moniteur large — visible sur les trois
            captures. On ne va pas plus loin : au-dela de ~1150 px, une ligne de texte cesse
            d'etre lisible, et c'est `.bleed` qui existe pour laisser sortir les grilles. */}
        {/* ⚠️ `tabIndex={-1}` avec l'ancre, et ce n'est pas decoratif : sans lui, plusieurs
            navigateurs font defiler la page jusqu'a la cible **sans y deplacer le focus**,
            donc le `Tab` suivant repart du haut de l'en-tete — le lien d'evitement paraissait
            marcher a l'oeil et ne faisait rien pour qui l'utilise vraiment. */}
        {/* ⚠️ `scroll-mt-16` mesure l'en-tete collante, elle ne l'approxime pas : sans elle,
            « Aller au contenu » amenait le haut de `main` a `top: 0` — c'est-a-dire **sous**
            les 51 px de la barre. Le lien marchait, le focus etait au bon endroit, et les
            premieres lignes restaient cachees : le defaut que le lien devait corriger,
            reproduit par son propre correctif. */}
        <main
          id="contenu"
          tabIndex={-1}
          className="flex-1 mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-8"
        >
          {/* Au-dessus du contenu, et sur toutes les pages : le risque de perte ne
              depend pas de l'endroit ou l'on se trouve. Ne rend rien tant qu'il n'y a
              rien a perdre, ni si l'application est deja installee. */}
          <DataSafety />
          {/* 9.3 — la bascule s'annonce la ou l'on se trouve, et une seule fois : la
              memoire est un champ de journal, donc elle suit d'un appareil a l'autre. Ne
              rend rien hors d'un vrai changement de face. */}
          <FaceSwitch />
          {/* Invisible, sans rendu : il pousse l'activite publiable depuis N'IMPORTE
              quelle page. Avant, elle ne partait que depuis `/amis` — terminer une serie
              sur sa fiche sans y retourner laissait le fait dans le navigateur pour
              toujours. */}
          <PublishActivity />
          {children}
        </main>

        <footer className="border-t border-(--color-edge) mt-12">
          {/* Meme largeur que l'en-tete, pour la meme raison. */}
          <div className="mx-auto max-w-7xl px-4 py-6 meta-sm space-y-1">
            {/* Un lien depuis chaque page, et pas seulement depuis la bibliotheque :
                ceux qui cherchent ou remettre leur historique n'ont, par definition,
                pas encore de bibliotheque. Et un moteur ne trouve une page que si
                quelque chose y mene — c'est la lecon de l'audit SEO du 2026-08-01. */}
            <p>
              <Link href={pathIn('/convertir', locale)} className="tap-line hover:text-(--color-text)">
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
              <Link href={pathIn('/mentions', locale)} className="tap-line hover:text-(--color-text)">
                {t(locale, 'legal.title')}
              </Link>
              <Link
                href={pathIn('/confidentialite', locale)}
                className="tap-line hover:text-(--color-text)"
              >
                {t(locale, 'privacy.title')}
              </Link>
              <Link href={pathIn('/regles', locale)} className="tap-line hover:text-(--color-text)">
                {t(locale, 'rules.title')}
              </Link>
            </p>
            {/* Obligation contractuelle TMDB, pas un choix de mise en page :
                le texte doit accompagner toute donnee TMDB affichee.

                🔴 **Elle s'affichait deux fois, sur toutes les pages du site.** Vu a
                l'ecran le 2026-08-12 : cette ligne etait suivie de `footer.disclaimer`,
                qui est la *traduction de la meme obligation*. En anglais les deux chaines
                sont identiques au caractere pres (`lib/i18n/en.ts`), donc le visiteur
                lisait deux fois la meme phrase ; en francais, une fois en francais puis une
                fois en anglais. La clef traduite est retiree : la mention TMDB est
                contractuelle et **verbatim en anglais**, exactement comme
                `JUSTWATCH_ATTRIBUTION` — la traduire etait le defaut, pas l'oubli. */}
            <p>{TMDB_ATTRIBUTION}</p>
          </div>
        </footer>

        <ServiceWorker />
        {/* Relie le compte a son journal, et pose la question de l'appareil partage. Rend
            `null` tant qu'il n'y a rien a arbitrer. */}
        <JournalSync />
        </AuthProvider>
      </Messages>
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

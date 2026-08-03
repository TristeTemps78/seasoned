import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Library } from './Library';

/**
 * Ma bibliotheque.
 *
 * ## Une page personnelle qui reste statique
 *
 * Elle n'appelle **aucune API** et ne lit **aucune donnee personnelle cote serveur**.
 * Ce n'est pas une precaution de style :
 *
 *   - le HTML des pages est mis en cache au bord et **partage entre tous les
 *     visiteurs**. Le jour ou un composant serveur lit un journal, le site sert celui
 *     de quelqu'un a quelqu'un d'autre — et a cent mille utilisateurs, a grande
 *     echelle ;
 *   - une route personnelle rendue a la demande coute une invocation par visite. Ici
 *     le cout est celui d'une page statique : **zero**, quel que soit le trafic
 *     (`ROADMAP.md` §1.4).
 *
 * Tout le contenu arrive donc apres coup, dans le navigateur, depuis le journal.
 */
export const dynamic = 'force-static';

/**
 * Les metadonnees, dans une langue.
 *
 * ⚠️ Exportee pour que `/fr/moi` serve **la meme page** dans une autre langue au lieu
 * d'en entretenir une copie. Cette adresse n'existait pas : l'en-tete pointait `/moi` en
 * dur, donc un lecteur francais quittait le francais en cliquant sur sa propre
 * bibliotheque. Le francais avait une adresse, et aucun chemin n'y restait.
 */
export function libraryMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'library.title'),
    // Rien a indexer : vue d'un robot, cette page est vide par construction. La faire
    // explorer remplirait l'index de pages sans contenu et gaspillerait le budget de
    // crawl qui doit aller sur `/serie/*` (`ROADMAP.md` §0.2).
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = libraryMetadata(DEFAULT_LOCALE);

export function LibraryView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="page-title">{t(locale, 'library.title')}</h1>
        <p className="text-(--color-muted)">{t(locale, 'library.lede')}</p>
      </header>

      <Library />
    </div>
  );
}

export default function MyLibraryPage() {
  return <LibraryView locale={DEFAULT_LOCALE} />;
}

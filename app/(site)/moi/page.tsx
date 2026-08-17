import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { Library } from './Library';
import { PageHeader } from '@/app/components/PageHeader';
import { Quiz } from '@/app/components/Quiz';
import { Favorites } from '@/app/components/Favorites';
import { Feedback } from '@/app/components/Feedback';
import { FaceDiscovery } from '@/app/components/FaceDiscovery';
import { PosterRail } from '@/app/components/PosterRail';
import { discover } from '@/lib/catalog';
import { pathIn } from '@/lib/routes';

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
 *     le cout est celui d'une page statique : **zero**, quel que soit le trafic.
 *
 * Tout le contenu arrive donc apres coup, dans le navigateur, depuis le journal.
 */
export const dynamic = 'force-static';

/**
 * Un rendu par jour pour la rangee de decouverte — voir `/calendrier`.
 *
 * ⚠️ Ca ne change rien a ce qui precede : la page ne lit toujours **aucune donnee
 * personnelle cote serveur**. Ce qui se regenere est le catalogue propose a qui n'a pas
 * encore de bibliotheque, identique pour tout le monde.
 */
export const revalidate = 86_400;

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
    // crawl qui doit aller sur `/serie/*`.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = libraryMetadata(DEFAULT_LOCALE);

export async function LibraryView({ locale }: { readonly locale: Locale }) {
  // ⚠️ Le fond de catalogue **page 2** : la page 1 nourrit le bilan. Une bibliotheque vide se
  // remplit de ce qu'on a deja vu, pas de ce qui sort cette semaine — c'est la difference
  // entre « commencez par l'une d'elles » et une vitrine de nouveautes.
  const known = await discover('popular', 2, locale);

  return (
    <div className="space-y-8">
      <PageHeader title={t(locale, 'library.title')} lede={t(locale, 'library.lede')}>
        {/* La porte du journal date, et **la seule** dans la navigation principale.

            ⚠️ Le journal n'est pas une septieme face, et ce n'est pas un oubli : `Faces.tsx`
            ecrit que *le cube est complet*, et la marque du produit EST un cube. Il vit donc
            ici, sur la face dont il est le revers exact — celle-ci range par serie *ce que
            vous suivez*, celle-la range par date *ce que vous avez fait*. C'est aussi la
            place que lui donne Letterboxd : sous le profil, jamais dans la barre.

            Toujours affiche, meme sans un seul fait : la page d'arrivee dit alors quoi faire
            (regle 4), ce qu'un lien absent ne dirait pas. */}
        <p className="pt-2">
          {/* ⚠️ `.tap-line` : `.meta` seul rendait un lien de **17 px** de haut (mesure au
              navigateur), sous les 24 px de la regle du depot. */}
          <Link
            href={pathIn('/journal', locale)}
            className="meta tap-line hover:text-(--color-text)"
          >
            {t(locale, 'library.toJournal')}
          </Link>
        </p>
      </PageHeader>

      {/* 🔴 **Le chemin de retour, et il vient en premier.** Les coeurs et les reponses
          n'existaient que sur la fiche de la serie commentee : l'auteur d'une critique n'y
          repasse pas, donc `015` et `024` ecrivaient dans le vide pour la seule personne a
          qui ils s'adressent. C'est ce que le releve du 2026-08-17 appelait le plus cher des
          trois manques.

          En tete parce que c'est **ce pour quoi on revient** : ce qui a bouge depuis la
          derniere visite passe avant ce qu'on a soi-meme range. Se tait entierement tant que
          rien n'est arrive — voir le composant. */}
      <Feedback />

      {/* La carte de visite, **avant** tout le reste : c'est la seule chose de cette page
          qui dise qui vous etes plutot que ce que vous avez regarde. Toujours rendue, meme
          vide — quatre emplacements qui disent quoi y mettre apprennent que la chose
          existe, un bloc absent n'apprend rien (regle 4). */}
      <Favorites />

      {/* Puis le rendez-vous, qui doit se voir en arrivant. Se tait tout seul tant qu'il n'y
          a pas assez d'histoire pour poser une question. */}
      <Quiz />

      <Library />

      <FaceDiscovery>
        <PosterRail
          title={t(locale, 'discovery.library.title')}
          subtitle={t(locale, 'discovery.library.subtitle')}
          series={known.slice(0, 12).map((summary) => ({ summary }))}
          locale={locale}
        />
      </FaceDiscovery>
    </div>
  );
}

export default function MyLibraryPage() {
  return <LibraryView locale={DEFAULT_LOCALE} />;
}

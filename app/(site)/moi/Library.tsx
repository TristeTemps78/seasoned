'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { EmptyState } from '@/app/components/EmptyState';
import { JournalTransfer } from '@/app/components/JournalTransfer';
import { LibraryCard } from '@/app/components/LibraryCard';
import { Menu } from '@/app/components/Menu';
import { MyPlatforms } from '@/app/components/MyPlatforms';
import { MyRegions } from '@/app/components/MyRegions';
import { buildLibrary, type LibraryItem } from '@/src/domain/library';
import { tagCounts } from '@/src/domain/journal';
import { RowHeader } from '@/app/components/RowHeader';

/**
 * La bibliotheque, entierement construite dans le navigateur.
 *
 * ## Ce qu'elle repare
 *
 * Le produit se souvenait de vous **sur la page ou vous etiez, et nulle part
 * ailleurs**. Trois des cinq ressorts qui font revenir — progression visible,
 * collection, comparaison — n'avaient aucun lieu ou exister. C'est ce lieu.
 *
 * ## Ce qu'elle ne fait pas, et pourquoi
 *
 * **Aucun appel reseau.** Tout vient des instantanes deposes en visitant les pages
 * serie. Ce n'est pas une optimisation : rafraichir trente series a chaque ouverture
 * couterait, a cent mille utilisateurs, plusieurs millions d'appels par jour — au-dela
 * de ce que le fournisseur autorise et de ce que le budget supporte.
 * La contrepartie est assumee : une serie dont l'instantane a expire garde sa
 * place avec moins d'ornements, elle ne disparait jamais.
 *
 * Consequence heureuse : **cette page fonctionne hors ligne**, une fois visitee. C'est
 * ce qu'on attend d'une application installee, et c'est le seul ecran du site dont on
 * puisse le promettre.
 */
export function Library() {
  const { journal, ready, exportJournal, importJournal } = useJournal();
  const { t, tn } = useT();
  const [tag, setTag] = useState<string | undefined>(undefined);

  const tags = useMemo(() => tagCounts(journal), [journal]);

  /* Le filtre s'applique au **journal**, pas au resultat : `buildLibrary` range en quatre
     rangees selon des regles qui lui appartiennent, et refiltrer apres coup obligerait a
     les connaitre ici. Filtrer avant, c'est reutiliser le rangement tel quel (regle 3). */
  const shown = useMemo(() => {
    if (tag === undefined) return journal;
    return {
      ...journal,
      entries: Object.fromEntries(
        Object.entries(journal.entries).filter(([, e]) => e.tags?.[tag] !== undefined),
      ),
    };
  }, [journal, tag]);

  // Recalcule seulement quand le journal change : le rangement traverse toutes les
  // entrees, et il n'a aucune raison de recommencer a chaque rendu.
  const library = useMemo(() => buildLibrary(shown), [shown]);
  // ⚠️ Compte sur le journal **entier**, pas sur la vue filtree : sans ca, choisir un mot
  // qui ne rend rien afficherait « votre bibliotheque est vide » a quelqu'un qui suit
  // quarante series. Deux vides differents, deux phrases differentes.
  const total = useMemo(() => buildLibrary(journal).total, [journal]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu : annoncer « votre bibliotheque est vide » a
    // quelqu'un qui suit quarante series serait la pire premiere impression possible.
    return <div className="h-64" aria-hidden="true" />;
  }

  if (total === 0) return <EmptyLibrary />;

  return (
    <div className="space-y-12">
      {/* Le filtre par mot. Absent tant qu'aucun mot n'existe : un filtre a une seule
          option (« Tous ») est un bouton qui ne fait rien, et il apprendrait a ignorer la
          ligne le jour ou elle servira. */}
      {tags.length > 0 ? (
        // ⚠️ **Un menu et non une rangee, parce que le nombre de mots n'a aucune borne.**
        // Les mots sont tapes par le lecteur : trois aujourd'hui, quarante dans un an. Une
        // rangee de boutons tient tant qu'ils sont peu nombreux et pousse la bibliotheque
        // hors de l'ecran ensuite — c'est ce qui est arrive a `/parcourir`, mesure a 803 px
        // de commandes pour une fenetre de 812. Un menu a une hauteur fixe quel qu'en soit
        // le contenu.
        //
        // ⚠️ Le compte d'emplois (« sur 3 series ») etait un `title`, donc invisible au
        // clavier et au tactile. Il entre dans le libelle de l'option, ou tout le monde le
        // lit — c'est de la place qu'un menu a et qu'une pastille n'avait pas.
        <Menu
          id="library-tag"
          label={t('tags.filter')}
          value={tag ?? ''}
          onChange={(value) => setTag(value === '' ? undefined : value)}
          options={[
            { value: '', label: t('tags.all') },
            ...tags.map(({ tag: name, count }) => ({
              value: name,
              label: `${name} · ${tn('tags.usedOn', count, { n: count })}`,
            })),
          ]}
        />
      ) : null}

      {/* Le vide **du filtre**, qui n'est pas le vide de la bibliotheque : le geste pour en
          sortir est deja a l'ecran, juste au-dessus. Une phrase suffit.

          ⚠️ Verifie au navigateur le 2026-08-15 : **cette branche n'est pas atteignable
          aujourd'hui** — les pastilles ne listent que des mots existants, et toute entree de
          serie taguee tombe dans l'une des quatre rangees. Elle n'est pas morte pour autant :
          `tagCounts` parcourt **toutes** les entrees, la bibliotheque ne montre que les
          series (`seriesEntries`), donc un mot pose sur un film — A13 — rendra une pastille
          qui ne montre rien. C'est exactement le decalage que `seriesEntries` existe pour
          signaler, et le jour ou il arrivera il ne faudra pas afficher « votre bibliotheque
          est vide » a quelqu'un qui suit quarante series. */}
      {library.total === 0 ? (
        <EmptyState title={t('library.noTagTitle')}>{t('library.noTagBody')}</EmptyState>
      ) : null}
      {/* Meme decision que sur l'accueil : la rangee de tete repond a la question qu'on se
          pose en ouvrant l'ecran. Quatre rangees identiques ne disaient pas laquelle lire. */}
      <Row
        title={t('library.returning.title')}
        subtitle={t('library.returning.subtitle')}
        items={library.returning}
        lead
      />
      <Row
        title={t('library.resuming.title')}
        subtitle={t('library.resuming.subtitle')}
        items={library.resuming}
      />
      <Row
        title={t('library.wanted.title')}
        subtitle={t('library.wanted.subtitle')}
        items={library.wanted}
      />
      <Row
        title={t('library.finished.title')}
        subtitle={t('library.finished.subtitle')}
        items={library.finished}
      />

      {/* ⚠️ Le bilan et le profil de gout ont quitte cet ecran pour la face « Mon
          bilan ». Ils repondaient a une autre question, posee a un autre moment : la
          bibliotheque dit **ou j'en suis**, le bilan dit **qui je suis** — et on ne fait
          plus defiler toute sa collection pour lire son total. */}

      {/* ⚠️ L'export `.ics` a suivi le calendrier sur sa face. Le laisser ici aussi
          donnait **deux** endroits pour la meme action, ce qui fait douter qu'elles
          mènent au meme resultat — la faute reprochee au lien « Ma bibliotheque »
          duplique dans l'en-tete. */}

      <MyPlatforms />

      {/* Juste apres les plateformes : les deux repondent a la meme question — « puis-je
          la voir, et ou ? » — et l'une sans l'autre donne une reponse a moitie. */}
      <MyRegions />

      <JournalTransfer
        onExport={exportJournal}
        onImport={importJournal}
        count={library.total}
      />
    </div>
  );
}

function Row({ title, subtitle, items, lead = false }: {
  readonly title: string;
  readonly subtitle: string;
  readonly items: readonly LibraryItem[];
  /** La rangee de tete : moins de colonnes, donc des affiches nettement plus grandes. */
  readonly lead?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    // Meme regle que l'accueil : la grille sort de la colonne de lecture, jamais le texte.
    <section className="bleed space-y-4" aria-label={title}>
      <RowHeader title={title} subtitle={subtitle} />
      {/* ⚠️ La rangee de tete est une **mosaique** et non une grille plus grande : c'est ce
          qui casse la linearite de l'ecran. La premiere serie — celle qui revient le plus
          tot — occupe quatre cases, les autres suivent en dense. */}
      <ul className={`poster-grid ${lead ? 'poster-grid-mosaic' : ''}`}>
        {items.map((item) => (
          <li key={item.key}>
            <LibraryCard item={item} lead={lead} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * L'ecran vide, qui doit surtout dire quoi faire.
 *
 * Une bibliotheque vide n'est pas une erreur : c'est l'etat de tout le monde a la
 * premiere visite. Elle mene donc quelque part au lieu de constater.
 */
function EmptyLibrary() {
  const { t, locale } = useT();
  return (
    <EmptyState
      title={t('library.empty.title')}
      actions={
        <>
          <Link href={pathIn('/', locale)} className="btn">
            {t('library.empty.browse')}
          </Link>
          <Link href={pathIn('/recherche', locale)} className="btn btn-primary">
            {t('library.empty.search')}
          </Link>
        </>
      }
    >
      {t('library.empty.before')}
      <em>{t('library.empty.em')}</em>
      {t('library.empty.after')}
    </EmptyState>
  );
}

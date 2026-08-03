'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { JournalTransfer } from '@/app/components/JournalTransfer';
import { LibraryCard } from '@/app/components/LibraryCard';
import { MyPlatforms } from '@/app/components/MyPlatforms';
import { buildLibrary, type LibraryItem } from '@/src/domain/library';

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
 * de ce que le fournisseur autorise et de ce que le budget supporte (`ROADMAP.md`
 * §1.4). La contrepartie est assumee : une serie dont l'instantane a expire garde sa
 * place avec moins d'ornements, elle ne disparait jamais.
 *
 * Consequence heureuse : **cette page fonctionne hors ligne**, une fois visitee. C'est
 * ce qu'on attend d'une application installee, et c'est le seul ecran du site dont on
 * puisse le promettre.
 */
export function Library() {
  const { journal, ready, exportJournal, importJournal } = useJournal();
  const { t } = useT();

  // Recalcule seulement quand le journal change : le rangement traverse toutes les
  // entrees, et il n'a aucune raison de recommencer a chaque rendu.
  const library = useMemo(() => buildLibrary(journal), [journal]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu : annoncer « votre bibliotheque est vide » a
    // quelqu'un qui suit quarante series serait la pire premiere impression possible.
    return <div className="h-64" aria-hidden="true" />;
  }

  if (library.total === 0) return <EmptyLibrary />;

  return (
    <div className="space-y-12">
      <Row
        title={t('library.returning.title')}
        subtitle={t('library.returning.subtitle')}
        items={library.returning}
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

      <JournalTransfer
        onExport={exportJournal}
        onImport={importJournal}
        count={library.total}
      />
    </div>
  );
}

function Row({ title, subtitle, items }: {
  readonly title: string;
  readonly subtitle: string;
  readonly items: readonly LibraryItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4" aria-label={title}>
      {/* La meme forme que les rangees de l'accueil : ce sont les memes objets — une
          grille d'affiches sous un titre — et ils n'avaient aucune raison de se presenter
          differemment selon la page. */}
      <div className="section-title">
        <h2>{title}</h2>
        <p className="text-sm text-(--color-muted)">{subtitle}</p>
      </div>
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
        {items.map((item) => (
          <li key={item.key}>
            <LibraryCard item={item} />
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
    // ⚠️ Les deux liens portaient chacun **leur copie a la main** du bouton secondaire —
    // la douzieme et la treizieme, ecrites dans un fichier que le 6.7 n'avait pas ouvert.
    // C'est la meme divergence qui avait fait diverger les deux blocs d'affiche.
    <div className="empty-state">
      <h2 className="empty-state-title">{t('library.empty.title')}</h2>
      <p className="empty-state-body">
        {t('library.empty.before')}
        <em>{t('library.empty.em')}</em>
        {t('library.empty.after')}
      </p>
      <div className="empty-state-actions">
        <Link href={pathIn('/', locale)} className="btn">
          {t('library.empty.browse')}
        </Link>
        <Link href={pathIn('/recherche', locale)} className="btn btn-primary">
          {t('library.empty.search')}
        </Link>
      </div>
    </div>
  );
}

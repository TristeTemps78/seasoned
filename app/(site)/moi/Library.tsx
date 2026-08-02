'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { JournalTransfer } from '@/app/components/JournalTransfer';
import { LibraryCard } from '@/app/components/LibraryCard';
import { MyPlatforms } from '@/app/components/MyPlatforms';
import { TasteCard } from '@/app/components/TasteCard';
import { buildLibrary, type LibraryItem } from '@/src/domain/library';
import { buildTasteProfile } from '@/src/domain/taste';

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

  // Recalcule seulement quand le journal change : le rangement traverse toutes les
  // entrees, et il n'a aucune raison de recommencer a chaque rendu.
  const library = useMemo(() => buildLibrary(journal), [journal]);
  const taste = useMemo(() => buildTasteProfile(journal), [journal]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu : annoncer « votre bibliotheque est vide » a
    // quelqu'un qui suit quarante series serait la pire premiere impression possible.
    return <div className="h-64" aria-hidden="true" />;
  }

  if (library.total === 0) return <EmptyLibrary />;

  return (
    <div className="space-y-12">
      <Row
        title="Ça revient"
        subtitle="Ce que vous suivez et qui repasse bientôt."
        items={library.returning}
      />
      <Row
        title="Reprendre"
        subtitle="Là où vous vous étiez arrêté."
        items={library.resuming}
      />
      <Row
        title="À voir"
        subtitle="Ce que vous vous êtes promis."
        items={library.wanted}
      />
      <Row
        title="Terminées et abandonnées"
        subtitle="Ce qui est derrière vous."
        items={library.finished}
      />

      <TasteCard profile={taste} />

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
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
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
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <h2 className="text-lg font-semibold">Rien ici pour l’instant</h2>
      <p className="leading-relaxed text-(--color-muted)">
        Ouvrez une série et dites <em>« je veux la voir »</em>, ou cliquez un épisode
        pour marquer où vous en êtes. Tout reste dans ce navigateur.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="rounded-md border border-(--color-edge) bg-(--color-surface) px-4 py-2 text-sm hover:border-(--color-muted)"
        >
          Parcourir
        </Link>
        <Link
          href="/recherche"
          className="rounded-md border border-(--color-edge) bg-(--color-surface) px-4 py-2 text-sm hover:border-(--color-muted)"
        >
          Chercher une série
        </Link>
      </div>
    </div>
  );
}

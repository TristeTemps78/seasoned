'use client';

import { useRef, useState } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';

/**
 * Sortir son journal, et le remettre.
 *
 * ** : export integral des qu'il y a une donnee a exporter. Non
 * negociable.** Il y avait une donnee depuis le 2026-08-02 et pas d'export : la regle
 * etait violee, et le suivi la classait « dette » — un euphemisme. `exportJournal()`
 * existait deja, ecrite, exportee, et appelee par rien.
 *
 * Ce n'est pas une politesse envers l'utilisateur. Vingt-six millions de personnes
 * viennent de perdre leur historique parce que TV Time fermait ; un produit qui
 * demande d'investir du temps sans offrir la porte de sortie n'a aucune legitimite a
 * reclamer cette confiance-la.
 *
 * Ici, l'export a une seconde fonction, immediate : c'est **le pont entre appareils**.
 * Tant qu'il n'y a pas de compte, cinq appareils font cinq journaux qui divergent —
 * exporter d'un cote et importer de l'autre est la seule facon de les reunir. D'ou
 * l'import qui **fusionne** au lieu de remplacer : importer sur un appareil deja
 * utilise ne doit rien effacer de ce qu'on y a fait.
 */
export function JournalTransfer({ onExport, onExportCsv, onImport, count }: {
  readonly onExport: () => string;
  /**
   * **F6 — le meme journal, dans un tableau que d'autres savent lire.**
   *
   * ⚠️ Ce n'est pas un second bouton de sauvegarde : le JSON au-dessus est **integral et
   * relisible ici**, c'est le pont entre appareils et la regle 9. Celui-ci **perd** ce que
   * seul ce produit sait garder (marques d'episodes, exceptions de progression, pierres
   * tombales) et gagne la seule chose que le JSON n'a pas : d'autres outils le lisent. Les
   * deux boutons ne repondent donc pas a la meme question, et c'est pour ca qu'il y en a
   * deux plutot qu'un menu de format.
   */
  readonly onExportCsv: () => string;
  readonly onImport: (raw: string) => number | undefined;
  readonly count: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { t, tn } = useT();
  const [message, setMessage] = useState<string | undefined>(undefined);

  /** Un fichier, telecharge. Le seul endroit qui fabrique une URL d'objet — et la revoque. */
  const save = (contenu: string, type: string, extension: string) => {
    const blob = new Blob([contenu], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voltface-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const download = () => {
    save(onExport(), 'application/json', 'json');
    setMessage(tn('backup.exported', count));
  };

  const downloadCsv = () => {
    save(onExportCsv(), 'text/csv;charset=utf-8', 'csv');
    setMessage(t('backup.exportedCsv'));
  };

  const upload = async (file: File) => {
    const total = onImport(await file.text());
    // Un import muet serait pire qu'une erreur : on dit ce qui est entre, ou que rien
    // n'a pu etre lu.
    setMessage(
      total === undefined ? t('backup.unreadable') : tn('backup.merged', total),
    );
  };

  return (
    <section
      className="card space-y-3"
      aria-label={t('backup.aria')}
    >
      <h2 className="card-title">{t('backup.title')}</h2>

      {/* Dire la verite sur la fragilite du stockage fait partie du contrat : vider
          son navigateur efface tout, et personne ne s'y attend. */}
      <p className="max-w-prose text-xs leading-relaxed text-(--color-muted)">
        {t('backup.body.before')}
        <strong>{t('backup.body.em')}</strong>
        {t('backup.body.after')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={download}
          disabled={count === 0}
          className="rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted) disabled:opacity-40 disabled:hover:border-(--color-edge)"
        >
          {t('backup.export')}
        </button>

        {/* 🔴 **F6 — le sens unique.** `/convertir` lit un export TV Time, Trakt ou Simkl
            depuis le lot 7 ; rien ne ressortait. *Un produit dont on ne peut pas partir est
            un produit dans lequel on hesite a entrer* — et c'est la promesse que ce bloc
            entier existe pour tenir.

            ⚠️ Aucun service n'est nomme sur ce bouton, et c'est la meme decision qu'a
            l'import : je n'ai vu ni l'importeur de Trakt ni celui de Simkl, et Letterboxd ne
            prend que des films. Un bouton « Exporter vers Trakt » promettrait un format
            invente. On rend un tableau a colonnes avec l'identifiant TMDB en tete — ce que
            tout importeur sait mapper, et ce qu'un tableur ouvre. */}
        <button
          type="button"
          onClick={downloadCsv}
          disabled={count === 0}
          className="rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted) disabled:opacity-40 disabled:hover:border-(--color-edge)"
        >
          {t('backup.exportCsv')}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn"
        >
          {t('backup.import')}
        </button>

        {/* 🔴 **Deux arrets de tabulation pour un seul geste, dont un sans nom.**
            Mesure au navigateur le 2026-08-11 : ce champ est `sr-only`, donc invisible a
            l'oeil mais **present dans l'arbre d'accessibilite et focalisable**. Un lecteur
            d'ecran annoncait donc « bouton Importer un fichier », puis un second controle
            muet juste derriere — le meme geste, sans nom, sans indication.

            Il n'est pas un controle : c'est la **mecanique** du bouton au-dessus, qui
            l'actionne par `.click()`. `tabIndex={-1}` le sort du parcours clavier, et
            `aria-hidden` de l'arbre — les deux ensemble, sinon on cacherait un element
            encore atteignable, ce que l'ARIA interdit. Le declenchement programmatique,
            lui, continue de marcher : il ne passe ni par le focus ni par l'arbre. */}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) void upload(file);
            // Remis a zero pour que reimporter le meme fichier redeclenche l'evenement.
            e.target.value = '';
          }}
        />
      </div>

      {message !== undefined ? (
        <p aria-live="polite" className="text-xs text-(--color-live)">
          {message}
        </p>
      ) : null}
    </section>
  );
}

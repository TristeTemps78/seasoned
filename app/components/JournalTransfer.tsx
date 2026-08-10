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
export function JournalTransfer({ onExport, onImport, count }: {
  readonly onExport: () => string;
  readonly onImport: (raw: string) => number | undefined;
  readonly count: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { t, tn } = useT();
  const [message, setMessage] = useState<string | undefined>(undefined);

  const download = () => {
    const blob = new Blob([onExport()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voltface-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(tn('backup.exported', count));
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

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn"
        >
          {t('backup.import')}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
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

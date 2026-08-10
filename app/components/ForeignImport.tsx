'use client';

import { useRef, useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { importForeign, type ImportOutcome } from '@/src/domain/import';

/** Au-dela, le fichier n'est plus un export de series : on refuse avant de lire. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Reprendre un historique venu d'ailleurs.
 *
 * ## Ce que ce composant fait, et ne fait pas
 *
 * Tout se passe **dans le navigateur** : le fichier n'est televerse nulle part, aucune
 * requete ne part. Ce n'est pas une precaution de style — un historique de visionnage
 * est une donnee personnelle detaillee, et ne pas l'heberger est plus sur que de
 * promettre de bien l'heberger.
 *
 * Le rapport affiche **ce qui n'est pas passe**, et c'est le point delicat. Un import
 * qui annonce « termine ! » apres avoir repris 40 series sur 300 est une trahison plus
 * grave qu'un refus : la personne efface son fichier source, et decouvre le trou trois
 * mois plus tard.
 *
 * ⚠️ **Un fichier choisi par l'utilisateur reste une entree non fiable.** Il vient d'un
 * service tiers, ou de n'importe ou. D'ou une taille bornee avant lecture, et un
 * analyseur qui borne sa propre profondeur (`src/domain/import.ts`) : un document
 * profondement imbrique ne doit pas figer l'onglet de celui qui l'ouvre.
 */
export function ForeignImport() {
  const { journal, ready, replaceJournal } = useJournal();
  const { t, tn } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | undefined>(undefined);
  const [tooBig, setTooBig] = useState(false);

  const upload = async (file: File) => {
    setOutcome(undefined);
    setTooBig(false);
    if (file.size > MAX_BYTES) {
      setTooBig(true);
      return;
    }
    const result = importForeign(await file.text(), journal, new Date());
    if (result.imported > 0) replaceJournal(result.journal);
    setOutcome(result);
  };

  return (
    <section className="space-y-4" aria-label={t('convert.aria')}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-(--color-edge) bg-(--color-surface) px-4 py-2 text-sm hover:border-(--color-muted) disabled:opacity-40"
        >
          {t('convert.pick')}
        </button>
        <span className="text-xs text-(--color-muted)">{t('convert.local')}</span>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,text/csv,.json,.csv,.txt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) void upload(file);
            // Remis a zero pour que reimporter le meme fichier redeclenche l'evenement.
            e.target.value = '';
          }}
        />
      </div>

      {tooBig ? (
        <p aria-live="polite" className="text-sm text-(--color-warn)">
          {t('convert.tooBig')}
        </p>
      ) : null}

      {outcome !== undefined ? (
        <div aria-live="polite" className="space-y-1 text-sm">
          {outcome.source === 'unreadable' ? (
            <p className="text-(--color-warn)">{t('convert.unreadable')}</p>
          ) : (
            <>
              <p className="text-(--color-live)">
                {tn('convert.imported', outcome.imported)}
              </p>
              {/* Dire ce qui manque, et pourquoi. C'est la partie du message qui
                  empeche quelqu'un d'effacer son fichier source trop vite. */}
              {outcome.skipped > 0 ? (
                <p className="text-(--color-muted)">
                  {tn('convert.skipped', outcome.skipped)}
                </p>
              ) : null}
              {/* 🔴 **Lesquelles.** Le nombre seul est un silence poli : personne ne peut
                  rattraper a la main ce qu'il ne sait pas nommer, et la regle du projet est
                  « on signale, on ne repare jamais en silence ». Le titre etait deja lu par
                  l'import et simplement jete. */}
              {outcome.missed.length > 0 ? (
                <details className="text-(--color-muted)">
                  <summary className="cursor-pointer">{t('convert.missedTitle')}</summary>
                  <ul className="mt-1 list-inside list-disc">
                    {outcome.missed.map((title) => (
                      <li key={title}>{title}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

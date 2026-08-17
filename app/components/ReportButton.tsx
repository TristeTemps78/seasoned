'use client';

import { useState } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';
import { REPORT_GROUNDS } from '@/src/domain/moderation';

/**
 * Signaler ce qu'ecrit quelqu'un d'autre.
 *
 * ## Les motifs sont ceux de `/regles`, mot pour mot
 *
 * Pas de libelles courts ecrits pour l'occasion : les memes cles que la page qui **annonce**
 * la procedure. C'est ce qui rend impossible la derive ou l'on retire pour un motif qu'on
 * n'a pas publie — l'arbitraire exact que `/regles` existe pour empecher. Le prix est un
 * bouton qui porte une phrase ; c'est peu cher.
 *
 * Et le jeu vient de `REPORT_GROUNDS` : **ajouter un motif au domaine sans traduire son
 * libelle ne compile plus**.
 *
 * ## Rien ne revient
 *
 * La table n'a aucune politique de lecture. Un signalement relisible par son auteur serait
 * un accuse de reception, donc une promesse de suivi a tenir ici ; relisible par la personne
 * visee, une denonciation nominative. On dit « c'est parti », et la reponse passe par
 * l'adresse annoncee sur `/regles`.
 */
export function ReportButton({ onReport }: {
  readonly onReport: (ground: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'open' | 'sent'>('idle');
  // ⚠️ L'echec est un **drapeau a part**, pas un quatrieme etat. En le mettant dans la meme
  // variable, le panneau se refermait sur un echec — la personne cliquait, tout disparaissait,
  // et rien ne partait. Le typage l'a refuse avant qu'on puisse l'expedier.
  const [failed, setFailed] = useState(false);

  if (state === 'sent') {
    return <span className="meta-sm">{t('report.sent')}</span>;
  }

  if (state !== 'open') {
    return (
      <button
        type="button"
        onClick={() => setState('open')}
        // 🔴 **`quiet-action`, et c'etait deja la classe a employer.** Mesure du 2026-08-17 :
        // 45 x 17 sur la production, sous le plancher de 24 px. `controls.css` nomme cette
        // classe « l'action qui defait — recopiee quatre fois avant d'etre nommee » ; ce
        // bouton etait la cinquieme copie, et il n'avait donc recu ni la cible ni le
        // dessin. Signaler EST une action discrete : c'est exactement sa definition.
        className="quiet-action hover:text-(--color-warn)"
      >
        {t('report.open')}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1 border-t border-(--color-edge) pt-2">
      <p className="meta-sm">{t('report.which')}</p>
      {REPORT_GROUNDS.map((ground) => (
        <button
          key={ground}
          type="button"
          onClick={() => {
            void onReport(ground).then((ok) => {
              setFailed(!ok);
              if (ok) setState('sent');
            });
          }}
          className="block w-full rounded-md px-2 py-1 text-left meta-sm hover:bg-(--color-surface) hover:text-(--color-text)"
        >
          {t(`rules.ground.${ground}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setState('idle');
        }}
        className="px-2 py-1 meta-sm hover:text-(--color-text)"
      >
        {t('report.cancel')}
      </button>
      {failed ? (
        <p aria-live="polite" className="px-2 text-xs text-(--color-warn)">
          {t('report.failed')}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';
import { onWriteFailure, type WriteFailure } from '@/app/social/failures';

/**
 * « Ce geste n'est pas parti » — le seul ecran d'une panne d'ecriture.
 *
 * ## 🔴 Ce qu'il repare, et ce que ca a deja coute
 *
 * Trois fonctionnalites sont mortes en silence dans ce depot : le lot 10.0, `017`, et la
 * carte des abandons — refusee a **chaque** publication depuis le lot 11, en production,
 * sans une ligne dans la console. La cause est la meme les trois fois : le client social
 * rend `false`, personne ne le regarde, et **l'ecran d'une panne est identique a celui d'un
 * demarrage a froid**. Il a fallu ouvrir l'onglet reseau d'un navigateur pour l'apprendre,
 * chaque fois plusieurs jours trop tard.
 *
 * ⚠️ **Ce composant ne repare aucune ecriture.** Il rend une panne *visible*, ce qui est
 * une autre chose et la seule qui manquait : un produit ou l'echec se voit se corrige en
 * heures, un produit ou il se tait se corrige quand quelqu'un pense a regarder.
 *
 * ## Pourquoi ici, et une seule fois
 *
 * Meme emplacement que `DataSafety`, `FaceSwitch` et `PublishActivity` : en tete de `main`,
 * sur toutes les pages. Une ecriture part depuis n'importe ou — noter une saison sur une
 * fiche, suivre quelqu'un depuis une recherche, ranger une serie dans une liste — donc son
 * echec doit pouvoir s'annoncer depuis n'importe ou.
 *
 * ## Ce qu'il dit, et ce qu'il ne dit pas
 *
 * Il nomme **le geste perdu** et propose de refaire, sans jamais afficher `42501` ni
 * `rest/v1/activity` : un code PostgREST n'apprend rien a la personne qui vient de cliquer,
 * et le chemin exact est deja dans la console pour qui debogue. La regle 4 demande qu'un
 * ecran dise quoi faire — ici, c'est « recommencez », parce que c'est vrai : toutes les
 * ecritures de ce produit sont idempotentes (voir `IDEMPOTENCE`).
 *
 * ⚠️ **`alert` et non `status`**, a l'inverse de `FaceSwitch` : quelque chose que la personne
 * croit fait ne l'est pas. C'est le seul endroit du produit qui merite d'interrompre ce
 * qu'un lecteur d'ecran est en train de dire.
 */
export function WriteFailureNotice() {
  const { t } = useT();
  const [failure, setFailure] = useState<WriteFailure>();

  useEffect(() => onWriteFailure(setFailure), []);

  // Rien a dire tant que rien n'a echoue — et ce silence-la n'est pas la doctrine abattue le
  // 2026-08-11 : il n'y a litteralement pas de panne a annoncer.
  if (failure === undefined) return null;

  return (
    <div role="alert" className="card mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1 text-sm">
        <p className="font-medium text-(--color-warn)">{t('write.failed.title')}</p>
        <p className="text-(--color-muted)">{t('write.failed.body')}</p>
      </div>
      {/* Fermer, et rien d'autre. « Reessayer » serait un bouton qui ne peut pas tenir sa
          promesse : le geste perdu appartient a l'ecran d'ou il est parti, et ce composant
          ne sait pas le rejouer. Un bouton qui ne peut pas marcher ne s'affiche pas —
          regle du 2026-08-09. */}
      <button type="button" className="btn" onClick={() => setFailure(undefined)}>
        {t('write.failed.dismiss')}
      </button>
    </div>
  );
}

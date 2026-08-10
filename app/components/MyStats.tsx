'use client';

import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { MyTally } from '@/app/components/MyTally';
import { MyYear } from '@/app/components/MyYear';
import { MyFaceCard } from '@/app/components/MyFaceCard';
import { TasteCard } from '@/app/components/TasteCard';
import { buildTally } from '@/src/domain/tally';
import { buildTasteProfile } from '@/src/domain/taste';

/**
 * La face « Mon bilan » — le temps passe et la forme d'un gout.
 *
 * ## Pourquoi elle quitte la bibliotheque
 *
 * Les deux cartes vivaient au bas de `/moi`, apres quatre rangees de vignettes. Elles
 * repondent pourtant a une **autre question, posee a un autre moment** : la bibliotheque
 * dit *ou j'en suis*, le bilan dit *qui je suis*. C'est le critere qui decide de ce qui
 * merite une face, et il vaut pour cette scission comme
 * pour les autres.
 *
 * Consequence pratique : on ne fait plus defiler sa collection entiere pour lire son
 * total.
 *
 * ## Aucun appel, comme partout dans cette couche
 *
 * Les deux calculs sont purs et lisent le seul journal. Le bilan **se tait** sous ses
 * seuils, et le profil de gout aussi — un ecran qui n'affiche rien est donc un etat
 * normal, pas une panne, et le texte le dit.
 */
export function MyStats() {
  const { journal, ready } = useJournal();
  const { t } = useT();

  const tally = useMemo(() => buildTally(journal), [journal]);
  const taste = useMemo(() => buildTasteProfile(journal), [journal]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu le stockage.
    return <div className="h-64" aria-hidden="true" />;
  }

  // Les deux composants se taisent independamment. S'ils se taisent tous les deux, il
  // faut dire pourquoi plutot que de laisser une page blanche.
  const silent = !tally.worthShowing && !taste.speaks;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="page-title">{t('tallyPage.title')}</h1>
        <p className="text-(--color-muted)">{t('tallyPage.lede')}</p>
      </header>

      {/* ⚠️ **Hors du `silent`, et c'est voulu.** Les deux autres cartes se taisent faute de
          matiere ; la face, elle, dit « pas encore, et voila comment » — c'est la seule
          chose que cet ecran puisse offrir a quelqu'un qui n'a encore rien. Elle est donc
          aussi la reponse a la tache 7.6 (*« /bilan est presque vide — probleme de contenu,
          pas de style : ne pas le decorer »*). */}
      <MyFaceCard />

      {silent ? (
        <div className="empty-state">
          <h2 className="empty-state-title">{t('tallyPage.empty.title')}</h2>
          <p className="empty-state-body">{t('tallyPage.empty.body')}</p>
        </div>
      ) : (
        <>
          {/* L'annee en cours d'abord : c'est la question qu'on se pose en ouvrant cet
              ecran en decembre, et la seule qui ait une reponse differente chaque annee.
              Se tait tout seul si l'annee est trop maigre. */}
          <MyYear />
          <MyTally tally={tally} />
          <TasteCard
            profile={taste}
            journalTitles={Object.fromEntries(
              Object.entries(journal.entries)
                .map(([key, entry]) => [key, entry.snapshot?.title])
                .filter((pair): pair is [string, string] => pair[1] !== undefined),
            )}
          />
        </>
      )}
    </div>
  );
}

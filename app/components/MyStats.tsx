'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { EmptyState } from '@/app/components/EmptyState';
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
 * Les deux calculs sont purs et lisent le seul journal. Aucune des deux cartes ne se tait
 * plus sous ses seuils : elles disent ce qui manque pour parler. Voir `silent`, plus bas,
 * pour le seul cas ou cette face garde encore un ecran vide — et pour ce qu'il a coute.
 */
export function MyStats() {
  const { journal, ready } = useJournal();
  const { t, locale } = useT();

  const tally = useMemo(() => buildTally(journal), [journal]);
  const taste = useMemo(() => buildTasteProfile(journal), [journal]);

  if (!ready) {
    // Ne rien affirmer avant d'avoir lu le stockage.
    return <div className="h-64" aria-hidden="true" />;
  }

  /**
   * 🔴 **Ce garde-fou annulait le correctif de la veille, et ca se voyait a l'ecran.**
   *
   * Le 2026-08-11 au matin, `MyTally` et `TasteCard` ont cesse de rendre `null` : ils disent
   * desormais **combien il manque**. Sauf que ce `silent`-ci les court-circuite *avant* qu'ils
   * soient rendus — il valait `!tally.worthShowing && !taste.speaks`, c'est-a-dire exactement
   * la conjonction ou les deux nouvelles phrases avaient quelque chose a dire. Les deux
   * explications n'apparaissaient donc que si l'**autre** carte parlait deja : jamais pour un
   * compte jeune, qui est le seul cas qu'elles visaient.
   *
   * Constate au navigateur le 2026-08-11 sur un journal de six series : « Rien a mesurer pour
   * l'instant ». Le correctif de la veille etait vivant, teste, et invisible — c'est le motif
   * que ce depot a paye sept fois, ici sous sa forme la plus discrete : **une garde en amont
   * qui rend un correctif inatteignable**.
   *
   * ## Ce qui reste silencieux, et c'est le seul cas
   *
   * Un journal **litteralement vide** : ni serie chiffrable, ni serie non chiffrable, ni note.
   * La, une phrase vaut mieux que trois sections qui expliquent chacune qu'elles n'ont rien —
   * l'argument de la veille etait juste, il visait simplement le mauvais seuil.
   *
   * Des qu'il y a un geste, chaque section parle : celle du temps dit ce qu'elle ne peut pas
   * compter (le cas de l'import, parcours d'arrivee le plus important du produit), celle du
   * gout dit combien de series notees il manque.
   */
  const silent = tally.counted === 0 && tally.uncounted === 0 && taste.ratedSeries === 0;

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
        // Il n'avait aucune action : il constatait, et laissait la page finir la.
        <EmptyState
          title={t('tallyPage.empty.title')}
          actions={
            <>
              <Link href={pathIn('/recherche', locale)} className="btn btn-primary">
                {t('tallyPage.empty.search')}
              </Link>
              <Link href={pathIn('/moi', locale)} className="btn">
                {t('gate.library')}
              </Link>
            </>
          }
        >
          {t('tallyPage.empty.body')}
        </EmptyState>
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

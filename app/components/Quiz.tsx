'use client';

import { useMemo, useState } from 'react';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { QuizBars } from '@/app/components/QuizBars';
import { QuizChoices, QuizVerdictLine } from '@/app/components/QuizChoices';
import { seedOf } from '@/src/domain/draw';
import { buildQuiz } from '@/src/domain/quiz';

/**
 * La question du jour.
 *
 * ## La graine est **le jour**, et c'est la moitie de la feature
 *
 * Une question tiree au hasard changerait a chaque rendu — donc a chaque frappe, React
 * rendant a chaque etat. Elle ne serait jamais la meme deux fois, et il n'y aurait rien a
 * revenir chercher.
 *
 * En prenant le jour pour graine, la question est **stable toute la journee et change
 * demain**. C'est ce qui en fait un rendez-vous, et c'est gratuit : aucune donnee a
 * stocker, aucun serveur a interroger, et deux appareils du meme jour posent la meme
 * question sans s'etre parle.
 *
 * ## Ce que ce composant ne fait pas
 *
 * Il ne garde **aucun score**. Un score qui compte suppose qu'on ne puisse pas se le
 * donner, et le journal est declaratif : il vit dans le navigateur de son proprietaire,
 * qui peut le reecrire. Un classement demanderait donc un calcul serveur, c'est-a-dire la
 * premiere route du projet. Ce n'est pas un oubli, c'est la meme ligne que le produit
 * tient partout ailleurs.
 */
export function Quiz() {
  const { t, locale } = useT();
  const { journal, ready } = useJournal();
  const [answered, setAnswered] = useState<string | undefined>(undefined);

  // ⚠️ L'instant est fige au montage. `new Date()` a chaque rendu donnerait une valeur
  // neuve a chaque frappe, donc une dependance de `useMemo` toujours differente — le memo
  // ne memoriserait rien et la question serait retiree a chaque etat.
  const today = useMemo(() => new Date(), []);
  // 🔴 `seedOf` et non un `Number(\`${annee}${mois}${jour}\`)` recopie a la main. Ce module
  // existe **precisement** pour ca — son en-tete raconte les trois copies du meme tirage
  // qu'il a fallu reunir — et sa fonction est documentee « une graine numerique a partir
  // d'un texte : **un jour, par exemple** ». Elle n'etait pourtant lue que par les tests,
  // pendant que ce fichier et `FriendQuiz` en refaisaient chacun une version.
  const seed = seedOf(today.toISOString().slice(0, 10));

  const quiz = useMemo(
    () => (ready ? buildQuiz(journal, today, seed) : undefined),
    [journal, ready, seed, today],
  );

  // Mieux vaut se taire que poser une mauvaise question : sans assez d'histoire, rien.
  if (quiz === undefined) return null;

  const rightAnswer = quiz.answer;
  const chosen = answered;

  return (
    <section className="band" aria-label={t('quiz.title')}>
      <h2 className="row-title">{t('quiz.title')}</h2>

      {quiz.kind === 'onDay' ? (
        <p className="prose-note">
          {t('quiz.onDay', {
            date: new Date(`${quiz.on}T12:00:00Z`).toLocaleDateString(
              locale === 'fr' ? 'fr-FR' : 'en-GB',
              { day: 'numeric', month: 'long', year: 'numeric' },
            ),
          })}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="prose-note">
            {quiz.kind === 'byCurve' ? t('quiz.byCurve') : t('quiz.byEpisodes')}
          </p>
          {/* La forme, sans titre ni numero de serie — c'est tout le jeu. */}
          <QuizBars
            points={(quiz.kind === 'byCurve' ? quiz.curve : quiz.episodes).map((point) => ({
              label: String(point.season),
              value: point.stars,
            }))}
            perUnit={16}
            label={quiz.kind === 'byCurve' ? t('quiz.byCurve') : t('quiz.byEpisodes')}
          />
        </div>
      )}

      <QuizChoices
        choices={quiz.choices}
        picked={chosen}
        answer={rightAnswer}
        onPick={setAnswered}
      />

      <QuizVerdictLine>
        {chosen === undefined
          ? ''
          : chosen === rightAnswer
            ? t('quiz.right')
            : t('quiz.wrong', {
                title: quiz.choices.find((choice) => choice.key === rightAnswer)?.title ?? '',
              })}
      </QuizVerdictLine>
    </section>
  );
}

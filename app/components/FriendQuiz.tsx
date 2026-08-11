'use client';

import { useMemo, useState } from 'react';

import { useT } from '@/app/i18n/LocaleProvider';
import { QuizBars } from '@/app/components/QuizBars';
import { QuizChoices, QuizVerdictLine } from '@/app/components/QuizChoices';
import { seedOf } from '@/src/domain/draw';
import { buildFriendQuiz, type FriendFact } from '@/src/domain/friend-quiz';

/**
 * « Que fait votre monde ? » — un quiz sur les gens qu'on suit.
 *
 * ## Zero appel de plus, et ce n'est pas une optimisation
 *
 * Ce composant recoit les faits **que le fil a deja charges et deja caviardes**. Aller les
 * rechercher aurait double la lecture pour la meme donnee, et surtout : aurait ouvert la
 * porte a les recharger **sans** passer par `redactActivity`. La matiere caviardee est la,
 * on s'en sert.
 *
 * ⚠️ **Ce composant ne caviarde rien et ne doit jamais le faire.** Si un jour il recevait
 * des faits bruts, la regle du spoiler tomberait ici en silence — c'est pourquoi son
 * unique entree s'appelle ce qu'elle est.
 */
export function FriendQuiz({
  redactedFacts,
  titleOf,
}: {
  /** Des faits **deja passes par `redactActivity`**. Jamais le fil brut. */
  readonly redactedFacts: readonly FriendFact[];
  readonly titleOf: (subject: string) => string | undefined;
}) {
  const { t } = useT();
  const [answered, setAnswered] = useState<string | undefined>(undefined);

  // Meme graine que le quiz personnel : le jour. La question tient jusqu'a demain plutot
  // que de changer a chaque rendu. 🔴 Elle etait recalculee ici a la main, a l'identique de
  // `Quiz.tsx`, alors que `seedOf` existe pour ca — voir le commentaire la-bas.
  const seed = useMemo(() => seedOf(new Date().toISOString().slice(0, 10)), []);

  const quiz = useMemo(
    () => buildFriendQuiz(redactedFacts, titleOf, seed),
    [redactedFacts, titleOf, seed],
  );

  // Mieux vaut se taire que poser une mauvaise question.
  if (quiz === undefined) return null;

  return (
    <section className="band" aria-label={t('friendQuiz.title')}>
      <h2 className="row-title">{t('friendQuiz.title')}</h2>

      <p className="prose-note">
        {quiz.kind === 'friendLiked'
          ? t('friendQuiz.liked', { handle: quiz.handle })
          : t('friendQuiz.curve', { handle: quiz.handle })}
      </p>

      {quiz.kind === 'friendCurve' ? (
        // ⚠️ Cette courbe s'arrete ou le LECTEUR s'est arrete : elle est batie sur des
        // faits deja caviardes. Elle ne peut donc pas annoncer une saison qu'il n'a pas
        // atteinte — c'est tout le travail de `redactActivity`, fait en amont.
        <QuizBars
          points={quiz.curve.map((point) => ({
            label: String(point.season),
            value: point.stars,
          }))}
          perUnit={16}
        />
      ) : null}

      <QuizChoices
        choices={quiz.choices}
        picked={answered}
        answer={quiz.answer}
        onPick={setAnswered}
      />

      <QuizVerdictLine>
        {answered === undefined
          ? ''
          : answered === quiz.answer
            ? t('quiz.right')
            : t('quiz.wrong', {
                title: quiz.choices.find((choice) => choice.key === quiz.answer)?.title ?? '',
              })}
      </QuizVerdictLine>
    </section>
  );
}

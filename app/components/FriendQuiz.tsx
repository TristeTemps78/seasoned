'use client';

import { useMemo, useState } from 'react';

import { useT } from '@/app/i18n/LocaleProvider';
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
  // que de changer a chaque rendu.
  const seed = useMemo(() => {
    const today = new Date();
    return Number(
      `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`,
    );
  }, []);

  const quiz = useMemo(
    () => buildFriendQuiz(redactedFacts, titleOf, seed),
    [redactedFacts, titleOf, seed],
  );

  // Mieux vaut se taire que poser une mauvaise question.
  if (quiz === undefined) return null;

  return (
    <section className="card space-y-4" aria-label={t('friendQuiz.title')}>
      <h2 className="card-title">{t('friendQuiz.title')}</h2>

      <p className="prose-note">
        {quiz.kind === 'friendLiked'
          ? t('friendQuiz.liked', { handle: quiz.handle })
          : t('friendQuiz.curve', { handle: quiz.handle })}
      </p>

      {quiz.kind === 'friendCurve' ? (
        // ⚠️ Cette courbe s'arrete ou le LECTEUR s'est arrete : elle est batie sur des
        // faits deja caviardes. Elle ne peut donc pas annoncer une saison qu'il n'a pas
        // atteinte — c'est tout le travail de `redactActivity`, fait en amont.
        <ul className="flex items-end gap-2">
          {quiz.curve.map((point) => (
            <li key={point.season} className="flex flex-col items-center gap-1">
              <span
                className="w-6 rounded-t bg-(--color-volt)"
                style={{ height: `${Math.max(4, point.stars * 16)}px` }}
              />
              <span className="text-xs text-(--color-muted)">{point.season}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2">
        {quiz.choices.map((choice) => {
          const isRight = choice.key === quiz.answer;
          const picked = answered === choice.key;
          return (
            <li key={choice.key}>
              <button
                type="button"
                disabled={answered !== undefined}
                aria-pressed={picked}
                onClick={() => setAnswered(choice.key)}
                className={`btn w-full justify-start ${
                  answered === undefined
                    ? ''
                    : isRight
                      ? 'border-(--color-volt) text-(--color-volt)'
                      : picked
                        ? 'border-(--color-warn) text-(--color-warn)'
                        : 'opacity-50'
                }`}
              >
                {choice.title}
              </button>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" className="text-sm">
        {answered === undefined
          ? ''
          : answered === quiz.answer
            ? t('quiz.right')
            : t('quiz.wrong', {
                title: quiz.choices.find((choice) => choice.key === quiz.answer)?.title ?? '',
              })}
      </p>
    </section>
  );
}

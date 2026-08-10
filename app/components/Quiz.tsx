'use client';

import { useMemo, useState } from 'react';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { buildQuiz, type QuizChoice } from '@/src/domain/quiz';

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
  const seed = Number(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`,
  );

  const quiz = useMemo(
    () => (ready ? buildQuiz(journal, today, seed) : undefined),
    [journal, ready, seed, today],
  );

  // Mieux vaut se taire que poser une mauvaise question : sans assez d'histoire, rien.
  if (quiz === undefined) return null;

  const rightAnswer = quiz.answer;
  const chosen = answered;

  return (
    <section className="card space-y-4" aria-label={t('quiz.title')}>
      <h2 className="card-title">{t('quiz.title')}</h2>

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
          <p className="prose-note">{t('quiz.byCurve')}</p>
          {/* La trajectoire, sans titre ni numero de serie — c'est tout le jeu. Les
              saisons sont numerotees parce que la forme seule ne dit pas ou elle commence. */}
          <ul className="flex items-end gap-2" aria-label={t('quiz.byCurve')}>
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
        </div>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {quiz.choices.map((choice: QuizChoice) => {
          const isRight = choice.key === rightAnswer;
          const picked = chosen === choice.key;
          return (
            <li key={choice.key}>
              <button
                type="button"
                disabled={chosen !== undefined}
                aria-pressed={picked}
                onClick={() => setAnswered(choice.key)}
                className={`btn w-full justify-start ${
                  chosen === undefined
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

      {/* ⚠️ Le verdict n'apparait qu'apres la reponse, et il est **annonce** : sans
          `aria-live`, quelqu'un qui navigue au clavier clique et n'apprend rien. */}
      <p aria-live="polite" className="text-sm">
        {chosen === undefined
          ? ''
          : chosen === rightAnswer
            ? t('quiz.right')
            : t('quiz.wrong', {
                title: quiz.choices.find((choice) => choice.key === rightAnswer)?.title ?? '',
              })}
      </p>
    </section>
  );
}

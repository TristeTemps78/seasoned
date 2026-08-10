/**
 * Les reponses possibles d'un quiz, et leur verdict.
 *
 * 🔴 Les trois quiz portaient chacun `grid gap-2 sm:grid-cols-2` et `btn w-full
 * justify-start`, et deux d'entre eux la meme cascade de quatre branches pour colorer la
 * reponse apres le clic.
 *
 * ⚠️ **`answer` n'est passe que quand le navigateur a le droit de connaitre la reponse.**
 * La manche du jour est jugee par Postgres, precisement pour que chercher ailleurs coute des
 * secondes ; l'envoyer pour la colorer la mettrait dans le HTML servi. Le champ optionnel
 * est ce qui rend cette fuite impossible a ecrire par distraction.
 */
export function QuizChoices({ choices, picked, answer, onPick }: {
  readonly choices: readonly { readonly key: string; readonly title: string }[];
  /** Ce qui a ete choisi. Tant qu'il vaut `undefined`, les boutons restent actifs. */
  readonly picked: string | undefined;
  readonly answer?: string;
  readonly onPick: (key: string) => void;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {choices.map((choice) => {
        const isRight = answer !== undefined && choice.key === answer;
        const isPicked = picked === choice.key;

        return (
          <li key={choice.key}>
            <button
              type="button"
              disabled={picked !== undefined}
              aria-pressed={isPicked}
              onClick={() => onPick(choice.key)}
              className={`btn w-full justify-start ${
                picked === undefined || answer === undefined
                  ? ''
                  : isRight
                    ? 'border-(--color-volt) text-(--color-volt)'
                    : isPicked
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
  );
}

/**
 * ⚠️ Rendu **meme vide** : une region `aria-live` inseree apres coup n'est pas relue, donc
 * quelqu'un au clavier cliquerait sans rien apprendre.
 */
export function QuizVerdictLine({ children }: { readonly children: React.ReactNode }) {
  return (
    <p aria-live="polite" className="text-sm">
      {children}
    </p>
  );
}

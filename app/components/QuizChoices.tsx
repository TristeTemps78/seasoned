/**
 * Les reponses possibles d'un quiz — **la grille et son verdict, ecrits une fois**.
 *
 * ## Ce qui etait recopie
 *
 * 🔴 Les trois quiz du produit portaient chacun `grid gap-2 sm:grid-cols-2`, chacun un
 * `btn w-full justify-start`, et deux d'entre eux la **meme cascade de quatre branches**
 * pour colorer la reponse une fois le choix fait — volt pour la bonne, warn pour celle
 * qu'on a prise a tort, effacee pour les autres. Trente lignes identiques dans deux
 * fichiers, plus la grille nue dans le troisieme.
 *
 * ## `answer` est la seule variation, et elle porte son sens
 *
 * Quand la bonne reponse est connue du navigateur (les deux quiz locaux), on la revele
 * apres le clic. Quand elle ne l'est pas — la manche du jour, ou c'est **Postgres** qui
 * juge, precisement pour que chercher la reponse ailleurs coute des secondes — il n'y a
 * rien a colorer, et le champ reste absent.
 *
 * ⚠️ **Absent, et non `undefined` explicite** : un composant qui recevrait la bonne reponse
 * « pour plus tard » l'aurait mise dans le HTML servi, donc lisible par qui inspecte la
 * page. La forme du type est ce qui rend cette fuite impossible a ecrire par distraction.
 */
export function QuizChoices({ choices, picked, answer, onPick }: {
  readonly choices: readonly { readonly key: string; readonly title: string }[];
  /** Ce qui a ete choisi. Tant qu'il vaut `undefined`, les boutons restent actifs. */
  readonly picked: string | undefined;
  /** La bonne reponse, **uniquement** quand le navigateur a le droit de la connaitre. */
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
 * Ce que le quiz repond, une fois le choix fait.
 *
 * ⚠️ **`aria-live` n'est pas un detail** : sans lui, quelqu'un qui navigue au clavier clique
 * et n'apprend rien — le verdict apparait a l'ecran sans etre annonce. Le paragraphe est
 * rendu **meme vide**, parce qu'une region vivante inseree apres coup n'est pas relue.
 */
export function QuizVerdictLine({ children }: { readonly children: React.ReactNode }) {
  return (
    <p aria-live="polite" className="text-sm">
      {children}
    </p>
  );
}

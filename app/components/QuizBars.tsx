/**
 * La forme d'une serie, sans son nom — **la matiere de tous les quiz du produit**.
 *
 * ## Pourquoi ce fichier existe
 *
 * 🔴 Ce graphique etait ecrit **trois fois**, au caractere pres : `Quiz.tsx` (la question du
 * jour), `FriendQuiz.tsx` (la courbe d'un ami) et `DailyRound.tsx` (la manche partagee). Les
 * trois portaient la meme liste, les memes `w-6 rounded-t bg-(--color-volt)`, le meme
 * `Math.max(4, …)`, le meme libelle en dessous. Seul le facteur d'echelle differait.
 *
 * C'est exactement la faute que `src/domain/draw.ts` documente sur ces **memes trois
 * modules** — « je l'ai violee trois fois de suite avant qu'un audit ne le montre » — et
 * elle s'etait reformee un etage plus haut, dans leur affichage.
 *
 * ## `perUnit` est la seule chose qui differait, donc la seule chose qui reste un reglage
 *
 * Une note d'etoiles va de 0 a 5, un score de manche de 0 a 10 : le meme nombre de pixels
 * par unite donnerait deux graphiques de hauteurs incomparables. Le passer en parametre
 * garde le rendu **identique au pixel** a ce qu'il etait, ce qui est la condition pour que
 * cette extraction ne soit pas un changement deguise.
 *
 * ⚠️ Le plancher de 4 px n'est pas cosmetique : une note nulle donnerait une barre de
 * hauteur zero, c'est-a-dire une colonne **absente** — et le joueur compterait mal les
 * saisons.
 */
export function QuizBars({ points, perUnit, label }: {
  readonly points: readonly { readonly label: string; readonly value: number }[];
  /** Pixels par unite de valeur. 16 pour des etoiles (0-5), 12 pour un score (0-10). */
  readonly perUnit: number;
  /** Nom accessible, quand la liste tient lieu de question. */
  readonly label?: string;
}) {
  return (
    <ul className="flex items-end gap-2" {...(label !== undefined ? { 'aria-label': label } : {})}>
      {points.map((point) => (
        <li key={point.label} className="flex flex-col items-center gap-1">
          <span
            className="w-6 rounded-t bg-(--color-volt)"
            style={{ height: `${Math.max(4, point.value * perUnit)}px` }}
          />
          {/* Les barres sont numerotees parce qu'une forme seule ne dit pas ou elle commence. */}
          <span className="text-xs text-(--color-muted)">{point.label}</span>
        </li>
      ))}
    </ul>
  );
}

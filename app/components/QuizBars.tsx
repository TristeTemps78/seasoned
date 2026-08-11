/**
 * La forme d'une serie, sans son nom — la matiere des trois quiz du produit.
 *
 * 🔴 Ce graphique etait ecrit **trois fois** au caractere pres (`Quiz`, `FriendQuiz`,
 * `DailyRound`) : la meme faute que `src/domain/draw.ts` documente sur ces memes modules,
 * reformee un etage plus haut, dans leur affichage.
 *
 * `perUnit` est la seule chose qui differait — 16 px par etoile (0-5), 12 par point de score
 * (0-10) — donc la seule qui reste un reglage. Le rendu est identique au pixel.
 */
export function QuizBars({ points, perUnit, label }: {
  readonly points: readonly { readonly label: string; readonly value: number }[];
  /** Pixels par unite de valeur. */
  readonly perUnit: number;
  /** Nom accessible, quand la liste tient lieu de question. */
  readonly label?: string;
}) {
  return (
    <ul className="flex items-end gap-2" {...(label !== undefined ? { 'aria-label': label } : {})}>
      {points.map((point) => (
        <li key={point.label} className="flex flex-col items-center gap-1">
          {/* ⚠️ Le plancher de 4 px : une note nulle donnerait une colonne **absente**, et
              le joueur compterait mal les saisons. */}
          <span
            className="w-6 rounded-t bg-(--color-volt)"
            style={{ height: `${Math.max(4, point.value * perUnit)}px` }}
          />
          <span className="meta-sm">{point.label}</span>
        </li>
      ))}
    </ul>
  );
}

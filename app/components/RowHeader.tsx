/**
 * L'ouverture d'une grille d'affiches — un filet volt, un libelle, une phrase.
 *
 * Partagee entre l'accueil et la bibliotheque : ce sont **les memes objets**, une grille
 * d'affiches sous un titre, et ils n'avaient aucune raison de se presenter differemment
 * selon la page. Les deux portaient ces cinq lignes au caractere pres, et l'invariant etait
 * promis par trois commentaires sans qu'aucun ne le fasse respecter.
 */
export function RowHeader({ title, subtitle }: {
  readonly title: string;
  readonly subtitle: string;
}) {
  return (
    <div className="section-title">
      <h2 className="row-title">{title}</h2>
      <p className="meta">{subtitle}</p>
    </div>
  );
}

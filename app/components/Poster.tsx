import { posterDimensions, posterUrl } from '@/lib/catalog';

/**
 * Une affiche, ou ce qui la remplace.
 *
 * ## Pourquoi ce composant existe
 *
 * `SeriesCard` et `LibraryCard` portaient chacun leur copie du meme bloc — image, ratio,
 * dimensions declarees, et un repli. Les copies avaient deja diverge : la vignette de
 * recherche affichait un monogramme et la bibliotheque une case grise portant « Pas
 * d'affiche ». **Trois rectangles vides cote a cote, sur l'ecran le plus personnel du
 * produit.**
 *
 * ⚠️ La lecon n'est pas « il fallait factoriser ». C'est que **la duplication ne fait pas
 * de bruit tant qu'on ne regarde pas les deux ecrans le meme jour** : le code compilait,
 * les tests passaient, et l'un des deux etait laid depuis le debut.
 *
 * ## Le monogramme plutot que l'aveu
 *
 * Une case qui annonce « pas d'affiche » est le seul endroit du produit ou l'on affiche un
 * manque. Le monogramme occupe la meme place, **appartient a la serie**, et laisse la
 * grille garder son rythme. Il ignore les articles — `The Walking Dead` donne `WD`, pas `TW` —
 * sans quoi la moitie du catalogue anglophone porterait les memes deux lettres.
 */
export function monogram(title: string): string {
  const words = title
    .split(/[\s:–—-]+/)
    .filter((word) => word.length > 0 && !/^(the|les|le|la|un|une|a|an)$/i.test(word));
  const letters = (words.length > 0 ? words : [title]).slice(0, 2).map((word) => word[0] ?? '');
  return letters.join('').toUpperCase();
}

export function Poster({ path, title, className = '' }: {
  readonly path: string | undefined;
  /** Sert au monogramme, jamais affiche tel quel : le titre est deja sous la vignette. */
  readonly title: string;
  readonly className?: string;
}) {
  const url = posterUrl(path, 'w342');

  if (url === undefined) {
    return (
      <div className="poster-void" aria-hidden="true">
        <span>{monogram(title)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- servi par le CDN TMDB, jamais
    // par nous : c'est une ligne du budget.
    // `width`/`height` declares : sans eux le navigateur ne reserve pas la place et la page
    // saute a l'arrivee des affiches. Le ratio d'une affiche TMDB est constant, on peut
    // donc les donner sans rien charger.
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      width={posterDimensions('w342').width}
      height={posterDimensions('w342').height}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

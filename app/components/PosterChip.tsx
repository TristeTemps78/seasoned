import { Poster } from '@/app/components/Poster';

/**
 * L'affiche d'une serie, en petit, a cote d'une phrase qui parle d'elle.
 *
 * ## 🔴 Le manque qu'elle comble, mesure le 2026-08-11
 *
 * Six composants sur sept rendaient **zero image** : `MyTally`, `MyYear`, `MyStats`,
 * `TasteCard`, `Lists`, `MyProgress`. `/bilan` ecrivait « la saison que vous avez le mieux
 * notee : **Arcane** » sans jamais montrer Arcane. Sur un produit dont le sujet est ce qu'on
 * regarde, c'est le defaut que Tristan resume par « pas de photo, rien ».
 *
 * ## Pourquoi un composant et pas six copies
 *
 * Le bloc — cadre au rapport 2:3, coins coupes, matiere `.panel`, repli en monogramme — a ete
 * ecrit **deux fois dans `Friends.tsx`** avant d'etre nomme, et il en fallait deux de plus.
 * C'est exactement le seuil que `globals.css` se donne pour extraire, et exactement la
 * trajectoire qu'ont suivie `SeriesCard` et `LibraryCard` avant de diverger jusqu'a ce que
 * l'une affiche trois rectangles gris.
 *
 * ⚠️ **`w154` et pas plus.** La vignette est rendue entre 40 et 64 px de large : c'est le plus
 * petit fichier du CDN, et demander `w342` ferait payer quatre fois le poids pour des pixels
 * que personne ne voit. La regle est la meme que celle de `SeriesCard` en sens inverse.
 *
 * ⚠️ **Rien n'est annonce aux lecteurs d'ecran** : la phrase a cote nomme deja la serie.
 * `Poster` rend un `alt=""`, et le monogramme de repli est `aria-hidden`.
 */
export function PosterChip({
  path,
  title,
  wide = false,
}: {
  readonly path: string | undefined;
  /** Sert au monogramme quand l'affiche manque. Jamais affiche tel quel. */
  readonly title: string;
  /** Le format des mises en avant — `/bilan`, `/mon annee`. Par defaut, le format du fil. */
  readonly wide?: boolean;
}) {
  return (
    // 🔴 **`w-16` etait un timbre-poste.** Densite d'image mesuree sur `/bilan` le
    // 2026-08-12 : **0,5 %** de la surface rendue, pour une page dont le point d'arrivee est
    // « la saison que vous avez le mieux notee » — annoncee avec une affiche de 64 x 96 px.
    // A `w-28`, la meme affiche couvre six fois plus de surface, et la mise en avant se lit
    // enfin comme une mise en avant.
    //
    // ⚠️ Le format du fil ne bouge **pas** : la, une ligne par personne doit rester une
    // ligne, et c'est exactement pourquoi ce composant a deux tailles plutot qu'une.
    <span
      className={`poster-frame block shrink-0 ${wide ? 'w-28' : 'w-10'}`}
    >
      {/* Le rapport vit sur un enfant et non sur le cadre : `Poster` rend un `<img>` en
          `h-full`, qui sans hauteur donnee s'effondre a la hauteur de son alt — c'est-a-dire
          zero. Le defaut est invisible au typage et donne une vignette de 0 px. */}
      <span className="block aspect-2/3">
        <Poster path={path} title={title} size="w154" />
      </span>
    </span>
  );
}

import { episodeGroupings } from '@/lib/catalog';
import { findDivergentOrderings } from '@/src/domain/ordering';
import { OrderingNotice } from '@/app/components/OrderingNotice';
import type { Locale } from '@/lib/i18n';

/**
 * Le maillon qui va chercher les decoupages concurrents et decide s'il y a lieu de parler.
 *
 * ## Pourquoi ce fichier existe au lieu d'etre une fonction dans la page
 *
 * Il y a d'abord vecu. Le probleme n'etait pas la lisibilite : c'est qu'**aucun test ne
 * pouvait l'atteindre**. Une page serie est un composant serveur asynchrone dont l'arbre
 * contient d'autres composants asynchrones ; la rendre dans un test exige un rendu qui
 * resolve toute la cascade. Resultat : le calcul etait couvert, le composant d'affichage
 * etait couvert, et **le fil entre les deux ne l'etait pas**.
 *
 * C'est exactement ainsi qu'`episodeMinutes` a ete livre mort-ne — chaque piece juste, la
 * chaine jamais parcourue. Ici la cascade s'arrete : ce composant est asynchrone, mais ce
 * qu'il rend est **synchrone**, donc `render(await SeriesOrderings(...))` traverse tout le
 * chemin — fournisseur, cache, domaine, affichage — en une ligne.
 *
 * ## Ce qu'il coute
 *
 * Un appel de plus par serie et par cycle de cache de 24 h, pour une reponse minuscule. Et
 * **zero octet de JavaScript** : ni ce composant ni {@link OrderingNotice} ne portent
 * `'use client'`, parce que rien ici ne depend du journal.
 *
 * ## `seasonCount` vient de la page, et ce n'est pas un detail
 *
 * Ce sont **les chiffres affiches** qui doivent servir de reference (`seasons.rateable`,
 * saison 0 exclue). Comparer un decoupage alternatif a un total different de celui qu'on
 * montre fabriquerait un ecart qui n'existe que dans notre calcul.
 */
export async function SeriesOrderings({ id, seasonCount, episodeCount, locale }: {
  readonly id: string;
  readonly seasonCount: number;
  readonly episodeCount: number;
  readonly locale: Locale;
}) {
  const groupings = await episodeGroupings(id);
  return (
    <OrderingNotice
      notice={findDivergentOrderings({ seasonCount, episodeCount }, groupings)}
      seasonCount={seasonCount}
      episodeCount={episodeCount}
      locale={locale}
    />
  );
}

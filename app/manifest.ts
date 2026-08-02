import type { MetadataRoute } from 'next';

/**
 * Le manifeste qui rend l'application **installable sur les cinq plateformes**.
 *
 * Arbitrage A8 (2026-08-02) : le produit doit exister sur le web, iPhone, Android,
 * macOS et Windows. Le reflexe serait d'aller chercher du natif ; c'est l'inverse qu'il
 * faut faire.
 *
 *   - le natif est **materiellement impossible ici** — pas de Mac, PC Windows ARM64,
 *     et le projet voisin `Limits` est mort exactement de ce mur (`ROADMAP.md` §1.1) ;
 *   - une PWA installee **est** une application sur iOS ≥ 16.4, Android, macOS et
 *     Windows : icone, plein ecran, lancement hors navigateur.
 *
 * Autrement dit la contrainte multiplateforme **renforce** le choix du web au lieu de
 * le contredire. Elle ne demandait qu'une chose : que la PWA existe. Elle etait promise
 * par `ROADMAP.md` §1.1 depuis le premier jour et n'avait jamais ete construite — ni
 * manifeste, ni icone, ni service worker. Une fonctionnalite ecrite n'est pas une
 * fonctionnalite qui marche.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'seasoned — est-ce que ça vaut le coup ?',
    short_name: 'seasoned',
    description:
      'Où en est une série, combien de temps elle demande, et jusqu’où elle reste bonne.',
    lang: 'fr',
    // L'accueil, et pas `/moi` : quelqu'un qui vient d'installer n'a pas de journal,
    // et l'accueillir sur une page vide serait le pire premier ecran possible. La
    // bande « Reprendre » y amene ceux qui en ont un.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1115',
    theme_color: '#0f1115',
    categories: ['entertainment', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Android rogne les icones en cercle, carre arrondi ou goutte selon le lanceur :
      // celle-ci garde une marge pour survivre a la decoupe.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Menu long-clic sur l'icone. Les deux seules destinations qui valent un raccourci :
    // ce qu'on a laisse en cours, et la recherche.
    shortcuts: [
      { name: 'Ma bibliothèque', short_name: 'Chez moi', url: '/moi' },
      { name: 'Chercher une série', short_name: 'Chercher', url: '/recherche' },
    ],
  };
}

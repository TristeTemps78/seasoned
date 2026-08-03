import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, localeTag, t } from '@/lib/i18n';
import { PRODUCT_NAME } from '@/lib/site';

/**
 * Le manifeste qui rend l'application **installable sur les cinq plateformes**.
 *
 * Arbitrage A8 (2026-08-02) : le produit doit exister sur le web, iPhone, Android,
 * macOS et Windows. Une PWA installee **est** une application sur iOS >= 16.4, Android,
 * macOS et Windows : icone, plein ecran, lancement hors navigateur. Elle etait promise
 * par `ROADMAP.md` §1.1 depuis le premier jour et n'avait jamais ete construite — ni
 * manifeste, ni icone, ni service worker. Une fonctionnalite ecrite n'est pas une
 * fonctionnalite qui marche.
 *
 * ## ⚠️ Ce commentaire affirmait une chose fausse (corrige le 2026-08-03, A11)
 *
 * Il disait : « le natif est **materiellement impossible ici** — pas de Mac, PC Windows
 * ARM64, et le projet voisin `Limits` est mort exactement de ce mur ». L'observation etait
 * juste, l'inference non : `Limits` a bati un **IPA en Release** depuis ce PC, en CI, sur
 * un runner macOS heberge. Il a bute sur le **sideload sans compte developpeur**, pas sur
 * le build. Detail et consequences dans `ROADMAP.md` §1.1.
 *
 * **Ce manifeste ne devient pas inutile pour autant, et c'est le point** : le natif est un
 * canal de **retention**, le web est le seul canal d'**acquisition** (une application n'a
 * pas de SEO). La PWA reste donc le socle et le chemin le moins cher vers les cinq
 * plateformes ; elle n'est simplement plus le **seul** chemin possible.
 *
 * ## ⚠️ Un seul manifeste, donc une seule langue : celle par defaut
 *
 * Un manifeste est servi a une adresse unique et **avant** toute navigation : il n'y a
 * ni page, ni locale, ni preference a consulter au moment ou le systeme le lit. Il etait
 * ecrit en francais alors que le site est desormais servi en anglais par defaut — donc
 * un utilisateur anglophone installait une application au nom francais.
 *
 * Le declarer dans la langue par defaut est le seul choix coherent, et `lang` doit dire
 * la verite : c'est cet attribut que les magasins d'applications et les lanceurs lisent.
 * Servir un manifeste par langue demanderait une route dynamique — donc une invocation
 * a chaque installation, pour un gain nul sur le seul canal qui compte.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME} — ${t(DEFAULT_LOCALE, 'nav.tagline')}`,
    short_name: PRODUCT_NAME,
    description: t(DEFAULT_LOCALE, 'meta.description'),
    lang: localeTag(DEFAULT_LOCALE),
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
      {
        name: t(DEFAULT_LOCALE, 'library.title'),
        short_name: t(DEFAULT_LOCALE, 'library.title'),
        url: '/moi',
      },
      {
        name: t(DEFAULT_LOCALE, 'library.empty.search'),
        short_name: t(DEFAULT_LOCALE, 'search.submit'),
        url: '/recherche',
      },
    ],
  };
}

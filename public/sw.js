/**
 * Service worker — volontairement minimal.
 *
 * Il fait deux choses, et surtout : il se retient d'en faire une troisieme.
 *
 *   1. **Les pages deja visitees restent consultables hors ligne.** Le journal vivant
 *      dans le navigateur, `/moi` fonctionne alors entierement sans reseau : sa
 *      bibliotheque marche dans le metro, sans compte et sans appel.
 *   2. **Les fichiers de `_next/static` sont servis depuis le cache.** Ils portent leur
 *      empreinte dans leur nom : ils ne changent jamais a URL constante, donc les
 *      mettre en cache pour toujours est exact, pas optimiste.
 *
 * Ce qu'il ne fait **pas**, et c'est deliberè : pre-charger le catalogue, mettre en
 * cache agressivement les pages serie, ou servir du cache avant le reseau sur une
 * navigation. Ces pages sont deja mises en cache au bord avec une revalidation
 * quotidienne ; un service worker gourmand servirait une grille de diffusion perimee
 * en croyant bien faire — et le pire defaut d'un service worker est de coller a une
 * version morte du site.
 *
 * D'ou la strategie : **reseau d'abord, cache en filet**. Le reseau reste la verite ;
 * le cache ne parle que lorsqu'il n'y a plus de reseau.
 */

// Changer ce numero suffit a purger tout ce qui precede : les anciens caches sont
// supprimes a l'activation.
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE = '/hors-ligne';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(OFFLINE))
      // Une installation ne doit jamais echouer sur un pre-chargement : au pire, la
      // page de repli manquera et le navigateur affichera la sienne.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== PAGES && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Cache-first : reserve a ce qui est immuable par construction. */
async function fromCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached !== undefined) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSETS);
    cache.put(request, response.clone());
  }
  return response;
}

/** Reseau d'abord, cache en filet, page hors ligne en dernier recours. */
async function fromNetworkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGES);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached !== undefined) return cached;
    const fallback = await caches.match(OFFLINE);
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Rien d'autre que des lectures de notre propre origine. Les affiches viennent du
  // CDN de TMDB et sont deja mises en cache par le navigateur : les reprendre ici
  // ferait grossir le stockage pour rien (`ROADMAP.md` §1.4).
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(fromCacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fromNetworkFirst(request));
  }
});

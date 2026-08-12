/**
 * Le **seul** module qui connaisse la forme de l'authentification Supabase.
 *
 * Meme regle que `CatalogProvider` pour le catalogue : changer de
 * fournisseur d'identite doit rester un module a reecrire, jamais une application a
 * reprendre. Rien d'autre dans le depot n'importe `@supabase/*` pour l'auth.
 *
 * ## Pourquoi le SDK ici, alors que `remote.ts` fait du `fetch` brut
 *
 * Ce n'est pas une incoherence, c'est la meme regle appliquee a deux problemes differents.
 * Lire et ecrire une ligne de table, c'est un GET et un POST : le SDK n'y apporte qu'une
 * syntaxe. **L'authentification, non.** Le point dur n'est ni PKCE ni le lien magique —
 * c'est la **rotation du jeton de rafraichissement a plusieurs onglets** : Supabase fait
 * tourner le jeton, et deux onglets qui rafraichissent en meme temps en revoquent un,
 * deconnectant la personne sans raison visible. `navigatorLock` resout ca. Le reecrire,
 * c'est signer pour ce defaut-la.
 *
 * ## ⛔ Ne pas installer `@supabase/ssr`
 *
 * C'est le conseil par defaut partout sur le web, et il est **faux ici**. Tout son interet
 * est de ranger la session dans un cookie lu par un `middleware` et des composants
 * serveur. Or ce depot a mesure trois fois ce que coute une route qui s'execute a chaque
 * requete :
 *
 * - `app/(site)/serie/[id]/page.tsx` — verifie en production : une route dynamique repond
 *   `X-Vercel-Cache: MISS` et `Cache-Control: no-store` la ou une route statique repond
 *   `PRERENDER`. Le cache de bord ne s'applique plus **du tout** ;
 * - `lib/routes.ts` — « un middleware s'execute a *chaque* requete, y compris celles que
 *   le CDN servirait sans nous : une invocation facturee par visite » ;
 * - `next.config.ts` — le nonce CSP a ete refuse pour exactement cette raison.
 *
 * Ici la session vit **dans le navigateur**, et le serveur ne la voit jamais. Toutes les
 * pages restent `force-static`. C'est aussi ce qui garde vraie la promesse Q12 : si la
 * base tombe, le produit continue.
 *
 * ## Import dynamique
 *
 * Le SDK n'est charge que par les pages qui s'y connectent. `/`, `/serie/*` et `/moi` —
 * c'est-a-dire tout le canal d'acquisition — n'en telechargent pas un octet.
 */

import type { AuthChangeEvent, AuthClient, Session, Subscription } from '@supabase/auth-js';

/** L'instance, et non la classe : `AuthClient` est une valeur, pas un type. */
type Auth = InstanceType<typeof AuthClient>;

export interface AuthConfig {
  /** Racine du projet Supabase, sans barre finale. */
  readonly url: string;
  /** Cle publique. Destinee au navigateur : ce n'est pas un secret, RLS protege. */
  readonly anonKey: string;
}

/**
 * Ou range-t-on la session.
 *
 * Prefixe comme le journal (`voltface.*`) et **versionne** : le jour ou la forme change,
 * l'ancienne cle est ignoree plutot que mal relue.
 */
const STORAGE_KEY = 'voltface.auth.v1';

/**
 * Y a-t-il une session rangee dans ce navigateur ? **Sans charger le SDK.**
 *
 * ## 🔴 Le defaut que ceci repare, et il a ete mesure et non deduit
 *
 * J'avais ecrit que l'import dynamique suffisait a garder les pages d'acquisition
 * gratuites. **C'etait faux.** `AuthProvider` vit dans `SiteChrome`, donc il monte sur
 * *toutes* les pages, et son effet demandait le client tout de suite : verifie au reseau
 * sur `/serie/1396`, le chunk `auth-js` etait bel et bien telecharge — **24 Ko gzip pour
 * un visiteur qui n'a pas de compte**, sur la page meme que les moteurs indexent.
 *
 * L'import dynamique isole le chunk ; il ne decide pas **quand** on le demande. C'est
 * encore *auditer le resultat, jamais l'intention*.
 *
 * La reponse tient en une lecture de `localStorage` : qui n'a pas de session rangee n'a
 * rien a rafraichir, donc rien a charger. Qui en a une paie 24 Ko — et c'est justifie.
 *
 * ⚠️ Ce n'est pas une verification d'authenticite : la cle peut etre perimee ou fabriquee.
 * C'est un **indice**, et le seul usage qu'on en fait est de decider s'il vaut la peine de
 * telecharger le SDK. Le SDK, lui, tranche.
 */
export function hasStoredSession(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== null;
  } catch {
    // Stockage refuse (navigation privee stricte, iframe cloisonnee) : on ne charge rien.
    return false;
  }
}

let client: Auth | undefined;
let pending: Promise<Auth> | undefined;

/**
 * Le client d'authentification, construit **une seule fois** et a la demande.
 *
 * ⚠️ Deux instances se battraient pour le meme jeton de rafraichissement — c'est le
 * defaut que `navigatorLock` evite **entre onglets**, et qu'un doublon reintroduirait
 * **dans le meme onglet**. D'ou le cache de promesse : deux appels concurrents pendant le
 * chargement du module rendent le meme client.
 */
async function authClient(config: AuthConfig): Promise<Auth> {
  if (client !== undefined) return client;
  if (pending !== undefined) return pending;

  pending = (async () => {
    const { AuthClient: Ctor, navigatorLock } = await import('@supabase/auth-js');
    client = new Ctor({
      url: `${config.url.replace(/\/$/, '')}/auth/v1`,
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
      storageKey: STORAGE_KEY,
      // PKCE et non le flux implicite : le jeton ne transite pas dans le fragment d'URL,
      // donc il ne finit ni dans l'historique ni dans un `Referer`.
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      // ⚠️ Faux **a dessein** : on veut finir l'echange nous-memes, pour nettoyer l'URL et
      // nommer les trois issues. Laisser le SDK le faire en silence rendrait « le lien a
      // ete ouvert dans un autre navigateur » indiscernable de « lien invalide ».
      detectSessionInUrl: false,
      // Le verrou inter-onglets. Sans lui, deux onglets qui rafraichissent en meme temps
      // en revoquent un, et la personne est deconnectee sans comprendre pourquoi.
      lock: navigatorLock,
    });
    return client;
  })();

  return pending;
}

/** Ce que l'application connait d'une personne connectee. */
export interface Account {
  readonly userId: string;
  readonly email?: string;
  readonly accessToken: string;
}

function accountOf(session: Session | null): Account | undefined {
  if (session === null) return undefined;
  return {
    userId: session.user.id,
    ...(session.user.email !== undefined ? { email: session.user.email } : {}),
    accessToken: session.access_token,
  };
}

/**
 * Suit la session, maintenant et a chaque changement.
 *
 * Rend de quoi se desabonner. Le premier appel remonte l'etat courant — sans quoi une page
 * ouverte alors qu'on est deja connecte croirait ne pas l'etre jusqu'au premier evenement.
 */
export async function watchAccount(
  config: AuthConfig,
  onChange: (account: Account | undefined) => void,
): Promise<() => void> {
  const auth = await authClient(config);

  const { data } = auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    onChange(accountOf(session));
  });

  const { data: current } = await auth.getSession();
  onChange(accountOf(current.session));

  const subscription: Subscription | null = data.subscription;
  return () => subscription?.unsubscribe();
}

/** Ce qui peut arriver quand on demande un lien de connexion. */
export type SignInOutcome =
  | { readonly kind: 'sent' }
  /** Trop de tentatives, ou service d'e-mail sature. */
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'failed' };

/**
 * Envoie un lien magique — et un code a six chiffres dans le meme e-mail.
 *
 * @param redirectTo l'adresse **absolue** de la page de retour, dans la langue courante.
 */
export async function sendMagicLink(
  config: AuthConfig,
  email: string,
  redirectTo: string,
): Promise<SignInOutcome> {
  try {
    const auth = await authClient(config);
    const { error } = await auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error === null) return { kind: 'sent' };
    // ⚠️ Le cas le plus probable en pratique, et il n'est pas une panne : sans SMTP
    // configure, le service integre de Supabase plafonne a quelques envois par heure. Le
    // dire evite de chercher un defaut de code la ou il y a un reglage de tableau de bord.
    return { kind: error.status === 429 ? 'rate_limited' : 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

/** Vérifie le code a six chiffres — le repli quand le lien a ete ouvert ailleurs. */
export async function verifyCode(
  config: AuthConfig,
  email: string,
  token: string,
): Promise<boolean> {
  try {
    const auth = await authClient(config);
    const { error } = await auth.verifyOtp({ email, token, type: 'email' });
    return error === null;
  } catch {
    return false;
  }
}

/**
 * Google est-il reellement branche sur ce projet ?
 *
 * ## 🔴 Le defaut que cette fonction repare, constate le 2026-08-09
 *
 * Le bouton « Continuer avec Google » etait affiche **en dur**, et le fournisseur n'a
 * jamais ete active cote Supabase (`external_google_enabled: false`, ni identifiant ni
 * secret). Supabase repond donc « provider is not enabled » — que {@link signInWithGoogle}
 * **avalait**, au nom du contrat « on degrade, on n'interrompt pas ». Resultat : on clique,
 * il ne se passe rien, et rien ne dit pourquoi.
 *
 * > *On degrade quand une fonctionnalite a un repli. Ici il n'y en a pas : le bouton ne
 * > peut pas marcher. Un bouton qui ne peut pas marcher ne se degrade pas, il ne s'affiche
 * > pas.*
 *
 * `/auth/v1/settings` est **public** (la cle publiable suffit) et dit exactement quels
 * fournisseurs sont actifs. On demande donc au lieu de supposer — et le bouton reapparaitra
 * **tout seul** le jour ou le fournisseur sera configure, sans redeploiement ni drapeau a
 * penser a retirer.
 *
 * En cas de panne reseau, on rend « rien d'active » : l'erreur va vers le lien par courriel,
 * qui marche. Meme sens que partout ailleurs ici — omettre n'est qu'un oubli.
 */
export async function enabledProviders(config: AuthConfig): Promise<ReadonlySet<string>> {
  try {
    const response = await fetch(`${config.url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
    });
    if (!response.ok) return new Set();
    const body: unknown = await response.json();
    const external = (body as { external?: Record<string, unknown> } | null)?.external;
    if (external === undefined || external === null) return new Set();
    return new Set(
      Object.entries(external)
        .filter(([, on]) => on === true)
        .map(([name]) => name),
    );
  } catch {
    return new Set();
  }
}

/**
 * Part vers Google.
 *
 * ⚠️ C'est une **navigation de premier niveau**, pas une requete : aucune directive CSP ne
 * la gouverne (`connect-src` ne s'applique pas, `form-action` non plus puisque ce n'est
 * pas une soumission). Rien a ouvrir dans `next.config.ts`.
 *
 * Rend `false` quand le depart n'a pas pu avoir lieu — voir {@link enabledProviders} pour
 * la raison pour laquelle le silence d'avant etait une faute et non une prudence.
 */
export async function signInWithGoogle(
  config: AuthConfig,
  redirectTo: string,
): Promise<boolean> {
  try {
    const auth = await authClient(config);
    const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    return error === null;
  } catch {
    return false;
  }
}

/** Les issues d'un retour de lien, nommees — voir {@link finishSignIn}. */
export type CallbackOutcome =
  | { readonly kind: 'signed_in' }
  /**
   * Le verificateur PKCE n'est pas dans ce navigateur.
   *
   * ⚠️ **C'est le seul echec *normal* de PKCE**, et le rendre comme « lien invalide »
   * pousse a redemander un lien qui echouera pareil. Le verificateur est range dans le
   * `localStorage` de l'onglet qui a demande le lien : l'ouvrir ailleurs ne peut pas
   * marcher — et c'est aussi ce qui rend un lien magique **intransferable**.
   */
  | { readonly kind: 'wrong_browser' }
  /** Lien expire, deja utilise, ou tronque par le client de messagerie. */
  | { readonly kind: 'expired' }
  /** Rien a echanger : la page a ete ouverte a la main. */
  | { readonly kind: 'nothing_to_do' };

/**
 * Termine la connexion depuis l'URL de retour.
 *
 * Ne lit **que** ce que le navigateur a : le serveur n'a jamais vu ce code, et n'a rien a
 * en faire. C'est ce qui permet a `/compte/retour` de rester une page statique.
 */
export async function finishSignIn(
  config: AuthConfig,
  href: string,
): Promise<CallbackOutcome> {
  const url = new URL(href);
  const code = url.searchParams.get('code');
  const errorCode = url.searchParams.get('error_code') ?? url.searchParams.get('error');

  if (code === null) {
    return errorCode === null ? { kind: 'nothing_to_do' } : { kind: 'expired' };
  }

  /**
   * 🔴 **Echantillonne AVANT l'echange, et c'est tout le correctif.**
   *
   * Mesure au navigateur le 2026-08-12 : une tentative d'echange **supprime le verificateur
   * du `localStorage`, y compris quand elle echoue**. L'appeler apres coup, comme le faisait
   * la version precedente, revenait donc a lire une valeur que l'appel venait de detruire :
   * la reponse etait « pas de verificateur » **quel que soit** le vrai cas, et tout echec —
   * lien expire, code deja brule, panne reseau — s'annoncait « vous avez ouvert le lien dans
   * un autre navigateur ». Le seul message qui ne dise pas de redemander un lien etait donne
   * a toutes les situations ou il en faut justement un nouveau.
   */
  const mine = hasVerifier();

  try {
    const auth = await authClient(config);
    const { error } = await auth.exchangeCodeForSession(code);
    if (error === null) return { kind: 'signed_in' };
    // Pas de verificateur range ici : le lien vient d'un autre navigateur.
    return mine ? { kind: 'expired' } : { kind: 'wrong_browser' };
  } catch {
    return mine ? { kind: 'expired' } : { kind: 'wrong_browser' };
  }
}

/**
 * Le verificateur PKCE a-t-il ete depose par CE navigateur ?
 *
 * ⚠️ **Toutes les cles, et pas seulement `<cle>-code-verifier`.** Releve au navigateur le
 * 2026-08-12, apres deux demandes de lien depuis ce poste :
 *
 *     voltface.auth.v1-flow-192c08bf…-code-verifier
 *     voltface.auth.v1-flow-ffbfee8c…-code-verifier
 *     voltface.auth.v1-code-verifier
 *     voltface.auth.v1-flows-code-verifier
 *
 * `@supabase/auth-js` range un verificateur **par flux** depuis qu'il en supporte plusieurs
 * en parallele ; la cle historique n'est qu'un des quatre noms. Chercher celle-la seule
 * repondait « non » a quelqu'un qui a pourtant demande son lien ici — donc « ouvert dans un
 * autre navigateur » a qui est au bon endroit.
 */
function hasVerifier(): boolean {
  try {
    const store = globalThis.localStorage;
    if (store === undefined || store === null) return false;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key !== null && key.startsWith(STORAGE_KEY) && key.endsWith('code-verifier')) return true;
    }
    return false;
  } catch {
    // Stockage refuse (navigation privee stricte, iframe cloisonnee).
    return false;
  }
}

export async function signOut(config: AuthConfig): Promise<void> {
  try {
    const auth = await authClient(config);
    await auth.signOut();
  } catch {
    // Idem : ne jamais interrompre. La session locale est de toute facon jetee.
  }
}

/**
 * Supprime le compte, immediatement et sans delai de grace (Q5).
 *
 * ## Comment on fait ca sans `service_role`
 *
 * Supprimer une ligne d'`auth.users` par l'API d'administration exigerait la cle
 * `service_role`, **interdite au navigateur** (regle 5) — et un serveur qui la porterait
 * serait la premiere surface d'ecriture privilegiee du projet — ce qui a ete
 * explicitement refuse pour les webhooks.
 *
 * A la place, une fonction Postgres `security definer` **sans argument**, appelee par le
 * compte lui-meme : le privilege vit dans la definition de la fonction, jamais dans une
 * variable d'environnement, jamais dans le depot. Voir `supabase/002_account.sql`.
 *
 * Tout le reste suit par `on delete cascade` — et c'est l'argument decisif de ce patron :
 * **il n'a pas a grandir**. Chaque table ajoutee est couverte le jour ou elle est creee,
 * sans qu'on pense a modifier une routine de suppression. C'est exactement ainsi qu'une
 * suppression finit par etre incomplete.
 */
export async function deleteAccount(
  config: AuthConfig,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/delete_me`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * La configuration lue depuis l'environnement, ou `undefined`.
 *
 * `undefined` n'est pas une erreur : c'est l'etat normal d'un developpement sans compte,
 * et l'interface doit alors se **taire** plutot qu'afficher un formulaire qui ne peut pas
 * marcher — meme regle que `/mentions` sans identite d'editeur.
 */
export function authConfigFromEnv(): AuthConfig | undefined {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (url === undefined || anonKey === undefined) return undefined;
  if (url.trim().length === 0 || anonKey.trim().length === 0) return undefined;
  return { url: url.trim(), anonKey: anonKey.trim() };
}

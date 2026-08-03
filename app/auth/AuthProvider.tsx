'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  authConfigFromEnv,
  deleteAccount,
  finishSignIn,
  hasStoredSession,
  sendMagicLink,
  signInWithGoogle,
  signOut,
  verifyCode,
  watchAccount,
  type Account,
  type AuthConfig,
  type CallbackOutcome,
  type SignInOutcome,
} from '@/src/auth/client';

/**
 * La session, telle qu'elle descend jusqu'aux gestes.
 *
 * Meme patron que `LocaleProvider`, et pour la meme raison : les composants qui en ont
 * besoin sont rendus par d'autres composants client, donc une prop devrait traverser des
 * couches qui n'en ont aucun usage.
 *
 * ## Ce qui garde les pages statiques
 *
 * Tout se passe dans un `useEffect`. Le premier rendu client est **identique au HTML
 * servi** — `ready` faux, `account` absent —, donc aucun desaccord d'hydratation et aucune
 * page n'a besoin de devenir dynamique. C'est la meme discipline que `useJournal`, et
 * c'est ce qui permet a `/compte` de rester `force-static` comme le reste du site.
 *
 * ## `ready` n'est pas `account === undefined`
 *
 * Distinguer « je ne sais pas encore » de « personne n'est connecte » evite le clignotement
 * qui montre le formulaire de connexion une demi-seconde a quelqu'un qui est deja connecte.
 * Le journal a la meme distinction, pour la meme raison.
 */
export interface AuthState {
  /** La configuration existe-t-elle ? Sans elle, l'interface se **tait**. */
  readonly configured: boolean;
  /** A-t-on fini de regarder s'il y a une session ? */
  readonly ready: boolean;
  readonly account: Account | undefined;
  readonly sendLink: (email: string, redirectTo: string) => Promise<SignInOutcome>;
  readonly submitCode: (email: string, code: string) => Promise<boolean>;
  readonly withGoogle: (redirectTo: string) => Promise<void>;
  readonly completeCallback: (href: string) => Promise<CallbackOutcome>;
  readonly leave: () => Promise<void>;
  readonly erase: () => Promise<boolean>;
}

const NOT_CONFIGURED: AuthState = {
  configured: false,
  ready: true,
  account: undefined,
  sendLink: async () => ({ kind: 'failed' }),
  submitCode: async () => false,
  withGoogle: async () => undefined,
  completeCallback: async () => ({ kind: 'nothing_to_do' }),
  leave: async () => undefined,
  erase: async () => false,
};

const AuthContext = createContext<AuthState>(NOT_CONFIGURED);

export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  // ⚠️ Lu au rendu et non dans l'effet : `process.env.NEXT_PUBLIC_*` est remplace a la
  // compilation, donc c'est une constante — pas un acces a l'environnement du navigateur.
  const config = useMemo(() => authConfigFromEnv(), []);
  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [ready, setReady] = useState(false);

  // ⚠️ Ne rien charger pour qui n'a pas de session — voir `hasStoredSession`. Ce
  // fournisseur monte sur TOUTES les pages, donc sans cette garde le SDK partait sur
  // `/serie/*`, mesure au reseau : 24 Ko gzip pour un visiteur sans compte, sur les pages
  // que les moteurs indexent. `engaged` le rallume des que quelqu'un fait un geste
  // d'authentification.
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    if (config === undefined) {
      setReady(true);
      return;
    }

    if (!engaged && !hasStoredSession()) {
      // Personne n'est connecte ici : la reponse est connue sans rien telecharger.
      setReady(true);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void watchAccount(config, (next) => {
      if (cancelled) return;
      setAccount(next);
      setReady(true);
    }).then((stop) => {
      // La page a pu etre quittee pendant le chargement du SDK : on se desabonne alors
      // aussitot, sans quoi l'abonnement survivrait au composant.
      if (cancelled) stop();
      else unsubscribe = stop;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [config, engaged]);

  const value = useMemo<AuthState>(() => {
    if (config === undefined) return NOT_CONFIGURED;
    return authStateFor(config, account, ready, () => setEngaged(true));
  }, [config, account, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function authStateFor(
  config: AuthConfig,
  account: Account | undefined,
  ready: boolean,
  engage: () => void,
): AuthState {
  // Chaque action commence par declarer qu'on s'engage : c'est ce qui allume l'ecoute des
  // changements de session pour quelqu'un qui n'en avait pas encore. Sans cela, se
  // connecter n'aurait aucun effet visible avant un rechargement.
  const start = <T,>(run: () => Promise<T>): Promise<T> => {
    engage();
    return run();
  };

  return {
    configured: true,
    ready,
    account,
    sendLink: (email, redirectTo) => start(() => sendMagicLink(config, email, redirectTo)),
    submitCode: (email, code) => start(() => verifyCode(config, email, code)),
    withGoogle: (redirectTo) => start(() => signInWithGoogle(config, redirectTo)),
    completeCallback: (href) => start(() => finishSignIn(config, href)),
    leave: () => signOut(config),
    erase: async () =>
      account === undefined ? false : deleteAccount(config, account.accessToken),
  };
}

/** La session courante. */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

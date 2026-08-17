'use client';

import { useMemo, useRef } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { socialFrom } from '@/app/social/socialFrom';
import type { SocialClient, SocialOptions } from '@/src/social/client';

/**
 * Le client social de ce rendu — ou **rien tant qu'on ne sait pas qui regarde**.
 *
 * ## 🔴 Le defaut que ce crochet supprime, et il se mesurait en appels
 *
 * Mesure sur la production le 2026-08-17, connecte : **23 appels Supabase pour un profil**
 * (`profiles` x5, `activity` x5, `favorites` x3, `tags` x3), **16 pour une fiche serie**
 * (`stop_map`, `reviews`, `review_like_counts`, `review_comments`, chacun deux fois).
 *
 * La cause n'etait pas un rechargement : chaque effet dependait d'`accessToken`, qui vaut
 * `undefined` au premier rendu puis recoit la session. **Tout partait donc une fois en
 * visiteur anonyme, s'affichait, puis etait refait et remplace.** Consequence visible en
 * plus du cout : un profil reserve aux abonnes clignotait vide avant de se remplir.
 *
 * ## ⚠️ Pourquoi ce n'est PAS `if (!ready) return;` dans onze composants
 *
 * C'est la reponse evidente, et c'est la faute que ce depot a deja payee **deux fois**.
 * `onFailure` etait propage jusqu'a `socialFrom`, documente, teste — et aucun des douze
 * appelants ne le passait. `failures.ts` a ensuite choisi un canal de module plutot qu'un
 * contexte React en l'ecrivant noir sur blanc : *« un contexte aurait demande de toucher les
 * douze fichiers — c'est-a-dire la raison meme pour laquelle ce rappel n'a jamais ete
 * branche »*. Une regle que onze appelants doivent se rappeler, le douzieme ecrit demain
 * l'oubliera.
 *
 * ## Le jeton n'a jamais eu besoin d'etre une dependance
 *
 * `SocialClient` le relit **a chaque appel** — c'est le contrat de
 * {@link SocialOptions.accessToken}, et `socialFrom` le documente : *« le jeton se rafraichit,
 * et un client construit au montage doit continuer d'emettre le jeton courant »*. Le seul
 * element qui n'etait pas paresseux etait le **parametre**, et c'est lui, dans les tableaux de
 * dependances, qui declenchait la seconde lecture.
 *
 * Ici l'identite du client ne depend donc que de `ready`, qui bascule **exactement une fois**.
 * Les appelants passent de `[accessToken]` a `[social]` : une lecture par page, apres que la
 * session soit connue.
 *
 * ⚠️ **Et la double lecture devient inecrivable** : il n'y a plus de jeton dans une dependance
 * pour la declencher. C'est *rendre l'erreur impossible plutot qu'improbable*, la phrase que
 * `FriendsFeed` porte deja.
 *
 * ## `undefined` reste ce qu'il a toujours ete
 *
 * Le contrat de `socialFrom` ne bouge pas : `undefined` veut dire « se taire », et les douze
 * appelants le traitent deja ainsi. Il couvre desormais **deux** situations au lieu d'une —
 * pas de configuration, et session pas encore connue — et aucun appelant n'a a les
 * distinguer. C'est precisement ce qui permet de ne toucher a aucune de leurs conditions.
 */
export function useSocial(onFailure?: SocialOptions['onFailure']): SocialClient | undefined {
  const { ready, account } = useAuth();

  /**
   * Le jeton courant, hors du calcul d'identite.
   *
   * ⚠️ Une reference et non une dependance : c'est tout l'objet de ce crochet. Le client lit
   * `token.current` au moment de l'appel, donc un jeton rafraichi part avec la requete
   * suivante sans que rien ne se reconstruise.
   */
  const token = useRef<string | undefined>(undefined);
  token.current = account?.accessToken;

  return useMemo(
    () => (ready ? socialFrom(() => token.current, onFailure) : undefined),
    [ready, onFailure],
  );
}

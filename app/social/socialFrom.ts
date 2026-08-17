import { authConfigFromEnv } from '@/src/auth/client';
import { SocialClient, type SocialOptions } from '@/src/social/client';
import { reportFailure } from '@/app/social/failures';

/**
 * Un client social, ou **rien** faute de configuration.
 *
 * ## Ce que ce fichier remplace
 *
 * Douze composants portaient la meme ceremonie, mot pour mot :
 *
 * ```ts
 * const config = authConfigFromEnv();
 * if (config === undefined) return;
 * const social = new SocialClient({
 *   url: config.url,
 *   anonKey: config.anonKey,
 *   accessToken: () => accessToken,
 * });
 * ```
 *
 * ⚠️ **Et ce n'etait pas qu'un probleme de lignes.** `onFailure` a ete ajoute le 2026-08-11
 * pour qu'un echec cesse d'etre indiscernable d'un vide ; le cabler a demande de toucher un
 * composant, et il y en avait douze. Une option nouvelle sur le client social se propage
 * desormais en un seul endroit — ce qui est la vraie raison de ce fichier, la brievete
 * n'etant que sa consequence.
 *
 * ## `undefined` n'est pas une erreur
 *
 * C'est l'etat normal d'un developpement sans base, et l'appelant doit alors **se taire**
 * plutot qu'afficher un ecran qui ne peut pas marcher — meme regle que `authConfigFromEnv`,
 * dont ce module ne fait que prolonger le contrat.
 *
 * ## ⚠️ Le jeton arrive en LECTEUR, pas en valeur
 *
 * `readToken()` est appele a chaque requete : un jeton se rafraichit, et un client construit
 * au montage doit continuer d'emettre le jeton courant. C'est le contrat de
 * {@link SocialOptions.accessToken}, et le respecter ici evite d'avoir a y penser douze fois.
 *
 * ⚠️ **C'etait une valeur jusqu'au 2026-08-17, et ca coutait une lecture sur deux.** La
 * fermeture `() => accessToken` respectait bien le contrat cote client — mais cote appelant,
 * le parametre etait une **dependance d'effet**, et il passait de `undefined` a la session.
 * Chaque lecture sociale partait donc deux fois, la premiere en visiteur anonyme. Le lecteur
 * deplace cette laisserie a la frontiere : voir `useSocial`, seul appelant de cette fonction.
 */
export function socialFrom(
  readToken: () => string | undefined,
  onFailure?: SocialOptions['onFailure'],
): SocialClient | undefined {
  const config = authConfigFromEnv();
  if (config === undefined) return undefined;

  return new SocialClient({
    url: config.url,
    anonKey: config.anonKey,
    accessToken: readToken,
    // 🔴 **L'abonnement est le DEFAUT, et c'est la correction du 2026-08-16.** `onFailure`
    // etait propage jusqu'ici depuis le 2026-08-11 et **aucun des douze appelants ne le
    // passait** : le rappel existait, documente et teste, sans un seul abonne. Le laisser
    // facultatif revenait a demander a douze fichiers de se souvenir d'une option — ce qui
    // est precisement le probleme que ce fichier existe pour supprimer.
    //
    // Un appelant peut toujours donner le sien : il remplace alors le rappel commun, ce qui
    // est ce qu'on veut quand un ecran sait dire la panne mieux que la banniere generale.
    onFailure: onFailure ?? reportFailure,
  });
}

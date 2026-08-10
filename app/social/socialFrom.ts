import { authConfigFromEnv } from '@/src/auth/client';
import { SocialClient, type SocialOptions } from '@/src/social/client';

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
 * ## ⚠️ Le jeton est relu a chaque appel, jamais capture
 *
 * `accessToken: () => accessToken` ferme sur la **variable**, pas sur sa valeur : un jeton
 * se rafraichit, et un client construit au montage doit continuer d'emettre le jeton
 * courant. C'est le contrat de {@link SocialOptions.accessToken}, et le respecter ici evite
 * d'avoir a y penser douze fois.
 */
export function socialFrom(
  accessToken: string | undefined,
  onFailure?: SocialOptions['onFailure'],
): SocialClient | undefined {
  const config = authConfigFromEnv();
  if (config === undefined) return undefined;

  return new SocialClient({
    url: config.url,
    anonKey: config.anonKey,
    accessToken: () => accessToken,
    ...(onFailure !== undefined ? { onFailure } : {}),
  });
}

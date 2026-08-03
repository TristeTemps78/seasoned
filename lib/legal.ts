/**
 * L'identite de l'editeur, **lue depuis l'environnement et jamais ecrite ici**.
 *
 * ## Pourquoi ce detour plutot qu'un texte en dur
 *
 * Le depot est **public** (`AGENTS.md` regle 5). Les mentions legales exigent un nom, une
 * adresse et un moyen de contact : ce sont des **donnees personnelles** de l'editeur, et
 * les committer reviendrait a les publier sur GitHub en plus du site, indefiniment et dans
 * tout l'historique — ou un `git revert` ne les enleve pas.
 *
 * Elles vivent donc dans la configuration de l'hebergeur. Effet de bord heureux : les
 * corriger ne demande **aucun redeploiement de code**.
 *
 * ## Le produit ne ment pas sur ce qu'il ne sait pas
 *
 * Quand une valeur manque, la page le **dit** au lieu d'afficher un texte a trous qui
 * aurait l'air complet. C'est la meme regle que partout ailleurs ici : se taire ou
 * signaler, jamais remplir la case (`AGENTS.md` regle 8).
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined;
}

export interface PublisherIdentity {
  /** Personne ou societe qui edite le site. */
  readonly name?: string;
  /** Adresse postale, exigee des lors que l'activite devient commerciale. */
  readonly address?: string;
  /** Adresse de contact — la meme que celle du signalement DSA. */
  readonly email?: string;
  /** Directeur de la publication, quand il differe de l'editeur. */
  readonly director?: string;
}

/**
 * Ce que l'environnement sait de l'editeur.
 *
 * Lu a l'appel et non au chargement du module : une variable absente ne doit pas faire
 * echouer un import, ni un build.
 */
export function publisher(): PublisherIdentity {
  return {
    ...(read('LEGAL_PUBLISHER_NAME') !== undefined
      ? { name: read('LEGAL_PUBLISHER_NAME')! }
      : {}),
    ...(read('LEGAL_PUBLISHER_ADDRESS') !== undefined
      ? { address: read('LEGAL_PUBLISHER_ADDRESS')! }
      : {}),
    ...(read('LEGAL_CONTACT_EMAIL') !== undefined
      ? { email: read('LEGAL_CONTACT_EMAIL')! }
      : {}),
    ...(read('LEGAL_PUBLICATION_DIRECTOR') !== undefined
      ? { director: read('LEGAL_PUBLICATION_DIRECTOR')! }
      : {}),
  };
}

/**
 * L'hebergeur, connu et non configurable.
 *
 * Il n'a rien de personnel et ne change pas d'un environnement a l'autre : l'ecrire ici
 * evite une variable de plus a oublier de renseigner.
 */
export const HOST = {
  name: 'Vercel Inc.',
  address: '440 N Barranca Ave #4133, Covina, CA 91723, USA',
  url: 'https://vercel.com',
} as const;

/** Reste-t-il quelque chose a renseigner avant qu'un compte puisse exister ? */
export function legalIsComplete(): boolean {
  const { name, email } = publisher();
  // Le nom et un contact sont le minimum : sans eux, ni les mentions ni le signalement
  // DSA ne tiennent. L'adresse ne devient exigible qu'avec l'activite commerciale (A6).
  return name !== undefined && email !== undefined;
}

'use client';

import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';

/**
 * Ou vivent les notes — dit **une seule fois**, et jamais faux.
 *
 * ## Le defaut que ce composant repare
 *
 * Trois ecrans promettaient « rien n'est envoye » : la fiche serie, le bilan, la
 * bibliotheque vide. C'etait vrai le jour ou ils ont ete ecrits, et **le lot 6.3 les a
 * rendus mensongers** — avec un compte, une copie du journal part sur le serveur a chaque
 * geste.
 *
 * Corriger les trois phrases aurait suffi aujourd'hui, et aurait rate la quatrieme demain.
 * Un seul endroit dit desormais ou vivent les notes ; l'ecrire ailleurs redevient une
 * faute visible en relecture.
 *
 * ⚠️ Et la formulation compte : « sur cet appareil » plutot que « dans ce navigateur ». Le
 * journal survit a l'installation en application, et « navigateur » laissait croire le
 * contraire a qui vient de l'ajouter a son ecran d'accueil — c'est-a-dire exactement le
 * geste que le produit encourage.
 */
export function WhereItLives({ className = 'text-xs text-(--color-muted)' }: {
  readonly className?: string;
}) {
  const { t } = useT();
  const { account } = useAuth();

  return <span className={className}>{t(account === undefined ? 'lives.local' : 'lives.synced')}</span>;
}

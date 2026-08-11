'use client';

import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';

/**
 * La porte qui demande un compte — **montree**, et non tue.
 *
 * ## 🔴 Ce qu'elle remplace, et c'est la regle qu'on casse
 *
 * `AddToList` la formulait noir sur blanc : *« mieux vaut se taire que montrer une porte
 * fermee »*. Appliquee, elle donnait ceci :
 *
 *   - `/amis` sans compte  → une phrase grise, seule sur la page ;
 *   - `/listes` sans compte → une phrase grise, seule sur la page ;
 *   - « Ajouter a une liste » → **rien du tout** sur toutes les fiches series.
 *
 * Soit deux des six faces de la navigation qui menent, pour un arrivant, a un cul-de-sac
 * sans un seul bouton. La regle se defendait — un bouton qui ne marche pas apprend a ne
 * plus lire les boutons — mais elle confond **un bouton mort** et **une porte fermee a
 * clef dont on montre la clef**. Le premier ment ; la seconde est la seule facon qu'a un
 * produit de recruter quelqu'un.
 *
 * Decision de Tristan (2026-08-11) : *« sinon les gens ne viendraient pas si on tait
 * tout »*. C'est exact, et ca se verifie sur l'ecran : un visiteur qui n'a jamais vu qu'une
 * liste existe n'ouvrira jamais de compte pour en tenir une.
 *
 * ## Ce qu'elle promet, elle le tient
 *
 * Elle ne dit jamais « inscrivez-vous pour continuer » : le reste du produit marche **sans**
 * compte, et le dire est ce qui rend l'invitation credible plutot qu'agressive. Le second
 * bouton mene donc ailleurs qu'au formulaire — vers ce qu'on peut faire tout de suite.
 */
export function AccountGate({ title, body, secondaryHref, secondaryLabel }: {
  readonly title: string;
  readonly body: string;
  /** Ou mene le geste qui, lui, ne demande rien. Defaut : l'accueil. */
  readonly secondaryHref?: string;
  readonly secondaryLabel?: string;
}) {
  const { t, locale } = useT();

  return (
    <section className="empty-state" aria-label={title}>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-body">{body}</p>

      <div className="empty-state-actions">
        <Link href={pathIn('/compte', locale)} className="btn btn-primary">
          {t('gate.create')}
        </Link>
        <Link href={pathIn(secondaryHref ?? '/', locale)} className="btn">
          {secondaryLabel ?? t('gate.browse')}
        </Link>
      </div>

      {/* La phrase qui desamorce l'invitation. Sans elle, la carte se lit comme un mur de
          connexion — exactement ce que ce produit n'est pas : tout le journal, toutes les
          notes et toutes les critiques s'ecrivent sans compte, dans ce navigateur. */}
      <p className="meta-sm">{t('gate.rest')}</p>
    </section>
  );
}

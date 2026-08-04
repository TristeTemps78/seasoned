'use client';

import { useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { SignIn } from '@/app/components/SignIn';

/**
 * Ce que la page compte montre, selon qu'on est connecte ou non.
 *
 * ## Trois etats, et le troisieme est celui qu'on oublie
 *
 * Connecte, deconnecte — et **pas configure**. Sans base reliee, afficher un formulaire
 * qui ne peut pas marcher serait exactement ce que le produit s'interdit ailleurs :
 * `/mentions` sans identite d'editeur affiche un avertissement plutot qu'un texte a trous.
 * Ici c'est la meme regle, et elle sert aussi le developpement local.
 *
 * ## Ce que cet ecran ne promet pas
 *
 * Au lot 2, le compte **ne synchronise rien**. Le dire est le seul choix tenable : laisser
 * croire que les notes sont a l'abri ailleurs pousserait quelqu'un a vider son navigateur.
 * C'est la version « compte » de ce que `DataSafety` fait deja pour le journal.
 */
export function AccountPanel() {
  const { t } = useT();
  const { configured, ready, account, leave, erase } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  if (!configured) {
    return (
      <section className="card max-w-md space-y-3">
        <h2 className="card-title">{t('account.unavailable.title')}</h2>
        <p className="leading-relaxed text-(--color-muted)">
          {t('account.unavailable.body')}
        </p>
      </section>
    );
  }

  // ⚠️ Distinguer « je ne sais pas encore » de « personne n'est connecte » : sans ca, le
  // formulaire de connexion clignote une demi-seconde chez quelqu'un qui est deja connecte.
  if (!ready) return <div className="h-64" aria-hidden="true" />;

  if (account === undefined) return <SignIn />;

  return (
    <div className="space-y-6">
      <section className="card max-w-md space-y-3">
        <p>{t('account.signedInAs', { email: account.email ?? '' })}</p>
        <button
          type="button"
          onClick={() => void leave()}
          className="btn"
        >
          {t('account.signOut')}
        </button>
      </section>

      <p className="max-w-prose text-sm text-(--color-muted)">{t('account.notSynced')}</p>

      <section className="card max-w-md space-y-3 border-(--color-warn)/40">
        <h2 className="card-title">{t('account.delete.title')}</h2>
        <p className="max-w-prose leading-relaxed text-(--color-muted)">
          {t('account.delete.body')}
        </p>
        {confirming ? (
          <button
            type="button"
            onClick={() => void erase().then((ok) => setDeleteFailed(!ok))}
            className="btn btn-danger"
          >
            {t('account.delete.confirm')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn"
          >
            {t('account.delete.title')}
          </button>
        )}
        <p aria-live="polite" className="text-sm text-(--color-warn)">
          {deleteFailed ? t('account.delete.failed') : ''}
        </p>
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
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

      <p className="max-w-prose meta">{t('account.notSynced')}</p>

      <StopMapConsent />

      <section className="card max-w-md space-y-3 border-(--color-warn)/40">
        <h2 className="card-title">{t('account.delete.title')}</h2>
        <p className="prose-note">
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

/**
 * Entrer dans la carte des abandons, ou en sortir.
 *
 * ## Pourquoi le reglage est ici, et pourquoi il existe
 *
 * Ce qui part est **anonyme et illisible** — `016_stops.sql` ne porte aucune politique de
 * lecture — et le produit publie deja, sans rien demander, une activite qui porte le nom de
 * la personne. Contribuer est donc le defaut, comme pour le fil.
 *
 * Mais contribuer sans **aucun** moyen de sortir serait un autre sujet, et celui-la n'est
 * pas defendable. D'ou ce bloc, sur `/compte` : la contribution n'existe que pour un compte
 * connecte, donc le reglage n'a de sens qu'ici — un bouton qui ne peut rien changer ne
 * s'affiche pas (regle du 2026-08-09).
 *
 * ⚠️ **Sortir efface**, il ne se contente pas de se taire : voir
 * {@link SocialClient.forgetStops}. Le texte doit le dire, sans quoi quelqu'un se retirerait
 * en croyant seulement arreter — et il n'aurait aucun moyen de verifier la difference,
 * puisque la table est illisible.
 */
function StopMapConsent() {
  const { t } = useT();
  const { journal, ready, setKeepStopsPrivate } = useJournal();
  if (!ready) return null;

  const out = journal.keepStopsPrivate === true;

  return (
    <section className="card max-w-md space-y-3">
      <h2 className="card-title">{t('stops.opt.title')}</h2>
      {/* ⚠️ **Le bloc reste entier une fois sorti.** Le remplacer par une phrase retirerait
          le seul endroit ou revenir — un reglage qui se cache lui-meme n'est pas un reglage,
          c'est un piege. Meme lecon que le masquage des heures. */}
      <p className="prose-note">{t(out ? 'stops.opt.left' : 'stops.opt.body')}</p>
      <button type="button" className="btn" onClick={() => setKeepStopsPrivate(!out)}>
        {t(out ? 'stops.opt.rejoin' : 'stops.opt.leave')}
      </button>
    </section>
  );
}

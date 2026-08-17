'use client';

import { useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { SignIn } from '@/app/components/SignIn';
import { ProfileSettings } from '@/app/components/ProfileSettings';

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

  /**
   * 🔴 **La page d'arrivee du produit etait une carte de 448 px seule dans 1120.**
   *
   * Mesure au DOM le 2026-08-12 : `/compte` rendait un unique `.card max-w-md`, aligne a
   * gauche, avec **672 px de vide a sa droite** et zero image sur toute la page. Or c'est la
   * destination de **toutes** les portes posees la veille — `/amis`, `/listes`, « ajouter a
   * une liste » y menent toutes. Le produit invitait quelque part, et l'endroit etait vide.
   *
   * ⚠️ La colonne de droite n'est pas de la decoration : ce sont les **trois seules choses**
   * qu'un compte debloque, et chacune se verifie dans le code — les abonnements (`009`), les
   * listes (`007`), la reprise du journal d'un appareil a l'autre (`JournalSync`). Une page
   * qui demande un compte doit dire ce qu'il donne, sinon elle demande sans rien offrir.
   *
   * ⚠️ **Seulement deconnecte.** Une fois le compte ouvert, la promesse devient du bruit :
   * on ne redit pas a quelqu'un pourquoi il s'est inscrit.
   */
  if (account === undefined) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">
        <SignIn />
        <WhatAnAccountGives />
      </div>
    );
  }

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

      {/* 🔴 Le nom public et la visibilite vivaient sur `/amis` — la page ou l'on va pour
          regarder les autres — et « Mon compte » n'en disait rien. Ce sont les deux reglages
          les plus engageants du produit : ils appartiennent ici. Voir `ProfileSettings`. */}
      <ProfileSettings />

      <StopMapConsent />

      {/* ⚠️ Sous la carte des abandons et non a cote : les deux reglent ce qui sort, et les
          lire l'un apres l'autre fait voir l'asymetrie — l'un part ouvert parce qu'il est
          anonyme, l'autre ferme parce qu'il porte des phrases signees. */}
      <TagSharing />

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

/**
 * Montrer ses mots sur son profil — et c'est un ACCORD, pas un refus.
 *
 * ## 🔴 Pourquoi ce bloc n'est pas le jumeau de celui du dessus
 *
 * `StopMapConsent` fait contribuer par defaut, et sa propre documentation dit pourquoi : ce
 * qui part est anonyme et illisible. Les mots n'ont aucune de ces deux proprietes — « a
 * revoir avec Lea », « le dimanche » sont des phrases ecrites par quelqu'un, attachees a son
 * nom, et `Tags.tsx` promet aujourd'hui *« vos mots, ranges par vous, pour vous »*.
 *
 * ⚠️ Les publier par defaut romprait cette promesse **retroactivement**, sur du texte ecrit
 * avant que la question ne se pose. C'est la seule raison pour laquelle l'interrupteur part
 * ferme, et elle suffit.
 *
 * ⚠️ **Reprendre EFFACE**, comme sortir de la carte : `publishTags` envoie le vide, donc
 * retire les lignes. Le texte doit le dire — sans quoi quelqu'un croirait seulement arreter,
 * et laisserait ses mots en ligne.
 */
function TagSharing() {
  const { t } = useT();
  const { journal, ready, setShareTags } = useJournal();
  if (!ready) return null;

  const shared = journal.shareTags === true;

  return (
    <section className="card max-w-md space-y-3">
      <h2 className="card-title">{t('tags.share.title')}</h2>
      {/* Le bloc reste entier dans les deux etats : un reglage qui se cache une fois utilise
          n'est pas un reglage, c'est un piege. Meme lecon que le masquage des heures. */}
      <p className="prose-note">{t(shared ? 'tags.share.on' : 'tags.share.off')}</p>
      <button type="button" className="btn" onClick={() => setShareTags(!shared)}>
        {t(shared ? 'tags.share.stop' : 'tags.share.start')}
      </button>
    </section>
  );
}

/**
 * Ce qu'un compte donne — les trois seules choses, et rien de plus.
 *
 * ## Pourquoi ce bloc existe
 *
 * `/compte` est la destination de toutes les portes du produit, et elle ne disait rien de ce
 * qu'il y a derriere : un champ e-mail, une case d'age, un bouton. Demander sans offrir.
 *
 * ⚠️ **Chaque ligne se verifie dans le code**, et aucune n'est un argument de vente : les
 * abonnements viennent de `009_relations.sql`, les listes de `007_lists.sql`, la reprise du
 * journal de `JournalSync`. Le jour ou l'une des trois disparait, cette liste ment — c'est
 * pourquoi il y en a trois et pas six.
 *
 * ⚠️ La derniere phrase **desamorce** : tout le reste du produit marche sans compte, et le
 * dire est ce qui rend l'invitation credible plutot qu'agressive. C'est la meme phrase que
 * `AccountGate`, au meme endroit du raisonnement — elle est reprise, pas reecrite.
 */
function WhatAnAccountGives() {
  const { t } = useT();

  const promesses = [
    ['account.gives.friends.title', 'account.gives.friends.body'],
    ['account.gives.lists.title', 'account.gives.lists.body'],
    ['account.gives.devices.title', 'account.gives.devices.body'],
  ] as const;

  return (
    <section className="band" aria-label={t('account.gives.title')}>
      <h2 className="row-title">{t('account.gives.title')}</h2>
      {/* Une bande et non des cartes : trois boites grises a cote d'une quatrieme boite grise
          (le formulaire) donneraient exactement la pile que `.band` existe pour defaire. */}
      <dl className="space-y-4">
        {promesses.map(([titre, corps]) => (
          <div key={titre} className="space-y-1">
            <dt className="card-title">{t(titre)}</dt>
            <dd className="prose-note">{t(corps)}</dd>
          </div>
        ))}
      </dl>
      <p className="meta-sm">{t('gate.rest')}</p>
    </section>
  );
}

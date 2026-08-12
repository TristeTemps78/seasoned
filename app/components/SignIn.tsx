'use client';

import { useEffect, useId, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { MINIMUM_AGE } from '@/src/domain/handles';

/**
 * Ou l'on note qu'un lien vient d'etre demande **depuis ce navigateur**.
 *
 * 🔴 Sans ca, le champ du code a six chiffres n'existait que dans l'onglet vivant qui avait
 * demande le lien : un rechargement, une fermeture, un retour le lendemain, et il
 * disparaissait. Or le cas que ce champ existe pour couvrir est precisement *« je lis mes
 * e-mails sur mon telephone et je suis sur l'ordinateur »* — c'est-a-dire un aller-retour
 * pendant lequel on quitte la page. Le repli n'etait donc offert qu'a ceux qui n'en avaient
 * pas besoin.
 *
 * Ce qui restait a faire etait de redemander un lien pour retrouver le champ, ce qui **brule
 * le code precedent** et se heurte au plafond d'envois du service integre de Supabase.
 * Autrement dit : la seule issue disponible fermait l'autre.
 *
 * ⚠️ L'adresse est rangee en clair, dans le meme navigateur que le journal et pour la meme
 * duree de vie qu'un code Supabase — une heure. C'est la personne elle-meme qui vient de la
 * taper deux lignes plus haut ; ce qu'on evite ici, c'est de la lui redemander.
 */
const PENDING_KEY = 'voltface.auth.v1-pending-email';

/** La duree de validite d'un code Supabase. Au-dela, le proposer serait mentir. */
const PENDING_MAX_MS = 60 * 60 * 1000;

/**
 * Se connecter — lien magique, code de secours, ou Google.
 *
 * ## Pas de mot de passe, et ce n'est pas une simplification
 *
 * Un mot de passe, c'est une politique de complexite, un ecran de reinitialisation, un
 * stockage a defendre et une fuite possible. Il n'apporte rien qu'un lien envoye a
 * l'adresse qu'on doit de toute facon verifier.
 *
 * ## Le code a six chiffres est livre des la premiere version
 *
 * Avec PKCE, le verificateur est range dans le `localStorage` de l'onglet **qui a demande
 * le lien**. Ouvrir le lien dans un autre navigateur ne peut donc pas marcher — et c'est
 * la contrepartie de ce qui rend un lien magique intransferable : le faire suivre par
 * e-mail ne donne acces a rien.
 *
 * Or « je lis mes e-mails sur mon telephone et je suis sur l'ordinateur » est un cas
 * banal, pas un cas limite. Le meme e-mail porte deja le code : le champ de saisie coute
 * quelques lignes et evite que ces gens-la restent dehors.
 */
export function SignIn() {
  const { t, locale } = useT();
  const { sendLink, submitCode, withGoogle, providers } = useAuth();
  const emailId = useId();
  const ageId = useId();
  const codeId = useId();

  const [email, setEmail] = useState('');
  const [oldEnough, setOldEnough] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'rate_limited' | 'failed'>(
    'idle',
  );
  const [code, setCode] = useState('');
  const [codeFailed, setCodeFailed] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);

  // ⚠️ Absolue, et dans la langue de la page : Supabase renvoie ici apres l'e-mail, et
  // atterrir en anglais apres avoir clique un lien francais est le meme defaut que la
  // negociation par `Accept-Language` que `lib/routes.ts` refuse.
  const redirectTo = (): string =>
    typeof window === 'undefined'
      ? ''
      : new URL(pathIn('/compte/retour', locale), window.location.origin).toString();

  /**
   * Un lien a-t-il ete demande ici recemment ?
   *
   * ⚠️ Dans un effet et non au rendu : le HTML de `/compte` est statique et partage, donc
   * lire le stockage pendant le rendu ferait diverger l'hydratation. Meme discipline que
   * `useJournal` et `AuthProvider` — c'est ce qui garde la page `force-static`.
   */
  useEffect(() => {
    try {
      const raw = globalThis.localStorage?.getItem(PENDING_KEY);
      if (raw === null || raw === undefined) return;
      const saved = JSON.parse(raw) as { readonly email?: string; readonly at?: number };
      if (typeof saved.email !== 'string' || typeof saved.at !== 'number') return;
      if (Date.now() - saved.at > PENDING_MAX_MS) {
        globalThis.localStorage?.removeItem(PENDING_KEY);
        return;
      }
      setEmail(saved.email);
      setState('sent');
    } catch {
      // Stockage refuse ou contenu illisible : on retombe sur le formulaire nu, qui marche.
    }
  }, []);

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    const address = email.trim();
    const outcome = await sendLink(address, redirectTo());
    setState(outcome.kind === 'sent' ? 'sent' : outcome.kind);
    if (outcome.kind !== 'sent') return;
    try {
      globalThis.localStorage?.setItem(
        PENDING_KEY,
        JSON.stringify({ email: address, at: Date.now() }),
      );
    } catch {
      // Sans stockage, le champ du code reste offert dans cet onglet — c'est le
      // comportement d'avant, et il n'est pas pire.
    }
  }

  async function onCode(event: React.FormEvent) {
    event.preventDefault();
    const ok = await submitCode(email.trim(), code.trim());
    setCodeFailed(!ok);
    // ⚠️ Efface **seulement** en cas de succes : un code mal recopie ne doit pas faire
    // disparaitre le champ ou on le recopie.
    if (ok) {
      try {
        globalThis.localStorage?.removeItem(PENDING_KEY);
      } catch {
        // Rien a faire : la session est ouverte, c'est ce qui compte.
      }
    }
  }

  const ready = oldEnough && email.trim().length > 3 && email.includes('@');

  return (
    // ⚠️ Une largeur de lecture, pas la largeur de la page : un champ e-mail de mille
    // pixels de long n'aide personne a taper son adresse, et signale surtout qu'aucune
    // mise en page n'a ete decidee. La carte fait le reste — c'est la meme surface que
    // partout ailleurs dans le produit.
    <section aria-label={t('account.aria')} className="card max-w-md space-y-4">
      <form onSubmit={onSend} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor={emailId} className="block meta">
            {t('account.email.label')}
          </label>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('account.email.placeholder')}
            className="field text-sm"
          />
        </div>

        {/*
          Q11 : declaratif, et **aucune date de naissance collectee** — un age exact serait
          une donnee sensible de plus a proteger, pour un gain nul. Le seuil est celui du
          RGPD (16) et non les 15 ans francais : pour un produit international, le plus
          eleve est le seul qui ne demande pas une logique par pays.
        */}
        <div className="flex items-start gap-2">
          <input
            id={ageId}
            type="checkbox"
            checked={oldEnough}
            onChange={(e) => setOldEnough(e.target.checked)}
            className="mt-1"
          />
          <label htmlFor={ageId} className="text-sm">
            {t('account.age', { age: String(MINIMUM_AGE) })}
            <span className="mt-0.5 block meta-sm">
              {t('account.ageWhy')}
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={!ready || state === 'sending'}
          className="btn btn-primary"
        >
          {state === 'sending' ? t('account.sending') : t('account.send')}
        </button>
      </form>

      <p aria-live="polite" className="meta">
        {state === 'sent'
          ? t('account.sent')
          : state === 'rate_limited'
            ? t('account.rateLimited')
            : state === 'failed'
              ? t('account.failed')
              : ''}
      </p>

      {state === 'sent' ? (
        <form onSubmit={onCode} className="space-y-2 border-t border-(--color-edge) pt-4">
          <label htmlFor={codeId} className="block meta">
            {t('account.code.label')}
          </label>
          <p className="meta-sm">{t('account.code.why')}</p>
          <div className="flex gap-2">
            <input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('account.code.placeholder')}
              className="field numeric w-32 text-sm"
            />
            <button
              type="submit"
              className="btn"
            >
              {t('account.code.submit')}
            </button>
          </div>
          <p aria-live="polite" className="text-sm text-(--color-warn)">
            {codeFailed ? t('account.code.failed') : ''}
          </p>
        </form>
      ) : null}

      {/* 🔴 Ce bloc etait affiche EN DUR, et le fournisseur Google n'a jamais ete active
          cote Supabase : on cliquait, l'erreur « provider is not enabled » etait avalee, et
          il ne se passait rien. Un bouton qui ne peut pas marcher ne se degrade pas, il ne
          s'affiche pas. `providers` vient de `/auth/v1/settings`, qui est public — donc le
          bouton reapparaitra tout seul le jour ou le fournisseur sera branche, sans
          redeploiement ni drapeau a penser a retirer. */}
      {providers.has('google') ? (
        <div className="border-t border-(--color-edge) pt-4">
          <p className="mb-2 label">
            {t('account.or')}
          </p>
          <button
            type="button"
            disabled={!oldEnough}
            onClick={() => {
              void withGoogle(redirectTo()).then((ok) => setGoogleFailed(!ok));
            }}
            className="btn"
          >
            {t('account.google')}
          </button>
          {/* Et s'il echoue quand meme, on le dit. Le silence etait la moitie du defaut. */}
          <p role="status" className="mt-2 text-sm text-(--color-warn)">
            {googleFailed ? t('account.google.failed') : ''}
          </p>
        </div>
      ) : null}
    </section>
  );
}

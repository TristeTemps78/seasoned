'use client';

import { useId, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { MINIMUM_AGE } from '@/src/domain/handles';

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

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    const outcome = await sendLink(email.trim(), redirectTo());
    setState(outcome.kind === 'sent' ? 'sent' : outcome.kind);
  }

  async function onCode(event: React.FormEvent) {
    event.preventDefault();
    setCodeFailed(!(await submitCode(email.trim(), code.trim())));
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
          <label htmlFor={emailId} className="block text-sm text-(--color-muted)">
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
            <span className="mt-0.5 block text-xs text-(--color-muted)">
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

      <p aria-live="polite" className="text-sm text-(--color-muted)">
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
          <label htmlFor={codeId} className="block text-sm text-(--color-muted)">
            {t('account.code.label')}
          </label>
          <p className="text-xs text-(--color-muted)">{t('account.code.why')}</p>
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

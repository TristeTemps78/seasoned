'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasContent } from '@/src/domain/journal';
import { negotiateLocale, t, type Locale } from '@/lib/i18n';
import { useJournal } from '@/app/journal/useJournal';

/**
 * Dire la verite sur la fragilite du stockage, au moment ou il y a quelque chose a perdre.
 *
 * ## Le defaut que ce composant repare
 *
 * Le produit promet de garder la trace de ce qu'on a pense d'une serie. Il l'ecrit dans
 * `localStorage`. Or **Safari efface tout stockage inscriptible par script apres sept
 * jours d'usage du navigateur sans interaction avec le site** — et le public vise revient
 * tous les un a trois mois, puisqu'une saison sort tous les trimestres. Le trou
 * d'engagement n'etait pas seulement un probleme de retention : c'etait une **destruction
 * de journal**.
 *
 * La nuance qui change tout, et qui est la raison d'etre de ce composant : **une
 * application ajoutee a l'ecran d'accueil y echappe** — elle a son propre compteur
 * d'usage. La protection existe donc deja dans le produit ; elle est simplement
 * conditionnee a un geste que rien n'invitait a faire.
 *
 * D'ou la formulation : installer n'est pas presente comme un confort (« ajoutez-nous a
 * votre ecran d'accueil ! »), mais pour ce que c'est — **ce qui empeche de perdre ses
 * notes**.
 *
 * ## Les trois regles qui evitent d'en faire une nuisance
 *
 * 1. **Rien tant qu'il n'y a rien a perdre.** Aucun bandeau avant le premier geste : a
 *    quelqu'un qui n'a rien note, ce message ne parle de rien.
 * 2. **Rien si l'application est deja installee.** Le risque n'existe plus ; continuer a
 *    l'annoncer serait mentir, et apprendrait a ignorer nos messages.
 * 3. **« Plus tard » est respecte** — il ne revient qu'apres quatre gestes de plus. Le
 *    refus se mesure en gestes et non en jours, parce que ce qui augmente le risque est
 *    la quantite de travail accumule, pas le temps.
 *
 * ## Pourquoi la langue se decide ici, cote client
 *
 * Les pages sont `force-static` : au rendu, il n'y a **aucun en-tete de requete** a
 * negocier — c'est le prix du cache, et c'est lui qui tient le budget. Un composant
 * client, lui, peut lire la langue du navigateur sans rien couter ni rien invalider.
 */

/** L'evenement d'installation de Chrome/Edge/Android, absent des types DOM standard. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'seasoned.safety.v1';
/** Gestes supplementaires avant de reproposer, apres un « plus tard ». */
const SNOOZE_GESTURES = 4;

function readDismissedAt(): number {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (raw === null) return -1;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  } catch {
    // Stockage refuse (navigation privee, quota) : on ne bloque pas l'affichage pour ca.
    return -1;
  }
}

/** Deja installee ? Alors les donnees ne risquent plus l'effacement automatique. */
function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  // Safari iOS n'implemente pas `display-mode` de la meme facon et expose ceci a la place.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function DataSafety() {
  const { journal, ready, exportJournal } = useJournal();
  const [locale, setLocale] = useState<Locale>('fr');
  const [dismissedAt, setDismissedAt] = useState(-1);
  const [installed, setInstalled] = useState(true); // suppose installe : on n'affiche rien avant de savoir
  const [prompt, setPrompt] = useState<InstallPromptEvent | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocale(negotiateLocale(navigator.language));
    setDismissedAt(readDismissedAt());
    setInstalled(isInstalled());

    const onPrompt = (event: Event) => {
      // Retenir l'evenement : sans cela, le navigateur decide seul du moment, qui est
      // rarement celui ou l'utilisateur comprend pourquoi on le lui demande.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const gestures = Object.values(journal.entries).filter(hasContent).length;

  const dismiss = useCallback(() => {
    setDismissedAt(gestures);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(gestures));
    } catch {
      // Refus de stockage : le bandeau reviendra. C'est le bon sens de l'erreur — mieux
      // vaut redemander que taire un risque de perte.
    }
  }, [gestures]);

  const download = useCallback(() => {
    const blob = new Blob([exportJournal()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seasoned-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }, [exportJournal]);

  const install = useCallback(() => {
    if (prompt === undefined) return;
    void prompt.prompt();
    void prompt.userChoice.finally(() => setPrompt(undefined));
  }, [prompt]);

  if (!ready || installed) return null;
  if (gestures === 0) return null;
  if (dismissedAt >= 0 && gestures < dismissedAt + SNOOZE_GESTURES) return null;

  return (
    <aside
      aria-label={t(locale, 'safety.title')}
      className="mx-auto mb-6 max-w-3xl space-y-3 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4"
    >
      <h2 className="text-sm font-semibold">{t(locale, 'safety.title')}</h2>
      <p className="max-w-prose text-xs leading-relaxed text-(--color-muted)">
        {t(locale, 'safety.body')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {prompt !== undefined ? (
          <button
            type="button"
            onClick={install}
            className="rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted)"
          >
            {t(locale, 'safety.install')}
          </button>
        ) : null}

        <button
          type="button"
          onClick={download}
          className="rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted)"
        >
          {t(locale, 'safety.export')}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-3 py-1.5 text-sm text-(--color-muted) hover:text-(--color-ink)"
        >
          {t(locale, 'safety.later')}
        </button>
      </div>

      {/* iOS n'expose aucun evenement d'installation : la seule voie est le geste manuel,
          donc on l'explique au lieu de proposer un bouton qui ne ferait rien. */}
      {prompt === undefined && isApple() ? (
        <p className="text-xs text-(--color-muted)">{t(locale, 'safety.iosHint')}</p>
      ) : (
        <p className="text-xs text-(--color-muted)">{t(locale, 'safety.installWhy')}</p>
      )}

      {saved ? (
        <p aria-live="polite" className="text-xs text-(--color-live)">
          {t(locale, 'safety.done')}
        </p>
      ) : null}
    </aside>
  );
}

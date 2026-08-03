'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasContent } from '@/src/domain/journal';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { useAuth } from '@/app/auth/AuthProvider';

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
 * ## ⚠️ La langue vient de la page, plus du navigateur
 *
 * Ce composant a longtemps lu `navigator.language`. Le raisonnement tenait : les pages
 * etant `force-static`, il n'y a aucun en-tete de requete a negocier au rendu, et un
 * composant client peut lire le reglage du navigateur sans rien couter.
 *
 * Il produisait pourtant un resultat faux, et le premier test ecrit sur ce composant l'a
 * montre en une ligne : sur `/fr`, un navigateur regle en anglais recevait **un bandeau
 * anglais au milieu d'une page francaise**. Chaque moitie du raisonnement etait juste,
 * l'ensemble se contredisait — la meme forme d'echec que le `lang="en"` sur `/fr`.
 *
 * La regle qui en sort : **la langue est une propriete de l'adresse, jamais du visiteur.**
 * L'adresse a ete choisie en cliquant un lien ; le reglage du navigateur est subi. Elle
 * descend donc par {@link useT}, depuis la disposition racine qui connait sa langue par
 * construction.
 */

/** L'evenement d'installation de Chrome/Edge/Android, absent des types DOM standard. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/**
 * ⚠️ **Volontairement laissee sous l'ancien nom du produit.**
 *
 * Elle ne retient qu'une chose : que ce bandeau a deja ete ecarte. La migrer vers
 * `voltface.*` le ferait **reapparaitre** a tous ceux qui l'avaient renvoye — un
 * desagrement gratuit, pour une cle que personne ne lit jamais. Le journal, lui, portait
 * une vraie donnee et a ete migre (`src/journal/local.ts`).
 */
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
  const { t } = useT();
  const { account } = useAuth();
  const [dismissedAt, setDismissedAt] = useState(-1);
  const [installed, setInstalled] = useState(true); // suppose installe : on n'affiche rien avant de savoir
  const [prompt, setPrompt] = useState<InstallPromptEvent | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
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
    link.download = `voltface-${new Date().toISOString().slice(0, 10)}.json`;
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
  // 🔴 **Ce bandeau MENTAIT a qui est connecte, depuis le lot 6.3.** Son titre dit « ces
  // notes ne vivent que dans ce navigateur » et tout son propos est le risque que Safari
  // efface le stockage local apres sept jours. Avec un compte, une copie part sur le
  // serveur a chaque geste : la phrase est fausse et le risque n'existe plus.
  //
  // Se taire est donc la seule reponse juste. Continuer a l'afficher apprendrait a ignorer
  // nos messages — c'est la regle n°2 de ce composant, appliquee au cas qu'elle n'avait pas
  // prevu parce que les comptes n'existaient pas encore quand elle a ete ecrite.
  if (account !== undefined) return null;
  if (gestures === 0) return null;
  if (dismissedAt >= 0 && gestures < dismissedAt + SNOOZE_GESTURES) return null;

  return (
    // ⚠️ **Repliable, et replie par defaut.** Deploye, ce bandeau occupait un tiers de la
    // hauteur utile **sur chaque page** : le contenu reel — les series, le bilan, le
    // calendrier — passait sous la ligne de flottaison partout. Un avertissement qu'on
    // voit trop cesse d'etre lu, et il coutait ici la premiere impression du produit.
    //
    // Il garde toute sa fonction : le titre reste visible en permanence et les deux
    // actions restent a un clic. Seule l'explication se deplie, pour qui la veut.
    <aside
      aria-label={t('safety.title')}
      className="mb-6 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-3"
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold marker:content-none">
          <span aria-hidden="true" className="text-(--color-warn)">
            ●
          </span>
          {t('safety.title')}
          <span
            aria-hidden="true"
            className="ml-auto text-xs text-(--color-muted) transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-(--color-muted)">
          {t('safety.body')}
        </p>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {prompt !== undefined ? (
          <button
            type="button"
            onClick={install}
            className="btn"
          >
            {t('safety.install')}
          </button>
        ) : null}

        <button
          type="button"
          onClick={download}
          className="btn"
        >
          {t('safety.export')}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-3 py-1.5 text-sm text-(--color-muted) hover:text-(--color-ink)"
        >
          {t('safety.later')}
        </button>
      </div>

      {/* iOS n'expose aucun evenement d'installation : la seule voie est le geste manuel,
          donc on l'explique au lieu de proposer un bouton qui ne ferait rien. */}
      {prompt === undefined && isApple() ? (
        <p className="text-xs text-(--color-muted)">{t('safety.iosHint')}</p>
      ) : (
        <p className="text-xs text-(--color-muted)">{t('safety.installWhy')}</p>
      )}

      {saved ? (
        <p aria-live="polite" className="text-xs text-(--color-live)">
          {t('safety.done')}
        </p>
      ) : null}
    </aside>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { socialFrom } from '@/app/social/socialFrom';
import { pathIn } from '@/lib/routes';
import { Icon } from '@/app/components/Icon';
import type { Locale } from '@/lib/i18n';

/**
 * Le menu de l'en-tete — ce que les six faces ne portent pas.
 *
 * ## Le defaut qu'il repare, et il se mesure en liens
 *
 * `/compte` etait un **lien**, et c'etait le seul de cette moitie de l'en-tete. Consequence,
 * relevee en comptant les `pathIn` du depot le 2026-08-16 :
 *
 *   - **`/journal`** — le journal date, la face « diary » de Letterboxd — n'etait atteignable
 *     que depuis **une seule ligne** de tout le produit (`/moi`). Qui arrive sur une fiche de
 *     serie ne peut pas y aller.
 *   - **`/parcourir`** — pagination, genres, epoques, la facette « finie / continue » —
 *     n'etait atteignable que depuis **l'accueil**.
 *   - **`/u/<moi>`** — son propre profil public — n'etait atteignable de **nulle part**,
 *     alors que huit endroits lient vers celui des autres. On publiait sans jamais pouvoir
 *     regarder ce qui etait publie.
 *   - **Se deconnecter** n'existait que sur `/compte`.
 *
 * Quatre destinations reelles, deja construites, sans porte. C'est exactement la forme du
 * defaut que ce depot rencontre depuis dix lots : *une fonctionnalite ecrite n'est pas une
 * fonctionnalite qu'on peut atteindre.*
 *
 * ## Pourquoi ce n'est pas une septieme face
 *
 * Une face repond a une question qu'on se pose **a un moment de la journee**. « Ou est mon
 * profil », « comment je me deconnecte » n'en sont pas — c'est deja la raison pour laquelle
 * le compte n'est pas dans le ruban (`SiteChrome`). Le cube garde ses six faces ; ce menu
 * range ce qui n'en est pas une, et il rouvre `nav.browse` — une clef retiree le 2026-08-15
 * parce qu'elle etait traduite sans appelant. Elle avait ete ecrite pour un **onglet**, ce
 * qui aurait casse les six faces ; elle revient pour une **entree de menu**, ce qui ne les
 * touche pas.
 *
 * ## Un volet, pas un `role="menu"`
 *
 * `role="menu"` / `role="menuitem"` decrit les menus d'**application** (Fichier, Edition) :
 * il exige un focus tournant, `aria-activedescendant`, et il **retire** les liens du parcours
 * de tabulation. Une liste de liens de navigation se decrit avec le patron « divulgation » —
 * un bouton `aria-expanded` suivi d'une `<nav>` ordinaire — ou chaque lien reste un lien,
 * annonce comme tel et atteignable au `Tab`. C'est ce que recommandent les pratiques ARIA
 * pour un menu de navigation, et ca supprime la moitie du code que l'autre patron demande.
 *
 * Restent obligatoires, et ils sont ici : `Escape` referme **et rend le focus au bouton**
 * (sinon on repart du haut de la page), le clic dehors referme, et un changement de page
 * referme — cet en-tete ne se demonte jamais, donc sans cet effet le volet resterait ouvert
 * par-dessus la page suivante.
 *
 * ## ⚠️ Le pseudo se demande au survol, pas au chargement
 *
 * Lier `/u/<moi>` demande le handle, qui n'est pas dans la session (`Account` ne porte que
 * l'identifiant, l'e-mail et le jeton) : il faut une lecture de `profiles`. Or cet en-tete
 * est sur **toutes** les pages — la meme raison qui fait qu'`AuthProvider` ne charge pas le
 * SDK pour un visiteur sans session. La lecture part donc au survol ou a la mise au point du
 * bouton, jamais au rendu : personne ne paie pour un menu qu'il n'ouvre pas, et pour qui
 * l'ouvre, la reponse est deja la. Une seule fois par compte.
 */
export function AccountMenu({ locale }: { readonly locale: Locale }) {
  const { t } = useT();
  const { account, ready, leave } = useAuth();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  /**
   * Le pseudo, et **pour quel compte** il a ete demande.
   *
   * ⚠️ Les deux ensemble, jamais un drapeau `asked` a cote : se deconnecter puis se
   * reconnecter avec un autre compte laisserait sinon le menu pointer vers le profil du
   * precedent — un lien juste, vers la mauvaise personne.
   */
  const [profile, setProfile] = useState<{ readonly userId: string; readonly handle?: string }>();

  const userId = account?.userId;
  const accessToken = account?.accessToken;

  const warm = useCallback(() => {
    if (userId === undefined || accessToken === undefined) return;
    if (profile?.userId === userId) return;
    const social = socialFrom(accessToken);
    if (social === undefined) return;
    void social.myProfile(userId).then((found) => {
      setProfile({ userId, ...(found?.handle !== undefined ? { handle: found.handle } : {}) });
    });
  }, [userId, accessToken, profile]);

  // Le volet ne survit pas a la page : l'en-tete est le meme noeud d'une page a l'autre.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Rendre le focus, sinon la tabulation suivante repart du tout debut de la page.
      trigger.current?.focus();
    };
    // ⚠️ `pointerdown` et non `click` : un clic sur un lien de la page referme alors le volet
    // **avant** la navigation, au lieu de laisser deux etats se courir apres.
    const onDown = (event: PointerEvent) => {
      if (box.current?.contains(event.target as Node) === true) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const handle = profile?.userId === userId ? profile?.handle : undefined;
  const signedIn = ready && account !== undefined;

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        aria-expanded={open}
        // ⚠️ Le volet est nomme par le bouton (`aria-controls` + `id`) : sans ce lien, un
        // lecteur d'ecran annonce « developpe » sans dire ce qui vient de s'ouvrir.
        aria-controls="account-menu"
        onClick={() => {
          warm();
          setOpen((was) => !was);
        }}
        // Le pseudo part avant le clic — voir l'en-tete de ce fichier. `onFocus` couvre le
        // clavier, qui n'emet aucun survol.
        onPointerEnter={warm}
        onFocus={warm}
        ref={trigger}
        // Meme dessin et meme cible que le lien qu'il remplace : la barre est un budget en
        // pixels sur telephone, et ce menu ne doit pas en prendre un de plus.
        className="nav-target flex shrink-0 items-center justify-center gap-1.5 meta-sm hover:text-(--color-text)"
      >
        <Icon name="user" />
        <span className="hidden sm:inline">{t('account.nav')}</span>
        <span className="sr-only sm:hidden">{t('account.nav')}</span>
      </button>

      {open ? (
        <nav id="account-menu" aria-label={t('nav.menu.aria')} className="nav-menu panel">
          <ul>
            {/* Son propre profil public en tete : c'est la destination qui n'existait nulle
                part, et c'est celle qu'on cherche en premier — voir ce que les autres voient.

                ⚠️ Trois etats, et **aucun bouton mort** (regle du 2026-08-09) : le lien quand
                on connait le pseudo ; la porte vers `/amis` — ou le pseudo se choisit — quand
                le compte n'en a pas encore ; et **rien** tant qu'on n'est pas connecte, ou la
                ligne « Se connecter » plus bas dit deja tout. */}
            {signedIn ? (
              handle !== undefined ? (
                <Item href={pathIn(`/u/${handle}`, locale)} label={`@${handle}`} hint={t('nav.profile')} />
              ) : (
                <Item href={pathIn('/amis', locale)} label={t('nav.profile.claim')} />
              )
            ) : null}

            <Item href={pathIn('/journal', locale)} label={t('timeline.title')} />
            <Item href={pathIn('/parcourir', locale)} label={t('nav.browse')} />
            <Item href={pathIn('/compte', locale)} label={t('account.title')} />

            {signedIn ? (
              <li>
                <button
                  type="button"
                  className="nav-menu-item w-full text-left"
                  onClick={() => {
                    setOpen(false);
                    void leave();
                  }}
                >
                  {t('account.signOut')}
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

/** Une ligne du volet. `hint` dit ce que le libelle ne dit pas — « @nom » ne dit pas « profil ». */
function Item({ href, label, hint }: {
  readonly href: string;
  readonly label: string;
  readonly hint?: string;
}) {
  return (
    <li>
      <Link href={href} className="nav-menu-item">
        <span>{label}</span>
        {hint !== undefined ? <span className="meta-sm">{hint}</span> : null}
      </Link>
    </li>
  );
}

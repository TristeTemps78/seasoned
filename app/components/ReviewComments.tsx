'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { formatDate } from '@/lib/format';
import type { ReviewComment } from '@/src/social/client';
import { FaceDot } from '@/app/components/FaceDot';
import { ReportButton } from '@/app/components/ReportButton';

/**
 * La longueur d'une reponse, cote client.
 *
 * ⚠️ La meme valeur qu'en `024`, et la borne vit aux DEUX endroits : le champ compte pendant
 * la frappe — sans quoi on decouvre le refus apres avoir ecrit — et la base refuse, parce
 * qu'un client peut etre en retard sur elle. 600 la ou une critique en a 2000 : une critique
 * est un texte qu'on ecrit, une reponse est une reponse.
 */
const MAX_COMMENT_CHARS = 600;

/**
 * Repondre a une critique — F5.
 *
 * ## 🔴 Ce que ce composant ouvre, et ce qu'il refuse d'ouvrir
 *
 * Le releve du 2026-08-16 hesitait, et il avait raison : *« c'est le fil de discussion de
 * Letterboxd, et c'est aussi une surface de moderation entiere — a decider franchement plutot
 * qu'a laisser en creux »*.
 *
 * Ce qui est **refuse** est ecrit dans `024` et se voit ici : personne ne peut masquer le
 * message d'un autre, pas meme l'auteur de la critique. Le geste offert est **signaler**, sur
 * chaque ligne, comme sur le fil d'amis — et `/regles` dit ou ca arrive. Donner le retrait a
 * l'auteur de la critique serait le code le plus naturel a ecrire, et il ferait de chacun le
 * moderateur de son propre fil.
 *
 * ## ⚠️ Le spoiler d'abord : un fil ne s'affiche pas sous un texte masque
 *
 * Une reponse parle de ce qu'elle commente. L'afficher sous une critique caviardee revelerait
 * par la bande ce que le caviardage protege — *« il se passe quelque chose a la saison 6 »*
 * suffit a gacher. Le fil suit donc exactement l'etat du texte : masque avec lui, revele avec
 * lui. C'est la regle du spoiler appliquee a une surface neuve, et c'est un des trois silences
 * que `CLAUDE.md` garde.
 *
 * ## Un depliant, et le compte dessus
 *
 * Une fiche serie porte onze blocs ; dix fils deplies en feraient une page de forum. Le compte
 * est sur le depliant parce que c'est **lui** l'information a froid : savoir qu'il y a trois
 * reponses decide de l'ouverture. A zero, il n'y a pas de depliant du tout — seulement le
 * champ, pour qui peut ecrire.
 */
export function ReviewComments({
  review,
  comments,
  onSend,
  onRemove,
  onReport,
}: {
  readonly review: { readonly authorId: string; readonly subject: string; readonly target: string };
  readonly comments: readonly ReviewComment[];
  readonly onSend: (body: string) => Promise<boolean>;
  readonly onRemove: (id: string) => Promise<boolean>;
  readonly onReport: (authorId: string, ground: string) => Promise<boolean>;
}) {
  const { t, tn, locale } = useT();
  const { account } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const trimmed = draft.trim();
  // ⚠️ Un compte ET un nom : `review_comments_insert` exige `has_handle`, donc un compte sans
  // pseudo verrait un formulaire dont l'envoi serait refuse par la base. Un bouton qui ne peut
  // pas marcher ne s'affiche pas (regle du 2026-08-09) — on montre la porte qui debloque.
  const signedIn = account !== undefined;

  const send = async () => {
    if (trimmed.length === 0 || trimmed.length > MAX_COMMENT_CHARS) return;
    setBusy(true);
    const ok = await onSend(trimmed);
    setBusy(false);
    setFailed(!ok);
    if (ok) setDraft('');
  };

  return (
    <div className="space-y-2">
      {comments.length > 0 ? (
        <button
          type="button"
          className="quiet-action"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          {tn('comments.count', comments.length)}
        </button>
      ) : null}

      {open && comments.length > 0 ? (
        <ul className="space-y-2 border-l border-(--color-edge) pl-3">
          {comments.map((one) => (
            <li key={one.id} className="space-y-1 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 meta-sm">
                <span className="flex items-center gap-1.5">
                  <FaceDot face={one.face} />
                  <Link
                    href={pathIn(`/u/${one.handle}`, locale)}
                    className="tap-line font-medium hover:text-(--color-volt)"
                  >
                    @{one.handle}
                  </Link>
                </span>
                <time dateTime={one.writtenAt}>
                  {formatDate(new Date(one.writtenAt), locale)}
                </time>
              </p>
              <p className="whitespace-pre-line">{one.body}</p>
              <p className="flex flex-wrap items-center gap-3">
                {/* Retirer LE SIEN, et rien d'autre — voir `024`. L'auteur de la critique n'a
                    aucun pouvoir ici, et c'est la decision de fond de ce lot. */}
                {account?.userId === one.authorId ? (
                  <button
                    type="button"
                    className="quiet-action"
                    onClick={() => void onRemove(one.id)}
                  >
                    {t('comments.remove')}
                  </button>
                ) : null}
                {/* ⚠️ Sur chaque ligne, et non dans un menu : on signale ce qu'on vient de
                    lire, au moment ou on le lit. Meme raisonnement que le fil d'amis. */}
                {signedIn && account.userId !== one.authorId ? (
                  <ReportButton onReport={(ground) => onReport(one.authorId, ground)} />
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ⚠️ Le champ n'est pas derriere le depliant : ouvrir un fil pour repondre demanderait
          de savoir qu'il y a un fil. A zero reponse, c'est **la seule chose affichee** — et
          c'est ce qui fait exister la fonctionnalite pour la premiere personne. */}
      {signedIn ? (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor={`comment-${review.subject}-${review.target}`}>
            {t('comments.write')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`comment-${review.subject}-${review.target}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_COMMENT_CHARS}
              placeholder={t('comments.placeholder')}
              className="min-w-0 flex-1 rounded-md border border-(--color-edge) bg-(--color-ink) px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="btn rounded-full"
              disabled={busy || trimmed.length === 0}
            >
              {t('comments.send')}
            </button>
          </div>
          {/* Une panne d'ecriture se dit **ici**, sur le geste : la banniere generale
              (`WriteFailureNotice`) l'annonce aussi, et elle est en haut de page — trop loin
              d'un champ qu'on vient de vider. */}
          {failed ? <p className="text-sm text-(--color-warn)">{t('comments.failed')}</p> : null}
        </form>
      ) : (
        // Regle 4 : un ecran sans issue, pas un ecran sans bouton. Le geste existe, il demande
        // un compte, et la porte est nommee.
        <p className="meta-sm">
          {t('comments.needAccount')}{' '}
          <Link className="tap-line underline hover:text-(--color-volt)" href={pathIn('/compte', locale)}>
            {t('comments.openOne')}
          </Link>
        </p>
      )}
    </div>
  );
}

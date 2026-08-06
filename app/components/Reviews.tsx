'use client';

import { useEffect, useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { useAuth } from '@/app/auth/AuthProvider';
import { authConfigFromEnv } from '@/src/auth/client';
import { ReportButton } from '@/app/components/ReportButton';
import { journalKey } from '@/src/domain/journal';
import { redactReviews } from '@/src/domain/spoiler';
import { SocialClient, type PublishedReview } from '@/src/social/client';

/**
 * Ce que les autres ont ecrit — caviarde par la position du lecteur.
 *
 * ## Le caviardage se fait ICI, dans le navigateur
 *
 * Le serveur envoie les critiques sans savoir ou en est celui qui les lit, et c'est
 * exactement ce qui empeche sa position de fuir : il n'a rien a demander. Le filtre est
 * `redactReviews`, dans le domaine (`AGENTS.md` regle 7 — jamais dans la couche de rendu).
 *
 * ⚠️ Le texte masque n'est **pas** rendu puis cache en CSS : il ne descend pas dans le DOM.
 * Un `display:none` se lit dans l'inspecteur, se copie, et se retrouve dans le presse-papier
 * d'un « tout selectionner ».
 *
 * ## Chargement paresseux, et zero route serveur
 *
 * La page reste `force-static` et mise en cache au bord. La lecture part du navigateur au
 * moment ou l'on descend jusqu'ici — donc elle ne coute rien a ceux qui ne descendent pas,
 * et rien du tout a Vercel.
 */
export function Reviews({ seriesId }: { readonly seriesId: string }) {
  const { account } = useAuth();
  const { journal, ready } = useJournal();
  const { t } = useT();
  const [reviews, setReviews] = useState<readonly PublishedReview[] | undefined>(undefined);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const key = journalKey(seriesId);
  const accessToken = account?.accessToken;

  useEffect(() => {
    // ⚠️ Aucun compte n'est requis pour LIRE : c'est RLS qui decide, et un profil `public`
    // est lisible par un visiteur anonyme. Exiger une session ici fermerait les critiques a
    // l'audience qui vient du moteur de recherche — celle pour qui elles sont ecrites.
    const config = authConfigFromEnv();
    if (config === undefined) return;

    const social = new SocialClient({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: () => accessToken,
    });

    let alive = true;
    void social.reviewsFor(key).then((rows) => {
      if (alive) setReviews(rows);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, key]);

  // Rien tant qu'on ne sait pas : annoncer « personne n'a rien ecrit » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  if (!ready || reviews === undefined || reviews.length === 0) return null;

  const position = journal.entries[key]?.position;
  const visible = redactReviews(
    reviews,
    position === undefined
      ? undefined
      : {
          at: { seriesId, seasonNumber: position.seasonNumber, episodeNumber: position.episodeNumber },
          declaredAt: new Date(position.declaredAt),
        },
  );

  return (
    <section className="space-y-3" aria-label={t('review.title')}>
      <h2 className="section-heading">{t('review.title')}</h2>

      <ul className="space-y-3">
        {visible.map((review) => {
          const id = `${review.authorId}:${review.target}`;
          const shown = revealed.has(id);
          return (
            <li key={id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">@{review.handle}</span>
                {/* Signaler exige un compte : c'est l'auteur du signalement que la base
                    enregistre, et un signalement anonyme n'est pas examinable. */}
                {account !== undefined ? (
                  <ReportButton
                    onReport={async (ground) => {
                      const config = authConfigFromEnv();
                      if (config === undefined) return false;
                      const social = new SocialClient({
                        url: config.url,
                        anonKey: config.anonKey,
                        accessToken: () => accessToken,
                      });
                      return social.report(account.userId, review.authorId, ground);
                    }}
                  />
                ) : null}
              </div>

              {review.hidden === true && !shown ? (
                <div className="space-y-2">
                  {/* Le fait reste, le contenu non. Retirer la ligne entiere ferait un fil a
                      trous, qui est lui-meme un indice — savoir qu'il EXISTE une critique de
                      la saison 6 n'en revele pas le contenu. */}
                  <p className="text-sm text-(--color-muted)">
                    {review.target === 'series'
                      ? t('review.hiddenSeries')
                      : t('review.hidden', { n: review.throughSeason })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRevealed((current) => new Set(current).add(id))}
                    className="btn rounded-full"
                  >
                    {t('review.reveal')}
                  </button>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-line">
                  {shown ? (review.hiddenText ?? review.text) : review.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

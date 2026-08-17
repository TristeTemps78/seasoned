'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { useSocial } from '@/app/social/useSocial';
import { FaceDot } from '@/app/components/FaceDot';
import { ReviewBody } from '@/app/components/ReviewBody';
import { parseJournalKey } from '@/src/domain/journal';
import { redactReviewsAcross } from '@/src/domain/spoiler';
import { pathIn } from '@/lib/routes';
import { type PublishedReview } from '@/src/social/client';

/**
 * Les critiques, dans les resultats de recherche — **le quatrieme index** (F4).
 *
 * ## Ce qui restait ferme
 *
 * Series, personnes, listes : trois index sur les six de la reference. Les critiques sont
 * pourtant **la moitie de la cible** — *« Letterboxd : écrire, noter, faire des listes, un
 * profil »* — et le corpus existe deja. Chercher « fin bâclée » ne rendait rien, alors que
 * c'est exactement la phrase qu'on tape quand on hesite devant une serie.
 *
 * ## ⚠️ Le caviardage s'applique ICI, comme partout ailleurs
 *
 * Une critique trouvee par sa recherche peut parler de la saison 6. `redactReviewsAcross`
 * masque oeuvre par oeuvre, avec la position du lecteur sur **chacune** — c'est la version
 * « a travers les oeuvres », et l'employer est obligatoire des qu'une surface melange les
 * series. Le piege que `DiscoverReviews` documente : la version a une seule position
 * revelerait la saison 6 de l'une parce que le lecteur en est a la saison 6 de l'autre.
 *
 * ⚠️ **Le texte trouve peut donc etre masque a l'ecran**, et c'est juste : le filtre a
 * cherche dans ce que la base rend lisible (RLS), le rendu decide de ce qui se montre. Ne
 * jamais afficher `review.text` brut ici.
 */
export function ReviewResults({ query }: { readonly query: string }) {
  const { t, locale } = useT();
  const { journal } = useJournal();
  const [reviews, setReviews] = useState<readonly PublishedReview[]>([]);

  const social = useSocial();

  useEffect(() => {
    if (social === undefined) return;

    let alive = true;
    void social.searchReviews(query).then((rows) => {
      if (alive) setReviews(rows);
    });
    return () => {
      alive = false;
    };
  }, [social, query]);

  // Silencieux quand il n'y a rien : la page porte deja son propre « aucun resultat », et
  // une phrase par index sous chaque recherche serait du bruit. Meme raisonnement que
  // `PeopleResults` et `ListResults`.
  if (reviews.length === 0) return null;

  const visible = redactReviewsAcross(reviews, (subject) => {
    const position = journal.entries[subject]?.position;
    const parsed = parseJournalKey(subject);
    if (position === undefined || parsed === undefined) return undefined;
    return {
      at: {
        seriesId: parsed.providerId,
        seasonNumber: position.seasonNumber,
        episodeNumber: position.episodeNumber,
      },
      declaredAt: new Date(position.declaredAt),
    };
  });

  return (
    <section className="space-y-3" aria-label={t('search.reviews')}>
      <h2 className="section-heading">{t('search.reviews')}</h2>
      <ul className="space-y-2">
        {visible.map((shown) => {
          const parsed = parseJournalKey(shown.subject);
          // L'instantane publie d'abord, le journal du lecteur en repli, jamais la cle nue :
          // « tmdb:94997 » a ete constate en production le 2026-08-16 sur le fil.
          const title =
            shown.title ??
            journal.entries[shown.subject]?.snapshot?.title ??
            t('feed.someSeries');
          const href =
            parsed === undefined ? undefined : pathIn(`/serie/${parsed.providerId}`, locale);

          const card = (
            <div className="card space-y-1 px-3 py-2">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{title}</span>
                <span className="flex items-center gap-1.5 meta-sm">
                  <FaceDot face={shown.face} />@{shown.handle}
                </span>
              </p>
              <ReviewBody
                hidden={shown.hidden === true}
                text={shown.text}
                hiddenText={shown.hiddenText ?? ''}
                throughSeason={shown.throughSeason}
              />
            </div>
          );

          return (
            <li key={`${shown.authorId}:${shown.subject}:${shown.target}`}>
              {/* Le lien mene a la **fiche de la serie**, jamais au profil : on cherche une
                  phrase pour decider de regarder une serie, et c'est la que le reste de
                  l'avis vit — avec les autres critiques, les saisons et « ou la regarder ». */}
              {href === undefined ? card : <Link href={href}>{card}</Link>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

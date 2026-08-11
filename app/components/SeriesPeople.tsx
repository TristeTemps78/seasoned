'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { Avatar } from '@/app/components/Avatar';
import { useT } from '@/app/i18n/LocaleProvider';
import { journalKey } from '@/src/domain/journal';
import { type SocialClient, type FeedItem } from '@/src/social/client';
import { pathIn } from '@/lib/routes';
import { socialFrom } from '@/app/social/socialFrom';

/**
 * Qui d'autre a aime ou termine cette serie.
 *
 * ## La porte principale de la decouverte, et elle etait fermee
 *
 * `Discover.tsx` le dit deja de lui-meme : *« la deuxieme porte n'est pas ici, elle est sur
 * la fiche serie… c'est meme la porte principale — on croise quelqu'un parce que son avis
 * sur une serie nous interesse, pas parce qu'on cherchait des gens »*. Elle n'existait
 * pourtant qu'a travers les **critiques**, c'est-a-dire pour qui a pris le temps d'ecrire.
 * Un coeur se pose en un clic : la meme porte, ouverte a bien plus de monde.
 *
 * ## Ce que ce composant n'est pas
 *
 * **Pas un compteur de popularite.** Il ne dit jamais « 47 personnes aiment cette serie » —
 * d'abord parce que ce serait faux (RLS ne rend que les gens **visibles par ce lecteur**,
 * donc le nombre varierait d'un visiteur a l'autre pour la meme serie), ensuite parce qu'un
 * chiffre n'ouvre aucun profil. Ce sont des **noms sur lesquels cliquer**, ou rien.
 *
 * **Pas une source de spoiler.** Les deux faits montres ne portent aucun numero de saison
 * (voir {@link SocialClient.watchersOf}) : ils ne disent rien de l'interieur de la serie.
 * C'est la question que pose — *ce fait decrit-il l'oeuvre ou quelqu'un
 * d'autre ?* — et la reponse est « quelqu'un d'autre », comme pour le fil.
 *
 * **Se tait quand il n'y a personne**, et se tait aussi quand il n'y a que soi :
 * *mieux vaut se taire que compter zero*, et se soi-meme n'est pas une decouverte.
 */
export function SeriesPeople({ seriesId }: { readonly seriesId: string }) {
  const { t, locale } = useT();
  const { configured, account } = useAuth();
  const [people, setPeople] = useState<readonly FeedItem[]>([]);

  const key = journalKey(seriesId);
  const accessToken = account?.accessToken;
  const myId = account?.userId;

  useEffect(() => {
    // Construit meme sans compte : l'activite d'un profil `public` se lit par un visiteur
    // anonyme, et c'est RLS qui tranche. Exiger une session fermerait cet encart a
    // exactement l'audience qui arrive par un moteur de recherche.
    const social = socialFrom(accessToken);
    if (social === undefined) return;

    let alive = true;
    void social.watchersOf(key).then((rows) => {
      if (alive) setPeople(rows);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, key]);

  // Une ligne par personne, pas par fait : quelqu'un qui a aime **et** termine apparaitrait
  // deux fois, ce qui laisserait croire a deux personnes. Le fil arrive du plus recent au
  // plus ancien, donc le premier vu est le fait le plus recent — c'est celui qu'on garde.
  //
  // ⚠️ Le genre est **revalide ici** alors que la requete le filtre deja, et ce n'est pas
  // « au cas ou » : `FeedItem['kind']` en compte cinq, donc un `kind === 'liked' ? … : …`
  // etiquetterait « a termine » n'importe quel autre genre. La base filtre, le client se
  // protege — la meme repartition que `005_liked.sql`.
  const seen = new Set<string>();
  const shown = people.filter((item) => {
    if (item.kind !== 'liked' && item.kind !== 'finished') return false;
    if (item.authorId === myId || seen.has(item.authorId)) return false;
    seen.add(item.authorId);
    return true;
  });

  if (!configured || shown.length === 0) return null;

  return (
    <section className="card space-y-3" aria-label={t('people.title')}>
      <h2 className="card-title">{t('people.title')}</h2>
      <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
        {shown.map((item) => (
          <li key={item.authorId} className="flex items-center gap-2">
            <Avatar handle={item.handle} face={item.face} />
            <span>
              <Link
                href={pathIn(`/u/${item.handle}`, locale)}
                className="font-medium hover:text-(--color-volt)"
              >
                @{item.handle}
              </Link>{' '}
              <span className="text-(--color-muted)">
                {t(item.kind === 'liked' ? 'people.liked' : 'people.finished')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

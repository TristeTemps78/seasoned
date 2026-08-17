'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { readAttrition, type StopBucket } from '@/src/domain/attrition';
import { journalKey } from '@/src/domain/journal';
import type { SeasonSize } from '@/src/domain/remaining';
import { useSocial } from '@/app/social/useSocial';

/**
 * Ou la foule decroche — et sur quel effectif.
 *
 * ## Ce que cet encart apporte que la trajectoire ne peut pas
 *
 * La courbe juste au-dessus est batie sur les **notes du public TMDB**, et
 * `src/domain/stop-point.ts` nomme sa propre limite : *biais de survie*. Ceux qui ont vu la
 * saison 6 sont ceux qui ont persevere ; ils la notent bien, et la courbe publique ne
 * retrouve jamais l'effondrement dont tout le monde parle.
 *
 * Ici, chaque ligne est posee par **quelqu'un qui est parti**. C'est la meme question, avec
 * la seule matiere qui puisse y repondre — et c'est ce que ce produit a de plus a dire.
 *
 * ## Ce que cet encart n'est pas
 *
 * **Pas un compteur de popularite.** Il ne dit jamais combien de gens regardent une serie :
 * il ne parle qu'en **parts**, toujours accompagnees de leur effectif. « 62 % » seul se lit
 * comme une verite ; « 62 %, mesure sur 34 personnes » se lit comme une mesure.
 *
 * **Pas un annuaire.** `stop_map()` ne rend que des comptes, et la table qu'elle interroge
 * n'a aucune politique de lecture : il n'existe aucun chemin, depuis cet ecran ou ailleurs,
 * qui mene d'un abandon a la personne qui l'a declare.
 *
 * **Pas une source de spoiler.** La courbe est tronquee a la position du lecteur par
 * {@link readAttrition}, qui **recalcule** au lieu de masquer — un decrochage derive de
 * saisons non vues fuiterait a travers l'agregat meme si la courbe est coupee. Ce qui suit
 * la position ne s'ouvre que par un geste, comme la trajectoire.
 *
 * **Muet a froid**, et c'est structurel : `stop_map()` se tait sous cinq contributeurs.
 * ⚠️ Un ecran vide ici ne prouve donc rien — ni que ca marche, ni que ca ne marche pas.
 * Seule une vraie base avec de vraies lignes tranche (lecon de 10.0).
 */
export function StopMap({
  seriesId,
  seasons,
  episodeCount,
}: {
  readonly seriesId: string;
  readonly seasons: readonly SeasonSize[];
  readonly episodeCount: number;
}) {
  const { t, tn, n } = useT();
  const { configured } = useAuth();
  const { journal, ready } = useJournal();
  const [buckets, setBuckets] = useState<readonly StopBucket[]>([]);

  const key = journalKey(seriesId);
  const social = useSocial();

  useEffect(() => {
    // Lue sans compte : `stop_map` est executable par `anon`, et le lecteur qu'elle sert le
    // mieux est justement celui qui hesite a commencer — souvent quelqu'un qui arrive d'un
    // moteur de recherche. Exiger une session la fermerait a son meilleur public.
    if (social === undefined) return;

    let alive = true;
    void social.stopMap(key).then((rows) => {
      if (alive) setBuckets(rows);
    });
    return () => {
      alive = false;
    };
  }, [social, key]);

  const entry = journal.entries[key];
  const p = entry?.position;
  const position =
    p !== undefined
      ? {
          at: { seriesId, seasonNumber: p.seasonNumber, episodeNumber: p.episodeNumber },
          declaredAt: new Date(p.declaredAt),
        }
      : undefined;

  const read = readAttrition(buckets, position, seasons, episodeCount);

  // `ready` avant tout : sans lui, le premier rendu se ferait avec un journal vide, donc
  // **sans position** — et le composant afficherait une seconde une courbe caviardee a zero
  // avant de la deplier. Un clignotement qui ressemble a un defaut.
  if (!configured || !ready || buckets.length === 0) return null;

  return (
    <section className="band mt-6" aria-label={t('stops.aria')}>
      <h3 className="row-title">{t('stops.title')}</h3>

      {read.verdict !== undefined ? (
        <p className="rounded-md bg-(--color-warn)/10 px-3 py-2.5 text-sm">
          {t('stops.verdict', {
            rate: n(read.verdict.leaveRate * 100, 0),
            s: read.verdict.atSeason,
          })}{' '}
          {/* ⚠️ L'effectif n'est pas une precision facultative : il est ce qui distingue un
              chiffre d'un fait, et le domaine le rend precisement pour qu'on l'affiche. */}
          <span className="text-(--color-muted)">
            {t('stops.basis', { people: tn('stops.people', read.verdict.reached) })}
          </span>
        </p>
      ) : null}

      {/* Dire QU'IL se passe quelque chose plus loin sans dire QUOI : c'est le meme geste
          que `hasHiddenSignal` sur la trajectoire, et il vaut mieux que le silence — sans
          lui, quelqu'un en saison 2 ne saurait pas qu'il y a une raison de deplier. */}
      {read.hasHiddenSignal ? (
        <p className="meta">{t('stops.hidden')}</p>
      ) : null}

      <details className="group panel">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none">
          <span>{t('stops.seeAll')}</span>
          <span className="ml-2 font-normal text-(--color-muted)">{t('stops.warning')}</span>
        </summary>
        <ul className="space-y-1 border-t border-(--color-edge) px-4 py-4 text-sm">
          {buckets.map((bucket) => (
            <li key={bucket.season} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-16 shrink-0 text-(--color-muted)">S{bucket.season}</span>
              <span className="tabular-nums">{tn('stops.reached', bucket.reached)}</span>
              <span className="tabular-nums text-(--color-muted)">
                {tn('stops.left', bucket.leftHere)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="meta-sm">{t('stops.source')}</p>
    </section>
  );
}

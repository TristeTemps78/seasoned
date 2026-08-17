'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { useSocial } from '@/app/social/useSocial';
import { FaceDot } from '@/app/components/FaceDot';
import { parseJournalKey } from '@/src/domain/journal';
import { formatDate } from '@/lib/format';
import { pathIn } from '@/lib/routes';
import type { Feedback as Retour } from '@/src/social/client';

/**
 * **Ce que vos textes ont recu** — le chemin de retour qui n'existait pas.
 *
 * ## 🔴 Le manque, et pourquoi c'etait le plus cher des trois
 *
 * Une critique peut recevoir un coeur (`015`) et une reponse (`024`). Les deux ne
 * s'affichent que **sur la fiche de la bonne serie** — et l'auteur d'une critique n'y
 * repasse pas : il verrait ses reponses uniquement en rouvrant par hasard la page ou il a
 * ecrit, il y a trois semaines. Il y avait donc deux canaux de retour et **aucun qui
 * revienne**.
 *
 * `015_review_likes.sql` avait pourtant ecrit la raison d'etre du coeur en une phrase :
 * *« ecrire dans le vide est ce qui fait arreter d'ecrire »*. Le coeur existait, le vide
 * aussi.
 *
 * ## ⛔ Ce que ce composant n'est PAS, et ne doit pas devenir
 *
 * **Pas une notification.** Rien n'est pousse, rien n'est stocke cote serveur, rien ne coute
 * par utilisateur — c'est le cout par utilisateur qui a tue TV Time, et le produit s'en
 * interdit le principe. C'est un retour **au retour** : la page ne dit ce qu'elle a recu que
 * quand on l'ouvre.
 *
 * **Pas une pastille dans l'en-tete.** C'etait l'autre place possible, et elle a ete
 * refusee : le volet du compte est monte sur **toutes** les pages, donc une pastille y
 * demanderait une lecture Supabase **par page servie** pour un chiffre qui bouge une fois
 * par semaine. Le retour vit ou l'on revient — `/moi` —, et il ne coute rien nulle part
 * ailleurs.
 *
 * ## Le « nouveau » est local, et c'est suffisant
 *
 * L'instant de la derniere visite est garde dans ce navigateur. Le tenir cote serveur
 * demanderait une table, une ecriture par ouverture de page et un etat de plus a
 * synchroniser — pour distinguer du gras. ⚠️ Consequence assumee : ouvrir `/moi` sur un
 * second appareil y remontre tout comme neuf une fois. C'est le bon defaut : montrer deux
 * fois vaut mieux que ne jamais montrer.
 */
const SEEN_KEY = 'voltface:feedback-seen';

/** L'instant de la derniere visite, ou rien. Ne leve jamais : le stockage peut etre ferme. */
function lastSeen(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function remember(at: string): void {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, at);
  } catch {
    /* Un stockage ferme ne doit pas empecher de lire ses retours. */
  }
}

export function Feedback() {
  const { account } = useAuth();
  const { journal } = useJournal();
  const { t, tn, locale } = useT();
  const social = useSocial();

  const [items, setItems] = useState<readonly Retour[] | undefined>(undefined);
  /**
   * L'instant lu **au montage**, avant de marquer la visite.
   *
   * ⚠️ Dans un etat et non lu au rendu : marquer la visite met a jour le stockage, donc un
   * `lastSeen()` appele pendant le rendu ne verrait plus jamais de « nouveau » des le second
   * rendu. Le seuil se fige une fois, a l'arrivee.
   */
  const [since, setSince] = useState<string | undefined>(undefined);
  /** Mon nom public — l'adresse d'une de mes listes le porte. */
  const [myHandle, setMyHandle] = useState<string | undefined>(undefined);

  const userId = account?.userId;

  useEffect(() => {
    if (social === undefined || userId === undefined) return;
    setSince(lastSeen());

    let alive = true;
    // ⚠️ Demande **avec** les retours et non avant : les deux partent ensemble, et enchainer
    // ferait apparaitre les lignes puis leurs liens, donc bouger une cible sous le doigt.
    void social.myProfile(userId).then((mine) => {
      if (alive) setMyHandle(mine?.handle);
    });
    void social.feedbackFor(userId).then((rows) => {
      if (!alive) return;
      setItems(rows);
      // On marque la visite **apres** avoir recu : marquer avant perdrait tout ce qui est
      // arrive entre-temps si la lecture echoue.
      const newest = rows[0]?.at;
      if (newest !== undefined) remember(newest);
    });
    return () => {
      alive = false;
    };
  }, [social, userId]);

  // ⚠️ Silence tant qu'on ne sait pas, et silence quand il n'y a rien — l'exception que
  // `CLAUDE.md` nomme : *ce qui n'a litteralement rien derriere sur une page par ailleurs
  // pleine*. Un encart « personne ne vous a repondu » sur la page de quelqu'un qui n'a
  // encore rien publie annoncerait un manque qui n'est pas le sien.
  if (items === undefined || items.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={t('feedback.title')}>
      <h2 className="section-heading">{t('feedback.title')}</h2>
      <p className="meta">{t('feedback.lede')}</p>

      <ul className="space-y-2">
        {items.map((one) => {
          // ⚠️ Un coeur de liste ne porte pas de cle de journal : son `subject` est un slug.
          // Le passer a `parseJournalKey` rendrait `undefined`, donc pas de lien — mais on
          // veut un lien, vers la liste. D'ou la branche, plutot qu'un repli silencieux.
          const surListe = one.kind === 'listHeart';
          const surQuelquun = one.kind === 'follow';
          const parsed = surListe ? undefined : parseJournalKey(one.subject);
          // ⚠️ Le titre vient du journal **du lecteur**, et c'est le seul endroit du produit
          // ou ce repli est sur : ces critiques sont les siennes, donc la serie est
          // forcement dans son journal. Ailleurs (fil, vitrine, listes) elle ne l'est pas,
          // et c'est pour ca que l'instantane voyage depuis `018`.
          // ⚠️ Jamais le slug en repli : c'est une adresse, pas un nom — meme regle que
          // « jamais `tmdb:94997` a l'ecran », et `no-raw-journal-key` la garde.
          // ⚠️ Vide pour un abonnement : il ne parle d'aucune oeuvre, et le repli
          // « une serie » y affichait litteralement « @x vous suit · une serie » — mesure a
          // l'ecran le 2026-08-18, deux minutes apres la livraison.
          const title = surQuelquun
            ? ''
            : surListe
              ? (one.body ?? t('feedback.someList'))
              : (journal.entries[one.subject]?.snapshot?.title ?? t('feed.someSeries'));
          const href = surQuelquun
            ? pathIn(`/u/${one.subject}`, locale)
            : surListe
            ? // ⚠️ `handle` vient du compte et non de la ligne : c'est **ma** liste, donc mon
              // nom. Le demander a la base serait un appel de plus pour une information que
              // la session porte deja.
              (myHandle === undefined
                ? undefined
                : pathIn(`/u/${myHandle}/liste/${one.subject}`, locale))
            : parsed === undefined
              ? undefined
              : pathIn(`/serie/${parsed.providerId}`, locale);
          const fresh = since === undefined || one.at > since;

          const line = (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {surQuelquun ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <FaceDot face={one.face} />
                    {t('feedback.follow', { who: `@${one.handle ?? ''}` })}
                  </span>
                ) : one.kind === 'heart' || one.kind === 'listHeart' ? (
                  <span className="text-sm">
                    {tn(one.kind === 'listHeart' ? 'feedback.listHearts' : 'feedback.hearts', one.count)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm">
                    <FaceDot face={one.face} />
                    {t('feedback.reply', { who: `@${one.handle ?? ''}` })}
                  </span>
                )}
                <span className="meta-sm">{title}</span>
                {/* Le point rouge n'existe pas ici : un mot dit ce qu'une pastille laisse
                    deviner, et il se lit aussi bien sans couleur. */}
                {fresh ? <span className="meta-sm text-(--color-volt)">{t('feedback.new')}</span> : null}
                <time dateTime={one.at} className="meta-sm">
                  {formatDate(new Date(one.at), locale)}
                </time>
              </span>
              {/* Le corps est le texte d'une reponse — pour un coeur de liste, il porte le
                  titre, deja affiche a cote. L'afficher deux fois ferait un doublon. */}
              {one.body !== undefined && one.kind === 'reply' ? (
                <span className="block text-sm whitespace-pre-line">{one.body}</span>
              ) : null}
            </>
          );

          return (
            <li key={`${one.kind}:${one.subject}:${one.target}:${one.at}`} className="card space-y-1">
              {/* ⚠️ La ligne entiere mene a l'endroit ou le retour a ete pose : un retour
                  qu'on ne peut pas aller lire est une notification, c'est-a-dire exactement
                  ce que ce composant refuse d'etre. */}
              {href === undefined ? (
                line
              ) : (
                <Link href={href} className="tap-line block hover:text-(--color-volt)">
                  {line}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

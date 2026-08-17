'use client';

import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { projectActivity } from '@/src/domain/activity';
import { projectStops } from '@/src/domain/attrition';
import { favoritesOf, seriesEntries, tagsOf } from '@/src/domain/journal';
import { useSocial } from '@/app/social/useSocial';

/**
 * Pousse l'activite publiable, **depuis n'importe quelle page**.
 *
 * ## 🔴 Le defaut que ce composant repare
 *
 * La projection ne partait que depuis `/amis` : c'est la, et nulle part ailleurs, que
 * `publish` etait appele. Terminer une serie depuis sa fiche, puis ne pas retourner chez
 * ses amis, laissait donc le fait **dans le navigateur pour toujours** — le fil des autres
 * ne l'apprenait jamais.
 *
 * Constate le 2026-08-10 sur la vraie base : deux comptes, trois critiques ecrites… et
 * **zero activite**. Rien ne pouvait le signaler, parce qu'un fil vide et un fil qui n'a
 * jamais rien recu donnent exactement le meme ecran. C'est le defaut de 10.0, sur un autre
 * chemin.
 *
 * ## Pourquoi ici, et pas dans la couche de synchronisation
 *
 * Le journal ne connait pas le social, et il ne doit pas : `src/journal/` sait sauvegarder
 * un document, pas ce qu'un produit social en tire. Brancher la projection la-bas
 * melangerait deux couches que le depot tient separees depuis le lot 6.
 *
 * On le fait donc dans le chrome du site — monte sur toutes les pages, invisible, sans
 * rendu.
 *
 * ⚠️ **Debattu, et une seule fois par contenu.** Le journal change a chaque frappe ; sans
 * garde, chaque demi-etoile posee declencherait un envoi. On attend que ca se calme, et on
 * n'envoie que si la projection a **reellement** change depuis le dernier envoi.
 *
 * ## Deux projections, un seul temporisateur
 *
 * Le fil (`projectActivity`) et la carte des abandons (`projectStops`) partent d'ici, du
 * meme journal et au meme moment. Deux effets separes feraient deux temporisateurs sur la
 * meme frappe, pour deux envois qui se suivent d'une milliseconde ; leurs signatures
 * restent distinctes, parce que l'une peut changer sans l'autre — noter une saison bouge le
 * fil et pas la carte.
 */
export function PublishActivity() {
  const { configured, account } = useAuth();
  const { journal, ready } = useJournal();
  const lastSent = useRef<string | undefined>(undefined);
  const lastStops = useRef<string | undefined>(undefined);
  const lastPinned = useRef<string | undefined>(undefined);
  const lastTags = useRef<string | undefined>(undefined);
  /**
   * ⚠️ **Ce que le SERVEUR porte deja**, demande une fois par montage — et c'est ce qui
   * supprime deux ecritures par page vue.
   *
   * ## 🔴 Le cout mesure le 2026-08-18, sur une fiche serie
   *
   * Onze appels Supabase, dont **deux ecritures de mots** : `publishTags` efface puis
   * reinsere, et la signature de reference (`lastTags`) vaut `undefined` a chaque montage.
   * Un compte qui partage ses mots repayait donc `DELETE tags` + `POST tags` a **chaque
   * chargement de page**, pour un vocabulaire qui change une fois par mois.
   *
   * ## Pourquoi une lecture plutot qu'une memoire persistante
   *
   * `D2` a refuse la signature en `sessionStorage`, et le refus tient : *« une couche de
   * plus, et une couche qui peut se desynchroniser du serveur »*. Demander au serveur ce
   * qu'il porte ne peut pas se desynchroniser — c'est **lui** la source. Une lecture
   * remplace donc deux ecritures dans le cas courant (rien n'a change), et supprime au
   * passage la fenetre destructrice : entre le `DELETE` et le `POST`, un reseau qui tombe
   * laissait le profil sans aucun mot.
   *
   * ⚠️ Elle ne part **que si l'accord est donne** : sans `shareTags`, il n'y a rien a
   * comparer et le vide se publie comme avant — c'est-a-dire qu'il efface, ce qui est tout
   * l'objet du refus.
   */
  const [serverTags, setServerTags] = useState<string | undefined>(undefined);
  const forgotten = useRef(false);

  const social = useSocial();
  const userId = account?.userId;
  const keepStopsPrivate = journal.keepStopsPrivate === true;
  const shareTags = journal.shareTags === true;

  /**
   * Ce que le serveur porte deja, lu **une fois** — voir {@link serverTags}.
   *
   * ⚠️ Un effet a part et non une ligne dans celui d'en dessous : celui-la se redeclenche a
   * chaque frappe (le journal est dans ses dependances), et cette lecture ne doit partir
   * qu'une fois par montage. Ses dependances sont donc le strict minimum.
   *
   * ⚠️ La forme lue est **normalisee comme celle qu'on enverrait** : comparer deux JSON
   * construits differemment rendrait toujours « ca a change », donc republierait toujours —
   * le defaut qu'on corrige, deguise en correctif.
   */
  useEffect(() => {
    if (!configured || !ready || userId === undefined || !shareTags) return;
    if (social === undefined || serverTags !== undefined) return;

    let alive = true;
    void social.tagsBy(userId).then((rows) => {
      if (!alive) return;
      setServerTags(
        JSON.stringify(
        [...rows]
          .map((one) => ({
            subject: one.subject,
            tag: one.tag,
            ...(one.title !== undefined ? { title: one.title } : {}),
            ...(one.posterPath !== undefined ? { posterPath: one.posterPath } : {}),
          }))
          // Le meme ordre que la projection locale : la base rend `tag.asc`, le journal rend
          // serie par serie. Deux ordres differents pour un meme contenu se compareraient
          // comme deux contenus differents.
            .sort((x, y) => (x.subject + x.tag < y.subject + y.tag ? -1 : 1)),
        ),
      );
    });
    return () => {
      alive = false;
    };
  }, [configured, ready, userId, social, shareTags, serverTags]);

  useEffect(() => {
    if (!configured || !ready || userId === undefined) return;
    // ⚠️ **Avant le minuteur, pas dedans.** Sans configuration il n'y a rien a envoyer, et
    // programmer un envoi qui ne partira pas ferait vivre un minuteur par frappe pour rien.
    if (social === undefined) return;

    const items = projectActivity(journal, new Date());
    // ⚠️ La carte se calcule meme quand on n'y contribue pas : c'est le **refus** qui
    // decide de l'envoi, pas la projection. La calculer sous la condition inverse rendrait
    // le code plus court et la reprise du consentement muette jusqu'au prochain geste.
    const stops = keepStopsPrivate ? [] : projectStops(journal);
    /**
     * 🔴 Les quatre epinglees, qui n'allaient nulle part.
     *
     * Le bouton s'appelle « Pin to profile » depuis toujours et elles vivaient dans le
     * journal, donc dans ce navigateur : `<Favorites />` n'est monte que sur `/moi`. On
     * epinglait sur un profil que personne ne verrait — voir `021_profile_favorites.sql`.
     *
     * ⚠️ Elles partent **avec leur instantane**, pour la troisieme fois apres `018` et
     * `020` : un profil est lu par des gens qui ne suivent pas les memes series, et une cle
     * nue s'y afficherait en monogramme.
     */
    const pinned = favoritesOf(journal).map((key) => {
      const snapshot = journal.entries[key]?.snapshot;
      return {
        subject: key,
        ...(snapshot?.title !== undefined ? { title: snapshot.title } : {}),
        ...(snapshot?.posterPath !== undefined ? { posterPath: snapshot.posterPath } : {}),
      };
    });

    /**
     * Les mots, **et seulement si la personne l'a demande**.
     *
     * ⚠️ L'asymetrie avec la carte des abandons est deliberee et elle est ecrite dans
     * `Journal.shareTags` : un point d'arret est anonyme et illisible, un mot est une phrase
     * attachee a un nom. Le tableau vide sous refus n'est pas « ne rien envoyer » — c'est
     * **envoyer le vide**, donc retirer ce qui aurait ete publie avant que l'accord ne soit
     * repris. Meme mecanique que `forgetStops`, en plus simple : cette table se relit.
     */
    const words = shareTags
      ? seriesEntries(journal).flatMap(([key, entry]) => {
          const snapshot = entry.snapshot;
          return tagsOf(entry).map((tag) => ({
            subject: key,
            tag,
            ...(snapshot?.title !== undefined ? { title: snapshot.title } : {}),
            ...(snapshot?.posterPath !== undefined ? { posterPath: snapshot.posterPath } : {}),
          }));
        })
      : [];

    // La signature de ce qu'on s'apprete a envoyer. Identique au dernier envoi = rien a
    // faire : `publish` est idempotent, mais un appel reseau inutile reste un appel.
    const shape = JSON.stringify(items);
    const stopShape = JSON.stringify(stops);
    const pinnedShape = JSON.stringify(pinned);

    const sendActivity = items.length > 0 && shape !== lastSent.current;
    const sendStops = stops.length > 0 && stopShape !== lastStops.current;
    // ⚠️ **Triee comme la lecture serveur**, sinon la comparaison serait toujours fausse :
    // la projection locale sort serie par serie, la base rend `tag.asc`. Deux ordres pour un
    // meme contenu se comparent comme deux contenus differents — et on republierait a chaque
    // page, c'est-a-dire exactement le defaut qu'on corrige.
    const wordShape = JSON.stringify(
      [...words].sort((x, y) => (x.subject + x.tag < y.subject + y.tag ? -1 : 1)),
    );

    /**
     * Un ETAT se republie quand il change — mais **un etat vide ne se publie pas au montage**.
     *
     * ## 🔴 Ce que la premiere version coutait, mesure le 2026-08-17
     *
     * `pinnedShape !== lastPinned.current` suffisait, et la reference vaut `undefined` au
     * premier rendu : chaque chargement de page envoyait donc `DELETE profile_favorites` et
     * `DELETE tags`, **pour un compte qui n'a jamais epingle ni partage un mot**. Deux
     * ecritures par page vue, pour toujours, sans rien changer.
     *
     * ## Pourquoi une clause plutot qu'une memoire persistante
     *
     * La reponse evidente etait de garder la signature dans `sessionStorage` : une couche de
     * plus, et une couche qui peut se desynchroniser du serveur.
     *
     * ⚠️ **Publier le vide au montage ne peut QUE detruire.** Ca ne repare jamais une
     * ecriture manquee — une ecriture manquee de `[]` voudrait dire que le serveur porte
     * encore ce que la personne a retire, et si elle l'a retire, c'est dans une session qui a
     * publie le retrait. Le vide n'a donc de sens que comme **transition**.
     *
     * D'ou la seconde moitie de la condition : on publie un etat vide seulement si l'on a
     * deja publie quelque chose dans cette session. Depingler sa derniere serie retire
     * toujours les quatre du profil — c'est le cas que la condition `length > 0` des faits ne
     * couvre pas, et il reste couvert.
     */
    const changeDEtat = (forme: string, dernier: string | undefined, vide: boolean) =>
      forme !== dernier && (!vide || dernier !== undefined);

    const sendPinned = changeDEtat(pinnedShape, lastPinned.current, pinned.length === 0);
    // ⚠️ On compare a ce que le serveur porte **quand on le sait**, et a la derniere
    // publication de cette session sinon. Sans la premiere, chaque chargement de page
    // reecrivait un vocabulaire identique — deux ecritures pour rien.
    const sendTags = changeDEtat(
      wordShape,
      lastTags.current ?? serverTags,
      words.length === 0,
    );
    // Le retrait ne part qu'une fois par session : la table est illisible, donc rien ne
    // permet de constater qu'elle est deja vide, et redemander a chaque frappe serait un
    // `DELETE` par touche.
    const forget = keepStopsPrivate && !forgotten.current;
    if (!sendActivity && !sendStops && !sendPinned && !sendTags && !forget) return;

    const timer = setTimeout(() => {
      if (sendActivity) {
        void social.publish(userId, items).then((ok) => {
          // On ne memorise que ce qui est **parti** : sinon un echec reseau serait pris
          // pour un envoi reussi, et le fait ne repartirait jamais.
          if (ok) lastSent.current = shape;
        });
      }
      if (sendStops) {
        void social.publishStops(userId, stops).then((ok) => {
          if (ok) lastStops.current = stopShape;
        });
      }
      if (sendPinned) {
        void social.publishFavorites(userId, pinned).then((ok) => {
          if (ok) lastPinned.current = pinnedShape;
        });
      }
      if (sendTags) {
        void social.publishTags(userId, words).then((ok) => {
          if (ok) lastTags.current = wordShape;
        });
      }
      if (forget) {
        void social.forgetStops().then((ok) => {
          if (ok) {
            forgotten.current = true;
            // ⚠️ Oublier la signature aussi : sans ca, reprendre le consentement ne
            // republierait rien tant que le journal n'a pas change, et la personne
            // resterait hors de la carte en croyant y etre rentree.
            lastStops.current = undefined;
          }
        });
      }
    }, 4_000);

    return () => clearTimeout(timer);
    // ⚠️ `serverTags` est dans les dependances, et c'est **tout le correctif** : sans lui, la
    // decision d'envoyer etait prise au montage — donc avant que la lecture ne reponde — et
    // le minuteur de quatre secondes partait quand meme. Mesure du 2026-08-18 : la lecture
    // s'ajoutait aux deux ecritures au lieu de les remplacer, soit **trois** appels la ou il
    // y en avait deux. Quand la lecture arrive, cet effet rejoue, annule son minuteur, et
    // recompare.
  }, [configured, ready, journal, userId, social, keepStopsPrivate, shareTags, serverTags]);

  // Reprendre le consentement doit pouvoir redemander un retrait plus tard.
  useEffect(() => {
    if (!keepStopsPrivate) forgotten.current = false;
  }, [keepStopsPrivate]);

  return null;
}

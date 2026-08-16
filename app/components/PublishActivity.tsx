'use client';

import { useEffect, useRef } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { projectActivity } from '@/src/domain/activity';
import { projectStops } from '@/src/domain/attrition';
import { favoritesOf } from '@/src/domain/journal';
import { socialFrom } from '@/app/social/socialFrom';

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
  const forgotten = useRef(false);

  const accessToken = account?.accessToken;
  const userId = account?.userId;
  const keepStopsPrivate = journal.keepStopsPrivate === true;

  useEffect(() => {
    if (!configured || !ready || userId === undefined) return;
    // ⚠️ **Avant le minuteur, pas dedans.** Sans configuration il n'y a rien a envoyer, et
    // programmer un envoi qui ne partira pas ferait vivre un minuteur par frappe pour rien.
    const social = socialFrom(accessToken);
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

    // La signature de ce qu'on s'apprete a envoyer. Identique au dernier envoi = rien a
    // faire : `publish` est idempotent, mais un appel reseau inutile reste un appel.
    const shape = JSON.stringify(items);
    const stopShape = JSON.stringify(stops);
    const pinnedShape = JSON.stringify(pinned);

    const sendActivity = items.length > 0 && shape !== lastSent.current;
    const sendStops = stops.length > 0 && stopShape !== lastStops.current;
    // ⚠️ **Pas de `length > 0` ici**, contrairement aux deux au-dessus, et c'est la
    // difference entre un fait et un etat : depingler sa derniere serie doit RETIRER les
    // quatre du profil. La condition des faits laisserait l'ancienne selection en place pour
    // toujours — un profil qui montre un gout qu'on vient d'effacer.
    const sendPinned = pinnedShape !== lastPinned.current;
    // Le retrait ne part qu'une fois par session : la table est illisible, donc rien ne
    // permet de constater qu'elle est deja vide, et redemander a chaque frappe serait un
    // `DELETE` par touche.
    const forget = keepStopsPrivate && !forgotten.current;
    if (!sendActivity && !sendStops && !sendPinned && !forget) return;

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
  }, [configured, ready, journal, userId, accessToken, keepStopsPrivate]);

  // Reprendre le consentement doit pouvoir redemander un retrait plus tard.
  useEffect(() => {
    if (!keepStopsPrivate) forgotten.current = false;
  }, [keepStopsPrivate]);

  return null;
}

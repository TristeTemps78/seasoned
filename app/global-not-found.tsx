import type { Metadata } from 'next';
import { SiteChrome, siteMetadata, siteViewport } from '@/app/components/SiteChrome';
import { MessagesEn } from '@/app/i18n/MessagesEn';
import { NotFoundView } from '@/app/components/NotFoundView';
import { DEFAULT_LOCALE, t } from '@/lib/i18n';
import './globals.css';

/**
 * =============================================================================
 * 🔴 L'ADRESSE QUI N'EXISTE PAS N'ETAIT PAS CE PRODUIT — releve le 2026-08-12
 * =============================================================================
 *
 * Mesure au navigateur, sur `/fr/inconnue-404` :
 *
 *     document.title   "404: This page could not be found."
 *     document.body    "404 / This page could not be found."
 *     en-tete, pied de page, police, couleurs   — aucun
 *
 * C'est-a-dire la page noir et blanc de Next, en anglais, sans barre de navigation, sans
 * recherche et sans un lien pour revenir. Le seul ecran du produit qui ne soit pas le
 * produit — et c'est celui qu'on atteint par un lien mort, une faute de frappe ou une
 * vieille adresse indexee.
 *
 * ## Pourquoi les deux `not-found.tsx` ne le couvraient pas
 *
 * Elles existent, elles sont justes, et elles ne servent que sur un `notFound()` **appele
 * depuis un segment** — verifie le meme jour : `/fr/serie/99999999` rend bien « Rien ici. »
 * avec l'en-tete et le champ de recherche. Une adresse qui ne correspond a **aucune** route
 * ne rentre dans aucun segment, donc dans aucune disposition racine : Next n'a alors plus
 * que son repli integre.
 *
 * ⚠️ Ce fichier rend donc un document **entier** (`<html>`, `<body>`), et il le doit : ce
 * depot n'a pas de disposition racine partagee — il en a deux, une par langue, parce qu'un
 * seul `<html>` peut exister par page. C'est la meme contrainte qui a impose de dupliquer
 * `not-found.tsx`, et c'est pour ca que la 404 hors route est un fichier a part plutot
 * qu'une troisieme copie.
 *
 * ## En anglais, et c'est la seule reponse honnete
 *
 * Hors de toute route, rien ne dit dans quelle langue la personne lisait : il n'y a pas de
 * segment, pas de parametre, pas de disposition. Meme raisonnement que
 * `app/(site)/not-found.tsx` — *« Next appelle `notFound()` sans contexte »* —, en plus
 * radical. Le selecteur FR/EN de l'en-tete est la, lui, et il marche.
 */
export const metadata: Metadata = {
  ...siteMetadata(DEFAULT_LOCALE),
  title: t(DEFAULT_LOCALE, 'notFound.heading'),
  robots: { index: false, follow: false },
};

export const viewport = siteViewport;

export default function GlobalNotFound() {
  return (
    <SiteChrome locale={DEFAULT_LOCALE} Messages={MessagesEn}>
      {/* Exactement le meme corps que les deux 404 de segment — c'est tout l'objet de
          `NotFoundView`. Un ecran vide dit quoi faire, et montre de quoi y repondre. */}
      <NotFoundView locale={DEFAULT_LOCALE} />
    </SiteChrome>
  );
}

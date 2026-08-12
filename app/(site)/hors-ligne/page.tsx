import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';
import { ResumeStrip } from '@/app/components/ResumeStrip';

/**
 * La page servie quand il n'y a plus de reseau et rien en cache.
 *
 * Elle dit surtout une chose utile : **votre bibliotheque, elle, fonctionne**. Le
 * journal vit dans le navigateur, donc `/moi` s'affiche entierement hors ligne des
 * lors que la page a ete visitee une fois. C'est le seul endroit du site dont on peut
 * promettre cela, et c'est exactement ce qu'on attend d'une application installee.
 *
 * ## 🔴 Elle le promettait, et ne le montrait pas
 *
 * Mesure au navigateur le 2026-08-12, fenetre 1440 x 900 :
 *
 *     surface portant quelque chose   35,3 %
 *     plus grande bande vide          360 px
 *     vide moyen a droite             439 px
 *
 * Un cartouche de 512 px, une phrase qui affirme que la bibliotheque marche, et un bouton
 * pour aller le verifier ailleurs. La preuve etait **a un clic**, sur la seule page ou l'on
 * ne peut justement pas se permettre d'envoyer quelqu'un chercher.
 *
 * `ResumeStrip` la donne sur place : ou vous en etiez, lu dans le journal, **sans une seule
 * requete**. C'est le meme objet que sur l'accueil et au meme endroit du raisonnement — *la
 * page qu'on ouvre EST le rappel*. Ici, elle devient la demonstration.
 *
 * ⚠️ **Aucune affiche, et c'est la seule page ou leur absence est un choix.** Les vignettes
 * viennent du CDN de TMDB : hors ligne elles ne chargeraient pas, et une rangee de cadres
 * vides dirait exactement le contraire de ce que cette page affirme. Ce qui survit sans
 * reseau, ce sont les mots — un titre, une position, une date.
 *
 * ⚠️ Le composant se tait tout seul quand le journal est vide, et c'est juste : quelqu'un
 * hors ligne qui n'a rien note n'a effectivement rien a reprendre. La page reprend alors sa
 * forme d'avant, qui parle deja.
 */
export function offlineMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'offline.title'),
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = offlineMetadata(DEFAULT_LOCALE);

export function OfflineView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="my-12 space-y-8">
      <div className="empty-state">
        <h1 className="page-title">{t(locale, 'offline.heading')}</h1>
        <p className="empty-state-body">{t(locale, 'offline.body')}</p>
        {/* 🔴 **Le dernier a recopier la rangee d'actions a la main.** Son commentaire l'assumait
            — *« les memes utilitaires qu'`EmptyLibrary`, au caractere pres »* — et c'est
            exactement ce que `.empty-state-actions` a remplace le 2026-08-11 dans les cinq autres
            ecrans vides. Il avait ete oublie parce qu'il est le seul a vivre dans une page plutot
            que dans un composant. Trouve par la garde des en-tetes, en cherchant autre chose. */}
        <div className="empty-state-actions">
          <Link href={pathIn('/moi', locale)} className="btn btn-primary">
            {t(locale, 'offline.open')}
          </Link>
        </div>
      </div>

      {/* La preuve, sur place plutot qu'a un clic. Voir l'en-tete du fichier. */}
      <ResumeStrip />
    </div>
  );
}

export default function OfflinePage() {
  return <OfflineView locale={DEFAULT_LOCALE} />;
}

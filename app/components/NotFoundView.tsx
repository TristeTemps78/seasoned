import { discover } from '@/lib/catalog';
import { t, type Locale } from '@/lib/i18n';
import { PosterRail } from '@/app/components/PosterRail';
import { SearchForm } from '@/app/components/SearchForm';

/**
 * Le corps des trois 404 — et il n'y en a qu'un.
 *
 * ## Pourquoi un composant alors que les trois fichiers doivent rester trois
 *
 * `app/(site)/not-found.tsx`, `app/(fr)/not-found.tsx` et `app/global-not-found.tsx` existent
 * separement pour une raison qui ne bouge pas : une page ne porte qu'un seul `<html>`, donc
 * chaque disposition racine a la sienne, et la troisieme sert les adresses qui n'entrent dans
 * aucune disposition. Ce qui n'avait aucune raison d'etre triple, c'est **ce qu'il y a
 * dedans** : le titre, la phrase et le champ etaient recopies trois fois, mot pour mot.
 *
 * ## 🔴 Ce que cet ecran etait, mesure au navigateur le 2026-08-12
 *
 * Sur une fenetre de 1440 x 900, la 404 rendait :
 *
 *     surface portant quelque chose   33,5 %
 *     plus grande bande vide          456 px          — la moitie de la hauteur
 *     images                          0
 *
 * Un titre, une phrase, un champ, et 456 px de noir. C'est l'ecran qu'on atteint par un lien
 * mort, une faute de frappe ou une vieille adresse indexee — c'est-a-dire le seul endroit du
 * produit ou quelqu'un arrive **par accident**, et le seul qui ne lui montrait rien.
 *
 * La regle 4 dit qu'un ecran qui n'a rien a montrer dit quoi faire. Le champ le disait deja ;
 * ce qui manquait, c'est **de quoi repondre a la question** quand on ne sait pas encore quoi
 * chercher. Meme raisonnement, et meme objet, que `/recherche` sans requete.
 *
 * ## ⚠️ Aligne a gauche, comme les six faces
 *
 * L'ancienne version etait `mx-auto max-w-2xl` : un bloc centre a 672 px. Avec une rangee
 * d'affiches en dessous — qui, elle, part de la colonne de texte et deborde a droite — deux
 * axes de composition se seraient disputes le meme ecran. C'est exactement le defaut releve
 * sur `.empty-state` le 2026-08-12, et il ne se reintroduit pas ici.
 *
 * ## Le cout
 *
 * `popular` **page 4** : les pages 1 a 3 nourrissent `/bilan`, `/moi` et `/recherche`, donc
 * personne ne voit deux fois la meme rangee. L'appel traverse le cache memoise du catalogue
 * et la page est prerendue — une requete par periode, pas une par 404.
 */
export async function NotFoundView({ locale }: { readonly locale: Locale }) {
  // ⚠️ Le catalogue peut tomber, et une 404 qui rendrait une 500 serait le comble. On degrade
  // vers l'ecran d'avant — titre, phrase, champ —, qui reste utile.
  let suggestions: Awaited<ReturnType<typeof discover>> = [];
  try {
    suggestions = (await discover('popular', 4, locale)).slice(0, 12);
  } catch {
    suggestions = [];
  }

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <h1 className="page-title">{t(locale, 'notFound.heading')}</h1>
        <p className="max-w-prose leading-relaxed text-(--color-muted)">
          {t(locale, 'notFound.body')}
        </p>
        <SearchForm locale={locale} />
      </div>

      <PosterRail
        title={t(locale, 'discovery.notFound.title')}
        subtitle={t(locale, 'discovery.notFound.subtitle')}
        series={suggestions.map((summary) => ({ summary }))}
        locale={locale}
      />
    </div>
  );
}

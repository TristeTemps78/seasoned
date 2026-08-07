import type { Metadata } from 'next';
import { ForeignImport } from '@/app/components/ForeignImport';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/routes';

/**
 * La page qui donne une adresse a l'import.
 *
 * ## Pourquoi elle existe, et pourquoi elle est indexable
 *
 * Un import cache dans la bibliotheque ne sert qu'a ceux qui utilisent deja le produit —
 * c'est-a-dire a personne, quand on cherche precisement a en recruter. Or il existe en
 * ce moment une population qui **tape la question dans un moteur** : TV Time a ferme le
 * 2026-07-15 avec 26,4 millions d'installations (`RESEARCH.md` §0.1).
 *
 * C'est le meme raisonnement que la lecon de la bascule des langues, transpose : **une
 * fonctionnalite sans adresse n'existe pas.** D'ou une page a part, statique, indexable,
 * et redigee pour la question qu'on pose reellement.
 *
 * ⚠️ Contrairement a `/moi`, elle **doit** etre exploree : c'est du contenu, et c'est le
 * seul endroit du site qui reponde a une intention de migration.
 */
export const dynamic = 'force-static';

export function convertMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'convert.title'),
    description: t(locale, 'convert.lede'),
    alternates: alternatesFor('/convertir', locale),
  };
}

export const metadata: Metadata = convertMetadata(DEFAULT_LOCALE);

export function ConvertView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <header className="space-y-3">
        <h1 className="page-title">{t(locale, 'convert.title')}</h1>
        <p className="leading-relaxed text-(--color-muted)">{t(locale, 'convert.lede')}</p>
      </header>

      <ForeignImport />

      <section className="space-y-2 panel px-4 py-4">
        <h2 className="card-title">{t(locale, 'convert.honestTitle')}</h2>
        <p className="text-xs leading-relaxed text-(--color-muted)">
          {t(locale, 'convert.honestBody')}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="card-title">{t(locale, 'convert.mergeTitle')}</h2>
        <p className="text-xs leading-relaxed text-(--color-muted)">
          {t(locale, 'convert.mergeBody')}
        </p>
      </section>
    </div>
  );
}

export default function ConvertPage() {
  return <ConvertView locale={DEFAULT_LOCALE} />;
}

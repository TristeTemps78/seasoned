import type { Metadata } from 'next';
import Link from 'next/link';
import { ForeignImport } from '@/app/components/ForeignImport';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor, pathIn } from '@/lib/routes';

/**
 * La page qui donne une adresse a l'import.
 *
 * ## Pourquoi elle existe, et pourquoi elle est indexable
 *
 * Un import cache dans la bibliotheque ne sert qu'a ceux qui utilisent deja le produit —
 * c'est-a-dire a personne, quand on cherche precisement a en recruter. Or il existe en
 * ce moment une population qui **tape la question dans un moteur** : TV Time a ferme le
 * 2026-07-15 avec 26,4 millions d'installations.
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
    <div className="text-page">
      <header className="space-y-3">
        <h1 className="page-title">{t(locale, 'convert.title')}</h1>
        <p className="leading-relaxed text-(--color-muted)">{t(locale, 'convert.lede')}</p>
      </header>

      <ForeignImport />

      <section className="card space-y-2">
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

      {/* 🔴 **La page qui explique comment entrer ne disait pas comment sortir.** C'est le
          sens unique du releve (F6) : trois formats en lecture, zero en ecriture. Le fichier
          existe desormais, et il se prend sur `/moi` — la ou vit deja la sauvegarde, parce
          que ce sont deux facons de tenir la meme promesse.

          ⚠️ Un lien et non un second bouton d'export : dupliquer le geste demanderait de
          dupliquer le journal dans cette page, qui est statique et n'en lit aucun. */}
      <section className="space-y-2">
        <h2 className="card-title">{t(locale, 'convert.leaveTitle')}</h2>
        <p className="text-xs leading-relaxed text-(--color-muted)">
          {t(locale, 'convert.leaveBody')}{' '}
          <Link className="tap-line underline hover:text-(--color-volt)" href={pathIn('/moi', locale)}>
            {t(locale, 'convert.leaveLink')}
          </Link>
        </p>
      </section>
    </div>
  );
}

export default function ConvertPage() {
  return <ConvertView locale={DEFAULT_LOCALE} />;
}

import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/routes';

/**
 * La politique de confidentialite.
 *
 * ## Ce qu'elle a de particulier aujourd'hui, et ce qui la rendra ordinaire
 *
 * Elle decrit un produit qui **ne collecte rien** : ni compte, ni base, ni traceur, ni
 * mesure d'audience. Ce n'est pas une posture, c'est verifiable — `connect-src 'self'`
 * dans la politique de securite interdit au navigateur de contacter un autre serveur que
 * le notre, et n'importe qui peut le lire dans l'inspecteur.
 *
 * ⚠️ **Cela cessera d'etre vrai avec les comptes** (`docs/ARCHITECTURE-APP.md` §1). La
 * derniere section l'annonce des maintenant, et la regle qui va avec : cette page se met
 * a jour **avant** que le comportement change, jamais apres. Une politique de
 * confidentialite qui decrit l'etat precedent est pire qu'une absence de politique —
 * l'absence n'affirme rien.
 */
export const dynamic = 'force-static';

export function privacyMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'privacy.title'),
    alternates: alternatesFor('/confidentialite', locale),
  };
}

export const metadata: Metadata = privacyMetadata(DEFAULT_LOCALE);

export function PrivacyView({ locale }: { readonly locale: Locale }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <header className="space-y-2">
        <h1 className="page-title">{t(locale, 'privacy.title')}</h1>
        <p className="text-sm text-(--color-muted)">{t(locale, 'privacy.updated')}</p>
      </header>

      <Section
        title={t(locale, 'privacy.now.title')}
        body={t(locale, 'privacy.now.body')}
        highlight
      />
      <Section
        title={t(locale, 'privacy.account.title')}
        body={t(locale, 'privacy.account.body')}
      />
      <Section title={t(locale, 'privacy.sync.title')} body={t(locale, 'privacy.sync.body')} />
      <Section title={t(locale, 'privacy.tmdb.title')} body={t(locale, 'privacy.tmdb.body')} />
      <Section
        title={t(locale, 'privacy.hosting.title')}
        body={t(locale, 'privacy.hosting.body')}
      />
      <Section
        title={t(locale, 'privacy.rights.title')}
        body={t(locale, 'privacy.rights.body')}
      />
      <Section title={t(locale, 'privacy.next.title')} body={t(locale, 'privacy.next.body')} />
    </div>
  );
}

function Section({ title, body, highlight = false }: {
  readonly title: string;
  readonly body: string;
  readonly highlight?: boolean;
}) {
  return (
    <section
      className={
        highlight
          ? 'edge-lit panel px-4 py-4'
          : ''
      }
    >
      {/* `.section-heading` et non `.card-title` : ce composant rend les **sections de
          contenu** de la page, pas des encarts dans une section. */}
      <h2 className="section-heading">{title}</h2>
      <p className="mt-2 leading-relaxed text-(--color-muted)">{body}</p>
    </section>
  );
}

export default function PrivacyPage() {
  return <PrivacyView locale={DEFAULT_LOCALE} />;
}

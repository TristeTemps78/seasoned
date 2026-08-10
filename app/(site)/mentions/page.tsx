import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/routes';
import { HOST, legalIsComplete, publisher } from '@/lib/legal';
import { TMDB_ATTRIBUTION } from '@/src/catalog/provider';

/**
 * Les mentions legales.
 *
 * ## Indexable, contrairement aux faces personnelles
 *
 * C'est du contenu reel et stable, et une page que l'on doit pouvoir **trouver** —
 * y compris depuis un moteur, y compris pour signaler quelque chose. La mettre en
 * `noindex` comme `/moi` la rendrait introuvable a ceux qui la cherchent, ce qui est
 * exactement l'inverse de sa fonction.
 *
 * ## L'identite ne vit pas dans le code
 *
 * Elle arrive de l'environnement (`lib/legal.ts`) : le depot est public, et un nom ou une
 * adresse postale committes y resteraient dans l'historique pour toujours. Tant qu'elle
 * manque, la page **le dit** au lieu d'afficher un texte a trous qui aurait l'air complet.
 */
export const dynamic = 'force-static';

export function legalMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'legal.title'),
    alternates: alternatesFor('/mentions', locale),
  };
}

export const metadata: Metadata = legalMetadata(DEFAULT_LOCALE);

export function LegalView({ locale }: { readonly locale: Locale }) {
  const editor = publisher();
  const complete = legalIsComplete();

  return (
    <div className="text-page">
      <h1 className="page-title">{t(locale, 'legal.title')}</h1>

      {!complete ? (
        <div className="rounded-lg border border-(--color-warn)/40 bg-(--color-warn)/10 px-4 py-4">
          <h2 className="card-title text-(--color-warn)">
            {t(locale, 'legal.incomplete.title')}
          </h2>
          <p className="mt-2 leading-relaxed">{t(locale, 'legal.incomplete.body')}</p>
        </div>
      ) : null}

      <dl className="space-y-4">
        {editor.name !== undefined ? (
          <Entry label={t(locale, 'legal.publisher')}>
            {editor.name}
            {editor.address !== undefined ? <> — {editor.address}</> : null}
          </Entry>
        ) : null}

        {editor.director !== undefined ? (
          <Entry label={t(locale, 'legal.director')}>{editor.director}</Entry>
        ) : null}

        {editor.email !== undefined ? (
          <Entry label={t(locale, 'legal.contact')}>
            <a href={`mailto:${editor.email}`} className="hover:text-(--color-volt)">
              {editor.email}
            </a>
          </Entry>
        ) : null}

        <Entry label={t(locale, 'legal.host')}>
          <a href={HOST.url} className="hover:text-(--color-volt)">
            {HOST.name}
          </a>{' '}
          — {HOST.address}
        </Entry>
      </dl>

      {/* Obligation contractuelle TMDB, et pas un ornement : le texte doit accompagner
          toute donnee TMDB affichee. */}
      <p className="text-sm text-(--color-muted)">{t(locale, 'legal.tmdb')}</p>
      <p className="text-sm text-(--color-muted)">{TMDB_ATTRIBUTION}</p>
    </div>
  );
}

function Entry({ label, children }: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 leading-relaxed">{children}</dd>
    </div>
  );
}

export default function LegalPage() {
  return <LegalView locale={DEFAULT_LOCALE} />;
}

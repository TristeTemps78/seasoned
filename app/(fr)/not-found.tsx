import { SearchForm } from '@/app/components/SearchForm';
import { t } from '@/lib/i18n';

/** La 404 francaise. Voir `app/(site)/not-found.tsx` pour le motif de la duplication. */
export default function FrenchNotFound() {
  return (
    <div className="mx-auto max-w-2xl py-12 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('fr', 'notFound.heading')}</h1>
      <p className="text-(--color-muted)">{t('fr', 'notFound.body')}</p>
      <SearchForm locale="fr" />
    </div>
  );
}

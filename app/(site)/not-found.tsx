import { SearchForm } from '@/app/components/SearchForm';
import { DEFAULT_LOCALE, t } from '@/lib/i18n';

/**
 * La 404 de la disposition anglaise.
 *
 * ⚠️ Elle ne peut **pas** etre parametree par la langue : Next appelle `notFound()` sans
 * contexte, et une disposition racine ne peut pas lui passer d'argument. Le francais a
 * donc sa propre `not-found.tsx` dans `app/(fr)`, ce qui est aussi la seule facon pour
 * que la page d'erreur s'affiche avec `lang="fr"`.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-12 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t(DEFAULT_LOCALE, 'notFound.heading')}
      </h1>
      <p className="text-(--color-muted)">{t(DEFAULT_LOCALE, 'notFound.body')}</p>
      <SearchForm locale={DEFAULT_LOCALE} />
    </div>
  );
}

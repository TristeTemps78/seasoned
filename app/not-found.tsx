import { SearchForm } from '@/app/components/SearchForm';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-12 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Rien ici.</h1>
      <p className="text-(--color-muted)">
        Cette série n’existe pas dans le catalogue, ou son identifiant a changé.
      </p>
      <SearchForm />
    </div>
  );
}

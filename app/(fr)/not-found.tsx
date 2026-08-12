import { NotFoundView } from '@/app/components/NotFoundView';

/** La 404 francaise. Voir `app/(site)/not-found.tsx` pour le motif de la duplication. */
export default function FrenchNotFound() {
  return <NotFoundView locale="fr" />;
}

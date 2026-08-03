import type { Metadata } from 'next';
import { AuthCallbackMetadata, AuthCallbackView } from '@/app/(site)/compte/retour/page';

/**
 * Le retour du lien, en francais.
 *
 * ⚠️ Les deux jumeaux doivent figurer dans les « Redirect URLs » de Supabase : le lien
 * renvoie vers celui de la langue depuis laquelle il a ete demande, et un retour qui
 * bascule de langue est le meme defaut que la negociation par `Accept-Language`.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = AuthCallbackMetadata('fr');

export default function FrenchAuthCallbackPage() {
  return <AuthCallbackView locale="fr" />;
}

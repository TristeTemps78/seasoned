import { NotFoundView } from '@/app/components/NotFoundView';
import { DEFAULT_LOCALE } from '@/lib/i18n';

/**
 * La 404 de la disposition anglaise.
 *
 * ⚠️ Elle ne peut **pas** etre parametree par la langue : Next appelle `notFound()` sans
 * contexte, et une disposition racine ne peut pas lui passer d'argument. Le francais a
 * donc sa propre `not-found.tsx` dans `app/(fr)`, ce qui est aussi la seule facon pour
 * que la page d'erreur s'affiche avec `lang="fr"`.
 *
 * ⚠️ Le **corps**, lui, n'est plus recopie : il vit dans `NotFoundView`. Ce qui doit rester
 * triple est le fichier, jamais son contenu — les trois versions avaient deja le meme titre,
 * la meme phrase et le meme champ, ecrits trois fois.
 */
export default function NotFound() {
  return <NotFoundView locale={DEFAULT_LOCALE} />;
}

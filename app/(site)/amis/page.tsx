import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { legalIsComplete } from '@/lib/legal';
import { Friends } from '@/app/components/Friends';
import { PageHeader } from '@/app/components/PageHeader';

/**
 * La face « Mes amis » — la premiere qui montre le contenu de quelqu'un d'autre.
 *
 * Statique comme les autres : le fil est charge par le navigateur, avec le jeton de la
 * personne. Le serveur ne voit jamais qui suit qui.
 *
 * ## ⛔ Le verrou legal est **executable**, pas documentaire
 *
 * `legalIsComplete()` est faux tant qu'il n'existe pas d'adresse de contact valide. Une
 * page qui expose ce qu'ecrit un tiers **sans voie de signalement** n'a pas le droit
 * d'exister, et l'avoir ecrit dans un document n'a jamais empeche personne de deployer.
 * Ici, la variable mal saisie **ferme la face** — ce qui est arrive : `LEGAL_CONTACT_EMAIL`
 * a vecu plusieurs jours avec un point-virgule parasite et un `.co` au lieu de `.com`,
 * sans que rien ne le voie (D19).
 */
export const dynamic = 'force-static';

export function friendsMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'friendsPage.title'),
    // Jamais indexee : le contenu appartient a des personnes, pas au catalogue.
    robots: { index: false, follow: false },
  };
}

export const metadata: Metadata = friendsMetadata(DEFAULT_LOCALE);

export function FriendsView({ locale }: { readonly locale: Locale }) {
  return (
    // ⚠️ Pas de conteneur ici : `<main>` porte deja la largeur et les marges de toutes
    // les pages. En ajouter un second decalait cet ecran par rapport aux quatre autres —
    // un demi-centimetre que personne ne sait nommer et que tout le monde voit.
    <div className="space-y-8">
      <PageHeader title={t(locale, 'friendsPage.title')} lede={t(locale, 'friendsPage.lede')} />
      {legalIsComplete() ? (
        <Friends />
      ) : (
        <p className="max-w-prose rounded-lg border border-(--color-warn)/40 px-4 py-4 leading-relaxed text-(--color-muted)">
          {t(locale, 'legal.incomplete.body')}
        </p>
      )}
    </div>
  );
}

export default function FriendsPage() {
  return <FriendsView locale={DEFAULT_LOCALE} />;
}

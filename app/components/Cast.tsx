import Link from 'next/link';
import { Poster } from '@/app/components/Poster';
import { RowHeader } from '@/app/components/RowHeader';
import type { CastMember } from '@/src/catalog/provider';
import { t, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';

/**
 * Le generique, avec des visages (2026-08-11).
 *
 * ## Ce qu'il comble
 *
 * La fiche serie nommait ses **createurs** et personne d'autre : `profile_path` n'existait
 * nulle part dans le depot. Une fiche sans visage est le plus gros ecart avec la reference du
 * projet, ou le generique occupe la moitie de la page.
 *
 * ## Trois choses qu'il ne refait pas
 *
 * `Poster` rend deja une image TMDB **avec son repli en monogramme** ; `RowHeader` rend deja
 * l'ouverture d'une grille ; `.poster-grid` rend deja le rythme 3/4/6 colonnes. Un portrait
 * TMDB partage le CDN, les noms de taille et le rapport 1,5 d'une affiche — donc les trois
 * s'appliquent tels quels. Ecrire une grille de portraits a cote aurait produit la quatrieme
 * copie du meme objet, ce que `Poster` existe precisement pour avoir arrete.
 *
 * ## ✅ Les visages sont cliquables depuis le 2026-08-15
 *
 * Ils ne l'etaient pas, et la raison etait bonne : la premiere version pointait vers
 * `/personne/{id}`, **route qui n'existait pas**. Douze liens morts sur la fiche la plus
 * visitee auraient ete pires que l'absence de generique, et le typage ne les aurait pas vus
 * — `pathIn` accepte n'importe quelle chaine. Le commentaire finissait par *« le jour ou une
 * page personne existera, c'est ici que le lien reviendra »*.
 *
 * Elle existe (`app/(site)/personne/[id]/page.tsx`), donc il revient. Et le survol avec :
 * il appartient a ce qu'on peut ouvrir, et un visage s'ouvre maintenant.
 */
export function Cast({
  cast,
  locale,
}: {
  readonly cast: readonly CastMember[];
  readonly locale: Locale;
}) {
  // Se tait plutot que d'annoncer un vide : TMDB ne connait pas le generique de tout le
  // catalogue, et « aucun acteur connu » n'apprend rien a personne.
  if (cast.length === 0) return null;

  return (
    // Meme regle que « aussi par ce createur » : une grille d'affiches sort de la colonne de
    // lecture, sans quoi douze portraits se serrent sur 1024 px.
    <section className="bleed space-y-4" aria-label={t(locale, 'cast.title')}>
      <RowHeader title={t(locale, 'cast.title')} subtitle={t(locale, 'cast.why')} />
      <ul className="poster-grid">
        {cast.map((member) => (
          <li key={member.providerId}>
            {/* La meme matiere que la vignette d'une serie : deux objets de meme forme sur une
                meme page doivent se ressembler — l'etat de survol compris, maintenant qu'un
                visage s'ouvre. */}
            <Link
              href={pathIn(`/personne/${member.providerId}`, locale)}
              className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live)"
            >
              <div className="poster-frame aspect-2/3">
                <Poster path={member.profilePath} title={member.name} size="w185" />
              </div>
              <p className="mt-2 clamp-2 text-sm font-medium group-hover:text-(--color-volt)">
                {member.name}
              </p>
            </Link>
            {/* ⚠️ Absent hors des series les mieux documentees — on degrade sans bruit, comme
                pour les createurs. Un « rôle inconnu » sous un visage sur deux ferait de
                l'encart un constat de lacune. */}
            {member.character === undefined ? null : (
              <p className="clamp-2 meta-sm">{member.character}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

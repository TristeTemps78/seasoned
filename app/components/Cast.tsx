import { Poster } from '@/app/components/Poster';
import { RowHeader } from '@/app/components/RowHeader';
import type { CastMember } from '@/src/catalog/provider';
import { t, type Locale } from '@/lib/i18n';

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
 * ## ⚠️ Rien n'est cliquable, et c'est verifie et non suppose
 *
 * La premiere version faisait de chaque visage un lien vers `/personne/{id}`. **Cette route
 * n'existe pas** : `app/(site)/` n'a pas de repertoire `personne`, et les createurs ne servent
 * qu'au maillage cote serveur (`alsoByCreators`), jamais a la navigation. Douze liens morts
 * sur la fiche la plus visitee du site auraient ete pires que l'absence de generique — et le
 * typage ne les aurait pas vus, puisque `pathIn` accepte n'importe quelle chaine.
 *
 * Le jour ou une page personne existera, c'est ici que le lien reviendra.
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
                meme page doivent se ressembler. Sans l'etat de survol, qui appartient a ce
                qu'on peut ouvrir — et un visage ne s'ouvre pas encore. */}
            <div className="poster-frame aspect-2/3">
              <Poster path={member.profilePath} title={member.name} size="w185" />
            </div>
            <p className="mt-2 clamp-2 text-sm font-medium">{member.name}</p>
            {/* ⚠️ Absent hors des series les mieux documentees — on degrade sans bruit, comme
                pour les createurs. Un « rôle inconnu » sous un visage sur deux ferait de
                l'encart un constat de lacune. */}
            {member.character === undefined ? null : (
              <p className="clamp-2 text-xs text-(--color-muted)">{member.character}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

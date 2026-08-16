import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { person } from '@/lib/catalog';
import type { PersonCredit } from '@/src/catalog/provider';
import { PageHeader } from '@/app/components/PageHeader';
import { Poster } from '@/app/components/Poster';
import { SeriesCard } from '@/app/components/SeriesCard';
import { EmptyState } from '@/app/components/EmptyState';
import { alternatesFor } from '@/lib/routes';
import { DEFAULT_LOCALE, t, tn, type Locale } from '@/lib/i18n';

/**
 * Une personne, et ce qu'on peut voir d'elle.
 *
 * ## 🔴 Le defaut que cette route ferme
 *
 * Le generique de chaque fiche affiche douze visages, **aucun cliquable**. Le `CLAUDE.md`
 * rangeait `Cast` dans les trois silences assumes — « ce qui n'a litteralement rien
 * derriere ». Le classement ne tenait pas : `alsoByCreators` interroge deja
 * `/person/{id}/tv_credits` pour rendre « du meme createur », donc la donnee existe et sait
 * produire une page. Ce n'etait pas « rien derriere », c'etait « pas encore construit ».
 *
 * Et c'est un chemin de parcours entier qui manquait : chez la reference, un nom d'acteur
 * mene a sa filmographie, et c'est par la qu'on trouve la serie suivante quand on n'a pas de
 * titre en tete. La fiche serie renvoyait vers d'autres fiches par un seul fil — le createur.
 *
 * ## Aussi statique que la fiche serie, et pour la meme raison
 *
 * Le contenu est le meme pour tout le monde : aucune donnee de journal, aucune session. La
 * page est donc prerendue et servie depuis le cache de bord, comme `/serie/[id]`. C'est
 * l'invariant de cout du produit, et une route de plus n'a pas a y deroger.
 */
export const revalidate = 86_400;
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export async function personMetadata(id: string, locale: Locale): Promise<Metadata> {
  const found = await person(id, locale);
  if (found === undefined) return { title: t(locale, 'person.unknownTitle') };
  return {
    title: found.name,
    description: t(locale, 'person.description', { name: found.name }),
    alternates: alternatesFor(`/personne/${id}`, locale),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return personMetadata(id, DEFAULT_LOCALE);
}

export async function PersonView({ id, locale }: {
  readonly id: string;
  readonly locale: Locale;
}) {
  const found = await person(id, locale);
  // Une identite que le catalogue ne connait pas est une 404 legitime, indexable comme telle.
  if (found === undefined) notFound();

  return (
    <div className="space-y-8">
      {/* 🔴 **Le visage arrivait deja, et personne ne l'affichait.** `person()` rend
          `profilePath` depuis le premier jour de cette route ; la page n'en faisait rien et
          commencait par un titre nu. C'est le motif que ce depot rencontre a chaque lot — la
          donnee est payee, le chemin manque — et il coutait ici la seule chose qui fait
          reconnaitre quelqu'un.

          ⚠️ `w-28` et non une vignette : c'est un portrait d'en-tete, pas une pastille. Meme
          arbitrage que `PosterChip.wide`, et pour la meme raison mesuree le 2026-08-12 — a
          `w-16`, l'image occupait 0,5 % de la surface d'une page qui parle d'elle. */}
      <div className="flex flex-wrap items-start gap-5">
        <span className="poster-frame block aspect-2/3 w-28 shrink-0">
          <Poster path={found.profilePath} title={found.name} size="w185" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={found.name}
            lede={tn(locale, 'person.count', found.series.length)}
          />
          {/* Le metier principal, tel que TMDB le code — traduit **a l'affichage**, jamais
              memorise traduit. Une valeur inconnue se tait plutot que d'afficher son code. */}
          {departmentLabel(found.knownForDepartment, locale) === undefined ? null : (
            <p className="meta">{departmentLabel(found.knownForDepartment, locale)}</p>
          )}
        </div>
      </div>

      {found.series.length === 0 ? (
        /* ⚠️ Ca arrive vraiment : TMDB porte des identites creditees au cinema et pas a la
           television, et ce produit ne connait que la television. La phrase le dit — sans
           bouton, parce que la barre de navigation est le geste, et qu'aucun autre chemin
           n'existe depuis une personne dont on ne peut rien montrer. */
        <EmptyState title={t(locale, 'person.noneTitle')}>
          {t(locale, 'person.noneBody')}
        </EmptyState>
      ) : (
        <>
          {/* 🔴 **Une seule grille melangeait tout.** On ne pouvait pas savoir si quelqu'un
              avait joue dans une serie ou l'avait ecrite — et la reponse arrivait dans la
              meme reponse TMDB, jetee par un dedoublonnage qui ecrasait l'un des deux roles.
              Deux sections repondent a deux questions differentes ; `cast` d'abord, parce que
              c'est sous ce titre qu'on cherche quelqu'un dont on a vu le visage. */}
          <CreditGrid title={t(locale, 'person.asCast')} credits={found.cast} locale={locale} />
          <CreditGrid title={t(locale, 'person.asCrew')} credits={found.crew} locale={locale} />
        </>
      )}
    </div>
  );
}

/**
 * Le metier principal, traduit — ou rien.
 *
 * ⚠️ **Une table fermee et non une traduction dynamique** : `known_for_department` est un
 * vocabulaire ferme de TMDB, et une cle i18n construite par concatenation (`person.dept.` +
 * la valeur) rendrait la cle brute a l'ecran le jour ou TMDB en ajoute une. Ici, l'inconnu se
 * tait — c'est la meme discipline que `GROUP_KIND_NAMES` dans `tmdb.ts`.
 */
function departmentLabel(department: string | undefined, locale: Locale): string | undefined {
  const known: Readonly<Record<string, string>> = {
    Acting: 'person.dept.acting',
    Directing: 'person.dept.directing',
    Writing: 'person.dept.writing',
    Production: 'person.dept.production',
    Creator: 'person.dept.creator',
  };
  const key = department === undefined ? undefined : known[department];
  return key === undefined ? undefined : t(locale, key as Parameters<typeof t>[1]);
}

/**
 * Une grille de credits, avec le role sous chaque affiche.
 *
 * ⚠️ **Se tait quand elle est vide**, et c'est un des silences justes : la page porte deja
 * l'autre section et son en-tete. Annoncer « n'a rien realise » sous la filmographie d'un
 * acteur serait un constat de lacune la ou il n'y a pas de lacune.
 */
function CreditGrid({ title, credits, locale }: {
  readonly title: string;
  readonly credits: readonly PersonCredit[];
  readonly locale: Locale;
}) {
  if (credits.length === 0) return null;

  return (
    <section className="bleed space-y-4" aria-label={title}>
      <h2 className="row-title">{title}</h2>
      {/* La grille partagee, jamais une grille locale : c'est le defaut pour lequel
          `.poster-grid` a ete extraite. */}
      <ul className="poster-grid">
        {credits.map((credit) => (
          <li key={credit.series.providerId}>
            <SeriesCard series={credit.series} locale={locale} />
            {/* ⚠️ Absent des que TMDB ne le donne pas, et on degrade sans bruit — meme regle
                que le personnage sous un visage dans `Cast.tsx`. « Rôle inconnu » sous une
                affiche sur deux ferait de la page un constat de lacune. */}
            {credit.role === undefined ? null : (
              <p className="clamp-2 meta-sm">{credit.role}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  return <PersonView id={id} locale={DEFAULT_LOCALE} />;
}

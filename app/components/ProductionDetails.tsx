import Link from 'next/link';
import { Poster } from '@/app/components/Poster';
import { RowHeader } from '@/app/components/RowHeader';
import { pathIn } from '@/lib/routes';
import { t, type Locale } from '@/lib/i18n';
import type { CrewMember } from '@/src/catalog/provider';

/**
 * Qui fabrique la serie, et d'ou elle vient.
 *
 * ## 🔴 Le manque, releve le 2026-08-16 (F6)
 *
 * La reference separe `Cast · Crew · Details · Genres · Releases`. Voltface montrait douze
 * visages — cliquables depuis la veille — et **rien d'autre** : ni equipe, ni genres, ni
 * pays, ni langue, ni chaine.
 *
 * ⚠️ **Tout arrivait deja dans la reponse.** `aggregate_credits` porte `crew` a cote de
 * `cast` ; `/tv/{id}` porte `genres`, `networks`, `origin_country` et `original_language`.
 * Zero appel de plus, zero cout de plus — c'est le meme constat que la photo de
 * `/personne/[id]` le meme jour, et que le titre des listes la veille. **Le defaut recurrent
 * de ce depot n'est pas de mal chercher la donnee, c'est de ne pas afficher celle qu'il a.**
 *
 * ## Ce qui n'y est pas, et pourquoi
 *
 * Les **titres alternatifs** manquent toujours : ils vivent sur `/tv/{id}/alternative_titles`,
 * un appel de plus par fiche. Le releve les demandait ; ils ne valent pas une requete sur une
 * page servie a tout le monde depuis le cache de bord. Ce n'est pas un oubli, c'est un refus
 * — a rouvrir le jour ou un autre besoin fera deja cet appel.
 *
 * ## Une definition, pas des puces
 *
 * `<dl>` et non une liste a puces : chaque ligne est une **paire** — « Pays : États-Unis » —
 * et c'est ce que le balisage de definition dit. Un lecteur d'ecran annonce alors le libelle
 * avec sa valeur, ce qu'une liste de fragments ne fait pas.
 */
export function ProductionDetails({
  crew,
  genres,
  networks,
  originCountries,
  originalLanguage,
  locale,
}: {
  readonly crew: readonly CrewMember[];
  readonly genres: readonly string[];
  readonly networks: readonly string[];
  readonly originCountries: readonly string[];
  readonly originalLanguage?: string;
  readonly locale: Locale;
}) {
  const rows: readonly { readonly label: string; readonly value: string }[] = [
    ...(genres.length > 0
      ? [{ label: t(locale, 'details.genres'), value: genres.join(' · ') }]
      : []),
    ...(networks.length > 0
      ? [{ label: t(locale, 'details.network'), value: networks.join(' · ') }]
      : []),
    ...(originCountries.length > 0
      ? [{ label: t(locale, 'details.country'), value: countryNames(originCountries, locale) }]
      : []),
    ...(originalLanguage !== undefined
      ? [{ label: t(locale, 'details.language'), value: languageName(originalLanguage, locale) }]
      : []),
  ];

  // ⚠️ Se tait quand la serie n'a **rien** de tout cela — ce qui arrive hors des productions
  // les mieux documentees. La page est par ailleurs pleine, et un encart « Détails » vide
  // serait un constat de lacune, pas une information. Voir `Cast`, meme arbitrage.
  if (crew.length === 0 && rows.length === 0) return null;

  return (
    <section className="bleed space-y-4" aria-label={t(locale, 'details.title')}>
      <RowHeader title={t(locale, 'details.title')} subtitle={t(locale, 'details.why')} />

      {crew.length > 0 ? (
        // Une grille de visages comme le generique, et pour la meme raison : deux objets de
        // meme nature sur une meme page doivent se ressembler.
        <ul className="poster-grid">
          {crew.map((member) => (
            <li key={member.providerId}>
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
              {/* Le poste reste **brut** : « Executive Producer » n'a pas d'equivalent stable
                  en francais, et une table de traduction de tous les metiers de TMDB serait un
                  dictionnaire a tenir a jour pour une ligne de huit mots. */}
              {member.job === undefined ? null : <p className="clamp-2 meta-sm">{member.job}</p>}
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="meta-sm">{row.label}</dt>
              <dd className="text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/**
 * `US` → « États-Unis ».
 *
 * ⚠️ **`Intl.DisplayNames` et non une table du depot** : les 249 pays de l'ISO 3166 dans deux
 * langues seraient 498 lignes a tenir a jour, alors que le navigateur **et** Node les portent
 * deja. Un code inconnu est rendu tel quel plutot que masque — « ZZ » est visiblement un code,
 * donc lisible comme un defaut de donnee, ce qu'une ligne absente n'est pas.
 */
function countryNames(codes: readonly string[], locale: Locale): string {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return codes.map((code) => safeName(names, code)).join(' · ');
}

function languageName(code: string, locale: Locale): string {
  return safeName(new Intl.DisplayNames([locale], { type: 'language' }), code);
}

/**
 * ⚠️ `Intl.DisplayNames` **leve** sur un code mal forme (`RangeError`), il ne rend pas
 * `undefined`. Une fiche serie ne doit pas tomber parce que TMDB a rendu un code exotique.
 */
function safeName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

import { t, tn, type Locale } from '@/lib/i18n';
import type { OrderingNotice as Notice } from '@/src/domain/ordering';

/**
 * « Ce decoupage n'est pas le seul. »
 *
 * ## Ce que ce bandeau repare, avec des chiffres
 *
 * Une serie n'a pas **un** decoupage en saisons. Mesure contre l'API TMDB reelle le
 * 2026-08-03 : *Money Heist* vaut **3 saisons / 41 episodes** dans l'ordre de diffusion, et
 * **5 parts / 48 episodes** sur Netflix — c'est-a-dire la ou tout le monde la regarde.
 * Quelqu'un qui dit « je suis saison 4 » designe donc une saison **qui n'existe pas** dans
 * nos chiffres, et « il vous reste X episodes · Y heures » se trompe de **17 %**.
 *
 * Chez un tracker, se tromper d'ordre donne une case cochee au mauvais endroit : **visible**,
 * et corrigeable par l'utilisateur. Ici l'ordre est l'**entree de tous les calculs** — la
 * trajectoire, le point d'entree, le point d'arret, le temps restant, le bilan d'heures. Le
 * produit rendrait un conseil **faux avec assurance**, et rien ne le montrerait.
 *
 * ## Pourquoi ce bandeau annonce une convention et ne crie pas a l'erreur
 *
 * Nos chiffres **ne sont pas faux** : ils suivent l'ordre de diffusion, et le disent. Ce qui
 * serait faux est de laisser croire qu'il n'y en a qu'un. C'est — **on
 * signale, on ne repare jamais en silence** : proposer un decoupage a la place de
 * l'utilisateur deplacerait des notes deja posees par saison, ce qui est irrattrapable,
 * alors qu'une mise en garde ne l'est pas.
 *
 * ## Composant **serveur**, deliberement
 *
 * Aucun `'use client'` : rien ici ne depend du journal ni d'un geste. Le bandeau coute donc
 * **zero octet de JavaScript** et part dans le HTML mis en cache au bord — contrairement a
 * {@link WatchOptions}, qui doit lire les plateformes de la personne. C'est la difference
 * entre « informer » et « personnaliser », et elle se paie en kilo-octets.
 *
 * ## Il se tait la plupart du temps
 *
 * `notice` vaut `undefined` des que rien ne diverge, et c'est le cas courant : verifie sur
 * six series, **trois se taisent** (*Game of Thrones*, *The Walking Dead*, *Stranger
 * Things*). Meme regle que le point d'arret, le verdict de saison et le bilan — *la feature
 * se tait quand elle n'a rien a dire*, sinon on apprend a ne plus la lire.
 */
export function OrderingNotice({
  notice,
  seasonCount,
  episodeCount,
  locale,
}: {
  readonly notice: Notice | undefined;
  /** Saisons du decoupage **affiche** — ce que le bandeau qualifie. */
  readonly seasonCount: number;
  readonly episodeCount: number;
  readonly locale: Locale;
}) {
  if (notice === undefined) return null;

  const shape = (seasons: number, episodes: number) => ({
    seasons: tn(locale, 'ordering.seasons', seasons),
    episodes: tn(locale, 'ordering.episodes', episodes),
  });

  // Nommes moins ceux montres : `total` porte le compte reel, donc le reste s'annonce sans
  // avoir a le recompter — et sans mentir quand *One Piece* en remonte quinze.
  const hidden = notice.total - notice.named.length;

  return (
    <section
      aria-label={t(locale, 'ordering.title')}
      className="panel space-y-2 px-3 py-2.5 text-sm"
    >
      {/* ⚠️ Ce titre rendait deja `0.875rem`, mais **par heritage** du `text-sm` de la
          section : sa taille dependait d'un parent, donc d'une decision prise ailleurs. Le
          cran la rend explicite — zero changement a l'ecran, et un titre qui ne change plus
          de taille quand on touche a l'encart qui le contient. */}
      <h2 className="card-title">{t(locale, 'ordering.title')}</h2>

      <p className="text-(--color-muted)">
        {t(locale, 'ordering.explain', shape(seasonCount, episodeCount))}
      </p>

      <div>
        <p className="text-(--color-muted)">{t(locale, 'ordering.alsoKnown')}</p>
        <ul className="mt-1 space-y-0.5">
          {notice.named.map((ordering) => (
            <li key={ordering.id} className="tabular-nums">
              {/* Le nom vient des contributeurs TMDB (« Netflix Seasons », « German DVD
                  Release ») : non traduit, et rendu comme du texte — jamais interprete.
                  C'est la meme entree non fiable que les titres, celle qui avait produit
                  la XSS du JSON-LD. */}
              {t(locale, 'ordering.entry', {
                name: ordering.name,
                ...shape(ordering.groupCount, ordering.episodeCount),
              })}
            </li>
          ))}
          {hidden > 0 ? (
            <li className="text-(--color-muted)">{tn(locale, 'ordering.more', hidden)}</li>
          ) : null}
        </ul>
      </div>

      <p className="text-xs text-(--color-muted)">{t(locale, 'ordering.caution')}</p>
    </section>
  );
}

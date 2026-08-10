'use client';

import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';

/**
 * Les services les plus courants en France, dans l'ordre de leur audience.
 *
 * Une liste fermee plutot qu'une saisie libre : les noms doivent correspondre
 * **exactement** a ceux que rend le fournisseur, sinon la comparaison echoue en
 * silence et « dispo chez vous » ne s'affiche jamais — un defaut invisible, le pire
 * genre. Les noms ci-dessous sont ceux de TMDB/JustWatch, pas les noms commerciaux.
 */
const KNOWN_PLATFORMS: readonly string[] = [
  'Netflix',
  'Amazon Prime Video',
  'Disney Plus',
  'Max',
  'Canal+',
  'Apple TV+',
  'Paramount Plus',
  'Crunchyroll',
  'France TV',
  'Arte',
];

/**
 * A quoi je suis abonne.
 *
 * Le contre-sens qui a mene ici : « JustWatch nous dit ou regarder ». Il dit ou,
 * mais **nous** ignorions a quoi l'utilisateur est abonne — la moitie manquante de
 * l'information etait de notre cote, pas du sien. Une fois declaree, « dispo chez
 * vous » devient une reponse, et non une liste de dix services a departager.
 *
 * ⚠️ Afficher n'est pas de l'affiliation. Aucun lien monetise ici : ce serait un
 * usage commercial de TMDB, qui exige un accord ecrit (dette D6).
 */
export function MyPlatforms() {
  const { journal, ready, setPlatforms } = useJournal();
  const { t } = useT();
  if (!ready) return <div className="h-24" aria-hidden="true" />;

  const mine = new Set(journal.platforms ?? []);

  const toggle = (name: string) => {
    const next = new Set(mine);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPlatforms([...next]);
  };

  return (
    <section
      className="card space-y-3"
      aria-label={t('platforms.aria')}
    >
      <div>
        <h2 className="card-title">{t('platforms.title')}</h2>
        <p className="text-xs text-(--color-muted)">{t('platforms.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KNOWN_PLATFORMS.map((name) => {
          const active = mine.has(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(name)}
              className={`rounded-full border px-3 py-1 text-xs ${
                active
                  ? 'border-(--color-live)/40 bg-(--color-live)/15 text-(--color-live)'
                  : 'border-(--color-edge) text-(--color-muted) hover:border-(--color-muted)'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

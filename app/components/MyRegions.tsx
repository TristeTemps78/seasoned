'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { SERVED_WATCH_REGIONS } from '@/lib/catalog';

/**
 * Mes pays — « ou la regarder », chez moi et la ou je vais.
 *
 * ## On ne devine pas l'utilisateur, on le laisse choisir
 *
 * Tranche par Tristan le 2026-08-03, et la raison tient en deux points :
 *
 *  * deduire le pays de l'adresse IP demanderait de l'inspecter cote serveur, donc du
 *    **tracage** — ce qui casse « pas de publicite donc pas de suivi », l'argument meme
 *    qui rend le modele economique coherent ;
 *  * et ce serait **faux** derriere un VPN, c'est-a-dire precisement pour les gens que la
 *    question interesse.
 *
 * ⚠️ La liste proposee est {@link SERVED_WATCH_REGIONS}, et pas les 249 pays du monde :
 * ce sont ceux que la page serie sert reellement. Offrir un pays qu'aucune page ne porte
 * donnerait un reglage sans effet, c'est-a-dire un mensonge poli.
 */
export function MyRegions() {
  const { journal, ready, setRegions } = useJournal();
  const { t, locale } = useT();
  if (!ready) return <div className="h-24" aria-hidden="true" />;

  const mine = new Set(journal.regions ?? []);

  // Le navigateur sait nommer 249 pays dans toutes les langues : les traduire a la main
  // n'aurait aucun sens. Meme raisonnement que l'attribution de `WatchOptions`.
  const naming = new Intl.DisplayNames([locale === 'fr' ? 'fr-FR' : 'en-GB'], {
    type: 'region',
  });

  const toggle = (code: string) => {
    const next = new Set(mine);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setRegions([...next]);
  };

  return (
    <section className="card space-y-3" aria-label={t('regions.aria')}>
      <div>
        <h2 className="card-title">{t('regions.title')}</h2>
        <p className="text-xs text-(--color-muted)">{t('regions.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SERVED_WATCH_REGIONS.map((code) => {
          const active = mine.has(code);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(code)}
              className={`rounded-full border px-3 py-1 text-xs ${
                active
                  ? 'border-(--color-live)/40 bg-(--color-live)/15 text-(--color-live)'
                  : 'border-(--color-edge) text-(--color-muted) hover:border-(--color-muted)'
              }`}
            >
              {naming.of(code) ?? code}
            </button>
          );
        })}
      </div>
    </section>
  );
}

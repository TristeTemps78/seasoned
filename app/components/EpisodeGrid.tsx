import type { SeasonRatings } from '@/lib/catalog';
import { COLOR_CEILING, COLOR_FLOOR, ratingHue } from '@/src/domain/rating-scale';

/**
 * La grille des episodes, colorée par note.
 *
 * L'idee vient d'IMDb, ou cette grille est de loin l'ecran le plus capture et
 * partage : on y **voit** d'un coup d'oeil la saison qui s'effondre et l'episode
 * culte. C'est la seule chose de ce site qui soit frappante avant d'etre lue.
 *
 * Deux precautions que la version d'IMDb ne prend pas :
 *
 *   - **La couleur ne porte jamais l'information seule.** Chaque case indique sa note
 *     en attribut accessible ; qui ne distingue pas les couleurs, ou navigue au
 *     lecteur d'ecran, lit la meme chose.
 *   - **L'echelle est bornee sur la plage reellement occupee** (6 a 9). Etaler sur
 *     0–10 donnerait une grille uniformement verte, ou l'on ne verrait rien — meme
 *     piege que l'arrondi de la trajectoire.
 */
export function EpisodeGrid({ seasons }: { readonly seasons: readonly SeasonRatings[] }) {
  if (seasons.length === 0) return null;

  const widest = Math.max(...seasons.map((s) => s.episodes.length));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px]">
          <caption className="sr-only">
            Note du public par épisode, saison par saison
          </caption>
          <tbody>
            {seasons.map((season) => (
              <tr key={season.seasonNumber}>
                <th
                  scope="row"
                  className="pr-2 text-right font-normal tabular-nums text-(--color-muted)"
                >
                  S{season.seasonNumber}
                </th>
                {Array.from({ length: widest }, (_, i) => {
                  const episode = season.episodes[i];
                  if (episode === undefined) {
                    return <td key={i} className="h-5 w-5" />;
                  }
                  const hue = ratingHue(episode.voteAverage);
                  return (
                    <td key={i} className="h-5 w-5 p-0">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-[2px]"
                        style={{ backgroundColor: cellColor(hue) }}
                        // La note est lisible sans voir la couleur.
                        title={`S${episode.seasonNumber}E${episode.episodeNumber}${
                          episode.title !== undefined ? ` — ${episode.title}` : ''
                        } · ${episode.voteAverage.toFixed(1)}/10`}
                      >
                        <span className="sr-only">
                          Saison {episode.seasonNumber}, épisode {episode.episodeNumber} :{' '}
                          {episode.voteAverage.toFixed(1)} sur 10
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-2 text-xs text-(--color-muted)">
        <span>{COLOR_FLOOR}/10</span>
        <span className="flex" aria-hidden="true">
          {[0, 0.25, 0.5, 0.75, 1].map((h) => (
            <span
              key={h}
              className="h-3 w-6"
              style={{ backgroundColor: cellColor(h) }}
            />
          ))}
        </span>
        <span>{COLOR_CEILING}/10 et plus</span>
      </p>
    </div>
  );
}

/**
 * Rouge sombre vers vert, en passant par l'ambre.
 *
 * Teintes reprises de la charte (`app/globals.css`) plutot qu'un degrade arbitraire,
 * pour que la grille appartienne visuellement au reste du site.
 */
function cellColor(hue: number): string {
  const stops = [
    [0, [127, 29, 29]],
    [0.5, [180, 130, 30]],
    [1, [74, 222, 128]],
  ] as const;

  for (let i = 1; i < stops.length; i += 1) {
    const [prevAt, prev] = stops[i - 1]!;
    const [nextAt, next] = stops[i]!;
    if (hue > nextAt && i < stops.length - 1) continue;
    const t = (hue - prevAt) / (nextAt - prevAt);
    const mix = prev.map((c, k) => Math.round(c + (next[k]! - c) * Math.min(1, Math.max(0, t))));
    return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
  }
  return 'rgb(127 29 29)';
}

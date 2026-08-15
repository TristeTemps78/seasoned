import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  groupByDay,
  yearsInTimeline,
  type TimelineEvent,
} from '../src/domain/timeline';
import {
  EMPTY_JOURNAL,
  asImported,
  episodeKey,
  markCompleted,
  reviewKey,
  setDecision,
  setEpisodeMark,
  setEpisodeRating,
  setLiked,
  setPosition,
  setReview,
  setSeasonRating,
  setWanted,
} from '../src/domain/journal';

/**
 * Le journal date.
 *
 * ## Ce que ces tests protegent en priorite
 *
 * Pas le tri — un tri faux se voit. **La marque d'import.** `origin: 'import'` dit que la
 * date d'un fait est celle ou il est entre, pas celle ou il a eu lieu ; un journal date qui
 * la perdrait afficherait une journee ou l'on aurait regarde deux cents series et neuf
 * annees vides avant. Le defaut ne se voit pas sur un jeu de donnees saisi a la main —
 * il n'apparait qu'apres un import, chez quelqu'un, et il est alors irrattrapable.
 */

const BB = 'tmdb:1396';
const GOT = 'tmdb:1399';

const JANVIER = new Date('2026-01-10T20:00:00.000Z');
const MARS = new Date('2026-03-02T09:00:00.000Z');
const MARS_SOIR = new Date('2026-03-02T22:45:00.000Z');
const AOUT_2025 = new Date('2025-08-20T18:00:00.000Z');

function kinds(events: readonly TimelineEvent[]): readonly string[] {
  return events.map((e) => e.kind);
}

describe('buildTimeline', () => {
  it('un journal vide ne rend rien', () => {
    expect(buildTimeline(EMPTY_JOURNAL)).toEqual([]);
  });

  it('rend chaque fait date, une fois', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, JANVIER);
    j = setPosition(j, BB, 2, 3, MARS);
    j = setSeasonRating(j, BB, 1, 4, MARS);
    j = markCompleted(j, BB, MARS_SOIR);

    const events = buildTimeline(j);

    expect(events).toHaveLength(4);
    expect(new Set(kinds(events))).toEqual(
      new Set(['wanted', 'position', 'rated_season', 'completed']),
    );
  });

  it('trie du plus recent au plus ancien, sur l instant et non sur le jour', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, BB, 1, 3, MARS);
    j = setSeasonRating(j, BB, 2, 4, MARS_SOIR);

    const events = buildTimeline(j);

    // Meme jour, deux instants : le plus tardif d'abord. Trier sur `on` les rendrait
    // dans un ordre arbitraire, et deux notes posees le meme soir se liraient a l'envers.
    expect(events[0]?.season).toBe(2);
    expect(events[1]?.season).toBe(1);
  });

  it('couvre les neuf genres du format', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, JANVIER);
    j = setLiked(j, BB, true, JANVIER);
    j = setPosition(j, BB, 2, 3, JANVIER);
    j = setSeasonRating(j, BB, 1, 4, JANVIER);
    j = setEpisodeRating(j, BB, 1, 2, 5, JANVIER);
    j = setDecision(j, BB, 'continuing', JANVIER);
    j = markCompleted(j, BB, JANVIER);
    j = setReview(j, BB, reviewKey(), { text: 'Tenue.', throughSeason: 0 }, JANVIER);
    j = setEpisodeMark(j, BB, 3, 7, 'skipped', JANVIER);

    // Neuf genres declares dans `TimelineKind`, neuf genres produits : c'est l'ancrage qui
    // fait echouer ce test le jour ou un champ date du journal cesse d'etre relu.
    expect(new Set(kinds(buildTimeline(j))).size).toBe(9);
  });

  it('porte la saison et l episode quand le fait en a un', () => {
    const j = setEpisodeRating(EMPTY_JOURNAL, BB, 3, 7, 4, JANVIER);
    const event = buildTimeline(j)[0];

    expect(event?.season).toBe(3);
    expect(event?.episode).toBe(7);
    expect(event?.stars).toBe(4);
  });

  it('lit la saison d une critique depuis sa cle canonique', () => {
    const j = setReview(EMPTY_JOURNAL, BB, reviewKey(4), { text: 'La quatrieme flechit.', throughSeason: 4 }, JANVIER);

    expect(buildTimeline(j)[0]?.season).toBe(4);
  });

  it('une critique de serie n a pas de saison', () => {
    const j = setReview(EMPTY_JOURNAL, BB, reviewKey(), { text: 'Bien.', throughSeason: 0 }, JANVIER);

    expect(buildTimeline(j)[0]?.season).toBeUndefined();
  });

  it('ecarte un fait dont la date est illisible, sans perdre les autres', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, JANVIER);
    // Une entree fabriquee a la main : c'est ce qu'un journal corrompu ou ecrit par un
    // autre client peut contenir, et le module doit ecarter le fait, pas l'histoire.
    j = {
      ...j,
      entries: {
        ...j.entries,
        [BB]: { ...j.entries[BB], liked: { at: 'pas-une-date' } },
      },
    };

    expect(kinds(buildTimeline(j))).toEqual(['wanted']);
  });
});

describe('la marque d import', () => {
  it('un fait saisi a la main n est pas marque', () => {
    const j = setWanted(EMPTY_JOURNAL, BB, true, JANVIER);

    expect(buildTimeline(j)[0]?.imported).toBe(false);
  });

  it('un fait repris d ailleurs l est — sa date est celle de l import', () => {
    // 🔴 Le seul defaut de ce module qui ne se rattrape pas. `importForeign` date CHAQUE
    // fait a l'instant de l'import : sans cette marque, dix ans de TV Time s'afficheraient
    // comme une seule journee de deux cents series.
    const j = asImported(setWanted(EMPTY_JOURNAL, BB, true, JANVIER));

    expect(buildTimeline(j)[0]?.imported).toBe(true);
  });

  it('la marque suit le fait, pas l entree', () => {
    // Une entree peut porter les deux : un import repris, puis un geste fait a la main
    // apres coup. Marquer l'entree entiere mentirait sur la moitie des lignes.
    let j = asImported(setWanted(EMPTY_JOURNAL, BB, true, AOUT_2025));
    j = setSeasonRating(j, BB, 1, 5, MARS);

    const events = buildTimeline(j);
    const parGenre = new Map(events.map((e) => [e.kind, e.imported]));

    expect(parGenre.get('wanted')).toBe(true);
    expect(parGenre.get('rated_season')).toBe(false);
  });
});

describe('les filtres', () => {
  function journal() {
    let j = setSeasonRating(EMPTY_JOURNAL, BB, 1, 5, MARS);
    j = setSeasonRating(j, GOT, 1, 2, AOUT_2025);
    j = setWanted(j, GOT, true, JANVIER);
    return j;
  }

  it('sans option, rend tout', () => {
    expect(buildTimeline(journal())).toHaveLength(3);
  });

  it('par annee', () => {
    expect(buildTimeline(journal(), { year: 2025 })).toHaveLength(1);
    expect(buildTimeline(journal(), { year: 2026 })).toHaveLength(2);
  });

  it('par genre', () => {
    expect(kinds(buildTimeline(journal(), { kinds: ['wanted'] }))).toEqual(['wanted']);
  });

  it('une liste de genres vide ne filtre pas — sinon l ecran se viderait tout seul', () => {
    expect(buildTimeline(journal(), { kinds: [] })).toHaveLength(3);
  });

  it('par note minimale, et un fait sans note ne passe pas', () => {
    const events = buildTimeline(journal(), { minStars: 3 });

    expect(events).toHaveLength(1);
    expect(events[0]?.stars).toBe(5);
  });

  it('par serie', () => {
    expect(buildTimeline(journal(), { subject: GOT })).toHaveLength(2);
  });
});

describe('groupByDay', () => {
  it('ne rend rien sur une liste vide', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('regroupe les faits du meme jour et preserve l ordre recu', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, BB, 1, 3, MARS);
    j = setSeasonRating(j, BB, 2, 4, MARS_SOIR);
    j = setWanted(j, GOT, true, JANVIER);

    const days = groupByDay(buildTimeline(j));

    expect(days.map((d) => d.on)).toEqual(['2026-03-02', '2026-01-10']);
    expect(days[0]?.events).toHaveLength(2);
    expect(days[1]?.events).toHaveLength(1);
  });
});

describe('yearsInTimeline', () => {
  it('ne propose que les annees ou il s est passe quelque chose', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, AOUT_2025);
    j = setSeasonRating(j, BB, 1, 4, MARS);

    // Pas 2024, pas 2023 : une annee vide dans le filtre est une porte qui ne mene nulle
    // part, et une liste fixe des dix dernieres en fabriquerait huit.
    expect(yearsInTimeline(buildTimeline(j))).toEqual([2026, 2025]);
  });

  it('rend les annees de la plus recente a la plus ancienne', () => {
    // ⚠️ Des evenements complets et non un `as` sur trois dates : `yearsInTimeline` ne lit
    // que `on`, mais un cast partiel prouverait que la fonction marche sur une forme qui
    // n'existe pas — et il cesserait de compiler pour la mauvaise raison le jour ou le type
    // change.
    const events: readonly TimelineEvent[] = ['2024-01-01', '2026-05-05', '2025-12-31'].map(
      (on) => ({ kind: 'liked', subject: BB, at: `${on}T12:00:00.000Z`, on, imported: false }),
    );

    expect(yearsInTimeline(events)).toEqual([2026, 2025, 2024]);
  });
});

describe('les cles d episode illisibles', () => {
  it('sont ecartees sans emporter le reste', () => {
    let j = setEpisodeRating(EMPTY_JOURNAL, BB, 1, 2, 4, JANVIER);
    j = {
      ...j,
      entries: {
        ...j.entries,
        [BB]: {
          ...j.entries[BB],
          episodeRatings: {
            ...j.entries[BB]?.episodeRatings,
            'pas:une:cle': { stars: 3, at: JANVIER.toISOString() },
          },
        },
      },
    };

    const events = buildTimeline(j);

    expect(events).toHaveLength(1);
    expect(events[0]?.episode).toBe(2);
  });

  it('l ancrage : la cle bien formee, elle, passe', () => {
    expect(episodeKey(1, 2)).toBe('1:2');
    expect(buildTimeline(setEpisodeRating(EMPTY_JOURNAL, BB, 1, 2, 4, JANVIER))).toHaveLength(1);
  });
});

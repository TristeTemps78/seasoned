import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  SNAPSHOT_IDENTITY_TTL_MS,
  SNAPSHOT_TTL_MS,
  TOMBSTONE_TTL_MS,
  episodeKey,
  freshSnapshot,
  hasContent,
  journalKey,
  mergeJournals,
  parseJournal,
  parseJournalKey,
  tryParseJournal,
  seasonScoresOf,
  serializeJournal,
  setDecision,
  setEpisodeRating,
  setLiked,
  setPlatforms,
  setPosition,
  setSeasonRating,
  setSnapshot,
  setWanted,
  suggestedSeasonRating,
  withDeviceId,
} from '../src/domain/journal';

const NOW = new Date('2026-08-02T12:00:00Z');
const LATER = new Date('2026-08-03T12:00:00Z');

const BB = journalKey('1396');
const DEXTER = journalKey('1405');

describe('les cles ne portent jamais un identifiant nu', () => {
  it('prefixe du fournisseur', () => {
    // `types.ts` : les donnees utilisateur ne pointent jamais un id fournisseur brut.
    // Le journal v1 le faisait — un changement de catalogue aurait tout emporte.
    expect(journalKey('1396')).toBe('tmdb:1396');
    expect(journalKey('81189', 'tvdb')).toBe('tvdb:81189');
  });

  it('se decompose, ce qui rend un remappage possible', () => {
    expect(parseJournalKey('tmdb:1396')).toEqual({ provider: 'tmdb', providerId: '1396' });
  });

  it('rejette ce qui n en est pas une', () => {
    for (const bad of ['1396', '', ':', 'tmdb:', ':1396']) {
      expect(parseJournalKey(bad)).toBeUndefined();
    }
  });
});

describe('parseJournal — ne perd jamais tout', () => {
  it('lit un journal valide', () => {
    const journal = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    expect(parseJournal(serializeJournal(journal), NOW)).toEqual(journal);
  });

  it('rend un journal vide plutot que de lever', () => {
    for (const bad of [null, undefined, '', '   ', 'pas du json', '[]', '42', '{}']) {
      expect(() => parseJournal(bad, NOW)).not.toThrow();
      expect(parseJournal(bad, NOW).entries).toEqual({});
    }
  });

  it('ecarte une entree corrompue et garde les autres', () => {
    // Perdre tout un journal parce qu'une ligne est illisible serait indefendable
    // pour un produit qui demande d'y investir du temps.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: { position: { seasonNumber: 2, episodeNumber: 5, declaredAt: NOW.toISOString() } },
        [DEXTER]: { position: { seasonNumber: 'trois', episodeNumber: null } },
        'tmdb:1402': { seasonRatings: { '1': { stars: 4, at: NOW.toISOString() } } },
      },
    });

    const journal = parseJournal(raw, NOW);
    expect(Object.keys(journal.entries).sort()).toEqual(['tmdb:1396', 'tmdb:1402']);
    expect(journal.entries[BB]?.position?.seasonNumber).toBe(2);
  });

  it('ecarte une saison illisible sans perdre le decoupage entier', () => {
    // Regle 4 : perdre les onze saisons lisibles parce que la douzieme est cassee
    // couterait bien plus que la ligne cassee elle-meme.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          wanted: { at: NOW.toISOString() },
          snapshot: {
            title: 'Breaking Bad',
            cachedAt: NOW.toISOString(),
            seasonSizes: [
              { seasonNumber: 1, episodeCount: 7 },
              { seasonNumber: 'deux', episodeCount: 13 },
              { seasonNumber: 3, episodeCount: 0 },
              { seasonNumber: 4 },
              'pas un objet',
              { seasonNumber: 5, episodeCount: 16 },
            ],
          },
        },
      },
    });

    expect(parseJournal(raw, NOW).entries[BB]?.snapshot?.seasonSizes).toEqual([
      { seasonNumber: 1, episodeCount: 7 },
      { seasonNumber: 5, episodeCount: 16 },
    ]);
  });

  it('distingue « je ne sais pas » de « aucune saison »', () => {
    // Un tableau vide dirait que la serie n a pas de saison, ce qui est faux et ferait
    // compter zero episode vu. L absence doit rester une absence.
    const snapshotWith = (seasonSizes: unknown): unknown => ({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: {
          wanted: { at: NOW.toISOString() },
          snapshot: { title: 'Breaking Bad', cachedAt: NOW.toISOString(), seasonSizes },
        },
      },
    });

    for (const bad of [undefined, null, 'douze', 42, {}, [], [{ seasonNumber: 1 }]]) {
      const journal = parseJournal(JSON.stringify(snapshotWith(bad)), NOW);
      expect(journal.entries[BB]?.snapshot?.seasonSizes).toBeUndefined();
      // Et le reste de l instantane survit : une forme illisible n est pas fatale.
      expect(journal.entries[BB]?.snapshot?.title).toBe('Breaking Bad');
    }
  });

  it('lit une version future au lieu de tout jeter, et retient son numero', () => {
    // 🔴 Ce test disait l'inverse jusqu'au 2026-08-06 : « refuse une version future plutot
    // que de deviner ». Le raisonnement semblait prudent et il etait destructeur — rendre
    // EMPTY_JOURNAL fait lire « ce compte n'a rien » a la synchronisation, qui pousse alors
    // le local par-dessus le distant. Voir la decision n°4 en tete de `journal.ts`.
    const raw = JSON.stringify({
      version: 99,
      entries: { [BB]: { position: { seasonNumber: 3, episodeNumber: 7, declaredAt: NOW.toISOString() } } },
    });
    const journal = parseJournal(raw, NOW);

    expect(journal.entries[BB]?.position?.seasonNumber).toBe(3);
    // Le numero est conserve : le document porte des champs d'une v99, meme si nous ne
    // savons pas les lire. Annoncer 3 dirait qu'il n'en porte plus.
    expect(journal.version).toBe(99);
  });

  it('rend `unreadable` ce qui n est pas un journal, et le distingue du vide', () => {
    // La distinction que `parseJournal` ne peut pas rendre : elle repond EMPTY_JOURNAL dans
    // les deux cas, ce qui est sur en local et destructeur a distance.
    for (const raw of ['{pas du json', '"une chaine"', '[]', '{}', '{"version":"trois"}']) {
      expect(tryParseJournal(raw, NOW).kind).toBe('unreadable');
    }
    for (const raw of [undefined, null, '', '   ']) {
      expect(tryParseJournal(raw, NOW)).toEqual({ kind: 'ok', journal: EMPTY_JOURNAL });
    }
  });

  it('preserve un champ inconnu, d une entree comme du document', () => {
    // Le defaut que ce test attrape : un ancien client relit un journal ecrit par un client
    // plus recent, n'en garde que ce qu'il comprend, et le **reecrit dépouille** a la
    // synchronisation suivante. La perte est silencieuse et definitive.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      futureRoot: { hello: 'world' },
      entries: {
        [BB]: {
          wanted: { at: NOW.toISOString() },
          futureField: { hello: 'ecrit par une version future' },
        },
      },
    });

    const reread = parseJournal(serializeJournal(parseJournal(raw, NOW)), NOW);
    expect(reread.entries[BB]?.unknownFields?.['futureField']).toEqual({
      hello: 'ecrit par une version future',
    });
    expect(reread.unknownFields?.['futureRoot']).toEqual({ hello: 'world' });
    // Et le champ connu qui voisinait n'a pas bouge.
    expect(reread.entries[BB]?.wanted?.at).toBe(NOW.toISOString());

    // Reetale a PLAT, pas range dans un seau : sinon chaque aller-retour emboiterait un
    // seau de plus, et le document grossirait a chaque synchronisation.
    const written = JSON.parse(serializeJournal(reread)) as Record<string, unknown>;
    expect(written['futureRoot']).toEqual({ hello: 'world' });
    expect(written['unknownFields']).toBeUndefined();
    const entry = (written['entries'] as Record<string, Record<string, unknown>>)[BB];
    expect(entry?.['futureField']).toEqual({ hello: 'ecrit par une version future' });
    expect(entry?.['unknownFields']).toBeUndefined();
  });

  it('une entree reduite a un champ inconnu survit, sans etre du contenu', () => {
    // Les deux predicats divergent, et c'est le point : `worthKeeping` doit la garder —
    // sinon le pass-through est detruit par la premiere ecriture — mais `hasContent` doit
    // la refuser, sinon une serie que l'utilisateur n'a jamais touchee apparait dans /moi.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: { [BB]: { futureField: { hello: 'x' } } },
    });
    const journal = parseJournal(raw, NOW);

    expect(journal.entries[BB]).toBeDefined();
    expect(hasContent(journal.entries[BB])).toBe(false);
    // Et elle survit a une ecriture portant sur une AUTRE serie.
    const after = setWanted(journal, journalKey('999'), true, NOW);
    expect(after.entries[BB]?.unknownFields?.['futureField']).toBeDefined();
  });

  it('migre un journal v1 : les cles nues prennent leur prefixe', () => {
    // Le seul fournisseur de la v1 etait TMDB : la migration est sure.
    const v1 = JSON.stringify({
      version: 1,
      entries: {
        '1396': {
          position: { seasonNumber: 3, episodeNumber: 7, declaredAt: NOW.toISOString() },
          seasonRatings: { '1': { stars: 4.5, at: NOW.toISOString() } },
        },
      },
    });

    const journal = parseJournal(v1, NOW);
    expect(Object.keys(journal.entries)).toEqual(['tmdb:1396']);
    expect(journal.entries[BB]?.position?.seasonNumber).toBe(3);
    expect(journal.entries[BB]?.seasonRatings?.['1']?.stars).toBe(4.5);
    expect(journal.version).toBe(JOURNAL_VERSION);
  });

  it('ecarte une note hors echelle', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: { [BB]: { seasonRatings: { '1': { stars: 3.7 }, '2': { stars: 4 } } } },
    });
    const ratings = parseJournal(raw, NOW).entries[BB]?.seasonRatings ?? {};
    expect(Object.keys(ratings)).toEqual(['2']);
  });

  it('remplace une date illisible au lieu de jeter l entree', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: { [BB]: { position: { seasonNumber: 1, episodeNumber: 1, declaredAt: 'hier' } } },
    });
    const position = parseJournal(raw, NOW).entries[BB]?.position;
    // L'entree survit — c'est ce que ce test defend depuis le debut.
    expect(position?.seasonNumber).toBe(1);
    // Mais la date de repli n'est plus l'instant de lecture. Elle valait `NOW` ici, et
    // cette assertion-la codifiait un defaut : deux appareils lisant ce meme journal
    // donnaient a ce fait deux dates differentes, et la fusion tranchait selon lequel
    // avait ouvert l'application en dernier.
    expect(position?.declaredAt).toBe(new Date(0).toISOString());
  });

  it('une date illisible perd contre une date connue, quel que soit l ordre', () => {
    const undated = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: { [BB]: { position: { seasonNumber: 9, episodeNumber: 9, declaredAt: 'hier' } } },
    });
    const dated = JSON.stringify({
      version: JOURNAL_VERSION,
      entries: {
        [BB]: { position: { seasonNumber: 2, episodeNumber: 4, declaredAt: '2026-03-01T00:00:00.000Z' } },
      },
    });
    const a = parseJournal(undated, NOW);
    const b = parseJournal(dated, NOW);
    expect(mergeJournals(a, b).entries[BB]?.position?.seasonNumber).toBe(2);
    expect(mergeJournals(b, a).entries[BB]?.position?.seasonNumber).toBe(2);
  });

  it('conserve l appareil et les plateformes', () => {
    let j = withDeviceId(EMPTY_JOURNAL, 'appareil-1');
    j = setPlatforms(j, ['Netflix', 'Disney Plus']);
    j = setPosition(j, BB, 1, 1, NOW);

    const round = parseJournal(serializeJournal(j), NOW);
    expect(round.deviceId).toBe('appareil-1');
    expect(round.platforms).toEqual(['Netflix', 'Disney Plus']);
  });
});

describe('ecritures', () => {
  it('la position est un pointeur qu on deplace', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    j = setPosition(j, BB, 3, 7, NOW);
    expect(j.entries[BB]?.position).toMatchObject({ seasonNumber: 3, episodeNumber: 7 });
  });

  it('note et denote une saison', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, BB, 2, 4.5, NOW);
    expect(j.entries[BB]?.seasonRatings?.['2']?.stars).toBe(4.5);

    j = setSeasonRating(j, BB, 2, undefined, LATER);
    expect(j.entries[BB]?.seasonRatings?.['2']).toBeUndefined();
    // L'entree survit, reduite a sa trace de suppression : sans elle, la note
    // reviendrait a la premiere fusion avec un appareil qui l'ignorait.
    expect(hasContent(j.entries[BB])).toBe(false);
    expect(j.entries[BB]?.removed?.['season:2']).toBe(LATER.toISOString());
  });

  it('retire une serie devenue vide du journal', () => {
    // Une entree vide n'a pas a encombrer le journal ni son export.
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    j = setSeasonRating(j, BB, 1, 4, NOW);
    j = setSeasonRating(j, BB, 1, undefined, LATER);
    expect(j.entries[BB]?.position).toBeDefined();
  });

  it('une decision retient le point exact ou elle a ete prise', () => {
    // C'est ce point qui fera la carte des abandons.
    let j = setPosition(EMPTY_JOURNAL, DEXTER, 5, 3, NOW);
    j = setDecision(j, DEXTER, 'abandoned', NOW);

    expect(j.entries[DEXTER]?.decision).toMatchObject({
      kind: 'abandoned',
      atSeason: 5,
      atEpisode: 3,
    });
  });

  it('accepte une decision sans position connue', () => {
    const j = setDecision(EMPTY_JOURNAL, DEXTER, 'completed', NOW);
    expect(j.entries[DEXTER]?.decision?.kind).toBe('completed');
    expect(j.entries[DEXTER]?.decision?.atSeason).toBeUndefined();
  });

  it('n altere jamais le journal recu', () => {
    const before = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    const snapshot = serializeJournal(before);
    setPosition(before, DEXTER, 2, 2, NOW);
    expect(serializeJournal(before)).toBe(snapshot);
  });
});

describe('« je veux la voir » — le geste qui ne suppose rien', () => {
  it('cree une entree sans aucune position', () => {
    // Le produit n'offrait aucune prise a qui decouvre une serie, c'est-a-dire a la
    // quasi-totalite des arrivants.
    const j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    expect(j.entries[BB]?.wanted?.at).toBe(NOW.toISOString());
    expect(j.entries[BB]?.position).toBeUndefined();
  });

  it('se retire, et l entree ne porte plus rien', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    j = setWanted(j, BB, false, LATER);
    expect(j.entries[BB]?.wanted).toBeUndefined();
    expect(hasContent(j.entries[BB])).toBe(false);
  });
});

describe('notes d episode (A7)', () => {
  it('note et denote un episode', () => {
    let j = setEpisodeRating(EMPTY_JOURNAL, BB, 5, 14, 5, NOW);
    expect(j.entries[BB]?.episodeRatings?.[episodeKey(5, 14)]?.stars).toBe(5);

    j = setEpisodeRating(j, BB, 5, 14, undefined, LATER);
    expect(hasContent(j.entries[BB])).toBe(false);
  });

  it('la note de saison est suggeree, jamais ecrite', () => {
    // `AGENTS.md` regle 8 : on signale, on ne repare pas en silence.
    let j = setEpisodeRating(EMPTY_JOURNAL, BB, 1, 1, 4, NOW);
    j = setEpisodeRating(j, BB, 1, 2, 4.5, NOW);
    j = setEpisodeRating(j, BB, 1, 3, 5, NOW);
    j = setEpisodeRating(j, BB, 2, 1, 1, NOW);

    expect(suggestedSeasonRating(j.entries[BB], 1)).toBe(4.5);
    expect(j.entries[BB]?.seasonRatings).toBeUndefined();
  });

  it('ne suggere rien sans note d episode', () => {
    expect(suggestedSeasonRating(undefined, 1)).toBeUndefined();
    expect(suggestedSeasonRating({}, 1)).toBeUndefined();
  });

  it('ne confond pas la saison 1 et la saison 10', () => {
    let j = setEpisodeRating(EMPTY_JOURNAL, BB, 10, 1, 1, NOW);
    j = setEpisodeRating(j, BB, 1, 1, 5, NOW);
    expect(suggestedSeasonRating(j.entries[BB], 1)).toBe(5);
    expect(suggestedSeasonRating(j.entries[BB], 10)).toBe(1);
  });
});

describe('instantane de vignette — le plafond contractuel vaut aussi dans le navigateur', () => {
  const SHAPE = { title: 'Breaking Bad', posterPath: '/aff.jpg' } as const;

  it('ne cree jamais une entree', () => {
    // Sans cela, visiter des pages suffirait a constituer une base de metadonnees
    // TMDB — ce que le contrat interdit (`AGENTS.md` regle 1).
    const j = setSnapshot(EMPTY_JOURNAL, BB, SHAPE, NOW);
    expect(j.entries[BB]).toBeUndefined();
  });

  it('s attache a une entree existante', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    j = setSnapshot(j, BB, SHAPE, NOW);
    expect(freshSnapshot(j.entries[BB], NOW)?.title).toBe('Breaking Bad');
  });

  it('perd d abord ce qui bouge, en gardant ce qui identifie', () => {
    // Defaut trouve en verifiant la bibliotheque au navigateur, qu aucun test ne
    // pouvait montrer : avec un delai unique, toute serie terminee — donc dont on ne
    // revisite jamais la fiche — retombait sur « Serie 1405 » au bout d un mois, et
    // la section « Terminees » etait illisible en permanence.
    let j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    j = setSnapshot(
      j,
      BB,
      { ...SHAPE, statusLabel: 'Terminée', nextEpisodeAt: NOW.toISOString(), publicStars: 4.3 },
      NOW,
    );

    const justBefore = new Date(NOW.getTime() + SNAPSHOT_TTL_MS - 1);
    expect(freshSnapshot(j.entries[BB], justBefore)?.statusLabel).toBe('Terminée');

    const later = new Date(NOW.getTime() + SNAPSHOT_TTL_MS + 1);
    const aged = freshSnapshot(j.entries[BB], later);
    expect(aged?.title).toBe('Breaking Bad');
    expect(aged?.posterPath).toBe('/aff.jpg');
    // Un statut vieux d'un mois peut etre faux : mieux vaut rien qu'une mention fausse.
    expect(aged?.statusLabel).toBeUndefined();
    expect(aged?.nextEpisodeAt).toBeUndefined();
    expect(aged?.publicStars).toBeUndefined();
  });

  it('garde la forme de la serie au-dela des trente jours', () => {
    // La duree d un episode et la taille des saisons ne se periment pas comme un statut.
    // Les ranger avec le mouvant rendait le bilan de temps passe aveugle a toute serie
    // non revisitee depuis un mois — c est-a-dire aux series **terminees**, celles qui
    // pesent le plus lourd dans un bilan.
    let j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    j = setSnapshot(
      j,
      BB,
      {
        ...SHAPE,
        statusLabel: 'Terminée',
        episodeMinutes: 47,
        seasonSizes: [
          { seasonNumber: 1, episodeCount: 7 },
          { seasonNumber: 2, episodeCount: 13 },
        ],
      },
      NOW,
    );

    const later = new Date(NOW.getTime() + SNAPSHOT_TTL_MS + 1);
    const aged = freshSnapshot(j.entries[BB], later);
    expect(aged?.statusLabel).toBeUndefined();
    expect(aged?.episodeMinutes).toBe(47);
    expect(aged?.seasonSizes).toEqual([
      { seasonNumber: 1, episodeCount: 7 },
      { seasonNumber: 2, episodeCount: 13 },
    ]);
  });

  it('disparait entierement au plafond contractuel', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    j = setSnapshot(j, BB, SHAPE, NOW);

    const justBefore = new Date(NOW.getTime() + SNAPSHOT_IDENTITY_TTL_MS - 1);
    const justAfter = new Date(NOW.getTime() + SNAPSHOT_IDENTITY_TTL_MS + 1);
    expect(freshSnapshot(j.entries[BB], justBefore)).toBeDefined();
    expect(freshSnapshot(j.entries[BB], justAfter)).toBeUndefined();
  });

  it('le plafond ne depasse jamais les six mois du contrat', () => {
    // `AGENTS.md` regle 1 : irreparable apres coup, donc verifie plutot que commente.
    expect(SNAPSHOT_IDENTITY_TTL_MS).toBeLessThanOrEqual(183 * 86_400_000);
  });

  it('un instantane ne fait pas exister une serie qu on a retiree', () => {
    let j = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    j = setSnapshot(j, BB, SHAPE, NOW);
    j = setWanted(j, BB, false, LATER);
    expect(hasContent(j.entries[BB])).toBe(false);
  });
});

describe('mergeJournals — cinq appareils ne se marchent pas dessus', () => {
  it('fusionne champ par champ, jamais document contre document', () => {
    // Le cas qui fait mal : le matin sur l'ordinateur, le soir sur le telephone.
    // Une fusion « le plus recent gagne » sur le document entier perdrait la
    // position posee le matin.
    const ordinateur = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const telephone = setSeasonRating(EMPTY_JOURNAL, BB, 1, 4.5, LATER);

    const merged = mergeJournals(ordinateur, telephone);
    expect(merged.entries[BB]?.position?.seasonNumber).toBe(3);
    expect(merged.entries[BB]?.seasonRatings?.['1']?.stars).toBe(4.5);
  });

  it('garde la valeur la plus recente pour un meme champ', () => {
    const avant = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    const apres = setPosition(EMPTY_JOURNAL, BB, 4, 2, LATER);

    expect(mergeJournals(avant, apres).entries[BB]?.position).toMatchObject({
      seasonNumber: 4,
      episodeNumber: 2,
    });
    // Symetrique : l'ordre des arguments ne change pas le vainqueur.
    expect(mergeJournals(apres, avant).entries[BB]?.position).toMatchObject({
      seasonNumber: 4,
      episodeNumber: 2,
    });
  });

  it('une suppression ne ressuscite pas', () => {
    // Sans trace datee, l'appareil qui ignore la suppression reimpose sa note a la
    // premiere synchronisation. C'est le defaut classique des fusions naives.
    const note = setSeasonRating(EMPTY_JOURNAL, BB, 2, 4, NOW);
    const efface = setSeasonRating(note, BB, 2, undefined, LATER);

    const merged = mergeJournals(efface, note);
    expect(merged.entries[BB]?.seasonRatings?.['2']).toBeUndefined();
  });

  it('une note reposee apres la suppression, elle, revient', () => {
    const note = setSeasonRating(EMPTY_JOURNAL, BB, 2, 4, NOW);
    const efface = setSeasonRating(note, BB, 2, undefined, LATER);
    const reposee = setSeasonRating(
      efface,
      BB,
      2,
      3,
      new Date(LATER.getTime() + 3_600_000),
    );

    expect(mergeJournals(reposee, note).entries[BB]?.seasonRatings?.['2']?.stars).toBe(3);
  });

  it('reunit les series presentes d un seul cote', () => {
    const a = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    const b = setWanted(EMPTY_JOURNAL, DEXTER, true, NOW);

    const merged = mergeJournals(a, b);
    expect(Object.keys(merged.entries).sort()).toEqual([BB, DEXTER].sort());
  });

  it('garde l appareil local et reunit les plateformes', () => {
    const local = setPlatforms(withDeviceId(EMPTY_JOURNAL, 'ici'), ['Netflix']);
    const autre = setPlatforms(withDeviceId(EMPTY_JOURNAL, 'ailleurs'), ['Netflix', 'Max']);

    const merged = mergeJournals(local, autre);
    expect(merged.deviceId).toBe('ici');
    expect([...(merged.platforms ?? [])].sort()).toEqual(['Max', 'Netflix']);
  });

  it('les traces de suppression finissent par disparaitre', () => {
    // Sans quoi le journal grossirait de tout ce qu'il n'a plus.
    let j = setSeasonRating(EMPTY_JOURNAL, BB, 2, 4, NOW);
    j = setSeasonRating(j, BB, 2, undefined, NOW);

    const raw = serializeJournal(j);
    const avant = new Date(NOW.getTime() + TOMBSTONE_TTL_MS - 1);
    const apres = new Date(NOW.getTime() + TOMBSTONE_TTL_MS + 1);

    expect(parseJournal(raw, avant).entries[BB]?.removed?.['season:2']).toBeDefined();
    // L'entree ne portait plus que cette trace : elle disparait avec elle.
    expect(parseJournal(raw, apres).entries[BB]).toBeUndefined();
  });

  it('fusionner avec soi-meme ne change rien', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 2, 4, NOW);
    j = setSeasonRating(j, BB, 1, 4, NOW);
    j = setEpisodeRating(j, BB, 2, 4, 5, NOW);
    expect(mergeJournals(j, j).entries).toEqual(j.entries);
  });
});

describe('seasonScoresOf', () => {
  it('rend les notes triees, pretes pour le moteur de trajectoire', () => {
    let j = setSeasonRating(EMPTY_JOURNAL, DEXTER, 3, 3.5, NOW);
    j = setSeasonRating(j, DEXTER, 1, 4.5, NOW);
    j = setSeasonRating(j, DEXTER, 2, 4, NOW);

    expect(seasonScoresOf(j, DEXTER)).toEqual([
      { seasonNumber: 1, stars: 4.5 },
      { seasonNumber: 2, stars: 4 },
      { seasonNumber: 3, stars: 3.5 },
    ]);
  });

  it('rend une liste vide pour une serie inconnue', () => {
    expect(seasonScoresOf(EMPTY_JOURNAL, 'tmdb:inconnue')).toEqual([]);
  });
});

describe('le coeur — l attachement, distinct de la note', () => {
  it('se pose, se retire, et ne ressuscite pas depuis un appareil qui l ignorait', () => {
    const liked = setLiked(EMPTY_JOURNAL, BB, true, NOW);
    expect(liked.entries[BB]?.liked?.at).toBe(NOW.toISOString());

    // L'appareil A retire le coeur ; l'appareil B ne l'a jamais vu partir.
    const removed = setLiked(liked, BB, false, LATER);
    expect(mergeJournals(removed, liked).entries[BB]?.liked).toBeUndefined();
    expect(mergeJournals(liked, removed).entries[BB]?.liked).toBeUndefined();
  });

  it('🔴 retirer le coeur ne retire pas « je veux la voir »', () => {
    // Le defaut vise : reutiliser la pierre tombale 'wanted' pour le coeur. Les deux
    // champs ont la meme forme, donc la copie est tentante et le symptome silencieux —
    // un geste en efface un autre, sans erreur.
    let journal = setWanted(EMPTY_JOURNAL, BB, true, NOW);
    journal = setLiked(journal, BB, true, NOW);
    const before = journal;
    journal = setLiked(journal, BB, false, LATER);

    expect(journal.entries[BB]?.liked).toBeUndefined();
    expect(journal.entries[BB]?.wanted?.at).toBe(NOW.toISOString());

    // ⚠️ Les deux assertions ci-dessus ne suffisent PAS : une pierre tombale n'agit qu'a la
    // **fusion**, donc `setLiked(false)` laisserait `wanted` en place dans l'objet meme en
    // visant la mauvaise cle. Sans la ligne qui suit, ce test reste vert sur le defaut qu'il
    // pretend attraper — verifie par mutation, il ne tombait pas.
    const merged = mergeJournals(journal, before);
    expect(merged.entries[BB]?.liked).toBeUndefined();
    expect(merged.entries[BB]?.wanted?.at).toBe(NOW.toISOString());
  });

  it('est du contenu, donc la serie apparait dans la bibliotheque', () => {
    // `hasContent` gouverne l'affichage : un coeur seul doit suffire a faire exister la
    // serie chez soi, sinon le geste est accepte puis invisible.
    const liked = setLiked(EMPTY_JOURNAL, BB, true, NOW);
    expect(hasContent(liked.entries[BB])).toBe(true);

    // Et il survit a l'aller-retour de serialisation.
    expect(parseJournal(serializeJournal(liked), NOW).entries[BB]?.liked?.at).toBe(
      NOW.toISOString(),
    );
  });
});

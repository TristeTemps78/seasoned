import { describe, expect, it } from 'vitest';
import { buildCalendar, type UpcomingEpisode } from '../src/domain/calendar';

const NOW = new Date('2026-08-03T21:00:00Z');

function episode(over: Partial<UpcomingEpisode> = {}): UpcomingEpisode {
  return {
    key: 'tmdb:1396',
    title: 'Breaking Bad',
    airsOn: new Date('2026-08-05T00:00:00Z'),
    seasonNumber: 5,
    episodeNumber: 14,
    ...over,
  };
}

describe('buildCalendar', () => {
  it('ne produit rien plutot qu’un calendrier vide', () => {
    // Proposer le telechargement d'un fichier sans evenement serait une promesse non
    // tenue : l'appelant doit pouvoir cacher le bouton.
    expect(buildCalendar([], NOW)).toBeUndefined();
  });

  it('produit un calendrier que la RFC reconnait', () => {
    const ics = buildCalendar([episode()], NOW)!;
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('DTSTAMP:20260803T210000Z');
  });

  it('termine chaque ligne par CRLF, jamais par LF seul', () => {
    // Le retour a la ligne est normatif. Un fichier en LF s'ouvre chez certains
    // clients et pas chez d'autres — le pire genre de bogue, parce qu'il a l'air de
    // marcher chez celui qui l'ecrit.
    const ics = buildCalendar([episode()], NOW)!;
    const strayLineFeeds = ics.split('\n').filter((part) => !part.endsWith('\r'));
    expect(strayLineFeeds).toEqual(['']);
  });

  it('pose un evenement d’une journee, DTEND exclusif', () => {
    const ics = buildCalendar([episode()], NOW)!;
    expect(ics).toContain('DTSTART;VALUE=DATE:20260805');
    // Le lendemain : `DTEND` est exclusif. Mettre la meme date ferait un evenement de
    // duree nulle, que plusieurs clients n'affichent pas du tout.
    expect(ics).toContain('DTEND;VALUE=DATE:20260806');
  });

  it('echappe les caracteres qui couperaient la valeur en deux champs', () => {
    const ics = buildCalendar(
      [episode({ title: 'Truth; lies, and\\backslash' })],
      NOW,
    )!;
    expect(ics).toContain('SUMMARY:Truth\\; lies\\, and\\\\backslash');
  });

  it('echappe la barre oblique AVANT le reste', () => {
    // Si l'ordre s'inverse, on echappe les echappements qu'on vient d'ecrire et la
    // valeur ressort doublement protegee — donc fausse a la lecture.
    const ics = buildCalendar([episode({ title: 'A\\,B' })], NOW)!;
    expect(ics).toContain('SUMMARY:A\\\\\\,B');
  });

  it('plie les lignes trop longues, en comptant les OCTETS', () => {
    // 70 caracteres accentues = 140 octets : une limite comptee en caracteres
    // laisserait passer la ligne, et le fichier serait rejete.
    const ics = buildCalendar([episode({ title: 'é'.repeat(70) })], NOW)!;
    const encoder = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Et le pliage se fait bien par une continuation, pas par une troncature.
    expect(ics).toContain('\r\n ');
  });

  it('donne a chaque episode un UID stable', () => {
    // Sans identifiant deterministe, chaque reimport duplique au lieu de mettre a
    // jour : le calendrier devient inutilisable en trois visites.
    const first = buildCalendar([episode()], NOW)!;
    const later = buildCalendar([episode()], new Date('2026-09-01T08:00:00Z'))!;
    const uid = (ics: string) => /UID:(.+)\r\n/.exec(ics)?.[1];
    expect(uid(first)).toBe(uid(later));
    expect(uid(first)).toContain('tmdb:1396');
  });

  it('distingue deux episodes de la meme serie', () => {
    const ics = buildCalendar(
      [episode(), episode({ episodeNumber: 15, airsOn: new Date('2026-08-12T00:00:00Z') })],
      NOW,
    )!;
    const uids = [...ics.matchAll(/UID:(.+)\r\n/g)].map((m) => m[1]);
    expect(new Set(uids).size).toBe(2);
  });

  it('range les episodes par date, quel que soit l’ordre d’entree', () => {
    const ics = buildCalendar(
      [
        episode({ airsOn: new Date('2026-09-01T00:00:00Z'), episodeNumber: 16 }),
        episode({ airsOn: new Date('2026-08-05T00:00:00Z'), episodeNumber: 14 }),
      ],
      NOW,
    )!;
    expect(ics.indexOf('20260805')).toBeLessThan(ics.indexOf('20260901'));
  });

  it('ecarte une date illisible sans perdre le reste', () => {
    // Un `DTSTART` invalide ferait rejeter le fichier ENTIER par le client. Un episode
    // perdu vaut mieux qu'un calendrier perdu.
    const ics = buildCalendar(
      [episode({ airsOn: new Date('pas une date') }), episode({ title: 'Severance' })],
      NOW,
    )!;
    expect(ics).toContain('Severance');
    expect(ics).not.toContain('NaN');
    expect([...ics.matchAll(/BEGIN:VEVENT/g)]).toHaveLength(1);
  });

  it('se passe du numero d’episode quand on ne l’a pas', () => {
    const ics = buildCalendar(
      [{ key: 'tmdb:42', title: 'Severance', airsOn: new Date('2026-08-05T00:00:00Z') }],
      NOW,
    )!;
    expect(ics).toContain('SUMMARY:Severance\r\n');
  });
});

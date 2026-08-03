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

// ---------------------------------------------------------------------------
// Le rappel — le defaut du 2026-08-03
// ---------------------------------------------------------------------------
//
// Pendant deux jours, ce module ecrivait des `VEVENT` sans aucun `VALARM` : les dates
// arrivaient dans l'agenda et RIEN ne sonnait. Les treize tests au-dessus etaient verts,
// parce qu'aucun ne demandait la seule chose que la feature promet.
//
// La lecon, qui vaut au-dela d'ici : **tous ces tests verifiaient la conformite du
// fichier, aucun ne verifiait son effet.** Un `.ics` valide qui ne rappelle rien est
// exactement ce que « auditer le resultat, jamais l'intention » vise.
describe('buildCalendar — le rappel', () => {
  it('pose un rappel sur chaque episode', () => {
    // 🔴 CE TEST AURAIT ATTRAPE LE DEFAUT D'ORIGINE. Il n'existait pas.
    const ics = buildCalendar(
      [episode(), episode({ episodeNumber: 15, airsOn: new Date('2026-08-12T00:00:00Z') })],
      NOW,
    )!;
    expect([...ics.matchAll(/BEGIN:VALARM/g)]).toHaveLength(2);
    expect([...ics.matchAll(/END:VALARM/g)]).toHaveLength(2);
  });

  it('declenche DANS la journee de diffusion, pas a 23 h la veille', () => {
    // Le coeur du sujet. `DTSTART` d'un evenement de journee entiere vaut minuit : un
    // « une heure avant » (`-PT1H`) sonnerait la veille au soir — precisement le rappel
    // nocturne que le choix de la journee entiere cherchait a eviter.
    const ics = buildCalendar([episode()], NOW)!;
    expect(ics).toContain('TRIGGER;RELATED=START:PT9H');
    expect(ics).not.toContain('TRIGGER;RELATED=START:-');
    expect(ics).not.toMatch(/TRIGGER[^\r\n]*:-P/);
  });

  it('porte une DESCRIPTION, que la RFC exige sur une alarme DISPLAY', () => {
    // Sans elle, des clients rejettent le fichier ENTIER : ajouter un rappel ferait
    // perdre les dates. L'inverse du but.
    const ics = buildCalendar([episode()], NOW)!;
    const alarm = /BEGIN:VALARM\r\n([\s\S]*?)END:VALARM/.exec(ics)?.[1] ?? '';
    expect(alarm).toContain('ACTION:DISPLAY');
    expect(alarm).toMatch(/DESCRIPTION:.+/);
  });

  it('echappe la DESCRIPTION comme le SUMMARY', () => {
    // Meme piege que le titre : une virgule non echappee coupe la valeur en deux champs.
    // Le defaut serait ici plus vicieux, parce qu'il ne se voit pas dans le titre affiche.
    const ics = buildCalendar([episode({ title: 'Truth; lies, and\\backslash' })], NOW)!;
    expect(ics).toContain('DESCRIPTION:Truth\\; lies\\, and\\\\backslash');
  });

  it('garde le VALARM DANS le VEVENT', () => {
    // Un `VALARM` pose entre deux `VEVENT` ferait rejeter le fichier. L'ordre des
    // `lines.push` est la seule chose qui le garantit, et rien d'autre ne le surveille.
    const ics = buildCalendar([episode()], NOW)!;
    const event = /BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/.exec(ics)?.[1] ?? '';
    expect(event).toContain('BEGIN:VALARM');
    expect(event).toContain('END:VALARM');
  });

  it('annonce une revision, pour atteindre ceux qui ont deja importe', () => {
    // Sans `SEQUENCE` superieure, des clients gardent la version connue de l'`UID` — donc
    // le rappel n'arriverait qu'aux nouveaux, jamais a ceux qui ont deja le fichier muet.
    const ics = buildCalendar([episode()], NOW)!;
    expect(ics).toContain('SEQUENCE:1');
  });

  it('sait se taire quand on le lui demande', () => {
    // Un agenda partage est un cas legitime : y deposer quarante alarmes concerne des
    // gens qui n'ont rien demande.
    const ics = buildCalendar([episode()], NOW, { remind: false })!;
    expect(ics).not.toContain('VALARM');
    // Et les dates, elles, restent.
    expect(ics).toContain('DTSTART;VALUE=DATE:20260805');
  });

  it('reste plie a 75 octets, alarme comprise', () => {
    // La `DESCRIPTION` reprend le titre : un titre long depasse la limite par cette
    // ligne-la aussi, et le pliage doit s'y appliquer.
    const ics = buildCalendar([episode({ title: 'é'.repeat(70) })], NOW)!;
    const encoder = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

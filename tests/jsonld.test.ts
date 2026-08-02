import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../lib/jsonld';

/**
 * La serialisation du bloc de donnees structurees.
 *
 * Ce n'est pas un test de format, c'est un test de **securite**. Le titre d'une serie
 * vient de TMDB, alimente par des contributeurs : au sens de la securite, c'est une
 * entree non fiable, exactement comme un champ rempli par un visiteur.
 */
describe('serializeJsonLd', () => {
  it('empeche un titre de refermer la balise script', () => {
    // Le vecteur reel. Sans echappement, tout ce qui suit `</script>` s'execute — sur
    // toutes les pages servies depuis le cache de bord, donc pour tous les visiteurs,
    // et avec acces au journal personnel range dans `localStorage`.
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script');
  });

  it('reste strictement equivalent apres analyse', () => {
    // La parade ne doit rien couter au referencement : Google doit lire exactement la
    // meme fiche. `<` **est** `<` dans une chaine JSON.
    const value = { name: 'A & B <C>', description: 'Guillemets "et" apostrophes ’' };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });

  it('echappe les separateurs de ligne que JSON laisse passer', () => {
    // U+2028 et U+2029 terminent une ligne pour un analyseur JavaScript alors que JSON
    // les accepte tels quels : ils cassent le script sans meme qu'il y ait d'intention.
    // Construits par point de code — les ecrire en clair casserait ce fichier aussi.
    const separators = `${String.fromCodePoint(0x2028)}${String.fromCodePoint(0x2029)}`;
    const name = `a${separators}b`;
    const out = serializeJsonLd({ name });
    expect(out).not.toContain(String.fromCodePoint(0x2028));
    expect(out).not.toContain(String.fromCodePoint(0x2029));
    expect(JSON.parse(out)).toEqual({ name });
  });

  it('laisse intact ce qui n’a rien de dangereux', () => {
    expect(serializeJsonLd({ '@type': 'TVSeries', name: 'Breaking Bad' })).toBe(
      '{"@type":"TVSeries","name":"Breaking Bad"}',
    );
  });
});

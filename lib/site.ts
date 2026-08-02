/**
 * Le nom du produit — **le seul endroit ou il s'ecrit**.
 *
 * `VOLTFACE`, tranche par Tristan le 2026-08-03 (arbitrage A4, ouvert cinq sessions).
 * *Volte-face* est un revirement d'opinion : c'est la promesse du produit mot pour mot —
 * garder la trace de ce qu'on a pense d'une serie **dans le temps**. Il porte aussi la
 * direction artistique (**volt**) et le logo (**face**, les faces du cube).
 *
 * Il etait auparavant ecrit en dur a sept endroits — en-tete, metadonnees, manifeste,
 * partage. Un nom de produit change ; sept copies d'un nom de produit changent mal.
 *
 * ⚠️ **Ne jamais s'en servir pour fabriquer une cle de stockage ni un identifiant.** Ce
 * qui est deja ecrit chez l'utilisateur ne suit pas les renommages : voir
 * `src/journal/local.ts` (migre, parce qu'on le controle) et `src/domain/calendar.ts`
 * (inchange, parce qu'il est parti dans l'agenda de quelqu'un d'autre).
 */
export const PRODUCT_NAME = 'Voltface';

/** URL publique du site, pour les URL canoniques, `robots.txt` et le sitemap. */
export function siteUrl(): string {
  const explicit = process.env['NEXT_PUBLIC_SITE_URL'];
  if (explicit !== undefined && explicit.trim().length > 0) {
    return explicit.replace(/\/$/, '');
  }
  // Fourni automatiquement par Vercel sur les previews et la production.
  const vercel = process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL'];
  if (vercel !== undefined && vercel.trim().length > 0) return `https://${vercel}`;

  return 'http://localhost:3000';
}

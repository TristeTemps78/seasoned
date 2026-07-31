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

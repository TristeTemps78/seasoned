import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Sitemap des pages fixes uniquement.
 *
 * Les pages serie en sont volontairement absentes en phase 1. Les y mettre supposerait
 * d'enumerer le catalogue TMDB — ce que leurs conditions n'autorisent pas et que le
 * budget interdit (`ROADMAP.md` §1.3 et §1.4). Elles seront decouvertes par les liens,
 * et le sitemap ne listera que les series **que nous connaissons parce que quelqu'un
 * les a consultees ou notees** — c'est-a-dire a partir de la phase 2, quand il y aura
 * une base.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}

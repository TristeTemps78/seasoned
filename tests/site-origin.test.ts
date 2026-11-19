import { afterEach, expect, it, vi } from 'vitest';
import { siteUrl } from '../lib/site';
import robots from '../app/robots';

afterEach(() => vi.unstubAllEnvs());

it('annonce le domaine de marque même quand Vercel expose son ancien hôte', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'seasoned-two.vercel.app');
  expect(siteUrl()).toBe('https://www.voltface.app');
  expect(robots().sitemap).toBe('https://www.voltface.app/sitemap.xml');
});

it('conserve une URL de configuration explicite', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test/');
  vi.stubEnv('VERCEL', '1');
  expect(siteUrl()).toBe('https://example.test');
});

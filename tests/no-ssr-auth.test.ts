import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ⛔ L'authentification ne doit **jamais** rendre une route dynamique.
 *
 * Ce fichier existe contre un reflexe, pas contre une erreur d'inattention. Tous les
 * guides Supabase pour Next.js prescrivent `@supabase/ssr` + un `middleware.ts` qui
 * rafraichit la session a chaque requete. C'est le conseil par defaut, il est
 * partout, et **il est faux ici** — un agent futur (ou moi dans trois semaines) l'installera
 * de bonne foi.
 *
 * Ce que ca couterait, mesure trois fois dans ce depot :
 *
 * - `app/(site)/serie/[id]/page.tsx` — verifie en production le 2026-08-02 : une route
 *   dynamique repond `X-Vercel-Cache: MISS` et `Cache-Control: no-store` la ou une route
 *   statique repond `PRERENDER`. **Le cache de bord ne s'applique plus du tout** ;
 * - `lib/routes.ts` — un middleware s'execute a *chaque* requete, y compris celles que le
 *   CDN servirait sans nous : une invocation facturee par visite ;
 * - `next.config.ts` — le nonce CSP a ete refuse pour exactement cette raison.
 *
 * Or le cache est ce qui tient le budget, et le budget est ce qui a tue TV Time.
 *
 * Le test lit les **sources**, comme `no-hardcoded-strings` et `no-journal-on-server` :
 * c'est le seul moyen d'attraper une dependance qui n'aurait pas encore d'appelant.
 */

const ROOTS = ['app', 'src', 'lib'] as const;

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const FILES = ROOTS.flatMap((root) => sourceFiles(root));

/**
 * Le code seul, sans les commentaires.
 *
 * ⚠️ **Indispensable ici, et le test l'a prouve en echouant sur ses propres cibles.** Ce
 * depot documente abondamment *pourquoi* `@supabase/ssr` est refuse : chercher la chaine
 * brute accusait donc `src/auth/client.ts` et `AuthCallback.tsx`, dont le seul tort est
 * d'expliquer l'interdiction.
 *
 * C'est exactement le defaut deja consigne le 2026-08-03 : un `grep -c "use client"` qui
 * comptait les mots **dans les commentaires** et « prouvait » l'inverse de la realite.
 * *Une verification mal ancree est pire qu'aucune.*
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('⛔ rien ne rend le site dynamique pour authentifier', () => {
  it('garde-fou : le test regarde bien des fichiers', () => {
    // Sans lui, un chemin devenu faux rendrait tout ce fichier vert pour la pire raison
    // qui soit. Meme precaution que `no-hardcoded-strings`.
    expect(FILES.length).toBeGreaterThan(40);
  });

  it('⛔ aucun module ne depend de @supabase/ssr', () => {
    const guilty = FILES.filter((file) => code(file).includes('@supabase/ssr'));
    expect(guilty).toEqual([]);
  });

  it('⛔ package.json ne declare pas @supabase/ssr', () => {
    // La dependance peut arriver avant son premier import — l'attraper la aussi.
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).not.toContain('@supabase/ssr');
  });

  it('⛔ il n existe aucun middleware', () => {
    const middlewares = FILES.filter((file) => /(^|[\\/])middleware\.tsx?$/.test(file));
    expect(middlewares).toEqual([]);
  });

  it('⛔ l authentification n a introduit aucune route serveur', () => {
    // Zero `route.ts` dans tout le projet, et c'est un fait dont `TASKS.md` se sert pour
    // chiffrer les propositions (« la premiere route serveur du projet »). Le retour du
    // lien magique n'en a pas besoin : le navigateur a le code ET le verificateur.
    const routes = FILES.filter((file) => /(^|[\\/])route\.tsx?$/.test(file));
    expect(routes).toEqual([]);
  });

  it('les pages du compte sont statiques', () => {
    for (const page of [
      'app/(site)/compte/page.tsx',
      'app/(site)/compte/retour/page.tsx',
      'app/(fr)/fr/compte/page.tsx',
      'app/(fr)/fr/compte/retour/page.tsx',
    ]) {
      expect(readFileSync(page, 'utf8'), page).toContain("dynamic = 'force-static'");
    }
  });
});

describe('un seul module connait la forme de l authentification', () => {
  it('⚠️ rien hors de src/auth n importe le SDK', () => {
    // `AGENTS.md` regle 3, appliquee a l'identite comme au catalogue : changer de
    // fournisseur doit rester un module a reecrire.
    const guilty = FILES.filter(
      (file) =>
        !file.replace(/\\/g, '/').startsWith('src/auth/') &&
        /@supabase\/(auth-js|supabase-js)/.test(code(file)),
    );
    expect(guilty).toEqual([]);
  });
});

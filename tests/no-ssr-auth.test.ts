import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, codeOf, filesUnder, pathOf } from './sources';
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

/**
 * Le parcours et le retrait des commentaires viennent de `./sources`.
 *
 * ⚠️ **Le retrait des commentaires est indispensable ici, et le test l'a prouve en
 * echouant sur ses propres cibles.** Ce depot documente abondamment *pourquoi*
 * `@supabase/ssr` est refuse : chercher la chaine brute accusait donc `src/auth/client.ts`
 * et `AuthCallback.tsx`, dont le seul tort est d'expliquer l'interdiction. C'est le meme
 * defaut que le `grep -c "use client"` du 2026-08-03, qui comptait les mots dans les
 * commentaires et « prouvait » l'inverse de la realite.
 *
 * 🔴 **Et les chemins etaient relatifs au repertoire courant** (`sourceFiles('app')`,
 * `readFileSync('package.json')`), alors que `no-adhoc-typography` ecrit que
 * « `readdirSync('app')` cassait au premier deplacement ». `ROOT` est derive du fichier.
 */
const FILES = ['app', 'src', 'lib'].flatMap((root) =>
  filesUnder(root).map((file) => ({ path: pathOf(file), code: codeOf(file) })),
);

describe('⛔ rien ne rend le site dynamique pour authentifier', () => {
  it('garde-fou : le test regarde bien des fichiers', () => {
    // Sans lui, un chemin devenu faux rendrait tout ce fichier vert pour la pire raison
    // qui soit. Meme precaution que `no-hardcoded-strings`.
    expect(FILES.length).toBeGreaterThan(40);
  });

  it('⛔ aucun module ne depend de @supabase/ssr', () => {
    const guilty = FILES.filter(({ code }) => code.includes('@supabase/ssr'));
    expect(guilty.map(({ path }) => path)).toEqual([]);
  });

  it('⛔ package.json ne declare pas @supabase/ssr', () => {
    // La dependance peut arriver avant son premier import — l'attraper la aussi.
    const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
    expect(pkg).not.toContain('@supabase/ssr');
  });

  it('⛔ il n existe aucun middleware', () => {
    const middlewares = FILES.filter(({ path }) => /(^|\/)middleware\.tsx?$/.test(path));
    expect(middlewares.map(({ path }) => path)).toEqual([]);
  });

  it('⛔ l authentification n a introduit aucune route serveur', () => {
    // Zero `route.ts` dans tout le projet, et c'est un fait dont `TASKS.md` se sert pour
    // chiffrer les propositions (« la premiere route serveur du projet »). Le retour du
    // lien magique n'en a pas besoin : le navigateur a le code ET le verificateur.
    const routes = FILES.filter(({ path }) => /(^|\/)route\.tsx?$/.test(path));
    expect(routes.map(({ path }) => path)).toEqual([]);
  });

  it('les pages du compte sont statiques', () => {
    for (const page of [
      'app/(site)/compte/page.tsx',
      'app/(site)/compte/retour/page.tsx',
      'app/(fr)/fr/compte/page.tsx',
      'app/(fr)/fr/compte/retour/page.tsx',
    ]) {
      expect(readFileSync(join(ROOT, page), 'utf8'), page).toContain("dynamic = 'force-static'");
    }
  });
});

describe('un seul module connait la forme de l authentification', () => {
  it('⚠️ rien hors de src/auth n importe le SDK', () => {
    // `AGENTS.md` regle 3, appliquee a l'identite comme au catalogue : changer de
    // fournisseur doit rester un module a reecrire.
    const guilty = FILES.filter(
      ({ path, code }) =>
        !path.startsWith('src/auth/') && /@supabase\/(auth-js|supabase-js)/.test(code),
    );
    expect(guilty.map(({ path }) => path)).toEqual([]);
  });
});

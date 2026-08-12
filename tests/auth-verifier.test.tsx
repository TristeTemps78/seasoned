import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finishSignIn, type AuthConfig } from '@/src/auth/client';

/**
 * Le diagnostic du retour de lien — « expire » ou « ouvert ailleurs ».
 *
 * ## Pourquoi ce fichier est en `.tsx` alors qu'il ne rend aucun composant
 *
 * Le decoupage de `vitest.config.ts` n'est pas « composants / reste » mais **« DOM / pas de
 * DOM »**, et il est deliberement severe : le domaine tourne sous `node` pour que toucher
 * `window` y devienne une erreur executee. Or `src/auth/client.ts` est du code de
 * navigateur — sa raison d'etre est que *« la session vit dans le navigateur, et le serveur
 * ne la voit jamais »*. Le tester sans `localStorage` reviendrait a tester la branche du
 * `catch`.
 *
 * ## 🔴 Ce que ces trois tests gardent, mesure au navigateur le 2026-08-12
 *
 * Deux defauts empiles rendaient le message de retour faux dans **tous** les cas d'echec.
 *
 * 1. `hasVerifier()` etait appele **apres** `exchangeCodeForSession`. Or une tentative
 *    d'echange supprime le verificateur du `localStorage`, **y compris quand elle echoue** —
 *    verifie en ouvrant `/fr/compte/retour?code=<au hasard>` : la cle temoin posee juste
 *    avant avait disparu ensuite. La reponse etait donc « pas de verificateur » quel que
 *    soit le vrai cas.
 * 2. Il ne cherchait que `voltface.auth.v1-code-verifier`. `@supabase/auth-js` range un
 *    verificateur **par flux** depuis qu'il en supporte plusieurs, et le releve sur ce poste
 *    en montrait quatre : deux `…-flow-<etat>-code-verifier`, la cle historique, et l'index
 *    `…-flows-code-verifier`.
 *
 * Consequence : « ce lien a ete ouvert dans un autre navigateur » — le seul message qui
 * n'invite PAS a redemander un lien — etait servi a quelqu'un dont le lien avait simplement
 * expire. C'est-a-dire le conseil exactement inverse de celui dont il avait besoin.
 */

/**
 * Le double du SDK.
 *
 * ⚠️ Il **supprime les verificateurs** avant de rendre son erreur, parce que c'est ce que
 * fait le vrai — et c'est toute la subtilite du defaut n°1. Un double qui les laisserait en
 * place ferait passer l'ancienne version du code, donc ne garderait rien.
 */
vi.mock('@supabase/auth-js', () => ({
  AuthClient: class {
    async exchangeCodeForSession(_code: string) {
      for (const key of Object.keys(localStorage)) {
        if (key.endsWith('code-verifier')) localStorage.removeItem(key);
      }
      return { data: null, error: { message: 'invalid request: both auth code and code verifier should be non-empty' } };
    }
  },
  navigatorLock: () => undefined,
}));

const CONFIG: AuthConfig = { url: 'https://exemple.supabase.co', anonKey: 'publique' };
const RETOUR = 'https://voltface.test/fr/compte/retour?code=abc123';

describe('le diagnostic du retour de lien', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('🔴 un echec avec verificateur dit « expire », pas « autre navigateur »', async () => {
    localStorage.setItem('voltface.auth.v1-code-verifier', 'temoin');

    const outcome = await finishSignIn(CONFIG, RETOUR);

    expect(outcome.kind, 'le verificateur etait la : le lien est expire, pas egare').toBe(
      'expired',
    );
  });

  it('🔴 la cle par flux compte autant que la cle historique', async () => {
    // La forme reellement observee dans ce navigateur — celle que l'ancienne version ne
    // regardait pas.
    localStorage.setItem('voltface.auth.v1-flow-192c08bf77545d393c4cc5746bcad0bb-code-verifier', 'temoin');

    const outcome = await finishSignIn(CONFIG, RETOUR);

    expect(outcome.kind).toBe('expired');
  });

  it('sans aucun verificateur, le lien vient bien d un autre navigateur', async () => {
    // Le seul echec **normal** de PKCE, et le seul cas ou ce message doit sortir.
    const outcome = await finishSignIn(CONFIG, RETOUR);

    expect(outcome.kind).toBe('wrong_browser');
  });

  it('une URL sans code ne pretend rien echanger', async () => {
    localStorage.setItem('voltface.auth.v1-code-verifier', 'temoin');

    const outcome = await finishSignIn(CONFIG, 'https://voltface.test/fr/compte/retour');

    expect(outcome.kind).toBe('nothing_to_do');
  });

  it('une erreur annoncee dans l URL se lit sans tenter d echange', async () => {
    // Supabase renvoie `?error_code=otp_expired` quand il a lui-meme refuse le jeton : il
    // n'y a pas de code a echanger, et le dire « rien a valider » serait faux.
    const outcome = await finishSignIn(
      CONFIG,
      'https://voltface.test/fr/compte/retour?error_code=otp_expired&error=access_denied',
    );

    expect(outcome.kind).toBe('expired');
  });
});

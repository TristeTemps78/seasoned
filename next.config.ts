import type { NextConfig } from 'next';

/**
 * Le point important de ce fichier n'est pas la configuration : c'est le **budget**.
 *
 * `ROADMAP.md` §1.4 — le succes inattendu ne doit pas couter cher. TV Time est mort
 * avec 26,4 M d'installations en disant que ce n'etait soutenable ni en gratuit ni en
 * payant. On ne peut pas resoudre le revenu aujourd'hui ; on peut resoudre le cout, et
 * c'est la seule position qui ne ferme aucune option de monetisation (arbitrage A6).
 */
const nextConfig: NextConfig = {
  // Les affiches sont servies par le CDN de TMDB, jamais par nous : pas d'optimisation
  // d'images cote serveur. C'est une ligne du budget, pas une economie de configuration —
  // optimiser des images qu'un CDN sert deja gratuitement serait payer deux fois.
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }],
  },

  // Le depot est destine a etre public et la CI verifie deja types et tests :
  // on ne veut pas d'un second typecheck qui masque un echec de build.
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,

  /**
   * Les en-tetes de securite — et l'arbitrage qu'ils imposent ici.
   *
   * Aucun n'etait servi : verifie sur la reponse reelle, pas dans la configuration.
   *
   * ## ⛔ Pourquoi la CSP n'a PAS de nonce, alors que c'est la bonne pratique
   *
   * Une politique a nonce est la seule qui neutralise vraiment le script injecte. Elle
   * exige de generer une valeur differente **a chaque reponse**, donc de rendre la page
   * a chaque requete — ce qui **detruit le cache de bord**, c'est-a-dire la chose meme
   * qui tient le budget (`ROADMAP.md` §1.4, et l'audit du 2026-08-02 qui a trouve les
   * pages serie en `MISS`). Payer une invocation par visite pour durcir un site qui ne
   * traite aucun mot de passe et n'heberge aucune donnee serait exactement l'erreur qui
   * a tue TV Time.
   *
   * L'arbitrage est donc explicite : **`script-src` reste permissif, tout le reste est
   * ferme.** Ce n'est pas une CSP complete, et c'est nettement mieux que rien —
   * `frame-ancestors`, `base-uri`, `form-action` et `object-src` coupent des vecteurs
   * reels sans rien couter. La voie propre pour le script injecte est ailleurs, et elle
   * est prise : `lib/jsonld.ts` echappe le seul endroit ou du contenu tiers entre dans
   * une balise `<script>`.
   *
   * ## `Referrer-Policy` n'est pas cosmetique ici
   *
   * Une URL de ce site dit **ce que quelqu'un est en train de regarder**. La laisser
   * partir en entier vers chaque domaine tiers contacte revient a diffuser un historique
   * de visionnage a des gens qui ne l'ont pas demande.
   */
  async headers() {
    // L'origine du projet Supabase, derivee de l'URL publique. On ouvre la CSP vers
    // **cet hote precis**, jamais vers `*.supabase.co` : un joker autoriserait le
    // navigateur a parler au projet de n'importe qui, ce qui est exactement le genre de
    // permission qu'une injection cherche.
    const supabaseOrigin = ((): string | undefined => {
      const raw = process.env['NEXT_PUBLIC_SUPABASE_URL'];
      if (raw === undefined || raw.trim().length === 0) return undefined;
      try {
        return new URL(raw).origin;
      } catch {
        // URL illisible : on ne fabrique pas une directive a partir d'une valeur qu'on
        // ne comprend pas — la CSP resterait ouverte sur une chaine arbitraire.
        return undefined;
      }
    })();

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Redondant avec `frame-ancestors` pour les navigateurs recents, utile pour
          // les anciens : le clickjacking est un vecteur reel ici, puisqu'un clic sur
          // nos boutons ecrit dans le journal de la personne.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Rien de tout cela n'est utilise, et ce qu'on n'utilise pas doit etre refuse
          // plutot que laisse disponible a qui trouverait comment l'appeler.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Voir l'arbitrage ci-dessus : le nonce couterait le cache.
              "script-src 'self' 'unsafe-inline'",
              // Tailwind pose des styles en ligne.
              "style-src 'self' 'unsafe-inline'",
              // Les affiches viennent du CDN de TMDB, jamais de nous.
              "img-src 'self' https://image.tmdb.org data: blob:",
              "font-src 'self'",
              // ⚠️ **La ligne qui a change de sens le 2026-08-03.**
              //
              // Elle disait « le produit ne parle a aucun service tiers depuis le
              // navigateur », et c'etait la forme *executable* de la promesse « rien ne
              // sort d'ici » : n'importe qui pouvait la lire dans l'inspecteur.
              //
              // Les comptes la rouvrent, mais **vers un seul hote** — celui du projet, et
              // rien d'autre. Ce n'est plus une preuve que rien ne sort ; c'est une preuve
              // que rien ne va **ailleurs** que chez nous, ce qui reste verifiable et
              // reste utile.
              //
              // Tant que la variable est absente, la CSP conserve sa forme la plus
              // stricte : on n'ouvre pas « au cas ou ».
              `connect-src 'self'${supabaseOrigin === undefined ? '' : ` ${supabaseOrigin}`}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

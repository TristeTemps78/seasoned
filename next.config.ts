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
};

export default nextConfig;

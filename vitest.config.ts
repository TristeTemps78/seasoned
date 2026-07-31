import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Meme alias que `tsconfig.json` : les tests doivent resoudre les imports
    // exactement comme le bundler, sinon ils valident un graphe qui n'existe pas.
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

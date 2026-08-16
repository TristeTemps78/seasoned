'use client';

// ⚠️ **La directive est obligatoire ici, et `no-journal-on-server` l'a exigee tout de suite.**
// Ce module ne rend rien, mais il nomme `Journal` : un composant serveur qui l'importerait
// lirait le journal de quelqu'un dans du HTML mis en cache au bord et **partage entre tous
// les visiteurs**. La garde ne regarde pas si l'import est un type — et elle a raison, parce
// que la prochaine version de ce fichier pourrait ne plus l'etre.
//
// ⚠️ En premiere ligne, avant meme ce commentaire : `CLIENT_MARK` est ancre sur le debut du
// fichier, et Next.js exige la meme chose.

import { type Journal } from '@/src/domain/journal';
import { type ListEntry } from '@/src/social/client';

/**
 * Sous quel nom et quelle affiche montrer une serie rangee dans une liste.
 *
 * ## 🔴 L'ordre de repli EST la correction, et il se lit ici une seule fois
 *
 * Avant `020`, les trois rendus de listes — l'apercu d'une carte, le contenu deplie, la
 * vitrine de `/listes` — resolvaient chacun le titre depuis le journal **du lecteur**, avec
 * « Tracked series » en repli. Consequence mesuree au navigateur le 2026-08-16 : une liste
 * faite de series qu'on ne suit pas, c'est-a-dire **toute liste qu'on decouvre**, s'affichait
 * comme quatre fois le meme mot et quatre monogrammes.
 *
 * L'ordre juste, et pourquoi :
 *
 * 1. **L'instantane de la ligne** — le titre que la personne avait sous les yeux en rangeant
 *    la serie. C'est le seul qui marche pour un lecteur qui decouvre.
 * 2. **Le journal du lecteur** — pour le fond range avant `020`, qui n'a pas d'instantane et
 *    n'en aura jamais (`addToList` ecrit en `ignore-duplicates`). Chez soi, il comble.
 * 3. **Le repli traduit** — quand personne ne sait, on ne fabrique pas un nom.
 *
 * ⚠️ **Une seule copie, dans un fichier a part.** Trois copies de cet ordre finiraient par se
 * repondre differemment le jour ou l'une serait corrigee : c'est litteralement ce que `018` a
 * produit en nommant deux tables sur trois, et ce que ce fichier existe pour empecher.
 *
 * ⚠️ L'affiche suit le **meme** ordre, et separement du titre : une ligne peut porter un
 * titre sans affiche (`poster_path` est nullable), et le lecteur peut avoir l'affiche d'une
 * serie dont la ligne ne porte rien.
 */
export function resolveListEntry(
  entry: ListEntry,
  journal: Journal,
  fallbackTitle: string,
): { readonly title: string; readonly posterPath: string | undefined } {
  const mine = journal.entries[entry.subject]?.snapshot;
  return {
    title: entry.title ?? mine?.title ?? fallbackTitle,
    posterPath: entry.posterPath ?? mine?.posterPath,
  };
}

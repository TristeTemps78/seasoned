'use client';

import { useState } from 'react';

import { useT } from '@/app/i18n/LocaleProvider';
import { PRODUCT_NAME } from '@/lib/site';

const WIDTH = 1080;
const HEIGHT = 1080;

/**
 * Ma critique, en image.
 *
 * ## 🔴 On ne partage que **la sienne**, et cette seule regle ferme tous les pieges
 *
 * Le reflexe serait un bouton sur chaque critique. Il ouvrirait trois problemes d'un coup :
 *
 *   - **le spoiler** — une critique masquee par `redactReviews` redeviendrait lisible en
 *     image, sans le volet qui la protege, et l'image circulerait sans contexte ;
 *   - **le texte d'autrui** — reprendre les mots de quelqu'un dans une image que l'on
 *     diffuse est autre chose que les lire sur sa page ;
 *   - **la moderation** — une image sortie du produit ne peut plus etre masquee, alors que
 *     `/regles` promet exactement l'inverse (« on masque, on ne supprime jamais »).
 *
 * N'exposer le bouton que sur ses propres critiques ferme les trois **par construction**,
 * sans une regle de plus a maintenir. C'est aussi le geste qui a du sens : on partage ce
 * qu'on a ecrit.
 *
 * ## Pourquoi un canvas, encore
 *
 * Meme raisonnement que {@link ShareCard} : une route `ImageResponse` couterait une
 * invocation **par partage** — mettre une facture sur le geste viral d'un produit gratuit
 * est le mecanisme exact qui a tue TV Time — et il faudrait faire passer le texte par
 * l'URL, donc le journaliser partout ou elle passe.
 *
 * ## Carre, et pas 1200×630
 *
 * `ShareCard` vise l'apercu d'un lien. Une critique se lit, donc elle va la ou on regarde
 * des images : le carre est le format des reseaux ou l'on s'arrete sur du texte.
 */
export function ShareReview({
  title,
  handle,
  text,
}: {
  readonly title: string;
  readonly handle: string;
  readonly text: string;
}) {
  const { t } = useT();
  const [done, setDone] = useState(false);

  const draw = () => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    // Meme charte que `globals.css` : l'image appartient au meme systeme visuel.
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const margin = 90;
    const inner = WIDTH - margin * 2;

    ctx.fillStyle = '#e6e9ef';
    ctx.font = '600 56px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(truncate(ctx, title, inner), margin, 150);

    ctx.fillStyle = '#8b94a7';
    ctx.font = '400 30px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`@${handle}`, margin, 200);

    // Le texte, mis en lignes. ⚠️ **Tronque plutot que deborde** : une image dont la fin
    // est coupee au ras du bord ressemble a un bug, pas a un extrait.
    ctx.fillStyle = '#e6e9ef';
    ctx.font = '400 40px ui-sans-serif, system-ui, sans-serif';
    const lineHeight = 58;
    const top = 300;
    const maxLines = Math.floor((HEIGHT - top - 140) / lineHeight);
    const lines = wrap(ctx, text, inner, maxLines);
    for (const [index, line] of lines.entries()) {
      ctx.fillText(line, margin, top + index * lineHeight);
    }

    ctx.fillStyle = '#8b94a7';
    ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(PRODUCT_NAME.toLowerCase(), margin, HEIGHT - 70);

    canvas.toBlob((blob) => {
      if (blob === null) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug(title)}-critique.png`;
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    }, 'image/png');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={draw}
        className="rounded-full border border-(--color-edge) px-3 py-1.5 text-xs hover:border-(--color-muted)"
      >
        {t('shareReview.save')}
      </button>
      {done ? (
        <span aria-live="polite" className="text-xs text-(--color-live)">
          {t('share.saved')}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Coupe un texte en lignes qui tiennent dans `max`, sans depasser `maxLines`.
 *
 * ⚠️ Coupe **aux mots**, et pose une ellipse quand il reste du texte : une image qui
 * s'arrete au milieu d'un mot se lit comme un defaut d'affichage.
 */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  maxLines: number,
): readonly string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= max) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && current !== '') lines.push(current);

  // Il reste du texte : on le dit par une ellipse plutot que de couper net.
  const shown = lines.join(' ').length;
  if (shown < text.replace(/\s+/g, ' ').trim().length && lines.length > 0) {
    lines[lines.length - 1] = truncate(ctx, `${lines[lines.length - 1]}…`, max);
  }
  return lines;
}

/** Coupe un titre trop long plutot que de le laisser deborder de l'image. */
function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 4 && ctx.measureText(`${cut}…`).width > max) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function slug(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'serie'
  );
}

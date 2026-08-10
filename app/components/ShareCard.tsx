'use client';

import { useState } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';
import { PRODUCT_NAME } from '@/lib/site';

export interface SharePoint {
  readonly seasonNumber: number;
  /** Note du public, sur 5. */
  readonly stars: number;
  /** Ma note, si je l'ai posee. */
  readonly mine?: number;
}

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Ma trajectoire, en image.
 *
 * ## Pourquoi un canvas et pas une route d'image
 *
 * La solution attendue serait une route `ImageResponse` : elle donnerait un lien avec
 * apercu, donc plus viral. Deux raisons de ne pas la prendre, et elles vont dans le
 * meme sens.
 *
 *   - Le serveur ne connait pas mes notes — **et ne doit pas les connaitre**. Les lui
 *     transmettre voudrait dire les faire passer par l'URL : des donnees personnelles
 *     dans une chaine de requete, journalisee partout ou elle passe. On ne fait pas ca.
 *   - Une image rendue par le serveur coute une invocation **par partage**. Mettre une
 *     facture sur le geste viral d'un produit gratuit, c'est le mecanisme exact qui a
 *     tue TV Time.
 *
 * Un canvas ne coute rien, ne publie rien sans geste, et produit un fichier que l'on
 * envoie ou l'on veut. La contrepartie — pas d'apercu automatique dans les messageries
 * — est acceptee : c'est une image, elle se voit.
 *
 * ## Ce qu'elle montre
 *
 * La contrainte fait la viralite (lecon du « Top 4 » de Letterboxd) : une courbe, un
 * titre, rien d'autre. Pas de logo qui mange l'image, pas de statistiques en pagaille.
 */
export function ShareCard({ title, points }: {
  readonly title: string;
  readonly points: readonly SharePoint[];
}) {
  const { t, n: num } = useT();
  const [done, setDone] = useState(false);
  if (points.length < 2) return null;

  const draw = () => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    // Charte de `app/globals.css` : l'image doit appartenir au meme systeme visuel.
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#e6e9ef';
    ctx.font = '600 52px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(truncate(ctx, title, WIDTH - 160), 80, 118);

    ctx.fillStyle = '#8b94a7';
    ctx.font = '400 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(t('share.caption'), 80, 162);

    const top = 220;
    const bottom = HEIGHT - 130;
    const height = bottom - top;
    const slot = (WIDTH - 160) / points.length;
    const barWidth = Math.min(90, slot * 0.55);

    for (const [index, point] of points.entries()) {
      const centre = 80 + slot * index + slot / 2;
      const value = point.mine ?? point.stars;
      const barHeight = Math.max(6, (value / 5) * height);

      // La note du public en fond, la mienne par-dessus : l'ecart se lit sans legende.
      if (point.mine !== undefined) {
        const publicHeight = Math.max(6, (point.stars / 5) * height);
        ctx.fillStyle = '#262b36';
        rounded(ctx, centre - barWidth / 2, bottom - publicHeight, barWidth, publicHeight);
      }

      ctx.fillStyle = point.mine !== undefined ? '#fbbf24' : '#4ade80';
      const width = point.mine !== undefined ? barWidth * 0.55 : barWidth;
      rounded(ctx, centre - width / 2, bottom - barHeight, width, barHeight);

      ctx.fillStyle = '#e6e9ef';
      ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(num(value, 1), centre, bottom - barHeight - 18);

      ctx.fillStyle = '#8b94a7';
      ctx.font = '400 24px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(`S${point.seasonNumber}`, centre, bottom + 38);
      ctx.textAlign = 'left';
    }

    const hasMine = points.some((p) => p.mine !== undefined);
    ctx.fillStyle = '#8b94a7';
    ctx.font = '400 24px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
      hasMine ? t('share.legendMine') : t('share.legendPublic'),
      80,
      HEIGHT - 52,
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e6e9ef';
    ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(PRODUCT_NAME.toLowerCase(), WIDTH - 80, HEIGHT - 52);
    ctx.textAlign = 'left';

    canvas.toBlob((blob) => {
      if (blob === null) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug(title)}-trajectoire.png`;
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    }, 'image/png');
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={draw}
        className="rounded-full border border-(--color-edge) px-3 py-1.5 text-xs hover:border-(--color-muted)"
      >
        {t('share.save')}
      </button>
      {done ? (
        <span aria-live="polite" className="text-xs text-(--color-live)">
          {t('share.saved')}
        </span>
      ) : null}
    </div>
  );
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const radius = Math.min(8, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
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

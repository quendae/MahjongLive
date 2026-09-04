export type TileFaceMode = 'classic' | 'beginner';

const TILE_ASSET_ROOT = '/tiles/riichi-regular';

export function assetFileForLabel(label: string | null): string | null {
  const text = label?.trim().toLowerCase() ?? '';
  const suited = /^(red )?([1-9])([mps])$/.exec(text);
  if (suited) {
    const red = Boolean(suited[1]);
    const rank = Number(suited[2]);
    const prefix = suited[3] === 'm' ? 'Man' : suited[3] === 'p' ? 'Pin' : 'Sou';
    return `${prefix}${rank}${red && rank === 5 ? '-Dora' : ''}.svg`;
  }
  const honors: Record<string, string> = {
    east: 'Ton.svg',
    south: 'Nan.svg',
    west: 'Shaa.svg',
    north: 'Pei.svg',
    'white dragon': 'Haku.svg',
    'green dragon': 'Hatsu.svg',
    'red dragon': 'Chun.svg',
  };
  return honors[text] ?? null;
}

export function tileAssetUrlForLabel(label: string | null): string | null {
  const file = assetFileForLabel(label);
  return file ? `${TILE_ASSET_ROOT}/${file}` : null;
}

function beginnerCue(label: string | null): { text: string; color: string } | null {
  const text = label?.trim().toLowerCase() ?? '';
  const suited = /^(red )?([1-9])([mps])$/.exec(text);
  if (suited) {
    const red = Boolean(suited[1]);
    const suit = suited[3];
    const color = red ? '#c43732' : suit === 'm' ? '#b23b35' : suit === 'p' ? '#356b95' : '#2e7852';
    return { text: suited[2], color };
  }
  const honors: Record<string, { text: string; color: string }> = {
    east: { text: 'E', color: '#283831' },
    south: { text: 'S', color: '#283831' },
    west: { text: 'W', color: '#283831' },
    north: { text: 'N', color: '#283831' },
    'white dragon': { text: 'W', color: '#38749a' },
    'green dragon': { text: 'G', color: '#287550' },
    'red dragon': { text: 'R', color: '#bd3b35' },
  };
  return honors[text] ?? null;
}

function drawBeginnerBadge(ctx: CanvasRenderingContext2D, cue: { text: string; color: string }): void {
  const size = 37;
  const x = 160 - size - 8;
  const y = 216 - size - 8;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,253,.95)';
  ctx.strokeStyle = cue.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = cue.color;
  ctx.font = '800 22px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cue.text, x + size / 2, y + size / 2 + .5);
  ctx.restore();
}

function drawFallback(ctx: CanvasRenderingContext2D, label: string | null): void {
  const text = label?.trim() || '?';
  ctx.save();
  ctx.fillStyle = '#26372f';
  ctx.font = '700 32px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 108, 144);
  ctx.restore();
}

export function createFaceCanvas(
  label: string | null,
  back = false,
  mode: TileFaceMode = 'classic',
  onReady?: () => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const renderScale = 2;
  canvas.width = 160 * renderScale;
  canvas.height = 216 * renderScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(renderScale, renderScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const paintBase = () => {
    ctx.clearRect(0, 0, 160, 216);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 160, 216);
  };
  paintBase();

  if (back) return canvas;

  const file = assetFileForLabel(label);
  if (!file) {
    drawFallback(ctx, label);
    if (mode === 'beginner') {
      const cue = beginnerCue(label);
      if (cue) drawBeginnerBadge(ctx, cue);
    }
    return canvas;
  }

  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    paintBase();
    // Upstream artwork is 300x400 and contains only the printed face artwork, so it can sit
    // directly on our white porcelain face without importing a second tile body/border.
    ctx.drawImage(image, 0, 0, 160, 216);
    if (mode === 'beginner') {
      const cue = beginnerCue(label);
      if (cue) drawBeginnerBadge(ctx, cue);
    }
    onReady?.();
  };
  image.onerror = () => {
    paintBase();
    drawFallback(ctx, label);
    if (mode === 'beginner') {
      const cue = beginnerCue(label);
      if (cue) drawBeginnerBadge(ctx, cue);
    }
    onReady?.();
  };
  image.src = tileAssetUrlForLabel(label) ?? `${TILE_ASSET_ROOT}/${file}`;
  return canvas;
}

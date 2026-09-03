export type TileFaceMode = 'classic' | 'beginner';

export function createFaceCanvas(
  label: string | null,
  back = false,
  mode: TileFaceMode = 'classic',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const renderScale = 2;
  canvas.width = 160 * renderScale;
  canvas.height = 216 * renderScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(renderScale, renderScale);

  ctx.fillStyle = back ? '#ffffff' : '#fffefd';
  ctx.fillRect(0, 0, 160, 216);

  // Fronts should read like a single porcelain/ivory surface. Keep the decorative border only
  // on tile backs; the old grey rounded front outline made every face look like an inset sticker.
  if (back) {
    ctx.strokeStyle = 'rgba(28,54,43,.52)';
    ctx.lineWidth = 5;
    roundRectStroke(ctx, 5, 5, 150, 206, 12);
    ctx.strokeStyle = 'rgba(29,59,46,.28)';
    ctx.lineWidth = 2;
    roundRectStroke(ctx, 18, 18, 124, 180, 8);
    for (let y = 28; y < 195; y += 18) {
      for (let x = 25; x < 145; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x, y - 5);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 5);
        ctx.closePath();
        ctx.stroke();
      }
    }
    return canvas;
  }

  const text = label?.trim().toLowerCase() ?? '';
  const suited = /^(red )?([1-9])([mps])$/.exec(text);
  if (suited) {
    const red = Boolean(suited[1]);
    const rank = Number(suited[2]);
    const suit = suited[3];
    if (suit === 'm') drawMan(ctx, rank, red);
    else if (suit === 'p') drawPin(ctx, rank, red);
    else drawSou(ctx, rank, red);
    if (mode === 'beginner') drawBeginnerBadge(ctx, String(rank), suitColor(suit, red));
    return canvas;
  }

  const glyphs: Record<string, { glyph: string; color: string; beginner: string }> = {
    east: { glyph: '東', color: '#26372f', beginner: 'E' },
    south: { glyph: '南', color: '#26372f', beginner: 'S' },
    west: { glyph: '西', color: '#26372f', beginner: 'W' },
    north: { glyph: '北', color: '#26372f', beginner: 'N' },
    'red dragon': { glyph: '中', color: '#bb3a34', beginner: 'R' },
    'green dragon': { glyph: '發', color: '#26744e', beginner: 'G' },
  };

  if (text === 'white dragon') {
    ctx.strokeStyle = '#38749a';
    ctx.lineWidth = 9;
    roundRectStroke(ctx, 39, 36, 82, 144, 5);
    ctx.lineWidth = 3;
    roundRectStroke(ctx, 49, 48, 62, 120, 4);
    if (mode === 'beginner') drawBeginnerBadge(ctx, 'W', '#38749a');
    return canvas;
  }

  const honor = glyphs[text];
  if (honor) {
    ctx.fillStyle = honor.color;
    ctx.font = '800 116px "Noto Serif CJK JP", "Yu Mincho", "MS Mincho", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(honor.glyph, 80, 111);
    if (mode === 'beginner') {
      drawBeginnerBadge(ctx, honor.beginner, honor.color);
    }
  }
  return canvas;
}

function roundRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();
}

function drawBeginnerBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
): void {
  // Small corner cue: enough for learning without covering the traditional artwork.
  const size = 38;
  const x = 160 - size - 9;
  const y = 216 - size - 9;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,251,.94)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '800 23px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2 + .5);
  ctx.restore();
}

function suitColor(suit: string, red: boolean): string {
  if (red) return '#bd3b34';
  if (suit === 'm') return '#ad3932';
  if (suit === 'p') return '#356b95';
  return '#2d7952';
}

function drawMan(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = red ? '#c22f2d' : '#18251f';
  ctx.font = '800 88px "Noto Serif CJK JP", "Yu Mincho", "MS Mincho", serif';
  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 70);
  ctx.fillStyle = '#c5302d';
  ctx.font = '800 70px "Noto Serif CJK JP", "Yu Mincho", "MS Mincho", serif';
  ctx.fillText('萬', 80, 158);
  ctx.restore();
}

function pinLayout(rank: number): readonly [number, number][] {
  const layouts: Record<number, readonly [number, number][]> = {
    1: [[80, 108]],
    2: [[55, 62], [105, 154]],
    3: [[52, 54], [80, 108], [108, 162]],
    4: [[53, 57], [107, 57], [53, 159], [107, 159]],
    5: [[53, 52], [107, 52], [80, 108], [53, 164], [107, 164]],
    6: [[53, 43], [107, 43], [53, 108], [107, 108], [53, 173], [107, 173]],
    7: [[42, 42], [80, 42], [118, 42], [55, 105], [105, 105], [55, 166], [105, 166]],
    8: [[53, 34], [107, 34], [53, 83], [107, 83], [53, 133], [107, 133], [53, 182], [107, 182]],
    9: [[40, 39], [80, 39], [120, 39], [40, 108], [80, 108], [120, 108], [40, 177], [80, 177], [120, 177]],
  };
  return layouts[rank] ?? [];
}

function drawPin(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const dark = '#18342d';
  const palette = red ? ['#c9302c'] : ['#276f4f', '#c9302c', '#1d3850'];
  pinLayout(rank).forEach(([x, y], index) => {
    const accent = palette[index % palette.length];
    const radius = rank === 1 ? 37 : 15.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = dark;
    ctx.lineWidth = rank === 1 ? 7 : 4.5;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = rank === 1 ? 5 : 3.5;
    ctx.beginPath(); ctx.arc(0, 0, radius * .68, 0, Math.PI * 2); ctx.stroke();
    if (rank === 1) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 4;
      for (let spoke = 0; spoke < 10; spoke += 1) {
        const a = spoke * Math.PI / 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * .76, Math.sin(a) * radius * .76);
        ctx.lineTo(Math.cos(a) * radius * .96, Math.sin(a) * radius * .96);
        ctx.stroke();
      }
    }
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(0, 0, radius * .25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fffefd';
    ctx.beginPath(); ctx.arc(0, 0, radius * .10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

function souLayout(rank: number): readonly [number, number, number][] {
  const layouts: Record<number, readonly [number, number, number][]> = {
    2: [[60, 68, -8], [100, 148, 8]],
    3: [[58, 54, -8], [102, 108, 8], [58, 162, -8]],
    4: [[58, 61, -7], [102, 61, 7], [58, 155, -7], [102, 155, 7]],
    5: [[58, 54, -7], [102, 54, 7], [80, 108, 0], [58, 162, -7], [102, 162, 7]],
    6: [[57, 45, -6], [103, 45, 6], [57, 108, -6], [103, 108, 6], [57, 171, -6], [103, 171, 6]],
    7: [[42, 45, -8], [80, 45, 0], [118, 45, 8], [58, 108, -6], [102, 108, 6], [58, 171, -6], [102, 171, 6]],
    8: [[57, 34, -6], [103, 34, 6], [57, 83, -6], [103, 83, 6], [57, 133, -6], [103, 133, 6], [57, 182, -6], [103, 182, 6]],
    9: [[42, 39, -7], [80, 39, 0], [118, 39, 7], [42, 108, -7], [80, 108, 0], [118, 108, 7], [42, 177, -7], [80, 177, 0], [118, 177, 7]],
  };
  return layouts[rank] ?? [];
}

function drawSou(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  if (rank === 1) {
    // Traditional peacock / bird motif: deliberately bolder than the previous minimalist mark.
    ctx.save();
    ctx.translate(80, 108);
    ctx.strokeStyle = '#1f6846';
    ctx.fillStyle = '#2b6f93';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-5, 62);
    ctx.quadraticCurveTo(-12, 15, 3, -22);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(6, -38, 20, 29, .25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8322e';
    ctx.beginPath(); ctx.arc(13, -48, 5.5, 0, Math.PI * 2); ctx.fill();
    const tails = [[-37, 14], [-28, -7], [-15, -22], [25, -20], [36, 2], [31, 25]];
    for (const [tx, ty] of tails) {
      ctx.strokeStyle = '#28714b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-1, -5);
      ctx.quadraticCurveTo(tx * .55, ty * .6, tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#fffefd';
      ctx.strokeStyle = '#173c31';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8322e';
      ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }

  const green = '#236b47';
  souLayout(rank).forEach(([x, y, angle], index) => {
    const accent = red || (rank === 5 && index === 2) ? '#c8322e' : green;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.strokeStyle = '#173c31';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(-9, -25, 18, 50, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffefd';
    ctx.beginPath(); ctx.roundRect(-7.5, -4, 15, 8, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-3, -19); ctx.lineTo(-3, 19); ctx.stroke();
    ctx.restore();
  });
}
export type TileFaceMode = 'classic' | 'beginner';

export function createFaceCanvas(
  label: string | null,
  back = false,
  mode: TileFaceMode = 'classic',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 216;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = back ? '#ffffff' : '#f7f1df';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = back ? 'rgba(28,54,43,.52)' : '#c8bea9';
  ctx.lineWidth = 5;
  roundRectStroke(ctx, 5, 5, 150, 206, 12);

  if (back) {
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
    if (mode === 'beginner') drawBeginnerBadge(ctx, `${rank}${suit.toUpperCase()}`, suitColor(suit, red));
    return canvas;
  }

  const glyphs: Record<string, { glyph: string; color: string; beginner: string }> = {
    east: { glyph: '東', color: '#26372f', beginner: 'E' },
    south: { glyph: '南', color: '#26372f', beginner: 'S' },
    west: { glyph: '西', color: '#26372f', beginner: 'W' },
    north: { glyph: '北', color: '#26372f', beginner: 'N' },
    'red dragon': { glyph: '中', color: '#bb3a34', beginner: 'RED' },
    'green dragon': { glyph: '發', color: '#26744e', beginner: 'GREEN' },
  };

  if (text === 'white dragon') {
    ctx.strokeStyle = '#38749a';
    ctx.lineWidth = 9;
    roundRectStroke(ctx, 39, 36, 82, 144, 5);
    ctx.lineWidth = 3;
    roundRectStroke(ctx, 49, 48, 62, 120, 4);
    if (mode === 'beginner') drawBeginnerBadge(ctx, 'WHITE', '#38749a', true);
    return canvas;
  }

  const honor = glyphs[text];
  if (honor) {
    ctx.fillStyle = honor.color;
    ctx.font = 'bold 112px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(honor.glyph, 80, 111);
    if (mode === 'beginner') {
      drawBeginnerBadge(ctx, honor.beginner, honor.color, honor.beginner.length > 1);
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
  wide = false,
): void {
  const width = wide ? 98 : 60;
  const height = 43;
  const x = 160 - width - 8;
  const y = 8;
  ctx.save();
  ctx.fillStyle = 'rgba(255,253,245,.97)';
  ctx.strokeStyle = 'rgba(35,48,40,.24)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `850 ${wide ? 18 : 24}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + height / 2 + .5);
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 82px Georgia, "Times New Roman", serif';
  ctx.fillStyle = red ? '#c23b34' : '#26362f';
  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 76);
  ctx.font = 'bold 70px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#b63b34';
  ctx.fillText('萬', 80, 158);
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
  const palette = red ? ['#bd3b34'] : ['#306c97', '#bd3b34', '#2f7952'];
  pinLayout(rank).forEach(([x, y], index) => {
    const color = palette[index % palette.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = rank === 1 ? 10 : 7;
    ctx.beginPath();
    ctx.arc(x, y, rank === 1 ? 34 : 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, rank === 1 ? 20 : 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rank === 1 ? 7 : 3.5, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.strokeStyle = red ? '#bd3b34' : '#287650';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(80, 184);
    ctx.quadraticCurveTo(74, 104, 81, 49);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(80, 90);
    ctx.quadraticCurveTo(48, 70, 37, 38);
    ctx.moveTo(80, 110);
    ctx.quadraticCurveTo(111, 82, 122, 49);
    ctx.stroke();
    ctx.fillStyle = red ? '#bd3b34' : '#356f96';
    ctx.beginPath();
    ctx.ellipse(93, 39, 19, 30, .45, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const green = red ? '#bd3b34' : '#2c7952';
  souLayout(rank).forEach(([x, y, angle]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.roundRect(-9, -25, 18, 50, 8);
    ctx.fill();
    ctx.strokeStyle = '#eef0df';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.restore();
  });
}

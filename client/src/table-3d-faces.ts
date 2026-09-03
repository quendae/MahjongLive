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

  ctx.fillStyle = back ? '#ffffff' : '#fffdf8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    ctx.font = 'bold 112px Georgia, "Times New Roman", serif';
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
  ctx.fillStyle = red ? '#c53b33' : '#22352e';
  ctx.font = '700 86px "Noto Serif CJK JP", "Yu Mincho", Georgia, serif';
  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 74);
  ctx.fillStyle = '#b93430';
  ctx.font = '700 67px "Noto Serif CJK JP", "Yu Mincho", Georgia, serif';
  ctx.fillText('萬', 80, 157);
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
  const palette = red ? ['#c43c35'] : ['#2f6f98', '#c43c35', '#2d7751'];
  pinLayout(rank).forEach(([x, y], index) => {
    const color = palette[index % palette.length];
    const radius = rank === 1 ? 35 : 15.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = rank === 1 ? 7 : 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = rank === 1 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * .58, 0, Math.PI * 2);
    ctx.stroke();
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = petal * Math.PI / 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * radius * .42, Math.sin(angle) * radius * .42, radius * .13, radius * .25, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius * .13, 0, Math.PI * 2);
    ctx.fill();
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
    // A compact peacock/bamboo-bird motif inspired by traditional 1-sou tiles.
    ctx.save();
    ctx.strokeStyle = red ? '#c43c35' : '#2b7750';
    ctx.fillStyle = red ? '#c43c35' : '#2f7096';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(78, 182);
    ctx.quadraticCurveTo(73, 125, 82, 76);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(85, 63, 24, 33, .34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b7750';
    ctx.lineWidth = 5;
    for (const [dx, dy] of [[-32, -5], [-22, -29], [25, -26], [34, 1]]) {
      ctx.beginPath();
      ctx.moveTo(80, 96);
      ctx.quadraticCurveTo(80 + dx * .55, 82 + dy * .45, 80 + dx, 77 + dy);
      ctx.stroke();
    }
    ctx.fillStyle = '#c43c35';
    ctx.beginPath();
    ctx.arc(95, 53, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const green = red ? '#c43c35' : '#2d7952';
  souLayout(rank).forEach(([x, y, angle], index) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.roundRect(-8.5, -25, 17, 50, 7);
    ctx.fill();
    ctx.fillStyle = !red && index % 5 === 2 ? '#c43c35' : '#f8f3de';
    ctx.beginPath();
    ctx.roundRect(-7, -3, 14, 6, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(26,74,49,.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
  });
}

import type { Tile } from '@mahjong-live/shared/tile-types';

const MAN_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

const PIN_LAYOUTS: Record<number, readonly [number, number][]> = {
  2: [[34, 34], [66, 104]],
  3: [[30, 30], [50, 70], [70, 110]],
  4: [[31, 34], [69, 34], [31, 106], [69, 106]],
  5: [[30, 31], [70, 31], [50, 70], [30, 109], [70, 109]],
  6: [[31, 27], [69, 27], [31, 70], [69, 70], [31, 113], [69, 113]],
  7: [[25, 27], [50, 27], [75, 27], [34, 66], [66, 66], [34, 108], [66, 108]],
  8: [[31, 22], [69, 22], [31, 54], [69, 54], [31, 86], [69, 86], [31, 118], [69, 118]],
  9: [[24, 25], [50, 25], [76, 25], [24, 70], [50, 70], [76, 70], [24, 115], [50, 115], [76, 115]],
};

const SOU_LAYOUTS: Record<number, readonly [number, number, number][]> = {
  2: [[38, 42, -8], [62, 98, 8]],
  3: [[35, 34, -7], [65, 70, 7], [35, 106, -7]],
  4: [[35, 38, -7], [65, 38, 7], [35, 102, -7], [65, 102, 7]],
  5: [[35, 34, -7], [65, 34, 7], [50, 70, 0], [35, 106, -7], [65, 106, 7]],
  6: [[34, 29, -6], [66, 29, 6], [34, 70, -6], [66, 70, 6], [34, 111, -6], [66, 111, 6]],
  7: [[25, 29, -7], [50, 29, 0], [75, 29, 7], [35, 70, -6], [65, 70, 6], [35, 111, -6], [65, 111, 6]],
  8: [[34, 20, -6], [66, 20, 6], [34, 53, -6], [66, 53, 6], [34, 87, -6], [66, 87, 6], [34, 120, -6], [66, 120, 6]],
  9: [[25, 24, -7], [50, 24, 0], [75, 24, 7], [25, 70, -7], [50, 70, 0], [75, 70, 7], [25, 116, -7], [50, 116, 0], [75, 116, 7]],
};

function svg(body: string, className: string): string {
  return `<svg class="tile-face-svg ${className}" viewBox="0 0 100 140" aria-hidden="true" focusable="false">${body}</svg>`;
}

function pinMark(x: number, y: number, index: number, red = false): string {
  const palette = red ? ['#c84237'] : ['#2d6f9f', '#c84237', '#31825c'];
  const color = palette[index % palette.length];
  return `<g transform="translate(${x} ${y})">
    <circle r="10.6" fill="none" stroke="${color}" stroke-width="4"/>
    <circle r="6.1" fill="none" stroke="${color}" stroke-width="1.8" opacity=".9"/>
    <circle r="2.2" fill="${color}"/>
  </g>`;
}

function onePin(red: boolean): string {
  const primary = red ? '#c84237' : '#2d6f9f';
  const secondary = red ? '#c84237' : '#31825c';
  let petals = '';
  for (let i = 0; i < 8; i += 1) {
    petals += `<ellipse cx="50" cy="25" rx="7" ry="17" fill="none" stroke="${i % 2 ? primary : secondary}" stroke-width="4" transform="rotate(${i * 45} 50 70)"/>`;
  }
  return svg(`${petals}<circle cx="50" cy="70" r="12" fill="none" stroke="#c84237" stroke-width="4"/><circle cx="50" cy="70" r="4" fill="#c84237"/>`, 'tile-face-pin');
}

function pinFace(rank: number, red: boolean): string {
  if (rank === 1) return onePin(red);
  const layout = PIN_LAYOUTS[rank] ?? [];
  return svg(layout.map(([x, y], index) => pinMark(x, y, index, red)).join(''), 'tile-face-pin');
}

function bambooMark(x: number, y: number, angle: number, red = false): string {
  const green = red ? '#c84237' : '#2d7b54';
  const dark = red ? '#a52f29' : '#1f6243';
  return `<g transform="translate(${x} ${y}) rotate(${angle})">
    <rect x="-5.5" y="-17" width="11" height="34" rx="5.5" fill="${green}"/>
    <path d="M-5 0H5" stroke="#f4efe1" stroke-width="2.3" opacity=".92"/>
    <path d="M0-15V15" stroke="${dark}" stroke-width="1.5" opacity=".58"/>
    <path d="M-4-10L4-7M-4 8L4 11" stroke="#d8eadc" stroke-width="1.4" opacity=".75"/>
  </g>`;
}

function oneSou(red: boolean): string {
  const green = red ? '#c84237' : '#27744f';
  const blue = red ? '#b63530' : '#346d94';
  return svg(`
    <path d="M50 119C49 94 46 70 49 43" fill="none" stroke="${green}" stroke-width="6" stroke-linecap="round"/>
    <path d="M49 63C35 52 27 43 23 28C38 31 48 39 53 53" fill="none" stroke="${green}" stroke-width="6" stroke-linecap="round"/>
    <path d="M49 76C63 65 73 53 77 38C63 41 54 50 49 62" fill="none" stroke="${green}" stroke-width="6" stroke-linecap="round"/>
    <path d="M48 45C42 30 48 18 61 14C66 28 61 40 48 45Z" fill="${blue}" opacity=".95"/>
    <circle cx="58" cy="24" r="2.6" fill="#f0d57e"/>
    <path d="M36 120H64" stroke="#b04138" stroke-width="5" stroke-linecap="round"/>
  `, 'tile-face-sou tile-face-sou-one');
}

function souFace(rank: number, red: boolean): string {
  if (rank === 1) return oneSou(red);
  const layout = SOU_LAYOUTS[rank] ?? [];
  return svg(layout.map(([x, y, angle]) => bambooMark(x, y, angle, red)).join(''), 'tile-face-sou');
}

function manFace(rank: number, red: boolean): string {
  const number = MAN_NUMERALS[rank - 1] ?? String(rank);
  const numberColor = red ? '#c53d35' : '#26362f';
  return svg(`
    <text x="50" y="61" text-anchor="middle" class="man-number" fill="${numberColor}">${number}</text>
    <text x="50" y="116" text-anchor="middle" class="man-suit" fill="#b83c34">萬</text>
  `, 'tile-face-man');
}

function honorFace(tile: Extract<Tile, { kind: 'honor' }>): string {
  if (tile.honorType === 'dragon' && tile.value === 'white') {
    return svg(`
      <rect x="22" y="27" width="56" height="86" rx="5" fill="none" stroke="#39729a" stroke-width="5"/>
      <rect x="29" y="34" width="42" height="72" rx="3" fill="none" stroke="#39729a" stroke-width="1.7" opacity=".55"/>
    `, 'tile-face-honor tile-face-white');
  }

  const glyph = tile.honorType === 'wind'
    ? ({ east: '東', south: '南', west: '西', north: '北' } as const)[tile.value]
    : tile.value === 'green' ? '發' : '中';
  const color = tile.honorType === 'wind' ? '#27372f' : tile.value === 'green' ? '#237a50' : '#c13c34';
  return svg(`<text x="50" y="94" text-anchor="middle" class="honor-glyph" fill="${color}">${glyph}</text>`, 'tile-face-honor');
}

/** Render an original, asset-free Riichi Mahjong tile face as scalable inline SVG. */
export function renderTileFace(tile: Tile): string {
  if (tile.kind === 'honor') return honorFace(tile);
  if (tile.suit === 'man') return manFace(tile.rank, tile.isRed === true);
  if (tile.suit === 'pin') return pinFace(tile.rank, tile.isRed === true);
  return souFace(tile.rank, tile.isRed === true);
}

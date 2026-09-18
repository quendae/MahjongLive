import { seatWindFor } from '@mahjong-live/shared/rules';
import type { PlayerIndex, PlayerMeld } from '@mahjong-live/shared/rules';
import type { SingleGameState } from '@mahjong-live/shared/single';
import type { Tile, Wind } from '@mahjong-live/shared/tile-types';
import { tileAssetUrlForLabel } from './table-3d-faces';

const windGlyph: Record<Wind, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
};

const numberFormat = new Intl.NumberFormat('en-US');

function tileSortValue(tile: Tile): number {
  if (tile.kind === 'suited') {
    const suit = tile.suit === 'man' ? 0 : tile.suit === 'pin' ? 1 : 2;
    return suit * 10 + tile.rank;
  }
  if (tile.honorType === 'wind') {
    const winds: Wind[] = ['east', 'south', 'west', 'north'];
    return 40 + winds.indexOf(tile.value as Wind);
  }
  const dragons = ['white', 'green', 'red'];
  return 50 + dragons.indexOf(tile.value);
}

function tileLabel(tile: Tile): string {
  if (tile.kind === 'suited') {
    const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
    return `${tile.isRed ? 'red ' : ''}${tile.rank}${suffix}`;
  }
  if (tile.honorType === 'wind') return tile.value;
  return `${tile.value} dragon`;
}

function tileFace(tile: Tile): string {
  const label = tileLabel(tile);
  const src = tileAssetUrlForLabel(label);
  if (src) return `<img class="tile-art" src="${src}" alt="" draggable="false" aria-hidden="true">`;
  if (tile.kind === 'honor') {
    if (tile.honorType === 'wind') return windGlyph[tile.value as Wind];
    if (tile.value === 'white') return '<span class="white-dragon">□</span>';
    if (tile.value === 'green') return '<span class="green-glyph">發</span>';
    return '<span class="red-glyph">中</span>';
  }
  const suffix = tile.suit === 'man' ? '萬' : tile.suit === 'pin' ? '筒' : '索';
  return `<span class="tile-rank">${tile.rank}</span><span class="tile-suit">${suffix}</span>`;
}

function tileClass(tile: Tile, compact = false): string {
  const classes = ['tile'];
  if (compact) classes.push('tile-compact');
  if (tile.kind === 'suited') {
    classes.push(`tile-${tile.suit}`);
    if (tile.isRed) classes.push('tile-red');
  } else {
    classes.push('tile-honor');
    if (tile.value === 'red') classes.push('tile-red');
    if (tile.value === 'green') classes.push('tile-green');
  }
  return classes.join(' ');
}

function faceTileMarkup(
  tile: Tile,
  options: {
    compact?: boolean;
    drawn?: boolean;
    called?: boolean;
    riichiDeclaration?: boolean;
    meldCalled?: boolean;
    calledFrom?: PlayerIndex;
  } = {},
): string {
  const classes = [tileClass(tile, options.compact)];
  if (options.drawn) classes.push('tile-drawn');
  if (options.called) classes.push('tile-called');
  if (options.meldCalled) classes.push('tile-meld-called');
  const idAttr = typeof tile.id === 'number' ? ` data-engine-tile-id="${tile.id}"` : '';
  const calledFromAttr = options.calledFrom !== undefined ? ` data-called-from="${options.calledFrom}"` : '';
  const riichiAttr = options.riichiDeclaration ? ' data-riichi-declaration="true"' : '';
  return `<div class="${classes.join(' ')}" aria-label="${tileLabel(tile)}"${idAttr}${calledFromAttr}${riichiAttr}>${tileFace(tile)}</div>`;
}

function backTileMarkup(tile: Tile, drawn = false): string {
  const idAttr = typeof tile.id === 'number' ? ` data-engine-tile-id="${tile.id}"` : '';
  return `<div class="tile tile-back tile-compact${drawn ? ' tile-drawn' : ''}" aria-hidden="true"${idAttr}><span></span></div>`;
}

function meldMarkup(meld: PlayerMeld, meldIndex: number): string {
  const hiddenOuter = meld.type === 'quad' && meld.isOpen !== true;
  const tiles = meld.tiles.map((tile, index) => {
    if (hiddenOuter && (index === 0 || index === meld.tiles.length - 1)) return backTileMarkup(tile);
    const called = meld.calledTileId !== undefined && tile.id === meld.calledTileId;
    return faceTileMarkup(tile, {
      compact: true,
      meldCalled: called,
      calledFrom: called ? meld.calledFrom : undefined,
    });
  }).join('');
  return `<div class="meld meld-${meld.type}" data-meld-index="${meldIndex}">${tiles}</div>`;
}

function statusTags(state: SingleGameState, player: PlayerIndex): string {
  const round = state.match.round;
  const playerState = round.players[player];
  const tags: string[] = [];
  if (player === round.dealer) tags.push('<span class="status-tag dealer-tag">Dealer</span>');
  if (playerState.riichi !== 'none') {
    tags.push(`<span class="status-tag riichi-tag">${playerState.riichi === 'double-riichi' ? 'Double Riichi' : 'Riichi'}</span>`);
  }
  return tags.join('');
}

function renderPlayerZone(panel: HTMLElement, state: SingleGameState, player: PlayerIndex): void {
  const zone = panel.querySelector<HTMLElement>(`[data-player="${player}"]`);
  if (!zone) return;
  const round = state.match.round;
  const playerState = round.players[player];
  const seatWind = seatWindFor(player, round.dealer);
  const drawnId = round.phase.kind === 'awaiting-discard' && round.phase.player === player
    ? round.phase.drawnTileId
    : null;

  const wind = zone.querySelector<HTMLElement>('.seat-wind');
  if (wind) wind.textContent = windGlyph[seatWind];
  const points = zone.querySelector<HTMLElement>('.player-points');
  if (points) points.textContent = numberFormat.format(playerState.points);
  const tags = zone.querySelector<HTMLElement>('.player-tags');
  if (tags) tags.innerHTML = statusTags(state, player);

  const river = zone.querySelector<HTMLElement>('.discard-river');
  if (river) {
    river.innerHTML = playerState.discards.map((discard) => faceTileMarkup(discard.tile, {
      compact: true,
      called: discard.calledBy !== undefined,
      riichiDeclaration: discard.riichiDeclaration === true,
    })).join('');
  }

  const melds = zone.querySelector<HTMLElement>('.meld-row');
  if (melds) melds.innerHTML = playerState.melds.map(meldMarkup).join('');

  if (player === state.humanSeat) {
    const hand = zone.querySelector<HTMLElement>('#human-hand, .human-hand');
    if (!hand) return;
    const sorted = [...playerState.concealed].sort((a, b) => tileSortValue(a) - tileSortValue(b));
    const drawn = drawnId === null ? undefined : sorted.find((tile) => tile.id === drawnId);
    const base = drawn ? sorted.filter((tile) => tile !== drawn) : sorted;
    const ordered = drawn ? [...base, drawn] : base;
    hand.innerHTML = ordered.map((tile) => faceTileMarkup(tile, { drawn: tile.id === drawnId })).join('');
    return;
  }

  const hand = zone.querySelector<HTMLElement>('.opponent-hand');
  if (!hand) return;
  hand.setAttribute('aria-label', `${playerState.concealed.length} concealed tiles`);
  hand.innerHTML = playerState.concealed.map((tile) => backTileMarkup(tile, tile.id === drawnId)).join('');
}

function renderCenter(panel: HTMLElement, state: SingleGameState): void {
  const match = state.match;
  const round = match.round;
  const roundTitle = panel.querySelector<HTMLElement>('.round-title');
  if (roundTitle) roundTitle.textContent = `${windGlyph[match.wind as Wind]} ${match.hand}`;

  const centerMeta = panel.querySelector<HTMLElement>('.center-meta');
  if (centerMeta) {
    centerMeta.innerHTML = `<span>${round.honba} honba</span><span>${round.riichiSticks} riichi stick${round.riichiSticks === 1 ? '' : 's'}</span><span>${round.wall.liveWall.length} draws</span>`;
  }

  const dora = panel.querySelector<HTMLElement>('.dora-row');
  if (dora) dora.innerHTML = `<span>Dora</span>${round.wall.doraIndicators.map((tile) => faceTileMarkup(tile, { compact: true })).join('')}`;

  const active = round.phase.kind === 'awaiting-draw' || round.phase.kind === 'awaiting-discard'
    ? round.phase.player
    : round.currentPlayer;
  const indicator = panel.querySelector<HTMLElement>('.turn-indicator');
  if (indicator) indicator.textContent = round.phase.kind === 'ended' ? 'Hand complete' : active === state.humanSeat ? 'You to act' : 'Replay';
}

export function renderReplayTable(template: HTMLElement, state: SingleGameState): HTMLElement {
  const panel = template.cloneNode(true) as HTMLElement;
  panel.setAttribute('data-visual-replay-table', '');
  panel.querySelectorAll('[data-tile-id]').forEach((element) => element.removeAttribute('data-tile-id'));
  panel.querySelectorAll('.action-dock').forEach((element) => element.remove());
  panel.querySelectorAll('.call-bubble').forEach((element) => element.remove());

  ([0, 1, 2, 3] as const).forEach((player) => renderPlayerZone(panel, state, player));
  renderCenter(panel, state);
  return panel;
}

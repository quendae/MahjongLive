import { tileTypeKey } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { drawRinshan, revealKanDora } from '../wall/wall';
import { winningTileTypeKeys } from './waits';
import type {
  CallClaim,
  PlayerIndex,
  PlayerMeld,
  RoundDiscard,
  RoundEvent,
  RoundPlayerState,
  RoundState,
} from './types';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];

function playerTuple(players: readonly RoundPlayerState[]): RoundState['players'] {
  return [players[0], players[1], players[2], players[3]];
}

function replacePlayer(
  players: RoundState['players'],
  index: PlayerIndex,
  replacement: RoundPlayerState,
): RoundState['players'] {
  return playerTuple(players.map((player, i) => (i === index ? replacement : player)));
}

function clearAllIppatsu(players: RoundState['players']): RoundState['players'] {
  return playerTuple(players.map((player) => ({ ...player, ippatsuEligible: false })));
}

function idOf(tile: Tile): number | null {
  return typeof tile.id === 'number' ? tile.id : null;
}

function sameIds(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((id, index) => id === right[index]);
}

function sameWaits(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((wait) => b.has(wait));
}

export function completedKanCount(state: RoundState): number {
  return state.players.reduce(
    (sum, player) => sum + player.melds.filter((meld) => meld.type === 'quad').length,
    0,
  );
}

export function flushPendingKanDora(
  state: RoundState,
): { state: RoundState; events: readonly RoundEvent[] } {
  if (state.phase.kind !== 'awaiting-discard' || state.phase.pendingKanDora !== true) {
    return { state, events: [] };
  }
  const wall = revealKanDora(state.wall);
  return {
    state: {
      ...state,
      wall,
      phase: { ...state.phase, pendingKanDora: false },
    },
    events: [{ type: 'DoraIndicatorRevealed', count: wall.doraIndicators.length }],
  };
}

function groupFour(player: RoundPlayerState): Array<readonly [number, number, number, number]> {
  const groups = new Map<string, number[]>();
  for (const tile of player.concealed) {
    const id = idOf(tile);
    if (id === null) continue;
    const key = tileTypeKey(tile);
    const ids = groups.get(key) ?? [];
    ids.push(id);
    groups.set(key, ids);
  }
  return [...groups.values()]
    .filter((ids) => ids.length === 4)
    .map((ids) => [ids[0], ids[1], ids[2], ids[3]] as const);
}

export function legalAnkanOptions(
  state: RoundState,
  playerIndex: PlayerIndex,
): Array<readonly [number, number, number, number]> {
  if (state.phase.kind !== 'awaiting-discard' || state.phase.player !== playerIndex) return [];
  if (state.phase.drawnTileId === null || state.wall.liveWall.length === 0) return [];
  if (completedKanCount(state) >= 4) return [];
  const player = state.players[playerIndex];
  const groups = groupFour(player);
  if (player.riichi === 'none') return groups;

  const drawnTileId = state.phase.drawnTileId;
  const preDraw = player.concealed.filter((tile) => tile.id !== drawnTileId);
  const beforeWaits = winningTileTypeKeys(preDraw, player.melds);

  return groups.filter((ids) => {
    if (!ids.includes(drawnTileId)) return false;
    const tiles = ids
      .map((id) => player.concealed.find((tile) => tile.id === id))
      .filter((tile): tile is Tile => tile !== undefined);
    if (tiles.length !== 4) return false;
    const idSet = new Set(ids);
    const afterConcealed = player.concealed.filter((tile) => !idSet.has(tile.id ?? -1));
    const quad: PlayerMeld = { type: 'quad', tiles, isOpen: false };
    const afterWaits = winningTileTypeKeys(afterConcealed, [...player.melds, quad]);
    return beforeWaits.size > 0 && sameWaits(beforeWaits, afterWaits);
  });
}

export function legalShouminkanOptions(
  state: RoundState,
  playerIndex: PlayerIndex,
): Array<{ meldIndex: number; tileId: number }> {
  if (state.phase.kind !== 'awaiting-discard' || state.phase.player !== playerIndex) return [];
  if (state.phase.drawnTileId === null || state.wall.liveWall.length === 0) return [];
  if (completedKanCount(state) >= 4) return [];
  const player = state.players[playerIndex];
  if (player.riichi !== 'none') return [];
  const options: Array<{ meldIndex: number; tileId: number }> = [];
  player.melds.forEach((meld, meldIndex) => {
    if (meld.type !== 'triplet' || meld.isOpen !== true) return;
    const key = tileTypeKey(meld.tiles[0]);
    for (const tile of player.concealed) {
      const tileId = idOf(tile);
      if (tileId !== null && tileTypeKey(tile) === key) options.push({ meldIndex, tileId });
    }
  });
  return options;
}

export function legalDaiminkanOptions(
  state: RoundState,
  playerIndex: PlayerIndex,
  discard: RoundDiscard | null,
): Array<readonly [number, number, number]> {
  if (state.phase.kind !== 'reactions' || state.phase.discarder === playerIndex) return [];
  if (!discard || discard.wasLastLiveDraw || state.wall.liveWall.length === 0) return [];
  if (completedKanCount(state) >= 4) return [];
  const player = state.players[playerIndex];
  if (player.riichi !== 'none') return [];
  const key = tileTypeKey(discard.tile);
  const ids = player.concealed
    .filter((tile) => tileTypeKey(tile) === key)
    .map(idOf)
    .filter((id): id is number => id !== null);
  if (ids.length !== 3) return [];
  return [[ids[0], ids[1], ids[2]]];
}

function rinshanState(
  state: RoundState,
  playerIndex: PlayerIndex,
  pendingKanDora: boolean,
): { state: RoundState; event: RoundEvent } {
  const draw = drawRinshan(state.wall);
  const tileId = idOf(draw.tile);
  if (tileId === null) throw new Error('Rinshan tile must have a physical ID');
  const player = state.players[playerIndex];
  const replacement: RoundPlayerState = {
    ...player,
    concealed: [...player.concealed, draw.tile],
    temporaryFuriten: false,
    drawCount: player.drawCount + 1,
  };
  return {
    state: {
      ...state,
      wall: draw.wall,
      players: replacePlayer(state.players, playerIndex, replacement),
      currentPlayer: playerIndex,
      phase: {
        kind: 'awaiting-discard',
        player: playerIndex,
        drawnTileId: tileId,
        wasLastLiveDraw: false,
        isRinshan: true,
        pendingKanDora,
      },
    },
    event: {
      type: 'TileDrawn',
      player: playerIndex,
      tile: draw.tile,
      wasLastLiveDraw: false,
      isRinshan: true,
    },
  };
}

export function executeAnkan(
  state: RoundState,
  playerIndex: PlayerIndex,
  tileIds: readonly [number, number, number, number],
): { state: RoundState; events: readonly RoundEvent[] } | null {
  const option = legalAnkanOptions(state, playerIndex).find((candidate) => sameIds(candidate, tileIds));
  if (!option || state.phase.kind !== 'awaiting-discard') return null;

  const flushed = flushPendingKanDora(state);
  let working = flushed.state;
  if (working.phase.kind !== 'awaiting-discard') return null;
  const player = working.players[playerIndex];
  const idSet = new Set(option);
  const tiles = player.concealed.filter((tile) => idSet.has(tile.id ?? -1));
  if (tiles.length !== 4) return null;
  const meld: PlayerMeld = { type: 'quad', tiles, isOpen: false };
  let players = replacePlayer(working.players, playerIndex, {
    ...player,
    concealed: player.concealed.filter((tile) => !idSet.has(tile.id ?? -1)),
    melds: [...player.melds, meld],
  });
  players = clearAllIppatsu(players);
  const wall = revealKanDora(working.wall);
  working = {
    ...working,
    wall,
    players,
    callsMade: working.callsMade + 1,
  };
  const rinshan = rinshanState(working, playerIndex, false);
  return {
    state: rinshan.state,
    events: [
      ...flushed.events,
      { type: 'KanDeclared', player: playerIndex, kind: 'ankan' },
      { type: 'KanCompleted', player: playerIndex, kind: 'ankan', meld },
      { type: 'DoraIndicatorRevealed', count: wall.doraIndicators.length },
      rinshan.event,
    ],
  };
}

export function beginShouminkan(
  state: RoundState,
  playerIndex: PlayerIndex,
  meldIndex: number,
  tileId: number,
): { state: RoundState; events: readonly RoundEvent[] } | null {
  const valid = legalShouminkanOptions(state, playerIndex)
    .some((option) => option.meldIndex === meldIndex && option.tileId === tileId);
  if (!valid || state.phase.kind !== 'awaiting-discard') return null;

  const flushed = flushPendingKanDora(state);
  const working = flushed.state;
  if (working.phase.kind !== 'awaiting-discard') return null;
  const player = working.players[playerIndex];
  const tile = player.concealed.find((candidate) => candidate.id === tileId);
  if (!tile) return null;
  const players = replacePlayer(working.players, playerIndex, {
    ...player,
    concealed: player.concealed.filter((candidate) => candidate !== tile),
  });
  return {
    state: {
      ...working,
      players,
      phase: {
        kind: 'kan-reactions',
        declarer: playerIndex,
        meldIndex,
        addedTile: tile,
        ronClaims: [],
      },
    },
    events: [
      ...flushed.events,
      { type: 'KanDeclared', player: playerIndex, kind: 'shouminkan', meldIndex },
    ],
  };
}

export function completeShouminkan(
  state: RoundState,
): { state: RoundState; events: readonly RoundEvent[] } | null {
  if (state.phase.kind !== 'kan-reactions' || state.phase.ronClaims.length > 0) return null;
  const phase = state.phase;
  const player = state.players[phase.declarer];
  const oldMeld = player.melds[phase.meldIndex];
  if (!oldMeld || oldMeld.type !== 'triplet' || oldMeld.isOpen !== true) return null;
  if (tileTypeKey(oldMeld.tiles[0]) !== tileTypeKey(phase.addedTile)) return null;
  const meld: PlayerMeld = {
    ...oldMeld,
    type: 'quad',
    tiles: [...oldMeld.tiles, phase.addedTile],
    isOpen: true,
  };
  const melds = [...player.melds];
  melds[phase.meldIndex] = meld;
  let players = replacePlayer(state.players, phase.declarer, { ...player, melds });
  players = clearAllIppatsu(players);
  const working: RoundState = {
    ...state,
    players,
    callsMade: state.callsMade + 1,
  };
  const rinshan = rinshanState(working, phase.declarer, true);
  return {
    state: rinshan.state,
    events: [
      { type: 'KanCompleted', player: phase.declarer, kind: 'shouminkan', meld },
      rinshan.event,
    ],
  };
}

export function executeDaiminkan(
  state: RoundState,
  claim: CallClaim,
  discard: RoundDiscard,
): { state: RoundState; events: readonly RoundEvent[] } | null {
  if (claim.kind !== 'daiminkan' || state.phase.kind !== 'reactions') return null;
  const valid = legalDaiminkanOptions(state, claim.player, discard)
    .some((option) => sameIds(option, claim.tileIds));
  if (!valid) return null;
  const caller = state.players[claim.player];
  const ids = new Set(claim.tileIds);
  const selected = caller.concealed.filter((tile) => ids.has(tile.id ?? -1));
  if (selected.length !== 3) return null;
  const meld: PlayerMeld = {
    type: 'quad',
    tiles: [...selected, discard.tile],
    isOpen: true,
    calledFrom: state.phase.discarder,
    calledTileId: discard.tileId,
  };
  let players = state.players;
  const discarder = players[state.phase.discarder];
  const discards = [...discarder.discards];
  discards[state.phase.discardIndex] = { ...discard, calledBy: claim.player };
  players = replacePlayer(players, state.phase.discarder, { ...discarder, discards });
  players = replacePlayer(players, claim.player, {
    ...caller,
    concealed: caller.concealed.filter((tile) => !ids.has(tile.id ?? -1)),
    melds: [...caller.melds, meld],
  });
  players = clearAllIppatsu(players);
  const working: RoundState = {
    ...state,
    players,
    callsMade: state.callsMade + 1,
    currentPlayer: claim.player,
  };
  const rinshan = rinshanState(working, claim.player, true);
  return {
    state: rinshan.state,
    events: [
      { type: 'CallMade', player: claim.player, kind: 'daiminkan', meld },
      { type: 'KanCompleted', player: claim.player, kind: 'daiminkan', meld },
      rinshan.event,
    ],
  };
}

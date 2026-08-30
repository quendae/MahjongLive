import { scoreBestCandidate, ScoredHand } from '../scoring/score';
import type { PaymentResult } from '../scoring/payments';
import { sortTiles, tileTypeKey } from '../tiles/tiles';
import type { Tile, Wind } from '../tiles/types';
import { buildWall, drawTile, uraIndicators } from '../wall/wall';
import type { RNG } from '../wall/prng';
import { isRonFuriten, winningTileTypeKeys } from './waits';
import { resolveWinningHands } from './winning';
import type {
  ApplyActionResult,
  CallClaim,
  CallKind,
  EngineError,
  LegalAction,
  PendingRiichi,
  PlayerIndex,
  PlayerMeld,
  RonClaim,
  RoundAction,
  RoundEndResult,
  RoundEvent,
  RoundOptions,
  RoundPlayerState,
  RoundState,
} from './types';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
const WINDS: readonly Wind[] = ['east', 'south', 'west', 'north'];

function nextPlayer(player: PlayerIndex): PlayerIndex {
  return ((player + 1) % 4) as PlayerIndex;
}

export function seatWindFor(player: PlayerIndex, dealer: PlayerIndex): Wind {
  const offset = (player - dealer + 4) % 4;
  return WINDS[offset];
}

function pointForPlayer(
  startingPoints: RoundOptions['startingPoints'],
  player: PlayerIndex,
): number {
  if (Array.isArray(startingPoints)) return startingPoints[player] ?? 25_000;
  return typeof startingPoints === 'number' ? startingPoints : 25_000;
}

function emptyPlayer(points: number): RoundPlayerState {
  return {
    points,
    concealed: [],
    melds: [],
    discards: [],
    riichi: 'none',
    ippatsuEligible: false,
    temporaryFuriten: false,
    riichiFuriten: false,
    drawCount: 0,
    discardCount: 0,
  };
}

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

function replacePoints(
  players: RoundState['players'],
  points: readonly number[],
): RoundState['players'] {
  return playerTuple(players.map((player, index) => ({ ...player, points: points[index] })));
}

function clearAllIppatsu(players: RoundState['players']): RoundState['players'] {
  return playerTuple(players.map((player) => ({ ...player, ippatsuEligible: false })));
}

function error(code: EngineError['code'], message: string): ApplyActionResult {
  return { ok: false, error: { code, message } };
}

function requirePhysicalId(tile: Tile): number | null {
  return typeof tile.id === 'number' ? tile.id : null;
}

export function createRound(rng: RNG, options: RoundOptions = {}): RoundState {
  const dealer = options.dealer ?? 0;
  let wall = buildWall(rng);
  const players: RoundPlayerState[] = PLAYERS.map((player) =>
    emptyPlayer(pointForPlayer(options.startingPoints, player)),
  );

  for (let tileNumber = 0; tileNumber < 13; tileNumber++) {
    for (let offset = 0; offset < 4; offset++) {
      const player = ((dealer + offset) % 4) as PlayerIndex;
      const draw = drawTile(wall);
      wall = draw.wall;
      players[player] = {
        ...players[player],
        concealed: [...players[player].concealed, draw.tile],
      };
    }
  }

  return {
    wall,
    players: playerTuple(players),
    dealer,
    roundWind: options.roundWind ?? 'east',
    honba: Math.max(0, Math.floor(options.honba ?? 0)),
    riichiSticks: Math.max(0, Math.floor(options.riichiSticks ?? 0)),
    currentPlayer: dealer,
    callsMade: 0,
    phase: { kind: 'awaiting-draw', player: dealer },
  };
}

function totalDiscards(state: RoundState): number {
  return state.players.reduce((sum, player) => sum + player.discardCount, 0);
}

function doraContext(state: RoundState) {
  return {
    doraIndicators: state.wall.doraIndicators,
    uraIndicators: uraIndicators(state.wall),
  };
}

function scoreTsumo(state: RoundState, playerIndex: PlayerIndex): ScoredHand | null {
  if (state.phase.kind !== 'awaiting-discard' || state.phase.player !== playerIndex) return null;
  const phase = state.phase;
  if (phase.drawnTileId === null) return null;
  const player = state.players[playerIndex];
  const winningTile = player.concealed.find((tile) => tile.id === phase.drawnTileId);
  if (!winningTile) return null;
  const concealedBeforeWin = player.concealed.filter((tile) => tile !== winningTile);

  const hands = resolveWinningHands({
    concealedBeforeWin,
    winningTile,
    fixedMelds: player.melds,
    winCondition: 'tsumo',
    seatWind: seatWindFor(playerIndex, state.dealer),
    roundWind: state.roundWind,
    isRiichi: player.riichi !== 'none',
    isDoubleRiichi: player.riichi === 'double-riichi',
    isIppatsu: player.ippatsuEligible,
    isHaitei: phase.wasLastLiveDraw,
    isTenhou:
      playerIndex === state.dealer && totalDiscards(state) === 0 && state.callsMade === 0,
    isChiihou:
      playerIndex !== state.dealer &&
      player.drawCount === 1 &&
      player.discardCount === 0 &&
      state.callsMade === 0,
  });
  const score = scoreBestCandidate(
    hands,
    doraContext(state),
    { honba: state.honba, riichiSticks: state.riichiSticks },
  );
  return score?.status === 'scored' ? score : null;
}

function reactionDiscard(state: RoundState) {
  if (state.phase.kind !== 'reactions') return null;
  const discarder = state.players[state.phase.discarder];
  return discarder.discards[state.phase.discardIndex] ?? null;
}

function scoreRonIgnoringFuriten(state: RoundState, playerIndex: PlayerIndex): ScoredHand | null {
  if (state.phase.kind !== 'reactions' || playerIndex === state.phase.discarder) return null;
  const discard = reactionDiscard(state);
  if (!discard) return null;
  const player = state.players[playerIndex];

  const hands = resolveWinningHands({
    concealedBeforeWin: player.concealed,
    winningTile: discard.tile,
    fixedMelds: player.melds,
    winCondition: 'ron',
    seatWind: seatWindFor(playerIndex, state.dealer),
    roundWind: state.roundWind,
    isRiichi: player.riichi !== 'none',
    isDoubleRiichi: player.riichi === 'double-riichi',
    isIppatsu: player.ippatsuEligible,
    isHoutei: discard.wasLastLiveDraw,
  });

  const score = scoreBestCandidate(
    hands,
    doraContext(state),
    { honba: state.honba, riichiSticks: 0 },
  );
  return score?.status === 'scored' ? score : null;
}

function scoreRon(state: RoundState, playerIndex: PlayerIndex): ScoredHand | null {
  const player = state.players[playerIndex];
  if (isRonFuriten(player)) return null;
  return scoreRonIgnoringFuriten(state, playerIndex);
}

function settleTsumo(
  state: RoundState,
  winner: PlayerIndex,
  score: ScoredHand,
): RoundState['players'] {
  const points = state.players.map((player) => player.points);
  const payment = score.payments;

  if (payment.type === 'tsumo-dealer') {
    for (const player of PLAYERS) {
      if (player !== winner) points[player] -= payment.fromEach;
    }
  } else if (payment.type === 'tsumo-nondealer') {
    for (const player of PLAYERS) {
      if (player === winner) continue;
      points[player] -= player === state.dealer
        ? payment.fromDealer
        : payment.fromEachNonDealer;
    }
  }
  points[winner] += payment.winnerGain;
  return replacePoints(state.players, points);
}

function addRiichiBonus(score: ScoredHand, sticks: number): ScoredHand {
  const bonus = Math.max(0, Math.floor(sticks)) * 1000;
  if (bonus === 0) return score;
  const payment = score.payments;
  const payments: PaymentResult = payment.type === 'ron'
    ? { ...payment, riichiBonus: bonus, winnerGain: payment.handPayment + bonus }
    : payment;
  return { ...score, payments };
}

function callPriority(discarder: PlayerIndex, player: PlayerIndex): number {
  return (player - discarder + 4) % 4;
}

function settleRon(
  state: RoundState,
  discarder: PlayerIndex,
  claims: readonly RonClaim[],
): { players: RoundState['players']; winners: readonly RonClaim[] } {
  const points = state.players.map((player) => player.points);
  const stickWinner = claims.reduce((best, claim) =>
    callPriority(discarder, claim.player) < callPriority(discarder, best.player) ? claim : best,
  );

  const winners = claims.map((claim) => ({
    ...claim,
    score: claim.player === stickWinner.player
      ? addRiichiBonus(claim.score, state.riichiSticks)
      : claim.score,
  }));

  for (const claim of winners) {
    if (claim.score.payments.type !== 'ron') continue;
    points[discarder] -= claim.score.payments.fromDiscarder;
    points[claim.player] += claim.score.payments.winnerGain;
  }

  return { players: replacePoints(state.players, points), winners };
}

function endedState(
  state: RoundState,
  result: RoundEndResult,
  players: RoundState['players'],
): RoundState {
  return {
    ...state,
    players,
    riichiSticks: result.type === 'exhaustive-draw' ? state.riichiSticks : 0,
    phase: { kind: 'ended', result },
  };
}

function removeTileById(tiles: readonly Tile[], tileId: number): { tile: Tile; rest: Tile[] } | null {
  const index = tiles.findIndex((tile) => tile.id === tileId);
  if (index < 0) return null;
  const rest = [...tiles];
  const [tile] = rest.splice(index, 1);
  return { tile, rest };
}

function isClosedForRiichi(player: RoundPlayerState): boolean {
  return player.melds.every((meld) => meld.isOpen !== true);
}

function legalRiichiDiscardIds(state: RoundState, playerIndex: PlayerIndex): number[] {
  if (state.phase.kind !== 'awaiting-discard' || state.phase.player !== playerIndex) return [];
  if (state.phase.drawnTileId === null) return [];
  const player = state.players[playerIndex];
  if (player.riichi !== 'none' || player.points < 1000 || !isClosedForRiichi(player)) return [];
  if (state.wall.liveWall.length < 4) return [];

  const ids: number[] = [];
  for (const tile of player.concealed) {
    const tileId = requirePhysicalId(tile);
    if (tileId === null) continue;
    const removed = removeTileById(player.concealed, tileId);
    if (!removed) continue;
    if (winningTileTypeKeys(removed.rest, player.melds).size > 0) ids.push(tileId);
  }
  return ids;
}

function pairOptions(ids: readonly number[]): Array<readonly [number, number]> {
  const options: Array<readonly [number, number]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) options.push([ids[i], ids[j]]);
  }
  return options;
}

function ponOptions(state: RoundState, playerIndex: PlayerIndex): Array<readonly [number, number]> {
  if (state.phase.kind !== 'reactions' || state.phase.discarder === playerIndex) return [];
  const discard = reactionDiscard(state);
  if (!discard || discard.wasLastLiveDraw) return [];
  const player = state.players[playerIndex];
  if (player.riichi !== 'none') return [];
  const key = tileTypeKey(discard.tile);
  const ids = player.concealed
    .filter((tile) => tileTypeKey(tile) === key)
    .map(requirePhysicalId)
    .filter((id): id is number => id !== null);
  return pairOptions(ids);
}

function chiOptions(state: RoundState, playerIndex: PlayerIndex): Array<readonly [number, number]> {
  if (state.phase.kind !== 'reactions') return [];
  if (playerIndex !== nextPlayer(state.phase.discarder)) return [];
  const discard = reactionDiscard(state);
  if (!discard || discard.wasLastLiveDraw || discard.tile.kind !== 'suited') return [];
  const player = state.players[playerIndex];
  if (player.riichi !== 'none') return [];

  const suit = discard.tile.suit;
  const rank = discard.tile.rank;
  const patterns = [
    [rank - 2, rank - 1],
    [rank - 1, rank + 1],
    [rank + 1, rank + 2],
  ].filter(([a, b]) => a >= 1 && b <= 9);
  const options: Array<readonly [number, number]> = [];

  for (const [a, b] of patterns) {
    const first = player.concealed.filter(
      (tile) => tile.kind === 'suited' && tile.suit === suit && tile.rank === a,
    );
    const second = player.concealed.filter(
      (tile) => tile.kind === 'suited' && tile.suit === suit && tile.rank === b,
    );
    for (const left of first) {
      for (const right of second) {
        const leftId = requirePhysicalId(left);
        const rightId = requirePhysicalId(right);
        if (leftId !== null && rightId !== null) options.push([leftId, rightId]);
      }
    }
  }
  return options;
}

function sameOption(a: readonly [number, number], b: readonly [number, number]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function performDiscard(
  state: RoundState,
  playerIndex: PlayerIndex,
  tileId: number,
  pendingRiichi?: PendingRiichi,
): ApplyActionResult {
  if (state.phase.kind !== 'awaiting-discard') {
    return error('WRONG_PHASE', 'A discard requires the awaiting-discard phase');
  }
  if (state.phase.player !== playerIndex) {
    return error('NOT_YOUR_TURN', 'Only the current player may discard');
  }
  const phase = state.phase;
  const player = state.players[playerIndex];
  if (player.riichi !== 'none' && tileId !== phase.drawnTileId) {
    return error('ILLEGAL_RIICHI', 'A Riichi hand must discard the drawn tile');
  }
  const removed = removeTileById(player.concealed, tileId);
  if (!removed) return error('TILE_NOT_FOUND', 'That physical tile is not in the hand');
  const physicalId = requirePhysicalId(removed.tile);
  if (physicalId === null) return error('MISSING_TILE_ID', 'Discarded tile has no physical ID');

  const discard = {
    tile: removed.tile,
    tileId: physicalId,
    tsumogiri: phase.drawnTileId !== null && physicalId === phase.drawnTileId,
    wasLastLiveDraw: phase.wasLastLiveDraw,
  } as const;
  const updatedPlayer: RoundPlayerState = {
    ...player,
    concealed: removed.rest,
    discards: [...player.discards, discard],
    ippatsuEligible: pendingRiichi
      ? player.ippatsuEligible
      : player.riichi !== 'none'
        ? false
        : player.ippatsuEligible,
    discardCount: player.discardCount + 1,
  };
  const discardIndex = updatedPlayer.discards.length - 1;
  const nextState: RoundState = {
    ...state,
    players: replacePlayer(state.players, playerIndex, updatedPlayer),
    phase: {
      kind: 'reactions',
      discarder: playerIndex,
      discardIndex,
      ronClaims: [],
      callClaims: [],
      ...(pendingRiichi ? { pendingRiichi } : {}),
    },
  };
  return {
    ok: true,
    state: nextState,
    events: [{ type: 'TileDiscarded', player: playerIndex, discard }],
  };
}

function markPassedRonFuriten(state: RoundState): RoundState {
  if (state.phase.kind !== 'reactions') return state;
  let players = state.players;
  for (const playerIndex of PLAYERS) {
    if (playerIndex === state.phase.discarder) continue;
    if (state.phase.ronClaims.some((claim) => claim.player === playerIndex)) continue;
    const player = players[playerIndex];
    if (isRonFuriten(player)) continue;
    if (!scoreRonIgnoringFuriten(state, playerIndex)) continue;
    const replacement: RoundPlayerState = player.riichi !== 'none'
      ? { ...player, riichiFuriten: true }
      : { ...player, temporaryFuriten: true };
    players = replacePlayer(players, playerIndex, replacement);
  }
  return { ...state, players };
}

function activatePendingRiichi(state: RoundState): { state: RoundState; event: RoundEvent | null } {
  if (state.phase.kind !== 'reactions' || !state.phase.pendingRiichi) {
    return { state, event: null };
  }
  const pending = state.phase.pendingRiichi;
  const player = state.players[pending.player];
  const replacement: RoundPlayerState = {
    ...player,
    points: player.points - 1000,
    riichi: pending.doubleRiichi ? 'double-riichi' : 'riichi',
    ippatsuEligible: true,
  };
  const phase = { ...state.phase };
  delete phase.pendingRiichi;
  return {
    state: {
      ...state,
      players: replacePlayer(state.players, pending.player, replacement),
      riichiSticks: state.riichiSticks + 1,
      phase,
    },
    event: {
      type: 'RiichiDeclared',
      player: pending.player,
      doubleRiichi: pending.doubleRiichi,
      tileId: pending.tileId,
    },
  };
}

function chooseCall(state: RoundState): CallClaim | null {
  if (state.phase.kind !== 'reactions' || state.phase.callClaims.length === 0) return null;
  const pon = state.phase.callClaims.filter((claim) => claim.kind === 'pon');
  const pool = pon.length > 0 ? pon : state.phase.callClaims.filter((claim) => claim.kind === 'chi');
  if (pool.length === 0) return null;
  return pool.reduce((best, claim) =>
    callPriority(state.phase.kind === 'reactions' ? state.phase.discarder : 0, claim.player) <
    callPriority(state.phase.kind === 'reactions' ? state.phase.discarder : 0, best.player)
      ? claim
      : best,
  );
}

function executeCall(state: RoundState, claim: CallClaim): { state: RoundState; event: RoundEvent } | null {
  if (state.phase.kind !== 'reactions') return null;
  const discard = reactionDiscard(state);
  if (!discard) return null;
  const caller = state.players[claim.player];
  const selected = claim.tileIds.map((id) => caller.concealed.find((tile) => tile.id === id));
  if (selected.some((tile) => !tile)) return null;
  const selectedTiles = selected as Tile[];
  let concealed = [...caller.concealed];
  for (const tile of selectedTiles) concealed = concealed.filter((candidate) => candidate !== tile);

  const meld: PlayerMeld = {
    type: claim.kind === 'chi' ? 'sequence' : 'triplet',
    tiles: claim.kind === 'chi'
      ? sortTiles([...selectedTiles, discard.tile])
      : [...selectedTiles, discard.tile],
    isOpen: true,
    calledFrom: state.phase.discarder,
    calledTileId: discard.tileId,
  };
  let players = state.players;
  const discarderState = players[state.phase.discarder];
  const discards = [...discarderState.discards];
  discards[state.phase.discardIndex] = { ...discard, calledBy: claim.player };
  players = replacePlayer(players, state.phase.discarder, { ...discarderState, discards });
  players = replacePlayer(players, claim.player, {
    ...caller,
    concealed,
    melds: [...caller.melds, meld],
  });
  players = clearAllIppatsu(players);

  return {
    state: {
      ...state,
      players,
      callsMade: state.callsMade + 1,
      currentPlayer: claim.player,
      phase: {
        kind: 'awaiting-discard',
        player: claim.player,
        drawnTileId: null,
        wasLastLiveDraw: false,
      },
    },
    event: { type: 'CallMade', player: claim.player, kind: claim.kind, meld },
  };
}

function notenDeltas(tenpaiPlayers: readonly PlayerIndex[]): readonly [number, number, number, number] {
  const deltas = [0, 0, 0, 0];
  const count = tenpaiPlayers.length;
  if (count === 0 || count === 4) return [0, 0, 0, 0];
  const tenpaiGain = count === 1 ? 3000 : count === 2 ? 1500 : 1000;
  const notenLoss = count === 1 ? 1000 : count === 2 ? 1500 : 3000;
  for (const player of PLAYERS) {
    deltas[player] = tenpaiPlayers.includes(player) ? tenpaiGain : -notenLoss;
  }
  return [deltas[0], deltas[1], deltas[2], deltas[3]];
}

function settleExhaustive(state: RoundState): { result: RoundEndResult; players: RoundState['players'] } {
  const tenpaiPlayers = PLAYERS.filter((player) =>
    winningTileTypeKeys(state.players[player].concealed, state.players[player].melds).size > 0,
  );
  const deltas = notenDeltas(tenpaiPlayers);
  const points = state.players.map((player, index) => player.points + deltas[index]);
  const result: RoundEndResult = { type: 'exhaustive-draw', tenpaiPlayers, notenPayments: deltas };
  return { result, players: replacePoints(state.players, points) };
}

export function getLegalActions(state: RoundState, player: PlayerIndex): LegalAction[] {
  if (state.phase.kind === 'ended') return [];

  if (state.phase.kind === 'awaiting-draw') {
    return state.phase.player === player && state.wall.liveWall.length > 0
      ? [{ type: 'draw' }]
      : [];
  }

  if (state.phase.kind === 'awaiting-discard') {
    if (state.phase.player !== player) return [];
    const roundPlayer = state.players[player];
    const allIds = roundPlayer.concealed
      .map(requirePhysicalId)
      .filter((id): id is number => id !== null);
    const discardIds = roundPlayer.riichi !== 'none'
      ? state.phase.drawnTileId === null ? [] : [state.phase.drawnTileId]
      : allIds;
    const actions: LegalAction[] = [{ type: 'discard', tileIds: discardIds }];
    const riichiIds = legalRiichiDiscardIds(state, player);
    if (riichiIds.length > 0) actions.push({ type: 'riichi-discard', tileIds: riichiIds });
    if (scoreTsumo(state, player)) actions.push({ type: 'tsumo' });
    return actions;
  }

  if (state.phase.discarder === player) return [];
  if (
    state.phase.ronClaims.some((claim) => claim.player === player) ||
    state.phase.callClaims.some((claim) => claim.player === player)
  ) return [];

  const actions: LegalAction[] = [];
  if (scoreRon(state, player)) actions.push({ type: 'ron' });
  const pon = ponOptions(state, player);
  if (pon.length > 0) actions.push({ type: 'pon', options: pon });
  const chi = chiOptions(state, player);
  if (chi.length > 0) actions.push({ type: 'chi', options: chi });
  return actions;
}

export function applyAction(state: RoundState, action: RoundAction): ApplyActionResult {
  if (state.phase.kind === 'ended') {
    return error('ROUND_ENDED', 'The round has already ended');
  }

  if (action.type === 'draw') {
    if (state.phase.kind !== 'awaiting-draw') {
      return error('WRONG_PHASE', 'A tile can only be drawn in the awaiting-draw phase');
    }
    if (state.phase.player !== action.player) {
      return error('NOT_YOUR_TURN', 'Only the current player may draw');
    }
    if (state.wall.liveWall.length === 0) {
      return error('NO_LIVE_TILES', 'The live wall is empty');
    }

    const draw = drawTile(state.wall);
    const tileId = requirePhysicalId(draw.tile);
    if (tileId === null) return error('MISSING_TILE_ID', 'Round wall tile has no physical ID');
    const player = state.players[action.player];
    const updatedPlayer: RoundPlayerState = {
      ...player,
      concealed: [...player.concealed, draw.tile],
      temporaryFuriten: false,
      drawCount: player.drawCount + 1,
    };
    const wasLastLiveDraw = draw.wall.liveWall.length === 0;
    const nextState: RoundState = {
      ...state,
      wall: draw.wall,
      players: replacePlayer(state.players, action.player, updatedPlayer),
      currentPlayer: action.player,
      phase: {
        kind: 'awaiting-discard',
        player: action.player,
        drawnTileId: tileId,
        wasLastLiveDraw,
      },
    };
    return {
      ok: true,
      state: nextState,
      events: [{ type: 'TileDrawn', player: action.player, tile: draw.tile, wasLastLiveDraw }],
    };
  }

  if (action.type === 'discard') {
    return performDiscard(state, action.player, action.tileId);
  }

  if (action.type === 'riichi-discard') {
    const legalIds = legalRiichiDiscardIds(state, action.player);
    if (!legalIds.includes(action.tileId)) {
      return error('ILLEGAL_RIICHI', 'That discard is not a legal Riichi declaration');
    }
    const player = state.players[action.player];
    const pending: PendingRiichi = {
      player: action.player,
      tileId: action.tileId,
      doubleRiichi: player.discardCount === 0 && state.callsMade === 0,
    };
    return performDiscard(state, action.player, action.tileId, pending);
  }

  if (action.type === 'tsumo') {
    if (state.phase.kind !== 'awaiting-discard') {
      return error('WRONG_PHASE', 'Tsumo requires the awaiting-discard phase');
    }
    if (state.phase.player !== action.player) {
      return error('NOT_YOUR_TURN', 'Only the current player may declare Tsumo');
    }
    const score = scoreTsumo(state, action.player);
    if (!score) return error('ILLEGAL_WIN', 'The current draw is not a legal scored Tsumo');
    const result: RoundEndResult = { type: 'tsumo', winner: action.player, score };
    const nextState = endedState(state, result, settleTsumo(state, action.player, score));
    const events: RoundEvent[] = [
      { type: 'HandWon', result },
      { type: 'RoundEnded', result },
    ];
    return { ok: true, state: nextState, events };
  }

  if (action.type === 'ron') {
    if (state.phase.kind !== 'reactions') {
      return error('WRONG_PHASE', 'Ron may only be claimed during a reaction window');
    }
    if (state.phase.discarder === action.player) {
      return error('CANNOT_RON_OWN_DISCARD', 'A player cannot Ron their own discard');
    }
    if (state.phase.ronClaims.some((claim) => claim.player === action.player)) {
      return error('DUPLICATE_RON_CLAIM', 'This player has already claimed Ron');
    }
    if (state.phase.callClaims.some((claim) => claim.player === action.player)) {
      return error('DUPLICATE_CALL_CLAIM', 'This player already submitted a call response');
    }
    const rawScore = scoreRonIgnoringFuriten(state, action.player);
    if (!rawScore) return error('ILLEGAL_WIN', 'The discard is not a legal scored Ron for this player');
    if (isRonFuriten(state.players[action.player])) {
      return error('FURITEN', 'This player is Furiten and cannot win by Ron');
    }
    const discard = reactionDiscard(state)!;
    const claim: RonClaim = { player: action.player, score: rawScore };
    const nextState: RoundState = {
      ...state,
      phase: { ...state.phase, ronClaims: [...state.phase.ronClaims, claim] },
    };
    return {
      ok: true,
      state: nextState,
      events: [{
        type: 'RonClaimed',
        player: action.player,
        discarder: state.phase.discarder,
        tile: discard.tile,
      }],
    };
  }

  if (action.type === 'chi' || action.type === 'pon') {
    if (state.phase.kind !== 'reactions') {
      return error('WRONG_PHASE', 'Calls may only be claimed during a reaction window');
    }
    if (
      state.phase.callClaims.some((claim) => claim.player === action.player) ||
      state.phase.ronClaims.some((claim) => claim.player === action.player)
    ) {
      return error('DUPLICATE_CALL_CLAIM', 'This player already submitted a reaction claim');
    }
    const options = action.type === 'chi'
      ? chiOptions(state, action.player)
      : ponOptions(state, action.player);
    if (!options.some((option) => sameOption(option, action.tileIds))) {
      return error('ILLEGAL_CALL', `Those tiles do not form a legal ${action.type}`);
    }
    const claim: CallClaim = { player: action.player, kind: action.type, tileIds: action.tileIds };
    return {
      ok: true,
      state: {
        ...state,
        phase: { ...state.phase, callClaims: [...state.phase.callClaims, claim] },
      },
      events: [{
        type: 'CallClaimed',
        player: action.player,
        kind: action.type,
        discarder: state.phase.discarder,
      }],
    };
  }

  if (state.phase.kind !== 'reactions') {
    return error('WRONG_PHASE', 'Reactions can only be resolved after a discard');
  }

  if (state.phase.ronClaims.length > 0) {
    // A Ron on a Riichi declaration discard prevents that declaration from completing, so the
    // pending 1,000-point deposit is intentionally absent from state. Existing table sticks still
    // go to the nearest Ron winner.
    const settled = settleRon(state, state.phase.discarder, state.phase.ronClaims);
    const result: RoundEndResult = {
      type: 'ron',
      discarder: state.phase.discarder,
      winners: settled.winners,
    };
    const nextState = endedState(state, result, settled.players);
    const events: RoundEvent[] = [
      { type: 'HandWon', result },
      { type: 'RoundEnded', result },
    ];
    return { ok: true, state: nextState, events };
  }

  let working = markPassedRonFuriten(state);
  const activated = activatePendingRiichi(working);
  working = activated.state;
  const events: RoundEvent[] = activated.event ? [activated.event] : [];

  const selectedCall = chooseCall(working);
  if (selectedCall) {
    const called = executeCall(working, selectedCall);
    if (!called) return error('ILLEGAL_CALL', 'The selected call could not be applied');
    return { ok: true, state: called.state, events: [...events, called.event] };
  }

  const discard = reactionDiscard(working);
  if (!discard) return error('WRONG_PHASE', 'Reaction window does not reference a valid discard');
  if (discard.wasLastLiveDraw) {
    const exhaustive = settleExhaustive(working);
    const nextState = endedState(working, exhaustive.result, exhaustive.players);
    return {
      ok: true,
      state: nextState,
      events: [...events, { type: 'RoundEnded', result: exhaustive.result }],
    };
  }

  const player = nextPlayer(working.phase.kind === 'reactions' ? working.phase.discarder : 0);
  const nextState: RoundState = {
    ...working,
    currentPlayer: player,
    phase: { kind: 'awaiting-draw', player },
  };
  return { ok: true, state: nextState, events };
}

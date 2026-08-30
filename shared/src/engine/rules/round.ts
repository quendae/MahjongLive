import { scoreBestCandidate, ScoredHand } from '../scoring/score';
import type { PaymentResult } from '../scoring/payments';
import type { Tile, Wind } from '../tiles/types';
import { buildWall, drawTile } from '../wall/wall';
import type { RNG } from '../wall/prng';
import { resolveWinningHands } from './winning';
import type {
  ApplyActionResult,
  EngineError,
  LegalAction,
  PlayerIndex,
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

  // The shuffled wall already abstracts the physical break point. Round-robin dealing keeps the
  // deterministic replay contract simple while giving every player exactly 13 physical tiles.
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

function scoreTsumo(state: RoundState, playerIndex: PlayerIndex): ScoredHand | null {
  if (state.phase.kind !== 'awaiting-discard' || state.phase.player !== playerIndex) return null;
  const player = state.players[playerIndex];
  const winningTile = player.concealed.find((tile) => tile.id === state.phase.drawnTileId);
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
    isHaitei: state.phase.wasLastLiveDraw,
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
    { doraIndicators: state.wall.doraIndicators },
    { honba: state.honba, riichiSticks: state.riichiSticks },
  );
  return score?.status === 'scored' ? score : null;
}

function reactionDiscard(state: RoundState) {
  if (state.phase.kind !== 'reactions') return null;
  const discarder = state.players[state.phase.discarder];
  return discarder.discards[state.phase.discardIndex] ?? null;
}

function scoreRon(state: RoundState, playerIndex: PlayerIndex): ScoredHand | null {
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

  // Riichi sticks are allocated once when simultaneous Ron claims are resolved, never once per
  // claim. Honba, however, is paid to every Ron winner.
  const score = scoreBestCandidate(
    hands,
    { doraIndicators: state.wall.doraIndicators },
    { honba: state.honba, riichiSticks: 0 },
  );
  return score?.status === 'scored' ? score : null;
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

function ronPriority(discarder: PlayerIndex, player: PlayerIndex): number {
  return (player - discarder + 4) % 4;
}

function settleRon(
  state: RoundState,
  discarder: PlayerIndex,
  claims: readonly RonClaim[],
): { players: RoundState['players']; winners: readonly RonClaim[] } {
  const points = state.players.map((player) => player.points);
  const stickWinner = claims.reduce((best, claim) =>
    ronPriority(discarder, claim.player) < ronPriority(discarder, best.player) ? claim : best,
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
    riichiSticks: 0,
    phase: { kind: 'ended', result },
  };
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
    const tileIds = state.players[player].concealed
      .map(requirePhysicalId)
      .filter((id): id is number => id !== null);
    const actions: LegalAction[] = [{ type: 'discard', tileIds }];
    if (scoreTsumo(state, player)) actions.push({ type: 'tsumo' });
    return actions;
  }

  if (state.phase.kind === 'reactions') {
    if (state.phase.discarder === player) return [];
    if (state.phase.ronClaims.some((claim) => claim.player === player)) return [];
    return scoreRon(state, player) ? [{ type: 'ron' }] : [];
  }

  return [];
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
    if (state.phase.kind !== 'awaiting-discard') {
      return error('WRONG_PHASE', 'A discard requires the awaiting-discard phase');
    }
    if (state.phase.player !== action.player) {
      return error('NOT_YOUR_TURN', 'Only the current player may discard');
    }
    const player = state.players[action.player];
    const tileIndex = player.concealed.findIndex((tile) => tile.id === action.tileId);
    if (tileIndex < 0) return error('TILE_NOT_FOUND', 'That physical tile is not in the hand');
    const tile = player.concealed[tileIndex];
    const tileId = requirePhysicalId(tile);
    if (tileId === null) return error('MISSING_TILE_ID', 'Discarded tile has no physical ID');
    const concealed = [...player.concealed];
    concealed.splice(tileIndex, 1);
    const discard = {
      tile,
      tileId,
      tsumogiri: tileId === state.phase.drawnTileId,
      wasLastLiveDraw: state.phase.wasLastLiveDraw,
    } as const;
    const updatedPlayer: RoundPlayerState = {
      ...player,
      concealed,
      discards: [...player.discards, discard],
      discardCount: player.discardCount + 1,
    };
    const discardIndex = updatedPlayer.discards.length - 1;
    const nextState: RoundState = {
      ...state,
      players: replacePlayer(state.players, action.player, updatedPlayer),
      phase: { kind: 'reactions', discarder: action.player, discardIndex, ronClaims: [] },
    };
    return {
      ok: true,
      state: nextState,
      events: [{ type: 'TileDiscarded', player: action.player, discard }],
    };
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
    const score = scoreRon(state, action.player);
    if (!score) return error('ILLEGAL_WIN', 'The discard is not a legal scored Ron for this player');
    const discard = reactionDiscard(state)!;
    const claim: RonClaim = { player: action.player, score };
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

  if (state.phase.kind !== 'reactions') {
    return error('WRONG_PHASE', 'Reactions can only be resolved after a discard');
  }

  if (state.phase.ronClaims.length > 0) {
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

  const discard = reactionDiscard(state);
  if (!discard) return error('WRONG_PHASE', 'Reaction window does not reference a valid discard');
  if (discard.wasLastLiveDraw) {
    const result: RoundEndResult = { type: 'exhaustive-draw' };
    const nextState = endedState(state, result, state.players);
    return { ok: true, state: nextState, events: [{ type: 'RoundEnded', result }] };
  }

  const player = nextPlayer(state.phase.discarder);
  const nextState: RoundState = {
    ...state,
    currentPlayer: player,
    phase: { kind: 'awaiting-draw', player },
  };
  return { ok: true, state: nextState, events: [] };
}

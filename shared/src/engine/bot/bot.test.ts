import { describe, expect, it } from 'vitest';
import { applyAction, createRound } from '../rules/round';
import type { RoundDiscard, RoundState } from '../rules/types';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { createRNG } from '../wall/prng';
import { chooseBotDecision, evaluateDiscard } from './bot';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

function hand(spec: Array<[Tile, number]>): Tile[] {
  return spec.map(([tile, id]) => physical(tile, id));
}

const m = (rank: 1|2|3|4|5|6|7|8|9) => suited('man', rank);
const p = (rank: 1|2|3|4|5|6|7|8|9) => suited('pin', rank);
const s = (rank: 1|2|3|4|5|6|7|8|9) => suited('sou', rank);

function withPlayerHand(tiles: Tile[], drawnTileId: number): RoundState {
  const base = createRound(createRNG(100));
  const players = [...base.players] as RoundState['players'][number][];
  players[0] = { ...players[0], concealed: tiles };
  return {
    ...base,
    players: players as unknown as RoundState['players'],
    currentPlayer: 0,
    phase: { kind: 'awaiting-discard', player: 0, drawnTileId, wasLastLiveDraw: false },
  };
}

describe('bot wins and mandatory actions', () => {
  it('takes Tsumo immediately when legal', () => {
    const tiles = hand([
      [m(1), 1], [m(2), 2], [m(3), 3],
      [p(1), 4], [p(2), 5], [p(3), 6],
      [s(1), 7], [s(2), 8], [s(3), 9],
      [s(4), 10], [s(5), 11], [s(6), 12],
      [p(7), 13], [p(7), 14],
    ]);
    const state = withPlayerHand(tiles, 14);
    expect(chooseBotDecision(state, 0)).toEqual({ type: 'action', action: { type: 'tsumo', player: 0 } });
  });

  it('takes Ron immediately when legal', () => {
    const base = createRound(createRNG(101));
    const waiting = hand([
      [m(1), 21], [m(2), 22], [m(3), 23],
      [p(1), 24], [p(2), 25], [p(3), 26],
      [s(1), 27], [s(2), 28], [s(3), 29],
      [s(4), 30], [s(5), 31], [s(6), 32],
      [p(7), 33],
    ]);
    const discardTile = physical(p(7), 40);
    const discard: RoundDiscard = { tile: discardTile, tileId: 40, tsumogiri: false, wasLastLiveDraw: false };
    const players = [...base.players] as RoundState['players'][number][];
    players[0] = { ...players[0], concealed: waiting };
    players[1] = { ...players[1], discards: [discard], discardCount: 1 };
    const state: RoundState = {
      ...base,
      players: players as unknown as RoundState['players'],
      currentPlayer: 1,
      phase: { kind: 'reactions', discarder: 1, discardIndex: 0, ronClaims: [], callClaims: [] },
    };
    expect(chooseBotDecision(state, 0)).toEqual({ type: 'action', action: { type: 'ron', player: 0 } });
  });

  it('obeys forced tsumogiri after Riichi', () => {
    const tiles = hand([
      [m(1), 51], [m(2), 52], [m(3), 53], [p(1), 54], [p(2), 55], [p(3), 56],
      [s(1), 57], [s(2), 58], [s(4), 59], [s(5), 60], [s(6), 61],
      [m(7), 62], [m(7), 63], [p(9), 64],
    ]);
    const state = withPlayerHand(tiles, 64);
    const players = [...state.players] as RoundState['players'][number][];
    players[0] = { ...players[0], riichi: 'riichi' };
    const riichiState = { ...state, players: players as unknown as RoundState['players'] };
    const decision = chooseBotDecision(riichiState, 0);
    expect(decision).toEqual({ type: 'action', action: { type: 'discard', player: 0, tileId: 64 } });
  });
});

describe('discard heuristics', () => {
  it('prefers the discard that reaches lower shanten', () => {
    const tiles = hand([
      [m(1), 101], [m(2), 102], [m(3), 103],
      [p(1), 104], [p(2), 105], [p(3), 106],
      [s(1), 107], [s(2), 108], [s(3), 109],
      [m(7), 110], [m(7), 111],
      [p(4), 112], [p(5), 113], [wind('east'), 114],
    ]);
    const state = withPlayerHand(tiles, 114);
    const east = evaluateDiscard(state, 0, 114);
    const fourPin = evaluateDiscard(state, 0, 112);
    expect(east).not.toBeNull();
    expect(fourPin).not.toBeNull();
    expect(east!.shanten).toBeLessThan(fourPin!.shanten);

    const decision = chooseBotDecision(state, 0);
    expect(decision.type).toBe('action');
    if (decision.type !== 'action' || decision.action.type !== 'discard') return;
    expect(decision.action.tileId).toBe(114);
  });

  it('prefers genbutsu between equivalent discards against Riichi', () => {
    const tiles = hand([
      [m(1), 201], [m(2), 202], [m(3), 203],
      [p(1), 204], [p(2), 205], [p(3), 206],
      [s(1), 207], [s(2), 208], [s(3), 209],
      [m(7), 210], [m(7), 211], [p(4), 212],
      [wind('east'), 213], [wind('south'), 214],
    ]);
    const state = withPlayerHand(tiles, 214);
    const safeDiscard: RoundDiscard = {
      tile: physical(wind('east'), 300), tileId: 300, tsumogiri: false, wasLastLiveDraw: false,
    };
    const players = [...state.players] as RoundState['players'][number][];
    players[1] = { ...players[1], riichi: 'riichi', discards: [safeDiscard], discardCount: 1 };
    const dangerState = { ...state, players: players as unknown as RoundState['players'] };

    const east = evaluateDiscard(dangerState, 0, 213)!;
    const south = evaluateDiscard(dangerState, 0, 214)!;
    expect(east.shanten).toBe(south.shanten);
    expect(east.danger).toBeLessThan(south.danger);

    const decision = chooseBotDecision(dangerState, 0);
    expect(decision.type).toBe('action');
    if (decision.type !== 'action' || decision.action.type !== 'discard') return;
    expect(decision.action.tileId).toBe(213);
  });

  it('returns an action accepted by the reducer', () => {
    const state = createRound(createRNG(404));
    const draw = applyAction(state, { type: 'draw', player: state.dealer });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    const decision = chooseBotDecision(draw.state, state.dealer);
    expect(decision.type).toBe('action');
    if (decision.type !== 'action') return;
    expect(applyAction(draw.state, decision.action).ok).toBe(true);
  });
});

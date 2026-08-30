import { describe, expect, it } from 'vitest';
import { createRound } from '../rules/round';
import type { PlayerIndex, RoundDiscard, RoundState } from '../rules/types';
import { dragon, suited } from '../tiles/tiles';
import type { SuitRank, Tile } from '../tiles/types';
import { createRNG } from '../wall/prng';
import { chooseBotDecisionForDifficulty, normalizeBotDifficulty } from './difficulty';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

const m = (rank: SuitRank) => suited('man', rank);
const p = (rank: SuitRank) => suited('pin', rank);
const s = (rank: SuitRank) => suited('sou', rank);

function ukeireChoiceFixture(): RoundState {
  const base = createRound(createRNG(7012));
  const hand = [
    physical(m(1), 101), physical(m(2), 102), physical(m(3), 103),
    physical(p(1), 104), physical(p(2), 105), physical(p(3), 106),
    physical(s(1), 107), physical(s(2), 108), physical(s(3), 109),
    physical(s(4), 110), physical(s(5), 111),
    physical(p(7), 113), physical(p(7), 114), physical(p(7), 115),
  ];
  const players = [...base.players] as RoundState['players'][number][];
  // Keep Riichi unavailable so this fixture measures only the discard profile. Several discards
  // preserve the same structural distance; Expert may override Standard's shape tie-break when
  // public-information ukeire identifies a wider continuation.
  players[0] = { ...players[0], points: 900, concealed: hand, melds: [], discards: [] };
  return {
    ...base,
    players: players as unknown as RoundState['players'],
    currentPlayer: 0,
    phase: { kind: 'awaiting-discard', player: 0, drawnTileId: 115, wasLastLiveDraw: false },
  };
}

function valueHonorReactionFixture(): RoundState {
  const base = createRound(createRNG(7013));
  const red1 = physical(dragon('red'), 401);
  const red2 = physical(dragon('red'), 402);
  const botHand = [
    red1, red2,
    physical(m(1), 403), physical(m(2), 404), physical(m(3), 405),
    physical(m(4), 406), physical(m(5), 407), physical(m(6), 408),
    physical(p(7), 409), physical(p(8), 410),
    physical(s(5), 411), physical(s(5), 412),
    physical(s(9), 413),
  ];
  const discardTile = physical(dragon('red'), 499);
  const discard: RoundDiscard = {
    tile: discardTile,
    tileId: discardTile.id!,
    tsumogiri: false,
    wasLastLiveDraw: false,
  };
  const discarder: PlayerIndex = 1;
  const players = [...base.players] as RoundState['players'][number][];
  players[0] = { ...players[0], concealed: botHand, melds: [], discards: [] };
  players[discarder] = { ...players[discarder], discards: [discard], discardCount: 1 };
  return {
    ...base,
    players: players as unknown as RoundState['players'],
    currentPlayer: discarder,
    phase: { kind: 'reactions', discarder, discardIndex: 0, ronClaims: [], callClaims: [] },
  };
}

describe('bot difficulty profiles', () => {
  it('uses ukeire only on Expert when base heuristics choose another equal-distance discard', () => {
    const state = ukeireChoiceFixture();
    const standard = chooseBotDecisionForDifficulty(state, 0, 'standard');
    const expert = chooseBotDecisionForDifficulty(state, 0, 'expert');

    expect(standard).toEqual({ type: 'action', action: { type: 'discard', player: 0, tileId: 107 } });
    expect(expert).toEqual({ type: 'action', action: { type: 'discard', player: 0, tileId: 113 } });
  });

  it('keeps Casual closed while Standard may take a yaku-safe value-honor Pon', () => {
    const state = valueHonorReactionFixture();
    expect(chooseBotDecisionForDifficulty(state, 0, 'casual')).toEqual({ type: 'pass' });

    const standard = chooseBotDecisionForDifficulty(state, 0, 'standard');
    expect(standard.type).toBe('action');
    if (standard.type !== 'action') return;
    expect(standard.action.type).toBe('pon');
  });

  it('normalizes unknown persisted values to the requested fallback', () => {
    expect(normalizeBotDifficulty('standard')).toBe('standard');
    expect(normalizeBotDifficulty('legacy-value')).toBe('expert');
    expect(normalizeBotDifficulty(undefined, 'casual')).toBe('casual');
  });
});

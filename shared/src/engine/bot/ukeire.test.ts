import { describe, expect, it } from 'vitest';
import { createRound } from '../rules/round';
import type { RoundDiscard, RoundState } from '../rules/types';
import { suited, wind } from '../tiles/tiles';
import type { SuitRank, Tile } from '../tiles/types';
import { createRNG } from '../wall/prng';
import { evaluateDiscard, evaluateDiscardUkeire } from './bot';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

const m = (rank: SuitRank) => suited('man', rank);
const p = (rank: SuitRank) => suited('pin', rank);
const s = (rank: SuitRank) => suited('sou', rank);

function fixture(): RoundState {
  const base = createRound(createRNG(7001));
  const hand = [
    physical(m(1), 101), physical(m(2), 102), physical(m(3), 103),
    physical(p(1), 104), physical(p(2), 105), physical(p(3), 106),
    physical(s(1), 107), physical(s(2), 108), physical(s(3), 109),
    physical(s(4), 110), physical(s(5), 111), physical(s(6), 112),
    physical(p(7), 113), physical(p(7), 114),
  ];
  const players = [...base.players] as RoundState['players'][number][];
  players[0] = { ...players[0], concealed: hand, melds: [], discards: [] };
  return {
    ...base,
    players: players as unknown as RoundState['players'],
    wall: { ...base.wall, doraIndicators: [physical(wind('east'), 900)] },
    currentPlayer: 0,
    phase: { kind: 'awaiting-discard', player: 0, drawnTileId: 114, wasLastLiveDraw: false },
  };
}

describe('bot ukeire', () => {
  it('counts wider waits higher when two discards leave the same shanten', () => {
    const state = fixture();
    expect(evaluateDiscard(state, 0, 110)?.shanten).toBe(0);
    expect(evaluateDiscard(state, 0, 113)?.shanten).toBe(0);

    // Discarding 4s leaves 56s: 3 remaining 4s + four 7s = 7 effective tiles.
    expect(evaluateDiscardUkeire(state, 0, 110)).toBe(7);
    // Discarding one 7p leaves a tanki 7p wait; both physical 7p are already known to the bot.
    expect(evaluateDiscardUkeire(state, 0, 113)).toBe(2);
  });

  it('deduplicates a called discard that also appears inside the public meld', () => {
    const base = fixture();
    const called = physical(s(7), 300);
    const discard: RoundDiscard = {
      tile: called,
      tileId: 300,
      tsumogiri: false,
      wasLastLiveDraw: false,
      calledBy: 1,
    };
    const players = [...base.players] as RoundState['players'][number][];
    players[2] = {
      ...players[2],
      discards: [discard],
      discardCount: 1,
    };
    players[1] = {
      ...players[1],
      melds: [{
        type: 'triplet',
        tiles: [called, physical(s(7), 301), physical(s(7), 302)],
        isOpen: true,
        calledFrom: 2,
        calledTileId: 300,
      }],
    };
    const state: RoundState = { ...base, players: players as unknown as RoundState['players'] };

    // Three physical 7s are visible, not four: the river copy and meld copy with id=300 are one tile.
    // The 4s/7s wait therefore has 3 remaining 4s + 1 remaining 7s.
    expect(evaluateDiscardUkeire(state, 0, 110)).toBe(4);
  });
});

import { describe, expect, it } from 'vitest';
import { createRound } from '../rules/round';
import type { RoundState } from '../rules/types';
import { suited, wind } from '../tiles/tiles';
import type { SuitRank, Tile } from '../tiles/types';
import { createRNG } from '../wall/prng';
import { evaluateDiscardAdvice } from './advisor';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

const m = (rank: SuitRank) => suited('man', rank);
const p = (rank: SuitRank) => suited('pin', rank);
const s = (rank: SuitRank) => suited('sou', rank);

function fixture(): RoundState {
  const base = createRound(createRNG(7111));
  const human = [
    physical(m(1), 101), physical(m(2), 102), physical(m(3), 103),
    physical(p(1), 104), physical(p(2), 105), physical(p(3), 106),
    physical(s(1), 107), physical(s(2), 108), physical(s(3), 109),
    physical(s(4), 210), physical(s(5), 111), physical(s(6), 112),
    physical(p(7), 113), physical(p(7), 114),
  ];
  const players = [...base.players] as RoundState['players'][number][];
  players[0] = { ...players[0], concealed: human, melds: [], discards: [] };
  return {
    ...base,
    players: players as unknown as RoundState['players'],
    wall: { ...base.wall, doraIndicators: [physical(wind('east'), 900)] },
    currentPlayer: 0,
    phase: { kind: 'awaiting-discard', player: 0, drawnTileId: 114, wasLastLiveDraw: false },
  };
}

describe('single-player discard advisor', () => {
  it('recommends the wider tenpai discard and reports shanten/ukeire', () => {
    const state = fixture();
    const advice = evaluateDiscardAdvice(state, 0, [113, 210]);
    const wide = advice.find((entry) => entry.tileId === 210);
    const tanki = advice.find((entry) => entry.tileId === 113);

    expect(wide).toMatchObject({ shanten: 0, ukeire: 7, recommended: true });
    expect(tanki).toMatchObject({ shanten: 0, ukeire: 2, recommended: false });
  });

  it('is invariant when only hidden opponent concealed hands change', () => {
    const state = fixture();
    const before = evaluateDiscardAdvice(state, 0, [113, 210]);
    const players = [...state.players] as RoundState['players'][number][];
    players[1] = {
      ...players[1],
      concealed: Array.from({ length: 13 }, (_, index) => physical(m(((index % 9) + 1) as SuitRank), 1000 + index)),
    };
    players[2] = {
      ...players[2],
      concealed: Array.from({ length: 13 }, (_, index) => physical(p(((index % 9) + 1) as SuitRank), 1100 + index)),
    };
    players[3] = {
      ...players[3],
      concealed: Array.from({ length: 13 }, (_, index) => physical(s(((index % 9) + 1) as SuitRank), 1200 + index)),
    };
    const hiddenChanged: RoundState = { ...state, players: players as unknown as RoundState['players'] };

    expect(evaluateDiscardAdvice(hiddenChanged, 0, [113, 210])).toEqual(before);
  });
});

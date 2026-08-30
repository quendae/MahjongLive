import { describe, expect, it } from 'vitest';
import type { ScoredHand } from '../scoring/score';
import { createRNG } from '../wall/prng';
import type { PlayerIndex, RoundEndResult } from '../rules/types';
import { advanceMatch, createMatch, rankMatchPlayers } from './match';
import type { MatchState } from './types';

const fakeScore = {} as ScoredHand;

function withEndedRound(
  state: MatchState,
  result: RoundEndResult,
  points?: readonly [number, number, number, number],
  riichiSticks = state.round.riichiSticks,
): MatchState {
  const players = state.round.players.map((player, index) => ({
    ...player,
    points: points?.[index] ?? player.points,
  })) as unknown as MatchState['round']['players'];
  return {
    ...state,
    round: {
      ...state.round,
      players,
      riichiSticks,
      phase: { kind: 'ended', result },
    },
  };
}

function exhaustive(tenpaiPlayers: readonly PlayerIndex[] = []): RoundEndResult {
  return {
    type: 'exhaustive-draw',
    tenpaiPlayers,
    notenPayments: [0, 0, 0, 0],
  };
}

function nonDealerRon(discarder: PlayerIndex, winner: PlayerIndex): RoundEndResult {
  return {
    type: 'ron',
    discarder,
    winners: [{ player: winner, score: fakeScore }],
  };
}

describe('hanchan progression', () => {
  it('rotates East 1 through South 4 and ends there when target is reached', () => {
    const rng = createRNG(123);
    let state = createMatch(rng);
    const expected = [
      ['east', 2], ['east', 3], ['east', 4],
      ['south', 1], ['south', 2], ['south', 3], ['south', 4],
    ] as const;

    for (const [wind, hand] of expected) {
      const ended = withEndedRound(state, exhaustive([]));
      const advanced = advanceMatch(ended, rng);
      expect(advanced.ok).toBe(true);
      if (!advanced.ok) return;
      state = advanced.state;
      expect([state.wind, state.hand]).toEqual([wind, hand]);
    }

    const south4 = withEndedRound(
      state,
      exhaustive([]),
      [31_000, 24_000, 23_000, 22_000],
    );
    const ended = advanceMatch(south4, rng);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.startedNextRound).toBe(false);
    expect(ended.state.status).toBe('ended');
    expect(ended.state.result?.reason).toBe('all-last');
  });

  it('enters West 1 when South 4 ends without a 30000-point leader', () => {
    const rng = createRNG(321);
    let state = createMatch(rng);
    state = {
      ...state,
      wind: 'south',
      hand: 4,
      round: { ...state.round, dealer: 3, roundWind: 'south' },
    };
    const ended = withEndedRound(state, exhaustive([]), [25_000, 25_000, 25_000, 25_000]);
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.status).toBe('playing');
    expect([advanced.state.wind, advanced.state.hand]).toEqual(['west', 1]);
  });

  it('uses sudden death in West but gives dealer repeat precedence', () => {
    const rng = createRNG(11);
    let state = createMatch(rng);
    state = {
      ...state,
      wind: 'west',
      hand: 1,
      round: { ...state.round, dealer: 0, roundWind: 'west' },
    };

    const repeat = withEndedRound(
      state,
      { type: 'tsumo', winner: 0, score: fakeScore },
      [29_000, 31_000, 20_000, 20_000],
    );
    const repeated = advanceMatch(repeat, rng);
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) return;
    expect(repeated.state.status).toBe('playing');
    expect([repeated.state.wind, repeated.state.hand, repeated.state.round.dealer]).toEqual(['west', 1, 0]);

    const rotates = withEndedRound(
      repeated.state,
      nonDealerRon(0, 1),
      [27_000, 33_000, 20_000, 20_000],
    );
    const finished = advanceMatch(rotates, rng);
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.state.result?.reason).toBe('sudden-death');
  });
});

describe('dealer repeat and honba', () => {
  it('repeats after dealer win and increments honba', () => {
    const rng = createRNG(1);
    const state = createMatch(rng);
    const ended = withEndedRound(state, { type: 'tsumo', winner: 0, score: fakeScore });
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.round.dealer).toBe(0);
    expect(advanced.state.hand).toBe(1);
    expect(advanced.state.round.honba).toBe(1);
  });

  it('repeats after dealer tenpai draw; dealer noten rotates but still increments honba', () => {
    const rng = createRNG(2);
    const state = createMatch(rng);

    const tenpai = advanceMatch(withEndedRound(state, exhaustive([0, 2])), rng);
    expect(tenpai.ok).toBe(true);
    if (!tenpai.ok) return;
    expect(tenpai.state.round.dealer).toBe(0);
    expect(tenpai.state.round.honba).toBe(1);

    const noten = advanceMatch(withEndedRound(state, exhaustive([1, 2])), rng);
    expect(noten.ok).toBe(true);
    if (!noten.ok) return;
    expect(noten.state.round.dealer).toBe(1);
    expect(noten.state.hand).toBe(2);
    expect(noten.state.round.honba).toBe(1);
  });

  it('resets honba after a nondealer win', () => {
    const rng = createRNG(3);
    const state = createMatch(rng);
    const boosted = { ...state, round: { ...state.round, honba: 3 } };
    const ended = withEndedRound(boosted, nonDealerRon(0, 1));
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.round.dealer).toBe(1);
    expect(advanced.state.round.honba).toBe(0);
  });

  it('carries riichi sticks through an exhaustive draw', () => {
    const rng = createRNG(31);
    const state = createMatch(rng);
    const ended = withEndedRound(state, exhaustive([]), undefined, 2);
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.round.riichiSticks).toBe(2);
  });

  it('does not repeat solely because the dealer qualified for Nagashi Mangan', () => {
    const rng = createRNG(32);
    const state = createMatch(rng);
    const result: RoundEndResult = {
      type: 'exhaustive-draw',
      tenpaiPlayers: [1],
      notenPayments: [0, 0, 0, 0],
      nagashiPlayers: [0],
      nagashiPayments: [12_000, -4_000, -4_000, -4_000],
    };
    const advanced = advanceMatch(withEndedRound(state, result), rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.round.dealer).toBe(1);
    expect(advanced.state.hand).toBe(2);
  });
});

describe('end conditions and ranking', () => {
  it('ends on negative points, but exactly zero continues', () => {
    const rng = createRNG(4);
    const state = createMatch(rng);
    const bust = advanceMatch(withEndedRound(state, exhaustive([]), [-100, 33_000, 33_000, 34_100]), rng);
    expect(bust.ok && bust.state.result?.reason).toBe('bankruptcy');

    const zero = advanceMatch(withEndedRound(state, exhaustive([]), [0, 33_000, 33_000, 34_000]), rng);
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.state.status).toBe('playing');
  });

  it('auto-stops South 4 when the repeating last dealer is first and at target', () => {
    const rng = createRNG(5);
    let state = createMatch(rng);
    state = {
      ...state,
      wind: 'south',
      hand: 4,
      round: { ...state.round, dealer: 3, roundWind: 'south' },
    };
    const ended = withEndedRound(
      state,
      { type: 'tsumo', winner: 3, score: fakeScore },
      [20_000, 22_000, 24_000, 34_000],
    );
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.result?.reason).toBe('agari-yame');
  });

  it('awards leftover riichi sticks to first and breaks ties by East-1 seat order', () => {
    const ranked = rankMatchPlayers([25_000, 25_000, 25_000, 25_000], 2);
    expect(ranked.map((entry) => entry.player)).toEqual([2, 3, 0, 1]);

    const rng = createRNG(6);
    let state = createMatch(rng, { initialDealer: 2 });
    state = {
      ...state,
      wind: 'south',
      hand: 4,
      round: { ...state.round, dealer: 1, roundWind: 'south' },
    };
    const ended = withEndedRound(
      state,
      exhaustive([]),
      [31_000, 20_000, 29_000, 20_000],
      2,
    );
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.result?.riichiStickWinner).toBe(0);
    expect(advanced.state.result?.finalPoints[0]).toBe(33_000);
  });

  it('ends after West 4 rotates even without target', () => {
    const rng = createRNG(7);
    let state = createMatch(rng);
    state = {
      ...state,
      wind: 'west',
      hand: 4,
      round: { ...state.round, dealer: 3, roundWind: 'west' },
    };
    const ended = withEndedRound(state, exhaustive([]), [25_000, 25_000, 25_000, 25_000]);
    const advanced = advanceMatch(ended, rng);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.state.result?.reason).toBe('west-limit');
  });
});

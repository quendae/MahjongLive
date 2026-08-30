import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../rules/round';
import type { PlayerIndex, RoundDiscard, RoundEndResult, RoundState } from '../rules/types';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import {
  applyHumanDecision,
  continueSingleGame,
  createSingleGame,
  deriveSingleRoundSeed,
  driveSingleGame,
} from './single';
import type { SingleGameState } from './types';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

const m = (rank: 1|2|3|4|5|6|7|8|9) => suited('man', rank);
const p = (rank: 1|2|3|4|5|6|7|8|9) => suited('pin', rank);
const s = (rank: 1|2|3|4|5|6|7|8|9) => suited('sou', rank);

function exhaustive(tenpaiPlayers: readonly PlayerIndex[] = []): RoundEndResult {
  return {
    type: 'exhaustive-draw',
    tenpaiPlayers,
    notenPayments: [0, 0, 0, 0],
  };
}

function ronPromptFixture(): SingleGameState {
  const single = createSingleGame(700, 0);
  const round = single.match.round;
  const waiting = [
    physical(m(1), 10), physical(m(2), 11), physical(m(3), 12),
    physical(p(1), 13), physical(p(2), 14), physical(p(3), 15),
    physical(s(1), 16), physical(s(2), 17), physical(s(3), 18),
    physical(s(4), 19), physical(s(5), 20), physical(s(6), 21),
    physical(p(7), 22),
  ];
  const winning = physical(p(7), 30);
  const discard: RoundDiscard = {
    tile: winning,
    tileId: 30,
    tsumogiri: false,
    wasLastLiveDraw: false,
  };
  const players = [...round.players] as RoundState['players'][number][];
  players[0] = {
    ...players[0],
    concealed: waiting,
    melds: [],
    discards: [],
    riichi: 'none',
    temporaryFuriten: false,
    riichiFuriten: false,
  };
  players[1] = {
    ...players[1],
    discards: [discard],
    discardCount: 1,
  };
  const fixture: RoundState = {
    ...round,
    players: players as unknown as RoundState['players'],
    currentPlayer: 1,
    phase: {
      kind: 'reactions',
      discarder: 1,
      discardIndex: 0,
      ronClaims: [],
      callClaims: [],
    },
  };
  expect(getLegalActions(fixture, 0).some((action) => action.type === 'ron')).toBe(true);
  return { ...single, match: { ...single.match, round: fixture } };
}

describe('single-player controller', () => {
  it('auto-draws for the human, then stops before a meaningful discard choice', () => {
    const result = driveSingleGame(createSingleGame(12345, 0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt.kind).toBe('turn');
    expect(result.state.match.round.phase).toMatchObject({ kind: 'awaiting-discard', player: 0 });
    expect(result.state.match.round.players[0].concealed).toHaveLength(14);
    expect(result.trace[0]?.source).toBe('system');
    expect(result.trace[0]?.action.type).toBe('draw');
  });

  it('applies a human discard and lets the three bots run until the next human checkpoint', () => {
    const first = driveSingleGame(createSingleGame(12346, 0));
    expect(first.ok).toBe(true);
    if (!first.ok || first.prompt.kind !== 'turn') return;
    const discard = first.prompt.legalActions.find((action) => action.type === 'discard');
    expect(discard?.type).toBe('discard');
    if (!discard || discard.type !== 'discard') return;

    const next = applyHumanDecision(first.state, {
      type: 'action',
      action: { type: 'discard', player: 0, tileId: discard.tileIds[0] },
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.trace.some((entry) => entry.source === 'human' && entry.action.type === 'discard')).toBe(true);
    expect(next.trace.some((entry) => entry.source === 'bot')).toBe(true);
    expect(['turn', 'reaction', 'round-ended', 'match-ended']).toContain(next.prompt.kind);
  });

  it('does not reveal bot reaction choices before the human answers a Ron prompt', () => {
    const fixture = ronPromptFixture();
    const waiting = driveSingleGame(fixture);
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;
    expect(waiting.prompt.kind).toBe('reaction');
    expect(waiting.trace).toHaveLength(0);
    if (waiting.prompt.kind !== 'reaction') return;
    expect(waiting.prompt.legalActions.some((action) => action.type === 'ron')).toBe(true);

    const won = applyHumanDecision(waiting.state, {
      type: 'action',
      action: { type: 'ron', player: 0 },
    });
    expect(won.ok).toBe(true);
    if (!won.ok) return;
    expect(won.prompt.kind).toBe('round-ended');
    if (won.prompt.kind !== 'round-ended' || won.prompt.result.type !== 'ron') return;
    expect(won.prompt.result.winners.some((claim) => claim.player === 0)).toBe(true);
  });

  it('accepts an explicit pass on a reaction and resolves the window through the reducer', () => {
    const waiting = driveSingleGame(ronPromptFixture());
    expect(waiting.ok).toBe(true);
    if (!waiting.ok || waiting.prompt.kind !== 'reaction') return;
    const passed = applyHumanDecision(waiting.state, { type: 'pass' });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.trace.some((entry) => entry.action.type === 'resolve-reactions')).toBe(true);
  });

  it('holds on the result screen and advances only after continueSingleGame', () => {
    const single = createSingleGame(55, 0);
    const ended: SingleGameState = {
      ...single,
      match: {
        ...single.match,
        round: {
          ...single.match.round,
          phase: { kind: 'ended', result: exhaustive([]) },
        },
      },
    };

    const stopped = driveSingleGame(ended);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.prompt.kind).toBe('round-ended');

    const continued = continueSingleGame(stopped.state);
    expect(continued.ok).toBe(true);
    if (!continued.ok) return;
    expect(continued.state.match.roundNumber).toBe(2);
    expect(continued.state.match.round.phase.kind).not.toBe('ended');
  });

  it('derives repeatable but round-specific seeds', () => {
    expect(deriveSingleRoundSeed(777, 1)).toBe(deriveSingleRoundSeed(777, 1));
    expect(deriveSingleRoundSeed(777, 1)).not.toBe(deriveSingleRoundSeed(777, 2));

    const a = driveSingleGame(createSingleGame(777, 0));
    const b = driveSingleGame(createSingleGame(777, 0));
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.state.match.round.players[0].concealed).toEqual(b.state.match.round.players[0].concealed);
  });

  it('round-trips through JSON and resumes with the same deterministic outcome', () => {
    const first = driveSingleGame(createSingleGame(88001, 0));
    expect(first.ok).toBe(true);
    if (!first.ok || first.prompt.kind !== 'turn') return;

    const restored = JSON.parse(JSON.stringify(first.state)) as SingleGameState;
    expect(restored).toEqual(first.state);

    const discard = first.prompt.legalActions.find((action) => action.type === 'discard');
    expect(discard?.type).toBe('discard');
    if (!discard || discard.type !== 'discard') return;
    const decision = {
      type: 'action' as const,
      action: { type: 'discard' as const, player: 0 as const, tileId: discard.tileIds[0] },
    };

    const live = applyHumanDecision(first.state, decision);
    const resumed = applyHumanDecision(restored, decision);
    expect(resumed).toEqual(live);
  });
});

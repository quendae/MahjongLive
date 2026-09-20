import { describe, expect, it } from 'vitest';
import { chooseBotDecisionForDifficulty } from '@mahjong-live/shared/bot';
import type { BotDifficulty } from '@mahjong-live/shared/bot';
import { isReactionPhase } from '@mahjong-live/shared/match';
import type { MatchState } from '@mahjong-live/shared/match';
import type { PlayerIndex, RoundAction } from '@mahjong-live/shared/rules';
import {
  applyHumanDecision,
  continueSingleGame,
  createSingleGame,
  driveSingleGame,
} from '@mahjong-live/shared/single';
import { AuthoritativeRoom } from './room';
import type { PlayerRoundAction } from './protocol';

const SEATS: readonly PlayerIndex[] = [0, 1, 2, 3];
const DIFFICULTY: BotDifficulty = 'standard';
const STEP_CAP = 20_000;

/** The bot policy never returns the server-only resolution action. */
function playerAction(action: RoundAction): PlayerRoundAction {
  if (action.type === 'resolve-reactions') throw new Error('bot returned a server-only action');
  return action;
}

interface PlayedMatch {
  /** The match snapshot at the end of every hand, before the next one is dealt. */
  rounds: MatchState[];
  final: MatchState;
}

/**
 * Drives a single-player match where the human seat plays the same deterministic bot policy as
 * the other three, so the resulting match depends on nothing but the seed and the engine.
 */
function playSingle(seed: number): PlayedMatch {
  const rounds: MatchState[] = [];
  let state = createSingleGame(seed, 0, DIFFICULTY);
  let result = driveSingleGame(state);

  for (let step = 0; step < STEP_CAP; step++) {
    if (!result.ok) throw new Error(`single-player drive failed: ${result.code} ${result.message}`);
    state = result.state;
    const prompt = result.prompt;

    if (prompt.kind === 'match-ended') return { rounds, final: state.match };
    if (prompt.kind === 'round-ended') {
      rounds.push(state.match);
      result = continueSingleGame(state);
      continue;
    }

    const decision = chooseBotDecisionForDifficulty(state.match.round, 0, DIFFICULTY);
    if (decision.type === 'pass' && prompt.kind === 'turn') {
      throw new Error('bot policy passed on its own turn');
    }
    result = applyHumanDecision(
      state,
      decision.type === 'pass' ? { type: 'pass' } : { type: 'action', action: decision.action },
    );
  }
  throw new Error('single-player match did not finish');
}

/** Drives the same policy through the authoritative room, one command per seat decision. */
function playRoom(seed: number): PlayedMatch {
  const room = new AuthoritativeRoom(`match-${seed}`, seed);
  const clients = SEATS.map((seat) => `c${seat}`);
  for (const seat of SEATS) {
    expect(room.join(clients[seat], `Player ${seat}`, seat)).toMatchObject({ ok: true, seat });
    expect(
      room.submit(clients[seat], {
        commandId: `ready-${seat}`,
        expectedVersion: room.publicVersion,
        command: { type: 'set-ready', ready: true },
      }).ok,
    ).toBe(true);
  }
  expect(
    room.submit(clients[0], {
      commandId: 'start',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round' },
    }).ok,
  ).toBe(true);

  const submit = (seat: PlayerIndex, commandId: string, command: Parameters<typeof room.submit>[1]['command']) => {
    const receipt = room.submit(clients[seat], {
      commandId,
      expectedVersion: room.publicVersion,
      command,
    });
    if (!receipt.ok) throw new Error(`room rejected ${commandId}: ${receipt.code} ${receipt.message}`);
  };

  const rounds: MatchState[] = [];
  for (let step = 0; step < STEP_CAP; step++) {
    if (room.roomStatus === 'finished') return { rounds, final: room.matchState! };
    const match = room.matchState!;
    const round = match.round;

    if (round.phase.kind === 'ended') {
      rounds.push(match);
      submit(0, `advance-${match.roundNumber}`, { type: 'advance-round' });
      continue;
    }

    if (isReactionPhase(round)) {
      for (const seat of SEATS) {
        const current = room.matchState!.round;
        if (!isReactionPhase(current)) break;
        if (room.viewFor(clients[seat]).round!.legalActions.length === 0) continue;
        const decision = chooseBotDecisionForDifficulty(current, seat, DIFFICULTY);
        submit(
          seat,
          `react-${step}-${seat}`,
          decision.type === 'pass'
            ? { type: 'pass' }
            : { type: 'round-action', action: playerAction(decision.action) },
        );
      }
      continue;
    }

    // Draws and forced discards are settled by the room itself, as in single-player.
    const phase = round.phase;
    if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') {
      throw new Error(`unexpected phase ${phase.kind}`);
    }
    const seat = phase.player;
    const decision = chooseBotDecisionForDifficulty(round, seat, DIFFICULTY);
    if (decision.type === 'pass') throw new Error(`bot policy passed on seat ${seat}'s turn`);
    submit(seat, `turn-${step}-${seat}`, {
      type: 'round-action',
      action: playerAction(decision.action),
    });
  }
  throw new Error('room match did not finish');
}

describe('match-level room loop', () => {
  it('plays a whole hanchan and derives round seeds exactly as single-player does', () => {
    const seed = 4242;
    const room = playRoom(seed);
    const single = playSingle(seed);

    expect(room.rounds.length).toBeGreaterThan(1);
    // Every recorded hand ended while the room kept playing: 'finished' means the match ended.
    for (const match of room.rounds) expect(match.status).toBe('playing');
    expect(room.final.status).toBe('ended');
    expect(room.final.result).toBeDefined();
    expect(room.final.roundNumber).toBe(room.rounds.length);

    expect(room.rounds).toHaveLength(single.rounds.length);
    // Same hands, same walls, same outcomes: a drifting derivation replays to a different game.
    expect(room.rounds.map((match) => [match.wind, match.hand, match.round.dealer, match.round.honba]))
      .toEqual(single.rounds.map((match) => [match.wind, match.hand, match.round.dealer, match.round.honba]));
    expect(room.rounds.map((match) => match.round.wall))
      .toEqual(single.rounds.map((match) => match.round.wall));
    expect(room.rounds.map((match) => match.round.phase))
      .toEqual(single.rounds.map((match) => match.round.phase));
    expect(room.rounds).toEqual(single.rounds);
    expect(room.final).toEqual(single.final);
  });
});

import { describe, expect, it } from 'vitest';
import { dragon, suited, tileTypeKey, wind } from '../tiles/tiles';
import type { RoundPlayerState } from './types';
import { isDiscardFuriten, winningTileTypeKeys } from './waits';

function keys(...tiles: ReturnType<typeof suited>[]): string[] {
  return tiles.map(tileTypeKey).sort();
}

function player(concealed: RoundPlayerState['concealed']): RoundPlayerState {
  return {
    points: 25_000,
    concealed,
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

describe('winningTileTypeKeys', () => {
  it('finds both sides of a ryanmen wait', () => {
    const concealed = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('pin', 7), suited('pin', 8), suited('pin', 9),
      suited('sou', 2), suited('sou', 3),
      suited('pin', 5), suited('pin', 5),
    ];
    expect([...winningTileTypeKeys(concealed)].sort()).toEqual(
      keys(suited('sou', 1), suited('sou', 4)),
    );
  });

  it('finds a tanki pair wait', () => {
    const concealed = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('pin', 7), suited('pin', 8), suited('pin', 9),
      suited('sou', 1), suited('sou', 2), suited('sou', 3),
      wind('east'),
    ];
    expect([...winningTileTypeKeys(concealed)]).toEqual([tileTypeKey(wind('east'))]);
  });

  it('recognizes Chiitoitsu and Kokushi waits', () => {
    const chiitoitsu = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 3), suited('pin', 3),
      suited('pin', 4), suited('pin', 4),
      suited('sou', 5), suited('sou', 5),
      suited('sou', 6), suited('sou', 6),
      wind('east'),
    ];
    expect(winningTileTypeKeys(chiitoitsu).has(tileTypeKey(wind('east')))).toBe(true);

    const kokushi = [
      suited('man', 1), suited('man', 9), suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
      dragon('white'), dragon('green'), dragon('red'),
    ];
    expect(winningTileTypeKeys(kokushi).size).toBe(13);
  });

  it('works with an already-open fixed meld', () => {
    const concealed = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('pin', 4), suited('pin', 5), suited('pin', 6),
      suited('sou', 7), suited('sou', 8),
      suited('sou', 5), suited('sou', 5),
    ];
    const fixed = [{
      type: 'triplet' as const,
      tiles: [wind('east'), wind('east'), wind('east')],
      isOpen: true,
    }];
    const waits = winningTileTypeKeys(concealed, fixed);
    expect(waits.has(tileTypeKey(suited('sou', 6)))).toBe(true);
    expect(waits.has(tileTypeKey(suited('sou', 9)))).toBe(true);
  });
});

describe('discard Furiten', () => {
  it('blocks the entire multi-wait when any current wait appears in own discards', () => {
    const concealed = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('pin', 7), suited('pin', 8), suited('pin', 9),
      suited('sou', 2), suited('sou', 3),
      suited('pin', 5), suited('pin', 5),
    ];
    const p = player(concealed);
    const discarded = suited('sou', 1);
    expect(isDiscardFuriten({
      ...p,
      discards: [{ tile: discarded, tileId: 1, tsumogiri: false, wasLastLiveDraw: false }],
    })).toBe(true);
  });
});

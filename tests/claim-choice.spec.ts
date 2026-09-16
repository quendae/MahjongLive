import { expect, test } from '@playwright/test';
import { buildClaimChoices } from '../client/src/claim-choice';
import type { RoundAction } from '@mahjong-live/shared/rules';
import type { Tile } from '@mahjong-live/shared/tile-types';

function suited(id: number, rank: 1|2|3|4|5|6|7|8|9, isRed = false): Tile {
  return { id, kind: 'suited', suit: 'man', rank, isRed };
}

function label(tile: Tile): string {
  if (tile.kind === 'suited') return `${tile.isRed ? 'red ' : ''}${tile.rank}m`;
  return tile.honorType === 'wind' ? tile.value : `${tile.value} dragon`;
}

test('Pon collapses mechanically duplicate physical pairs while preserving red-five choices', () => {
  const hand = [suited(10, 5, true), suited(11, 5), suited(12, 5)];
  const actions: RoundAction[] = [
    { type: 'pon', player: 0, tileIds: [10, 11] },
    { type: 'pon', player: 0, tileIds: [10, 12] },
    { type: 'pon', player: 0, tileIds: [11, 12] },
  ];

  const choices = buildClaimChoices(actions, hand, suited(99, 5), label);

  expect(choices).toHaveLength(2);
  expect(choices.map((choice) => choice.label)).toEqual([
    'red 5m · 5m',
    '5m · 5m',
  ]);
});

test('Chi shows the complete sequence and marks which tile came from the river', () => {
  const hand = [
    suited(1, 3), suited(2, 4), suited(3, 4),
    suited(4, 6), suited(5, 6), suited(6, 7),
  ];
  const called = suited(99, 5);
  const actions: RoundAction[] = [
    { type: 'chi', player: 0, tileIds: [1, 2] },
    { type: 'chi', player: 0, tileIds: [3, 4] },
    { type: 'chi', player: 0, tileIds: [5, 6] },
  ];

  const choices = buildClaimChoices(actions, hand, called, label);

  expect(choices.map((choice) => choice.label)).toEqual([
    '3m · 4m · [5m]',
    '4m · [5m] · 6m',
    '[5m] · 6m · 7m',
  ]);
});

test('Chi duplicate physical copies collapse to one visible combination', () => {
  const hand = [suited(1, 3), suited(2, 3), suited(3, 4), suited(4, 4)];
  const actions: RoundAction[] = [
    { type: 'chi', player: 0, tileIds: [1, 3] },
    { type: 'chi', player: 0, tileIds: [1, 4] },
    { type: 'chi', player: 0, tileIds: [2, 3] },
    { type: 'chi', player: 0, tileIds: [2, 4] },
  ];

  const choices = buildClaimChoices(actions, hand, suited(99, 5), label);
  expect(choices).toHaveLength(1);
  expect(choices[0].label).toBe('3m · 4m · [5m]');
});

test('Shouminkan keeps identical tile labels separate when they upgrade different melds', () => {
  const hand = [suited(10, 5), suited(11, 5)];
  const actions: RoundAction[] = [
    { type: 'shouminkan', player: 0, meldIndex: 0, tileId: 10 },
    { type: 'shouminkan', player: 0, meldIndex: 2, tileId: 11 },
  ];

  const choices = buildClaimChoices(actions, hand, undefined, label);
  expect(choices.map((choice) => choice.label)).toEqual([
    '5m · meld 1',
    '5m · meld 3',
  ]);
});

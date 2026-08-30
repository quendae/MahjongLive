import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { WinningHand, WinningHandBase } from './context';
import {
  detectChankan,
  detectChiihou,
  detectDoubleRiichi,
  detectHaitei,
  detectHoutei,
  detectRinshan,
  detectTenhou,
} from './situational';

function base(overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  const winningTile = suited('man', 5);
  return {
    allTiles: [winningTile],
    winningTile,
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

function special(overrides: Partial<WinningHandBase> = {}): WinningHand {
  return { ...base(overrides), shape: 'chiitoitsu' };
}

describe('situational yaku', () => {
  it('detects Double Riichi', () => {
    expect(detectDoubleRiichi(special({ isDoubleRiichi: true }))).toEqual({
      name: 'Double Riichi',
      han: 2,
    });
  });

  it('requires the correct win condition for last-tile yaku', () => {
    expect(detectHaitei(special({ isHaitei: true, winCondition: 'tsumo' }))).toEqual({
      name: 'Haitei',
      han: 1,
    });
    expect(detectHaitei(special({ isHaitei: true, winCondition: 'ron' }))).toBeNull();

    expect(detectHoutei(special({ isHoutei: true, winCondition: 'ron' }))).toEqual({
      name: 'Houtei',
      han: 1,
    });
    expect(detectHoutei(special({ isHoutei: true, winCondition: 'tsumo' }))).toBeNull();
  });

  it('requires Tsumo for Rinshan and Ron for Chankan', () => {
    expect(detectRinshan(special({ isRinshan: true, winCondition: 'tsumo' }))).toEqual({
      name: 'Rinshan Kaihou',
      han: 1,
    });
    expect(detectRinshan(special({ isRinshan: true, winCondition: 'ron' }))).toBeNull();

    expect(detectChankan(special({ isChankan: true, winCondition: 'ron' }))).toEqual({
      name: 'Chankan',
      han: 1,
    });
    expect(detectChankan(special({ isChankan: true, winCondition: 'tsumo' }))).toBeNull();
  });
});

describe('first-draw yakuman', () => {
  it('detects Tenhou only for East by Tsumo', () => {
    expect(detectTenhou(special({ isTenhou: true, seatWind: 'east', winCondition: 'tsumo' }))).toEqual({
      name: 'Tenhou',
      han: 0,
      yakuman: 1,
    });
    expect(detectTenhou(special({ isTenhou: true, seatWind: 'south', winCondition: 'tsumo' }))).toBeNull();
  });

  it('detects Chiihou only for a non-East player by Tsumo', () => {
    expect(detectChiihou(special({ isChiihou: true, seatWind: 'south', winCondition: 'tsumo' }))).toEqual({
      name: 'Chiihou',
      han: 0,
      yakuman: 1,
    });
    expect(detectChiihou(special({ isChiihou: true, seatWind: 'east', winCondition: 'tsumo' }))).toBeNull();
  });
});

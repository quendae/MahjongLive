import { describe, expect, it } from 'vitest';
import { calculateBasePoints } from './limits';

describe('calculateBasePoints', () => {
  it('uses the ordinary formula below Mangan', () => {
    expect(calculateBasePoints(1, 30, 0)).toEqual({ basePoints: 240, limit: 'none' });
    expect(calculateBasePoints(2, 40, 0)).toEqual({ basePoints: 640, limit: 'none' });
  });

  it('caps natural Mangan boundaries', () => {
    expect(calculateBasePoints(4, 40, 0)).toEqual({ basePoints: 2000, limit: 'mangan' });
    expect(calculateBasePoints(3, 70, 0)).toEqual({ basePoints: 2000, limit: 'mangan' });
    expect(calculateBasePoints(5, 20, 0)).toEqual({ basePoints: 2000, limit: 'mangan' });
  });

  it('applies V1 Kiriage Mangan', () => {
    expect(calculateBasePoints(4, 30, 0)).toEqual({ basePoints: 2000, limit: 'mangan' });
    expect(calculateBasePoints(3, 60, 0)).toEqual({ basePoints: 2000, limit: 'mangan' });
  });

  it('maps Haneman, Baiman and Sanbaiman boundaries', () => {
    expect(calculateBasePoints(6, 30, 0)).toEqual({ basePoints: 3000, limit: 'haneman' });
    expect(calculateBasePoints(7, 30, 0)).toEqual({ basePoints: 3000, limit: 'haneman' });
    expect(calculateBasePoints(8, 30, 0)).toEqual({ basePoints: 4000, limit: 'baiman' });
    expect(calculateBasePoints(10, 30, 0)).toEqual({ basePoints: 4000, limit: 'baiman' });
    expect(calculateBasePoints(11, 30, 0)).toEqual({ basePoints: 6000, limit: 'sanbaiman' });
    expect(calculateBasePoints(12, 30, 0)).toEqual({ basePoints: 6000, limit: 'sanbaiman' });
  });

  it('uses a single Kazoe Yakuman at 13+ ordinary Han, even at 26 Han', () => {
    expect(calculateBasePoints(13, 30, 0)).toEqual({ basePoints: 8000, limit: 'kazoe-yakuman' });
    expect(calculateBasePoints(26, 30, 0)).toEqual({ basePoints: 8000, limit: 'kazoe-yakuman' });
  });

  it('lets true Yakuman override Han/Fu and stack by multiplier', () => {
    expect(calculateBasePoints(30, 110, 1)).toEqual({ basePoints: 8000, limit: 'yakuman' });
    expect(calculateBasePoints(0, 0, 3)).toEqual({ basePoints: 24000, limit: 'multiple-yakuman' });
  });
});

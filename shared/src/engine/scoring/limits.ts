export type LimitName =
  | 'none'
  | 'mangan'
  | 'haneman'
  | 'baiman'
  | 'sanbaiman'
  | 'kazoe-yakuman'
  | 'yakuman'
  | 'multiple-yakuman';

export interface BasePointResult {
  basePoints: number;
  limit: LimitName;
}

/**
 * Converts Han/Fu (or true-Yakuman multipliers) into basic points before dealer/Tsumo multipliers.
 * V1 has Kiriage Mangan enabled and Kazoe Yakuman at 13+ Han.
 */
export function calculateBasePoints(han: number, fu: number, yakuman: number): BasePointResult {
  if (yakuman > 0) {
    const multiplier = Math.max(1, Math.floor(yakuman));
    return {
      basePoints: 8000 * multiplier,
      limit: multiplier === 1 ? 'yakuman' : 'multiple-yakuman',
    };
  }

  if (han <= 0 || fu <= 0) return { basePoints: 0, limit: 'none' };
  if (han >= 13) return { basePoints: 8000, limit: 'kazoe-yakuman' };
  if (han >= 11) return { basePoints: 6000, limit: 'sanbaiman' };
  if (han >= 8) return { basePoints: 4000, limit: 'baiman' };
  if (han >= 6) return { basePoints: 3000, limit: 'haneman' };
  if (han >= 5) return { basePoints: 2000, limit: 'mangan' };

  // V1 project rule: Kiriage Mangan is enabled even though Tenhou's current default differs.
  if ((han === 4 && fu === 30) || (han === 3 && fu === 60)) {
    return { basePoints: 2000, limit: 'mangan' };
  }

  const raw = fu * 2 ** (han + 2);
  if (raw >= 2000) return { basePoints: 2000, limit: 'mangan' };
  return { basePoints: raw, limit: 'none' };
}

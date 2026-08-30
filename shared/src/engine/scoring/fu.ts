import {
  WinningHand,
  WinningMeld,
  YakuResult,
  isClosedHand,
  isConcealedMeld,
  isTripletLike,
  meldContainingTile,
} from '../yaku/context';
import { isTerminalOrHonor } from '../tiles/tiles';

export interface FuComponent {
  source: string;
  fu: number;
}

export interface FuResult {
  fu: number;
  rawFu: number;
  components: readonly FuComponent[];
  fixed: 'chiitoitsu' | 'pinfu-tsumo' | null;
}

function hasYaku(yaku: readonly YakuResult[], name: string): boolean {
  return yaku.some((result) => result.name === name);
}

function meldFu(meld: WinningMeld, hand: Extract<WinningHand, { shape: 'standard' }>): number {
  if (!isTripletLike(meld)) return 0;

  const terminalOrHonor = isTerminalOrHonor(meld.tiles[0]);
  const concealed = isConcealedMeld(meld, hand);

  let fu: number;
  if (meld.type === 'quad') {
    fu = concealed ? 16 : 8;
  } else {
    fu = concealed ? 4 : 2;
  }
  if (terminalOrHonor) fu *= 2;
  return fu;
}

function pairFu(hand: Extract<WinningHand, { shape: 'standard' }>): number {
  if (hand.pair.length !== 2) return 0;
  const tile = hand.pair[0];
  if (tile.kind !== 'honor') return 0;
  if (tile.honorType === 'dragon') return 2;

  let fu = 0;
  if (tile.value === hand.seatWind) fu += 2;
  if (tile.value === hand.roundWind) fu += 2;
  return fu;
}

/**
 * Fu from the exact semantic wait represented by the winning-tile object reference.
 *
 * HAZARD: this deliberately relies on the same reference identity documented in
 * `yaku/context.ts`. The caller must place `winningTile` in the group it actually completed;
 * scoring must never infer that assignment from duplicate tile values or raw decomposition order.
 */
function waitFu(hand: Extract<WinningHand, { shape: 'standard' }>): number {
  if (hand.pair.includes(hand.winningTile)) return 2; // tanki

  const meld = meldContainingTile(hand.melds, hand.winningTile);
  if (!meld || meld.type !== 'sequence') return 0; // shanpon or malformed context

  const sorted = [...meld.tiles].sort((a, b) => {
    if (a.kind !== 'suited' || b.kind !== 'suited') return 0;
    return a.rank - b.rank;
  });
  const winIndex = sorted.indexOf(hand.winningTile);
  if (winIndex < 0) return 0;
  if (winIndex === 1) return 2; // kanchan

  const low = sorted[0];
  const high = sorted[2];
  if (low.kind !== 'suited' || high.kind !== 'suited') return 0;
  if (low.rank === 1 && winIndex === 2) return 2; // 12 waiting on 3: penchan
  if (high.rank === 9 && winIndex === 0) return 2; // 89 waiting on 7: penchan
  return 0; // ryanmen
}

function roundFu(rawFu: number): number {
  return Math.ceil(rawFu / 10) * 10;
}

export function calculateFu(
  hand: WinningHand,
  yaku: readonly YakuResult[],
): FuResult | null {
  if (hand.shape === 'kokushi') return null;

  if (hand.shape === 'chiitoitsu') {
    return {
      fu: 25,
      rawFu: 25,
      components: [{ source: 'Chiitoitsu', fu: 25 }],
      fixed: 'chiitoitsu',
    };
  }

  const pinfu = hasYaku(yaku, 'Pinfu');
  if (pinfu && hand.winCondition === 'tsumo') {
    return {
      fu: 20,
      rawFu: 20,
      components: [{ source: 'Pinfu Tsumo', fu: 20 }],
      fixed: 'pinfu-tsumo',
    };
  }

  const components: FuComponent[] = [{ source: 'Base', fu: 20 }];

  if (hand.winCondition === 'ron' && isClosedHand(hand)) {
    components.push({ source: 'Menzen Ron', fu: 10 });
  }

  if (hand.winCondition === 'tsumo') {
    components.push({ source: 'Tsumo', fu: 2 });
  }

  for (const meld of hand.melds) {
    const fu = meldFu(meld, hand);
    if (fu > 0) {
      components.push({
        source: `${meld.isOpen === true ? 'Open' : 'Concealed'} ${meld.type}`,
        fu,
      });
    }
  }

  const valuePairFu = pairFu(hand);
  if (valuePairFu > 0) components.push({ source: 'Value pair', fu: valuePairFu });

  const winningWaitFu = waitFu(hand);
  if (winningWaitFu > 0) components.push({ source: 'Wait', fu: winningWaitFu });

  const rawFu = components.reduce((sum, component) => sum + component.fu, 0);

  // Open Ron cannot remain at 20 fu; the pinfu-shaped open hand is scored as 30 fu.
  if (hand.winCondition === 'ron' && !isClosedHand(hand) && rawFu === 20) {
    return { fu: 30, rawFu, components, fixed: null };
  }

  return {
    fu: roundFu(rawFu),
    rawFu,
    components,
    fixed: null,
  };
}

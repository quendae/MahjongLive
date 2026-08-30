import { decomposeMelds, Meld } from '../hand/decompose';
import { isChiitoitsu, isKokushi } from '../hand/specialShapes';
import { tileTypeKey } from '../tiles/tiles';
import { Tile, Wind } from '../tiles/types';
import {
  ChiitoitsuWinningHand,
  KokushiWinningHand,
  StandardWinningHand,
  WinningHand,
  WinningMeld,
  WinCondition,
} from '../yaku/context';

export interface WinningResolutionInput {
  /** Loose concealed tiles immediately before receiving the winning tile. */
  concealedBeforeWin: readonly Tile[];
  /** Exact physical object drawn or discarded to complete the hand. */
  winningTile: Tile;
  /** Melds that already existed before the win (calls or declared Kans). */
  fixedMelds?: readonly WinningMeld[];
  winCondition: WinCondition;
  seatWind: Wind;
  roundWind: Wind;
  isRiichi?: boolean;
  isDoubleRiichi?: boolean;
  isIppatsu?: boolean;
  isHaitei?: boolean;
  isHoutei?: boolean;
  isRinshan?: boolean;
  isChankan?: boolean;
  isTenhou?: boolean;
  isChiihou?: boolean;
}

function removeReferences(tiles: readonly Tile[], toRemove: readonly Tile[]): Tile[] {
  const result = [...tiles];
  for (const tile of toRemove) {
    const index = result.indexOf(tile);
    if (index < 0) return [];
    result.splice(index, 1);
  }
  return result;
}

function groupByType(tiles: readonly Tile[]): Map<string, Tile[]> {
  const groups = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const key = tileTypeKey(tile);
    const list = groups.get(key) ?? [];
    list.push(tile);
    groups.set(key, list);
  }
  return groups;
}

function baseFields(input: WinningResolutionInput, allTiles: readonly Tile[]) {
  return {
    allTiles,
    winningTile: input.winningTile,
    winCondition: input.winCondition,
    seatWind: input.seatWind,
    roundWind: input.roundWind,
    isRiichi: input.isRiichi ?? false,
    isIppatsu: input.isIppatsu ?? false,
    isHaitei: input.isHaitei ?? false,
    isHoutei: input.isHoutei ?? false,
    isRinshan: input.isRinshan ?? false,
    isChankan: input.isChankan ?? false,
    isDoubleRiichi: input.isDoubleRiichi ?? false,
    isTenhou: input.isTenhou ?? false,
    isChiihou: input.isChiihou ?? false,
  } as const;
}

function meldSignature(meld: WinningMeld): string {
  const tiles = meld.tiles.map(tileTypeKey).sort().join(',');
  return `${meld.type}:${meld.isOpen === true ? 'open' : 'closed'}:${tiles}`;
}

function candidateKey(hand: WinningHand): string {
  if (hand.shape !== 'standard') return hand.shape;
  const pairSignature = hand.pair.map(tileTypeKey).sort().join(',');
  const meldSignatures = hand.melds.map(meldSignature).sort();
  const winningGroup = hand.pair.includes(hand.winningTile)
    ? `pair:${pairSignature}`
    : `meld:${meldSignature(hand.melds.find((meld) => meld.tiles.includes(hand.winningTile))!)}`;
  return `standard|pair:${pairSignature}|melds:${meldSignatures.join('|')}|win:${winningGroup}`;
}

/**
 * Reassign the exact winning tile object to every concealed group that could semantically have
 * been completed by that tile type. The raw decomposer necessarily puts the object in one group,
 * but that placement is only an array-order artifact when identical physical copies are split
 * across roles. Swapping same-type references preserves the decomposition while making each legal
 * winning-group interpretation explicit.
 */
function identityVariants(
  rawPair: readonly Tile[],
  rawMelds: readonly Meld[],
  winningTile: Tile,
): Array<{ pair: readonly Tile[]; melds: readonly WinningMeld[] }> {
  const groups: Tile[][] = [
    [...rawPair],
    ...rawMelds.map((meld) => [...meld.tiles]),
  ];
  const sourceGroup = groups.findIndex((group) => group.includes(winningTile));
  if (sourceGroup < 0) return [];

  const winningKey = tileTypeKey(winningTile);
  const targetGroups = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => group.some((tile) => tileTypeKey(tile) === winningKey))
    .map(({ index }) => index);

  return targetGroups.map((targetGroup) => {
    const swapped = groups.map((group) => [...group]);
    if (targetGroup !== sourceGroup) {
      const sourceIndex = swapped[sourceGroup].indexOf(winningTile);
      const targetIndex = swapped[targetGroup].findIndex(
        (tile) => tileTypeKey(tile) === winningKey,
      );
      const displaced = swapped[targetGroup][targetIndex];
      swapped[targetGroup][targetIndex] = winningTile;
      swapped[sourceGroup][sourceIndex] = displaced;
    }

    return {
      pair: swapped[0],
      melds: rawMelds.map((meld, index): WinningMeld => ({
        type: meld.type,
        tiles: swapped[index + 1],
        isOpen: false,
      })),
    };
  });
}

/**
 * Build every semantically valid completed-hand interpretation for a normal Tsumo/Ron.
 *
 * This is the production integration boundary for the winning-tile identity HAZARD documented in
 * `yaku/context.ts`: raw `decomposeMelds` object placement is never exposed directly to scoring.
 */
export function resolveWinningHands(input: WinningResolutionInput): WinningHand[] {
  const fixedMelds = input.fixedMelds ?? [];
  if (fixedMelds.length > 4) return [];

  const expectedBeforeWin = 13 - fixedMelds.length * 3;
  if (input.concealedBeforeWin.length !== expectedBeforeWin) return [];

  const completeLoose = [...input.concealedBeforeWin, input.winningTile];
  const allTiles = [...completeLoose, ...fixedMelds.flatMap((meld) => meld.tiles)];
  const base = baseFields(input, allTiles);
  const candidates: WinningHand[] = [];

  if (fixedMelds.length === 0 && completeLoose.length === 14) {
    if (isChiitoitsu([...completeLoose])) {
      const hand: ChiitoitsuWinningHand = { ...base, shape: 'chiitoitsu' };
      candidates.push(hand);
    }
    if (isKokushi([...completeLoose])) {
      const hand: KokushiWinningHand = { ...base, shape: 'kokushi' };
      candidates.push(hand);
    }
  }

  const concealedMeldsNeeded = 4 - fixedMelds.length;
  const byType = groupByType(completeLoose);

  for (const sameType of byType.values()) {
    if (sameType.length < 2) continue;
    const rawPair = sameType.slice(0, 2);
    const remaining = removeReferences(completeLoose, rawPair);
    if (remaining.length !== concealedMeldsNeeded * 3) continue;

    for (const rawMelds of decomposeMelds(remaining)) {
      if (rawMelds.length !== concealedMeldsNeeded) continue;
      for (const variant of identityVariants(rawPair, rawMelds, input.winningTile)) {
        const hand: StandardWinningHand = {
          ...base,
          shape: 'standard',
          melds: [...fixedMelds, ...variant.melds],
          pair: variant.pair,
        };
        candidates.push(hand);
      }
    }
  }

  const unique = new Map<string, WinningHand>();
  for (const hand of candidates) unique.set(candidateKey(hand), hand);
  return [...unique.values()];
}

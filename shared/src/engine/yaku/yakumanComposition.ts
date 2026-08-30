import { YakuDetector, isClosedHand } from './context';
import { isKokushi } from '../hand/specialShapes';
import { isTerminal } from '../tiles/tiles';
import { SuitedTile, Tile } from '../tiles/types';

export const detectKokushi: YakuDetector = (hand) => {
  if (hand.shape !== 'kokushi') return null;
  return isKokushi([...hand.allTiles]) ? { name: 'Kokushi Musou', han: 0, yakuman: 1 } : null;
};

export const detectTsuuiisou: YakuDetector = (hand) => {
  if (hand.allTiles.length === 0) return null;
  return hand.allTiles.every((tile) => tile.kind === 'honor')
    ? { name: 'Tsuuiisou', han: 0, yakuman: 1 }
    : null;
};

export const detectChinroutou: YakuDetector = (hand) => {
  if (hand.allTiles.length === 0) return null;
  return hand.allTiles.every(isTerminal) ? { name: 'Chinroutou', han: 0, yakuman: 1 } : null;
};

function isGreenTile(tile: Tile): boolean {
  if (tile.kind === 'suited') {
    return tile.suit === 'sou' && [2, 3, 4, 6, 8].includes(tile.rank);
  }
  return tile.honorType === 'dragon' && tile.value === 'green';
}

export const detectRyuuiisou: YakuDetector = (hand) => {
  if (hand.allTiles.length === 0) return null;
  return hand.allTiles.every(isGreenTile) ? { name: 'Ryuuiisou', han: 0, yakuman: 1 } : null;
};

export const detectChuurenpoutou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (!isClosedHand(hand)) return null;
  if (hand.allTiles.length !== 14) return null; // A declared Kan invalidates Chuuren.

  const suitedTiles = hand.allTiles.filter((tile): tile is SuitedTile => tile.kind === 'suited');
  if (suitedTiles.length !== 14) return null;

  const suit = suitedTiles[0].suit;
  if (suitedTiles.some((tile) => tile.suit !== suit)) return null;

  const counts = Array<number>(10).fill(0);
  for (const tile of suitedTiles) counts[tile.rank] += 1;

  if (counts[1] < 3 || counts[9] < 3) return null;
  for (let rank = 2; rank <= 8; rank++) {
    if (counts[rank] < 1) return null;
  }

  return { name: 'Chuurenpoutou', han: 0, yakuman: 1 };
};

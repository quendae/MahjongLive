import { YakuDetector, isYakuhaiTile } from './context';

export const detectYakuhai: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;

  const qualifyingTriplets = hand.melds.filter(
    (m) => m.type === 'triplet' && isYakuhaiTile(m.tiles[0], hand),
  );
  if (qualifyingTriplets.length === 0) return null;

  const han = qualifyingTriplets.reduce((total, meld) => {
    const tile = meld.tiles[0];
    if (tile.kind === 'honor' && tile.honorType === 'dragon') return total + 1;
    let value = 0;
    if (tile.kind === 'honor' && tile.value === hand.seatWind) value += 1;
    if (tile.kind === 'honor' && tile.value === hand.roundWind) value += 1;
    return total + value;
  }, 0);

  return { name: 'Yakuhai', han };
};

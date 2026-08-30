import type { PlayerIndex, RoundEvent } from '@mahjong-live/shared/rules';
import type { SinglePresentationFrame } from '@mahjong-live/shared/single';
import type { Tile } from '@mahjong-live/shared/tile-types';

function playerLabel(player: PlayerIndex, humanSeat: PlayerIndex): string {
  if (player === humanSeat) return 'You';
  const relative = (player - humanSeat + 4) % 4;
  return `Bot ${relative}`;
}

function tileLabel(tile: Tile): string {
  if (tile.kind === 'suited') {
    const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
    return `${tile.isRed ? 'red ' : ''}${tile.rank}${suffix}`;
  }
  if (tile.honorType === 'wind') return tile.value;
  return `${tile.value} dragon`;
}

function eventOf<T extends RoundEvent['type']>(
  frame: SinglePresentationFrame,
  type: T,
): Extract<RoundEvent, { type: T }> | undefined {
  return frame.events.find((event): event is Extract<RoundEvent, { type: T }> => event.type === type);
}

/** Short presentation caption. Bot draw tile identity is intentionally never read. */
export function presentationCaption(
  frame: SinglePresentationFrame,
  humanSeat: PlayerIndex,
): string {
  const { action } = frame.trace;
  if (action.type === 'resolve-reactions') {
    const won = eventOf(frame, 'HandWon');
    if (won) return won.result.type === 'tsumo' ? 'Tsumo.' : 'Ron.';
    const called = eventOf(frame, 'CallMade');
    if (called) return `${playerLabel(called.player, humanSeat)} completes ${called.kind.toUpperCase()}.`;
    return 'Reactions resolved.';
  }

  const actor = playerLabel(action.player, humanSeat);
  switch (action.type) {
    case 'draw': {
      if (action.player !== humanSeat) return `${actor} draws.`;
      const drawn = eventOf(frame, 'TileDrawn');
      return drawn ? `${actor} draw ${tileLabel(drawn.tile)}.` : `${actor} draw.`;
    }
    case 'discard':
    case 'riichi-discard': {
      const discarded = eventOf(frame, 'TileDiscarded');
      const prefix = action.type === 'riichi-discard' ? `${actor} declares Riichi — ` : `${actor} discards `;
      return discarded ? `${prefix}${tileLabel(discarded.discard.tile)}.` : `${prefix.trim()}.`;
    }
    case 'tsumo':
      return `${actor} wins by Tsumo.`;
    case 'ron':
      return `${actor} claims Ron.`;
    case 'chi':
      return `${actor} calls Chi.`;
    case 'pon':
      return `${actor} calls Pon.`;
    case 'daiminkan':
      return `${actor} calls Kan.`;
    case 'ankan':
      return `${actor} declares a closed Kan.`;
    case 'shouminkan':
      return `${actor} adds to a Pon for Kan.`;
  }
}

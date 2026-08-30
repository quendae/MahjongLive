import './style.css';
import './ux.css';

import {
  applyHumanDecision,
  continueSingleGame,
  createSingleGame,
  driveSingleGame,
  evaluateDiscardAdvice,
  singleBotDifficulty,
} from '@mahjong-live/shared/single';
import type {
  BotDifficulty,
  DiscardAdvice,
  HumanPrompt,
  SingleDriveResult,
  SingleDriveSuccess,
  SingleGameState,
} from '@mahjong-live/shared/single';
import { seatWindFor } from '@mahjong-live/shared/rules';
import type {
  LegalAction,
  PlayerIndex,
  PlayerMeld,
  RoundAction,
  RoundEndResult,
  RoundEvent,
  RoundPlayerState,
} from '@mahjong-live/shared/rules';
import type { MatchResult } from '@mahjong-live/shared/match';
import type { Tile, Wind } from '@mahjong-live/shared/tile-types';
import { difficultyLabel, loadPreferences, savePreferences } from './preferences';

const SAVE_KEY = 'mahjong-live:single:v1';
const LOG_LIMIT = 80;
const PLAYER_SEATS: readonly PlayerIndex[] = [0, 1, 2, 3];
const numberFormat = new Intl.NumberFormat('en-US');

type ScoredHand = Extract<RoundEndResult, { type: 'tsumo' }>['score'];

type ChoiceState = {
  title: string;
  actions: readonly RoundAction[];
};

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');
const app: HTMLDivElement = root;

let current: SingleDriveSuccess | null = null;
let riichiMode = false;
let choiceState: ChoiceState | null = null;
let logEntries: string[] = [];
let transientMessage = '';
let preferences = loadPreferences();
let setupOpen = false;
let setupRequired = false;
let pendingDifficulty: BotDifficulty = preferences.preferredDifficulty;
let pendingAdvisor = preferences.advisorEnabled;
let tutorialOpen = false;
let renderedAdvice: readonly DiscardAdvice[] = [];

const windGlyph: Record<Wind, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
};

function randomSeed(): number {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return data[0] >>> 0;
}

function playerName(player: PlayerIndex): string {
  if (!current) return `P${player + 1}`;
  if (player === current.state.humanSeat) return 'You';
  const relative = (player - current.state.humanSeat + 4) % 4;
  return `Bot ${relative}`;
}

function formatPoints(points: number): string {
  return numberFormat.format(points);
}

function tileSortValue(tile: Tile): number {
  if (tile.kind === 'suited') {
    const suit = tile.suit === 'man' ? 0 : tile.suit === 'pin' ? 1 : 2;
    return suit * 10 + tile.rank;
  }
  if (tile.honorType === 'wind') {
    const winds: Wind[] = ['east', 'south', 'west', 'north'];
    return 40 + winds.indexOf(tile.value as Wind);
  }
  const dragons = ['white', 'green', 'red'];
  return 50 + dragons.indexOf(tile.value);
}

function tileLabel(tile: Tile): string {
  if (tile.kind === 'suited') {
    const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
    return `${tile.isRed ? 'red ' : ''}${tile.rank}${suffix}`;
  }
  if (tile.honorType === 'wind') return tile.value;
  return `${tile.value} dragon`;
}

function tileFace(tile: Tile): string {
  if (tile.kind === 'honor') {
    if (tile.honorType === 'wind') return windGlyph[tile.value as Wind];
    if (tile.value === 'white') return '<span class="white-dragon">□</span>';
    if (tile.value === 'green') return '<span class="green-glyph">發</span>';
    return '<span class="red-glyph">中</span>';
  }

  const suffix = tile.suit === 'man' ? '萬' : tile.suit === 'pin' ? '筒' : '索';
  return `<span class="tile-rank">${tile.rank}</span><span class="tile-suit">${suffix}</span>`;
}

function tileClass(tile: Tile): string {
  const classes = ['tile'];
  if (tile.kind === 'suited') {
    classes.push(`tile-${tile.suit}`);
    if (tile.isRed) classes.push('tile-red');
  } else {
    classes.push('tile-honor');
    if (tile.value === 'red') classes.push('tile-red');
    if (tile.value === 'green') classes.push('tile-green');
  }
  return classes.join(' ');
}

function tileMarkup(
  tile: Tile,
  options: {
    compact?: boolean;
    clickable?: boolean;
    drawn?: boolean;
    eligible?: boolean;
    disabled?: boolean;
    called?: boolean;
    advised?: boolean;
    adviceText?: string;
  } = {},
): string {
  const id = typeof tile.id === 'number' ? tile.id : -1;
  const classes = [tileClass(tile)];
  if (options.compact) classes.push('tile-compact');
  if (options.clickable) classes.push('tile-clickable');
  if (options.drawn) classes.push('tile-drawn');
  if (options.eligible) classes.push('tile-eligible');
  if (options.disabled) classes.push('tile-disabled');
  if (options.called) classes.push('tile-called');
  if (options.advised) classes.push('tile-advised');
  const attrs = options.clickable && id >= 0 ? ` data-tile-id="${id}" role="button" tabindex="0"` : '';
  const title = options.adviceText ? ` title="${options.adviceText}"` : '';
  return `<div class="${classes.join(' ')}" aria-label="${tileLabel(tile)}"${attrs}${title}>${tileFace(tile)}</div>`;
}

function tileBackMarkup(compact = false): string {
  return `<div class="tile tile-back${compact ? ' tile-compact' : ''}" aria-hidden="true"><span></span></div>`;
}

function meldMarkup(meld: PlayerMeld): string {
  const hiddenOuter = meld.type === 'quad' && meld.isOpen !== true;
  return `<div class="meld meld-${meld.type}">${meld.tiles
    .map((tile, index) => hiddenOuter && (index === 0 || index === meld.tiles.length - 1)
      ? tileBackMarkup(true)
      : tileMarkup(tile, { compact: true }))
    .join('')}</div>`;
}

function seatPosition(player: PlayerIndex, human: PlayerIndex): 'bottom' | 'right' | 'top' | 'left' {
  const relative = (player - human + 4) % 4;
  return relative === 0 ? 'bottom' : relative === 1 ? 'right' : relative === 2 ? 'top' : 'left';
}

function playerStatusMarkup(player: PlayerIndex, state: RoundPlayerState): string {
  if (!current) return '';
  const round = current.state.match.round;
  const seatWind = seatWindFor(player, round.dealer);
  const tags: string[] = [];
  if (player === round.dealer) tags.push('<span class="status-tag dealer-tag">Dealer</span>');
  if (state.riichi !== 'none') tags.push(`<span class="status-tag riichi-tag">${state.riichi === 'double-riichi' ? 'Double Riichi' : 'Riichi'}</span>`);
  return `
    <div class="player-heading">
      <span class="seat-wind">${windGlyph[seatWind]}</span>
      <span class="player-name">${playerName(player)}</span>
      <span class="player-points">${formatPoints(state.points)}</span>
    </div>
    <div class="player-tags">${tags.join('')}</div>
  `;
}

function opponentPanel(player: PlayerIndex): string {
  if (!current) return '';
  const round = current.state.match.round;
  const state = round.players[player];
  const position = seatPosition(player, current.state.humanSeat);
  const concealedCount = Math.max(0, state.concealed.length);
  const backs = Array.from({ length: concealedCount }, () => tileBackMarkup(true)).join('');
  const melds = state.melds.map(meldMarkup).join('');
  const discards = state.discards.map((discard) => tileMarkup(discard.tile, {
    compact: true,
    called: discard.calledBy !== undefined,
  })).join('');

  return `
    <section class="player-zone player-${position}" data-player="${player}">
      <div class="opponent-card">
        ${playerStatusMarkup(player, state)}
        <div class="opponent-hand" aria-label="${concealedCount} concealed tiles">${backs}</div>
        <div class="meld-row">${melds}</div>
      </div>
      <div class="discard-river">${discards}</div>
    </section>
  `;
}

function legalAction<T extends LegalAction['type']>(prompt: HumanPrompt, type: T): Extract<LegalAction, { type: T }> | undefined {
  if (prompt.kind !== 'turn' && prompt.kind !== 'reaction') return undefined;
  return prompt.legalActions.find((action): action is Extract<LegalAction, { type: T }> => action.type === type);
}

function computeDiscardAdvice(): readonly DiscardAdvice[] {
  if (!current || !preferences.advisorEnabled || current.prompt.kind !== 'turn') return [];
  const legal = riichiMode
    ? legalAction(current.prompt, 'riichi-discard')
    : legalAction(current.prompt, 'discard');
  if (!legal || !('tileIds' in legal)) return [];
  return evaluateDiscardAdvice(
    current.state.match.round,
    current.state.humanSeat,
    legal.tileIds,
  );
}

function adviceText(advice: DiscardAdvice): string {
  const distance = advice.shanten === 0 ? 'Tenpai' : `${advice.shanten} shanten`;
  const ukeire = advice.shanten <= 1 ? ` · ${advice.ukeire} ukeire` : '';
  return `Advisor: ${distance}${ukeire}`;
}

function humanHandMarkup(): string {
  if (!current) return '';
  const prompt = current.prompt;
  const round = current.state.match.round;
  const human = current.state.humanSeat;
  const player = round.players[human];
  const discard = legalAction(prompt, 'discard');
  const riichiDiscard = legalAction(prompt, 'riichi-discard');
  const discardIds = new Set(discard?.tileIds ?? []);
  const riichiIds = new Set(riichiDiscard?.tileIds ?? []);
  const adviceById = new Map(renderedAdvice.map((entry) => [entry.tileId, entry]));
  const drawnId = round.phase.kind === 'awaiting-discard' && round.phase.player === human
    ? round.phase.drawnTileId
    : null;

  const sorted = [...player.concealed].sort((a, b) => tileSortValue(a) - tileSortValue(b));
  const drawn = drawnId === null ? undefined : sorted.find((tile) => tile.id === drawnId);
  const base = drawn ? sorted.filter((tile) => tile !== drawn) : sorted;
  const ordered = drawn ? [...base, drawn] : base;

  return ordered.map((tile) => {
    const id = tile.id ?? -1;
    const isDiscard = discardIds.has(id);
    const isRiichi = riichiIds.has(id);
    const clickable = prompt.kind === 'turn' && (riichiMode ? isRiichi : isDiscard);
    const disabled = prompt.kind === 'turn' && (riichiMode ? !isRiichi : !isDiscard);
    const advice = adviceById.get(id);
    return tileMarkup(tile, {
      clickable,
      drawn: id === drawnId,
      eligible: riichiMode && isRiichi,
      disabled,
      advised: clickable && advice?.recommended === true,
      adviceText: advice ? adviceText(advice) : undefined,
    });
  }).join('');
}

function humanZone(): string {
  if (!current) return '';
  const round = current.state.match.round;
  const human = current.state.humanSeat;
  const state = round.players[human];
  const melds = state.melds.map(meldMarkup).join('');
  const discards = state.discards.map((discard) => tileMarkup(discard.tile, {
    compact: true,
    called: discard.calledBy !== undefined,
  })).join('');

  return `
    <section class="player-zone player-bottom" data-player="${human}">
      <div class="discard-river human-river">${discards}</div>
      <div class="human-card">
        ${playerStatusMarkup(human, state)}
        <div class="human-hand" id="human-hand">${humanHandMarkup()}</div>
        <div class="meld-row human-melds">${melds}</div>
      </div>
    </section>
  `;
}

function centerInfo(): string {
  if (!current) return '';
  const match = current.state.match;
  const round = match.round;
  const active = round.phase.kind === 'awaiting-draw' || round.phase.kind === 'awaiting-discard'
    ? round.phase.player
    : round.currentPlayer;
  const roundWind = windGlyph[match.wind as Wind];
  const dora = round.wall.doraIndicators.map((tile) => tileMarkup(tile, { compact: true })).join('');
  const remaining = round.wall.liveWall.length;
  return `
    <div class="table-center">
      <div class="round-title">${roundWind} ${match.hand}</div>
      <div class="center-meta">
        <span>${round.honba} honba</span>
        <span>${round.riichiSticks} riichi stick${round.riichiSticks === 1 ? '' : 's'}</span>
        <span>${remaining} draws</span>
      </div>
      <div class="dora-row"><span>Dora</span>${dora}</div>
      <div class="turn-indicator">${round.phase.kind === 'ended' ? 'Hand complete' : `${playerName(active)} to act`}</div>
    </div>
  `;
}

function actionButton(label: string, action: string, emphasis = ''): string {
  return `<button class="action-button ${emphasis}" data-ui-action="${action}">${label}</button>`;
}

function advisorStrip(): string {
  if (!preferences.advisorEnabled || renderedAdvice.length === 0 || !current) return '';
  const best = renderedAdvice.find((entry) => entry.recommended) ?? renderedAdvice[0];
  const tile = current.state.match.round.players[current.state.humanSeat].concealed.find(
    (candidate) => candidate.id === best.tileId,
  );
  const distance = best.shanten === 0 ? 'Tenpai' : `${best.shanten} shanten`;
  const ukeire = best.shanten <= 1 ? `<span class="advisor-chip">${best.ukeire} ukeire</span>` : '';
  return `
    <div class="advisor-strip">
      <strong>Advisor</strong>
      <span class="advisor-chip">${distance}</span>
      ${ukeire}
      ${tile ? `<span>Suggested discard: ${tileLabel(tile)}</span>` : ''}
    </div>
  `;
}

function actionBar(): string {
  if (!current) return '';
  const prompt = current.prompt;
  if (prompt.kind === 'round-ended' || prompt.kind === 'match-ended') return '';

  const buttons: string[] = [];
  if (prompt.kind === 'turn') {
    if (legalAction(prompt, 'tsumo')) buttons.push(actionButton('Tsumo', 'tsumo', 'action-win'));
    if (legalAction(prompt, 'riichi-discard')) {
      buttons.push(actionButton(riichiMode ? 'Cancel Riichi' : 'Riichi', 'riichi', riichiMode ? 'action-active' : ''));
    }
    if (legalAction(prompt, 'ankan')) buttons.push(actionButton('Closed Kan', 'ankan'));
    if (legalAction(prompt, 'shouminkan')) buttons.push(actionButton('Added Kan', 'shouminkan'));
  } else {
    if (legalAction(prompt, 'ron')) buttons.push(actionButton('Ron', 'ron', 'action-win'));
    if (legalAction(prompt, 'pon')) buttons.push(actionButton('Pon', 'pon'));
    if (legalAction(prompt, 'chi')) buttons.push(actionButton('Chi', 'chi'));
    if (legalAction(prompt, 'daiminkan')) buttons.push(actionButton('Kan', 'daiminkan'));
    buttons.push(actionButton('Pass', 'pass', 'action-pass'));
  }

  const hint = prompt.kind === 'turn'
    ? riichiMode
      ? 'Choose a highlighted discard to declare Riichi.'
      : 'Choose a tile from your hand to discard.'
    : 'Respond to the latest discard.';

  return `
    <div class="action-dock">
      <div class="action-hint">${hint}</div>
      ${advisorStrip()}
      <div class="action-buttons">${buttons.join('')}</div>
    </div>
  `;
}

function eventText(event: RoundEvent): string {
  switch (event.type) {
    case 'TileDrawn':
      return event.player === current?.state.humanSeat
        ? `${playerName(event.player)} drew ${tileLabel(event.tile)}${event.isRinshan ? ' from Rinshan' : ''}.`
        : `${playerName(event.player)} drew a tile${event.isRinshan ? ' from Rinshan' : ''}.`;
    case 'TileDiscarded':
      return `${playerName(event.player)} discarded ${tileLabel(event.discard.tile)}${event.discard.tsumogiri ? ' (tsumogiri)' : ''}.`;
    case 'RiichiDeclared':
      return `${playerName(event.player)} declared ${event.doubleRiichi ? 'Double Riichi' : 'Riichi'}.`;
    case 'RonClaimed':
      return `${playerName(event.player)} called Ron on ${tileLabel(event.tile)}${event.chankan ? ' (Chankan)' : ''}.`;
    case 'CallClaimed':
      return `${playerName(event.player)} claimed ${event.kind.toUpperCase()}.`;
    case 'CallMade':
      return `${playerName(event.player)} made ${event.kind.toUpperCase()}.`;
    case 'KanDeclared':
      return `${playerName(event.player)} declared ${event.kind === 'ankan' ? 'a concealed Kan' : 'an added Kan'}.`;
    case 'KanCompleted':
      return `${playerName(event.player)} completed ${event.kind}.`;
    case 'DoraIndicatorRevealed':
      return `A new Dora indicator was revealed (${event.count} active).`;
    case 'HandWon':
      return event.result.type === 'tsumo'
        ? `${playerName(event.result.winner)} won by Tsumo.`
        : `${event.result.winners.map((winner) => playerName(winner.player)).join(', ')} won by Ron.`;
    case 'RoundEnded':
      return event.result.type === 'exhaustive-draw' ? 'The hand ended in an exhaustive draw.' : 'The hand ended.';
  }
}

function appendEvents(events: readonly RoundEvent[]): void {
  for (const event of events) logEntries.unshift(eventText(event));
  logEntries = logEntries.slice(0, LOG_LIMIT);
}

function gameLog(): string {
  return `
    <aside class="game-log">
      <div class="panel-title-row"><h2>Game log</h2><span>${logEntries.length}</span></div>
      <div class="log-list">
        ${logEntries.length === 0
          ? '<div class="log-empty">Moves will appear here.</div>'
          : logEntries.map((entry) => `<div class="log-entry">${entry}</div>`).join('')}
      </div>
    </aside>
  `;
}

function paymentText(score: ScoredHand): string {
  const payment = score.payments;
  if (payment.type === 'ron') return `${formatPoints(payment.fromDiscarder)} from discarder`;
  if (payment.type === 'tsumo-dealer') return `${formatPoints(payment.fromEach)} all`;
  return `${formatPoints(payment.fromDealer)} dealer / ${formatPoints(payment.fromEachNonDealer)} others`;
}

function limitLabel(limit: ScoredHand['base']['limit']): string {
  const labels: Record<ScoredHand['base']['limit'], string> = {
    none: '',
    mangan: 'Mangan',
    haneman: 'Haneman',
    baiman: 'Baiman',
    sanbaiman: 'Sanbaiman',
    'kazoe-yakuman': 'Kazoe Yakuman',
    yakuman: 'Yakuman',
    'multiple-yakuman': 'Multiple Yakuman',
  };
  return labels[limit];
}

function scoreCard(score: ScoredHand): string {
  const yaku = score.scoringYaku.map((item) => `<li><span>${item.name}</span><strong>${item.yakuman ? `${item.yakuman}× Yakuman` : `${item.han} han`}</strong></li>`).join('');
  const limit = limitLabel(score.base.limit);
  const headline = score.yakuman > 0
    ? `${score.yakuman}× Yakuman`
    : `${score.han} han${score.fu ? ` · ${score.fu.fu} fu` : ''}`;
  const doraParts = [
    score.dora.dora ? `Dora ${score.dora.dora}` : '',
    score.dora.uraDora ? `Ura ${score.dora.uraDora}` : '',
    score.dora.akaDora ? `Aka ${score.dora.akaDora}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="score-card">
      <div class="score-headline"><strong>${limit || headline}</strong><span>${limit ? headline : ''}</span></div>
      <ul class="yaku-list">${yaku}</ul>
      ${doraParts ? `<div class="dora-breakdown">${doraParts}</div>` : ''}
      <div class="payment-line"><span>Payment</span><strong>${paymentText(score)}</strong></div>
    </div>
  `;
}

function roundResultMarkup(result: RoundEndResult): string {
  if (result.type === 'tsumo') {
    return `<div class="result-winner"><h3>${playerName(result.winner)} — Tsumo</h3>${scoreCard(result.score)}</div>`;
  }
  if (result.type === 'ron') {
    return result.winners.map((winner) => `
      <div class="result-winner">
        <h3>${playerName(winner.player)} — Ron from ${playerName(result.discarder)}</h3>
        ${scoreCard(winner.score)}
      </div>
    `).join('');
  }

  const tenpai = result.tenpaiPlayers.length
    ? result.tenpaiPlayers.map(playerName).join(', ')
    : 'Nobody';
  const deltas = PLAYER_SEATS.map((player) => {
    const delta = result.notenPayments[player];
    return `<span>${playerName(player)} ${delta >= 0 ? '+' : ''}${formatPoints(delta)}</span>`;
  }).join('');
  const nagashi = result.nagashiPlayers?.length
    ? `<div class="result-note">Nagashi Mangan: ${result.nagashiPlayers.map(playerName).join(', ')}</div>`
    : '';
  return `
    <div class="draw-summary">
      <h3>Exhaustive draw</h3>
      <p>Tenpai: ${tenpai}</p>
      ${nagashi}
      <div class="delta-row">${deltas}</div>
    </div>
  `;
}

function matchResultMarkup(result: MatchResult): string {
  const rows = result.placements.map((placement) => `
    <div class="placement-row ${placement.player === current?.state.humanSeat ? 'placement-you' : ''}">
      <span class="placement-place">${placement.place}</span>
      <span>${playerName(placement.player)}</span>
      <strong>${formatPoints(placement.points)}</strong>
    </div>
  `).join('');
  return `
    <div class="match-result">
      <h3>Final ranking</h3>
      <div class="placement-list">${rows}</div>
      <div class="result-note">End reason: ${result.reason.replaceAll('-', ' ')}</div>
    </div>
  `;
}

function resultOverlay(): string {
  if (!current || setupOpen || tutorialOpen) return '';
  if (current.prompt.kind === 'round-ended') {
    return `
      <div class="overlay">
        <div class="dialog result-dialog">
          <div class="dialog-eyebrow">Hand complete</div>
          <h2>${windGlyph[current.state.match.wind as Wind]} ${current.state.match.hand}</h2>
          ${roundResultMarkup(current.prompt.result)}
          <button class="primary-button" data-ui-action="continue">Next hand</button>
        </div>
      </div>
    `;
  }
  if (current.prompt.kind === 'match-ended') {
    return `
      <div class="overlay">
        <div class="dialog result-dialog">
          <div class="dialog-eyebrow">Hanchan complete</div>
          <h2>Match result</h2>
          ${matchResultMarkup(current.prompt.result)}
          <button class="primary-button" data-ui-action="new-game">New game</button>
        </div>
      </div>
    `;
  }
  return '';
}

function actionDescription(action: RoundAction): string {
  if (!current) return action.type;
  const hand = current.state.match.round.players[current.state.humanSeat].concealed;
  const byId = (id: number) => hand.find((tile) => tile.id === id);
  const names = (ids: readonly number[]) => ids.map(byId).filter((tile): tile is Tile => Boolean(tile)).map(tileLabel).join(' · ');
  switch (action.type) {
    case 'chi':
    case 'pon':
    case 'daiminkan':
    case 'ankan':
      return names(action.tileIds);
    case 'shouminkan': {
      const tile = byId(action.tileId);
      return tile ? `${tileLabel(tile)} · meld ${action.meldIndex + 1}` : `meld ${action.meldIndex + 1}`;
    }
    default:
      return action.type;
  }
}

function choiceOverlay(): string {
  if (!choiceState || setupOpen || tutorialOpen) return '';
  return `
    <div class="overlay overlay-choice">
      <div class="dialog choice-dialog">
        <div class="dialog-eyebrow">Choose combination</div>
        <h2>${choiceState.title}</h2>
        <div class="choice-list">
          ${choiceState.actions.map((action, index) => `<button class="choice-option" data-choice-index="${index}">${actionDescription(action)}</button>`).join('')}
        </div>
        <button class="secondary-button" data-ui-action="cancel-choice">Cancel</button>
      </div>
    </div>
  `;
}

function difficultyOptions(selected: BotDifficulty): string {
  return (['casual', 'standard', 'expert'] as const)
    .map((difficulty) => `<option value="${difficulty}"${difficulty === selected ? ' selected' : ''}>${difficultyLabel(difficulty)}</option>`)
    .join('');
}

function headerMarkup(): string {
  if (!current) return '';
  const difficulty = singleBotDifficulty(current.state);
  return `
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">麻</div>
        <div><strong>Mahjong Live</strong><span>Single Player</span></div>
      </div>
      <div class="header-status">
        <span class="save-pill"><i></i>Autosaved</span>
        <span class="seed-pill">Seed ${current.state.seed}</span>
      </div>
      <div class="header-actions">
        <label class="header-control"><span>Bot</span><select class="difficulty-select" data-setting-difficulty>${difficultyOptions(difficulty)}</select></label>
        <label class="header-control advisor-toggle"><input type="checkbox" data-setting-advisor${preferences.advisorEnabled ? ' checked' : ''}><strong>Advisor</strong></label>
        <button class="header-button" data-ui-action="tutorial">How to play</button>
        <button class="header-button" data-ui-action="restart-seed">Restart seed</button>
        <button class="header-button" data-ui-action="new-game">New game</button>
      </div>
    </header>
  `;
}

function setupOverlay(): string {
  if (!setupOpen) return '';
  const cards: Array<{ difficulty: BotDifficulty; copy: string }> = [
    { difficulty: 'casual', copy: 'Closed-hand, shanten-first opponents. No voluntary calls or advanced defensive tie-breaks.' },
    { difficulty: 'standard', copy: 'Balanced opponents using shape, Dora preservation, genbutsu defense and yaku-safe calls.' },
    { difficulty: 'expert', copy: 'Strongest profile. Adds public-information ukeire to Standard decision making.' },
  ];
  return `
    <div class="overlay">
      <div class="dialog setup-dialog">
        <div class="dialog-eyebrow">Single Player</div>
        <h2>Start a Hanchan</h2>
        <p class="setup-intro">Choose how hard the three opponents should play. Every profile uses the same authoritative rules and sees only legal/public information.</p>
        <div class="difficulty-grid">
          ${cards.map(({ difficulty, copy }) => `
            <button class="difficulty-card${pendingDifficulty === difficulty ? ' is-selected' : ''}" data-difficulty-choice="${difficulty}">
              <strong>${difficultyLabel(difficulty)}</strong>
              <span>${copy}</span>
            </button>
          `).join('')}
        </div>
        <div class="setup-options">
          <div><strong>Discard advisor</strong><small>Highlights a recommended discard and shows shanten/ukeire. It never reads hidden hands.</small></div>
          <label class="advisor-toggle"><input type="checkbox" data-setup-advisor${pendingAdvisor ? ' checked' : ''}> Enable</label>
        </div>
        <div class="setup-actions">
          ${setupRequired ? '' : '<button class="secondary-button" data-ui-action="cancel-setup">Cancel</button>'}
          <button class="primary-button" data-ui-action="confirm-new-game">Start Hanchan</button>
        </div>
      </div>
    </div>
  `;
}

function tutorialOverlay(): string {
  if (!tutorialOpen || setupOpen) return '';
  return `
    <div class="overlay">
      <div class="dialog tutorial-dialog">
        <div class="dialog-eyebrow">Quick tutorial</div>
        <h2>Four things to know</h2>
        <p class="tutorial-intro">The engine handles draws and bot turns automatically. You are stopped only when your decision matters.</p>
        <div class="tutorial-steps">
          <div class="tutorial-step"><b>1 · Discard</b><span>Click one of the bright tiles in your hand. The separated tile on the right is your latest draw.</span></div>
          <div class="tutorial-step"><b>2 · Calls</b><span>When Chi, Pon, Kan or Ron is legal, action buttons appear below the table. Pass is always available during reactions.</span></div>
          <div class="tutorial-step"><b>3 · Riichi</b><span>Press Riichi first; only legal declaration discards remain highlighted. Then choose the discard.</span></div>
          <div class="tutorial-step"><b>4 · Dora & advisor</b><span>Dora indicators sit in the table center. The optional advisor highlights development using only your hand and public tiles.</span></div>
        </div>
        <button class="primary-button" data-ui-action="close-tutorial">Play</button>
      </div>
    </div>
  `;
}

function render(): void {
  if (!current) return;
  renderedAdvice = computeDiscardAdvice();
  const human = current.state.humanSeat;
  const opponents = PLAYER_SEATS.filter((player) => player !== human);
  const byPosition = (position: 'right' | 'top' | 'left') => opponents.find((player) => seatPosition(player, human) === position);
  const right = byPosition('right');
  const top = byPosition('top');
  const left = byPosition('left');

  app.innerHTML = `
    <div class="app-shell">
      ${headerMarkup()}
      <main class="game-layout">
        <section class="table-panel">
          <div class="mahjong-table">
            ${top !== undefined ? opponentPanel(top) : ''}
            ${left !== undefined ? opponentPanel(left) : ''}
            ${right !== undefined ? opponentPanel(right) : ''}
            ${centerInfo()}
            ${humanZone()}
          </div>
          ${actionBar()}
        </section>
        ${gameLog()}
      </main>
      ${transientMessage ? `<div class="toast">${transientMessage}</div>` : ''}
      ${choiceOverlay()}
      ${resultOverlay()}
      ${setupOverlay()}
      ${tutorialOverlay()}
    </div>
  `;

  bindInteractions();
}

function persist(state: SingleGameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function processResult(result: SingleDriveResult): void {
  if (!result.ok) {
    transientMessage = `${result.code}: ${result.message}`;
    window.setTimeout(() => {
      transientMessage = '';
      render();
    }, 2800);
    render();
    return;
  }
  current = result;
  riichiMode = false;
  choiceState = null;
  appendEvents(result.events);
  persist(result.state);
  transientMessage = '';
  render();
}

function startNewGame(
  seed = randomSeed(),
  difficulty: BotDifficulty = preferences.preferredDifficulty,
): void {
  logEntries = [];
  riichiMode = false;
  choiceState = null;
  const result = driveSingleGame(createSingleGame(seed, 0, difficulty));
  if (!result.ok) {
    transientMessage = result.message;
    return;
  }
  current = result;
  appendEvents(result.events);
  persist(result.state);
  render();
}

function restoreGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const state = JSON.parse(raw) as SingleGameState;
    const result = driveSingleGame(state);
    if (!result.ok) return false;
    current = result;
    preferences = {
      ...preferences,
      preferredDifficulty: singleBotDifficulty(result.state),
    };
    savePreferences(preferences);
    logEntries = ['Saved game resumed.'];
    appendEvents(result.events);
    persist(result.state);
    render();
    return true;
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return false;
  }
}

function submitHumanAction(action: RoundAction): void {
  if (!current) return;
  processResult(applyHumanDecision(current.state, { type: 'action', action }));
}

function submitPass(): void {
  if (!current) return;
  processResult(applyHumanDecision(current.state, { type: 'pass' }));
}

function openOptions(type: 'chi' | 'pon' | 'daiminkan' | 'ankan' | 'shouminkan'): void {
  if (!current || (current.prompt.kind !== 'turn' && current.prompt.kind !== 'reaction')) return;
  const human = current.state.humanSeat;
  const legal = current.prompt.legalActions.find((action) => action.type === type);
  if (!legal) return;

  const actions: RoundAction[] = [];
  if (legal.type === 'chi') {
    for (const option of legal.options) actions.push({ type: 'chi', player: human, tileIds: option });
  } else if (legal.type === 'pon') {
    for (const option of legal.options) actions.push({ type: 'pon', player: human, tileIds: option });
  } else if (legal.type === 'daiminkan') {
    for (const option of legal.options) actions.push({ type: 'daiminkan', player: human, tileIds: option });
  } else if (legal.type === 'ankan') {
    for (const option of legal.options) actions.push({ type: 'ankan', player: human, tileIds: option });
  } else if (legal.type === 'shouminkan') {
    for (const option of legal.options) actions.push({ type: 'shouminkan', player: human, meldIndex: option.meldIndex, tileId: option.tileId });
  }

  if (actions.length === 1) {
    submitHumanAction(actions[0]);
    return;
  }
  choiceState = { title: type === 'chi' ? 'Chi' : type === 'pon' ? 'Pon' : 'Kan', actions };
  render();
}

function setActiveDifficulty(difficulty: BotDifficulty): void {
  if (!current) return;
  preferences = { ...preferences, preferredDifficulty: difficulty };
  savePreferences(preferences);
  current = {
    ...current,
    state: { ...current.state, botDifficulty: difficulty },
  };
  persist(current.state);
  render();
}

function setAdvisorEnabled(enabled: boolean): void {
  preferences = { ...preferences, advisorEnabled: enabled };
  savePreferences(preferences);
  render();
}

function handleUiAction(action: string): void {
  if (!current) return;
  const human = current.state.humanSeat;
  switch (action) {
    case 'tsumo':
      submitHumanAction({ type: 'tsumo', player: human });
      break;
    case 'ron':
      submitHumanAction({ type: 'ron', player: human });
      break;
    case 'pass':
      submitPass();
      break;
    case 'riichi':
      riichiMode = !riichiMode;
      render();
      break;
    case 'chi':
    case 'pon':
    case 'daiminkan':
    case 'ankan':
    case 'shouminkan':
      openOptions(action);
      break;
    case 'cancel-choice':
      choiceState = null;
      render();
      break;
    case 'continue':
      processResult(continueSingleGame(current.state));
      break;
    case 'restart-seed':
      if (confirm('Restart this seed from East 1?')) {
        startNewGame(current.state.seed, singleBotDifficulty(current.state));
      }
      break;
    case 'new-game':
      pendingDifficulty = preferences.preferredDifficulty;
      pendingAdvisor = preferences.advisorEnabled;
      setupRequired = false;
      setupOpen = true;
      render();
      break;
    case 'cancel-setup':
      if (!setupRequired) {
        setupOpen = false;
        render();
      }
      break;
    case 'confirm-new-game':
      preferences = {
        ...preferences,
        preferredDifficulty: pendingDifficulty,
        advisorEnabled: pendingAdvisor,
      };
      savePreferences(preferences);
      setupOpen = false;
      setupRequired = false;
      tutorialOpen = !preferences.tutorialSeen;
      startNewGame(randomSeed(), pendingDifficulty);
      break;
    case 'tutorial':
      tutorialOpen = true;
      render();
      break;
    case 'close-tutorial':
      tutorialOpen = false;
      preferences = { ...preferences, tutorialSeen: true };
      savePreferences(preferences);
      render();
      break;
  }
}

function handleTileSelection(tileId: number): void {
  if (!current || current.prompt.kind !== 'turn') return;
  const human = current.state.humanSeat;
  const discard = legalAction(current.prompt, 'discard');
  const riichi = legalAction(current.prompt, 'riichi-discard');
  if (riichiMode) {
    if (riichi?.tileIds.includes(tileId)) submitHumanAction({ type: 'riichi-discard', player: human, tileId });
    return;
  }
  if (discard?.tileIds.includes(tileId)) submitHumanAction({ type: 'discard', player: human, tileId });
}

function bindInteractions(): void {
  app.querySelectorAll<HTMLElement>('[data-ui-action]').forEach((element) => {
    element.addEventListener('click', () => handleUiAction(element.dataset.uiAction ?? ''));
  });

  app.querySelectorAll<HTMLElement>('[data-tile-id]').forEach((element) => {
    const tileId = Number(element.dataset.tileId);
    element.addEventListener('click', () => handleTileSelection(tileId));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleTileSelection(tileId);
      }
    });
  });

  app.querySelectorAll<HTMLElement>('[data-choice-index]').forEach((element) => {
    element.addEventListener('click', () => {
      const index = Number(element.dataset.choiceIndex);
      const action = choiceState?.actions[index];
      if (action) submitHumanAction(action);
    });
  });

  app.querySelectorAll<HTMLElement>('[data-difficulty-choice]').forEach((element) => {
    element.addEventListener('click', () => {
      const value = element.dataset.difficultyChoice;
      if (value === 'casual' || value === 'standard' || value === 'expert') {
        pendingDifficulty = value;
        render();
      }
    });
  });

  app.querySelector<HTMLSelectElement>('[data-setting-difficulty]')?.addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (value === 'casual' || value === 'standard' || value === 'expert') setActiveDifficulty(value);
  });

  app.querySelector<HTMLInputElement>('[data-setting-advisor]')?.addEventListener('change', (event) => {
    setAdvisorEnabled((event.currentTarget as HTMLInputElement).checked);
  });

  app.querySelector<HTMLInputElement>('[data-setup-advisor]')?.addEventListener('change', (event) => {
    pendingAdvisor = (event.currentTarget as HTMLInputElement).checked;
  });
}

const restored = restoreGame();
if (restored) {
  tutorialOpen = !preferences.tutorialSeen;
  render();
} else {
  setupRequired = true;
  setupOpen = true;
  pendingDifficulty = preferences.preferredDifficulty;
  pendingAdvisor = preferences.advisorEnabled;
  startNewGame(randomSeed(), pendingDifficulty);
}

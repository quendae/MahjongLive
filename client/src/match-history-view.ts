import { replayMatchHistory } from '@mahjong-live/shared/single';
import type { MatchHistoryEntry, MatchHistoryRecord } from '@mahjong-live/shared/single';
import type { PlayerIndex } from '@mahjong-live/shared/rules';

export interface MatchHistoryRoundView {
  roundNumber: number;
  cursor: number;
  stepCount: number;
}

export interface MatchHistoryView {
  cursor: number;
  totalSteps: number;
  roundNumber: number;
  roundLabel: string;
  points: readonly number[];
  currentEntry: string;
  rounds: readonly MatchHistoryRoundView[];
  canPrev: boolean;
  canNext: boolean;
  error: string | null;
}

function playerLabel(player: PlayerIndex | undefined, humanSeat: PlayerIndex): string {
  if (player === undefined) return 'System';
  if (player === humanSeat) return 'You';
  const relative = (player - humanSeat + 4) % 4;
  return `Bot ${relative}`;
}

function actionLabel(entry: MatchHistoryEntry, humanSeat: PlayerIndex): string {
  if (entry.kind === 'round-advance') return 'System — Next hand';
  const actor = playerLabel(entry.player, humanSeat);
  switch (entry.action.type) {
    case 'draw': return `${actor} — Draw`;
    case 'discard': return `${actor} — Discard`;
    case 'riichi-discard': return `${actor} — Riichi`;
    case 'tsumo': return `${actor} — Tsumo`;
    case 'ron': return `${actor} — Ron`;
    case 'chi': return `${actor} — Chi`;
    case 'pon': return `${actor} — Pon`;
    case 'daiminkan':
    case 'ankan':
    case 'shouminkan':
      return `${actor} — Kan`;
    case 'resolve-reactions':
      return 'System — Resolve reactions';
  }
}

function roundViews(history: MatchHistoryRecord): MatchHistoryRoundView[] {
  const starts = new Map<number, number>();
  const counts = new Map<number, number>();
  history.entries.forEach((entry, index) => {
    counts.set(entry.roundNumber, (counts.get(entry.roundNumber) ?? 0) + 1);
    if (!starts.has(entry.roundNumber)) starts.set(entry.roundNumber, index);
  });
  return [...starts.keys()]
    .sort((a, b) => a - b)
    .map((roundNumber) => ({
      roundNumber,
      cursor: roundNumber === 1 ? 0 : (starts.get(roundNumber) ?? 0),
      stepCount: counts.get(roundNumber) ?? 0,
    }));
}

export function buildMatchHistoryView(
  history: MatchHistoryRecord,
  cursor: number,
): MatchHistoryView {
  const safeCursor = Math.max(0, Math.min(history.entries.length, Math.trunc(cursor)));
  const replay = replayMatchHistory(history, safeCursor);
  const state = replay.state;
  const entry = safeCursor === 0 ? null : history.entries[safeCursor - 1];
  const wind = state.match.wind[0]?.toUpperCase() ?? '?';
  return {
    cursor: safeCursor,
    totalSteps: history.entries.length,
    roundNumber: state.match.roundNumber,
    roundLabel: `${wind}${state.match.hand}`,
    points: state.match.round.players.map((player) => player.points),
    currentEntry: entry ? actionLabel(entry, history.humanSeat) : 'Match start',
    rounds: roundViews(history),
    canPrev: safeCursor > 0,
    canNext: safeCursor < history.entries.length,
    error: replay.ok ? null : replay.message,
  };
}

export function matchHistoryViewerMarkup(view: MatchHistoryView): string {
  const rounds = view.rounds.map((round) => `
    <button class="history-round${round.roundNumber === view.roundNumber ? ' is-current' : ''}" data-history-cursor="${round.cursor}">
      <strong>Round ${round.roundNumber}</strong><span>${round.stepCount} steps</span>
    </button>
  `).join('');
  const points = view.points.map((points, index) => `<span>P${index + 1} <strong>${points.toLocaleString('en-US')}</strong></span>`).join('');
  return `
    <div class="history-viewer">
      <div class="dialog-eyebrow">Deterministic replay</div>
      <h2>Match history</h2>
      <div class="history-summary">
        <span>Step <strong>${view.cursor}</strong> / ${view.totalSteps}</span>
        <span>Hand <strong>${view.roundLabel}</strong></span>
      </div>
      <div class="history-rounds">${rounds}</div>
      <div class="history-event${view.error ? ' is-error' : ''}">${view.error ?? view.currentEntry}</div>
      <div class="history-points">${points}</div>
      <div class="history-controls" aria-label="Replay controls">
        <button class="secondary-button" data-history-action="start"${view.cursor === 0 ? ' disabled' : ''}>Start</button>
        <button class="secondary-button" data-history-action="prev"${!view.canPrev ? ' disabled' : ''}>◀</button>
        <button class="secondary-button" data-history-action="next"${!view.canNext ? ' disabled' : ''}>▶</button>
        <button class="secondary-button" data-history-action="end"${view.cursor === view.totalSteps ? ' disabled' : ''}>End</button>
      </div>
    </div>
  `;
}

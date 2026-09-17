import {
  appendRoundAdvanceHistory,
  appendSingleDriveHistory,
  createMatchHistory,
  parseMatchHistory,
} from '@mahjong-live/shared/single';
import type {
  MatchHistoryRecord,
  SingleDriveSuccess,
  SingleGameState,
} from '@mahjong-live/shared/single';
import { buildMatchHistoryView, matchHistoryViewerMarkup } from './match-history-view';

export const MATCH_HISTORY_STORAGE_KEY = 'mahjong-live:history:v1';

let history: MatchHistoryRecord | null = null;
let historyOpen = false;
let historyCursor = 0;

function persistHistory(): void {
  if (!history) {
    localStorage.removeItem(MATCH_HISTORY_STORAGE_KEY);
    return;
  }
  localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function metadataMatches(state: SingleGameState, candidate: MatchHistoryRecord): boolean {
  return candidate.seed === state.seed && candidate.humanSeat === state.humanSeat;
}

export function beginMatchHistory(initialState: SingleGameState, result: SingleDriveSuccess): void {
  history = appendSingleDriveHistory(createMatchHistory(initialState), result);
  historyCursor = history.entries.length;
  historyOpen = false;
  persistHistory();
}

export function restoreMatchHistory(state: SingleGameState, result: SingleDriveSuccess): void {
  const raw = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
  const parsed = raw ? parseMatchHistory(raw) : null;
  history = parsed && metadataMatches(state, parsed) ? parsed : null;
  if (!history) {
    if (raw) localStorage.removeItem(MATCH_HISTORY_STORAGE_KEY);
    historyCursor = 0;
    historyOpen = false;
    return;
  }
  history = appendSingleDriveHistory(history, result);
  historyCursor = history.entries.length;
  historyOpen = false;
  persistHistory();
}

export function trackMatchHistory(
  result: SingleDriveSuccess,
  roundAdvanceFrom?: SingleGameState,
): void {
  if (!history) return;
  if (roundAdvanceFrom) history = appendRoundAdvanceHistory(history, roundAdvanceFrom);
  history = appendSingleDriveHistory(history, result);
  historyCursor = history.entries.length;
  persistHistory();
}

export function matchHistoryResultButtonMarkup(): string {
  return history
    ? '<button class="secondary-button" data-match-history-open>Match history</button>'
    : '';
}

export function matchHistoryOverlayMarkup(): string {
  if (!historyOpen || !history) return '';
  const view = buildMatchHistoryView(history, historyCursor);
  return `
    <div class="overlay history-overlay">
      <div class="dialog history-dialog">
        ${matchHistoryViewerMarkup(view)}
        <div class="history-dialog-actions">
          <button class="secondary-button" data-match-history-export>Export JSON</button>
          <button class="primary-button" data-match-history-close>Close</button>
        </div>
      </div>
    </div>
  `;
}

function exportHistory(): void {
  if (!history) return;
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mahjong-live-${history.seed}-history.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function bindMatchHistoryUi(root: HTMLElement, rerender: () => void): void {
  root.querySelector<HTMLElement>('[data-match-history-open]')?.addEventListener('click', () => {
    if (!history) return;
    historyCursor = history.entries.length;
    historyOpen = true;
    rerender();
  });
  root.querySelector<HTMLElement>('[data-match-history-close]')?.addEventListener('click', () => {
    historyOpen = false;
    rerender();
  });
  root.querySelector<HTMLElement>('[data-match-history-export]')?.addEventListener('click', exportHistory);

  root.querySelectorAll<HTMLElement>('[data-history-action]').forEach((element) => {
    element.addEventListener('click', () => {
      if (!history) return;
      switch (element.dataset.historyAction) {
        case 'start': historyCursor = 0; break;
        case 'prev': historyCursor = Math.max(0, historyCursor - 1); break;
        case 'next': historyCursor = Math.min(history.entries.length, historyCursor + 1); break;
        case 'end': historyCursor = history.entries.length; break;
      }
      rerender();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-history-cursor]').forEach((element) => {
    element.addEventListener('click', () => {
      if (!history) return;
      const cursor = Number(element.dataset.historyCursor);
      if (!Number.isFinite(cursor)) return;
      historyCursor = Math.max(0, Math.min(history.entries.length, Math.trunc(cursor)));
      rerender();
    });
  });
}

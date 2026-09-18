import './visual-replay.css';

import {
  parseMatchHistory,
  replayMatchHistory,
} from '@mahjong-live/shared/single';
import type { MatchHistoryRecord } from '@mahjong-live/shared/single';
import { buildMatchHistoryView } from './match-history-view';
import { renderReplayTable, syncReplayTable } from './visual-replay-table';

const SAVE_KEY = 'mahjong-live:single:v1';
const HISTORY_KEY = 'mahjong-live:history:v1';
const PLAYBACK_BASE_DELAY_MS = 520;
const PLAYBACK_RATES = [0.5, 1, 2, 4] as const;
type PlaybackRate = typeof PLAYBACK_RATES[number];

interface SavedMatchIdentity {
  seed?: unknown;
  humanSeat?: unknown;
}

interface ActiveReplay {
  history: MatchHistoryRecord;
  cursor: number;
  livePanel: HTMLElement;
  marker: Comment;
  replayTable: HTMLElement | null;
  controls: HTMLElement;
  playing: boolean;
  timer: number | null;
  playbackRate: PlaybackRate;
}

let active: ActiveReplay | null = null;

function currentHistory(): MatchHistoryRecord | null {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  const rawSave = localStorage.getItem(SAVE_KEY);
  if (!rawHistory || !rawSave) return null;
  const history = parseMatchHistory(rawHistory);
  if (!history) return null;
  try {
    const saved = JSON.parse(rawSave) as SavedMatchIdentity;
    return saved.seed === history.seed && saved.humanSeat === history.humanSeat ? history : null;
  } catch {
    return null;
  }
}

function syncReplayButton(): void {
  const actions = document.querySelector<HTMLElement>('.app-header .header-actions');
  if (!actions) return;
  const history = currentHistory();
  const setupOpen = document.querySelector('.setup-dialog') !== null;
  let button = actions.querySelector<HTMLButtonElement>('[data-visual-replay-open]');
  if (!history || setupOpen) {
    button?.remove();
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-button';
    button.dataset.visualReplayOpen = '';
    button.textContent = 'Replay';
    actions.prepend(button);
  }
  button.disabled = active !== null || document.querySelector('.app-shell.is-presenting') !== null;
  button.title = button.disabled ? 'Wait for the current presentation to finish' : 'Replay recorded match history';
}

function exportHistory(history: MatchHistoryRecord): void {
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

function controlsMarkup(replay: ActiveReplay): string {
  const view = buildMatchHistoryView(replay.history, replay.cursor);
  const rounds = view.rounds.map((round) => `
    <button class="visual-replay-round${round.roundNumber === view.roundNumber ? ' is-current' : ''}" data-visual-replay-round-cursor="${round.cursor}">
      R${round.roundNumber}
    </button>
  `).join('');
  const speedOptions = PLAYBACK_RATES.map((rate) => `
    <option value="${rate}"${rate === replay.playbackRate ? ' selected' : ''}>${rate}×</option>
  `).join('');
  return `
    <div class="visual-replay-copy">
      <div><strong>Visual replay</strong><span>Read-only · live game preserved</span></div>
      <div class="visual-replay-status">
        <span>Step <strong>${view.cursor}</strong> / ${view.totalSteps}</span>
        <span>${view.roundLabel}</span>
        <span>${view.error ?? view.currentEntry}</span>
      </div>
    </div>
    <div class="visual-replay-rounds" aria-label="Replay rounds">${rounds}</div>
    <div class="visual-replay-controls" aria-label="Visual replay controls">
      <button class="secondary-button" data-history-action="start"${view.cursor === 0 ? ' disabled' : ''}>Start</button>
      <button class="secondary-button" data-history-action="prev"${!view.canPrev ? ' disabled' : ''}>◀</button>
      <button class="primary-button" data-history-action="play">${replay.playing ? 'Pause' : 'Play'}</button>
      <button class="secondary-button" data-history-action="next"${!view.canNext ? ' disabled' : ''}>▶</button>
      <button class="secondary-button" data-history-action="end"${view.cursor === view.totalSteps ? ' disabled' : ''}>End</button>
      <label class="visual-replay-speed">
        <span>Speed</span>
        <select data-visual-replay-speed aria-label="Replay speed">${speedOptions}</select>
      </label>
    </div>
    <div class="visual-replay-actions">
      <button class="secondary-button" data-visual-replay-export>Export JSON</button>
      <button class="primary-button" data-visual-replay-close>Return to game</button>
    </div>
  `;
}

function renderActiveReplay(): void {
  if (!active) return;
  const reconstructed = replayMatchHistory(active.history, active.cursor);
  if (active.replayTable?.isConnected) {
    syncReplayTable(active.replayTable, reconstructed.state);
  } else {
    const replayTable = renderReplayTable(active.livePanel, reconstructed.state);
    active.marker.after(replayTable);
    active.replayTable = replayTable;
  }
  active.controls.innerHTML = controlsMarkup(active);
}

function clearPlaybackTimer(): void {
  if (!active || active.timer === null) return;
  window.clearTimeout(active.timer);
  active.timer = null;
}

function stopPlayback(): void {
  if (!active) return;
  active.playing = false;
  clearPlaybackTimer();
}

function schedulePlayback(): void {
  if (!active || !active.playing) return;
  if (active.cursor >= active.history.entries.length) {
    stopPlayback();
    renderActiveReplay();
    return;
  }
  const delay = PLAYBACK_BASE_DELAY_MS / active.playbackRate;
  active.timer = window.setTimeout(() => {
    if (!active || !active.playing) return;
    active.timer = null;
    active.cursor = Math.min(active.history.entries.length, active.cursor + 1);
    renderActiveReplay();
    schedulePlayback();
  }, delay);
}

function togglePlayback(): void {
  if (!active) return;
  if (active.playing) {
    stopPlayback();
    renderActiveReplay();
    return;
  }
  if (active.cursor >= active.history.entries.length) active.cursor = 0;
  active.playing = true;
  renderActiveReplay();
  schedulePlayback();
}

function setPlaybackRate(value: string): void {
  if (!active) return;
  const parsed = Number(value);
  const rate = PLAYBACK_RATES.find((candidate) => candidate === parsed);
  if (rate === undefined || rate === active.playbackRate) return;
  active.playbackRate = rate;
  const wasPlaying = active.playing;
  clearPlaybackTimer();
  renderActiveReplay();
  if (wasPlaying) schedulePlayback();
}

function openReplay(): void {
  if (active || document.querySelector('.app-shell.is-presenting')) return;
  const history = currentHistory();
  const livePanel = document.querySelector<HTMLElement>('.table-panel');
  if (!history || !livePanel) return;

  const marker = document.createComment('mahjong-live-visual-replay');
  livePanel.replaceWith(marker);
  const controls = document.createElement('section');
  controls.className = 'visual-replay-panel';
  controls.dataset.visualReplayPanel = '';
  controls.setAttribute('role', 'dialog');
  controls.setAttribute('aria-label', 'Visual replay');
  document.body.append(controls);

  active = {
    history,
    cursor: history.entries.length,
    livePanel,
    marker,
    replayTable: null,
    controls,
    playing: false,
    timer: null,
    playbackRate: 1,
  };
  document.body.classList.add('visual-replay-active');
  renderActiveReplay();
  syncReplayButton();
}

function closeReplay(): void {
  if (!active) return;
  stopPlayback();
  const replay = active;
  active = null;
  replay.replayTable?.remove();
  replay.controls.remove();
  if (replay.marker.isConnected) replay.marker.replaceWith(replay.livePanel);
  document.body.classList.remove('visual-replay-active');
  syncReplayButton();
}

function moveCursor(action: string): void {
  if (!active) return;
  stopPlayback();
  switch (action) {
    case 'start': active.cursor = 0; break;
    case 'prev': active.cursor = Math.max(0, active.cursor - 1); break;
    case 'next': active.cursor = Math.min(active.history.entries.length, active.cursor + 1); break;
    case 'end': active.cursor = active.history.entries.length; break;
    case 'play': togglePlayback(); return;
    default: return;
  }
  renderActiveReplay();
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const opener = target.closest('[data-visual-replay-open], [data-match-history-open]');
  if (opener && !active) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openReplay();
    return;
  }

  if (!active) return;
  const close = target.closest('[data-visual-replay-close]');
  if (close) {
    event.preventDefault();
    closeReplay();
    return;
  }
  if (target.closest('[data-visual-replay-export]')) {
    event.preventDefault();
    exportHistory(active.history);
    return;
  }
  const historyAction = target.closest<HTMLElement>('[data-history-action]');
  if (historyAction) {
    event.preventDefault();
    moveCursor(historyAction.dataset.historyAction ?? '');
    return;
  }
  const round = target.closest<HTMLElement>('[data-visual-replay-round-cursor]');
  if (round) {
    event.preventDefault();
    stopPlayback();
    const cursor = Number(round.dataset.visualReplayRoundCursor);
    if (Number.isFinite(cursor)) active.cursor = Math.max(0, Math.min(active.history.entries.length, Math.trunc(cursor)));
    renderActiveReplay();
    return;
  }

  if (target.closest('#app')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function handleDocumentChange(event: Event): void {
  const target = event.target instanceof HTMLSelectElement ? event.target : null;
  if (!target || !target.matches('[data-visual-replay-speed]')) return;
  setPlaybackRate(target.value);
}

const app = document.querySelector('#app');
if (app) {
  new MutationObserver(syncReplayButton).observe(app, { childList: true, subtree: true });
}
document.addEventListener('click', handleDocumentClick, true);
document.addEventListener('change', handleDocumentChange, true);
syncReplayButton();

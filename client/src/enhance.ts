import './game-feel.css';

import { playDoraCue, playPresentationCaption, playTileSelect, playUiTap, setSoundEnabled, unlockAudio } from './audio';

const SOUND_KEY = 'mahjong-live:sound-enabled:v1';
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';
let lastPresentationSignature = '';
let lastDoraCount = -1;
let scheduled = false;

setSoundEnabled(soundEnabled);
document.addEventListener('pointerdown', unlockAudio, { passive: true });


function bindFeelSounds(): void {
  app.querySelectorAll<HTMLElement>('.tile-clickable:not([data-feel-sound])').forEach((element) => {
    element.dataset.feelSound = 'true';
    element.addEventListener('pointerdown', () => {
      unlockAudio();
      playTileSelect();
    });
  });

  app.querySelectorAll<HTMLElement>('.action-button:not([data-feel-sound]), .primary-button:not([data-feel-sound]), .secondary-button:not([data-feel-sound]), .choice-option:not([data-feel-sound]), .header-button:not(.sound-button):not([data-feel-sound])').forEach((element) => {
    element.dataset.feelSound = 'true';
    element.addEventListener('pointerdown', () => {
      if (element instanceof HTMLButtonElement && element.disabled) return;
      unlockAudio();
      playUiTap();
    });
  });
}

function updateSoundButton(button: HTMLButtonElement): void {
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.classList.toggle('is-muted', !soundEnabled);
  button.innerHTML = soundEnabled
    ? '<span class="sound-icon" aria-hidden="true">◕</span><span>Sound</span>'
    : '<span class="sound-icon" aria-hidden="true">○</span><span>Muted</span>';
  button.title = soundEnabled ? 'Mute table sounds' : 'Enable table sounds';
}

function ensureSoundButton(): void {
  const actions = app.querySelector<HTMLElement>('.header-actions');
  if (!actions || actions.querySelector('.sound-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-button sound-button';
  updateSoundButton(button);
  button.addEventListener('click', () => {
    unlockAudio();
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0');
    setSoundEnabled(soundEnabled);
    updateSoundButton(button);
    if (soundEnabled) {
      unlockAudio();
      playUiTap();
    }
  });

  const tutorial = actions.querySelector('[data-ui-action="tutorial"]');
  actions.insertBefore(button, tutorial);
}

function playerZoneForName(name: string): HTMLElement | null {
  const zones = [...app.querySelectorAll<HTMLElement>('.player-zone')];
  return zones.find((zone) => zone.querySelector('.player-name')?.textContent?.trim() === name) ?? null;
}

function applyActiveTurn(): void {
  const indicator = app.querySelector('.turn-indicator')?.textContent?.trim() ?? '';
  const match = /^(You|Bot \d+) to act$/.exec(indicator);
  if (!match) return;
  playerZoneForName(match[1])?.classList.add('is-active-turn');
}

function presentationSignature(caption: string): string {
  const zoneState = [...app.querySelectorAll<HTMLElement>('.player-zone')]
    .map((zone) => {
      const player = zone.dataset.player ?? '?';
      const concealed = zone.querySelectorAll('.opponent-hand .tile, .human-hand .tile').length;
      const discards = zone.querySelectorAll('.discard-river .tile').length;
      const melds = zone.querySelectorAll('.meld .tile').length;
      return `${player}:${concealed}:${discards}:${melds}`;
    })
    .join('|');
  return `${caption}|${zoneState}|d${app.querySelectorAll('.dora-row .tile').length}`;
}

function applyPresentationFeel(): void {
  const caption = app.querySelector('.presentation-pulse span')?.textContent?.trim() ?? '';
  const doraCount = app.querySelectorAll('.dora-row .tile').length;

  if (lastDoraCount >= 0 && doraCount > lastDoraCount) {
    app.querySelector('.table-center')?.classList.add('fx-dora');
    window.setTimeout(playDoraCue, 80);
  }
  lastDoraCount = doraCount;

  if (!caption) {
    lastPresentationSignature = '';
    return;
  }

  const signature = presentationSignature(caption);
  if (signature !== lastPresentationSignature) {
    playPresentationCaption(caption);
    lastPresentationSignature = signature;
  }

  const actor = /^(You|Bot \d+)/.exec(caption)?.[1];
  const zone = actor ? playerZoneForName(actor) : null;
  const normalized = caption.toLowerCase();

  if (normalized.includes('discard')) {
    zone?.classList.add('fx-discard');
    const riverTiles = zone?.querySelectorAll<HTMLElement>('.discard-river .tile');
    riverTiles?.[riverTiles.length - 1]?.classList.add('tile-fresh');
  } else if (normalized.includes('draw')) {
    zone?.classList.add('fx-draw');
  }

  if (normalized.includes('riichi')) zone?.classList.add('fx-riichi');
  if (normalized.includes('chi') || normalized.includes('pon') || normalized.includes('kan')) zone?.classList.add('fx-call');
  if (normalized.includes('tsumo') || normalized.includes('ron') || normalized.includes('wins')) {
    app.querySelector('.mahjong-table')?.classList.add('fx-win');
    zone?.classList.add('fx-winner');
  }
}

function enhance(): void {
  scheduled = false;
  ensureSoundButton();
  bindFeelSounds();
  applyActiveTurn();
  applyPresentationFeel();
}

function scheduleEnhance(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(enhance);
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(app, { childList: true, subtree: true });
enhance();

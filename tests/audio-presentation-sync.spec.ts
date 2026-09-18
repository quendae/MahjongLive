import { expect, test, type Page } from '@playwright/test';
import * as audio from '../client/src/audio';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

type AudioTestWindow = Window & {
  __audioStarts?: number;
  __presentationCues?: string[];
};

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '0');
    localStorage.setItem('mahjong-live:sound-enabled:v1', '1');
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'fast',
    }));

    const state = window as AudioTestWindow;
    state.__audioStarts = 0;
    state.__presentationCues = [];
    window.addEventListener('mahjong-live:presentation-cue', (event) => {
      const cue = (event as CustomEvent<{ cue?: string }>).detail?.cue;
      if (cue) state.__presentationCues?.push(cue);
    });

    class FakeAudioParam {
      value = 0;
      setValueAtTime(value: number): void { this.value = value; }
      exponentialRampToValueAtTime(value: number): void { this.value = value; }
    }

    class FakeAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      sampleRate = 48000;
      destination = {};
      createOscillator() {
        return {
          type: 'sine' as OscillatorType,
          frequency: new FakeAudioParam(),
          connect() {},
          start() { state.__audioStarts = (state.__audioStarts ?? 0) + 1; },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: new FakeAudioParam(),
          connect() {},
        };
      }
      createBuffer(_channels: number, length: number) {
        const data = new Float32Array(length);
        return { getChannelData: () => data };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() { state.__audioStarts = (state.__audioStarts ?? 0) + 1; },
        };
      }
      createBiquadFilter() {
        return {
          type: 'highpass' as BiquadFilterType,
          frequency: new FakeAudioParam(),
          connect() {},
        };
      }
      suspend(): Promise<void> { this.state = 'suspended'; return Promise.resolve(); }
      resume(): Promise<void> { this.state = 'running'; return Promise.resolve(); }
    }

    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-ui-action="confirm-new-game"]').evaluate((element: HTMLElement) => element.click());
  await page.locator('#human-hand .tile-clickable').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(120);
}

test('authoritative RoundEvents map to deterministic presentation cues', () => {
  const map = (audio as typeof audio & {
    presentationCuesForEvents?: (events: readonly { type: string }[]) => readonly string[];
  }).presentationCuesForEvents;

  expect(typeof map).toBe('function');
  if (!map) return;

  expect(map([{ type: 'TileDrawn' }])).toEqual(['draw']);
  expect(map([{ type: 'TileDiscarded' }, { type: 'RiichiDeclared' }])).toEqual(['riichi']);
  expect(map([
    { type: 'CallMade' },
    { type: 'KanCompleted' },
    { type: 'DoraIndicatorRevealed' },
  ])).toEqual(['call', 'dora']);
  expect(map([{ type: 'HandWon' }, { type: 'TileDiscarded' }, { type: 'DoraIndicatorRevealed' }])).toEqual(['win']);
});

test('a real rendered presentation frame emits its semantic cue', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const state = window as AudioTestWindow;
    state.__presentationCues = [];
  });

  await page.locator('#human-hand .tile-clickable').first().evaluate((element: HTMLElement) => element.click());
  await page.waitForFunction(() => (window as AudioTestWindow).__presentationCues?.includes('discard') === true, null, { timeout: 5000 });

  const cues = await page.evaluate(() => (window as AudioTestWindow).__presentationCues ?? []);
  expect(cues).toContain('discard');
});

test('caption and Dora DOM mutations no longer schedule presentation audio', async ({ page }) => {
  await boot(page);
  const baseline = await page.evaluate(() => (window as AudioTestWindow).__audioStarts ?? 0);

  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    const row = document.querySelector<HTMLElement>('.dora-row');
    if (!shell || !table || !row) throw new Error('Missing presentation fixture');

    shell.classList.add('is-presenting');
    const pulse = document.createElement('div');
    pulse.className = 'presentation-pulse';
    pulse.innerHTML = '<span>Bot 1 wins by Ron.</span>';
    table.appendChild(pulse);

    const tile = document.createElement('div');
    tile.className = 'tile tile-compact';
    tile.innerHTML = '<span></span>';
    row.appendChild(tile);
  });

  await page.waitForTimeout(250);
  const after = await page.evaluate(() => (window as AudioTestWindow).__audioStarts ?? 0);
  expect(after).toBe(baseline);
});

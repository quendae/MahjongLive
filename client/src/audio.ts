import type { RoundEvent } from '@mahjong-live/shared/rules';

let audioContext: AudioContext | null = null;
let enabled = true;

function context(): AudioContext | null {
  if (!enabled) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  if (!value && audioContext?.state === 'running') void audioContext.suspend();
}

export function unlockAudio(): void {
  if (!enabled) return;
  const ctx = context();
  if (ctx?.state === 'suspended') void ctx.resume();
}

function tone(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay = 0,
  endFrequency?: number,
): void {
  const ctx = context();
  if (!ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(duration: number, volume: number, delay = 0, highpass = 500): void {
  const ctx = context();
  if (!ctx || ctx.state !== 'running') return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const envelope = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

function tileClack(strength = 1): void {
  noise(0.045, 0.032 * strength, 0, 900);
  tone(215, 0.045, 0.028 * strength, 'triangle', 0, 145);
  tone(720, 0.022, 0.009 * strength, 'square', 0.004, 510);
}

function drawSlide(): void {
  noise(0.05, 0.014, 0, 1200);
  tone(330, 0.055, 0.012, 'triangle', 0.008, 250);
}

function callChime(): void {
  tone(392, 0.09, 0.025, 'sine');
  tone(523.25, 0.12, 0.022, 'sine', 0.055);
}

function riichiCue(): void {
  tileClack(1.15);
  tone(660, 0.10, 0.024, 'triangle', 0.06);
  tone(880, 0.14, 0.022, 'triangle', 0.13);
}

function doraCue(): void {
  tone(523.25, 0.10, 0.019, 'sine');
  tone(659.25, 0.11, 0.019, 'sine', 0.07);
  tone(783.99, 0.15, 0.019, 'sine', 0.14);
}

function winCue(): void {
  tone(392, 0.11, 0.024, 'triangle');
  tone(523.25, 0.12, 0.026, 'triangle', 0.08);
  tone(659.25, 0.13, 0.028, 'triangle', 0.16);
  tone(783.99, 0.22, 0.032, 'triangle', 0.24);
}

export function playUiTap(): void {
  tone(480, 0.025, 0.008, 'triangle');
}

export function playTileSelect(): void {
  tileClack(0.58);
}

export function playDoraCue(): void {
  doraCue();
}

/** Fallback cue mapper for the DOM presentation layer. */
export function playPresentationCaption(caption: string): void {
  if (!enabled || !caption) return;
  const normalized = caption.toLowerCase();
  if (normalized.includes('tsumo') || normalized.includes('ron') || normalized.includes('wins')) {
    winCue();
    return;
  }
  if (normalized.includes('riichi')) {
    riichiCue();
    return;
  }
  if (normalized.includes('chi') || normalized.includes('pon') || normalized.includes('kan')) {
    callChime();
    return;
  }
  if (normalized.includes('discard')) {
    tileClack();
    return;
  }
  if (normalized.includes('draw')) drawSlide();
}

/** Play one restrained cue for the most meaningful event in a presentation frame. */
export function playRoundEvents(events: readonly RoundEvent[]): void {
  if (!enabled || events.length === 0) return;
  if (events.some((event) => event.type === 'HandWon')) {
    winCue();
    return;
  }
  if (events.some((event) => event.type === 'RiichiDeclared')) {
    riichiCue();
    return;
  }
  if (events.some((event) => event.type === 'CallMade' || event.type === 'KanCompleted')) {
    callChime();
    return;
  }
  if (events.some((event) => event.type === 'DoraIndicatorRevealed')) {
    doraCue();
    return;
  }
  if (events.some((event) => event.type === 'TileDiscarded')) {
    tileClack();
    return;
  }
  if (events.some((event) => event.type === 'TileDrawn')) drawSlide();
}

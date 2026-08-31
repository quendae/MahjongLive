import type { BotDifficulty } from '@mahjong-live/shared/single';

const PREFERENCES_KEY = 'mahjong-live:preferences:v1';

export type PresentationSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface ClientPreferences {
  preferredDifficulty: BotDifficulty;
  advisorEnabled: boolean;
  tutorialSeen: boolean;
  presentationSpeed: PresentationSpeed;
  soundEnabled: boolean;
}

const DEFAULT_PREFERENCES: ClientPreferences = {
  preferredDifficulty: 'standard',
  advisorEnabled: false,
  tutorialSeen: false,
  presentationSpeed: 'normal',
  soundEnabled: true,
};

function isDifficulty(value: unknown): value is BotDifficulty {
  return value === 'casual' || value === 'standard' || value === 'expert';
}

function isPresentationSpeed(value: unknown): value is PresentationSpeed {
  return value === 'slow' || value === 'normal' || value === 'fast' || value === 'instant';
}

export function loadPreferences(): ClientPreferences {
  const raw = localStorage.getItem(PREFERENCES_KEY);
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<ClientPreferences>;
    return {
      preferredDifficulty: isDifficulty(parsed.preferredDifficulty)
        ? parsed.preferredDifficulty
        : DEFAULT_PREFERENCES.preferredDifficulty,
      advisorEnabled: typeof parsed.advisorEnabled === 'boolean'
        ? parsed.advisorEnabled
        : DEFAULT_PREFERENCES.advisorEnabled,
      tutorialSeen: parsed.tutorialSeen === true,
      presentationSpeed: isPresentationSpeed(parsed.presentationSpeed)
        ? parsed.presentationSpeed
        : DEFAULT_PREFERENCES.presentationSpeed,
      soundEnabled: typeof parsed.soundEnabled === 'boolean'
        ? parsed.soundEnabled
        : DEFAULT_PREFERENCES.soundEnabled,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences: ClientPreferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function difficultyLabel(difficulty: BotDifficulty): string {
  return difficulty === 'casual' ? 'Casual' : difficulty === 'standard' ? 'Standard' : 'Expert';
}

export function presentationSpeedLabel(speed: PresentationSpeed): string {
  return speed === 'slow' ? 'Slow' : speed === 'normal' ? 'Normal' : speed === 'fast' ? 'Fast' : 'Instant';
}

export function presentationDelayMs(speed: PresentationSpeed): number {
  return speed === 'slow' ? 650 : speed === 'normal' ? 360 : speed === 'fast' ? 150 : 0;
}

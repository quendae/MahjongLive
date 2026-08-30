import type { BotDifficulty } from '@mahjong-live/shared/single';

const PREFERENCES_KEY = 'mahjong-live:preferences:v1';

export interface ClientPreferences {
  preferredDifficulty: BotDifficulty;
  advisorEnabled: boolean;
  tutorialSeen: boolean;
}

const DEFAULT_PREFERENCES: ClientPreferences = {
  preferredDifficulty: 'standard',
  advisorEnabled: false,
  tutorialSeen: false,
};

function isDifficulty(value: unknown): value is BotDifficulty {
  return value === 'casual' || value === 'standard' || value === 'expert';
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

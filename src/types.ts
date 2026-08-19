export interface CharacterListing {
  id: string;
  name: string;
  level: number;
  race: string;
  class: string;
  faction: 'Alliance' | 'Horde' | 'Neutral';
  realm: string;
  achievementPoints: number;
  itemLevel: number;
  price: number;
  listingDate: string;
  detailsUrl: string;
  matchedRules?: string[]; // Rule IDs that matched
  matchedRuleNames?: string[];
  rawSnippet?: string;
}

export interface BargainRule {
  id: string;
  name: string;
  enabled: boolean;
  realm: string; // 'Any' or specific realm (e.g. 'Evermoon', 'Tauri', 'Crystalsong')
  characterClass: string; // 'Any' or specific class (e.g. 'Warrior', 'Paladin', etc.)
  race: string; // 'Any' or specific race
  faction: 'Any' | 'Alliance' | 'Horde';
  minLevel?: number | null;
  maxLevel?: number | null;
  minItemLevel?: number | null;
  maxItemLevel?: number | null;
  minAchievementPoints?: number | null;
  maxAchievementPoints?: number | null;
  maxPrice?: number | null; // max credits
  createdAt: string;
  matchCount: number;
  lastMatchedAt?: string;
}

export interface MonitorConfig {
  pollingIntervalMinutes: number;
  isPollingActive: boolean;
  discordWebhookConfigured: boolean;
  tauriSessionConfigured: boolean;
  tauriAhUrl: string;
  lastCheckedAt?: string;
  lastCheckStatus?: 'success' | 'error' | 'idle' | 'running';
  lastCheckError?: string;
  totalParsed: number;
  totalNotified: number;
  nextCheckAt?: string;
}

export interface NotificationLog {
  id: string;
  characterId: string;
  characterName: string;
  ruleId: string;
  ruleName: string;
  price: number;
  realm: string;
  characterClass: string;
  race: string;
  level: number;
  itemLevel: number;
  achievementPoints: number;
  timestamp: string;
  discordStatus: 'sent' | 'failed' | 'simulated';
  discordError?: string;
  detailsUrl: string;
}

export const WOW_CLASSES = [
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Death Knight',
  'Shaman',
  'Mage',
  'Warlock',
  'Monk',
  'Druid'
] as const;

export const WOW_REALMS = [
  'Evermoon',
  'Tauri',
  'Warriors of Darkness',
  'Crystalsong',
  'TauriMoP'
] as const;

export const WOW_RACES = [
  'Human',
  'Orc',
  'Dwarf',
  'Night Elf',
  'Undead',
  'Tauren',
  'Gnome',
  'Troll',
  'Blood Elf',
  'Draenei',
  'Goblin',
  'Worgen',
  'Pandaren'
] as const;

export const CLASS_COLORS: Record<string, string> = {
  'Warrior': '#C79C6E',
  'Paladin': '#F58CBA',
  'Hunter': '#ABD473',
  'Rogue': '#FFF569',
  'Priest': '#FFFFFF',
  'Death Knight': '#C41F3B',
  'Shaman': '#0070DE',
  'Mage': '#69CCF0',
  'Warlock': '#9482C9',
  'Monk': '#00FF96',
  'Druid': '#FF7D0A'
};

export const CLASS_HEX_INT: Record<string, number> = {
  'Warrior': 0xC79C6E,
  'Paladin': 0xF58CBA,
  'Hunter': 0xABD473,
  'Rogue': 0xFFF569,
  'Priest': 0xFFFFFF,
  'Death Knight': 0xC41F3B,
  'Shaman': 0x0070DE,
  'Mage': 0x69CCF0,
  'Warlock': 0x9482C9,
  'Monk': 0x00FF96,
  'Druid': 0xFF7D0A
};

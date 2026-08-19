import { CharacterListing, BargainRule } from '../src/types';

export function evaluateRule(rule: BargainRule, character: CharacterListing): boolean {
  // If rule is explicitly disabled, do not match in active polling
  if (rule.enabled === false) {
    return false;
  }

  // 1. Realm Filter (supports 'Evermoon', 'Evermoon (x2)', 'Tauri', 'Tauri (x1)', etc.)
  if (rule.realm && rule.realm !== 'Any' && rule.realm.trim() !== '') {
    const targetRealm = rule.realm.trim().toLowerCase();
    const charRealm = (character.realm || '').toLowerCase();
    if (!charRealm.includes(targetRealm) && !targetRealm.includes(charRealm)) {
      return false;
    }
  }

  // 2. Class Filter
  if (rule.characterClass && rule.characterClass !== 'Any' && rule.characterClass.trim() !== '') {
    if (rule.characterClass.trim().toLowerCase() !== (character.class || '').toLowerCase()) {
      return false;
    }
  }

  // 3. Race Filter (handles 'Blood Elf', 'Pandaren', 'Orc', etc.)
  if (rule.race && rule.race !== 'Any' && rule.race.trim() !== '') {
    const targetRace = rule.race.trim().toLowerCase();
    const charRace = (character.race || '').toLowerCase();
    if (!charRace.includes(targetRace) && !targetRace.includes(charRace)) {
      return false;
    }
  }

  // 4. Faction Filter ('Alliance' | 'Horde' | 'Any')
  if (rule.faction && rule.faction !== 'Any' && rule.faction.trim() !== '') {
    if (rule.faction.trim().toLowerCase() !== (character.faction || '').toLowerCase()) {
      return false;
    }
  }

  // 5. Level Range (min / max)
  if (rule.minLevel !== null && rule.minLevel !== undefined && !isNaN(Number(rule.minLevel))) {
    if (character.level < Number(rule.minLevel)) {
      return false;
    }
  }
  if (rule.maxLevel !== null && rule.maxLevel !== undefined && !isNaN(Number(rule.maxLevel))) {
    if (character.level > Number(rule.maxLevel)) {
      return false;
    }
  }

  // 6. Item Level (ilvl) Range
  if (rule.minItemLevel !== null && rule.minItemLevel !== undefined && !isNaN(Number(rule.minItemLevel))) {
    if (character.itemLevel < Number(rule.minItemLevel)) {
      return false;
    }
  }
  if (rule.maxItemLevel !== null && rule.maxItemLevel !== undefined && !isNaN(Number(rule.maxItemLevel))) {
    if (character.itemLevel > Number(rule.maxItemLevel)) {
      return false;
    }
  }

  // 7. Achievement Points Range
  if (rule.minAchievementPoints !== null && rule.minAchievementPoints !== undefined && !isNaN(Number(rule.minAchievementPoints))) {
    if (character.achievementPoints < Number(rule.minAchievementPoints)) {
      return false;
    }
  }
  if (rule.maxAchievementPoints !== null && rule.maxAchievementPoints !== undefined && !isNaN(Number(rule.maxAchievementPoints))) {
    if (character.achievementPoints > Number(rule.maxAchievementPoints)) {
      return false;
    }
  }

  // 8. Maximum Credit Price
  if (rule.maxPrice !== null && rule.maxPrice !== undefined && !isNaN(Number(rule.maxPrice))) {
    if (character.price > Number(rule.maxPrice)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates a rule against a list of character listings (even if the rule is disabled, e.g. for testing).
 */
export function testRuleAgainstListings(rule: BargainRule, listings: CharacterListing[]): CharacterListing[] {
  const testRule = { ...rule, enabled: true };
  return listings.filter(char => evaluateRule(testRule, char));
}

export function matchRulesForCharacter(rules: BargainRule[], character: CharacterListing): BargainRule[] {
  return rules.filter(r => evaluateRule(r, character));
}

export const DEFAULT_RULES: BargainRule[] = [
  {
    id: 'rule-evermoon-budget-85-90',
    name: 'Evermoon Sub-10k Credit Bargains (Lvl 85-90)',
    enabled: true,
    realm: 'Evermoon',
    characterClass: 'Any',
    race: 'Any',
    faction: 'Any',
    minLevel: 85,
    maxLevel: 90,
    minItemLevel: null,
    maxItemLevel: null,
    minAchievementPoints: null,
    maxAchievementPoints: null,
    maxPrice: 10000,
    createdAt: new Date().toISOString(),
    matchCount: 0
  },
  {
    id: 'rule-high-level-110-deals',
    name: 'Level 110 High ilvl (800+) Under 20k Credits',
    enabled: true,
    realm: 'Any',
    characterClass: 'Any',
    race: 'Any',
    faction: 'Any',
    minLevel: 110,
    maxLevel: 110,
    minItemLevel: 800,
    maxItemLevel: null,
    minAchievementPoints: null,
    maxAchievementPoints: null,
    maxPrice: 20000,
    createdAt: new Date().toISOString(),
    matchCount: 0
  },
  {
    id: 'rule-collector-achiev-5k',
    name: 'Achievement Collector (5,000+ AP) Under 40k Credits',
    enabled: false,
    realm: 'Any',
    characterClass: 'Any',
    race: 'Any',
    faction: 'Any',
    minLevel: null,
    maxLevel: null,
    minItemLevel: null,
    maxItemLevel: null,
    minAchievementPoints: 5000,
    maxAchievementPoints: null,
    maxPrice: 40000,
    createdAt: new Date().toISOString(),
    matchCount: 0
  }
];

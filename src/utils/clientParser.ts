import { CharacterListing } from '../types';

/**
 * Client-side browser DOMParser for Tauri Character AH HTML snippets.
 * Enables 100% client-side offline testing on static deployments.
 */
export function parseCharacterAhHtmlClient(html: string, fallbackUrl = 'https://tauriwow.com/vipdsh/ajax/characterah'): CharacterListing[] {
  if (!html || !html.trim()) return [];

  const listings: CharacterListing[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Tauri AH character containers
  const items = doc.querySelectorAll('.chah-characterdata, .auction-item, .character-item, tr[data-char-id], [class*="chah-"]');

  // If specific classes not found, parse any element containing credit indicators
  const candidateElements = items.length > 0 ? items : doc.querySelectorAll('.tc-indicator, [class*="character"]');

  const processedIds = new Set<string>();

  candidateElements.forEach((el, index) => {
    try {
      const parent = el.closest('.chah-row, .auction-row, tr, li, div') || el;
      const text = parent.textContent || '';

      // Find price
      const priceIndicator = parent.querySelector('.tc-indicator, .price, .cost, [class*="price"]') || el;
      let price = 0;
      if (priceIndicator) {
        const rawPriceText = (priceIndicator.textContent || '').replace(/[^\d.]/g, '').replace(/\./g, '');
        price = parseInt(rawPriceText, 10) || 0;
      }

      // Find name and details URL
      const link = parent.querySelector('a[href*="character/"], a[href*="characterah"], a[href*="armory"]') as HTMLAnchorElement | null;
      let name = link?.textContent?.trim() || '';
      let detailsUrl = link?.getAttribute('href') || '';

      if (!name) {
        const nameEl = parent.querySelector('.chah-name, .character-name, .name, strong, b');
        name = nameEl?.textContent?.trim() || `Character #${index + 1}`;
      }

      let id = '';
      if (detailsUrl) {
        const match = detailsUrl.match(/character\/(\d+)/i) || detailsUrl.match(/id=(\d+)/i);
        if (match) id = match[1];
      }
      if (!id) {
        id = parent.getAttribute('data-id') || parent.getAttribute('data-char-id') || `char-${index + 1}`;
      }

      if (processedIds.has(id)) return;
      processedIds.add(id);

      if (detailsUrl && !detailsUrl.startsWith('http')) {
        detailsUrl = `https://tauriwow.com/${detailsUrl.replace(/^\/+/, '')}`;
      }
      if (!detailsUrl) {
        detailsUrl = `https://tauriwow.com/vippanel#vipdsh/characterah/character/${id}`;
      }

      // Parse level, class, race, realm
      let level = 90;
      const levelMatch = text.match(/level\s*[:]?\s*(\d+)/i) || text.match(/(\d+)\s*(?:lvl|level)/i) || text.match(/\b(85|90|100|110)\b/);
      if (levelMatch) {
        level = parseInt(levelMatch[1], 10);
      }

      let itemLevel = 0;
      const ilvlMatch = text.match(/(?:ilvl|item level|itemlvl)\s*[:]?\s*(\d+)/i) || text.match(/\b(\d{3})\s*ilvl/i);
      if (ilvlMatch) {
        itemLevel = parseInt(ilvlMatch[1], 10);
      }

      let achievementPoints = 0;
      const achMatch = text.match(/(?:achiev|achievement|points|ap)\s*[:]?\s*([\d,.]+)/i);
      if (achMatch) {
        achievementPoints = parseInt(achMatch[1].replace(/[^\d]/g, ''), 10) || 0;
      }

      let characterClass = 'Warrior';
      const classes = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Death Knight', 'Shaman', 'Mage', 'Warlock', 'Monk', 'Druid'];
      for (const cls of classes) {
        if (new RegExp(`\\b${cls}\\b`, 'i').test(text)) {
          characterClass = cls;
          break;
        }
      }

      let race = 'Human';
      const races = ['Human', 'Orc', 'Dwarf', 'Night Elf', 'Undead', 'Tauren', 'Gnome', 'Troll', 'Blood Elf', 'Draenei', 'Goblin', 'Worgen', 'Pandaren'];
      for (const r of races) {
        if (new RegExp(`\\b${r}\\b`, 'i').test(text)) {
          race = r;
          break;
        }
      }

      let realm = 'Evermoon (x2)';
      if (text.includes('Evermoon')) realm = 'Evermoon (x2)';
      else if (text.includes('Tauri')) realm = 'Tauri (x1)';
      else if (text.includes('Crystalsong')) realm = 'Crystalsong';

      let faction: 'Alliance' | 'Horde' | 'Neutral' = 'Alliance';
      const hordeRaces = ['Orc', 'Undead', 'Tauren', 'Troll', 'Blood Elf', 'Goblin'];
      if (hordeRaces.includes(race) || text.toLowerCase().includes('horde')) {
        faction = 'Horde';
      }

      listings.push({
        id,
        name,
        level,
        race,
        class: characterClass,
        faction,
        realm,
        achievementPoints,
        itemLevel,
        price,
        listingDate: 'Live Feed',
        detailsUrl,
        rawSnippet: parent.innerHTML.substring(0, 300)
      });
    } catch {
      // Continue parsing remaining items
    }
  });

  return listings;
}

export const parseTauriAhHtmlClient = parseCharacterAhHtmlClient;

/**
 * Evaluate character listing against a list of bargain rules client-side
 */
export function evaluateListingAgainstRulesClient(
  listing: CharacterListing,
  rules: {
    id: string;
    name: string;
    enabled: boolean;
    realm?: string;
    characterClass?: string;
    race?: string;
    faction?: string;
    minLevel?: number | null;
    maxLevel?: number | null;
    minItemLevel?: number | null;
    maxItemLevel?: number | null;
    minAchievementPoints?: number | null;
    maxAchievementPoints?: number | null;
    maxPrice?: number | null;
  }[]
): string[] {
  const matchedRuleNames: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Realm filter
    if (rule.realm && rule.realm !== 'Any' && rule.realm.trim() !== '') {
      const targetRealm = rule.realm.trim().toLowerCase();
      const listingRealm = (listing.realm || '').toLowerCase();
      if (!listingRealm.includes(targetRealm) && !targetRealm.includes(listingRealm)) {
        continue;
      }
    }

    // Class filter
    if (rule.characterClass && rule.characterClass !== 'Any' && rule.characterClass.trim() !== '') {
      if (rule.characterClass.toLowerCase() !== listing.class.toLowerCase()) {
        continue;
      }
    }

    // Race filter
    if (rule.race && rule.race !== 'Any' && rule.race.trim() !== '') {
      if (rule.race.toLowerCase() !== listing.race.toLowerCase()) {
        continue;
      }
    }

    // Faction filter
    if (rule.faction && rule.faction !== 'Any' && rule.faction.trim() !== '') {
      if (rule.faction.toLowerCase() !== listing.faction.toLowerCase()) {
        continue;
      }
    }

    // Min Level
    if (rule.minLevel !== null && rule.minLevel !== undefined && rule.minLevel > 0) {
      if (listing.level < rule.minLevel) continue;
    }

    // Max Level
    if (rule.maxLevel !== null && rule.maxLevel !== undefined && rule.maxLevel > 0) {
      if (listing.level > rule.maxLevel) continue;
    }

    // Min Item Level
    if (rule.minItemLevel !== null && rule.minItemLevel !== undefined && rule.minItemLevel > 0) {
      if (listing.itemLevel < rule.minItemLevel) continue;
    }

    // Max Item Level
    if (rule.maxItemLevel !== null && rule.maxItemLevel !== undefined && rule.maxItemLevel > 0) {
      if (listing.itemLevel > rule.maxItemLevel) continue;
    }

    // Min Achievement Points
    if (rule.minAchievementPoints !== null && rule.minAchievementPoints !== undefined && rule.minAchievementPoints > 0) {
      if (listing.achievementPoints < rule.minAchievementPoints) continue;
    }

    // Max Achievement Points
    if (rule.maxAchievementPoints !== null && rule.maxAchievementPoints !== undefined && rule.maxAchievementPoints > 0) {
      if (listing.achievementPoints > rule.maxAchievementPoints) continue;
    }

    // Max Price
    if (rule.maxPrice !== null && rule.maxPrice !== undefined && rule.maxPrice > 0) {
      if (listing.price > rule.maxPrice) continue;
    }

    matchedRuleNames.push(rule.name);
  }

  return matchedRuleNames;
}

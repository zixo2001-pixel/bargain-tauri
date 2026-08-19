import * as cheerio from 'cheerio';
import { CharacterListing } from '../src/types';

const CLASS_MAP: Record<number | string, string> = {
  1: 'Warrior',
  2: 'Paladin',
  3: 'Hunter',
  4: 'Rogue',
  5: 'Priest',
  6: 'Death Knight',
  7: 'Shaman',
  8: 'Mage',
  9: 'Warlock',
  10: 'Monk',
  11: 'Druid',
  'warrior': 'Warrior',
  'paladin': 'Paladin',
  'hunter': 'Hunter',
  'rogue': 'Rogue',
  'priest': 'Priest',
  'deathknight': 'Death Knight',
  'death knight': 'Death Knight',
  'shaman': 'Shaman',
  'mage': 'Mage',
  'warlock': 'Warlock',
  'monk': 'Monk',
  'druid': 'Druid',
};

const RACE_MAP: Record<number | string, string> = {
  1: 'Human',
  2: 'Orc',
  3: 'Dwarf',
  4: 'Night Elf',
  5: 'Undead',
  6: 'Tauren',
  7: 'Gnome',
  8: 'Troll',
  9: 'Goblin',
  10: 'Blood Elf',
  11: 'Draenei',
  22: 'Worgen',
  24: 'Pandaren',
  25: 'Pandaren',
  26: 'Pandaren',
  'human': 'Human',
  'orc': 'Orc',
  'dwarf': 'Dwarf',
  'night elf': 'Night Elf',
  'nightelf': 'Night Elf',
  'undead': 'Undead',
  'scourge': 'Undead',
  'tauren': 'Tauren',
  'gnome': 'Gnome',
  'troll': 'Troll',
  'blood elf': 'Blood Elf',
  'bloodelf': 'Blood Elf',
  'draenei': 'Draenei',
  'goblin': 'Goblin',
  'worgen': 'Worgen',
  'pandaren': 'Pandaren',
};

const ALLIANCE_RACES = new Set(['Human', 'Dwarf', 'Night Elf', 'Gnome', 'Draenei', 'Worgen']);
const HORDE_RACES = new Set(['Orc', 'Undead', 'Tauren', 'Troll', 'Blood Elf', 'Goblin']);

export function inferFaction(race: string, rawText = ''): 'Alliance' | 'Horde' | 'Neutral' {
  if (rawText.toLowerCase().includes('alliance') || rawText.toLowerCase().includes('alliance.png')) {
    return 'Alliance';
  }
  if (rawText.toLowerCase().includes('horde') || rawText.toLowerCase().includes('horde.png')) {
    return 'Horde';
  }
  if (ALLIANCE_RACES.has(race)) return 'Alliance';
  if (HORDE_RACES.has(race)) return 'Horde';
  return 'Neutral';
}

export function parseCharacterAhHtml(html: string, baseUrl = 'https://tauriwow.com'): CharacterListing[] {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const $ = cheerio.load(html);
  const listings: CharacterListing[] = [];
  const seenIds = new Set<string>();

  // 1. Live Tauri VIP Dashboard Character AH structure (.chah-auction)
  $('.chah-auction').each((index, element) => {
    const item = $(element);
    const charNameLink = item.find('.chah-charname a');
    const name = charNameLink.text().trim();
    const href = charNameLink.attr('href') || item.find('.chah-buttons a').attr('href') || '';
    
    // Extract ID
    const idMatch = href.match(/character\/([0-9]+)/i) || href.match(/id=([0-9]+)/i);
    const id = idMatch ? idMatch[1] : `tauri-${index + 1}-${name}`;

    // Price from .tc-indicator (e.g. "4.500" -> 4500, "17.800" -> 17800)
    const priceRaw = item.find('.tc-indicator').text().trim();
    let price = 0;
    if (priceRaw) {
      price = parseInt(priceRaw.replace(/[,.]/g, ''), 10) || 0;
    }

    // Date from .chah-auction-details
    const dateText = item.find('.chah-auction-details div:last-child').text().trim() || new Date().toISOString();

    // Line 1: e.g. "lvl 93 Worgen Hunter" and Realm label
    const line1 = item.find('.chah-chardata-line1');
    const realmText = line1.find('.label i, .label').first().text().trim() || 'Evermoon (x2)';
    const realm = realmText.replace(/\s+/g, ' ');

    // Extract level, race, class from line 1
    const line1Text = line1.clone().find('.chah-charname, .label').remove().end().text().trim();
    const lvlMatch = line1Text.match(/lvl\s*(\d+)/i);
    const level = lvlMatch ? parseInt(lvlMatch[1], 10) : 90;

    let detectedRace = 'Human';
    let detectedClass = 'Warrior';

    for (const [rKey, rVal] of Object.entries(RACE_MAP)) {
      if (typeof rKey === 'string' && new RegExp(`\\b${rKey}\\b`, 'i').test(line1Text)) {
        detectedRace = rVal;
        break;
      }
    }

    for (const [cKey, cVal] of Object.entries(CLASS_MAP)) {
      if (typeof cKey === 'string' && new RegExp(`\\b${cKey}\\b`, 'i').test(line1Text)) {
        detectedClass = cVal;
        break;
      }
    }

    // Faction from classes or race
    const isHorde = item.find('.faction-1, .faction-horde').length > 0;
    const isAlliance = item.find('.faction-0, .faction-alliance').length > 0;
    const faction = isHorde ? 'Horde' : isAlliance ? 'Alliance' : inferFaction(detectedRace, line1Text);

    // Line 2: achievements, item level
    const line2Text = item.find('.chah-chardata-line2').text().trim();
    const ilvlMatch = line2Text.match(/(\d+)\s*ilvl/i);
    const itemLevel = ilvlMatch ? parseInt(ilvlMatch[1], 10) : 0;

    // Achievement points following fa-shield
    const apText = item.find('.fa-shield').parent().text().trim();
    const apMatch = apText.match(/(\d+)/) || line2Text.match(/(\d+)\s*(?:ilvl)?/);
    const achievementPoints = apMatch ? parseInt(apMatch[1], 10) : 0;

    const detailsUrl = href.startsWith('http')
      ? href
      : `https://tauriwow.com/vippanel${href.startsWith('#') ? '' : '/'}${href}`;

    if (name && !seenIds.has(id)) {
      seenIds.add(id);
      listings.push({
        id,
        name,
        level,
        race: detectedRace,
        class: detectedClass,
        faction,
        realm,
        achievementPoints,
        itemLevel,
        price,
        listingDate: dateText,
        detailsUrl,
        rawSnippet: item.html()?.slice(0, 300)
      });
    }
  });

  if (listings.length > 0) {
    return listings;
  }

  // 2. Table rows parsing (standard Tauri table structure)
  // Tauri armory/character.php usually renders <table> with rows for each listed character
  $('table tbody tr, table.table tr, .character-list tr, tr').each((index, element) => {
    const row = $(element);
    
    // Skip header rows
    if (row.find('th').length > 0 && row.find('td').length === 0) {
      return;
    }

    const rowText = row.text().trim();
    if (!rowText || rowText.length < 5) {
      return;
    }

    const rowHtml = row.html() || '';

    // Extract links, IDs
    let id = '';
    let name = '';
    let detailsUrl = '';

    // Look for links with ID or character name
    row.find('a').each((_, aElem) => {
      const href = $(aElem).attr('href') || '';
      const text = $(aElem).text().trim();
      
      const idMatch = href.match(/(?:id|char_id|auction_id|guid)=([0-9a-zA-Z_-]+)/i);
      if (idMatch && !id) {
        id = idMatch[1];
      }

      // Check for armory link pattern like armory#character-sheet.xml?r=Evermoon&n=PlayerName
      const nameMatch = href.match(/[?&]n=([A-Za-z0-9\u00C0-\u024F]+)/i) || href.match(/character\/([A-Za-z0-9]+)/i);
      if (nameMatch && !name) {
        name = decodeURIComponent(nameMatch[1]);
      } else if (text && text.length >= 2 && !name && !['view', 'details', 'buy', 'armory'].includes(text.toLowerCase())) {
        name = text;
      }

      if (href && !detailsUrl) {
        detailsUrl = href.startsWith('http') ? href : `${baseUrl.replace(/\/$/, '')}/${href.replace(/^\//, '')}`;
      }
    });

    // Check data attributes if ID not found
    if (!id) {
      id = row.attr('data-id') || row.attr('data-char-id') || row.attr('data-auction-id') || '';
    }

    // Class detection
    let detectedClass = 'Warrior';
    const classImg = row.find('img[src*="classes/"], img[src*="class/"], img[alt*="class"], .class-icon, [class*="class-"]');
    if (classImg.length > 0) {
      const src = classImg.attr('src') || classImg.attr('class') || classImg.attr('alt') || '';
      const classNumMatch = src.match(/classes?\/([0-9]+)/i) || src.match(/class-([0-9]+)/i);
      if (classNumMatch) {
        detectedClass = CLASS_MAP[parseInt(classNumMatch[1], 10)] || detectedClass;
      } else {
        for (const [key, val] of Object.entries(CLASS_MAP)) {
          if (src.toLowerCase().includes(key.toLowerCase())) {
            detectedClass = val;
            break;
          }
        }
      }
    } else {
      // Check for class name directly in cell text
      for (const [key, val] of Object.entries(CLASS_MAP)) {
        if (typeof key === 'string' && new RegExp(`\\b${key}\\b`, 'i').test(rowText)) {
          detectedClass = val;
          break;
        }
      }
    }

    // Race detection
    let detectedRace = 'Human';
    const raceImg = row.find('img[src*="races/"], img[src*="race/"], img[alt*="race"], .race-icon');
    if (raceImg.length > 0) {
      const src = raceImg.attr('src') || raceImg.attr('alt') || '';
      const raceNumMatch = src.match(/races?\/([0-9]+)/i);
      if (raceNumMatch) {
        detectedRace = RACE_MAP[parseInt(raceNumMatch[1], 10)] || detectedRace;
      } else {
        for (const [key, val] of Object.entries(RACE_MAP)) {
          if (src.toLowerCase().includes(key.toLowerCase())) {
            detectedRace = val;
            break;
          }
        }
      }
    } else {
      for (const [key, val] of Object.entries(RACE_MAP)) {
        if (typeof key === 'string' && new RegExp(`\\b${key}\\b`, 'i').test(rowText)) {
          detectedRace = val;
          break;
        }
      }
    }

    // Realm detection
    let detectedRealm = 'Evermoon';
    const realmMatches = ['Evermoon', 'Tauri', 'Warriors of Darkness', 'Crystalsong', 'TauriMoP'];
    for (const r of realmMatches) {
      if (new RegExp(`\\b${r}\\b`, 'i').test(rowText) || rowHtml.includes(r)) {
        detectedRealm = r;
        break;
      }
    }

    // Numbers: Level, Item Level, Achievement Points, Price
    let level = 90;
    let itemLevel = 0;
    let achievementPoints = 0;
    let price = 0;

    // Look through cells
    const cells = row.find('td');
    if (cells.length >= 3) {
      cells.each((cIdx, cElem) => {
        const cellText = $(cElem).text().trim();

        // Level detection: e.g. "90", "Lvl 90", "Level: 90"
        const lvlMatch = cellText.match(/^(?:lvl|level)?\s*([1-9][0-9]?)$/i);
        if (lvlMatch && !level) {
          level = parseInt(lvlMatch[1], 10);
        }

        // Item Level (ilvl): e.g. "550", "ilvl 550", "iLvl: 564"
        const ilvlMatch = cellText.match(/ilvl:?\s*([0-9]{2,3})/i) || cellText.match(/^([4-5][0-9]{2})$/);
        if (ilvlMatch && !itemLevel) {
          itemLevel = parseInt(ilvlMatch[1], 10);
        }

        // Achievement Points: e.g. "12,450", "12450 pts", "12450"
        const apMatch = cellText.match(/([0-9]{1,2}[,.]?[0-9]{3})\s*(?:pts|achiev|points)?/i) || cellText.match(/ap:?\s*([0-9]+)/i);
        if (apMatch && !achievementPoints) {
          achievementPoints = parseInt(apMatch[1].replace(/[,.]/g, ''), 10);
        }

        // Price: e.g. "250 credits", "250 coins", "250", "$250"
        const priceMatch = cellText.match(/([0-9]+)\s*(?:credits?|coins?|cr|eur|ft|cp)?/i);
        const hasCoinIcon = $(cElem).find('img[src*="coin"], img[src*="credit"], .credit-icon').length > 0;
        if ((hasCoinIcon || cellText.toLowerCase().includes('credit') || cellText.toLowerCase().includes('coin')) && priceMatch) {
          price = parseInt(priceMatch[1], 10);
        }
      });
    }

    // Fallback regex parsing on entire row text
    if (!level) {
      const lMatch = rowText.match(/\b(90|85|80|70|60|19)\b/);
      if (lMatch) level = parseInt(lMatch[1], 10);
    }

    if (!itemLevel) {
      const ilvlMatch = rowText.match(/ilvl[:\s]*([0-9]{2,3})/i) || rowText.match(/\b(5[0-8][0-9]|4[0-9]{2})\b/);
      if (ilvlMatch) itemLevel = parseInt(ilvlMatch[1], 10);
    }

    if (!achievementPoints) {
      const apMatch = rowText.match(/([0-9]{1,2}[,.]?[0-9]{3})\s*(?:pts|points|ap)/i) || rowText.match(/\b([1-2]?[0-9]{4})\s*pts?\b/i);
      if (apMatch) achievementPoints = parseInt(apMatch[1].replace(/[,.]/g, ''), 10);
    }

    if (!price) {
      const prMatch = rowText.match(/([0-9]+)\s*(?:credits?|coins?|cr\b)/i) || rowText.match(/price[:\s]*([0-9]+)/i);
      if (prMatch) price = parseInt(prMatch[1], 10);
    }

    // Date extraction
    let listingDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const dateMatch = rowText.match(/(\d{4}[-/]\d{2}[-/]\d{2}(?:\s+\d{2}:\d{2})?)/) || rowText.match(/(\d{1,2}\s+(?:days?|hours?|mins?)\s+left)/i);
    if (dateMatch) {
      listingDate = dateMatch[1];
    }

    // If name is still blank, extract first capitalized word that is not a keyword
    if (!name) {
      const words = rowText.split(/\s+/).filter(w => /^[A-Z][a-z]{2,15}$/.test(w));
      const filtered = words.filter(w => !['Alliance', 'Horde', 'Level', 'Evermoon', 'Tauri', 'Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Monk', 'Druid', 'Credits', 'Coins'].includes(w));
      if (filtered.length > 0) {
        name = filtered[0];
      }
    }

    if (!name) {
      return; // Not a valid character entry
    }

    // Generate stable ID if not parsed
    if (!id) {
      id = `${detectedRealm.toLowerCase()}-${name.toLowerCase()}-${level}`;
    }

    if (seenIds.has(id)) {
      return;
    }
    seenIds.add(id);

    const faction = inferFaction(detectedRace, rowHtml);

    if (!detailsUrl) {
      detailsUrl = `${baseUrl.replace(/\/$/, '')}/armory#character-sheet.xml?r=${encodeURIComponent(detectedRealm)}&n=${encodeURIComponent(name)}`;
    }

    listings.push({
      id: String(id),
      name,
      level: level || 90,
      race: detectedRace,
      class: detectedClass,
      faction,
      realm: detectedRealm,
      achievementPoints: achievementPoints || 0,
      itemLevel: itemLevel || 0,
      price: price || 0,
      listingDate,
      detailsUrl,
      rawSnippet: rowText.slice(0, 120)
    });
  });

  // 2. Card / Box parsing if no table listings found
  if (listings.length === 0) {
    $('.character-box, .auction-card, .char-item, .listing-card').each((_, elem) => {
      const card = $(elem);
      const text = card.text().trim();
      if (!text) return;

      const nameElem = card.find('.char-name, .name, h3, h4, a').first();
      const name = nameElem.text().trim();
      if (!name) return;

      let id = card.attr('data-id') || nameElem.attr('href')?.match(/id=([0-9a-zA-Z_-]+)/)?.[1] || `${name.toLowerCase()}`;
      if (seenIds.has(id)) return;
      seenIds.add(id);

      let realm = 'Evermoon';
      for (const r of ['Evermoon', 'Tauri', 'Warriors of Darkness', 'Crystalsong']) {
        if (text.includes(r)) { realm = r; break; }
      }

      let detectedClass = 'Warrior';
      for (const [k, v] of Object.entries(CLASS_MAP)) {
        if (typeof k === 'string' && text.toLowerCase().includes(k)) {
          detectedClass = v;
          break;
        }
      }

      let detectedRace = 'Human';
      for (const [k, v] of Object.entries(RACE_MAP)) {
        if (typeof k === 'string' && text.toLowerCase().includes(k)) {
          detectedRace = v;
          break;
        }
      }

      const ilvlMatch = text.match(/ilvl[:\s]*([0-9]{2,3})/i) || text.match(/\b(5[0-8][0-9]|4[0-9]{2})\b/);
      const apMatch = text.match(/([0-9]{1,2}[,.]?[0-9]{3})\s*(?:pts|points|ap)/i);
      const priceMatch = text.match(/([0-9]+)\s*(?:credits?|coins?|cr)/i);
      const lvlMatch = text.match(/lvl[:\s]*([1-9][0-9]?)/i) || text.match(/\b(90|85|80)\b/);

      const faction = inferFaction(detectedRace, text);
      const detailsUrl = nameElem.attr('href')?.startsWith('http') 
        ? nameElem.attr('href')! 
        : `${baseUrl}/armory#character-sheet.xml?r=${encodeURIComponent(realm)}&n=${encodeURIComponent(name)}`;

      listings.push({
        id,
        name,
        level: lvlMatch ? parseInt(lvlMatch[1], 10) : 90,
        race: detectedRace,
        class: detectedClass,
        faction,
        realm,
        achievementPoints: apMatch ? parseInt(apMatch[1].replace(/[,.]/g, ''), 10) : 0,
        itemLevel: ilvlMatch ? parseInt(ilvlMatch[1], 10) : 0,
        price: priceMatch ? parseInt(priceMatch[1], 10) : 0,
        listingDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
        detailsUrl,
        rawSnippet: text.slice(0, 120)
      });
    });
  }

  return listings;
}

/**
 * Generates sample Tauri Character AH HTML snippet for testing and demonstration
 */
export function generateSampleTauriAhHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>TauriWoW Character Trade - character.php</title>
</head>
<body>
  <div class="container">
    <h2>Tauri Character Auction House (character.php)</h2>
    <table class="table table-striped table-hover" id="character_table">
      <thead>
        <tr>
          <th>Realm</th>
          <th>Character</th>
          <th>Race</th>
          <th>Class</th>
          <th>Level</th>
          <th>Item Level</th>
          <th>Achievements</th>
          <th>Price</th>
          <th>Listing Date</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr data-id="104921" class="auction-row">
          <td><span class="badge realm-evermoon">Evermoon</span></td>
          <td>
            <a href="https://tauriwow.com/armory#character-sheet.xml?r=Evermoon&n=Shadowstrike" class="char-name font-bold">Shadowstrike</a>
            <span class="faction horde font-xs">(Horde)</span>
          </td>
          <td><img src="/images/races/10.gif" alt="Blood Elf" title="Blood Elf" /> Blood Elf</td>
          <td><img src="/images/classes/4.gif" alt="Rogue" title="Rogue" /> Rogue</td>
          <td><span class="level font-semibold">90</span></td>
          <td><span class="ilvl badge-epic">568</span></td>
          <td><span class="ap">14,850 pts</span></td>
          <td><span class="price-credit text-gold font-bold">180 Credits</span></td>
          <td>2026-08-18 16:30</td>
          <td><a href="character.php?action=view&id=104921" class="btn btn-sm btn-primary">Details</a></td>
        </tr>
        <tr data-id="104922" class="auction-row">
          <td><span class="badge realm-evermoon">Evermoon</span></td>
          <td>
            <a href="https://tauriwow.com/armory#character-sheet.xml?r=Evermoon&n=Lightbringer" class="char-name font-bold">Lightbringer</a>
            <span class="faction alliance font-xs">(Alliance)</span>
          </td>
          <td><img src="/images/races/1.gif" alt="Human" title="Human" /> Human</td>
          <td><img src="/images/classes/2.gif" alt="Paladin" title="Paladin" /> Paladin</td>
          <td><span class="level font-semibold">90</span></td>
          <td><span class="ilvl badge-epic">575</span></td>
          <td><span class="ap">16,200 pts</span></td>
          <td><span class="price-credit text-gold font-bold">250 Credits</span></td>
          <td>2026-08-18 15:45</td>
          <td><a href="character.php?action=view&id=104922" class="btn btn-sm btn-primary">Details</a></td>
        </tr>
        <tr data-id="104923" class="auction-row">
          <td><span class="badge realm-tauri">Tauri</span></td>
          <td>
            <a href="https://tauriwow.com/armory#character-sheet.xml?r=Tauri&n=Frostweaver" class="char-name font-bold">Frostweaver</a>
            <span class="faction alliance font-xs">(Alliance)</span>
          </td>
          <td><img src="/images/races/7.gif" alt="Gnome" title="Gnome" /> Gnome</td>
          <td><img src="/images/classes/8.gif" alt="Mage" title="Mage" /> Mage</td>
          <td><span class="level font-semibold">90</span></td>
          <td><span class="ilvl badge-epic">555</span></td>
          <td><span class="ap">9,400 pts</span></td>
          <td><span class="price-credit text-gold font-bold">95 Credits</span></td>
          <td>2026-08-18 14:10</td>
          <td><a href="character.php?action=view&id=104923" class="btn btn-sm btn-primary">Details</a></td>
        </tr>
        <tr data-id="104924" class="auction-row">
          <td><span class="badge realm-evermoon">Evermoon</span></td>
          <td>
            <a href="https://tauriwow.com/armory#character-sheet.xml?r=Evermoon&n=Thunderpaw" class="char-name font-bold">Thunderpaw</a>
            <span class="faction horde font-xs">(Horde)</span>
          </td>
          <td><img src="/images/races/24.gif" alt="Pandaren" title="Pandaren" /> Pandaren</td>
          <td><img src="/images/classes/10.gif" alt="Monk" title="Monk" /> Monk</td>
          <td><span class="level font-semibold">90</span></td>
          <td><span class="ilvl badge-epic">562</span></td>
          <td><span class="ap">11,100 pts</span></td>
          <td><span class="price-credit text-gold font-bold">140 Credits</span></td>
          <td>2026-08-18 12:20</td>
          <td><a href="character.php?action=view&id=104924" class="btn btn-sm btn-primary">Details</a></td>
        </tr>
        <tr data-id="104925" class="auction-row">
          <td><span class="badge realm-crystalsong">Crystalsong</span></td>
          <td>
            <a href="https://tauriwow.com/armory#character-sheet.xml?r=Crystalsong&n=Deathcaller" class="char-name font-bold">Deathcaller</a>
            <span class="faction horde font-xs">(Horde)</span>
          </td>
          <td><img src="/images/races/5.gif" alt="Undead" title="Undead" /> Undead</td>
          <td><img src="/images/classes/6.gif" alt="Death Knight" title="Death Knight" /> Death Knight</td>
          <td><span class="level font-semibold">85</span></td>
          <td><span class="ilvl badge-rare">410</span></td>
          <td><span class="ap">6,800 pts</span></td>
          <td><span class="price-credit text-gold font-bold">50 Credits</span></td>
          <td>2026-08-18 10:05</td>
          <td><a href="character.php?action=view&id=104925" class="btn btn-sm btn-primary">Details</a></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
  `.trim();
}

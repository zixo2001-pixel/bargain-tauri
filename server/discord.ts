import { CharacterListing, BargainRule, CLASS_HEX_INT } from '../src/types';

export interface DiscordSendResult {
  success: boolean;
  error?: string;
  simulated?: boolean;
}

export async function sendDiscordWebhook(
  webhookUrl: string | undefined,
  character: CharacterListing,
  rule: BargainRule
): Promise<DiscordSendResult> {
  if (!webhookUrl || !webhookUrl.trim() || !webhookUrl.startsWith('http')) {
    return {
      success: false,
      simulated: true,
      error: 'No valid Discord webhook URL configured. Notification was recorded in local alert log.'
    };
  }

  const color = CLASS_HEX_INT[character.class] || 0xF5B041;
  const factionEmoji = character.faction === 'Alliance' ? '🦁' : character.faction === 'Horde' ? '🐺' : '⚖️';
  const factionText = character.faction || 'Neutral';

  const embed = {
    title: `⚡ [BARGAIN ALERT] ${character.name} — Level ${character.level} ${character.race} ${character.class}`,
    url: character.detailsUrl,
    description: `A new character listing on **TauriWoW AH** matches your rule: **${rule.name}**!`,
    color,
    fields: [
      {
        name: '💰 Price',
        value: `**${character.price.toLocaleString()} Credits**`,
        inline: true
      },
      {
        name: '⚔️ Item Level',
        value: character.itemLevel > 0 ? `**${character.itemLevel} ilvl**` : 'N/A',
        inline: true
      },
      {
        name: '🏆 Achievements',
        value: character.achievementPoints > 0 ? `**${character.achievementPoints.toLocaleString()} pts**` : '0 pts',
        inline: true
      },
      {
        name: '🌐 Realm & Faction',
        value: `${factionEmoji} **${character.realm}** (${factionText})`,
        inline: true
      },
      {
        name: '🛡️ Class & Race',
        value: `${character.race} ${character.class}`,
        inline: true
      },
      {
        name: '📅 Listed / Time Left',
        value: character.listingDate || 'Recently',
        inline: true
      },
      {
        name: '🏷️ Triggered Bargain Rule',
        value: `\`${rule.name}\``,
        inline: false
      },
      {
        name: '🔗 Direct Link',
        value: `[Open Character Details / Armory](${character.detailsUrl})`,
        inline: false
      }
    ],
    footer: {
      text: `TauriWoW Character AH Monitor • ID: ${character.id}`,
      icon_url: 'https://img.icons8.com/color/48/world-of-warcraft.png'
    },
    timestamp: new Date().toISOString()
  };

  const payload = {
    username: 'Tauri AH Bargain Bot',
    avatar_url: 'https://img.icons8.com/color/96/sword.png',
    content: `🔔 **New Bargain Alert:** [${character.name} (${character.realm})](${character.detailsUrl}) is available for **${character.price} Credits**!`,
    embeds: [embed]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Discord API returned HTTP ${response.status}: ${errorText.slice(0, 200)}`
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to connect to Discord Webhook: ${message}`
    };
  }
}

export async function sendTestDiscordNotification(webhookUrl: string): Promise<DiscordSendResult> {
  const sampleCharacter: CharacterListing = {
    id: 'test-sample-104921',
    name: 'Shadowhunter',
    level: 90,
    race: 'Blood Elf',
    class: 'Hunter',
    faction: 'Horde',
    realm: 'Evermoon',
    achievementPoints: 14500,
    itemLevel: 565,
    price: 120,
    listingDate: 'Just now',
    detailsUrl: 'https://tauriwow.com/armory#character-sheet.xml?r=Evermoon&n=Shadowhunter'
  };

  const sampleRule: BargainRule = {
    id: 'test-rule',
    name: 'Test Webhook Verification Rule',
    enabled: true,
    realm: 'Evermoon',
    characterClass: 'Hunter',
    race: 'Blood Elf',
    faction: 'Horde',
    minLevel: 90,
    maxLevel: 90,
    minItemLevel: 550,
    maxItemLevel: null,
    minAchievementPoints: 10000,
    maxAchievementPoints: null,
    maxPrice: 150,
    createdAt: new Date().toISOString(),
    matchCount: 1
  };

  return sendDiscordWebhook(webhookUrl, sampleCharacter, sampleRule);
}

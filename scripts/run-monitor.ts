import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { CharacterListing, BargainRule, NotificationLog } from '../src/types';
import { parseCharacterAhHtml } from '../server/parser';
import { matchRulesForCharacter, DEFAULT_RULES } from '../server/rules';
import { sendDiscordWebhook } from '../server/discord';

dotenv.config();

const STATE_FILE = path.join(process.cwd(), 'data', 'monitor-state.json');

interface PersistedState {
  rules: BargainRule[];
  notifiedListingIds: string[];
  notificationHistory: NotificationLog[];
  cachedListings?: CharacterListing[];
  config?: {
    pollingIntervalMinutes?: number;
    isPollingActive?: boolean;
    totalParsed?: number;
    totalNotified?: number;
    lastCheckStatus?: string;
    lastCheckedAt?: string;
    lastCheckError?: string;
  };
}

function formatTauriCookie(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('tSessionId=')) {
    return trimmed;
  }
  return `tSessionId=${trimmed}`;
}

function loadState(): PersistedState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        rules: Array.isArray(parsed.rules) && parsed.rules.length > 0 ? parsed.rules : DEFAULT_RULES,
        notifiedListingIds: Array.isArray(parsed.notifiedListingIds) ? parsed.notifiedListingIds : [],
        notificationHistory: Array.isArray(parsed.notificationHistory) ? parsed.notificationHistory : [],
        cachedListings: Array.isArray(parsed.cachedListings) ? parsed.cachedListings : [],
        config: parsed.config || {}
      };
    }
  } catch (err) {
    console.error('[GitHub Monitor] Error loading state file:', err instanceof Error ? err.message : String(err));
  }

  return {
    rules: DEFAULT_RULES,
    notifiedListingIds: [],
    notificationHistory: [],
    cachedListings: [],
    config: {
      pollingIntervalMinutes: 5,
      isPollingActive: true,
      totalParsed: 0,
      totalNotified: 0,
      lastCheckStatus: 'idle'
    }
  };
}

function saveState(state: PersistedState): void {
  try {
    const dataDir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Sanitize state to ensure NO secrets are ever saved to disk or repository
    const sanitizedState = {
      rules: state.rules,
      notifiedListingIds: state.notifiedListingIds.slice(-2000), // Keep the latest 2,000 IDs for compact size
      notificationHistory: state.notificationHistory.slice(0, 100), // Keep latest 100 entries
      cachedListings: (state.cachedListings || []).slice(0, 50),
      config: {
        pollingIntervalMinutes: state.config?.pollingIntervalMinutes || 5,
        isPollingActive: state.config?.isPollingActive !== false,
        totalParsed: state.config?.totalParsed || 0,
        totalNotified: state.config?.totalNotified || 0,
        lastCheckStatus: state.config?.lastCheckStatus || 'success',
        lastCheckedAt: state.config?.lastCheckedAt || new Date().toISOString(),
        lastCheckError: state.config?.lastCheckError
      }
    };

    const tempFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(sanitizedState, null, 2), 'utf-8');
    fs.renameSync(tempFile, STATE_FILE);
    console.log(`[GitHub Monitor] State successfully saved to ${STATE_FILE}`);
  } catch (err) {
    console.error('[GitHub Monitor] Error saving state:', err instanceof Error ? err.message : String(err));
  }
}

async function fetchLiveTauriAh(targetUrl: string, cookie: string): Promise<{ html: string; statusCode: number; urlUsed: string }> {
  const candidateUrls: string[] = [];
  if (targetUrl) candidateUrls.push(targetUrl);
  if (!candidateUrls.includes('https://tauriwow.com/vipdsh/ajax/characterah')) {
    candidateUrls.push('https://tauriwow.com/vipdsh/ajax/characterah');
  }
  if (!candidateUrls.includes('https://tauriwow.com/character.php')) {
    candidateUrls.push('https://tauriwow.com/character.php');
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://tauriwow.com/vippanel'
  };

  if (cookie) {
    headers['Cookie'] = formatTauriCookie(cookie);
  }

  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      if (html && html.length > 100) {
        return { html, statusCode: response.status, urlUsed: url };
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(`Failed to fetch from candidate URLs: ${candidateUrls.join(', ')}`);
}

async function run(): Promise<void> {
  const startTime = Date.now();
  console.log('----------------------------------------------------');
  console.log(`[GitHub Monitor] Starting check at ${new Date().toISOString()}`);

  const targetUrl = process.env.TAURI_AH_URL || 'https://tauriwow.com/vipdsh/ajax/characterah';
  const cookie = process.env.TAURI_SESSION_COOKIE || '';
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

  console.log(`[GitHub Monitor] Target AH Endpoint: ${targetUrl}`);
  console.log(`[GitHub Monitor] Tauri Session Configured: ${Boolean(cookie?.trim())}`);
  console.log(`[GitHub Monitor] Discord Webhook Configured: ${Boolean(discordWebhookUrl?.trim())}`);

  const state = loadState();
  const enabledRules = state.rules.filter(r => r.enabled);
  console.log(`[GitHub Monitor] Active bargain rules: ${enabledRules.length}/${state.rules.length}`);

  let listings: CharacterListing[] = [];
  try {
    const { html, statusCode, urlUsed } = await fetchLiveTauriAh(targetUrl, cookie);
    console.log(`[GitHub Monitor] Tauri HTTP Status: ${statusCode} (Endpoint used: ${urlUsed}, ${html.length} bytes received)`);

    listings = parseCharacterAhHtml(html, urlUsed);
    console.log(`[GitHub Monitor] Successfully parsed ${listings.length} live character listings.`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[GitHub Monitor] Failed to fetch Tauri Character AH: ${errMsg}`);
    if (state.config) {
      state.config.lastCheckStatus = 'error';
      state.config.lastCheckError = errMsg;
      state.config.lastCheckedAt = new Date().toISOString();
    }
    saveState(state);
    process.exit(0); // Exit cleanly so GitHub Action doesn't fail on transient network hiccups
  }

  let totalMatches = 0;
  let newAlertsSent = 0;
  const notifiedSet = new Set(state.notifiedListingIds);

  for (const listing of listings) {
    const matchedRules = matchRulesForCharacter(state.rules, listing);

    if (matchedRules.length > 0) {
      totalMatches++;
      listing.matchedRules = matchedRules.map(r => r.id);
      listing.matchedRuleNames = matchedRules.map(r => r.name);

      if (!notifiedSet.has(listing.id)) {
        const primaryRule = matchedRules[0];
        console.log(`[GitHub Monitor] >> NEW BARGAIN FOUND! Character: ${listing.name} (Lvl ${listing.level} ${listing.race} ${listing.class}, ${listing.price} Credits, Realm: ${listing.realm}) - Matched Rule: "${primaryRule.name}"`);

        // Send Discord notification
        if (discordWebhookUrl) {
          try {
            const discordRes = await sendDiscordWebhook(discordWebhookUrl, listing, primaryRule);
            if (discordRes.success) {
              console.log(`[GitHub Monitor] Discord alert sent successfully for ${listing.name} (ID: ${listing.id})`);
            } else {
              console.warn(`[GitHub Monitor] Discord webhook failed: ${discordRes.error}`);
            }
          } catch (discordErr) {
            console.error(`[GitHub Monitor] Error dispatching Discord webhook:`, discordErr instanceof Error ? discordErr.message : String(discordErr));
          }
        } else {
          console.log(`[GitHub Monitor] (Skipping Discord notification: DISCORD_WEBHOOK_URL not configured)`);
        }

        // Record rule stats
        primaryRule.matchCount = (primaryRule.matchCount || 0) + 1;
        primaryRule.lastMatchedAt = new Date().toISOString();

        // Record notification history log
        const logEntry: NotificationLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          characterId: listing.id,
          characterName: listing.name,
          ruleId: primaryRule.id,
          ruleName: primaryRule.name,
          price: listing.price,
          realm: listing.realm,
          characterClass: listing.class,
          race: listing.race,
          level: listing.level,
          itemLevel: listing.itemLevel,
          achievementPoints: listing.achievementPoints,
          timestamp: new Date().toISOString(),
          discordStatus: discordWebhookUrl ? 'sent' : 'simulated',
          detailsUrl: listing.detailsUrl
        };
        state.notificationHistory.unshift(logEntry);

        notifiedSet.add(listing.id);
        newAlertsSent++;
      }
    }
  }

  state.notifiedListingIds = Array.from(notifiedSet);
  state.cachedListings = listings;
  if (!state.config) state.config = {};
  state.config.totalParsed = listings.length;
  state.config.totalNotified = (state.config.totalNotified || 0) + newAlertsSent;
  state.config.lastCheckedAt = new Date().toISOString();
  state.config.lastCheckStatus = 'success';
  state.config.lastCheckError = undefined;

  saveState(state);

  const durationMs = Date.now() - startTime;
  console.log(`[GitHub Monitor] Cycle completed in ${durationMs}ms: ${listings.length} parsed, ${totalMatches} total matching, ${newAlertsSent} new alerts sent.`);
  console.log('----------------------------------------------------');
}

run().catch(err => {
  console.error('[GitHub Monitor] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

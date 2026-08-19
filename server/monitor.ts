import fs from 'fs';
import path from 'path';
import { CharacterListing, BargainRule, MonitorConfig, NotificationLog } from '../src/types';
import { parseCharacterAhHtml, generateSampleTauriAhHtml } from './parser';
import { matchRulesForCharacter, evaluateRule, DEFAULT_RULES } from './rules';
import { sendDiscordWebhook, sendTestDiscordNotification, DiscordSendResult } from './discord';

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.NODE_ENV === 'production' ? '/data' : (fs.existsSync('/data') ? '/data' : path.join(process.cwd(), 'data')));
const STATE_FILE = path.join(DATA_DIR, 'monitor-state.json');
const BACKUP_FILE = path.join(DATA_DIR, 'monitor-state.json.bak');
const TEMP_FILE = path.join(DATA_DIR, '.monitor-state.tmp');

interface MonitorState {
  rules: BargainRule[];
  notifiedListingIds: string[];
  notificationHistory: NotificationLog[];
  cachedListings: CharacterListing[];
  config: MonitorConfig;
  secrets: {
    discordWebhookUrl: string;
    tauriSessionCookie: string;
    tauriAhUrl: string;
  };
}

/**
 * Format Tauri session cookie for server-side requests.
 * Uses tSessionId=<value> format.
 * Never exposed to frontend, logs, or Discord.
 */
function formatTauriCookie(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('tSessionId=')) {
    return trimmed;
  }
  return `tSessionId=${trimmed}`;
}

class TauriAhMonitor {
  private state: MonitorState;
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private consecutiveErrors = 0;

  constructor() {
    this.state = this.loadState();
    this.startPolling();
  }

  private getDefaultState(): MonitorState {
    const discordEnv = process.env.DISCORD_WEBHOOK_URL || '';
    const cookieEnv = process.env.TAURI_SESSION_COOKIE || '';
    const ahUrlEnv = process.env.TAURI_AH_URL || 'https://tauriwow.com/vipdsh/ajax/characterah';
    const intervalEnv = parseInt(process.env.POLLING_INTERVAL_MINUTES || '5', 10);

    return {
      rules: DEFAULT_RULES,
      notifiedListingIds: [],
      notificationHistory: [],
      cachedListings: [],
      config: {
        pollingIntervalMinutes: Number.isInteger(intervalEnv) && intervalEnv >= 1 ? intervalEnv : 5,
        isPollingActive: true,
        discordWebhookConfigured: Boolean(discordEnv),
        tauriSessionConfigured: Boolean(cookieEnv),
        tauriAhUrl: ahUrlEnv,
        totalParsed: 0,
        totalNotified: 0,
        lastCheckStatus: 'idle'
      },
      secrets: {
        discordWebhookUrl: discordEnv,
        tauriSessionCookie: cookieEnv,
        tauriAhUrl: ahUrlEnv
      }
    };
  }

  private loadState(): MonitorState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      let raw = '';
      if (fs.existsSync(STATE_FILE)) {
        try {
          raw = fs.readFileSync(STATE_FILE, 'utf-8');
        } catch {
          // Attempt reading backup if primary read failed
          if (fs.existsSync(BACKUP_FILE)) {
            raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
          }
        }
      } else if (fs.existsSync(BACKUP_FILE)) {
        raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
      }

      if (raw) {
        const parsed = JSON.parse(raw);

        // Priority to environment variables
        if (process.env.DISCORD_WEBHOOK_URL) {
          parsed.secrets.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        }
        if (process.env.TAURI_SESSION_COOKIE) {
          parsed.secrets.tauriSessionCookie = process.env.TAURI_SESSION_COOKIE;
        }
        if (process.env.TAURI_AH_URL) {
          parsed.secrets.tauriAhUrl = process.env.TAURI_AH_URL;
          parsed.config.tauriAhUrl = process.env.TAURI_AH_URL;
        }
        if (process.env.POLLING_INTERVAL_MINUTES) {
          const min = parseInt(process.env.POLLING_INTERVAL_MINUTES, 10);
          if (min >= 1) parsed.config.pollingIntervalMinutes = min;
        }

        parsed.config.discordWebhookConfigured = Boolean(parsed.secrets?.discordWebhookUrl?.trim());
        parsed.config.tauriSessionConfigured = Boolean(parsed.secrets?.tauriSessionCookie?.trim());
        return parsed;
      }
    } catch (e) {
      console.error('[Tauri Monitor] Failed to load persistent state, recovering from defaults:', e instanceof Error ? e.message : String(e));
    }
    return this.getDefaultState();
  }

  /**
   * Atomic file save with backup to guarantee persistence on Railway volumes.
   */
  public saveState(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const serialized = JSON.stringify(this.state, null, 2);

      // Write to temp file first
      fs.writeFileSync(TEMP_FILE, serialized, 'utf-8');

      // Backup existing file if valid
      if (fs.existsSync(STATE_FILE)) {
        try {
          fs.copyFileSync(STATE_FILE, BACKUP_FILE);
        } catch {
          // Non-blocking backup copy
        }
      }

      // Atomically replace state file
      fs.renameSync(TEMP_FILE, STATE_FILE);
    } catch (e) {
      console.error('[Tauri Monitor] Failed to persist state:', e instanceof Error ? e.message : String(e));
    }
  }

  public getPublicConfig(): MonitorConfig {
    return {
      ...this.state.config,
      discordWebhookConfigured: Boolean(this.state.secrets.discordWebhookUrl?.trim() || process.env.DISCORD_WEBHOOK_URL),
      tauriSessionConfigured: Boolean(this.state.secrets.tauriSessionCookie?.trim() || process.env.TAURI_SESSION_COOKIE),
      tauriAhUrl: this.state.secrets.tauriAhUrl || process.env.TAURI_AH_URL || 'https://tauriwow.com/character.php'
    };
  }

  public updateConfig(updates: Partial<MonitorConfig>): MonitorConfig {
    if (typeof updates.pollingIntervalMinutes === 'number' && updates.pollingIntervalMinutes >= 1) {
      this.state.config.pollingIntervalMinutes = updates.pollingIntervalMinutes;
    }
    if (typeof updates.isPollingActive === 'boolean') {
      this.state.config.isPollingActive = updates.isPollingActive;
    }
    if (typeof updates.tauriAhUrl === 'string' && updates.tauriAhUrl.trim()) {
      this.state.secrets.tauriAhUrl = updates.tauriAhUrl.trim();
      this.state.config.tauriAhUrl = updates.tauriAhUrl.trim();
    }

    this.saveState();
    this.restartPolling();
    return this.getPublicConfig();
  }

  public updateSecrets(secrets: { discordWebhookUrl?: string; tauriSessionCookie?: string; tauriAhUrl?: string }): { success: boolean; message: string } {
    if (typeof secrets.discordWebhookUrl === 'string') {
      this.state.secrets.discordWebhookUrl = secrets.discordWebhookUrl.trim();
      this.state.config.discordWebhookConfigured = Boolean(this.state.secrets.discordWebhookUrl);
    }
    if (typeof secrets.tauriSessionCookie === 'string') {
      this.state.secrets.tauriSessionCookie = secrets.tauriSessionCookie.trim();
      this.state.config.tauriSessionConfigured = Boolean(this.state.secrets.tauriSessionCookie);
    }
    if (typeof secrets.tauriAhUrl === 'string' && secrets.tauriAhUrl.trim()) {
      this.state.secrets.tauriAhUrl = secrets.tauriAhUrl.trim();
      this.state.config.tauriAhUrl = secrets.tauriAhUrl.trim();
    }

    this.saveState();
    return {
      success: true,
      message: 'Credentials safely stored on server.'
    };
  }

  public getRules(): BargainRule[] {
    return this.state.rules;
  }

  public createRule(ruleData: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>): BargainRule {
    const newRule: BargainRule = {
      ...ruleData,
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      matchCount: 0
    };
    this.state.rules.push(newRule);
    this.saveState();
    return newRule;
  }

  public updateRule(id: string, updates: Partial<BargainRule>): BargainRule | null {
    const index = this.state.rules.findIndex(r => r.id === id);
    if (index === -1) return null;

    this.state.rules[index] = {
      ...this.state.rules[index],
      ...updates,
      id // preserve ID
    };
    this.saveState();
    return this.state.rules[index];
  }

  public deleteRule(id: string): boolean {
    const initialLen = this.state.rules.length;
    this.state.rules = this.state.rules.filter(r => r.id !== id);
    if (this.state.rules.length !== initialLen) {
      this.saveState();
      return true;
    }
    return false;
  }

  public toggleRule(id: string): BargainRule | null {
    const rule = this.state.rules.find(r => r.id === id);
    if (!rule) return null;
    rule.enabled = !rule.enabled;
    this.saveState();
    return rule;
  }

  public getCachedListings(): CharacterListing[] {
    return this.state.cachedListings.map(listing => {
      const matched = matchRulesForCharacter(this.state.rules, listing);
      return {
        ...listing,
        matchedRules: matched.map(m => m.id),
        matchedRuleNames: matched.map(m => m.name)
      };
    });
  }

  public getNotificationHistory(): NotificationLog[] {
    return this.state.notificationHistory;
  }

  public clearHistory(): void {
    this.state.notificationHistory = [];
    this.saveState();
  }

  public resetNotifiedIds(): { count: number } {
    const count = this.state.notifiedListingIds.length;
    this.state.notifiedListingIds = [];
    this.saveState();
    return { count };
  }

  /**
   * Evaluates current cached/live listings against a specific rule WITHOUT sending Discord alerts.
   */
  public testRule(rule: BargainRule): CharacterListing[] {
    const listings = this.state.cachedListings;
    return listings.filter(l => evaluateRule({ ...rule, enabled: true }, l));
  }

  /**
   * Sends a real Discord test notification for a specific character listing.
   */
  public async sendTestAlertForListing(character: CharacterListing, ruleName = 'Manual Test'): Promise<DiscordSendResult> {
    const discordWebhookUrl = this.state.secrets.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
    const syntheticRule: BargainRule = {
      id: 'test-rule-manual',
      name: ruleName,
      enabled: true,
      realm: character.realm,
      characterClass: character.class,
      race: character.race,
      faction: character.faction === 'Neutral' ? 'Any' : (character.faction as 'Alliance' | 'Horde'),
      createdAt: new Date().toISOString(),
      matchCount: 1
    };

    const res = await sendDiscordWebhook(discordWebhookUrl, character, syntheticRule);

    const logEntry: NotificationLog = {
      id: `test-log-${Date.now()}`,
      characterId: character.id,
      characterName: character.name,
      ruleId: 'manual-test',
      ruleName: `[Test Alert] ${ruleName}`,
      price: character.price,
      realm: character.realm,
      characterClass: character.class,
      race: character.race,
      level: character.level,
      itemLevel: character.itemLevel,
      achievementPoints: character.achievementPoints,
      timestamp: new Date().toISOString(),
      discordStatus: res.success ? 'sent' : res.simulated ? 'simulated' : 'failed',
      discordError: res.error,
      detailsUrl: character.detailsUrl
    };

    this.state.notificationHistory.unshift(logEntry);
    if (this.state.notificationHistory.length > 100) {
      this.state.notificationHistory = this.state.notificationHistory.slice(0, 100);
    }
    this.saveState();

    return res;
  }

  /**
   * Test direct authenticated connection to TAURI_AH_URL.
   * Sends tSessionId=<value> without exposing credentials.
   * Reports detailed diagnostics for auth failure, HTTP errors, parsing errors, or success.
   */
  public async testTauriConnection(overrideUrl?: string, overrideCookie?: string): Promise<{
    success: boolean;
    url: string;
    statusCode?: number;
    parsedCount?: number;
    sampleListings?: Array<{ name: string; level: number; class: string; realm: string; price: number; itemLevel: number }>;
    message: string;
    errorType?: 'AUTH_ERROR' | 'HTTP_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR';
    errorDetails?: string;
  }> {
    const rawUrl = (overrideUrl && overrideUrl.trim()) || this.state.secrets.tauriAhUrl || process.env.TAURI_AH_URL || 'https://tauriwow.com/vipdsh/ajax/characterah';
    const cookie = (overrideCookie !== undefined ? overrideCookie : (this.state.secrets.tauriSessionCookie || process.env.TAURI_SESSION_COOKIE || '')).trim();

    // Check candidate URLs in order
    const candidateUrls: string[] = [rawUrl];
    if (!candidateUrls.includes('https://tauriwow.com/vipdsh/ajax/characterah')) {
      candidateUrls.push('https://tauriwow.com/vipdsh/ajax/characterah');
    }
    if (!candidateUrls.includes('https://tauriwow.com/character.php')) {
      candidateUrls.push('https://tauriwow.com/character.php');
    }

    let lastError: { statusCode?: number; errorType: 'AUTH_ERROR' | 'HTTP_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR'; message: string } = {
      errorType: 'HTTP_ERROR',
      message: 'No response from Tauri server.'
    };

    for (const targetUrl of candidateUrls) {
      try {
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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        let response: Response;
        try {
          response = await fetch(targetUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
          });
        } catch (netErr: unknown) {
          clearTimeout(timeout);
          const errMsg = netErr instanceof Error ? netErr.message : String(netErr);
          lastError = {
            errorType: 'NETWORK_ERROR',
            message: `Network connection to ${targetUrl} failed: ${errMsg}`
          };
          continue;
        }
        clearTimeout(timeout);

        // Check HTTP status code
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            url: targetUrl,
            statusCode: response.status,
            errorType: 'AUTH_ERROR',
            message: `Authentication Failed (HTTP ${response.status}): Tauri rejected the request. Ensure TAURI_SESSION_COOKIE is set to a valid tSessionId.`
          };
        }

        if (!response.ok) {
          lastError = {
            statusCode: response.status,
            errorType: 'HTTP_ERROR',
            message: `HTTP Error ${response.status} (${response.statusText || 'Not Found'}) returned from ${targetUrl}.`
          };
          continue;
        }

        const html = await response.text();

        // Check for login redirection or unauthenticated landing page
        const isLoginRedirect = html.includes('login.php') || html.includes('name="password"') || (html.includes('login') && !html.includes('characterah') && !html.includes('chah-auction') && !html.includes('<table'));

        const parsedListings = parseCharacterAhHtml(html, targetUrl);

        if (parsedListings.length === 0) {
          if (isLoginRedirect || (!cookie && html.includes('login'))) {
            return {
              success: false,
              url: targetUrl,
              statusCode: response.status,
              errorType: 'AUTH_ERROR',
              message: `Authentication required: Tauri returned the login page. Provide a valid 'tSessionId' in TAURI_SESSION_COOKIE.`
            };
          }

          lastError = {
            statusCode: response.status,
            errorType: 'PARSE_ERROR',
            message: `Connected to ${targetUrl} (HTTP ${response.status}), but 0 character listings were found in the HTML.`
          };
          continue;
        }

        // Successfully parsed live listings!
        return {
          success: true,
          url: targetUrl,
          statusCode: response.status,
          parsedCount: parsedListings.length,
          sampleListings: parsedListings.slice(0, 5).map(l => ({
            name: l.name,
            level: l.level,
            class: l.class,
            realm: l.realm,
            price: l.price,
            itemLevel: l.itemLevel
          })),
          message: `Successfully connected to Tauri Character AH (via ${targetUrl}, HTTP ${response.status}) and parsed ${parsedListings.length} live character listing(s)!`
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = {
          errorType: 'HTTP_ERROR',
          message: `Error connecting to ${targetUrl}: ${errMsg}`
        };
      }
    }

    return {
      success: false,
      url: rawUrl,
      statusCode: lastError.statusCode,
      errorType: lastError.errorType,
      message: lastError.message
    };
  }

  /**
   * Fetch Tauri AH page using TAURI_AH_URL and server-side tSessionId cookie.
   */
  public async fetchTauriAhPage(customHtml?: string): Promise<{ html: string; source: 'live' | 'custom' | 'sample'; error?: string }> {
    if (customHtml && customHtml.trim().length > 20) {
      return { html: customHtml, source: 'custom' };
    }

    const rawUrl = this.state.secrets.tauriAhUrl || process.env.TAURI_AH_URL || 'https://tauriwow.com/vipdsh/ajax/characterah';
    const cookie = this.state.secrets.tauriSessionCookie || process.env.TAURI_SESSION_COOKIE || '';

    const candidateUrls: string[] = [rawUrl];
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

    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(targetUrl, {
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
          const testParsed = parseCharacterAhHtml(html, targetUrl);
          if (testParsed.length > 0) {
            return { html, source: 'live' };
          }
        }
      } catch {
        continue;
      }
    }

    return {
      html: generateSampleTauriAhHtml(),
      source: 'sample',
      error: `Live fetch to ${rawUrl} failed. Using sample fallback dataset.`
    };
  }

  public async runCheck(customHtml?: string): Promise<{
    listings: CharacterListing[];
    matchesCount: number;
    newAlertsSent: number;
    source: string;
    error?: string;
  }> {
    if (this.isChecking) {
      return {
        listings: this.getCachedListings(),
        matchesCount: 0,
        newAlertsSent: 0,
        source: 'cached',
        error: 'A check is already currently running'
      };
    }

    this.isChecking = true;
    this.state.config.lastCheckStatus = 'running';

    try {
      const { html, source, error: fetchError } = await this.fetchTauriAhPage(customHtml);
      const listings = parseCharacterAhHtml(html, this.state.secrets.tauriAhUrl);

      let newAlertsSent = 0;
      let totalMatches = 0;
      const notifiedSet = new Set(this.state.notifiedListingIds);

      for (const listing of listings) {
        const matchingRules = matchRulesForCharacter(this.state.rules, listing);

        if (matchingRules.length > 0) {
          totalMatches++;
          listing.matchedRules = matchingRules.map(r => r.id);
          listing.matchedRuleNames = matchingRules.map(r => r.name);

          // Check if this character listing was already notified
          if (!notifiedSet.has(listing.id)) {
            // New listing match! Send Discord alert for primary matching rule
            const primaryRule = matchingRules[0];
            
            // Dispatch webhook
            const discordWebhookUrl = this.state.secrets.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
            const discordRes = await sendDiscordWebhook(
              discordWebhookUrl,
              listing,
              primaryRule
            );

            // Mark rule stats
            primaryRule.matchCount = (primaryRule.matchCount || 0) + 1;
            primaryRule.lastMatchedAt = new Date().toISOString();

            // Log notification
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
              discordStatus: discordRes.success ? 'sent' : discordRes.simulated ? 'simulated' : 'failed',
              discordError: discordRes.error,
              detailsUrl: listing.detailsUrl
            };

            this.state.notificationHistory.unshift(logEntry);
            if (this.state.notificationHistory.length > 100) {
              this.state.notificationHistory = this.state.notificationHistory.slice(0, 100);
            }

            notifiedSet.add(listing.id);
            newAlertsSent++;
          }
        }
      }

      this.state.notifiedListingIds = Array.from(notifiedSet);
      this.state.cachedListings = listings;
      this.state.config.totalParsed = listings.length;
      this.state.config.totalNotified += newAlertsSent;
      this.state.config.lastCheckedAt = new Date().toISOString();
      this.state.config.lastCheckStatus = listings.length > 0 ? 'success' : 'error';
      this.state.config.lastCheckError = fetchError;

      this.saveState();

      return {
        listings: this.getCachedListings(),
        matchesCount: totalMatches,
        newAlertsSent,
        source,
        error: fetchError
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.state.config.lastCheckStatus = 'error';
      this.state.config.lastCheckError = errMsg;
      this.saveState();
      return {
        listings: this.getCachedListings(),
        matchesCount: 0,
        newAlertsSent: 0,
        source: 'failed',
        error: errMsg
      };
    } finally {
      this.isChecking = false;
      this.updateNextCheckTime();
    }
  }

  public async testDiscordWebhook(overrideUrl?: string): Promise<{ success: boolean; error?: string }> {
    const url = (overrideUrl && overrideUrl.trim()) || this.state.secrets.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
    if (!url || !url.trim()) {
      return { success: false, error: 'No Discord Webhook URL provided or configured in DISCORD_WEBHOOK_URL.' };
    }
    return sendTestDiscordNotification(url);
  }

  public parseHtmlTest(html: string): { listings: CharacterListing[]; count: number } {
    const listings = parseCharacterAhHtml(html, this.state.secrets.tauriAhUrl);
    const enriched = listings.map(l => {
      const matched = matchRulesForCharacter(this.state.rules, l);
      return {
        ...l,
        matchedRules: matched.map(m => m.id),
        matchedRuleNames: matched.map(m => m.name)
      };
    });
    return { listings: enriched, count: enriched.length };
  }

  private updateNextCheckTime(): void {
    if (this.state.config.isPollingActive) {
      const next = new Date(Date.now() + this.state.config.pollingIntervalMinutes * 60 * 1000);
      this.state.config.nextCheckAt = next.toISOString();
    } else {
      this.state.config.nextCheckAt = undefined;
    }
  }

  public getHealthSummary() {
    return {
      status: this.state.config.lastCheckStatus === 'error' ? 'degraded' : 'healthy',
      isPollingActive: this.state.config.isPollingActive,
      pollingIntervalMinutes: this.state.config.pollingIntervalMinutes,
      activeRulesCount: this.state.rules.filter(r => r.enabled).length,
      notifiedIdsCount: this.state.notifiedListingIds.length,
      cachedListingsCount: this.state.cachedListings.length,
      totalAlertsSent: this.state.config.totalNotified,
      lastCheckedAt: this.state.config.lastCheckedAt,
      nextCheckAt: this.state.config.nextCheckAt,
      lastCheckStatus: this.state.config.lastCheckStatus,
      lastCheckError: this.state.config.lastCheckError,
      storageDirectory: DATA_DIR,
      discordConfigured: Boolean(this.state.secrets.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL),
      tauriConfigured: Boolean(this.state.secrets.tauriSessionCookie || process.env.TAURI_SESSION_COOKIE)
    };
  }

  public stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.updateNextCheckTime();

    if (!this.state.config.isPollingActive) {
      return;
    }

    const intervalMs = Math.max(1, this.state.config.pollingIntervalMinutes) * 60 * 1000;
    this.timer = setInterval(() => {
      if (this.state.config.isPollingActive) {
        console.log(`[Tauri Monitor] Periodic check running... (Interval: ${this.state.config.pollingIntervalMinutes}m)`);
        this.runCheck().catch(err => console.error('[Tauri Monitor] Periodic check error:', err));
      }
    }, intervalMs);
  }

  private restartPolling(): void {
    this.startPolling();
  }
}

export const monitorService = new TauriAhMonitor();

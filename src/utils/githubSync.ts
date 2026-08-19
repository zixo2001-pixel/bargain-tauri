import { BargainRule, CharacterListing, NotificationLog, MonitorConfig } from '../types';
import { DEFAULT_RULES } from '../../server/rules';

export interface GitHubSyncSettings {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface AppStateData {
  rules: BargainRule[];
  notifiedListingIds?: string[];
  notificationHistory?: NotificationLog[];
  cachedListings?: CharacterListing[];
  config?: MonitorConfig;
}

const LOCAL_STORAGE_RULES_KEY = 'tauri_ah_bargain_rules';
const LOCAL_STORAGE_GITHUB_KEY = 'tauri_ah_github_settings';

export function detectGitHubPagesContext(): { owner: string; repo: string } {
  if (typeof window === 'undefined') return { owner: '', repo: '' };
  const host = window.location.hostname || '';
  const pathParts = (window.location.pathname || '').split('/').filter(Boolean);
  if (host.endsWith('.github.io')) {
    const owner = host.replace('.github.io', '');
    const repo = pathParts[0] || '';
    return { owner, repo };
  }
  return { owner: '', repo: '' };
}

export function getStoredGitHubSettings(): GitHubSyncSettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GITHUB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        owner: parsed.owner || detectGitHubPagesContext().owner,
        repo: parsed.repo || detectGitHubPagesContext().repo,
        branch: parsed.branch || 'main',
        token: parsed.token || ''
      };
    }
  } catch (e) {
    console.error('Error reading GitHub settings from localStorage:', e);
  }
  const detected = detectGitHubPagesContext();
  return {
    owner: detected.owner || '',
    repo: detected.repo || '',
    branch: 'main',
    token: ''
  };
}

export function saveStoredGitHubSettings(settings: GitHubSyncSettings): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_GITHUB_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving GitHub settings to localStorage:', e);
  }
}

export function getLocalCachedRules(): BargainRule[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RULES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading cached rules:', e);
  }
  return null;
}

export function saveLocalCachedRules(rules: BargainRule[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error('Error saving rules to localStorage:', e);
  }
}

/**
 * Loads the state with multi-tier fallback:
 * 1. Express backend (/api/status, /api/rules) if reachable
 * 2. Static repository data (/data/monitor-state.json or ./data/monitor-state.json)
 * 3. LocalStorage cached rules
 * 4. Built-in defaults
 */
export async function loadInitialState(): Promise<{
  rules: BargainRule[];
  listings: CharacterListing[];
  history: NotificationLog[];
  config: MonitorConfig;
  isStaticMode: boolean;
}> {
  // 1. Try Express API routes
  try {
    const [statusRes, rulesRes, listingsRes, historyRes] = await Promise.all([
      fetch('/api/status').catch(() => null),
      fetch('/api/rules').catch(() => null),
      fetch('/api/listings').catch(() => null),
      fetch('/api/history').catch(() => null)
    ]);

    if (statusRes && statusRes.ok && rulesRes && rulesRes.ok) {
      const statusData = await statusRes.json();
      const rulesData = await rulesRes.json();
      const listingsData = listingsRes && listingsRes.ok ? await listingsRes.json() : [];
      const historyData = historyRes && historyRes.ok ? await historyRes.json() : [];

      saveLocalCachedRules(rulesData);

      return {
        rules: rulesData,
        listings: listingsData,
        history: historyData,
        config: statusData.config,
        isStaticMode: false
      };
    }
  } catch {
    // API not reachable, proceed to static fallback
  }

  // 2. Try fetching static monitor-state.json (including live raw github content if owner/repo known)
  const ghSettings = getStoredGitHubSettings();
  const candidateUrls: string[] = [];

  if (ghSettings.owner && ghSettings.repo) {
    candidateUrls.push(
      `https://raw.githubusercontent.com/${ghSettings.owner}/${ghSettings.repo}/${ghSettings.branch || 'main'}/data/monitor-state.json?t=${Date.now()}`
    );
  }

  const baseUrl = (((import.meta as any).env?.BASE_URL as string) || '/').replace(/\/+$/, '') + '/';
  candidateUrls.push(
    `${baseUrl}data/monitor-state.json`,
    './data/monitor-state.json',
    'data/monitor-state.json',
    '/data/monitor-state.json'
  );

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          continue;
        }
        const state: AppStateData = await res.json();
        const rules = Array.isArray(state.rules) && state.rules.length > 0
          ? state.rules
          : (getLocalCachedRules() || DEFAULT_RULES);

        saveLocalCachedRules(rules);

        const config: MonitorConfig = state.config || {
          pollingIntervalMinutes: 5,
          isPollingActive: true,
          discordWebhookConfigured: true,
          tauriSessionConfigured: true,
          tauriAhUrl: 'https://tauriwow.com/vipdsh/ajax/characterah',
          totalParsed: state.cachedListings?.length || 0,
          totalNotified: state.notificationHistory?.length || 0,
          lastCheckStatus: 'success'
        };

        return {
          rules,
          listings: state.cachedListings || [],
          history: state.notificationHistory || [],
          config,
          isStaticMode: true
        };
      }
    } catch {
      // Continue to next candidate
    }
  }

  // 3. Fallback to LocalStorage or Default
  const localRules = getLocalCachedRules() || DEFAULT_RULES;
  return {
    rules: localRules,
    listings: [],
    history: [],
    config: {
      pollingIntervalMinutes: 5,
      isPollingActive: true,
      discordWebhookConfigured: true,
      tauriSessionConfigured: true,
      tauriAhUrl: 'https://tauriwow.com/vipdsh/ajax/characterah',
      totalParsed: 0,
      totalNotified: 0,
      lastCheckStatus: 'idle'
    },
    isStaticMode: true
  };
}

/**
 * Saves rules to either:
 * - Express backend (/api/rules) if in server mode
 * - GitHub Repository via REST API (if GitHub token is provided)
 * - LocalStorage (always)
 */
export async function persistRules(
  rules: BargainRule[],
  isStaticMode: boolean,
  githubSettings?: GitHubSyncSettings
): Promise<{ success: boolean; message: string }> {
  // Always update browser cache
  saveLocalCachedRules(rules);

  // If in live server mode, update server
  if (!isStaticMode) {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules)
      });
      if (res.ok) {
        return { success: true, message: 'Rules saved to local server and monitor-state.json.' };
      }
    } catch (e) {
      console.warn('Could not reach Express server to save rules:', e);
    }
  }

  // If GitHub token and repo configured, commit directly to GitHub repository
  if (githubSettings?.token && githubSettings?.owner && githubSettings?.repo) {
    try {
      const { owner, repo, branch = 'main', token } = githubSettings;
      const filePath = 'data/monitor-state.json';
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      // 1. Fetch current file to get SHA and existing state
      const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      let currentSha: string | undefined;
      let currentState: AppStateData = { rules };

      if (getRes.ok) {
        const fileData = await getRes.json();
        currentSha = fileData.sha;
        try {
          const contentDecoded = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
          currentState = JSON.parse(contentDecoded);
        } catch {
          // Use default
        }
      }

      // Update rules inside state
      currentState.rules = rules;

      // Encode content in Base64 (handling UTF-8 strings cleanly)
      const serialized = JSON.stringify(currentState, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(serialized)));

      // 2. Put file contents back to GitHub
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `chore(rules): update bargain rules from web UI [skip ci]`,
          content: base64Content,
          sha: currentSha,
          branch
        })
      });

      if (putRes.ok) {
        return {
          success: true,
          message: `Successfully pushed updated rules directly to GitHub repository (${owner}/${repo}@${branch})! The next GitHub Action run will use these rules.`
        };
      } else {
        const errData = await putRes.json();
        throw new Error(errData.message || `GitHub API error (HTTP ${putRes.status})`);
      }
    } catch (err) {
      return {
        success: false,
        message: `Saved locally, but failed to push to GitHub: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  return {
    success: true,
    message: 'Rules saved to browser storage. Export or download monitor-state.json to commit to GitHub.'
  };
}

/**
 * Explicit helper to sync rules to GitHub REST API
 */
export async function syncRulesToGitHub(
  rules: BargainRule[],
  settings: GitHubSyncSettings
): Promise<{ success: boolean; error?: string }> {
  const res = await persistRules(rules, true, settings);
  return {
    success: res.success,
    error: res.success ? undefined : res.message
  };
}

/**
 * Downloads monitor-state.json ready to be committed to the repository.
 */
export function downloadMonitorStateJson(
  rules: BargainRule[],
  notificationHistory?: NotificationLog[],
  existingListings?: CharacterListing[]
): void {
  const state: AppStateData = {
    rules,
    notifiedListingIds: [],
    notificationHistory: notificationHistory || [],
    cachedListings: existingListings || [],
    config: {
      pollingIntervalMinutes: 5,
      isPollingActive: true,
      discordWebhookConfigured: true,
      tauriSessionConfigured: true,
      tauriAhUrl: 'https://tauriwow.com/vipdsh/ajax/characterah',
      totalParsed: existingListings?.length || 0,
      totalNotified: notificationHistory?.length || 0,
      lastCheckStatus: 'idle'
    }
  };

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'monitor-state.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadStateFile(rules: BargainRule[], existingListings?: CharacterListing[]): void {
  downloadMonitorStateJson(rules, [], existingListings);
}

/**
 * Generate formatted JSON for clipboard copy
 */
export function formatRulesAsStateJson(rules: BargainRule[]): string {
  const state: AppStateData = {
    rules,
    notifiedListingIds: [],
    notificationHistory: [],
    cachedListings: [],
    config: {
      pollingIntervalMinutes: 5,
      isPollingActive: true,
      discordWebhookConfigured: true,
      tauriSessionConfigured: true,
      tauriAhUrl: 'https://tauriwow.com/vipdsh/ajax/characterah',
      totalParsed: 0,
      totalNotified: 0,
      lastCheckStatus: 'idle'
    }
  };
  return JSON.stringify(state, null, 2);
}

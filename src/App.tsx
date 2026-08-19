import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RulesManager } from './components/RulesManager';
import { ListingsView } from './components/ListingsView';
import { AlertsHistory } from './components/AlertsHistory';
import { HtmlDebugger } from './components/HtmlDebugger';
import { RuleModal } from './components/RuleModal';
import { TestRuleModal } from './components/TestRuleModal';
import { SettingsModal } from './components/SettingsModal';
import { MonitorConfig, BargainRule, CharacterListing, NotificationLog } from './types';
import { Bell, CheckCircle2, AlertTriangle, Info, GitBranch } from 'lucide-react';
import {
  loadInitialState,
  persistRules,
  syncRulesToGitHub,
  downloadMonitorStateJson,
  getStoredGitHubSettings,
  saveStoredGitHubSettings
} from './utils/githubSync';
import { parseTauriAhHtmlClient, evaluateListingAgainstRulesClient } from './utils/clientParser';

export default function App() {
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [rules, setRules] = useState<BargainRule[]>([]);
  const [listings, setListings] = useState<CharacterListing[]>([]);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'listings' | 'alerts' | 'parser'>('rules');

  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStaticMode, setIsStaticMode] = useState(false);
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);
  const [lastCheckSource, setLastCheckSource] = useState<string>('Cached AH');

  // Modals state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BargainRule | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [testingRule, setTestingRule] = useState<BargainRule | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'warning'; message: string } | null>(null);

  const showToast = (type: 'success' | 'info' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch all core data (with seamless fallback to static file / localStorage)
  const fetchData = useCallback(async () => {
    try {
      const state = await loadInitialState();
      setIsStaticMode(state.isStaticMode);
      setConfig(state.config);
      setRules(state.rules);
      setListings(state.listings);
      setHistory(state.history);
      setLastCheckSource(state.isStaticMode ? 'Cached State JSON' : 'Express Server');
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Only poll if not in pure static mode, or poll cached JSON every 30 seconds
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Check Now / Evaluate handler
  const handleCheckNow = async (customHtml?: string) => {
    setIsChecking(true);
    try {
      if (isStaticMode || customHtml) {
        // Client-side evaluation
        let parsedListings = listings;
        if (customHtml) {
          parsedListings = parseTauriAhHtmlClient(customHtml);
          setListings(parsedListings);
          setLastCheckSource('Custom Parsed HTML');
        } else {
          setLastCheckSource('Cached AH Snapshot');
        }

        let matchCount = 0;
        parsedListings.forEach(l => {
          const matched = evaluateListingAgainstRulesClient(l, rules);
          if (matched.length > 0) matchCount++;
        });

        if (matchCount > 0) {
          showToast('success', `Evaluated ${parsedListings.length} characters: ${matchCount} match active bargain rule(s)!`);
        } else {
          showToast('info', `Evaluated ${parsedListings.length} characters: No matches against current rules.`);
        }
        return;
      }

      // Server mode
      const res = await fetch('/api/check-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customHtml })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to run check`);
      }

      const data = await res.json();
      setListings(data.listings || []);
      setLastCheckSource(data.source === 'live' ? 'Live Tauri AH' : data.source === 'custom' ? 'Custom Parsed HTML' : 'Sample Tauri AH');

      if (data.newAlertsSent > 0) {
        showToast('success', `Found ${data.matchesCount} bargain match(es)! Sent ${data.newAlertsSent} new Discord alert(s).`);
      } else if (data.matchesCount > 0) {
        showToast('info', `Found ${data.matchesCount} matching listing(s). All already notified.`);
      } else {
        showToast('info', `AH check complete. Parsed ${data.listings?.length || 0} characters. No new bargain matches.`);
      }

      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('warning', `Check failed: ${msg}`);
    } finally {
      setIsChecking(false);
    }
  };

  // Toggle background polling active / pause (Server mode only)
  const handleTogglePolling = async () => {
    if (!config) return;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPollingActive: !config.isPollingActive })
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        showToast('info', data.config.isPollingActive ? 'Periodic AH monitoring resumed.' : 'Periodic AH monitoring paused.');
      }
    } catch (err) {
      console.error('Failed to toggle polling:', err);
    }
  };

  // Save or Update Rule
  const handleSaveRule = async (ruleData: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>) => {
    let updatedRules: BargainRule[];
    if (editingRule) {
      updatedRules = rules.map(r => r.id === editingRule.id ? { ...r, ...ruleData } : r);
      showToast('success', `Updated rule "${ruleData.name}"`);
    } else {
      const newRule: BargainRule = {
        ...ruleData,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        createdAt: new Date().toISOString(),
        matchCount: 0
      };
      updatedRules = [newRule, ...rules];
      showToast('success', `Created bargain rule "${ruleData.name}"`);
    }

    setRules(updatedRules);
    const ghSettings = getStoredGitHubSettings();
    await persistRules(updatedRules, isStaticMode, ghSettings.token ? ghSettings : undefined);
    await fetchData();
  };

  // Toggle Rule
  const handleToggleRule = async (id: string) => {
    const updatedRules = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setRules(updatedRules);
    const ghSettings = getStoredGitHubSettings();
    await persistRules(updatedRules, isStaticMode, ghSettings.token ? ghSettings : undefined);
  };

  // Delete Rule
  const handleDeleteRule = async (id: string) => {
    const updatedRules = rules.filter(r => r.id !== id);
    setRules(updatedRules);
    showToast('info', 'Rule removed.');
    const ghSettings = getStoredGitHubSettings();
    await persistRules(updatedRules, isStaticMode, ghSettings.token ? ghSettings : undefined);
  };

  // Apply Preset
  const handleApplyPreset = async (preset: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>) => {
    const newRule: BargainRule = {
      ...preset,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      matchCount: 0
    };
    const updatedRules = [newRule, ...rules];
    setRules(updatedRules);
    showToast('success', `Added preset rule "${preset.name}"`);
    const ghSettings = getStoredGitHubSettings();
    await persistRules(updatedRules, isStaticMode, ghSettings.token ? ghSettings : undefined);
  };

  // Sync Rules Directly to GitHub Repository
  const handleSyncGitHub = async () => {
    const ghSettings = getStoredGitHubSettings();
    if (!ghSettings.token || !ghSettings.owner || !ghSettings.repo) {
      showToast('warning', 'Please set your GitHub Owner, Repo, and Token in Settings & Config first.');
      setIsSettingsModalOpen(true);
      return;
    }

    setIsSyncingGitHub(true);
    try {
      const res = await syncRulesToGitHub(rules, ghSettings);
      if (res.success) {
        showToast('success', 'Successfully committed rules to GitHub repository! GitHub Actions will use them on next run.');
      } else {
        showToast('warning', `GitHub Sync Error: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('warning', `GitHub Sync Failed: ${msg}`);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  // Download monitor-state.json
  const handleDownloadState = () => {
    downloadMonitorStateJson(rules, history, listings);
    showToast('success', 'Exported data/monitor-state.json! You can commit this file to your GitHub repo.');
  };

  // Copy JSON
  const handleCopyJson = () => {
    const payload = JSON.stringify({ rules }, null, 2);
    navigator.clipboard.writeText(payload);
    showToast('success', 'Copied rules JSON to clipboard!');
  };

  // Import JSON
  const handleImportJson = async (importedRules: BargainRule[]) => {
    const merged = [...importedRules, ...rules.filter(r => !importedRules.some(ir => ir.id === r.id))];
    setRules(merged);
    showToast('success', `Imported ${importedRules.length} rule(s).`);
    const ghSettings = getStoredGitHubSettings();
    await persistRules(merged, isStaticMode, ghSettings.token ? ghSettings : undefined);
  };

  // Send single test alert for a character
  const handleSendTestAlert = async (listing: CharacterListing, ruleName = 'Manual Test') => {
    try {
      if (isStaticMode) {
        showToast('info', `Simulated test alert for ${listing.name} (In static mode, live webhook alerts are sent by GitHub Actions workflow).`);
        return;
      }

      const res = await fetch('/api/send-test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing, ruleName })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Discord test alert sent for ${listing.name}! Check your Discord channel.`);
      } else if (data.simulated) {
        showToast('info', `Simulated test alert for ${listing.name} (Discord webhook URL not configured in server).`);
      } else {
        showToast('warning', `Discord alert error: ${data.error || 'Unknown error'}`);
      }
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('warning', `Failed to send alert: ${msg}`);
    }
  };

  // Config & Secrets
  const handleSaveConfig = async (updates: Partial<MonitorConfig>) => {
    if (isStaticMode) {
      setConfig(prev => prev ? ({ ...prev, ...updates }) : null);
      showToast('success', 'Config updated in client session.');
      return;
    }
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update configuration');
    const data = await res.json();
    setConfig(data.config);
  };

  const handleSaveSecrets = async (secrets: { discordWebhookUrl?: string; tauriSessionCookie?: string; tauriAhUrl?: string }) => {
    if (isStaticMode) {
      showToast('info', 'Note: In GitHub Actions mode, secrets must be added to your GitHub Repo Secrets (DISCORD_WEBHOOK_URL, TAURI_SESSION_COOKIE, TAURI_AH_URL).');
      return;
    }
    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secrets)
    });
    if (!res.ok) throw new Error('Failed to save credentials');
    await fetchData();
  };

  const handleTestDiscord = async (webhookUrl?: string) => {
    if (isStaticMode && webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '⚔️ **[Tauri AH Monitor]** Discord webhook test connection successful!'
          })
        });
        return { success: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    }

    const res = await fetch('/api/test-discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl })
    });
    return res.json();
  };

  const handleTestTauri = async (url?: string, sessionCookie?: string) => {
    if (isStaticMode) {
      return {
        success: true,
        url: url || 'https://tauriwow.com/character.php',
        parsedCount: listings.length,
        message: 'Static Mode: Tauri fetching runs in scheduled GitHub Actions runner (bypassing CORS restrictions).'
      };
    }

    const res = await fetch('/api/test-tauri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, sessionCookie })
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', `Tauri Connection OK: Parsed ${data.parsedCount} listing(s).`);
    } else {
      showToast('warning', `Tauri Test: ${data.message}`);
    }
    return data;
  };

  const handleClearHistory = async () => {
    if (!isStaticMode) {
      await fetch('/api/history/clear', { method: 'POST' });
    }
    setHistory([]);
    showToast('info', 'Alert notification history cleared.');
  };

  const handleResetNotifiedIds = async () => {
    if (!isStaticMode) {
      const res = await fetch('/api/notified-ids/reset', { method: 'POST' });
      const data = await res.json();
      showToast('success', `Reset deduplication memory (${data.count} IDs cleared). Rules can now trigger fresh alerts.`);
      await fetchData();
    } else {
      showToast('info', 'Notified IDs reset in local state.');
    }
  };

  const activeRulesCount = rules.filter(r => r.enabled).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* App Header */}
      <Header
        config={config}
        activeRulesCount={activeRulesCount}
        totalRulesCount={rules.length}
        isChecking={isChecking}
        isStaticMode={isStaticMode}
        onCheckNow={() => handleCheckNow()}
        onTogglePolling={handleTogglePolling}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenNewRule={() => {
          setEditingRule(null);
          setIsRuleModalOpen(true);
        }}
        onDownloadState={handleDownloadState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recentAlertsCount={history.length}
        listingsCount={listings.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Architecture Info Banner */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                GitHub Actions 5-Minute Monitor Architecture
              </h3>
              <p className="text-slate-400 mt-0.5">
                Monitoring runs 24/7 as an ephemeral GitHub Actions workflow (defined in <code className="text-amber-300 font-mono">.github/workflows/monitor.yml</code>). Edit rules here and sync directly to your repository.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGitHub}
              disabled={isSyncingGitHub}
              className="px-3.5 py-1.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white self-start sm:self-auto transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5"
            >
              <GitBranch className="w-3.5 h-3.5" />
              {isSyncingGitHub ? 'Syncing...' : 'Sync Rules to GitHub'}
            </button>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'rules' && (
          <RulesManager
            rules={rules}
            cachedListings={listings}
            isStaticMode={isStaticMode}
            isSyncingGitHub={isSyncingGitHub}
            onToggleRule={handleToggleRule}
            onDeleteRule={handleDeleteRule}
            onEditRule={(rule) => {
              setEditingRule(rule);
              setIsRuleModalOpen(true);
            }}
            onTestRule={(rule) => {
              setTestingRule(rule);
            }}
            onOpenNewRule={() => {
              setEditingRule(null);
              setIsRuleModalOpen(true);
            }}
            onApplyPreset={handleApplyPreset}
            onDownloadState={handleDownloadState}
            onCopyJson={handleCopyJson}
            onImportJson={handleImportJson}
            onSyncGitHub={handleSyncGitHub}
          />
        )}

        {activeTab === 'listings' && (
          <ListingsView
            listings={listings}
            isChecking={isChecking}
            onRefresh={() => handleCheckNow()}
            lastCheckedAt={config?.lastCheckedAt}
            source={lastCheckSource}
            onSendTestAlert={handleSendTestAlert}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsHistory
            history={history}
            onClearHistory={handleClearHistory}
            onResetNotifiedIds={handleResetNotifiedIds}
          />
        )}

        {activeTab === 'parser' && (
          <HtmlDebugger
            onRunTestWithHtml={(html) => handleCheckNow(html)}
            isChecking={isChecking}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-4 bg-slate-950 text-slate-500 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TauriWoW Character AH Monitor • GitHub Actions 5-Min Scheduled Workflow • Static UI Compatible</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="hover:text-slate-300 underline"
            >
              GitHub & Secrets Config
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('parser')}
              className="hover:text-slate-300 underline"
            >
              HTML Parser Sandbox
            </button>
          </div>
        </div>
      </footer>

      {/* Rule Add/Edit Modal */}
      <RuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        onSave={handleSaveRule}
        initialRule={editingRule}
        cachedListings={listings}
      />

      {/* Test Rule Modal */}
      <TestRuleModal
        isOpen={!!testingRule}
        onClose={() => setTestingRule(null)}
        rule={testingRule}
        cachedListings={listings}
        onSendTestAlert={handleSendTestAlert}
      />

      {/* Settings & Auth Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onSaveSecrets={handleSaveSecrets}
        onTestDiscord={handleTestDiscord}
        onTestTauri={handleTestTauri}
        onGitHubSettingsSaved={() => {
          showToast('success', 'GitHub repository settings saved to browser storage.');
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
              : toast.type === 'warning'
              ? 'bg-amber-950 border-amber-700 text-amber-200'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

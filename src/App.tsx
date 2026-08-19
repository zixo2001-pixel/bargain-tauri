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
import { Bell, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [rules, setRules] = useState<BargainRule[]>([]);
  const [listings, setListings] = useState<CharacterListing[]>([]);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'listings' | 'alerts' | 'parser'>('rules');

  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheckSource, setLastCheckSource] = useState<string>('Tauri AH');

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

  // Fetch all core data
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, rulesRes, listingsRes, historyRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/rules'),
        fetch('/api/listings'),
        fetch('/api/history')
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setConfig(statusData.config);
      }
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData);
      }
      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        setListings(listingsData);
      }
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Background polling update check every 10 seconds for UI sync
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Check Now handler
  const handleCheckNow = async (customHtml?: string) => {
    setIsChecking(true);
    try {
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

  // Toggle background polling active / pause
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

  // Rule actions
  const handleSaveRule = async (ruleData: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>) => {
    if (editingRule) {
      const res = await fetch(`/api/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });
      if (!res.ok) throw new Error('Failed to update rule');
      showToast('success', `Updated rule "${ruleData.name}"`);
    } else {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });
      if (!res.ok) throw new Error('Failed to create rule');
      showToast('success', `Created bargain rule "${ruleData.name}"`);
    }
    await fetchData();
  };

  const handleToggleRule = async (id: string) => {
    try {
      const res = await fetch(`/api/rules/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('info', 'Rule removed.');
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleApplyPreset = async (preset: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>) => {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset)
      });
      if (res.ok) {
        showToast('success', `Added preset rule "${preset.name}"`);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to apply preset:', err);
    }
  };

  // Send single test alert for a character
  const handleSendTestAlert = async (listing: CharacterListing, ruleName = 'Manual Test') => {
    try {
      const res = await fetch('/api/send-test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing, ruleName })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Discord test alert sent for ${listing.name}! Check your Discord channel.`);
      } else if (data.simulated) {
        showToast('info', `Simulated test alert for ${listing.name} (Discord webhook URL not configured yet).`);
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
    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secrets)
    });
    if (!res.ok) throw new Error('Failed to save credentials');
    await fetchData();
  };

  const handleTestDiscord = async (webhookUrl?: string) => {
    const res = await fetch('/api/test-discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl })
    });
    return res.json();
  };

  const handleTestTauri = async (url?: string, sessionCookie?: string) => {
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
    await fetch('/api/history/clear', { method: 'POST' });
    setHistory([]);
    showToast('info', 'Alert notification history cleared.');
  };

  const handleResetNotifiedIds = async () => {
    const res = await fetch('/api/notified-ids/reset', { method: 'POST' });
    const data = await res.json();
    showToast('success', `Reset deduplication memory (${data.count} IDs cleared). Rules can now trigger fresh alerts.`);
    await fetchData();
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
        onCheckNow={() => handleCheckNow()}
        onTogglePolling={handleTogglePolling}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenNewRule={() => {
          setEditingRule(null);
          setIsRuleModalOpen(true);
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recentAlertsCount={history.length}
        listingsCount={listings.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Setup Alert if Discord Webhook is Missing */}
        {!config?.discordWebhookConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-amber-200 text-sm">Discord Webhook Not Configured</h3>
                <p className="text-amber-300/80 mt-0.5">
                  To receive real-time bargain alerts on your phone or desktop, add your Discord channel Webhook URL.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 self-start sm:self-auto transition-colors shrink-0"
            >
              Configure Discord Webhook
            </button>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'rules' && (
          <RulesManager
            rules={rules}
            cachedListings={listings}
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
          <span>TauriWoW Character Auction House Bargain Monitor • Secure Server-Side Polling (Notification-Only)</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="hover:text-slate-300 underline"
            >
              Setup & Auth Guide
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('parser')}
              className="hover:text-slate-300 underline"
            >
              Parser Sandbox
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

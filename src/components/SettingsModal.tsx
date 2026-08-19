import React, { useState } from 'react';
import { X, KeyRound, BellRing, Clock, ShieldCheck, Check, Send, AlertCircle, HelpCircle, RefreshCw, Server, AlertTriangle } from 'lucide-react';
import { MonitorConfig } from '../types';

interface TauriTestResult {
  success: boolean;
  url: string;
  statusCode?: number;
  parsedCount?: number;
  sampleListings?: Array<{ name: string; level: number; class: string; realm: string; price: number; itemLevel: number }>;
  message: string;
  errorType?: 'AUTH_ERROR' | 'HTTP_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR';
  errorDetails?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MonitorConfig | null;
  onSaveConfig: (updates: Partial<MonitorConfig>) => Promise<void>;
  onSaveSecrets: (secrets: { discordWebhookUrl?: string; tauriSessionCookie?: string; tauriAhUrl?: string }) => Promise<void>;
  onTestDiscord: (webhookUrl?: string) => Promise<{ success: boolean; error?: string }>;
  onTestTauri: (url?: string, sessionCookie?: string) => Promise<TauriTestResult>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onSaveSecrets,
  onTestDiscord,
  onTestTauri
}) => {
  const [discordUrl, setDiscordUrl] = useState('');
  const [sessionCookie, setSessionCookie] = useState('');
  const [tauriUrl, setTauriUrl] = useState(config?.tauriAhUrl || 'https://tauriwow.com/character.php');
  const [pollingMinutes, setPollingMinutes] = useState(config?.pollingIntervalMinutes || 5);
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Discord test state
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Tauri test state
  const [isTestingTauri, setIsTestingTauri] = useState(false);
  const [tauriTestResult, setTauriTestResult] = useState<TauriTestResult | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // 1. Save general config
      await onSaveConfig({
        pollingIntervalMinutes: pollingMinutes,
        tauriAhUrl: tauriUrl
      });

      // 2. Save secrets if provided
      const secretsToUpdate: { discordWebhookUrl?: string; tauriSessionCookie?: string; tauriAhUrl?: string } = {
        tauriAhUrl: tauriUrl
      };
      if (discordUrl.trim()) {
        secretsToUpdate.discordWebhookUrl = discordUrl.trim();
      }
      if (sessionCookie.trim()) {
        secretsToUpdate.tauriSessionCookie = sessionCookie.trim();
      }

      await onSaveSecrets(secretsToUpdate);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setIsTestingDiscord(true);
    setDiscordTestResult(null);
    try {
      if (discordUrl.trim()) {
        await onSaveSecrets({ discordWebhookUrl: discordUrl.trim() });
      }

      const res = await onTestDiscord(discordUrl.trim() || undefined);
      if (res.success) {
        setDiscordTestResult({
          success: true,
          message: 'Test alert sent successfully to Discord!'
        });
      } else {
        setDiscordTestResult({
          success: false,
          message: res.error || 'Failed to send test alert to Discord. Check webhook URL.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiscordTestResult({
        success: false,
        message: msg
      });
    } finally {
      setIsTestingDiscord(false);
    }
  };

  const handleTestTauri = async () => {
    setIsTestingTauri(true);
    setTauriTestResult(null);
    try {
      if (sessionCookie.trim() || tauriUrl.trim()) {
        await onSaveSecrets({
          tauriSessionCookie: sessionCookie.trim() || undefined,
          tauriAhUrl: tauriUrl.trim() || undefined
        });
      }

      const res = await onTestTauri(tauriUrl.trim() || undefined, sessionCookie.trim() || undefined);
      setTauriTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTauriTestResult({
        success: false,
        url: tauriUrl,
        errorType: 'HTTP_ERROR',
        message: `Connection test error: ${msg}`
      });
    } finally {
      setIsTestingTauri(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div
        id="settings-modal"
        className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl my-8 relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Tauri AH & Discord Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Configure authenticated Tauri connection (<code className="text-amber-300">tSessionId</code>) and Discord Webhook alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Settings and credentials safely saved on backend server.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Section 1: Tauri AH Connection & Authentication */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" />
                Tauri Character AH URL & Authentication
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  config?.tauriSessionConfigured
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {config?.tauriSessionConfigured ? '✓ tSessionId Configured' : 'No Cookie (Public/Sample)'}
                </span>
              </div>
            </div>

            {/* Target URL */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Target Tauri AH URL (from TAURI_AH_URL)
              </label>
              <input
                type="text"
                value={tauriUrl}
                onChange={e => setTauriUrl(e.target.value)}
                placeholder="https://tauriwow.com/character.php"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Session Cookie */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Tauri Session Cookie (<code className="text-amber-400">tSessionId</code>)
                </label>
                <span className="text-[10px] text-slate-500">
                  Stored server-side only • Never logged or exposed
                </span>
              </div>
              <input
                type="password"
                value={sessionCookie}
                onChange={e => setSessionCookie(e.target.value)}
                placeholder={config?.tauriSessionConfigured ? '•••••••••••••••••••••••• (tSessionId configured — leave blank to keep)' : 'e.g. your_tSessionId_hash_value'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Test Tauri Connection Button */}
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleTestTauri}
                disabled={isTestingTauri}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingTauri ? 'animate-spin' : ''}`} />
                {isTestingTauri ? 'Connecting & Parsing...' : 'Test Tauri Connection'}
              </button>
            </div>

            {/* Tauri Test Diagnostics Result */}
            {tauriTestResult && (
              <div className={`p-3 rounded-lg text-xs border space-y-2 ${
                tauriTestResult.success
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                  : 'bg-red-950/60 border-red-800 text-red-200'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {tauriTestResult.success ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>
                    {tauriTestResult.success
                      ? `Connection Verified • Parsed ${tauriTestResult.parsedCount} Listings`
                      : `Connection Test Failed [${tauriTestResult.errorType || 'ERROR'}]`}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-200">
                  {tauriTestResult.message}
                </p>

                {tauriTestResult.sampleListings && tauriTestResult.sampleListings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-800/60">
                    <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider mb-1">
                      Sample Parsed Characters:
                    </div>
                    <div className="space-y-1">
                      {tauriTestResult.sampleListings.map((c, i) => (
                        <div key={i} className="text-[11px] bg-slate-900/80 px-2 py-1 rounded flex items-center justify-between text-slate-300">
                          <span className="font-semibold text-white">{c.name}</span>
                          <span>Lvl {c.level} {c.class} • {c.realm}</span>
                          <span className="text-amber-400 font-bold">{c.price} Credits</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                How Tauri Authentication Works:
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-400">
                <li>Tauri uses the <code className="text-amber-300 font-mono">tSessionId</code> cookie for authenticated requests.</li>
                <li>Requests are sent with header: <code className="text-slate-300 font-mono">Cookie: tSessionId=&lt;value&gt;</code>.</li>
                <li>Extract it from browser DevTools (<kbd className="bg-slate-800 px-1 rounded">F12</kbd> &gt; Application &gt; Cookies &gt; tauriwow.com).</li>
              </ul>
            </div>
          </div>

          {/* Section 2: Discord Webhook */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <BellRing className="w-4 h-4 text-indigo-400" />
                Discord Webhook URL (from DISCORD_WEBHOOK_URL)
              </label>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                config?.discordWebhookConfigured
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {config?.discordWebhookConfigured ? '✓ Configured' : 'Missing'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={discordUrl}
                onChange={e => setDiscordUrl(e.target.value)}
                placeholder={config?.discordWebhookConfigured ? '•••••••••••••••••••••••• (Configured — leave blank to keep)' : 'https://discord.com/api/webhooks/...'}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestingDiscord}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isTestingDiscord ? 'Sending...' : 'Test Discord Webhook'}
              </button>
            </div>

            {discordTestResult && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                discordTestResult.success
                  ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                  : 'bg-red-950/50 border border-red-800 text-red-300'
              }`}>
                {discordTestResult.success ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span>{discordTestResult.message}</span>
              </div>
            )}
          </div>

          {/* Section 3: Monitoring Frequency */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="block text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Check Frequency
            </label>
            <select
              value={pollingMinutes}
              onChange={e => setPollingMinutes(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value={1}>Every 1 minute</option>
              <option value={3}>Every 3 minutes</option>
              <option value={5}>Every 5 minutes (Recommended)</option>
              <option value={10}>Every 10 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
            </select>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-sm border border-amber-400/40 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSaving ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

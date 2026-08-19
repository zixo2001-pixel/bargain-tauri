import React from 'react';
import { Play, Pause, RefreshCw, Plus, Settings, Bell, ShieldCheck, Database, GitBranch, Download } from 'lucide-react';
import { MonitorConfig } from '../types';

interface HeaderProps {
  config: MonitorConfig | null;
  activeRulesCount: number;
  totalRulesCount: number;
  isChecking: boolean;
  isStaticMode: boolean;
  onCheckNow: () => void;
  onTogglePolling: () => void;
  onOpenSettings: () => void;
  onOpenNewRule: () => void;
  onDownloadState: () => void;
  activeTab: 'rules' | 'listings' | 'alerts' | 'parser';
  setActiveTab: (tab: 'rules' | 'listings' | 'alerts' | 'parser') => void;
  recentAlertsCount: number;
  listingsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  activeRulesCount,
  totalRulesCount,
  isChecking,
  isStaticMode,
  onCheckNow,
  onTogglePolling,
  onOpenSettings,
  onOpenNewRule,
  onDownloadState,
  activeTab,
  setActiveTab,
  recentAlertsCount,
  listingsCount
}) => {
  return (
    <header id="app-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand & Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-inner text-slate-950 font-black text-xl tracking-wider border border-amber-400/40">
            ⚔️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                TauriWoW Character AH Monitor
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isStaticMode
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : config?.isPollingActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isStaticMode ? 'bg-purple-400' : config?.isPollingActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isStaticMode ? 'GitHub Actions Mode (Static)' : config?.isPollingActive ? 'Active Polling' : 'Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isStaticMode
                ? 'Monitored 24/7 by GitHub Actions workflow (every 5m) • Zero server cost'
                : 'Auto-detects bargain characters & dispatches instant Discord webhooks'}
            </p>
          </div>
        </div>

        {/* Quick Actions & Control buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Download State JSON */}
          <button
            id="download-state-btn"
            onClick={onDownloadState}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
            title="Download monitor-state.json to commit to your GitHub repository"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export</span> JSON
          </button>

          {/* Polling Toggle Button (Server mode only) */}
          {!isStaticMode && (
            <button
              id="toggle-polling-btn"
              onClick={onTogglePolling}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                config?.isPollingActive
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border-emerald-800'
              }`}
              title={config?.isPollingActive ? 'Pause background monitor' : 'Resume background monitor'}
            >
              {config?.isPollingActive ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Resume
                </>
              )}
            </button>
          )}

          {/* Check Now / Test Rules Button */}
          <button
            id="check-now-btn"
            onClick={onCheckNow}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-sm border border-amber-400/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Evaluating...' : isStaticMode ? 'Test Rules on Cached AH' : 'Check AH Now'}
          </button>

          {/* New Rule Button */}
          <button
            id="create-rule-btn"
            onClick={onOpenNewRule}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border border-indigo-500/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Rule
          </button>

          {/* Settings & Auth */}
          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Configure GitHub Sync, Discord Webhook, and Secrets"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Config & GitHub</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs & Metrics Bar */}
      <div className="bg-slate-950/60 border-t border-slate-850 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1.5">
          {/* Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              id="tab-rules"
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'rules'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Bargain Rules
              <span className="px-1.5 py-0.2 bg-slate-900 text-slate-400 text-[10px] rounded-full border border-slate-700">
                {activeRulesCount}/{totalRulesCount}
              </span>
            </button>

            <button
              id="tab-listings"
              onClick={() => setActiveTab('listings')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'listings'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              AH Listings
              <span className="px-1.5 py-0.2 bg-slate-900 text-slate-400 text-[10px] rounded-full border border-slate-700">
                {listingsCount}
              </span>
            </button>

            <button
              id="tab-alerts"
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'alerts'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Alerts History
              {recentAlertsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-900/60 text-indigo-300 text-[10px] rounded-full border border-indigo-700/50">
                  {recentAlertsCount}
                </span>
              )}
            </button>

            <button
              id="tab-parser"
              onClick={() => setActiveTab('parser')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'parser'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <span>🧪</span>
              HTML Parser Sandbox
            </button>
          </nav>

          {/* Quick Stat Pill info */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400 overflow-x-auto">
            <span>
              Interval: <strong className="text-slate-200">{config?.pollingIntervalMinutes || 5}m</strong>
            </span>
            <span>•</span>
            <span>
              Last Checked:{' '}
              <strong className="text-slate-200">
                {config?.lastCheckedAt ? new Date(config.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
              </strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              Discord:{' '}
              {config?.discordWebhookConfigured ? (
                <span className="text-emerald-400 font-semibold">Configured</span>
              ) : (
                <span className="text-amber-400 font-semibold">Not Set</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

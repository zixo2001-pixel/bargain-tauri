import React, { useRef } from 'react';
import { Plus, Trash2, Edit2, ShieldCheck, ShieldAlert, Sparkles, CheckCircle2, Play, Download, Copy, Upload, GitBranch } from 'lucide-react';
import { BargainRule, CLASS_COLORS, CharacterListing } from '../types';

interface RulesManagerProps {
  rules: BargainRule[];
  cachedListings: CharacterListing[];
  isStaticMode?: boolean;
  isSyncingGitHub?: boolean;
  onToggleRule: (id: string) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onEditRule: (rule: BargainRule) => void;
  onTestRule: (rule: BargainRule) => void;
  onOpenNewRule: () => void;
  onApplyPreset: (preset: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>) => Promise<void>;
  onDownloadState?: () => void;
  onCopyJson?: () => void;
  onImportJson?: (importedRules: BargainRule[]) => Promise<void>;
  onSyncGitHub?: () => Promise<void>;
}

export const RulesManager: React.FC<RulesManagerProps> = ({
  rules,
  cachedListings,
  isStaticMode,
  isSyncingGitHub,
  onToggleRule,
  onDeleteRule,
  onEditRule,
  onTestRule,
  onOpenNewRule,
  onApplyPreset,
  onDownloadState,
  onCopyJson,
  onImportJson,
  onSyncGitHub
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportJson) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const importedRules: BargainRule[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.rules)
          ? parsed.rules
          : [];

        if (importedRules.length > 0) {
          await onImportJson(importedRules);
        }
      } catch (err) {
        console.error('Failed to parse uploaded JSON rules:', err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  // Preset Templates
  const presets: Array<{ title: string; desc: string; rule: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'> }> = [
    {
      title: '⚡ Level 110 High ilvl (800+) Under 20k',
      desc: 'Level 110 Legion end-game characters with 800+ ilvl under 20,000 credits',
      rule: {
        name: 'Level 110 (800+ ilvl) Under 20k Credits',
        enabled: true,
        realm: 'Evermoon',
        characterClass: 'Any',
        race: 'Any',
        faction: 'Any',
        minLevel: 110,
        maxLevel: 110,
        minItemLevel: 800,
        maxItemLevel: null,
        minAchievementPoints: null,
        maxAchievementPoints: null,
        maxPrice: 20000
      }
    },
    {
      title: '🏆 5,000+ Achiev Collector (< 40k)',
      desc: 'Achievement hunter character with 5k+ AP under 40,000 credits',
      rule: {
        name: 'Achievement Hunter (5,000+ AP) Under 40k',
        enabled: true,
        realm: 'Any',
        characterClass: 'Any',
        race: 'Any',
        faction: 'Any',
        minLevel: null,
        maxLevel: null,
        minItemLevel: null,
        maxItemLevel: null,
        minAchievementPoints: 5000,
        maxAchievementPoints: null,
        maxPrice: 40000
      }
    },
    {
      title: '💰 Sub-10,000 Credits Starter (Lvl 85-90)',
      desc: 'Budget character for quick leveling or profession alts under 10,000 credits',
      rule: {
        name: 'Budget Starter (Lvl 85-90 < 10k Credits)',
        enabled: true,
        realm: 'Evermoon',
        characterClass: 'Any',
        race: 'Any',
        faction: 'Any',
        minLevel: 85,
        maxLevel: 90,
        minItemLevel: null,
        maxItemLevel: null,
        minAchievementPoints: null,
        maxAchievementPoints: null,
        maxPrice: 10000
      }
    },
    {
      title: '🛡️ Twink / Low-Level Budget Under 5k',
      desc: 'Sub-90 characters under 5,000 credits on any realm',
      rule: {
        name: 'Sub-90 Low Price Bargains (< 5,000 Credits)',
        enabled: true,
        realm: 'Any',
        characterClass: 'Any',
        race: 'Any',
        faction: 'Any',
        minLevel: 1,
        maxLevel: 89,
        minItemLevel: null,
        maxItemLevel: null,
        minAchievementPoints: null,
        maxAchievementPoints: null,
        maxPrice: 5000
      }
    }
  ];

  return (
    <div id="rules-manager" className="space-y-6">
      {/* Hidden file input for importing JSON rules */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        className="hidden"
      />

      {/* Top Banner with Presets */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Bargain Detection Rules
            </h2>
            <p className="text-xs text-slate-400">
              When a new character listing matches any active rule during a 5-minute GitHub Action cycle, an alert is sent to Discord.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {onSyncGitHub && (
              <button
                id="sync-github-btn"
                onClick={onSyncGitHub}
                disabled={isSyncingGitHub}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border border-indigo-400/40 transition-colors disabled:opacity-50"
                title="Commit and push rules directly to your GitHub repository for the next 5-min run"
              >
                <GitBranch className={`w-3.5 h-3.5 ${isSyncingGitHub ? 'animate-spin' : ''}`} />
                {isSyncingGitHub ? 'Syncing...' : 'Sync to GitHub'}
              </button>
            )}

            {onDownloadState && (
              <button
                onClick={onDownloadState}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
                title="Download monitor-state.json"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export</span>
              </button>
            )}

            {onCopyJson && (
              <button
                onClick={onCopyJson}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
                title="Copy rules JSON to clipboard"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy JSON</span>
              </button>
            )}

            {onImportJson && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
                title="Import rules from JSON file"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Import</span>
              </button>
            )}

            <button
              id="add-rule-btn-top"
              onClick={onOpenNewRule}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-sm border border-amber-400/40 transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add New Rule
            </button>
          </div>
        </div>

        {/* Quick Presets row */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Quick One-Click Rule Presets:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => onApplyPreset(preset.rule)}
                className="text-left p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-850/80 transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 flex items-center justify-between">
                  <span>{preset.title}</span>
                  <Plus className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {preset.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No Bargain Rules Configured</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Create your first bargain rule or apply one of the quick presets above to start monitoring the TauriWoW Character AH.
          </p>
          <button
            onClick={onOpenNewRule}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Bargain Rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => {
            // Count matching cached listings
            const matchingCount = cachedListings.filter(c => {
              if (rule.realm && rule.realm !== 'Any' && rule.realm.trim() !== '') {
                const tr = rule.realm.trim().toLowerCase();
                const cr = (c.realm || '').toLowerCase();
                if (!cr.includes(tr) && !tr.includes(cr)) return false;
              }
              if (rule.characterClass && rule.characterClass !== 'Any' && rule.characterClass.trim() !== '') {
                if (rule.characterClass.trim().toLowerCase() !== (c.class || '').toLowerCase()) return false;
              }
              if (rule.race && rule.race !== 'Any' && rule.race.trim() !== '') {
                const tra = rule.race.trim().toLowerCase();
                const cra = (c.race || '').toLowerCase();
                if (!cra.includes(tra) && !tra.includes(cra)) return false;
              }
              if (rule.faction && rule.faction !== 'Any' && rule.faction.trim() !== '') {
                if (rule.faction.trim().toLowerCase() !== (c.faction || '').toLowerCase()) return false;
              }
              if (rule.minLevel !== null && rule.minLevel !== undefined && c.level < rule.minLevel) return false;
              if (rule.maxLevel !== null && rule.maxLevel !== undefined && c.level > rule.maxLevel) return false;
              if (rule.minItemLevel !== null && rule.minItemLevel !== undefined && c.itemLevel < rule.minItemLevel) return false;
              if (rule.maxItemLevel !== null && rule.maxItemLevel !== undefined && c.itemLevel > rule.maxItemLevel) return false;
              if (rule.minAchievementPoints !== null && rule.minAchievementPoints !== undefined && c.achievementPoints < rule.minAchievementPoints) return false;
              if (rule.maxAchievementPoints !== null && rule.maxAchievementPoints !== undefined && c.achievementPoints > rule.maxAchievementPoints) return false;
              if (rule.maxPrice !== null && rule.maxPrice !== undefined && c.price > rule.maxPrice) return false;
              return true;
            }).length;

            return (
              <div
                key={rule.id}
                id={`rule-card-${rule.id}`}
                className={`bg-slate-900 rounded-xl border transition-all ${
                  rule.enabled
                    ? 'border-slate-800 hover:border-slate-700 shadow-sm'
                    : 'border-slate-850 opacity-60 bg-slate-950/40'
                } p-4.5 flex flex-col justify-between`}
              >
                <div>
                  {/* Top Bar: Name & Toggle */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          rule.enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-600'
                        }`}
                      />
                      <h3 className="text-sm font-bold text-slate-100">
                        {rule.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleRule(rule.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border transition-colors ${
                          rule.enabled
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  </div>

                  {/* Filter Criteria Tags */}
                  <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                    {/* Realm & Faction */}
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                      <span className="text-[10px] text-slate-400 block">Realm / Faction</span>
                      <span className="font-semibold text-slate-200">
                        {rule.realm || 'Any'} • {rule.faction || 'Any'}
                      </span>
                    </div>

                    {/* Class & Race */}
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                      <span className="text-[10px] text-slate-400 block">Class & Race</span>
                      <span
                        className="font-semibold"
                        style={rule.characterClass && rule.characterClass !== 'Any' && CLASS_COLORS[rule.characterClass] ? { color: CLASS_COLORS[rule.characterClass] } : { color: '#e2e8f0' }}
                      >
                        {rule.characterClass || 'Any'} ({rule.race || 'Any'})
                      </span>
                    </div>

                    {/* Level / ilvl */}
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                      <span className="text-[10px] text-slate-400 block">Level / Item Level</span>
                      <span className="font-semibold text-slate-200">
                        Lvl {rule.minLevel ?? 1}-{rule.maxLevel ?? 90}
                        {rule.minItemLevel ? ` • ${rule.minItemLevel}+ ilvl` : ''}
                      </span>
                    </div>

                    {/* Price & Achiev */}
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                      <span className="text-[10px] text-slate-400 block">Max Price / Min AP</span>
                      <span className="font-semibold text-amber-300">
                        {rule.maxPrice ? `≤ ${rule.maxPrice.toLocaleString()} Credits` : 'Any Price'}
                        {rule.minAchievementPoints ? ` • ${rule.minAchievementPoints.toLocaleString()}+ AP` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer: Stats & Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Matches in AH: <strong className="text-slate-200">{matchingCount}</strong>
                    </span>
                    <span>•</span>
                    <span>Alerts: <strong className="text-slate-200">{rule.matchCount || 0}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Test Rule Button */}
                    <button
                      onClick={() => onTestRule(rule)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-700/50 rounded-md transition-colors"
                      title="Test this rule against live AH listings without sending notifications"
                    >
                      <Play className="w-3 h-3" />
                      Test Rule
                    </button>
                    <button
                      onClick={() => onEditRule(rule)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 rounded-md hover:bg-slate-800 transition-colors"
                      title="Edit Rule"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-slate-800 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

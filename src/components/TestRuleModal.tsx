import React, { useState } from 'react';
import { X, CheckCircle2, Send, ExternalLink, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { BargainRule, CharacterListing, CLASS_COLORS } from '../types';

interface TestRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule: BargainRule | null;
  cachedListings: CharacterListing[];
  onSendTestAlert: (listing: CharacterListing, ruleName: string) => Promise<void>;
}

export const TestRuleModal: React.FC<TestRuleModalProps> = ({
  isOpen,
  onClose,
  rule,
  cachedListings,
  onSendTestAlert
}) => {
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (!isOpen || !rule) return null;

  // Evaluate rule against listings
  const matches = cachedListings.filter(char => {
    // 1. Realm
    if (rule.realm && rule.realm !== 'Any' && rule.realm.trim() !== '') {
      const targetRealm = rule.realm.trim().toLowerCase();
      const charRealm = (char.realm || '').toLowerCase();
      if (!charRealm.includes(targetRealm) && !targetRealm.includes(charRealm)) {
        return false;
      }
    }

    // 2. Class
    if (rule.characterClass && rule.characterClass !== 'Any' && rule.characterClass.trim() !== '') {
      if (rule.characterClass.trim().toLowerCase() !== (char.class || '').toLowerCase()) {
        return false;
      }
    }

    // 3. Race
    if (rule.race && rule.race !== 'Any' && rule.race.trim() !== '') {
      const targetRace = rule.race.trim().toLowerCase();
      const charRace = (char.race || '').toLowerCase();
      if (!charRace.includes(targetRace) && !targetRace.includes(charRace)) {
        return false;
      }
    }

    // 4. Faction
    if (rule.faction && rule.faction !== 'Any' && rule.faction.trim() !== '') {
      if (rule.faction.trim().toLowerCase() !== (char.faction || '').toLowerCase()) {
        return false;
      }
    }

    // 5. Level
    if (rule.minLevel !== null && rule.minLevel !== undefined && !isNaN(Number(rule.minLevel))) {
      if (char.level < Number(rule.minLevel)) return false;
    }
    if (rule.maxLevel !== null && rule.maxLevel !== undefined && !isNaN(Number(rule.maxLevel))) {
      if (char.level > Number(rule.maxLevel)) return false;
    }

    // 6. Item Level
    if (rule.minItemLevel !== null && rule.minItemLevel !== undefined && !isNaN(Number(rule.minItemLevel))) {
      if (char.itemLevel < Number(rule.minItemLevel)) return false;
    }
    if (rule.maxItemLevel !== null && rule.maxItemLevel !== undefined && !isNaN(Number(rule.maxItemLevel))) {
      if (char.itemLevel > Number(rule.maxItemLevel)) return false;
    }

    // 7. Achievement Points
    if (rule.minAchievementPoints !== null && rule.minAchievementPoints !== undefined && !isNaN(Number(rule.minAchievementPoints))) {
      if (char.achievementPoints < Number(rule.minAchievementPoints)) return false;
    }
    if (rule.maxAchievementPoints !== null && rule.maxAchievementPoints !== undefined && !isNaN(Number(rule.maxAchievementPoints))) {
      if (char.achievementPoints > Number(rule.maxAchievementPoints)) return false;
    }

    // 8. Max Price
    if (rule.maxPrice !== null && rule.maxPrice !== undefined && !isNaN(Number(rule.maxPrice))) {
      if (char.price > Number(rule.maxPrice)) return false;
    }

    return true;
  });

  const handleSendAlert = async (listing: CharacterListing) => {
    setSendingId(listing.id);
    try {
      await onSendTestAlert(listing, rule.name);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div
        id="test-rule-modal"
        className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-3xl w-full p-6 text-slate-100 shadow-2xl my-8 relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Rule Test Results:</span>
                <span className="text-amber-400 font-semibold">{rule.name}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Evaluation against {cachedListings.length} active live AH listings (no Discord alerts sent automatically)
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

        {/* Rule Criteria Summary */}
        <div className="my-4 p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 block">Realm / Faction:</span>
            <span className="font-semibold text-slate-200">{rule.realm || 'Any'} • {rule.faction || 'Any'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Class / Race:</span>
            <span className="font-semibold text-slate-200">{rule.characterClass || 'Any'} ({rule.race || 'Any'})</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Level / ilvl:</span>
            <span className="font-semibold text-slate-200">
              Lvl {rule.minLevel ?? '1'}-{rule.maxLevel ?? '90'}
              {rule.minItemLevel ? ` • ${rule.minItemLevel}+ ilvl` : ''}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Max Price:</span>
            <span className="font-semibold text-amber-300">{rule.maxPrice ? `≤ ${rule.maxPrice} Credits` : 'Any Price'}</span>
          </div>
        </div>

        {/* Matching Count Banner */}
        <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-semibold mb-4 ${
          matches.length > 0
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
            : 'bg-slate-800/40 border-slate-750 text-slate-400'
        }`}>
          <div className="flex items-center gap-2">
            {matches.length > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {matches.length} matching character{matches.length === 1 ? '' : 's'} found out of {cachedListings.length} total listings
            </span>
          </div>
          {matches.length > 0 && (
            <span className="text-[11px] text-slate-300 font-normal">
              Click &ldquo;Send Test Alert&rdquo; on any character to verify Discord formatting
            </span>
          )}
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {matches.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-850 rounded-xl">
              <p className="text-sm font-semibold text-slate-300">No Listings Match This Rule</p>
              <p className="text-xs text-slate-400 mt-1">
                None of the {cachedListings.length} active listings on the Character AH currently meet all of this rule&apos;s criteria.
              </p>
            </div>
          ) : (
            matches.map((item) => (
              <div
                key={item.id}
                id={`test-match-${item.id}`}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-amber-300 shrink-0">
                    {item.level}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <a
                        href={item.detailsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-bold hover:underline flex items-center gap-1.5"
                        style={{ color: CLASS_COLORS[item.class] || '#fff' }}
                      >
                        {item.name}
                        <ExternalLink className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                      </a>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.realm}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.faction === 'Alliance' ? '🦁 Alliance' : '🐺 Horde'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{item.race} {item.class}</span>
                      <span>•</span>
                      <span>ilvl: <strong className="text-slate-200">{item.itemLevel || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>AP: <strong className="text-slate-200">{item.achievementPoints.toLocaleString()}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-850">
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-300">{item.price.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 block">Credits</span>
                  </div>

                  <button
                    onClick={() => handleSendAlert(item)}
                    disabled={sendingId === item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border border-indigo-400/40 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {sendingId === item.id ? 'Sending...' : 'Send Test Alert'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Test
          </button>
        </div>
      </div>
    </div>
  );
};

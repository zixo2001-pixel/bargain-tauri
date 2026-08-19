import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Sparkles, Check, DollarSign, Award, Swords, Layers } from 'lucide-react';
import { BargainRule, WOW_CLASSES, WOW_REALMS, WOW_RACES, CLASS_COLORS, CharacterListing } from '../types';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ruleData: Omit<BargainRule, 'id' | 'createdAt' | 'matchCount'>) => Promise<void>;
  initialRule?: BargainRule | null;
  cachedListings: CharacterListing[];
}

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRule,
  cachedListings
}) => {
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [realm, setRealm] = useState('Any');
  const [characterClass, setCharacterClass] = useState('Any');
  const [race, setRace] = useState('Any');
  const [faction, setFaction] = useState<'Any' | 'Alliance' | 'Horde'>('Any');
  const [minLevel, setMinLevel] = useState<string>('90');
  const [maxLevel, setMaxLevel] = useState<string>('90');
  const [minItemLevel, setMinItemLevel] = useState<string>('550');
  const [maxItemLevel, setMaxItemLevel] = useState<string>('');
  const [minAchievementPoints, setMinAchievementPoints] = useState<string>('');
  const [maxAchievementPoints, setMaxAchievementPoints] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('200');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRule) {
      setName(initialRule.name);
      setEnabled(initialRule.enabled);
      setRealm(initialRule.realm || 'Any');
      setCharacterClass(initialRule.characterClass || 'Any');
      setRace(initialRule.race || 'Any');
      setFaction(initialRule.faction || 'Any');
      setMinLevel(initialRule.minLevel !== null && initialRule.minLevel !== undefined ? String(initialRule.minLevel) : '');
      setMaxLevel(initialRule.maxLevel !== null && initialRule.maxLevel !== undefined ? String(initialRule.maxLevel) : '');
      setMinItemLevel(initialRule.minItemLevel !== null && initialRule.minItemLevel !== undefined ? String(initialRule.minItemLevel) : '');
      setMaxItemLevel(initialRule.maxItemLevel !== null && initialRule.maxItemLevel !== undefined ? String(initialRule.maxItemLevel) : '');
      setMinAchievementPoints(initialRule.minAchievementPoints !== null && initialRule.minAchievementPoints !== undefined ? String(initialRule.minAchievementPoints) : '');
      setMaxAchievementPoints(initialRule.maxAchievementPoints !== null && initialRule.maxAchievementPoints !== undefined ? String(initialRule.maxAchievementPoints) : '');
      setMaxPrice(initialRule.maxPrice !== null && initialRule.maxPrice !== undefined ? String(initialRule.maxPrice) : '');
    } else {
      setName('');
      setEnabled(true);
      setRealm('Any');
      setCharacterClass('Any');
      setRace('Any');
      setFaction('Any');
      setMinLevel('90');
      setMaxLevel('90');
      setMinItemLevel('550');
      setMaxItemLevel('');
      setMinAchievementPoints('');
      setMaxAchievementPoints('');
      setMaxPrice('200');
    }
    setError(null);
  }, [initialRule, isOpen]);

  // Calculate live preview matches from cached listings
  const previewMatches = React.useMemo(() => {
    return cachedListings.filter(c => {
      if (realm !== 'Any' && realm.toLowerCase() !== c.realm.toLowerCase()) return false;
      if (characterClass !== 'Any' && characterClass.toLowerCase() !== c.class.toLowerCase()) return false;
      if (race !== 'Any' && race.toLowerCase() !== c.race.toLowerCase()) return false;
      if (faction !== 'Any' && faction.toLowerCase() !== c.faction.toLowerCase()) return false;

      const minL = minLevel ? parseInt(minLevel, 10) : null;
      const maxL = maxLevel ? parseInt(maxLevel, 10) : null;
      if (minL !== null && c.level < minL) return false;
      if (maxL !== null && c.level > maxL) return false;

      const minIlvl = minItemLevel ? parseInt(minItemLevel, 10) : null;
      const maxIlvl = maxItemLevel ? parseInt(maxItemLevel, 10) : null;
      if (minIlvl !== null && c.itemLevel < minIlvl) return false;
      if (maxIlvl !== null && c.itemLevel > maxIlvl) return false;

      const minAp = minAchievementPoints ? parseInt(minAchievementPoints, 10) : null;
      const maxAp = maxAchievementPoints ? parseInt(maxAchievementPoints, 10) : null;
      if (minAp !== null && c.achievementPoints < minAp) return false;
      if (maxAp !== null && c.achievementPoints > maxAp) return false;

      const maxP = maxPrice ? parseInt(maxPrice, 10) : null;
      if (maxP !== null && c.price > maxP) return false;

      return true;
    });
  }, [cachedListings, realm, characterClass, race, faction, minLevel, maxLevel, minItemLevel, maxItemLevel, minAchievementPoints, maxAchievementPoints, maxPrice]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a descriptive rule name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        enabled,
        realm,
        characterClass,
        race,
        faction,
        minLevel: minLevel.trim() ? parseInt(minLevel, 10) : null,
        maxLevel: maxLevel.trim() ? parseInt(maxLevel, 10) : null,
        minItemLevel: minItemLevel.trim() ? parseInt(minItemLevel, 10) : null,
        maxItemLevel: maxItemLevel.trim() ? parseInt(maxItemLevel, 10) : null,
        minAchievementPoints: minAchievementPoints.trim() ? parseInt(minAchievementPoints, 10) : null,
        maxAchievementPoints: maxAchievementPoints.trim() ? parseInt(maxAchievementPoints, 10) : null,
        maxPrice: maxPrice.trim() ? parseInt(maxPrice, 10) : null
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to save rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div
        id="rule-modal"
        className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl my-8 relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {initialRule ? 'Edit Bargain Rule' : 'Create New Bargain Rule'}
              </h2>
              <p className="text-xs text-slate-400">
                Define filter criteria for automatic AH bargain detection & Discord alerts
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
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Rule Name & Active Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rule Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                id="rule-name-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Max Lvl 560+ ilvl Under 200c"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <button
                type="button"
                id="rule-enabled-toggle"
                onClick={() => setEnabled(!enabled)}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  enabled
                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700 hover:bg-emerald-900/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {enabled ? 'Active / Enabled' : 'Disabled (Paused)'}
              </button>
            </div>
          </div>

          {/* Realm & Faction & Class & Race */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Realm */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Realm
              </label>
              <select
                id="rule-realm-select"
                value={realm}
                onChange={e => setRealm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="Any">Any Realm</option>
                {WOW_REALMS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Faction */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Faction
              </label>
              <select
                id="rule-faction-select"
                value={faction}
                onChange={e => setFaction(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="Any">Any Faction</option>
                <option value="Alliance">🦁 Alliance</option>
                <option value="Horde">🐺 Horde</option>
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Class
              </label>
              <select
                id="rule-class-select"
                value={characterClass}
                onChange={e => setCharacterClass(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                style={characterClass !== 'Any' && CLASS_COLORS[characterClass] ? { color: CLASS_COLORS[characterClass] } : {}}
              >
                <option value="Any">Any Class</option>
                {WOW_CLASSES.map(cls => (
                  <option key={cls} value={cls} style={{ color: CLASS_COLORS[cls] || '#fff' }}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Race */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Race
              </label>
              <select
                id="rule-race-select"
                value={race}
                onChange={e => setRace(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="Any">Any Race</option>
                {WOW_RACES.map(rc => (
                  <option key={rc} value={rc}>{rc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Level & Item Level */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            {/* Min Level */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Min Level
              </label>
              <input
                type="number"
                id="rule-min-level"
                min="1"
                max="90"
                value={minLevel}
                onChange={e => setMinLevel(e.target.value)}
                placeholder="1"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Max Level */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Max Level
              </label>
              <input
                type="number"
                id="rule-max-level"
                min="1"
                max="90"
                value={maxLevel}
                onChange={e => setMaxLevel(e.target.value)}
                placeholder="90"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Min Item Level (ilvl) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Min Item Level (ilvl)
              </label>
              <input
                type="number"
                id="rule-min-ilvl"
                min="0"
                max="600"
                value={minItemLevel}
                onChange={e => setMinItemLevel(e.target.value)}
                placeholder="e.g. 550"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Max Item Level */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Max Item Level
              </label>
              <input
                type="number"
                id="rule-max-ilvl"
                min="0"
                max="600"
                value={maxItemLevel}
                onChange={e => setMaxItemLevel(e.target.value)}
                placeholder="No max"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Achievement Points & Price Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            {/* Min Achievement Points */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-400" />
                Min Achievements
              </label>
              <input
                type="number"
                id="rule-min-achiev"
                min="0"
                step="100"
                value={minAchievementPoints}
                onChange={e => setMinAchievementPoints(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Max Achievement Points */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Award className="w-3 h-3 text-slate-500" />
                Max Achievements
              </label>
              <input
                type="number"
                id="rule-max-achiev"
                min="0"
                step="100"
                value={maxAchievementPoints}
                onChange={e => setMaxAchievementPoints(e.target.value)}
                placeholder="No max"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Max Price in Credits */}
            <div>
              <label className="block text-[11px] font-semibold text-amber-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                Max Price (Credits / Coins)
              </label>
              <input
                type="number"
                id="rule-max-price"
                min="1"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                placeholder="e.g. 200"
                className="w-full bg-slate-900 border border-amber-500/50 rounded-md px-2.5 py-1.5 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Real-time Match Simulator Preview */}
          <div className="p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-300">
                Matches currently cached in AH:
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <span className={previewMatches.length > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                {previewMatches.length} listing{previewMatches.length === 1 ? '' : 's'}
              </span>
              {previewMatches.length > 0 && (
                <span className="text-[10px] text-emerald-500/80 font-normal">
                  ({previewMatches.map(p => p.name).slice(0, 3).join(', ')}{previewMatches.length > 3 ? '...' : ''})
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-rule-btn"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-sm border border-amber-400/40 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : initialRule ? 'Update Rule' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

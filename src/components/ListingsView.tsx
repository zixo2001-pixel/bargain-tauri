import React, { useState, useMemo } from 'react';
import { Search, Filter, ExternalLink, Sparkles, Trophy, LayoutGrid, List, Send, Check } from 'lucide-react';
import { CharacterListing, CLASS_COLORS, WOW_CLASSES, WOW_REALMS } from '../types';

interface ListingsViewProps {
  listings: CharacterListing[];
  isChecking: boolean;
  onRefresh: () => void;
  lastCheckedAt?: string;
  source?: string;
  onSendTestAlert?: (listing: CharacterListing, ruleName?: string) => Promise<void>;
}

export const ListingsView: React.FC<ListingsViewProps> = ({
  listings,
  isChecking,
  onRefresh,
  lastCheckedAt,
  source,
  onSendTestAlert
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRealm, setFilterRealm] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterMatchedOnly, setFilterMatchedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'ilvl-desc' | 'ap-desc' | 'date-desc'>('price-asc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  const filteredListings = useMemo(() => {
    return listings
      .filter(item => {
        // Search filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesName = item.name.toLowerCase().includes(q);
          const matchesClass = item.class.toLowerCase().includes(q);
          const matchesRace = item.race.toLowerCase().includes(q);
          const matchesRealm = item.realm.toLowerCase().includes(q);
          if (!matchesName && !matchesClass && !matchesRace && !matchesRealm) return false;
        }

        // Realm filter
        if (filterRealm !== 'All' && item.realm.toLowerCase() !== filterRealm.toLowerCase()) {
          return false;
        }

        // Class filter
        if (filterClass !== 'All' && item.class.toLowerCase() !== filterClass.toLowerCase()) {
          return false;
        }

        // Matched rules only
        if (filterMatchedOnly && (!item.matchedRules || item.matchedRules.length === 0)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'ilvl-desc') return b.itemLevel - a.itemLevel;
        if (sortBy === 'ap-desc') return b.achievementPoints - a.achievementPoints;
        return (b.listingDate || '').localeCompare(a.listingDate || '');
      });
  }, [listings, searchTerm, filterRealm, filterClass, filterMatchedOnly, sortBy]);

  const matchedCount = listings.filter(l => l.matchedRules && l.matchedRules.length > 0).length;

  const handleSendTestAlert = async (listing: CharacterListing) => {
    if (!onSendTestAlert) return;
    setSendingAlertId(listing.id);
    try {
      const ruleName = listing.matchedRuleNames?.[0] || 'Manual AH Preview Test';
      await onSendTestAlert(listing, ruleName);
    } finally {
      setSendingAlertId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Parsed AH Character Listings</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {filteredListings.length} / {listings.length}
              </span>
            </h2>
            {matchedCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {matchedCount} Bargain Match{matchedCount === 1 ? '' : 'es'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isChecking}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{isChecking ? 'Checking AH...' : 'Refresh AH'}</span>
            </button>

            {/* View Mode Toggle */}
            <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, class, race, realm..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Realm Filter */}
          <div>
            <select
              value={filterRealm}
              onChange={e => setFilterRealm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Realms</option>
              {WOW_REALMS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Classes</option>
              {WOW_CLASSES.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="ilvl-desc">Item Level: Highest</option>
              <option value="ap-desc">Achievements: Highest</option>
              <option value="date-desc">Newest Listings</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Pill: Only Bargain Matches */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-300">
            <input
              type="checkbox"
              checked={filterMatchedOnly}
              onChange={e => setFilterMatchedOnly(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs font-medium">
              Show only listings matching my active Bargain Rules ({matchedCount})
            </span>
          </label>

          <span className="text-[11px] text-slate-400">
            Source: <strong className="text-slate-300">{source || 'Tauri AH'}</strong>
            {lastCheckedAt && ` • Updated ${new Date(lastCheckedAt).toLocaleTimeString()}`}
          </span>
        </div>
      </div>

      {/* Listings Container */}
      {filteredListings.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No Listings Match Current Filter</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try resetting your search query or trigger an AH check.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Character</th>
                  <th className="px-3 py-3">Realm / Faction</th>
                  <th className="px-3 py-3">Class & Race</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-3 py-3">Item Level</th>
                  <th className="px-3 py-3">Achievements</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Bargain Rule</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal">
                {filteredListings.map((char) => {
                  const classColor = CLASS_COLORS[char.class] || '#ffffff';
                  const isMatched = char.matchedRules && char.matchedRules.length > 0;

                  return (
                    <tr
                      key={char.id}
                      className={`hover:bg-slate-850/60 transition-colors ${
                        isMatched ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Character Name & ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isMatched && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" title="Matches bargain rule" />
                          )}
                          <div>
                            <span className="font-bold text-sm" style={{ color: classColor }}>
                              {char.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              ID: {char.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Realm & Faction */}
                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-200 block">
                          {char.realm}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          {char.faction === 'Alliance' ? '🦁 Alliance' : char.faction === 'Horde' ? '🐺 Horde' : '⚖️ Neutral'}
                        </span>
                      </td>

                      {/* Class & Race */}
                      <td className="px-3 py-3">
                        <span className="font-semibold block" style={{ color: classColor }}>
                          {char.class}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {char.race}
                        </span>
                      </td>

                      {/* Level */}
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-semibold text-xs">
                          {char.level}
                        </span>
                      </td>

                      {/* Item Level */}
                      <td className="px-3 py-3">
                        {char.itemLevel > 0 ? (
                          <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                            char.itemLevel >= 560
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                              : char.itemLevel >= 522
                              ? 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                              : 'bg-slate-950 text-slate-300 border border-slate-800'
                          }`}>
                            {char.itemLevel} ilvl
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Achievements */}
                      <td className="px-3 py-3">
                        {char.achievementPoints > 0 ? (
                          <span className="font-medium text-slate-200 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-400" />
                            {char.achievementPoints.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3">
                        <span className="font-bold text-amber-400 text-sm flex items-center gap-1">
                          💰 {char.price.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">Credits</span>
                        </span>
                      </td>

                      {/* Matched Rule */}
                      <td className="px-3 py-3">
                        {isMatched ? (
                          <div className="space-y-1">
                            {char.matchedRuleNames?.map((name, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">No rule</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {onSendTestAlert && (
                            <button
                              onClick={() => handleSendTestAlert(char)}
                              disabled={sendingAlertId === char.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-xs font-semibold transition-colors disabled:opacity-50"
                              title="Send a sample Discord alert for this character"
                            >
                              <Send className="w-3 h-3" />
                              <span>{sendingAlertId === char.id ? 'Sending...' : 'Test Alert'}</span>
                            </button>
                          )}
                          <a
                            href={char.detailsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                          >
                            <span>Armory / AH</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredListings.map((char) => {
            const classColor = CLASS_COLORS[char.class] || '#ffffff';
            const isMatched = char.matchedRules && char.matchedRules.length > 0;

            return (
              <div
                key={char.id}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                  isMatched
                    ? 'border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 shadow-md'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top line: Name, Level, Price */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {isMatched && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                        <h3 className="font-bold text-sm" style={{ color: classColor }}>
                          {char.name}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800">
                          Lvl {char.level}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {char.race} • {char.class}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-400 block">
                        {char.price.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">Credits</span>
                      </span>
                    </div>
                  </div>

                  {/* Badges Grid */}
                  <div className="grid grid-cols-3 gap-1.5 my-3 text-center text-xs">
                    <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase">Realm</span>
                      <span className="text-[11px] font-semibold text-slate-200 truncate block">
                        {char.realm}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase">Item Level</span>
                      <span className="text-[11px] font-bold text-purple-300">
                        {char.itemLevel > 0 ? `${char.itemLevel}` : '—'}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase">Achiev</span>
                      <span className="text-[11px] font-semibold text-slate-200 truncate block">
                        {char.achievementPoints > 0 ? `${char.achievementPoints.toLocaleString()}` : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Matched Rule Notice */}
                  {isMatched && (
                    <div className="mb-3 p-2 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">Matches: {char.matchedRuleNames?.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Footer Link & Action */}
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {onSendTestAlert ? (
                    <button
                      onClick={() => handleSendTestAlert(char)}
                      disabled={sendingAlertId === char.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-[11px] font-semibold transition-colors disabled:opacity-50"
                      title="Send sample alert to Discord"
                    >
                      <Send className="w-3 h-3" />
                      <span>{sendingAlertId === char.id ? 'Sending...' : 'Test Alert'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      {char.listingDate || 'Recent'}
                    </span>
                  )}
                  <a
                    href={char.detailsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700 transition-colors"
                  >
                    <span>View Armory</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Code2, Play, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { CharacterListing, CLASS_COLORS } from '../types';

interface HtmlDebuggerProps {
  onRunTestWithHtml: (html: string) => Promise<void>;
  isChecking: boolean;
}

export const HtmlDebugger: React.FC<HtmlDebuggerProps> = ({
  onRunTestWithHtml,
  isChecking
}) => {
  const [htmlInput, setHtmlInput] = useState('');
  const [parsedResults, setParsedResults] = useState<CharacterListing[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!htmlInput.trim()) {
      setError('Please paste raw character.php HTML content to parse.');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const res = await fetch('/api/parse-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlInput })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to parse HTML`);
      }

      const data = await res.json();
      setParsedResults(data.listings || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleRunFullCheckWithHtml = async () => {
    if (!htmlInput.trim()) {
      setError('Please paste raw character.php HTML content before executing check.');
      return;
    }
    await onRunTestWithHtml(htmlInput);
  };

  const handleLoadSampleHtml = () => {
    const sample = `
<table class="table table-striped table-hover" id="character_table">
  <thead>
    <tr>
      <th>Realm</th>
      <th>Character</th>
      <th>Race</th>
      <th>Class</th>
      <th>Level</th>
      <th>Item Level</th>
      <th>Achievements</th>
      <th>Price</th>
      <th>Listing Date</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <tr data-id="998121" class="auction-row">
      <td><span class="badge realm-evermoon">Evermoon</span></td>
      <td>
        <a href="https://tauriwow.com/armory#character-sheet.xml?r=Evermoon&n=Netherwind" class="char-name font-bold">Netherwind</a>
        <span class="faction alliance font-xs">(Alliance)</span>
      </td>
      <td><img src="/images/races/7.gif" alt="Gnome" /> Gnome</td>
      <td><img src="/images/classes/8.gif" alt="Mage" /> Mage</td>
      <td><span class="level">90</span></td>
      <td><span class="ilvl">572</span></td>
      <td><span class="ap">15,420 pts</span></td>
      <td><span class="price-credit text-gold">145 Credits</span></td>
      <td>2026-08-18 16:45</td>
      <td><a href="character.php?action=view&id=998121" class="btn btn-primary">Details</a></td>
    </tr>
    <tr data-id="998122" class="auction-row">
      <td><span class="badge realm-tauri">Tauri</span></td>
      <td>
        <a href="https://tauriwow.com/armory#character-sheet.xml?r=Tauri&n=Bloodhoof" class="char-name font-bold">Bloodhoof</a>
        <span class="faction horde font-xs">(Horde)</span>
      </td>
      <td><img src="/images/races/6.gif" alt="Tauren" /> Tauren</td>
      <td><img src="/images/classes/1.gif" alt="Warrior" /> Warrior</td>
      <td><span class="level">90</span></td>
      <td><span class="ilvl">565</span></td>
      <td><span class="ap">11,200 pts</span></td>
      <td><span class="price-credit text-gold">110 Credits</span></td>
      <td>2026-08-18 16:10</td>
      <td><a href="character.php?action=view&id=998122" class="btn btn-primary">Details</a></td>
    </tr>
  </tbody>
</table>
`.trim();
    setHtmlInput(sample);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              HTML Parser Sandbox & Live Extractor
            </h2>
            <p className="text-xs text-slate-400">
              Paste raw HTML directly from TauriWoW <code className="text-amber-300">character.php</code> to verify parser accuracy and preview matching bargain rules.
            </p>
          </div>

          <button
            onClick={handleLoadSampleHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Load Sample Tauri HTML
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={htmlInput}
            onChange={e => setHtmlInput(e.target.value)}
            rows={8}
            placeholder="Paste TauriWoW character.php HTML source here (table rows, character items, or full HTML page)..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleParse}
              disabled={isParsing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isParsing ? 'Parsing HTML...' : 'Parse & Inspect Results'}
            </button>

            <button
              onClick={handleRunFullCheckWithHtml}
              disabled={isChecking}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 border border-amber-400/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Running Engine...' : 'Run Engine & Dispatch Alerts with this HTML'}
            </button>
          </div>
        </div>
      </div>

      {/* Parsed Results Display */}
      {parsedResults && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Parsed Listings ({parsedResults.length})
            </h3>
          </div>

          {parsedResults.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">
              No character rows could be extracted from the supplied HTML. Ensure it contains character names or table columns.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Class / Race</th>
                    <th className="px-3 py-2">Realm / Faction</th>
                    <th className="px-3 py-2">Level</th>
                    <th className="px-3 py-2">Item Level</th>
                    <th className="px-3 py-2">AP</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Rule Matches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-normal">
                  {parsedResults.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-850">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{item.id}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: CLASS_COLORS[item.class] || '#fff' }}>
                        {item.name}
                      </td>
                      <td className="px-3 py-2">{item.race} {item.class}</td>
                      <td className="px-3 py-2">{item.realm} ({item.faction})</td>
                      <td className="px-3 py-2">{item.level}</td>
                      <td className="px-3 py-2 font-semibold text-purple-300">{item.itemLevel || '—'}</td>
                      <td className="px-3 py-2">{item.achievementPoints ? item.achievementPoints.toLocaleString() : '0'}</td>
                      <td className="px-3 py-2 font-bold text-amber-400">{item.price} c</td>
                      <td className="px-3 py-2">
                        {item.matchedRuleNames && item.matchedRuleNames.length > 0 ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[10px] font-semibold border border-emerald-800">
                            {item.matchedRuleNames.join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

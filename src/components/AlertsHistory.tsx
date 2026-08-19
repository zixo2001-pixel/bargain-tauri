import React from 'react';
import { Bell, Trash2, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import { NotificationLog, CLASS_COLORS } from '../types';

interface AlertsHistoryProps {
  history: NotificationLog[];
  onClearHistory: () => Promise<void>;
  onResetNotifiedIds: () => Promise<void>;
}

export const AlertsHistory: React.FC<AlertsHistoryProps> = ({
  history,
  onClearHistory,
  onResetNotifiedIds
}) => {
  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Discord Notification History
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {history.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Log of all bargain alerts triggered and sent to Discord (deduplicated by listing ID).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetNotifiedIds}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Clears deduplication memory so rules can re-notify for existing listings"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Deduplication Memory
          </button>

          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-800/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* History Items */}
      {history.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Bell className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No Alerts Triggered Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            When new character listings matching your active bargain rules appear on the Tauri Character AH, they will be logged here and sent to Discord.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((item) => {
            const classColor = CLASS_COLORS[item.characterClass] || '#ffffff';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                {/* Left info: Character & Rule */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-sm shrink-0">
                    💰
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: classColor }}>
                        {item.characterName}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Lvl {item.level} {item.race} {item.characterClass})
                      </span>
                      <span className="text-[11px] font-semibold text-amber-400">
                        • {item.price} Credits
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                      <span>Realm: <strong className="text-slate-200">{item.realm}</strong></span>
                      <span>•</span>
                      {item.itemLevel > 0 && (
                        <>
                          <span>ilvl: <strong className="text-purple-300">{item.itemLevel}</strong></span>
                          <span>•</span>
                        </>
                      )}
                      {item.achievementPoints > 0 && (
                        <>
                          <span>AP: <strong className="text-slate-200">{item.achievementPoints.toLocaleString()}</strong></span>
                          <span>•</span>
                        </>
                      )}
                      <span className="px-2 py-0.2 rounded bg-indigo-950/60 text-indigo-300 text-[10px] font-semibold border border-indigo-800/60">
                        Rule: {item.ruleName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right info: Status & Time & Armory Link */}
                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  <div className="flex items-center gap-2">
                    {item.discordStatus === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                        <CheckCircle2 className="w-3 h-3" />
                        Discord Sent
                      </span>
                    ) : item.discordStatus === 'simulated' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50" title={item.discordError}>
                        Local Alert (No Webhook)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-medium bg-red-950/50 px-2 py-0.5 rounded border border-red-800/50" title={item.discordError}>
                        <AlertTriangle className="w-3 h-3" />
                        Discord Error
                      </span>
                    )}

                    <a
                      href={item.detailsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                      title="Open Armory"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

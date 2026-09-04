import React, { useState } from 'react';
import { X, GitCommit, Sparkles, ShieldCheck, Zap, Wrench, ChevronRight, Check } from 'lucide-react';
import { CHANGELOG_DATA, APP_CURRENT_VERSION } from '../data/changelogData';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose }) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(APP_CURRENT_VERSION);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentRelease = CHANGELOG_DATA.find((r) => r.version === selectedVersion) || CHANGELOG_DATA[0];

  const handleCopyChangelog = () => {
    const text = CHANGELOG_DATA.map((r) => `${r.version} (${r.date}) - ${r.title}\n` + r.changes.map((c) => `  - [${c.type.toUpperCase()}] ${c.description}`).join('\n')).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeTypeStyle = (type: 'feat' | 'fix' | 'infra' | 'perf') => {
    switch (type) {
      case 'feat':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'fix':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'infra':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'perf':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getBadgeTypeIcon = (type: 'feat' | 'fix' | 'infra' | 'perf') => {
    switch (type) {
      case 'feat':
        return <Sparkles className="w-3 h-3 text-amber-400" />;
      case 'fix':
        return <ShieldCheck className="w-3 h-3 text-emerald-400" />;
      case 'infra':
        return <Wrench className="w-3 h-3 text-indigo-400" />;
      case 'perf':
        return <Zap className="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Riwayat Versi & Log Perubahan (Changelog)
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  {APP_CURRENT_VERSION}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Catatan rilis dan pembaruan sistem DikalaStories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyChangelog}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <GitCommit className="w-3.5 h-3.5" />}
              {copied ? 'Tersalin!' : 'Salin Log'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Sidebar Version Selector + Content Viewer */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3">
          {/* Version List Sidebar */}
          <div className="p-4 border-r border-zinc-800 bg-zinc-950/30 overflow-y-auto space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-2">Daftar Rilis</p>
            {CHANGELOG_DATA.map((item) => {
              const isSelected = item.version === selectedVersion;
              return (
                <button
                  key={item.version}
                  onClick={() => setSelectedVersion(item.version)}
                  className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{item.version}</span>
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.date}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-amber-400 translate-x-0.5' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                </button>
              );
            })}
          </div>

          {/* Details Content Panel */}
          <div className="p-6 md:col-span-2 overflow-y-auto space-y-5 bg-zinc-900/40">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-amber-400 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {currentRelease.version}
                </span>
                <span className="text-xs text-zinc-500">{currentRelease.date}</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mt-2">{currentRelease.title}</h3>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Perubahan Dalam Rilis Ini</p>
              <div className="space-y-2.5">
                {currentRelease.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-3 text-xs leading-relaxed"
                  >
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 mt-0.5 ${getBadgeTypeStyle(
                        change.type
                      )}`}
                    >
                      {getBadgeTypeIcon(change.type)}
                      {change.type}
                    </span>
                    <span className="text-zinc-300 font-medium">{change.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Semua commit tersinkronisasi otomatis dengan file <code className="text-amber-400 font-mono">CHANGELOG.md</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

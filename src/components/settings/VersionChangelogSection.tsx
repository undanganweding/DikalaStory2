import React, { useState } from 'react';
import { GitCommit, Sparkles, ShieldCheck, Zap, Wrench, Download, ChevronRight, Check } from 'lucide-react';
import { CHANGELOG_DATA, APP_CURRENT_VERSION } from '../../data/changelogData';

export const VersionChangelogSection: React.FC = () => {
  const [selectedVersion, setSelectedVersion] = useState<string>(APP_CURRENT_VERSION);
  const [downloaded, setDownloaded] = useState(false);

  const currentRelease = CHANGELOG_DATA.find((r) => r.version === selectedVersion) || CHANGELOG_DATA[0];

  const handleDownloadChangelog = () => {
    const text = `# Changelog — DikalaStories (AI Cinematic Production Studio)\n\n` + 
      CHANGELOG_DATA.map(
        (r) => `## [${r.version}] - ${r.date} — ${r.title}\n` + 
          r.changes.map((c) => `- **[${c.type.toUpperCase()}]**: ${c.description}`).join('\n')
      ).join('\n\n---\n\n');

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CHANGELOG.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
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
    <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <GitCommit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 font-mono">
              System Version &amp; Changelog Log
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                {APP_CURRENT_VERSION}
              </span>
            </h3>
            <p className="text-xs text-zinc-400">Catatan riwayat versi dan pembaruan sistem DikalaStories</p>
          </div>
        </div>
        <button
          onClick={handleDownloadChangelog}
          className="text-xs px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors flex items-center gap-1.5 font-mono cursor-pointer"
        >
          {downloaded ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-amber-400" />}
          {downloaded ? 'Terdownload!' : 'Unduh Log'}
        </button>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Version List Sidebar */}
        <div className="p-3 border border-white/5 bg-[#121624] rounded-xl space-y-2 max-h-[300px] overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1 mb-1 font-mono">Daftar Rilis</p>
          {CHANGELOG_DATA.map((item) => {
            const isSelected = item.version === selectedVersion;
            return (
              <button
                key={item.version}
                onClick={() => setSelectedVersion(item.version)}
                className={`w-full text-left p-2.5 rounded-xl transition-all border flex items-center justify-between group ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{item.version}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold font-mono">
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

        {/* Changes List */}
        <div className="p-4 md:col-span-2 space-y-3 max-h-[300px] overflow-y-auto bg-[#121624] border border-white/5 rounded-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                {currentRelease.version}
              </span>
              <span className="text-xs text-zinc-500">{currentRelease.date}</span>
            </div>
            <h4 className="text-sm font-bold text-zinc-100 mt-1.5">{currentRelease.title}</h4>
          </div>

          <div className="space-y-2">
            {currentRelease.changes.map((change, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-start gap-2.5 text-xs leading-relaxed"
              >
                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 mt-0.5 ${getBadgeTypeStyle(
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
  );
};

import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Shield,
  Sparkles,
  ExternalLink,
  Activity,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { CharacterBible } from '../../../types';

interface CharacterDetailWindowProps {
  character: CharacterBible;
  projectId?: string;
}

export const CharacterDetailWindow: React.FC<CharacterDetailWindowProps> = ({
  character,
  projectId,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [impactReport, setImpactReport] = useState<any>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFetchImpact = async () => {
    if (!projectId) return;
    setIsLoadingImpact(true);
    try {
      const assetId = character.id || `char-${character.name.toLowerCase().replace(/\s+/g, '-')}`;
      const res = await fetch(`/api/projects/${projectId}/asset-graph/impact/${encodeURIComponent(assetId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setImpactReport(json.impact_analysis);
        }
      }
    } catch (err) {
      console.error('Failed to load character impact:', err);
    } finally {
      setIsLoadingImpact(false);
    }
  };

  return (
    <div className="space-y-4 text-slate-200 text-xs">
      {/* Profile Header */}
      <div className="bg-[#151728] p-3.5 rounded-xl border border-[#262842] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/40 flex items-center justify-center text-white font-mono font-black text-base shadow-md">
            {character.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">{character.name}</h3>
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800/60 font-semibold">
                {character.role || 'Karakter Utama'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Role: {character.role || (character as any).importance || 'Primary'} • Continuity: Tracked
            </p>
          </div>
        </div>

        {projectId && (
          <button
            onClick={handleFetchImpact}
            className="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 font-mono text-[10px] font-bold flex items-center gap-1.5 transition"
          >
            {isLoadingImpact ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Activity className="w-3 h-3 text-cyan-400" />
            )}
            <span>Impact Telemetry</span>
          </button>
        )}
      </div>

      {/* Downstream Impact Alert if Loaded */}
      {impactReport && (
        <div className="bg-[#0D0E1C] p-3 rounded-xl border border-indigo-500/40 space-y-1.5 font-mono text-[10px]">
          <span className="font-bold text-indigo-300 uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" /> Downstream Dependency Simulation
          </span>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-[#15172B] p-1.5 rounded border border-[#232644]">
              <span className="text-slate-400 block text-[9px]">Affected Scenes</span>
              <strong className="text-cyan-300 text-xs">{impactReport.affected_scenes_count}</strong>
            </div>
            <div className="bg-[#15172B] p-1.5 rounded border border-[#232644]">
              <span className="text-slate-400 block text-[9px]">Affected Shots</span>
              <strong className="text-amber-300 text-xs">{impactReport.affected_shots_count}</strong>
            </div>
            <div className="bg-[#15172B] p-1.5 rounded border border-[#232644]">
              <span className="text-slate-400 block text-[9px]">Affected Prompts</span>
              <strong className="text-emerald-300 text-xs">{impactReport.affected_prompts_count}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Physical Appearance & Costume Traits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi Fisik &amp; Wajah</span>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {character.physical_description || character.physical_appearance || 'Deskripsi fisik detail belum terdefinisi.'}
          </p>
        </div>

        <div className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Kostum, Jubah &amp; Wardrobe</span>
          <p className="text-amber-200 text-[11px] leading-relaxed">
            {character.costume || character.wardrobe || (Array.isArray(character.clothing) ? character.clothing.filter(Boolean).join(', ') : (typeof character.clothing === 'string' ? character.clothing : '')) || 'Pakaian otentik era historis.'}
          </p>
        </div>
      </div>

      {/* Master Portrait Prompt */}
      {character.master_portrait_prompt && (
        <div className="bg-[#131526] p-3 rounded-xl border border-[#272B4B] space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-indigo-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Master Portrait Prompt</span>
            </span>
            <button
              onClick={() => handleCopy(character.master_portrait_prompt!, 'master-portrait-prompt')}
              className="px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-mono text-[10px] font-bold transition flex items-center gap-1"
            >
              {copiedId === 'master-portrait-prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId === 'master-portrait-prompt' ? 'Tersalin' : 'Salin Prompt'}</span>
            </button>
          </div>
          <p className="p-2.5 bg-[#090A14] rounded-lg border border-[#1C1E32] text-slate-300 text-[11px] leading-relaxed select-all">
            {character.master_portrait_prompt}
          </p>
        </div>
      )}
    </div>
  );
};

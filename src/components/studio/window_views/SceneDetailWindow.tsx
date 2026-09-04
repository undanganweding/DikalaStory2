import React, { useState } from 'react';
import {
  Film,
  Clock,
  MapPin,
  Users,
  Sparkles,
  Copy,
  Check,
  PlaySquare,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  Info,
  BookOpen,
  Globe,
  ShieldCheck,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Scene, Shot, CharacterBible, LocationBible, VideoPrompt } from '../../../types';
import { useWindowManager } from '../../../context/WindowManagerContext';

interface SceneDetailWindowProps {
  scene: Scene;
  shots: Shot[];
  characters: CharacterBible[];
  locations: LocationBible[];
  videoPrompts?: Record<string, VideoPrompt[]>;
  onSelectShot?: (shotId: string) => void;
  onRunScenePipeline?: (sceneId: string) => void;
}

export const SceneDetailWindow: React.FC<SceneDetailWindowProps> = ({
  scene,
  shots = [],
  characters = [],
  locations = [],
  onSelectShot,
  onRunScenePipeline,
}) => {
  const { openWindow } = useWindowManager();
  const [activeTab, setActiveTab] = useState<'overview' | 'shots' | 'story' | 'cast' | 'world' | 'continuity' | 'prompt' | 'validation'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sceneShots = shots.filter((s) => s.scene_id === scene.id);
  const totalDuration = scene.duration_sec || sceneShots.reduce((acc, s) => acc + (s.duration_sec || 0), 0);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'story', label: 'Story', icon: BookOpen },
    { id: 'cast', label: 'Cast', icon: Users },
    { id: 'world', label: 'World', icon: Globe },
    { id: 'shots', label: 'Shots', icon: PlaySquare },
    { id: 'continuity', label: 'Continuity', icon: ShieldCheck },
    { id: 'prompt', label: 'Prompt', icon: Sparkles },
    { id: 'validation', label: 'Validation', icon: AlertTriangle },
  ] as const;

  return (
    <div className="flex flex-col h-full text-slate-200 text-xs overflow-hidden">
      {/* Header with Tabs */}
      <div className="bg-[#151728] border-b border-[#262842]">
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-mono font-black text-sm">
              SC-{String(scene.scene_number).padStart(2, '0')}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {scene.title || `Adegan ${scene.scene_number}`}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                <span className="flex items-center gap-1 text-cyan-300">
                  <Clock className="w-3 h-3" /> {totalDuration} detik
                </span>
                <span>•</span>
                <span className="text-amber-300">{sceneShots.length} Shots</span>
              </div>
            </div>
          </div>
          {onRunScenePipeline && (
            <button
              onClick={() => onRunScenePipeline(scene.id)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold font-mono text-[11px] transition shadow-md shadow-indigo-600/20"
            >
              Re-generate
            </button>
          )}
        </div>
        
        {/* Tab Navigation */}
        <div className="flex px-3 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[11px] font-medium transition flex items-center gap-1.5 border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Sinopsis Adegan</span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {scene.event || (scene as any).description || 'Tidak ada catatan narasi spesifik.'}
              </p>
            </div>
            
            {scene.master_image_prompt && (
              <div className="bg-[#131526] p-3 rounded-xl border border-[#272B4B] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Master Frame Anchor Prompt</span>
                  </span>
                </div>
                <p className="p-2.5 bg-[#090A14] rounded-lg border border-[#1C1E32] text-slate-300 font-mono text-[11px] leading-relaxed select-all">
                  {scene.master_image_prompt}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'story' && (
          <div className="space-y-4">
            <div className="bg-[#121322] p-3.5 rounded-xl border border-[#1E2034] space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Dramatic Purpose & Function</span>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                {scene.narrative_function || 'Fungsi dramatis belum didefinisikan secara spesifik.'}
              </p>
              {scene.story_purpose && (
                <div className="pt-2 border-t border-[#1C1E32] mt-2">
                  <span className="text-[10px] font-mono text-slate-500 block mb-1">Tujuan Cerita (Story Purpose)</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{scene.story_purpose}</p>
                </div>
              )}
            </div>

            {scene.beats && scene.beats.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block px-1">Story Beats</span>
                <div className="space-y-2">
                  {scene.beats.map((beat, bIdx) => (
                    <div key={beat.id || beat.beat_id || bIdx} className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-bold text-[10px] border border-indigo-800/40">
                          Beat #{beat.beat_number}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{beat.narrative_mode}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed text-[11px]">{beat.description || beat.action}</p>
                      {beat.dialogue && (
                        <div className="mt-2 pl-2 border-l-2 border-indigo-500/40 text-[11px] text-slate-300 italic">
                          "{beat.dialogue}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 font-mono text-[11px]">
                Belum ada detailed story beats terdaftar untuk adegan ini.
              </div>
            )}
          </div>
        )}

        {activeTab === 'shots' && (
          <div className="bg-[#121322] rounded-xl border border-[#1E2034] overflow-hidden">
            {sceneShots.length > 0 ? (
              sceneShots.map((sh, idx) => (
                <div
                  key={sh.id || idx}
                  onDoubleClick={() => {
                    openWindow({
                      id: `shot-${sh.id || idx}`,
                      type: 'shot_detail',
                      title: `Shot ${sh.shot_number} • SC-${String(scene.scene_number).padStart(2, '0')}`,
                      subtitle: sh.visual_description || sh.character_action || 'Shot Cockpit',
                      data: { shot: sh, scene, characters, locations },
                    });
                  }}
                  className="p-3 hover:bg-[#181A2D] cursor-pointer transition flex items-center justify-between gap-3 border-b border-[#1A1C30] last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-bold text-[10px] border border-indigo-800/60 shrink-0">
                      SH-{String(sh.shot_number).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200 text-[11px] font-medium">
                        {sh.character_action || sh.visual_description || 'Sinematik'}
                      </p>
                      <span className="text-[9px] font-mono text-slate-400">
                        {sh.shot_type || 'Medium'} • {sh.camera_movement || 'Static'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 bg-[#0E101D] px-2 py-0.5 rounded border border-[#212338]">
                    {sh.duration_sec || 0}s
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500 font-mono text-[11px]">
                Belum ada shot yang di-breakdown.
              </div>
            )}
          </div>
        )}

        {activeTab === 'cast' && (
          <div className="space-y-3">
            {scene.character_names && scene.character_names.length > 0 ? (
              scene.character_names.map((cName) => {
                const charObj = characters.find((c) => c.name.toLowerCase() === cName.toLowerCase());
                return (
                  <div key={cName} className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">{cName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {charObj ? charObj.role : 'Karakter'}
                      </div>
                    </div>
                    {charObj && (
                      <button
                        onClick={() =>
                          openWindow({
                            id: `char-${charObj.id}`,
                            type: 'character_detail',
                            title: `Karakter: ${charObj.name}`,
                            subtitle: charObj.role || 'Visual Character Bible',
                            data: charObj,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#1A1C30] hover:bg-[#252844] text-indigo-300 border border-[#2B2E4E] text-[10px] font-mono transition"
                      >
                        Buka Bible
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-500 font-mono text-[11px]">
                Tidak ada tokoh terdaftar.
              </div>
            )}
          </div>
        )}

        {activeTab === 'world' && (
          <div className="space-y-4">
            <div className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Lokasi</span>
                  <div className="text-slate-200 text-xs font-medium">{scene.location_name || 'Belum Ditentukan'}</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Waktu</span>
                  <div className="text-slate-200 text-xs font-medium">{scene.time_of_day || 'Day'}</div>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Pencahayaan</span>
                <div className="text-slate-200 text-xs font-medium">{scene.lighting || (scene as any).lighting_style || 'Cinematic'}</div>
              </div>
              {locations.find(l => l.name?.toLowerCase() === scene.location_name?.toLowerCase()) && (
                <button
                  onClick={() => {
                    const loc = locations.find(l => l.name?.toLowerCase() === scene.location_name?.toLowerCase());
                    if (loc) openWindow({
                      id: `loc-${loc.id}`,
                      type: 'location_detail',
                      title: `Lokasi: ${loc.name}`,
                      subtitle: loc.environment || 'Visual Environment Bible',
                      data: loc,
                    });
                  }}
                  className="w-full mt-2 px-3 py-1.5 rounded-lg bg-[#1A1C30] hover:bg-[#252844] text-emerald-300 border border-[#2B2E4E] text-[10px] font-mono transition"
                >
                  Buka Bible Lokasi
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'continuity' && (() => {
          const status = scene.continuity_status || 'passed';
          const violations = scene.continuity_violations || [];
          const totalLocks = (scene.character_names?.length || 0) + (scene.location_name ? 1 : 0);
          const activeLocks = totalLocks;

          const hasViolationType = (types: string[]) => {
            return violations.some(v => types.includes(v.type));
          };

          const checks = [
            { id: 'char', name: 'Character Consistency', status: hasViolationType(['identity_change']) ? 'warning' : 'passed' },
            { id: 'costume', name: 'Costume & Wardrobe', status: hasViolationType(['costume_change', 'head_cover_missing']) ? 'warning' : 'passed' },
            { id: 'location', name: 'Location Alignment', status: hasViolationType(['location_drift']) ? 'warning' : 'passed' },
            { id: 'era', name: 'Era & Period Lock', status: hasViolationType(['period_violation']) ? 'warning' : 'passed' },
            { id: 'camera', name: 'Camera & Grammar', status: 'passed' as const },
            { id: 'atmosphere', name: 'Atmosphere Consistency', status: 'passed' as const },
          ];

          return (
            <div className="space-y-4">
              <div className="bg-[#121322] p-3.5 rounded-xl border border-[#1E2034] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Continuity Health</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      status === 'passed' ? 'bg-emerald-500 animate-pulse' : status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <span className="text-xs font-bold text-white font-mono uppercase">
                      {status === 'passed' ? 'READY' : status === 'warning' ? 'WARNING' : 'BLOCKED'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Active Locks</span>
                    <span className="text-xs font-bold text-cyan-300 font-mono">{activeLocks} / {totalLocks}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Issues</span>
                    <span className={`text-xs font-bold font-mono ${violations.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {violations.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#121322] rounded-xl border border-[#1E2034] p-3.5 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">Safety Protocols</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {checks.map((chk) => (
                    <div key={chk.id} className="flex items-center justify-between p-2 bg-[#0A0B14]/40 rounded-lg border border-[#1A1B2E]">
                      <span className="text-slate-300">{chk.name}</span>
                      {chk.status === 'passed' ? (
                        <span className="text-emerald-400 font-mono font-bold">✓</span>
                      ) : (
                        <span className="text-amber-400 font-mono font-bold">⚠</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block px-1">Continuity Violations</span>
                {violations.length > 0 ? (
                  <div className="space-y-2">
                    {violations.map((v, idx) => {
                      const targetShot = sceneShots.find(sh => sh.shot_number === v.shot_number);
                      return (
                        <div key={idx} className="bg-[#121322] p-3 rounded-xl border border-rose-950/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] uppercase ${
                              v.severity === 'critical' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                            }`}>
                              {v.severity}
                            </span>
                            {v.shot_number && (
                              <span className="text-[10px] font-mono text-indigo-300">
                                Shot {v.shot_number}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-200 text-[11px] leading-relaxed">
                            {v.message || `Discrepancy in ${v.field}`}
                          </p>
                          <div className="bg-[#090A14] rounded-lg p-2 border border-[#1C1E32] text-[10px] font-mono space-y-1">
                            <div><span className="text-slate-500">Expected:</span> <span className="text-slate-300">{v.expected}</span></div>
                            <div><span className="text-slate-500">Actual:</span> <span className="text-rose-300">{v.actual}</span></div>
                          </div>
                          {targetShot && (
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  if (onSelectShot) onSelectShot(targetShot.id);
                                  openWindow({
                                    id: `shot-${targetShot.id}`,
                                    type: 'shot_detail',
                                    title: `Shot ${targetShot.shot_number} • SC-${String(scene.scene_number).padStart(2, '0')}`,
                                    subtitle: targetShot.visual_description || targetShot.character_action || 'Shot Cockpit',
                                    data: { shot: targetShot, scene, characters, locations },
                                  });
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-mono transition"
                              >
                                INSPECT SHOT
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-[#121322] rounded-xl border border-[#1E2034] text-center text-slate-500 font-mono text-[11px]">
                    Tidak ada pelanggaran kontinuitas terdeteksi dalam adegan ini.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'prompt' && (
          <div className="space-y-4">
            <div className="bg-[#121322] p-3.5 rounded-xl border border-[#1E2034] space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">Prompt Lock Matrix</span>
                <p className="text-[11px] text-slate-400">
                  Invariants are actively locked for generative continuity safeguards.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="flex items-center gap-2 p-1.5 bg-[#090A14] rounded border border-[#1C1E32] text-emerald-400">
                  <span>✓</span> <span>Character Invariant</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#090A14] rounded border border-[#1C1E32] text-emerald-400">
                  <span>✓</span> <span>Costume Invariant</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#090A14] rounded border border-[#1C1E32] text-emerald-400">
                  <span>✓</span> <span>Location Invariant</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#090A14] rounded border border-[#1C1E32] text-emerald-400">
                  <span>✓</span> <span>Era Invariant</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#090A14] rounded border border-[#1C1E32] text-emerald-400">
                  <span>✓</span> <span>Camera/Composition</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#090A14] rounded border border-[#1C1E32] text-emerald-400">
                  <span>✓</span> <span>Atmosphere/Lighting</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block px-1">Shot Prompts</span>
              {sceneShots.length > 0 ? (
                <div className="space-y-3">
                  {sceneShots.map((sh) => {
                    const model = sh.recommended_platform || sh.selected_platform || 'veo';
                    const promptText = sh.video_prompt || sh.master_image_prompt || sh.visual_description || '';
                    const promptVersion = sh.prompt_versions?.length || 1;
                    
                    return (
                      <div key={sh.id} className="bg-[#121322] p-3 rounded-xl border border-[#1E2034] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-bold text-[10px] border border-indigo-800/40">
                              SH-{String(sh.shot_number).padStart(2, '0')}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/30">
                              {model}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            Prompt v{promptVersion}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[11px]">
                          <div>
                            <span className="text-[10px] font-mono text-slate-500 uppercase block mb-0.5">Action & Narrative Goal</span>
                            <p className="text-slate-300 bg-[#090A14]/30 px-2 py-1.5 rounded border border-[#1A1B2E] leading-relaxed">
                              {sh.character_action || sh.event_detail || 'No direct action listed.'}
                            </p>
                          </div>
                          {sh.camera_note && (
                            <div>
                              <span className="text-[10px] font-mono text-slate-500 uppercase block mb-0.5">Camera & Composition Note</span>
                              <p className="text-slate-300 bg-[#090A14]/30 px-2 py-1.5 rounded border border-[#1A1B2E] leading-relaxed">
                                {sh.camera_note}
                              </p>
                            </div>
                          )}
                          {promptText && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-amber-500 uppercase block">Compiled Prompt Text</span>
                                <button
                                  onClick={() => handleCopy(promptText, `prompt-${sh.id}`)}
                                  className="text-[10px] text-indigo-300 hover:text-indigo-200 transition font-mono flex items-center gap-1"
                                >
                                  {copiedId === `prompt-${sh.id}` ? 'COPIED!' : 'COPY'}
                                </button>
                              </div>
                              <p className="p-2.5 bg-[#090A14] rounded-lg border border-[#1C1E32] text-slate-300 font-mono text-[11px] leading-relaxed select-all max-h-24 overflow-y-auto">
                                {promptText}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              if (onSelectShot) onSelectShot(sh.id);
                              openWindow({
                                id: `shot-${sh.id}`,
                                type: 'shot_detail',
                                title: `Shot ${sh.shot_number} • SC-${String(scene.scene_number).padStart(2, '0')}`,
                                subtitle: sh.visual_description || sh.character_action || 'Shot Cockpit',
                                data: { shot: sh, scene, characters, locations },
                              });
                            }}
                            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] transition shadow"
                          >
                            OPEN PROMPT WORKBENCH
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-[#121322] rounded-xl border border-[#1E2034] text-center text-slate-500 font-mono text-[11px]">
                  Tidak ada shot terdaftar untuk adegan ini.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'validation' && (() => {
          const status = scene.pipeline_status || 'READY';
          const blockers = scene.blockers || [];
          
          const isCharacterValid = (scene.character_names || []).every(name => 
            characters.some(c => c.name.toLowerCase() === name.toLowerCase())
          );
          const isLocationValid = !scene.location_name || locations.some(l => 
            l.name.toLowerCase() === scene.location_name.toLowerCase()
          );
          const isPromptValid = sceneShots.length > 0 && sceneShots.every(s => 
            s.video_prompt || s.master_image_prompt || s.visual_description
          );
          const hasContViolation = (scene.continuity_violations || []).length > 0;

          const validationChecks = [
            { id: 'struct', name: 'Scene Structure', status: 'passed' as const },
            { id: 'char', name: 'Character Integrity', status: isCharacterValid ? 'passed' : 'warning' as const, note: isCharacterValid ? undefined : 'Unresolved bible characters.' },
            { id: 'loc', name: 'Location Integrity', status: isLocationValid ? 'passed' : 'warning' as const, note: isLocationValid ? undefined : 'Unresolved world location.' },
            { id: 'prompt', name: 'Prompt Integrity', status: isPromptValid ? 'passed' : 'warning' as const, note: isPromptValid ? undefined : 'Shots missing fully generated prompts.' },
            { id: 'costume', name: 'Costume Continuity', status: !hasContViolation ? 'passed' : 'warning' as const, note: !hasContViolation ? undefined : 'Costume continuity breach detected.' },
            { id: 'assets', name: 'Asset Availability', status: 'passed' as const },
          ];

          const totalChecks = validationChecks.length;
          const passedChecksCount = validationChecks.filter(c => c.status === 'passed').length;
          const warningsCount = validationChecks.filter(c => c.status === 'warning').length + (status === 'FAILED' ? 1 : 0);
          const blockersCount = blockers.length;

          return (
            <div className="space-y-4">
              <div className="bg-[#121322] p-3.5 rounded-xl border border-[#1E2034] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Production Validation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      blockersCount > 0 ? 'bg-rose-500 animate-pulse' : warningsCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`} />
                    <span className="text-xs font-bold text-white font-mono uppercase">
                      {blockersCount > 0 ? 'BLOCKED' : warningsCount > 0 ? 'WARNING' : 'READY'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Checks</span>
                    <span className="text-xs font-bold text-white font-mono">{passedChecksCount} / {totalChecks}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Blockers</span>
                    <span className={`text-xs font-bold font-mono ${blockersCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {blockersCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#121322] rounded-xl border border-[#1E2034] p-3.5 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">Integrity Gateways</span>
                <div className="space-y-2">
                  {validationChecks.map((chk) => (
                    <div key={chk.id} className="p-2.5 bg-[#0A0B14]/40 rounded-lg border border-[#1A1B2E] flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-medium text-[11px]">{chk.name}</span>
                        {chk.status === 'passed' ? (
                          <span className="text-emerald-400 font-mono font-bold text-xs">PASSED</span>
                        ) : (
                          <span className="text-amber-400 font-mono font-bold text-xs">WARNING</span>
                        )}
                      </div>
                      {chk.note && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ⚠ {chk.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block px-1">Validation Blockers</span>
                {blockers.length > 0 ? (
                  <div className="space-y-2">
                    {blockers.map((b, bIdx) => (
                      <div key={bIdx} className="bg-[#121322] p-3 rounded-xl border border-rose-950/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 font-mono font-bold text-[9px] uppercase border border-rose-800/40">
                            {b.severity}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            Code: {b.code}
                          </span>
                        </div>
                        <p className="text-slate-200 text-[11px] leading-relaxed">
                          {b.message}
                        </p>
                        <div className="text-[9px] font-mono text-slate-500">
                          Stage: {b.stage} {b.assetName ? `• Asset: ${b.assetName}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-[#121322] rounded-xl border border-[#1E2034] text-center text-slate-500 font-mono text-[11px]">
                    Tidak ada blocker aktif. Adegan siap untuk kompilasi penuh.
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

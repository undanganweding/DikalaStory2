import React, { useState, useEffect } from 'react';
import {
  Users,
  MapPin,
  Package,
  Sparkles,
  Lock,
  Unlock,
  Clock,
  Video,
  Activity,
  Layers,
  Shield,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  GitCommit,
  Cpu,
  Eye,
  Camera,
  X,
  Compass,
  HeartHandshake,
  Maximize2,
  Copy,
  Check,
} from 'lucide-react';
import {
  Project,
  Scene,
  Shot,
  CharacterBible,
  LocationBible,
  ObjectBible,
  VideoPrompt,
  PromptLockState,
  AssetGraph,
  AssetImpactAnalysisReport,
} from '../../types';
import { FocusWindow } from './FocusWindow';

interface ContextualInspectorProps {
  currentProject: Project;
  scene: Scene | null;
  shot: Shot | null;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  videoPrompts?: Record<string, VideoPrompt[]> | VideoPrompt[];
  onSelectScene?: (sceneId: string) => void;
  onSelectShot?: (shotId: string) => void;
}

export const ContextualInspector: React.FC<ContextualInspectorProps> = ({
  currentProject,
  scene,
  shot,
  characters,
  locations,
  objects,
  videoPrompts = {},
  onSelectScene,
  onSelectShot,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [focusModal, setFocusModal] = useState<{
    isOpen: boolean;
    type: 'scene' | 'scene_intelligence' | 'character' | 'location' | null;
    title: string;
    subtitle?: string;
    data: any;
  }>({
    isOpen: false,
    type: null,
    title: '',
    subtitle: '',
    data: null,
  });

  // Helper formatting for timecode
  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Match Character Objects relevant to current context
  const presentCharacterNames: string[] = Array.from(
    new Set([
      ...((shot as any)?.characters_involved || shot?.character_refs || []),
      ...(scene?.characters_present || []),
      ...(scene?.character_names || []),
    ])
  );

  const matchedCharacters = characters.filter((c) =>
    presentCharacterNames.some((pName) => pName && c?.name && pName.toLowerCase() === c.name.toLowerCase())
  );

  // Match Location Object relevant to current context
  const sceneLocationName = scene?.location_name || '';
  const matchedLocation = locations.find(
    (l) => l?.name && sceneLocationName && l.name.toLowerCase() === sceneLocationName.toLowerCase()
  );

  // Match Objects / Key Props relevant to current context
  const shotText = `${shot?.character_action || ''} ${shot?.event_detail || ''} ${shot?.visual_description || ''} ${scene?.event || ''}`.toLowerCase();
  const matchedObjects = objects.filter((o) =>
    o?.name && shotText.includes(o.name.toLowerCase())
  );

  // Prompt Lock Invariants for Shot
  const locks: PromptLockState = shot?.lock_state || {
    character_locked: true,
    location_locked: true,
    costume_locked: true,
    lighting_locked: true,
    camera_locked: false,
    action_locked: false,
    composition_locked: false,
  };

  const lockedCount = Object.values(locks).filter(Boolean).length;

  return (
    <div id="contextual-inspector-panel" className="h-full flex flex-col space-y-2.5 select-none text-xs">
      {/* ================================================================= */}
      {/* 1. TOP CONTEXT HEADER: COMPACT PRODUCTION STATUS IDENTIFIER       */}
      {/* ================================================================= */}
      {shot ? (
        <div className="bg-[#141626] p-2.5 rounded-xl border border-indigo-500/25 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black text-[10px] tracking-wide">
                SH-{String(shot.shot_number).padStart(2, '0')}
              </span>
              {scene && (
                <span className="text-[10px] text-slate-400 font-mono">
                  in SC-{String(scene.scene_number).padStart(2, '0')}
                </span>
              )}
            </div>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1B1D33] text-cyan-300 border border-[#272B4B]">
              {formatSec(shot.start_time_sec || 0)} - {formatSec(shot.end_time_sec || (shot.start_time_sec || 0) + (shot.duration_sec || 0))} [{shot.duration_sec || 0}s]
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="px-1.5 py-0.2 rounded bg-[#1B1D33] text-slate-300 uppercase border border-[#262A48]">
              {shot.shot_type || shot.camera?.framing || 'Medium Shot'}
            </span>
            <span className="text-slate-400 truncate">
              {shot.camera_movement || 'Fixed Camera'}
            </span>
          </div>

          {/* Action Beat Summary */}
          <div className="text-[11px] text-slate-300 bg-[#0C0D17] px-2 py-1.5 rounded-lg border border-[#1E2033] leading-tight">
            <p className="line-clamp-2">
              {shot.character_action || shot.event_detail || shot.visual_description || 'Visual sinematik.'}
            </p>
          </div>
        </div>
      ) : scene ? (
        <div className="bg-[#141626] p-2.5 rounded-xl border border-[#23253B] space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="px-1.5 py-0.5 rounded bg-indigo-900/70 text-indigo-200 font-mono font-bold text-[10px] border border-indigo-500/30">
              SC-{String(scene.scene_number).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-mono text-cyan-300">
              Durasi: {scene.duration_sec || 0}s
            </span>
          </div>
          <div className="font-semibold text-slate-200 truncate text-[11px]">
            {scene.location_name || 'Lokasi Belum Terdefinisi'}
          </div>
        </div>
      ) : (
        <div className="bg-[#11121F] p-3 rounded-xl border border-[#1E2033] text-center text-slate-500 font-mono text-[11px]">
          Pilih Shot atau Adegan di kanvas untuk melihat konteks produksi.
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. PROMPT INVARIANT LOCKS (Strict Invariants - Sleek Compact Grid)*/}
      {/* ================================================================= */}
      {shot && (
        <div className="bg-[#111320] p-2 rounded-xl border border-[#1E2033] space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Prompt Invariant Locks</span>
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-bold">
              {lockedCount}/6 LOCKED
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
            {(
              [
                ['character_locked', 'Karakter'],
                ['location_locked', 'Lokasi'],
                ['costume_locked', 'Kostum'],
                ['lighting_locked', 'Lighting'],
                ['camera_locked', 'Kamera'],
                ['action_locked', 'Aksi'],
              ] as [keyof PromptLockState, string][]
            ).map(([k, label]) => {
              const isLocked = locks[k];
              return (
                <div
                  key={k}
                  className={`px-1.5 py-0.5 rounded flex items-center justify-between border ${
                    isLocked
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                      : 'bg-[#0A0B14] text-slate-500 border-[#1B1D2D]'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {isLocked ? (
                    <Lock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Unlock className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. SCENE INTELLIGENCE ACCORDION (3-LEVEL PROGRESSIVE DISCLOSURE)  */}
      {/* ================================================================= */}
      <div className="bg-[#111320] rounded-xl border border-[#1E2033] overflow-hidden space-y-px">
        {/* Section Header with Focus Window Trigger (Level 3 Entry) */}
        <div className="px-2.5 py-2 bg-[#151728] border-b border-[#212338] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-200 font-bold font-mono text-[10px] uppercase">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scene Intelligence</span>
          </div>
          {scene && (
            <button
              onClick={() =>
                setFocusModal({
                  isOpen: true,
                  type: 'scene_intelligence',
                  title: `Scene Intelligence • SC-${String(scene.scene_number).padStart(2, '0')}`,
                  subtitle: scene.title || scene.location_name || 'Detail Adegan & Narrative Context',
                  data: scene,
                })
              }
              className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#1D2034] hover:bg-[#282C48] text-slate-300 hover:text-white border border-[#2B2F4B] transition flex items-center gap-1"
              title="Buka Scene Intelligence di Focus Window"
            >
              <span>Focus</span>
              <Maximize2 className="w-2.5 h-2.5 text-amber-400" />
            </button>
          )}
        </div>

        {/* Level 1 Item: Tone & Atmosphere */}
        <div className="border-b border-[#181A2A]">
          <button
            onClick={() => toggleSection('toneAtmosphere')}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-[#151726] transition"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px] min-w-0">
              {expandedSections.toneAtmosphere ? (
                <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              )}
              <span className="truncate">Tone &amp; Atmosphere</span>
            </div>
            <span className="text-[9px] font-mono text-amber-300 truncate max-w-[120px] text-right">
              {scene?.lighting || (scene as any)?.lighting_style || scene?.time_of_day || 'Cinematic'}
            </span>
          </button>
          {/* Level 2 Inline Expansion */}
          {expandedSections.toneAtmosphere && (
            <div className="px-3 pb-2 pt-1 text-[10px] text-slate-300 space-y-1 bg-[#0A0B14]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-mono">Waktu:</span>
                <span className="font-mono text-slate-200">{scene?.time_of_day || 'Day'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-mono">Pencahayaan:</span>
                <span className="font-mono text-amber-300">{scene?.lighting || (scene as any)?.lighting_style || 'Cinematic Natural'}</span>
              </div>
              {(scene?.scene_tone?.pacing || (scene as any)?.pacing) && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-mono">Pacing:</span>
                  <span className="font-mono text-cyan-300">{scene?.scene_tone?.pacing || (scene as any)?.pacing}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Level 1 Item: Location */}
        <div className="border-b border-[#181A2A]">
          <button
            onClick={() => toggleSection('location')}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-[#151726] transition"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px] min-w-0">
              {expandedSections.location ? (
                <ChevronDown className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              )}
              <span className="truncate">Latar / Lokasi</span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 truncate max-w-[120px] text-right">
              {sceneLocationName || 'Belum diatur'}
            </span>
          </button>
          {/* Level 2 Inline Expansion */}
          {expandedSections.location && (
            <div className="px-3 pb-2 pt-1 text-[10px] text-slate-300 space-y-1.5 bg-[#0A0B14]">
              <div className="font-semibold text-slate-100 flex items-center justify-between">
                <span className="truncate">{sceneLocationName || 'Lokasi Belum Terdefinisi'}</span>
                {matchedLocation && (
                  <button
                    onClick={() =>
                      setFocusModal({
                        isOpen: true,
                        type: 'location',
                        title: `Lokasi • ${matchedLocation.name}`,
                        subtitle: matchedLocation.environment || 'Visual Environment Bible',
                        data: matchedLocation,
                      })
                    }
                    className="text-[9px] text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0"
                    title="Buka Environment Bible di Focus Window"
                  >
                    <span>Bible</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {matchedLocation?.environment && (
                <p className="text-[9px] text-slate-400 leading-snug line-clamp-2">{matchedLocation.environment}</p>
              )}
              <div className="pt-0.5 flex items-center justify-between">
              </div>
            </div>
          )}
        </div>

        {/* Level 1 Item: Characters */}
        <div className="border-b border-[#181A2A]">
          <button
            onClick={() => toggleSection('characters')}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-[#151726] transition"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px] min-w-0">
              {expandedSections.characters ? (
                <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              )}
              <span className="truncate">Tokoh Terlibat ({presentCharacterNames.length})</span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 truncate max-w-[120px] text-right">
              {presentCharacterNames.length > 0 ? presentCharacterNames.slice(0, 2).join(', ') : 'None'}
            </span>
          </button>
          {/* Level 2 Inline Expansion */}
          {expandedSections.characters && (
            <div className="px-3 pb-2 pt-1 text-[10px] text-slate-300 space-y-1 bg-[#0A0B14]">
              {presentCharacterNames.length === 0 ? (
                <div className="text-[9px] text-slate-500 italic py-0.5">
                  Tidak ada tokoh eksplisit pada segmen ini.
                </div>
              ) : (
                presentCharacterNames.map((cName) => {
                  const charObj = matchedCharacters.find(
                    (c) => c?.name && c.name.toLowerCase() === cName.toLowerCase()
                  );
                  const assetId = charObj?.id || `char-${cName.toLowerCase().replace(/\s+/g, '-')}`;

                  return (
                    <div
                      key={cName}
                      className="p-1 rounded bg-[#10121F] border border-[#1C1E30] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-600/40 border border-indigo-400/40 text-[8px] font-bold font-mono flex items-center justify-center text-indigo-200 shrink-0">
                          {cName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-200 text-[10px] truncate">{cName}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {charObj && (
                          <button
                            onClick={() =>
                              setFocusModal({
                                isOpen: true,
                                type: 'character',
                                title: `Karakter • ${charObj.name}`,
                                subtitle: charObj.role || 'Visual Character Bible',
                                data: charObj,
                              })
                            }
                            className="p-0.5 text-slate-400 hover:text-white"
                            title="Buka Character Bible di Focus Window"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}

                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Level 1 Item: Dramatic Purpose */}
        <div>
          <button
            onClick={() => toggleSection('dramaticObjective')}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-[#151726] transition"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px] min-w-0">
              {expandedSections.dramaticObjective ? (
                <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              )}
              <span className="truncate">Tujuan Dramatis</span>
            </div>
            <span className="text-[9px] font-mono text-amber-300 truncate max-w-[120px] text-right">
              {scene?.emotional_objective || 'Dramatis'}
            </span>
          </button>
          {/* Level 2 Inline Expansion */}
          {expandedSections.dramaticObjective && (
            <div className="px-3 pb-2 pt-1 text-[10px] text-slate-300 space-y-1 bg-[#0A0B14]">
              <p className="text-[9px] text-slate-300 leading-relaxed bg-[#10121F] p-1.5 rounded border border-[#1C1E30]">
                {scene?.emotional_objective || 'Tujuan dramatis belum didefinisikan secara spesifik.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. KEY OBJECTS & PROPS IN SHOT (COMPACT ACCORDION)                */}
      {/* ================================================================= */}
      {matchedObjects.length > 0 && (
        <div className="bg-[#111320] rounded-xl border border-[#1E2033] overflow-hidden">
          <button
            onClick={() => toggleSection('objects')}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-[#151726] transition"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[10px] font-mono uppercase">
              <Package className="w-3 h-3 text-amber-400" />
              <span>Objek &amp; Properti ({matchedObjects.length})</span>
            </div>
            {expandedSections.objects ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-400" />
            )}
          </button>
          {expandedSections.objects && (
            <div className="p-2 bg-[#0A0B14] flex flex-wrap gap-1">
              {matchedObjects.map((obj) => (
                <span
                  key={obj.id}
                  onClick={() => {}}
                  className="px-1.5 py-0.5 rounded bg-[#10121F] hover:bg-[#181A2A] text-slate-300 border border-[#1C1E30] hover:border-amber-500/40 text-[9px] font-mono cursor-pointer transition flex items-center gap-1"
                >
                  <span>{obj.name}</span>
                  {obj.category && <span className="text-slate-500 text-[8px]">({obj.category})</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}



      {/* ================================================================= */}
      {/* 6. MODAL FOCUS WINDOW (LEVEL 3 ON-DEMAND DETAILED INSPECTOR)       */}
      {/* ================================================================= */}
      <FocusWindow
        isOpen={focusModal.isOpen}
        onClose={() => setFocusModal((prev) => ({ ...prev, isOpen: false }))}
        title={focusModal.title}
        subtitle={focusModal.subtitle}
        icon={<Sparkles className="w-4 h-4 text-amber-400" />}
      >
        {focusModal.type === 'scene_intelligence' && focusModal.data && (
          <div className="space-y-4 text-xs font-mono">
            <div className="bg-[#0C0E1A] p-4 rounded-xl border border-[#232644] space-y-2">
              <h4 className="text-sm font-bold text-amber-300 font-sans">Sinopsis Adegan &amp; Peristiwa</h4>
              <p className="text-slate-200 leading-relaxed font-sans text-xs sm:text-sm">
                {focusModal.data.event || focusModal.data.description || 'Tidak ada peristiwa detail tercatat.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Lokasi &amp; Lingkungan</span>
                <p className="text-slate-200 font-semibold">{focusModal.data.location_name || '-'}</p>
                <p className="text-slate-400 text-[11px]">{focusModal.data.time_of_day || 'Day'} • {focusModal.data.lighting_style || 'Natural'}</p>
              </div>

              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Tujuan Emosi / Dramatis</span>
                <p className="text-amber-200">{focusModal.data.emotional_objective || '-'}</p>
              </div>
            </div>

            {focusModal.data.master_image_prompt && (
              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-amber-300 font-bold">Master Frame Banana Prompt</span>
                  <button
                    onClick={() => handleCopy(focusModal.data.master_image_prompt, 'focus-master-prompt')}
                    className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/30 flex items-center gap-1"
                  >
                    {copiedId === 'focus-master-prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'focus-master-prompt' ? 'Tersalin!' : 'Salin'}</span>
                  </button>
                </div>
                <p className="p-3 bg-black/40 rounded border border-[#1A1C30] text-slate-300 text-xs leading-relaxed select-all">
                  {focusModal.data.master_image_prompt}
                </p>
              </div>
            )}
          </div>
        )}

        {focusModal.type === 'character' && focusModal.data && (
          <div className="space-y-4 text-xs">
            <div className="bg-[#0C0E1A] p-4 rounded-xl border border-[#232644] space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">{focusModal.data.name}</h4>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono text-[10px]">
                  {focusModal.data.role || 'Karakter'}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {focusModal.data.physical_description || focusModal.data.physical_appearance || 'Deskripsi fisik belum diatur.'}
              </p>
            </div>

            <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-1 font-mono">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Kostum &amp; Wardrobe:</span>
              <p className="text-slate-200">
                {focusModal.data.costume || focusModal.data.wardrobe || (Array.isArray(focusModal.data.clothing) ? focusModal.data.clothing.filter(Boolean).join(', ') : (typeof focusModal.data.clothing === 'string' ? focusModal.data.clothing : '')) || 'Kostum historis era.'}
              </p>
            </div>

            {focusModal.data.master_portrait_prompt && (
              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-300 font-bold">Master Portrait Prompt</span>
                  <button
                    onClick={() => handleCopy(focusModal.data.master_portrait_prompt, 'focus-char-prompt')}
                    className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold hover:bg-indigo-500/30 flex items-center gap-1"
                  >
                    {copiedId === 'focus-char-prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'focus-char-prompt' ? 'Tersalin!' : 'Salin'}</span>
                  </button>
                </div>
                <p className="p-3 bg-black/40 rounded border border-[#1A1C30] text-slate-300 text-xs leading-relaxed select-all">
                  {focusModal.data.master_portrait_prompt}
                </p>
              </div>
            )}
          </div>
        )}

        {focusModal.type === 'location' && focusModal.data && (
          <div className="space-y-4 text-xs">
            <div className="bg-[#0C0E1A] p-4 rounded-xl border border-[#232644] space-y-2">
              <h4 className="text-base font-bold text-white">{focusModal.data.name}</h4>
              <p className="text-slate-300 leading-relaxed">
                {focusModal.data.environment || focusModal.data.description || 'Deskripsi lingkungan belum diatur.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Gaya Arsitektur</span>
                <p className="text-slate-200">{focusModal.data.architectural_style || focusModal.data.architecture || 'Period Architecture'}</p>
              </div>
              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Karakteristik Visual</span>
                <p className="text-emerald-300">{focusModal.data.visual_features || 'Authentic historical details'}</p>
              </div>
            </div>

            {focusModal.data.master_environment_prompt && (
              <div className="bg-[#0C0E1A] p-3 rounded-xl border border-[#232644] space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300 font-bold">Master Environment Prompt</span>
                  <button
                    onClick={() => handleCopy(focusModal.data.master_environment_prompt, 'focus-loc-prompt')}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold hover:bg-emerald-500/30 flex items-center gap-1"
                  >
                    {copiedId === 'focus-loc-prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'focus-loc-prompt' ? 'Tersalin!' : 'Salin'}</span>
                  </button>
                </div>
                <p className="p-3 bg-black/40 rounded border border-[#1A1C30] text-slate-300 text-xs leading-relaxed select-all">
                  {focusModal.data.master_environment_prompt}
                </p>
              </div>
            )}
          </div>
        )}
      </FocusWindow>
    </div>
  );
};

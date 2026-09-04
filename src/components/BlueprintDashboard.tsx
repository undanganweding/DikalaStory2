import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  MapPin,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  Unlock,
  Film,
  Tag,
  Palette,
  Package,
  Calendar,
  Compass,
  Flame,
  ShieldCheck,
  ChevronRight,
  Tv,
  Image as ImageIcon,
  Video as VideoIcon,
  Shield,
  Sliders,
  Volume2,
  BookOpen,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  Project,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  VideoPrompt,
  StoryArchitecture,
  CharacterContinuityState,
  ApprovedCostumeTransition,
} from '../types';
import { SceneCard } from './SceneCard';
import { StoryArchitectureView } from './StoryArchitectureView';
import { ContinuityPanel } from './ContinuityPanel';

interface BlueprintDashboardProps {
  project: Project;
  foundation: ProjectFoundation | null;
  storyArchitecture?: StoryArchitecture | null;
  characters: CharacterBible[];
  continuityStates?: CharacterContinuityState[];
  locations: LocationBible[];
  objects: ObjectBible[];
  scenes: Scene[];
  shots?: Record<string, Shot[]>;
  videoPrompts?: Record<string, VideoPrompt[]>;
  onRunScenePipeline?: (sceneId: string) => Promise<void>;
  onRegenerateScenePrompt?: (sceneId: string) => Promise<void>;
  onUpdateSceneImage?: (sceneId: string, imageUrl: string | null) => Promise<void>;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => Promise<void>;
  onApproveCostumeTransition?: (characterName: string, transition: ApprovedCostumeTransition) => Promise<void>;
  processingSceneId?: string | null;
}

export const BlueprintDashboard: React.FC<BlueprintDashboardProps> = ({
  project,
  foundation,
  storyArchitecture = null,
  characters,
  continuityStates = [],
  locations,
  objects,
  scenes,
  shots = {},
  videoPrompts = {},
  onRunScenePipeline = async () => {},
  onRegenerateScenePrompt = async () => {},
  onUpdateSceneImage = async () => {},
  onUpdateShotImage = async () => {},
  onApproveCostumeTransition,
  processingSceneId = null,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'story_structure' | 'continuity' | 'foundation' | 'characters' | 'locations' | 'scenes'
  >('overview');

  const totalCalculatedDuration = scenes.reduce((sum, s) => sum + s.duration_sec, 0);
  const isDurationExact = totalCalculatedDuration === project.total_duration_target_sec;

  // Calculate total shots and visuals
  const totalShotsCount = Object.values(shots).reduce(
    (acc: number, list: Shot[]) => acc + (Array.isArray(list) ? list.length : 0),
    0
  );
  const totalMasterFrames = scenes.filter((s) => !!s.master_frame_image_url).length;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Blueprint Header */}
      <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-6 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Cetak Biru Produksi Sinematik • Tahap 1-8 Aktif
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono">ID: {project.id}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">{project.title}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-400">
            <span className="bg-amber-500/10 text-amber-300 font-mono font-medium px-2.5 py-1 rounded-md border border-amber-500/20">
              Penalaran AI: {project.ai_model || 'gemini-3.7-flash'}
            </span>
            <span className="bg-zinc-800 text-amber-300 font-mono font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Target Visual: Nano Banana Pro
            </span>
            {foundation?.genre && (
              <span className="bg-zinc-800 text-amber-300 font-medium px-2.5 py-1 rounded-md">
                Genre: {foundation.genre}
              </span>
            )}
            {foundation?.era && (
              <span className="bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md">
                Era: {foundation.era}
              </span>
            )}
            <span className="text-zinc-500">•</span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Users className="w-3.5 h-3.5 text-amber-400" /> {characters.length} Tokoh/Karakter
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> {locations.length} Lokasi Set
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Film className="w-3.5 h-3.5 text-amber-400" /> {scenes.length} Adegan ({totalShotsCount} Shot)
            </span>
          </div>
        </div>

        {/* Duration Validation Badge */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isDurationExact
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isDurationExact ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-zinc-400">Alokasi Durasi Total</div>
            <div className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-1.5">
              <span>{totalCalculatedDuration} dtk</span>
              <span className="text-zinc-500">/</span>
              <span className="text-amber-400">{project.total_duration_target_sec} dtk target</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              {isDurationExact ? '✓ Presisi pas (0s tolerance)' : 'Durasi terhitung'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-800 text-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Tv className="w-4 h-4" />
          Ringkasan Cetak Biru
        </button>
        <button
          onClick={() => setActiveTab('story_structure')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'story_structure'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Arsitektur Cerita &amp; 5-Babak
        </button>
        <button
          onClick={() => setActiveTab('continuity')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'continuity'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Mesin Kontinuitas ({continuityStates.length || characters.length})
        </button>
        <button
          onClick={() => setActiveTab('foundation')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'foundation'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Fondasi Cerita
        </button>
        <button
          onClick={() => setActiveTab('characters')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'characters'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Bible Karakter ({characters.length})
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'locations'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Lokasi &amp; Properti ({locations.length + objects.length})
        </button>
        <button
          onClick={() => setActiveTab('scenes')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'scenes'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          Rincian Adegan ({scenes.length})
        </button>
      </div>

      {/* TAB: STORY STRUCTURE */}
      {activeTab === 'story_structure' && (
        <StoryArchitectureView
          storyArchitecture={storyArchitecture}
          scenes={scenes}
          shots={shots}
        />
      )}

      {/* TAB: CONTINUITY */}
      {activeTab === 'continuity' && (
        <ContinuityPanel
          projectId={project.id}
          characters={characters}
          locations={locations}
          objects={objects}
          scenes={scenes}
          continuityStates={continuityStates}
          onApproveTransition={onApproveCostumeTransition}
        />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Story Visual Tone Banner */}
          {foundation && (
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                <Sparkles className="w-4 h-4" />
                Arah Visual & Atmosfer Sinematik
              </div>
              <p className="text-base text-zinc-200 leading-relaxed italic font-serif">
                "{foundation.visual_tone}"
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-0.5">Konflik Utama:</span>
                  <span className="text-zinc-200 font-medium">{foundation.main_conflict}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Tema Cerita:</span>
                  <span className="text-zinc-200 font-medium">{foundation.theme}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Cakupan Garis Waktu:</span>
                  <span className="text-zinc-200 font-medium">{foundation.timeline}</span>
                </div>
              </div>
            </div>
          )}

          {/* 5-Beat Narrative Summary strip */}
          {foundation?.narrative_beats && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Struktur Makro Naratif 5-Babak (5-Beat Structure)
                </h3>
                <span className="text-[11px] font-mono text-zinc-400">Peta Narasi Global Tahap 4</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  { title: '1. Awal (Beginning)', text: foundation.narrative_beats.beginning, color: 'border-blue-500/30 bg-blue-950/20' },
                  { title: '2. Perkembangan (Development)', text: foundation.narrative_beats.development, color: 'border-amber-500/30 bg-amber-950/20' },
                  { title: '3. Klimaks (Climax)', text: foundation.narrative_beats.climax, color: 'border-red-500/30 bg-red-950/20' },
                  { title: '4. Konsekuensi (Consequence)', text: foundation.narrative_beats.consequence, color: 'border-purple-500/30 bg-purple-950/20' },
                  { title: '5. Akhir (Ending)', text: foundation.narrative_beats.ending, color: 'border-emerald-500/30 bg-emerald-950/20' },
                ].map((beat) => (
                  <div key={beat.title} className={`p-3.5 rounded-xl border ${beat.color} space-y-1.5`}>
                    <div className="text-xs font-bold text-zinc-200">{beat.title}</div>
                    <p className="text-xs text-zinc-300/90 leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                      {beat.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Scene Strip */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Garis Waktu Alokasi Adegan ({scenes.length} Adegan • Total {totalCalculatedDuration} dtk)
              </h3>
              <button
                onClick={() => setActiveTab('scenes')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Lihat Detail <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Visual proportional duration bar */}
            <div className="w-full h-4 bg-zinc-950 rounded-lg overflow-hidden flex border border-zinc-800">
              {scenes.map((s, idx) => {
                const widthPercent = (s.duration_sec / totalCalculatedDuration) * 100;
                const colors = [
                  'bg-amber-500',
                  'bg-emerald-500',
                  'bg-blue-500',
                  'bg-purple-500',
                  'bg-rose-500',
                  'bg-teal-500',
                  'bg-indigo-500',
                ];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={s.id || s.scene_number}
                    style={{ width: `${widthPercent}%` }}
                    className={`${color} hover:brightness-125 transition relative group cursor-pointer border-r border-zinc-950/40`}
                    title={`Adegan #${s.scene_number}: ${s.title} (${s.duration_sec} dtk)`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {scenes.slice(0, 6).map((s) => (
                <div
                  key={s.id || s.scene_number}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      ADEGAN #{s.scene_number}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200">
                      {s.duration_sec} dtk
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-100 line-clamp-1">{s.title}</div>
                  <div className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {s.event}
                  </div>
                  <div className="text-[10px] text-zinc-400 pt-1 flex items-center justify-between border-t border-zinc-900">
                    <span className="truncate max-w-[140px]">{s.location_name}</span>
                    <span className="font-mono uppercase">{s.time_of_day}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FOUNDATION & 5-ACT BEATS */}
      {activeTab === 'foundation' && foundation && (
        <div className="space-y-6">
          {/* Header Banner - Story Bible */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-zinc-900/80 border border-indigo-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest font-mono bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                PRODUKSI BLUEPRINT • TAHAP 1 &amp; 2
              </span>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>GLOBAL STORY BIBLE &amp; RESEARCH ARCHITECT</span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Pemahaman dunia, verifikasi sejarah, rancangan tempo konflik, dan desain suara sinematik sebelum naskah dipecah.
              </p>
            </div>
            {foundation.narrative_style_mode && (
              <div className="shrink-0 flex items-center gap-2 bg-zinc-950/80 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-mono">GAYA NARASI:</span>
                <span className="text-xs font-black text-indigo-300 uppercase tracking-wider font-mono">
                  {foundation.narrative_style_mode === 'documentary' ? '🎙️ Documentary Voice' : 
                   foundation.narrative_style_mode === 'epic' ? '🗡️ Epic Storytelling' : 
                   '💖 Emotional Narrative'}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Story Core Foundation Card */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* TAHAP 1: RESEARCH ENGINE */}
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                    <Compass className="w-4 h-4 text-indigo-400" />
                    <span>🔬 TAHAP 1: RESEARCH ENGINE &amp; WORLD FACT</span>
                  </h3>
                  <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">
                    Anti-Anachronism Engine
                  </span>
                </div>

                {/* Facts Grid if historical */}
                {foundation.research_basic_facts?.subject ? (
                  <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/60 space-y-3.5">
                    <span className="text-[10px] font-bold text-indigo-400 font-mono uppercase tracking-wider block">
                      📌 Papan Fakta Dasar Sejarah / Biografi:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-zinc-500 font-medium block">Subjek Tokoh/Peristiwa:</span>
                        <p className="text-zinc-200 font-bold text-[13px]">{foundation.research_basic_facts.subject}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-zinc-500 font-medium block">Informasi Era/Kelahiran:</span>
                        <p className="text-zinc-300 leading-relaxed">{foundation.research_basic_facts.birth_info || '-'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-zinc-500 font-medium block">Lokasi Geografis &amp; Hidup:</span>
                        <p className="text-zinc-300">{foundation.research_basic_facts.places_lived || '-'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-zinc-500 font-medium block">Musuh / Lawan Utama:</span>
                        <p className="text-zinc-300 font-semibold text-rose-300">{foundation.research_basic_facts.opponents_enemies || '-'}</p>
                      </div>
                      <div className="col-span-1 sm:col-span-2 space-y-0.5 pt-1.5 border-t border-zinc-800/40">
                        <span className="text-zinc-500 font-medium block">Kejadian Kunci Sejarah:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {foundation.research_basic_facts.key_events?.map((e, idx) => (
                            <span key={idx} className="bg-zinc-800 border border-zinc-700/60 text-zinc-300 text-[10px] px-2 py-0.5 rounded">
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                      {foundation.research_basic_facts.end_of_life && (
                        <div className="col-span-1 sm:col-span-2 space-y-0.5 pt-1.5 border-t border-zinc-800/40">
                          <span className="text-zinc-500 font-medium block">Akhir Riwayat / Legacy:</span>
                          <p className="text-zinc-400 italic font-serif text-[11px]">{foundation.research_basic_facts.end_of_life}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 space-y-3">
                    <span className="text-[10px] font-bold text-indigo-400 font-mono uppercase tracking-wider block">
                      📌 Analisis Plot &amp; Tema Dasar:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-zinc-400 block font-semibold mb-0.5">Genre &amp; Era:</span>
                        <p className="text-zinc-200 text-sm font-bold">{foundation.genre} • {foundation.era}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-semibold mb-0.5">Tema Pokok:</span>
                        <p className="text-zinc-300 leading-relaxed">{foundation.theme}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-semibold mb-0.5">Cakupan Garis Waktu:</span>
                        <p className="text-zinc-300">{foundation.timeline}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-semibold mb-0.5">Konflik Utama:</span>
                        <p className="text-zinc-300 leading-relaxed">{foundation.main_conflict}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Era Context & Anti-Slop Safeguards */}
                {foundation.research_era_context?.century_era && (
                  <div className="bg-zinc-950/30 rounded-xl p-4 border border-zinc-800/50 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-amber-400 font-mono uppercase tracking-wider block">
                        🛡️ KONTEKS ZAMAN ({foundation.research_era_context.century_era})
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      <div className="space-y-1 bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5">
                        <span className="text-rose-400 block font-black text-[9px] uppercase tracking-wider font-mono">
                          ❌ ELEMEN MODERN DILARANG (ANAKRONISME/SLOP):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {foundation.research_era_context.forbidden_elements?.map((el, i) => (
                            <span key={i} className="text-[9px] bg-rose-950/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-900/30 font-mono">
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
                        <span className="text-emerald-400 block font-black text-[9px] uppercase tracking-wider font-mono">
                          ✔ ELEMEN KUNO/AKURAT DIWAJIBKAN:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {foundation.research_era_context.allowed_elements?.map((el, i) => (
                            <span key={i} className="text-[9px] bg-emerald-950/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-900/30 font-mono font-sans">
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>

                      {foundation.research_era_context.technology_weapons && (
                        <div className="col-span-1 sm:col-span-2 space-y-0.5 text-[11px]">
                          <span className="text-zinc-500 font-medium block">Teknologi &amp; Persenjataan Zaman Itu:</span>
                          <p className="text-zinc-300">{foundation.research_era_context.technology_weapons}</p>
                        </div>
                      )}
                      {foundation.research_era_context.clothing_costumes && (
                        <div className="col-span-1 sm:col-span-2 space-y-0.5 text-[11px] pt-1 border-t border-zinc-800/20">
                          <span className="text-zinc-500 font-medium block">Pakaian, Kostum &amp; Budaya Visual:</span>
                          <p className="text-zinc-300">{foundation.research_era_context.clothing_costumes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sources Registry with classifications */}
                {Array.isArray(foundation.research_sources) && foundation.research_sources.length > 0 && (
                  <div className="bg-[#05060A]/40 rounded-xl p-3 border border-zinc-800/40 space-y-2">
                    <span className="text-[10px] font-bold text-cyan-400 font-mono uppercase tracking-wider block">
                      📚 VERIFIKASI SUMBER &amp; KREDIBILITAS:
                    </span>
                    <div className="space-y-2">
                      {foundation.research_sources.map((src, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3 text-xs bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/60">
                          <div>
                            <span className="font-extrabold text-zinc-200">{src.source_name}</span>
                            {src.description && <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{src.description}</p>}
                          </div>
                          <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded border shrink-0 ${
                            src.category === 'FACT' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                            src.category === 'LEGEND' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                            'bg-purple-500/10 text-purple-300 border-purple-500/20'
                          }`}>
                            {src.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TAHAP 2: STORY ARCHITECT 5-ACTS */}
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span>🏗️ TAHAP 2: STORY ARCHITECT (5-ACT CINEMATIC FLOW)</span>
                  </h3>
                  <span className="text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded">
                    Human-Centered Narrative
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Act 1 World Setup */}
                  {foundation.act_1_world_setup && (
                    <div className="bg-zinc-950/60 border-l-4 border-blue-500/40 p-4 rounded-r-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider font-mono">
                          ACT 1: DUNIA SEBELUM PERUBAHAN
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">Eksposisi Atmosfer</span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                        {foundation.act_1_world_setup.description}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-[10px] border-t border-zinc-800/40">
                        <div className="space-y-0.5">
                          <span className="text-zinc-500 font-mono font-bold block">🎥 ARTI VISUAL:</span>
                          <span className="text-zinc-300 italic">{foundation.act_1_world_setup.visual_guide}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-zinc-500 font-mono font-bold block">🔊 DESAIN AUDIO:</span>
                          <span className="text-zinc-300 italic">{foundation.act_1_world_setup.audio_guide}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Act 2 Human Element */}
                  {foundation.act_2_human_element && (
                    <div className="bg-zinc-950/60 border-l-4 border-amber-500/40 p-4 rounded-r-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider font-mono">
                          ACT 2: MANUSIA DI BALIK SEJARAH
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">Mata &amp; Perjuangan Karakter</span>
                      </div>
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-zinc-500 font-semibold">Fokus Kedalaman Karakter:</span>
                          <p className="text-zinc-200 leading-relaxed">{foundation.act_2_human_element.character_focus}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold text-amber-400">Konflik Batin &amp; Psikologis:</span>
                          <p className="text-zinc-300 leading-relaxed">{foundation.act_2_human_element.internal_feelings}</p>
                        </div>
                        {foundation.act_2_human_element.early_education_struggle && (
                          <div>
                            <span className="text-zinc-500 font-semibold text-slate-400">Pendidikan &amp; Perjuangan Awal:</span>
                            <p className="text-zinc-300 leading-relaxed italic">{foundation.act_2_human_element.early_education_struggle}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Act 3 Rising Conflict */}
                  {foundation.act_3_rising_conflict && (
                    <div className="bg-zinc-950/60 border-l-4 border-rose-500/40 p-4 rounded-r-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider font-mono">
                          ACT 3: KONFLIK &amp; PERCEPATAN TEMPO
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">Tensi, Politik &amp; Tekanan</span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                        {foundation.act_3_rising_conflict.tension_type}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-[10px] border-t border-zinc-800/40">
                        <div className="space-y-0.5">
                          <span className="text-rose-400 font-mono font-bold block">🎥 TEMPO VISUAL (KAMERA LEBIH CEPAT):</span>
                          <span className="text-zinc-300 italic">{foundation.act_3_rising_conflict.tempo_visual_note}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-rose-400 font-mono font-bold block">🔊 TEMPO AUDIO (SOUND LEBIH BERAT):</span>
                          <span className="text-zinc-300 italic">{foundation.act_3_rising_conflict.tempo_audio_note}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Act 4 Climax Breath */}
                  {foundation.act_4_climax_breath && (
                    <div className="bg-zinc-950/60 border-l-4 border-purple-500/40 p-4 rounded-r-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-purple-400 uppercase tracking-wider font-mono">
                          ACT 4: KLIMAKS &amp; KONTRAS KEBISUAN (BREATH)
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">Jeda Sunyi Sebelum Benturan</span>
                      </div>
                      <div className="text-xs space-y-1.5">
                        <div className="bg-purple-950/20 border border-purple-500/10 p-2.5 rounded-lg space-y-1">
                          <span className="text-[9px] text-purple-300 font-black block uppercase tracking-wide font-mono">
                            ⏳ JEDA SUNYI / THE BREATH BEFORE ACTION:
                          </span>
                          <p className="text-zinc-200 italic">"{foundation.act_4_climax_breath.silent_before_climax}"</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold block">Dampak &amp; Benturan Klimaks:</span>
                          <p className="text-zinc-300">{foundation.act_4_climax_breath.climax_impact}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold block">Desain Kontras Dinamika Audio:</span>
                          <p className="text-zinc-400 text-[11px] italic">{foundation.act_4_climax_breath.audio_contrast_guide}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Act 5 Legacy Meaning */}
                  {foundation.act_5_legacy_meaning && (
                    <div className="bg-zinc-950/60 border-l-4 border-emerald-500/40 p-4 rounded-r-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider font-mono">
                          ACT 5: MAKNA &amp; RESONANSI HATI (LEGACY)
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">Warisan Bagi Kemanusiaan</span>
                      </div>
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-zinc-500 font-semibold">Resonansi Makna Terdalam:</span>
                          <p className="text-zinc-200 font-serif leading-relaxed italic">"{foundation.act_5_legacy_meaning.deeper_meaning}"</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold">Pesan bagi Generasi Penerus:</span>
                          <p className="text-zinc-300 leading-relaxed">{foundation.act_5_legacy_meaning.message_for_posterity}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Assets, Visuals & Islamic Protocols */}
            <div className="space-y-6">
              
              {/* ISLAMIC PROTECTIONS BAR */}
              {foundation.islamic_validation_safeguard && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>🕌 PROTOKOL KISAH ISLAMI</span>
                  </h3>
                  
                  <div className="space-y-3.5 text-xs text-slate-200">
                    <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/30">
                      <span className="text-[8px] text-emerald-400 font-mono font-black block tracking-widest uppercase">
                        STATUS PROTOKOL HORMAT TOKOH:
                      </span>
                      <p className="font-extrabold text-[11px] text-emerald-300 flex items-center gap-1.5 mt-0.5">
                        <span>✔ REVERENCE PROTOCOL ACTIVE</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-bold block">Catatan Validasi Sejarah/Sirah:</span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{foundation.islamic_validation_safeguard.fact_validation_notes}</p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-emerald-500/10">
                      <span className="text-[10px] text-zinc-400 font-bold block">Proteksi Kebocoran Ucapan / Dialog Palsu:</span>
                      <p className="text-[11px] text-slate-300 leading-relaxed italic">"{foundation.islamic_validation_safeguard.forbidden_dialogue_safeguards}"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Tone & Atmosphere Card */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  Arah Visual &amp; Nuansa
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 italic font-serif">
                  "{foundation.visual_tone}"
                </p>
                <div>
                  <span className="text-xs font-semibold text-zinc-400 block mb-2">Tokoh Utama Terdeteksi:</span>
                  <div className="flex flex-wrap gap-2">
                    {(foundation.main_characters || []).map((char, cIdx) => (
                      <span key={`main-char-${char}-${cIdx}`} className="text-xs px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
                {foundation.supporting_characters && foundation.supporting_characters.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-zinc-400 block mb-2">Tokoh Pendukung:</span>
                    <div className="flex flex-wrap gap-2">
                      {foundation.supporting_characters.map((char, scIdx) => (
                        <span key={`sup-char-${char}-${scIdx}`} className="text-xs px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Story Timeline Scope Card */}
              {Array.isArray(foundation.research_timeline) && foundation.research_timeline.length > 0 && (
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    Timeline &amp; Garis Waktu
                  </h3>
                  <div className="relative pl-4 border-l border-zinc-700 space-y-4">
                    {foundation.research_timeline.map((tm, idx) => (
                      <div key={idx} className="relative text-xs">
                        {/* Chrono Dot */}
                        <div className="absolute -left-[21.5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-zinc-900" />
                        <span className="font-extrabold text-indigo-400 block font-mono text-[10px] uppercase">{tm.time_marker}</span>
                        <p className="text-zinc-300 mt-0.5 leading-relaxed">{tm.event_description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5-Beat Narrative Beats Map Fallback if the detailed 5-act is not shown */}
          {!foundation.act_1_world_setup && foundation.narrative_beats && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Peta Struktur Naratif 5-Babak Global (Tahap 4)
              </h3>
              <div className="space-y-4">
                {[
                  {
                    act: 'Babak I: Awal (Beginning)',
                    subtitle: 'Eksposisi & Pemicu Konflik',
                    text: foundation.narrative_beats.beginning,
                    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                  },
                  {
                    act: 'Babak II: Perkembangan (Development)',
                    subtitle: 'Aksi Meningkat & Konflik Meruncing',
                    text: foundation.narrative_beats.development,
                    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  },
                  {
                    act: 'Babak III: Klimaks (Climax)',
                    subtitle: 'Titik Puncak Ketegangan Dramatis',
                    text: foundation.narrative_beats.climax,
                    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
                  },
                  {
                    act: 'Babak IV: Konsekuensi (Consequence)',
                    subtitle: 'Penurunan Aksi & Dampak Langsung',
                    text: foundation.narrative_beats.consequence,
                    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                  },
                  {
                    act: 'Babak V: Akhir (Ending)',
                    subtitle: 'Resolusi & Resonansi Pesan Tematik',
                    text: foundation.narrative_beats.ending,
                    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                  },
                ].map((item) => (
                  <div key={item.act} className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${item.badge}`}>
                        {item.act}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">{item.subtitle}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHARACTER BIBLE */}
      {activeTab === 'characters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Bible Karakter & Tokoh ({characters.length} Karakter)
            </h3>
            <span className="text-xs text-zinc-400">
              Koleksi <code className="font-mono text-amber-400">characters</code> • Auto-merged v1
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map((char) => (
              <div
                key={char.id || char.name}
                className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3.5 backdrop-blur shadow-sm hover:border-zinc-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      {char.name}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        v{char.version}
                      </span>
                    </h4>
                    <p className="text-xs text-amber-400 font-medium mt-0.5">
                      {char.gender} • Usia: {char.age}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {char.face_identity_locked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        <Lock className="w-3 h-3" /> Wajah Terkunci
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                        <Unlock className="w-3 h-3" /> Standar
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-400 block font-semibold">Ciri Fisik & Wajah:</span>
                    <p className="text-zinc-200 leading-relaxed">{char.physical_appearance}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                    <div>
                      <span className="text-zinc-400 block">Rambut:</span>
                      <span className="text-zinc-200">{char.hair}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Jenggot / Kumis:</span>
                      <span className="text-zinc-200">{char.beard || 'Tidak Ada'}</span>
                    </div>
                  </div>

                  {char.clothing && (
                    <div>
                      <span className="text-zinc-400 block font-semibold mb-1">Pakaian & Kostum Era:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(char.clothing) ? (
                          char.clothing.map((item, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                            {String(char.clothing)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {char.accessories && (
                    <div>
                      <span className="text-zinc-400 block font-semibold mb-1">Aksesoris & Properti:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(char.accessories) ? (
                          char.accessories.map((acc, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-zinc-800/80 text-amber-300 text-[11px] border border-amber-500/20">
                              {acc}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-amber-300 text-[11px] border border-amber-500/20">
                            {String(char.accessories)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                    <div>
                      <span className="text-zinc-400 block font-semibold">Kepribadian & Motif:</span>
                      <p className="text-zinc-300">{char.personality}</p>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-semibold">Karakter Suara & Gaya Gerak:</span>
                      <p className="text-zinc-300">
                        <strong className="text-zinc-400">Suara:</strong> {char.voice_character} <br />
                        <strong className="text-zinc-400">Gaya Gerak:</strong> {char.movement_style}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LOCATIONS & PROPS */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Locations */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Bible Lokasi Set ({locations.length} Lokasi)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id || loc.name}
                  className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-zinc-100">{loc.name}</h4>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-300">
                      Era: {loc.era}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-zinc-400 block font-semibold">Arsitektur & Struktur:</span>
                      <p className="text-zinc-200 leading-relaxed">{loc.architecture}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                      <div>
                        <span className="text-zinc-400 block">Lingkungan:</span>
                        <span className="text-zinc-200">{loc.environment}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">Iklim & Atmosfer:</span>
                        <span className="text-zinc-200">{loc.climate}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400 block font-semibold">Gaya Pencahayaan:</span>
                      <p className="text-zinc-300 leading-relaxed">{loc.lighting_style}</p>
                    </div>

                    {loc.color_palette && loc.color_palette.length > 0 && (
                      <div>
                        <span className="text-zinc-400 block font-semibold mb-1">Palet Warna Utama:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {loc.color_palette.map((color, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px] border border-zinc-700"
                            >
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-zinc-400 block font-semibold">Material Utama:</span>
                      <p className="text-zinc-300">{loc.material}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Objects / Props */}
          {objects.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Objek Kunci & Properti Kontinuitas ({objects.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {objects.map((obj) => (
                  <div
                    key={obj.id || obj.name}
                    className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-100">{obj.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {obj.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{obj.description}</p>
                    <div className="pt-2 border-t border-zinc-800/80">
                      <span className="text-[11px] font-semibold text-amber-400/90 block">
                        Aturan Kontinuitas:
                      </span>
                      <p className="text-[11px] text-zinc-400 italic">{obj.continuity_notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SCENE BREAKDOWN & TIMELINE (STAGES 5-8) */}
      {activeTab === 'scenes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Urutan Master Adegan, Shot & Visual ({scenes.length} Adegan)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Alokasi presisi toleransi 0 dtk dengan Master Frame Nano Banana Pro, Rincian Shot & Garis Waktu Prompt Video.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Total: {totalCalculatedDuration} dtk === {project.total_duration_target_sec} dtk
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {scenes.map((scene) => {
              const sceneShots = (scene.id && shots[scene.id]) || [];
              return (
                <SceneCard
                  key={scene.id || scene.scene_number}
                  scene={scene}
                  project={project}
                  shots={sceneShots}
                  videoPrompts={videoPrompts}
                  onRunScenePipeline={onRunScenePipeline}
                  onRegenerateScenePrompt={onRegenerateScenePrompt}
                  onUpdateSceneImage={onUpdateSceneImage}
                  onUpdateShotImage={onUpdateShotImage}
                  isProcessingPipeline={processingSceneId === scene.id}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

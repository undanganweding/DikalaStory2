import React, { useState } from 'react';
import {
  Film,
  Clock,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  MapPin,
  Users,
  Upload,
  Copy,
  Check,
  Layers,
  PlaySquare,
  Maximize2,
  Volume2,
  MessageSquare,
  ArrowRight,
  Eye,
  Camera,
  ChevronRight,
  ChevronDown,
  Info,
  Video,
} from 'lucide-react';
import {
  Scene,
  Shot,
  VideoPrompt,
  CharacterBible,
  LocationBible,
  ObjectBible,
  PromptTarget,
  PromptLockState,
} from '../../types';
import {
  getPersistedScenePrompt,
  PersistedPrompt,
} from '../../lib/prompt_targets';
import { DenseShotRow } from './DenseShotRow';
import { CompactShotRow } from './CompactShotRow';
import { CompactShotCockpit } from './CompactShotCockpit';
import { FocusWindow } from './FocusWindow';
import { getDetailedHolyFigurePromptAndNegative, getDynamicNegativePrompt } from '../workspaces/AssetBibleWorkspace';
import { useWindowManager } from '../../context/WindowManagerContext';

export interface StoryboardSceneBreakdownProps {
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  videoPrompts?: Record<string, VideoPrompt[]>;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
  selectedSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  selectedShotId?: string;
  onSelectShot?: (shotId: string) => void;
  onRunScenePipeline: (sceneId: string) => void;
  onRegenerateScenePrompt: (sceneId: string) => void;
  onUpdateSceneImage: (sceneId: string, imageUrl: string | null) => void;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void;
  onRunShotPrompt?: (shotId: string, target: PromptTarget) => void;
  onSmartRegenerate?: (
    shotId: string,
    target: PromptTarget,
    lockState?: PromptLockState,
    reason?: string,
    requireAi?: boolean
  ) => void;
  processingSceneId: string | null;
  processingShotId?: string | null;
  shotPromptError?: Record<string, string>;
  isUnified?: boolean; // NEW PROP
}

export const StoryboardSceneBreakdown: React.FC<StoryboardSceneBreakdownProps> = ({
  scenes,
  shots,
  videoPrompts = {},
  characters = [],
  locations = [],
  objects = [],
  selectedSceneId,
  onSelectScene,
  selectedShotId,
  onSelectShot,
  onRunScenePipeline,
  onRegenerateScenePrompt,
  onUpdateSceneImage,
  onUpdateShotImage,
  onRunShotPrompt,
  onSmartRegenerate,
  processingSceneId,
  processingShotId,
  shotPromptError = {},
  isUnified = false, // NEW PROP
}) => {
  const { openWindow } = useWindowManager();
  const [activeSceneId, setActiveSceneId] = useState<string>(
    selectedSceneId || (scenes.length > 0 ? scenes[0].id : '')
  );
  const [activeShotSelection, setActiveShotSelection] = useState<string | null>(
    selectedShotId || null
  );

  // Focus Window Modals
  const [isSceneFocusOpen, setIsSceneFocusOpen] = useState(false);
  const [isMasterPromptFocusOpen, setIsMasterPromptFocusOpen] = useState(false);

  // Image editing states
  const [isEditingSceneImage, setIsEditingSceneImage] = useState(false);
  const [sceneImageUrlInput, setSceneImageUrlInput] = useState('');

  // Copy indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sub-tabs: 'breakdown' | 'assets'
  const [activeTab, setActiveTab] = useState<'breakdown' | 'assets'>('breakdown');

  // Synchronize when external selection changes
  React.useEffect(() => {
    if (selectedSceneId && selectedSceneId !== activeSceneId) {
      setActiveSceneId(selectedSceneId);
      setActiveShotSelection(null);
    }
  }, [selectedSceneId]);

  React.useEffect(() => {
    setActiveShotSelection(null);
  }, [activeSceneId]);

  React.useEffect(() => {
    if (selectedShotId !== undefined) {
      setActiveShotSelection(selectedShotId);
    }
  }, [selectedShotId]);

  const currentScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
  const isSceneCentric = !!currentScene?.timeline;
  const isUnifiedUI = isUnified || isSceneCentric;
  const currentShots = currentScene ? shots[currentScene.id] || [] : [];
  const resolvedActiveShotId = activeShotSelection || (currentShots.length > 0 ? (currentShots[0].id || `shot-${currentScene.id}-0`) : null);
  const isProcessing = processingSceneId === currentScene?.id;

  // Timeline calculation
  const shotsTotalDuration = currentShots.reduce((acc, sh) => acc + (sh.duration_sec || 0), 0);
  const sceneAuthoritativeDuration = currentScene?.duration_sec || 10;
  const isDurationBalanced = Math.abs(shotsTotalDuration - sceneAuthoritativeDuration) < 0.1;

  // Copy handler
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * Scene-level `banana_master_frame` read path.
   */
  const readScenePrompt = (sc: Scene): PersistedPrompt => {
    const persisted = getPersistedScenePrompt(sc);
    if (persisted.hasPrompt) return persisted;

    const json = sc.master_image_prompt_json;
    if (json) {
      return {
        state: 'ready',
        text: `${json.subject || ''}. Location: ${json.location || ''}. Lighting: ${json.lighting || ''}. Style: ${json.cinematic_style || ''}`,
        hasPrompt: true,
        resolvedDurationSec: 10,
        row: null,
      };
    }
    return persisted;
  };

  /**
   * Build global video prompt for the scene (combines all shots into a continuous shot sequence with durations).
   */
  const buildGlobalSceneVideoPrompt = (sc: Scene, scShots: Shot[]): string => {
    const scNumStr = String(sc.scene_number || 1).padStart(2, '0');
    const totalDuration = scShots.reduce((acc, s) => acc + (s.duration_sec || 5), 0);
    const locName = sc.location_name || 'Historical Setting';
    const purpose = sc.story_purpose || sc.narrative_function || sc.event || 'Pengembangan narasi adegan sinematik.';

    let shotBreakdowns = scShots
      .map((sh, idx) => {
        const shotNumStr = String(sh.shot_number || idx + 1).padStart(2, '0');
        const durSec = sh.duration_sec || 5;
        const framing = sh.shot_type || sh.camera?.framing || 'Medium Shot';
        const cameraMove = sh.camera_movement || sh.camera?.movement || 'Static';
        const visual = sh.visual_description || sh.character_action || sh.event_detail || sh.action || 'Cinematic action';
        const voStr = sh.audio_narration ? `\n  Audio/Narration: "${sh.audio_narration}"` : '';
        const dialogueStr = sh.dialogue ? `\n  Dialogue: "${sh.dialogue}"` : '';

        return `• SHOT ${shotNumStr} [Duration: ${durSec}.0s | Framing: ${framing} | Camera: ${cameraMove}]\n  Visual Action: ${visual}${voStr}${dialogueStr}`;
      })
      .join('\n\n');

    if (!shotBreakdowns) {
      shotBreakdowns = `• SHOT 01 [Duration: 10.0s | Framing: Master Shot | Camera: Panning]\n  Visual Action: ${sc.event || sc.narrative_function || 'Cinematic sequence'}`;
    }

    const textCtx = `${sc.title || ''} ${sc.event || ''} ${sc.location_name || ''}`;
    const sceneNeg = getDynamicNegativePrompt(textCtx, 'global video scene', 'character');

    return `[GLOBAL CINEMATIC VIDEO PROMPT - SCENE ${scNumStr}: ${(sc.title || 'ADEGAN').toUpperCase()}]
TOTAL SCENE DURATION: ${totalDuration}.0s | SEQUENCE: ${scShots.length} SHOTS | ENGINE: UNIVERSAL VIDEO (VEO/SEADANCE/OMNI)
LOCATION & ENVIRONMENT: ${locName}
DRAMATIC PURPOSE: ${purpose}

CONTINUOUS SHOT TIMELINE SEQUENCE:
${shotBreakdowns}

[NEGATIVE PROMPT / PROMPT LARANGAN]
${sceneNeg}`;
  };

  // Narrative VO & Dialogue summaries for active scene
  const sceneVOItems = currentShots
    .map((sh) => sh.audio_narration)
    .filter((vo): vo is string => Boolean(vo && vo.trim().length > 0));
  const hasDialogue = currentShots.some((sh) => sh.dialogue && sh.dialogue.length > 0);

  // Characters & Locations related to active scene
  const sceneCharacters = characters.filter((c) =>
    c?.name &&
    currentScene?.character_names?.some((name) =>
      name && name.toLowerCase().includes((c.name || '').toLowerCase())
    )
  );
  const sceneLocations = locations.filter((l) =>
    currentScene?.location_name && l?.name
      ? currentScene.location_name.toLowerCase().includes(l.name.toLowerCase())
      : false
  );

  const getCharacterBananaPrompt = (c: CharacterBible) => {
    if (c.master_portrait_prompt && c.master_portrait_prompt.trim().length > 0)
      return c.master_portrait_prompt;
    const desc = c.physical_description || c.physical_appearance || 'historical figure';
    const clothingStr = Array.isArray(c.clothing) ? c.clothing.filter(Boolean).join(', ') : (typeof c.clothing === 'string' ? c.clothing : '');
    let costume =
      c.costume || c.wardrobe || (clothingStr.length > 0 ? clothingStr : 'historical garments');
    
    const nameLower = c.name.toLowerCase();
    const isHoly = nameLower.includes('sunan') || nameLower.includes('wali') || nameLower.includes('kyai') || nameLower.includes('habib') || nameLower.includes('ulama') || nameLower.includes('syekh') || nameLower.includes('sheikh') || nameLower.includes('nabi') || nameLower.includes('rasul') || nameLower.includes('ustadz');

    if (isHoly && (costume.length < 15 || costume.toLowerCase().includes('t-shirt') || costume.toLowerCase().includes('kaos') || costume.toLowerCase().includes('casual'))) {
      if (nameLower.includes('ampel') || nameLower.includes('raden rahmat')) {
        costume = 'Pristine layered white/ivory fine linen Sufi Imamah (Sorban Putih), noble flowing white/ivory Sufi Jubah (Gamis) outer robe of hand-woven linen cloth, draped emerald-green or white Rida\' shoulder shawl, wooden tasbih prayer beads';
      } else if (nameLower.includes('kalijaga') || nameLower.includes('raden said') || nameLower.includes('jawa')) {
        costume = 'Authentic Javanese noble Wali attire (Surjan Lurik Demak/Mataram or Baju Taqwa Wali in dark brown/black), traditional Blangkon Jawi headgear (Mondokan), fine Jarik Batik Parang Barong sarong skirt, stagen sash';
      } else if (nameLower.includes('giri') || nameLower.includes('raden paku')) {
        costume = 'Regal ruler-scholar Turban (Sorban Putih/Krem dengan hiasan emas), majestic deep green or white Jubah outer robe, Jarik Batik sarong skirt, golden stagen belt';
      } else if (nameLower.includes('gunung jati') || nameLower.includes('cirebon')) {
        costume = 'Magnificent Cirebon Sultanate royal Wali costume (green/white layered Turban with gold emblem), opulent Bisht/Jubah cloak with gold thread embroidery, Cirebon Batik Megamendung sarong';
      } else {
        costume = 'Majestic layered Islamic Sufi Turban (Imamah / Sorban Putih, Hijau, atau Krem), noble flowing outer Robe (Jubah / Abaya / Bisht / Gamis Sufi), draped shoulder sash (Rida\')';
      }
    }

    const holyBonus = isHoly ? ', dignified charismatic facial expression, serene radiant aura of spiritual wisdom and sacred wibawa, well-groomed honorable beard' : '';
    const holyNeg = isHoly ? ', no t-shirt, no undershirt, no casual villager clothes' : '';

    return `Photorealistic cinematic master portrait of ${c.name}, ${desc}${holyBonus}, wearing ${costume}, 8k resolution, cinematic lighting, 85mm portrait lens --no modern clothes${holyNeg}, no distortion`;
  };

  const getLocationBananaPrompt = (l: LocationBible) => {
    if (l.master_environment_prompt && l.master_environment_prompt.trim().length > 0)
      return l.master_environment_prompt;
    const arch = l.architectural_style || l.architecture || 'period architecture';
    const env = l.environment || l.landscape || l.description || 'historical landscape';
    return `Cinematic wide master shot of ${l.name}, ${arch}, ${env}, 8k ultra-detailed, photorealistic, 35mm anamorphic lens --no modern buildings`;
  };

  if (scenes.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 max-w-lg mx-auto space-y-4">
        <Film className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-lg font-bold text-slate-300">Belum Ada Adegan Terstruktur</h3>
        <p className="text-xs text-slate-400">
          Struktur babak dan pembagian adegan sinematik akan muncul di sini setelah pipeline Stage 5 selesai.
        </p>
      </div>
    );
  }

  return (
    <div id="storyboard-scene-breakdown-view" className="space-y-4 animate-in fade-in duration-200">
      {/* 1. SCENE SELECTOR: MOBILE HORIZONTAL SWIPE CARDS & DESKTOP GRID */}
      {/* Mobile Horizontal Swipe Track */}
      <div className="md:hidden flex overflow-x-auto gap-2.5 pb-2 pt-1 px-0.5 snap-x scrollbar-none select-none">
        {scenes.map((sc, idx) => {
          const isSelected = sc.id === activeSceneId;
          const scShots = shots[sc.id] || [];

          return (
            <div
              key={sc.id}
              onClick={() => {
                setActiveSceneId(sc.id);
                if (onSelectScene) onSelectScene(sc.id);
              }}
              className={`w-[220px] shrink-0 snap-start p-3 rounded-2xl text-left transition border cursor-pointer min-h-[48px] flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-[#1C1E38] to-[#14162B] border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                  : 'bg-[#0D0F1A] border-[#1E2238] active:bg-[#16182C]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                  isSelected ? 'bg-indigo-500 text-white shadow-sm' : 'bg-[#181A2A] text-slate-300'
                }`}>
                  SC-{String(sc.scene_number || idx + 1).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                  {sc.duration_sec || 0}s
                </span>
              </div>
              <div className="text-xs font-bold text-slate-100 truncate mb-1">
                {sc.title || `Adegan ${sc.scene_number}`}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="truncate max-w-[120px]">{sc.location_name || 'Latar Umum'}</span>
                <span className="text-indigo-400 font-bold">{scShots.length} SH</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Grid (>= 768px / 1024px) */}
      <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 gap-2">
        {scenes.map((sc, idx) => {
          const isSelected = sc.id === activeSceneId;
          const scShots = shots[sc.id] || [];

          return (
            <button
              key={sc.id}
              onClick={() => {
                setActiveSceneId(sc.id);
                if (onSelectScene) onSelectScene(sc.id);
              }}
              onDoubleClick={() =>
                  openWindow({
                    id: `scene-${sc.id}`,
                    type: 'scene_detail',
                    title: `Adegan ${sc.scene_number}: ${sc.title || 'Scene Breakdown'}`,
                    subtitle: sc.location_name || 'Breakdown & Master Prompts',
                    data: sc,
                  })
              }
              className={`p-2 rounded-xl text-left transition border ${
                isSelected
                  ? 'bg-[#1C1E34] border-indigo-500/50'
                  : 'bg-[#0D0F1A] border-[#1E2238] hover:bg-[#16182C]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-[10px] font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                    SC-{String(sc.scene_number || idx + 1).padStart(2, '0')}
                  </span>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </div>
              <div className="text-[11px] font-bold text-slate-200 truncate mb-0.5">{sc.title || 'Untitled'}</div>
              <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                  <span>{sc.duration_sec || 0}s</span>
                  <span>{scShots.length} SH</span>
              </div>
            </button>
          );
        })}
      </div>

      {currentScene && (
        <>
          {/* 2. SCENE TOP COMMAND & NARRATIVE HEADER */}
          <div className="bg-[#0F131E] border border-[#21253C] rounded-2xl p-3 sm:p-5 shadow-lg space-y-3 sm:space-y-4">
            {/* Header Title Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2238] pb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] font-mono uppercase text-amber-400 font-bold">
                  <span className="bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/25">SCENE {String(currentScene.scene_number).padStart(2, '0')}</span>
                  <span>•</span>
                  <span className="truncate max-w-[150px] sm:max-w-xs">{currentScene.location_name || 'Latar Sinematik'}</span>
                  <span>•</span>
                  <span>{currentScene.time_of_day || 'Day'}</span>
                  <span>•</span>
                  <span className="text-indigo-300 font-bold">{sceneAuthoritativeDuration}s</span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-white truncate mt-1">
                  {currentScene.title || `Adegan ${currentScene.scene_number}`}
                </h2>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() =>
                    openWindow({
                      id: `scene-${currentScene.id}`,
                      type: 'scene_detail',
                      title: `Adegan ${currentScene.scene_number}: ${currentScene.title || 'Scene Breakdown'}`,
                      subtitle: currentScene.location_name || 'Breakdown & Master Prompts',
                      data: currentScene,
                    })
                  }
                  className="min-h-[36px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs bg-[#1C1E32] hover:bg-[#252844] border border-[#2B2E4A] text-slate-200 font-semibold transition flex items-center gap-1.5"
                  title="Buka Floating Window Adegan"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Window</span>
                </button>

                <button
                  onClick={() =>
                    handleCopy(readScenePrompt(currentScene).text, `sc-master-${currentScene.id}`)
                  }
                  disabled={!readScenePrompt(currentScene).hasPrompt}
                  className="min-h-[36px] sm:min-h-[30px] px-2.5 py-1.5 bg-[#1C1E32] hover:bg-[#252844] text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Salin Master Banana Image Prompt 1-Klik"
                >
                  {copiedId === `sc-master-${currentScene.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>
                    {copiedId === `sc-master-${currentScene.id}` ? 'Tersalin!' : 'Salin Banana'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    const globalVideoPrompt = buildGlobalSceneVideoPrompt(currentScene, currentShots);
                    handleCopy(globalVideoPrompt, `sc-video-global-${currentScene.id}`);
                  }}
                  className="min-h-[36px] sm:min-h-[30px] px-2.5 py-1.5 bg-[#1C1E32] hover:bg-[#252844] text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  title="Salin Prompt Video Global Adegan Ini (Gabungan Seluruh Shot Berdurasi)"
                >
                  {copiedId === `sc-video-global-${currentScene.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>
                    {copiedId === `sc-video-global-${currentScene.id}` ? 'Tersalin!' : 'Salin Video'}
                  </span>
                </button>

                <button
                  onClick={() => onRegenerateScenePrompt(currentScene.id)}
                  disabled={isProcessing}
                  className="min-h-[36px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs bg-[#1C1E32] hover:bg-[#252844] border border-[#2B2E4A] text-slate-200 font-semibold transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>Regen</span>
                </button>

                <button
                  onClick={() => onRunScenePipeline(currentScene.id)}
                  disabled={isProcessing}
                  className="min-h-[36px] sm:min-h-[30px] px-3 py-1.5 rounded-lg text-xs bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Proses...' : 'Pipeline'}</span>
                </button>
              </div>
            </div>

            {/* 3. SCENE NARRATIVE SPECIFICATION TILES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {/* Story Beat Tile */}
              <div className="md:col-span-2 bg-[#121424] border border-[#1F233B] p-3 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-amber-400/90 font-bold">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>Story Beat &amp; Dramatic Purpose</span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">
                  {currentScene.story_purpose ||
                    currentScene.narrative_function ||
                    currentScene.event ||
                    'Pengembangan narasi adegan.'}
                </p>
              </div>

              {/* Characters Present Tile */}
              <div className="bg-[#121424] border border-[#1F233B] p-3 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-indigo-400/90 font-bold">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Karakter / Tokoh</span>
                </div>
                {currentScene.character_names && currentScene.character_names.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {currentScene.character_names.map((name, nIdx) => (
                      <span
                        key={nIdx}
                        className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-[10px] font-medium"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 italic text-[11px]">—</div>
                )}
              </div>

              {/* Visual Direction & Audio Summary */}
              <div className="bg-[#121424] border border-[#1F233B] p-3 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-cyan-400/90 font-bold">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Visual &amp; Audio</span>
                </div>
                <div className="text-[10px] text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pencahayaan:</span>
                    <span className="text-slate-200">{currentScene.lighting || 'Cinematic Natural'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Narasi (VO):</span>
                    <span className={sceneVOItems.length > 0 ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                      {sceneVOItems.length > 0 ? `${sceneVOItems.length} Narasi ✓` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Dialog:</span>
                    <span className={hasDialogue ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                      {hasDialogue ? 'Dialog Ada ✓' : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Master Frame Canvas & Master Prompt */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Master Frame Thumbnail */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-[#212338] flex items-center justify-center group shadow-md">
                {currentScene.master_frame_image_url ? (
                  <img
                    src={currentScene.master_frame_image_url}
                    alt={currentScene.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="p-3 text-center text-slate-600 space-y-1.5">
                    <ImageIcon className="w-6 h-6 mx-auto text-slate-500 opacity-60" />
                    <span className="text-[10px] font-mono text-slate-500 block">Belum ada Master Frame</span>
                  </div>
                )}
                <button
                  onClick={() => setIsEditingSceneImage(!isEditingSceneImage)}
                  className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/85 hover:bg-black text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1 shadow-md transition"
                >
                  <Upload className="w-3 h-3 text-amber-400" />
                  {currentScene.master_frame_image_url ? 'Ganti Frame' : 'URL Frame'}
                </button>
              </div>

              {/* Master Banana Image Prompt Box */}
              <div className="md:col-span-2 bg-[#121424] border border-[#212338] rounded-xl p-3 flex flex-col justify-between space-y-2 shadow-md">
                <div className="flex items-center justify-between border-b border-[#1E2034] pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Google Banana Pro Master Frame Prompt</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const globalVideoPrompt = buildGlobalSceneVideoPrompt(currentScene, currentShots);
                        handleCopy(globalVideoPrompt, `box-video-global-${currentScene.id}`);
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center gap-1 transition"
                      title="Salin Prompt Video Global Adegan Ini (Gabungan Seluruh Shot Berdurasi)"
                    >
                      {copiedId === `box-video-global-${currentScene.id}` ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Video className="w-2.5 h-2.5 text-indigo-400" />
                      )}
                      <span>{copiedId === `box-video-global-${currentScene.id}` ? 'Tersalin!' : 'Salin Video Scene'}</span>
                    </button>
                    <button
                      onClick={() => setIsMasterPromptFocusOpen(true)}
                      disabled={!readScenePrompt(currentScene).hasPrompt}
                      className="px-2 py-0.5 rounded bg-[#1C1E32] hover:bg-[#252844] text-slate-300 hover:text-white text-[10px] font-mono flex items-center gap-1 transition border border-[#2B2E4A] disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Buka Prompt di Focus Window"
                    >
                      <Maximize2 className="w-2.5 h-2.5" />
                      <span>Focus</span>
                    </button>
                    <button
                      onClick={() => handleCopy(readScenePrompt(currentScene).text, `box-${currentScene.id}`)}
                      disabled={!readScenePrompt(currentScene).hasPrompt}
                      className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {copiedId === `box-${currentScene.id}` ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                      <span>{copiedId === `box-${currentScene.id}` ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <p
                  className={`font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all bg-[#090A14] p-2.5 rounded-lg border border-[#1A1C2E] flex-1 max-h-24 overflow-y-auto ${
                    readScenePrompt(currentScene).hasPrompt ? 'text-slate-300' : 'text-slate-500 italic'
                  }`}
                >
                  {readScenePrompt(currentScene).text}
                </p>
              </div>
            </div>

            {/* Edit Scene Image Drawer */}
            {isEditingSceneImage && (
              <div className="p-3 bg-[#141628] border border-amber-500/30 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-amber-300">
                    Upload Master Frame Adegan #{currentScene.scene_number}
                  </span>
                  <button
                    onClick={() => setIsEditingSceneImage(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Batal
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="url"
                    value={sceneImageUrlInput}
                    onChange={(e) => setSceneImageUrlInput(e.target.value)}
                    placeholder="Tempel URL gambar Master Frame (https://...)"
                    className="flex-1 bg-[#0D0F1C] border border-[#262842] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <label className="px-3 py-1.5 bg-[#20243C] hover:bg-[#2B3152] text-amber-300 text-xs font-mono font-bold rounded-lg border border-amber-500/30 cursor-pointer flex items-center gap-1 shrink-0 transition">
                    <Upload className="w-3 h-3" />
                    <span>Pilih File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = (rev) => {
                            if (rev.target?.result) {
                              onUpdateSceneImage(currentScene.id, rev.target.result as string);
                              setIsEditingSceneImage(false);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      onUpdateSceneImage(currentScene.id, sceneImageUrlInput.trim() || null);
                      setIsEditingSceneImage(false);
                      setSceneImageUrlInput('');
                    }}
                    disabled={!sceneImageUrlInput.trim()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-40"
                  >
                    Simpan URL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. SUBDIVISI SHOT TIMELINE BAR */}
          {!isUnifiedUI && (
            <div className="bg-[#0F131E] border border-[#21253C] rounded-2xl p-3.5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-200">
                    Timeline Subdivisi Shot ({sceneAuthoritativeDuration}s)
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isDurationBalanced
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  Shot Subdivisi: {shotsTotalDuration.toFixed(1)}s / {sceneAuthoritativeDuration.toFixed(1)}s{' '}
                  {isDurationBalanced ? '✓' : '⚠️'}
                </span>
              </div>

              <div className="w-full h-7 bg-[#080911] rounded-lg border border-[#1D2032] overflow-hidden flex p-0.5 gap-1">
                {currentShots.length === 0 ? (
                  <div className="w-full flex items-center justify-center text-[10px] font-mono text-slate-600">
                    Belum ada subdivisi shot
                  </div>
                ) : (
                  currentShots.map((sh, idx) => {
                    const widthPercent = ((sh.duration_sec || 1) / sceneAuthoritativeDuration) * 100;
                    const computedShotId = sh.id || `shot-${currentScene.id}-${idx}`;
                    const isSelected = activeShotSelection === computedShotId || (activeShotSelection === null && idx === 0);
                    return (
                      <div
                        key={sh.id || idx}
                        style={{ width: `${Math.max(5, widthPercent)}%` }}
                        onClick={() => {
                          setActiveShotSelection(computedShotId);
                          if (onSelectShot) onSelectShot(computedShotId);
                        }}
                        className={`h-full rounded flex items-center justify-between px-1.5 text-[9px] font-mono transition group cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600/50 border-indigo-400 text-white font-black shadow-inner shadow-indigo-800/40'
                            : 'bg-[#161828] hover:bg-indigo-500/20 border-[#24273E] hover:border-indigo-500/40 text-slate-300'
                        }`}
                        title={`Shot #${sh.shot_number}: ${sh.duration_sec}s (${sh.camera_movement || 'Kamera'})`}
                      >
                        <span>S{sh.shot_number}</span>
                        <span className="text-slate-400 group-hover:text-amber-300">{sh.duration_sec}s</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 5. SHOT BREAKDOWN & MULTI-AGENT PROMPTS LIST */}
          {!isUnifiedUI && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase text-indigo-400 font-bold">
                  <PlaySquare className="w-4 h-4 text-indigo-400" />
                  <span>Subdivisi Shot &amp; Multi-Agent Prompts ({currentShots.length} Shot)</span>
                </div>

                {/* Shot Selector Tabs Strip */}
                {currentShots.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">Pilih Shot:</span>
                    {currentShots.map((sh, sIdx) => {
                      const shotId = sh.id || `shot-${currentScene.id}-${sIdx}`;
                      const isSelected = shotId === resolvedActiveShotId;
                      return (
                        <button
                          key={shotId}
                          onClick={() => {
                            setActiveShotSelection(shotId);
                            if (onSelectShot) onSelectShot(shotId);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition shrink-0 flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-md shadow-amber-500/20'
                              : 'bg-[#121424] text-slate-300 hover:text-white border-[#21243E] hover:border-indigo-500/40'
                          }`}
                        >
                          <span>S{sh.shot_number}</span>
                          <span className={`text-[9px] ${isSelected ? 'text-black/80' : 'text-slate-500'}`}>
                            ({sh.duration_sec}s)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {currentShots.length === 0 ? (
                <div className="p-8 bg-[#0E101D] border border-[#1E2136] rounded-2xl text-center text-slate-500 font-mono text-xs">
                  Belum ada subdivisi shot untuk adegan ini. Jalankan pipeline untuk menghasilkan shot.
                </div>
              ) : (
                <div className="border border-[#1E2034] rounded-lg overflow-hidden bg-[#0D0F1A]">
                  {/* Header */}
                  <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-[#0E0F1A] text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#1E2034]">
                      <div>No</div>
                      <div>Framing</div>
                      <div>Dur</div>
                      <div>Status</div>
                      <div>Movement</div>
                  </div>
                  {/* Rows */}
                  {currentShots.map((sh, sIdx) => {
                      const shotId = sh.id || `shot-${currentScene.id}-${sIdx}`;
                      const isSelected = shotId === resolvedActiveShotId;
                      const shPrompts = (videoPrompts && sh.id && videoPrompts[sh.id]) ? videoPrompts[sh.id] : [];

                      const prevId = sIdx > 0 ? (currentShots[sIdx - 1].id || `shot-${currentScene.id}-${sIdx - 1}`) : undefined;
                      const nextId = sIdx < currentShots.length - 1 ? (currentShots[sIdx + 1].id || `shot-${currentScene.id}-${sIdx + 1}`) : undefined;

                      return (
                          <React.Fragment key={shotId}>
                            <CompactShotRow
                                shot={sh}
                                index={sIdx}
                                isSelected={isSelected}
                                onSelect={() => {
                                    setActiveShotSelection(shotId);
                                    if (onSelectShot) onSelectShot(shotId);
                                }}
                                onDoubleClick={() =>
                                    openWindow({
                                        id: `shot-${shotId}`,
                                        type: 'shot_detail',
                                        title: `Shot ${sh.shot_number} • SC-${String(currentScene.scene_number).padStart(2, '0')}`,
                                        subtitle: sh.visual_description || sh.character_action || 'Shot Cockpit',
                                        data: { shot: sh, scene: { id: currentScene.id, scene_number: currentScene.scene_number }, characters, locations, objects },
                                    })
                                }
                            />
                            {isSelected && (
                              <div className="p-3 bg-[#0B0C16] border-b border-indigo-500/30 animate-in fade-in duration-150">
                                <CompactShotCockpit
                                  shot={sh}
                                  totalShots={currentShots.length}
                                  shotIndex={sIdx}
                                  sceneId={currentScene.id}
                                  sceneNumber={currentScene.scene_number}
                                  prompts={shPrompts}
                                  isSelected={true}
                                  allShots={currentShots}
                                  onSelectShot={(sId) => {
                                    setActiveShotSelection(sId);
                                    if (onSelectShot) onSelectShot(sId);
                                  }}
                                  onPrevShot={prevId ? () => {
                                    setActiveShotSelection(prevId);
                                    if (onSelectShot) onSelectShot(prevId);
                                  } : undefined}
                                  onNextShot={nextId ? () => {
                                    setActiveShotSelection(nextId);
                                    if (onSelectShot) onSelectShot(nextId);
                                  } : undefined}
                                  onRunShotPrompt={onRunShotPrompt}
                                  onSmartRegenerate={onSmartRegenerate}
                                  onUpdateShotImage={onUpdateShotImage}
                                  processingShotId={processingShotId}
                                  shotPromptError={shotPromptError ? shotPromptError[sh.id || ''] : undefined}
                                  characters={characters}
                                  locations={locations}
                                  objects={objects}
                                />
                              </div>
                            )}
                          </React.Fragment>
                      );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. ASSET BIBLE SECTION FOR ACTIVE SCENE */}
          {(sceneCharacters.length > 0 || sceneLocations.length > 0) && (
            <div className="bg-[#0F131E] border border-[#21253C] rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-mono uppercase text-amber-400 font-bold">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Asset Bible &amp; Prompts Terkait Adegan Ini</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sceneCharacters.map((char, cIdx) => {
                  const nameLower = char.name.toLowerCase();
                  const isHoly = nameLower.includes('sunan') || nameLower.includes('wali') || nameLower.includes('kyai') || nameLower.includes('habib') || nameLower.includes('ulama') || nameLower.includes('syekh') || nameLower.includes('sheikh') || nameLower.includes('nabi') || nameLower.includes('rasul') || nameLower.includes('ustadz') || nameLower.includes('ustad') || nameLower.includes('imam') || nameLower.includes('buya') || nameLower.includes('gus');
                  const holyData = isHoly ? getDetailedHolyFigurePromptAndNegative(char) : null;
                  const cPrompt = getCharacterBananaPrompt(char);
                  const charKey = `c-${char.id || cIdx}`;

                  return (
                    <div
                      key={char.id || cIdx}
                      className={`rounded-xl p-3 space-y-2 shadow-md border ${
                        isHoly ? 'bg-[#181622] border-amber-500/30' : 'bg-[#121424] border-[#212338]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Users className={`w-3.5 h-3.5 ${isHoly ? 'text-amber-400 animate-pulse' : 'text-amber-400'}`} />
                          <h4 className="text-xs font-bold text-white flex items-center gap-1">
                            <span>{char.name}</span>
                            {isHoly && <span className="text-[8px] bg-amber-500/15 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/20 font-mono">Wali/Ulama</span>}
                          </h4>
                        </div>
                        {isHoly && holyData ? (
                          <button
                            onClick={() => handleCopy(holyData.fullBundle, `${charKey}-full`)}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/35 transition"
                            title="Salin Paket Lengkap (Positif + Negatif)"
                          >
                            {copiedId === `${charKey}-full` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                            <span>{copiedId === `${charKey}-full` ? 'Tersalin!' : 'Salin Paket'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const charNeg = getDynamicNegativePrompt(char.name, char.physical_description || '', 'character');
                              const fullCharBundle = `[POSITIVE PROMPT - KARAKTER: ${char.name.toUpperCase()}]\n${cPrompt}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${charNeg}`;
                              handleCopy(fullCharBundle, charKey);
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/30 transition"
                            title="Salin Paket Lengkap (Positif + Negatif)"
                          >
                            {copiedId === charKey ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                            <span>{copiedId === charKey ? 'Tersalin!' : 'Salin Paket'}</span>
                          </button>
                        )}
                      </div>

                      {isHoly && holyData ? (
                        <div className="space-y-2 pt-1">
                          {/* Positive */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                              <span className="text-amber-400 font-bold">✨ Positif:</span>
                              <button
                                onClick={() => handleCopy(holyData.prompt, `${charKey}-pos`)}
                                className="hover:text-white flex items-center gap-1 font-bold text-amber-300"
                              >
                                {copiedId === `${charKey}-pos` ? <Check className="w-2 h-2 text-emerald-400" /> : <Copy className="w-2 h-2" />}
                                <span>Copy</span>
                              </button>
                            </div>
                            <p className="font-mono text-[10px] text-slate-300 bg-[#090A14] p-2 rounded-lg border border-amber-500/10 leading-relaxed max-h-24 overflow-y-auto select-all">
                              {holyData.prompt}
                            </p>
                          </div>
                          {/* Negative */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                              <span className="text-red-400 font-bold">⚠️ Negatif:</span>
                              <button
                                onClick={() => handleCopy(holyData.negativePrompt, `${charKey}-neg`)}
                                className="hover:text-white flex items-center gap-1 font-bold text-red-300"
                              >
                                {copiedId === `${charKey}-neg` ? <Check className="w-2 h-2 text-emerald-400" /> : <Copy className="w-2 h-2" />}
                                <span>Copy</span>
                              </button>
                            </div>
                            <p className="font-mono text-[9px] text-slate-400 bg-[#090A14] p-2 rounded-lg border border-red-500/5 leading-relaxed max-h-16 overflow-y-auto select-all">
                              {holyData.negativePrompt}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          {/* Positive */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                              <span className="text-amber-400 font-bold">✨ Positif:</span>
                              <button
                                onClick={() => handleCopy(cPrompt, `${charKey}-pos`)}
                                className="hover:text-white flex items-center gap-1 font-bold text-amber-300"
                              >
                                {copiedId === `${charKey}-pos` ? <Check className="w-2 h-2 text-emerald-400" /> : <Copy className="w-2 h-2" />}
                                <span>Copy</span>
                              </button>
                            </div>
                            <p className="font-mono text-[10px] text-slate-300 bg-[#090A14] p-2 rounded-lg border border-amber-500/10 leading-relaxed max-h-24 overflow-y-auto select-all">
                              {cPrompt}
                            </p>
                          </div>
                          {/* Negative */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                              <span className="text-red-400 font-bold">⚠️ Negatif:</span>
                              <button
                                onClick={() => handleCopy(getDynamicNegativePrompt(char.name, char.physical_description || '', 'character'), `${charKey}-neg`)}
                                className="hover:text-white flex items-center gap-1 font-bold text-red-300"
                              >
                                {copiedId === `${charKey}-neg` ? <Check className="w-2 h-2 text-emerald-400" /> : <Copy className="w-2 h-2" />}
                                <span>Copy</span>
                              </button>
                            </div>
                            <p className="font-mono text-[9px] text-slate-400 bg-[#090A14] p-2 rounded-lg border border-red-500/5 leading-relaxed max-h-16 overflow-y-auto select-all">
                              {getDynamicNegativePrompt(char.name, char.physical_description || '', 'character')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {sceneLocations.map((loc, lIdx) => {
                  const lPrompt = getLocationBananaPrompt(loc);
                  const locKey = `l-${loc.id || lIdx}`;
                  return (
                    <div
                      key={loc.id || lIdx}
                      className="bg-[#121424] border border-[#212338] rounded-xl p-3 space-y-2 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                          <h4 className="text-xs font-bold text-white">{loc.name}</h4>
                        </div>
                        <button
                          onClick={() => {
                            const locNeg = getDynamicNegativePrompt(loc.name, loc.description || loc.environment || '', 'location');
                            const locBundle = `[POSITIVE PROMPT - LOKASI: ${loc.name.toUpperCase()}]\n${lPrompt}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${locNeg}`;
                            handleCopy(locBundle, `${locKey}-full`);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center gap-1 hover:bg-cyan-500/35 transition"
                          title="Salin Paket Lengkap (Positif + Negatif)"
                        >
                          {copiedId === `${locKey}-full` ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                          <span>{copiedId === `${locKey}-full` ? 'Tersalin!' : 'Salin Paket'}</span>
                        </button>
                      </div>

                      <div className="space-y-2 pt-1">
                        {/* Positive */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                            <span className="text-cyan-400 font-bold">✨ Positif:</span>
                            <button
                              onClick={() => handleCopy(lPrompt, `${locKey}-pos`)}
                              className="hover:text-white flex items-center gap-1 font-bold text-cyan-300"
                            >
                              {copiedId === `${locKey}-pos` ? <Check className="w-2 h-2 text-emerald-400" /> : <Copy className="w-2 h-2" />}
                              <span>Copy</span>
                            </button>
                          </div>
                          <p className="font-mono text-[10px] text-slate-300 bg-[#090A14] p-2 rounded-lg border border-cyan-500/10 leading-relaxed max-h-24 overflow-y-auto select-all">
                            {lPrompt}
                          </p>
                        </div>
                        {/* Negative */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                            <span className="text-red-400 font-bold">⚠️ Negatif:</span>
                            <button
                              onClick={() => handleCopy(getDynamicNegativePrompt(loc.name, loc.description || loc.environment || '', 'location'), `${locKey}-neg`)}
                              className="hover:text-white flex items-center gap-1 font-bold text-red-300"
                            >
                              {copiedId === `${locKey}-neg` ? <Check className="w-2 h-2 text-emerald-400" /> : <Copy className="w-2 h-2" />}
                              <span>Copy</span>
                            </button>
                          </div>
                          <p className="font-mono text-[9px] text-slate-400 bg-[#090A14] p-2 rounded-lg border border-red-500/5 leading-relaxed max-h-16 overflow-y-auto select-all">
                            {getDynamicNegativePrompt(loc.name, loc.description || loc.environment || '', 'location')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* 7. FULL SCENE FOCUS WINDOW MODAL                          */}
      {/* ========================================================= */}
      {currentScene && (
        <FocusWindow
          isOpen={isSceneFocusOpen}
          onClose={() => setIsSceneFocusOpen(false)}
          title={`SCENE ${String(currentScene.scene_number).padStart(2, '0')} • ${currentScene.title || 'Adegan Sinematik'}`}
          subtitle={`${currentScene.location_name || 'Latar'} • ${currentScene.time_of_day || 'Day'} • ${sceneAuthoritativeDuration} Detik • ${currentShots.length} Shots`}
          icon={<Film className="w-4 h-4 text-amber-400" />}
          badge={
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
              FULL STORYBOARD BREAKDOWN
            </span>
          }
          size="xl"
          footerActions={
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleCopy(readScenePrompt(currentScene).text, `focus-sc-copy-${currentScene.id}`)
                }
                disabled={!readScenePrompt(currentScene).hasPrompt}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg flex items-center gap-1.5 transition disabled:opacity-40"
              >
                {copiedId === `focus-sc-copy-${currentScene.id}` ? (
                  <Check className="w-3.5 h-3.5 text-black" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>
                  {copiedId === `focus-sc-copy-${currentScene.id}`
                    ? 'Tersalin!'
                    : 'Salin Master Banana'}
                </span>
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Story Beat & Dramatic Objective */}
            <div className="bg-[#17192C] border border-[#262A48] rounded-xl p-4 space-y-2">
              <h4 className="text-[11px] font-mono uppercase text-amber-400 font-bold">
                Story Beat &amp; Fungsi Naratif
              </h4>
              <p className="text-slate-200 text-sm leading-relaxed">
                {currentScene.story_purpose ||
                  currentScene.narrative_function ||
                  currentScene.event ||
                  'Pengembangan alur cerita.'}
              </p>
            </div>

            {/* Characters & Visual Specification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#17192C] border border-[#262A48] rounded-xl p-3.5 space-y-2">
                <h4 className="text-[11px] font-mono uppercase text-indigo-400 font-bold">
                  Karakter / Tokoh Hadir
                </h4>
                {currentScene.character_names && currentScene.character_names.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {currentScene.character_names.map((name, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 font-medium"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">—</p>
                )}
              </div>

              <div className="bg-[#17192C] border border-[#262A48] rounded-xl p-3.5 space-y-2">
                <h4 className="text-[11px] font-mono uppercase text-cyan-400 font-bold">
                  Arahan Visual &amp; Atmosfer
                </h4>
                <div className="space-y-1 text-slate-300 text-[11px]">
                  <div>
                    <span className="text-slate-500">Lokasi:</span>{' '}
                    <strong>{currentScene.location_name || 'Latar Sinematik'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Waktu:</span>{' '}
                    <strong>{currentScene.time_of_day || 'Day'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Pencahayaan:</span>{' '}
                    <strong>{currentScene.lighting || 'Cinematic Ambient'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Shots Breakdown Sequence */}
            <div className="bg-[#17192C] border border-[#262A48] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#242846] pb-2">
                <h4 className="text-[11px] font-mono uppercase text-amber-400 font-bold">
                  Rincian Seluruh Shot ({currentShots.length} Shot)
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  Total Durasi: {shotsTotalDuration}s
                </span>
              </div>

              <div className="space-y-2">
                {currentShots.map((sh, idx) => (
                  <div
                    key={sh.id || idx}
                    className="p-3 bg-[#111322] border border-[#21243A] rounded-xl space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                          SH-{String(sh.shot_number || idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-slate-400 text-[10px] font-mono">
                          {sh.shot_type || 'Shot'} • {sh.camera_movement || 'Kamera'}
                        </span>
                      </div>
                      <span className="text-indigo-300 font-mono font-bold">{sh.duration_sec}s</span>
                    </div>

                    <p className="text-slate-200 font-sans leading-relaxed">
                      {sh.event_detail || sh.character_action || sh.action || 'Detail kejadian shot.'}
                    </p>

                    {sh.audio_narration && (
                      <div className="text-[11px] text-amber-200/90 italic bg-black/30 p-2 rounded border-l-2 border-amber-500/60">
                        VO: "{sh.audio_narration}"
                      </div>
                    )}

                    {sh.dialogue && sh.dialogue.length > 0 && (
                      <div className="text-[11px] text-indigo-200 bg-black/30 p-2 rounded space-y-0.5">
                        {sh.dialogue.map((d, dIdx) => (
                          <div key={dIdx}>
                            <strong className="text-indigo-400">{d.character_name}:</strong> "{d.line}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FocusWindow>
      )}

      {/* Focus Window for Master Frame Prompt */}
      {currentScene && (
        <FocusWindow
          isOpen={isMasterPromptFocusOpen}
          onClose={() => setIsMasterPromptFocusOpen(false)}
          title={`Master Frame Prompt • Adegan ${currentScene.scene_number}`}
          subtitle={
            currentScene.title ||
            currentScene.location_name ||
            'Google Banana Pro Master Frame Reference'
          }
          icon={<Sparkles className="w-4 h-4 text-amber-400" />}
          footerActions={
            <button
              onClick={() =>
                handleCopy(readScenePrompt(currentScene).text, `focus-master-${currentScene.id}`)
              }
              disabled={!readScenePrompt(currentScene).hasPrompt}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg flex items-center gap-1.5 transition disabled:opacity-40"
            >
              {copiedId === `focus-master-${currentScene.id}` ? (
                <Check className="w-3.5 h-3.5 text-black" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedId === `focus-master-${currentScene.id}`
                  ? 'Prompt Tersalin!'
                  : 'Salin Master Prompt'}
              </span>
            </button>
          }
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-[#21243E] pb-2">
              <span>
                Target Engine:{' '}
                <strong className="text-amber-300 font-sans">Google Banana Pro Master Frame</strong>
              </span>
              <span>
                Rasio: <strong className="text-cyan-300">16:9 Cinema Scope</strong>
              </span>
            </div>
            <p className="p-3 bg-black/40 rounded-lg border border-[#1E2033] text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-all">
              {readScenePrompt(currentScene).text}
            </p>
          </div>
        </FocusWindow>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Video,
  Copy,
  Check,
  Cpu,
  Lock,
  Unlock,
  Maximize2,
  Image as ImageIcon,
  Upload,
  Clapperboard,
  Users,
  MapPin,
  Volume2,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Sliders,
  X,
  FileText,
  ExternalLink,
  ShieldAlert,
  Activity,
  SlidersHorizontal,
  Terminal,
  Grid,
} from 'lucide-react';
import {
  Shot,
  VideoPrompt,
  PromptTarget,
  PromptLockState,
  CharacterBible,
  LocationBible,
  ObjectBible,
  CanonicalCamera,
  CanonicalComposition,
} from '../../types';
import {
  getPersistedPrompt,
  PROMPT_TARGET_DESCRIPTIONS,
  PROMPT_TARGET_LABELS,
  SHOT_PROMPT_TARGETS,
  PersistedPrompt,
} from '../../lib/prompt_targets';
import { FocusWindow } from './FocusWindow';
import { getDynamicNegativePrompt, getDetailedHolyFigurePromptAndNegative, isReveredHolyFigureClient } from '../workspaces/AssetBibleWorkspace';
import { useWindowManager } from '../../context/WindowManagerContext';

export interface CompactShotCockpitProps {
  shot: Shot;
  totalShots?: number;
  shotIndex?: number;
  sceneId: string;
  sceneNumber: number;
  prompts: VideoPrompt[];
  isSelected?: boolean;
  onSelect?: () => void;
  onPrevShot?: () => void;
  onNextShot?: () => void;
  onRunShotPrompt?: (shotId: string, target: PromptTarget) => void;
  onSmartRegenerate?: (
    shotId: string,
    target: PromptTarget,
    lockState?: PromptLockState,
    reason?: string,
    requireAi?: boolean
  ) => void;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void;
  processingShotId?: string | null;
  shotPromptError?: string;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
  
  // Custom integrated navigation & window parameters
  windowInstance?: any;
  allShots?: Record<string, Shot[]> | Shot[];
  onSelectShot?: (shotId: string) => void;
}

const PROVIDER_METADATA: Record<
  PromptTarget,
  {
    shortName: string;
    fullName: string;
    engine: string;
    chipActive: string;
    icon: React.ReactNode;
  }
> = {
  banana_image: {
    shortName: 'BANANA',
    fullName: 'Google Banana Pro Shot Frame',
    engine: 'Google (Still Frame)',
    chipActive: 'bg-amber-500 text-black border-amber-400 font-black shadow-md',
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-950" />,
  },
  veo: {
    shortName: 'VEO 3.1',
    fullName: 'Google Veo AI Video',
    engine: 'Google DeepMind (10s)',
    chipActive: 'bg-indigo-600 text-white border-indigo-400 font-black shadow-md',
    icon: <Video className="w-3.5 h-3.5 text-white" />,
  },
  omni: {
    shortName: 'OMNI',
    fullName: 'Gemini Omni Cinematic Video',
    engine: 'Google Gemini (10s)',
    chipActive: 'bg-violet-600 text-white border-violet-400 font-black shadow-md',
    icon: <Video className="w-3.5 h-3.5 text-white" />,
  },
  seedance_10: {
    shortName: 'SEEDANCE 10s',
    fullName: 'ByteDance SeaDance 2.5 Standard',
    engine: 'ByteDance (10s)',
    chipActive: 'bg-cyan-600 text-white border-cyan-400 font-black shadow-md',
    icon: <Cpu className="w-3.5 h-3.5 text-white" />,
  },
  seedance_30: {
    shortName: 'SEEDANCE 30s',
    fullName: 'ByteDance SeaDance 2.5 Extended',
    engine: 'ByteDance (30s Extended)',
    chipActive: 'bg-teal-600 text-white border-teal-400 font-black shadow-md',
    icon: <Cpu className="w-3.5 h-3.5 text-white" />,
  },
  banana_master_frame: {
    shortName: 'MASTER FRAME',
    fullName: 'Google Banana Pro Master Frame',
    engine: 'Google (Scene Anchor)',
    chipActive: 'bg-amber-500 text-black border-amber-400 font-black shadow-md',
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-950" />,
  },
};

export const CompactShotCockpit: React.FC<CompactShotCockpitProps> = React.memo(({
  shot,
  totalShots,
  shotIndex,
  sceneId,
  sceneNumber,
  prompts,
  isSelected = true,
  onSelect,
  onPrevShot,
  onNextShot,
  onRunShotPrompt,
  onSmartRegenerate,
  onUpdateShotImage,
  processingShotId,
  shotPromptError,
  characters = [],
  locations = [],
  objects = [],
  windowInstance,
  allShots,
  onSelectShot,
}) => {
  const { openWindow } = useWindowManager();
  const shotId = shot.id || `shot-${sceneId}-${shot.shot_number}`;
  const isGenerating = processingShotId === shotId;

  // Active Tab: Creative console uses interactive panels
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt' | 'camera' | 'continuity' | 'assets' | 'validation'>('overview');

  // Selected Target Provider
  const [selectedTarget, setSelectedTarget] = useState<PromptTarget>(
    (shot.recommended_platform as PromptTarget) || 'veo'
  );

  // Copy feedback states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Advanced Smart Regenerate panel state
  const [showSmartPanel, setShowSmartPanel] = useState(false);
  const [smartReason, setSmartReason] = useState('Optimasi framing & pencahayaan subjek');

  // Modals / Lightboxes
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Drag & drop file upload state
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Continuity / Prompt Locks state
  const [locks, setLocks] = useState<PromptLockState>({
    character_locked: shot.lock_state?.character_locked ?? true,
    location_locked: shot.lock_state?.location_locked ?? true,
    costume_locked: shot.lock_state?.costume_locked ?? true,
    lighting_locked: shot.lock_state?.lighting_locked ?? true,
    camera_locked: shot.lock_state?.camera_locked ?? false,
    action_locked: shot.lock_state?.action_locked ?? false,
    composition_locked: shot.lock_state?.composition_locked ?? false,
  });

  // Keep locks state synchronized if shot changes
  useEffect(() => {
    setLocks({
      character_locked: shot.lock_state?.character_locked ?? true,
      location_locked: shot.lock_state?.location_locked ?? true,
      costume_locked: shot.lock_state?.costume_locked ?? true,
      lighting_locked: shot.lock_state?.lighting_locked ?? true,
      camera_locked: shot.lock_state?.camera_locked ?? false,
      action_locked: shot.lock_state?.action_locked ?? false,
      composition_locked: shot.lock_state?.composition_locked ?? false,
    });
  }, [shot]);

  // Canonical Update Handler
  const handleUpdateShot = async (fields: Partial<Shot>) => {
    try {
      const res = await fetch(`/api/shots/${shotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        if (onUpdateShotImage) {
          onUpdateShotImage(shotId, shot.shot_image_url || shot.image_url || null);
        }
      }
    } catch (err) {
      console.error('[COCKPIT] Failed to update canonical shot:', err);
    }
  };

  const toggleLock = async (key: keyof PromptLockState) => {
    const nextLocks = { ...locks, [key]: !locks[key] };
    setLocks(nextLocks);
    await handleUpdateShot({ lock_state: nextLocks });
  };

  const currentCamera = useMemo(() => {
    return shot.camera || {
      angle: 'Eye-Level',
      lens: 'Standard Spherical',
      focal_length: '35mm Cine Standard',
      movement: 'Static Tripod',
      depth_of_field: 'Moderate (f/2.8)',
      framing: shot.camera?.framing || shot.shot_type || 'MS (Medium Shot)',
      position: 'Frontal Centered',
      speed: 'Realtime (24fps)',
    };
  }, [shot]);

  const currentComposition = useMemo(() => {
    return shot.composition || {
      layout: 'Rule of Thirds',
      subject_placement: 'Dead Center',
      visual_balance: 'Perfect Balance',
      foreground: 'Clean / Unobstructed',
      background: 'Cinematic Bokeh Blur',
      spatial_relationship: 'Intimate Proximity',
    };
  }, [shot]);

  const updateCameraField = async (key: keyof CanonicalCamera, value: string) => {
    const nextCamera = { ...currentCamera, [key]: value };
    await handleUpdateShot({ camera: nextCamera });
  };

  const updateCompositionField = async (key: keyof CanonicalComposition, value: string) => {
    const nextComposition = { ...currentComposition, [key]: value };
    await handleUpdateShot({ composition: nextComposition });
  };

  const CAMERA_PRESETS = [
    {
      name: 'Intimate Portrait',
      camera: {
        framing: 'CU (Close Up)',
        angle: 'Eye-Level',
        lens: 'Vintage Prime',
        focal_length: '85mm Telephoto',
        movement: 'Slow Push-In',
        depth_of_field: 'Shallow (f/1.8)',
        position: 'Three-Quarter View',
        speed: 'Realtime (24fps)'
      }
    },
    {
      name: 'Epic Landscape',
      camera: {
        framing: 'EWS (Extreme Wide Shot)',
        angle: 'High Angle',
        lens: 'Anamorphic Prime',
        focal_length: '18mm Ultra-Wide',
        movement: 'Pan Left/Right',
        depth_of_field: 'Deep (f/8.0)',
        position: 'Frontal Centered',
        speed: 'Realtime (24fps)'
      }
    },
    {
      name: 'Dramatic Dynamic',
      camera: {
        framing: 'MS (Medium Shot)',
        angle: 'Low Angle',
        lens: 'Standard Spherical',
        focal_length: '24mm Wide',
        movement: 'Dolly Tracking',
        depth_of_field: 'Moderate (f/2.8)',
        position: 'Over-the-Shoulder',
        speed: 'Slow Motion (60fps)'
      }
    }
  ];

  const COMPOSITION_PRESETS = [
    {
      name: 'Rule of Thirds Hero',
      composition: {
        layout: 'Rule of Thirds',
        subject_placement: 'Right Third',
        visual_balance: 'Asymmetric Dynamic',
        foreground: 'Over-the-Shoulder Silhouette',
        background: 'Cinematic Bokeh Blur',
        spatial_relationship: 'Intimate Proximity'
      }
    },
    {
      name: 'Centered Majesty',
      composition: {
        layout: 'Symmetrical / Centered',
        subject_placement: 'Dead Center',
        visual_balance: 'Perfect Balance',
        foreground: 'Clean / Unobstructed',
        background: 'Dramatic Chiaroscuro Shadows',
        spatial_relationship: 'Dominant Low Position'
      }
    },
    {
      name: 'Atmospheric Solitude',
      composition: {
        layout: 'Golden Spiral',
        subject_placement: 'Lower Foreground',
        visual_balance: 'Negative Space Dominated',
        foreground: 'Out-of-Focus Foliage',
        background: 'Vast Desert Horizon',
        spatial_relationship: 'Distant Isolation'
      }
    }
  ];

  // Keyboard Navigation: Arrow Left/Up & Right/Down to swap shots smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (onPrevShot) onPrevShot();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (onNextShot) onNextShot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevShot, onNextShot]);

  // Extract Scene Shots for visual navigation strip
  const sceneShots = useMemo(() => {
    if (!allShots) return [];
    const list = Array.isArray(allShots)
      ? allShots
      : typeof allShots === 'object' && sceneId
      ? (allShots[sceneId] || [])
      : [];
    return [...list].sort((a, b) => a.shot_number - b.shot_number);
  }, [allShots, sceneId]);

  // Comprehensive text corpus for entity matching
  const fullCorpus = useMemo(() => {
    const parts = [
      shot.event_detail,
      shot.character_action,
      shot.visual_description,
      shot.action,
      shot.master_image_prompt,
      (shot as any).banana_image_prompt,
      (shot as any).notes,
      (shot as any).script_excerpt,
      shot.camera_note,
      ...(shot.dialogue ? shot.dialogue.map((d) => `${d.character_name || ''} ${d.line || ''}`) : []),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  }, [shot]);

  const activeCharacters = useMemo(() => {
    const matched = characters.filter((c) => {
      if (!c?.name) return false;
      const nameLower = c.name.toLowerCase();

      // 1. Explicit ID / Ref check
      const hasExplicitRef = Array.isArray((shot as any).character_ids)
        ? (shot as any).character_ids.includes(c.id)
        : (shot.character_refs?.includes(c.id || '') || shot.character_refs?.includes(c.name));
      if (hasExplicitRef) return true;

      // 2. Full name check in corpus
      if (fullCorpus.includes(nameLower)) return true;

      // 3. Token check (e.g. "Aminah" from "Aminah binti Wahb")
      const stopWords = ['bin', 'binti', 'al', 'the', 'and', 'dan', 'ibu', 'syekh', 'sunan', 'sayyidah', 'siti'];
      const tokens = nameLower.split(/\s+/).filter((t) => t.length > 2 && !stopWords.includes(t));
      if (tokens.some((token) => fullCorpus.includes(token))) return true;

      return false;
    });

    if (matched.length === 0 && characters.length > 0) {
      return characters;
    }

    return matched;
  }, [characters, shot, fullCorpus]);

  const activeLocations = useMemo(() => {
    const matched = locations.filter((l) => {
      if (!l?.name) return false;
      const nameLower = l.name.toLowerCase();

      // 1. Explicit ID / Ref check
      const hasExplicitRef = (shot as any).location_id === l.id || shot.location_ref === l.id || shot.location_ref === l.name;
      if (hasExplicitRef) return true;

      // 2. Full name check in corpus
      if (fullCorpus.includes(nameLower)) return true;

      // 3. Token check (e.g. "Aminah" or "Rumah" from "Rumah Aminah")
      const stopWords = ['rumah', 'kamar', 'masjid', 'desa', 'kota', 'bukit', 'lembah', 'padang', 'istana'];
      const tokens = nameLower.split(/\s+/).filter((t) => t.length > 2 && !stopWords.includes(t));
      if (tokens.some((token) => fullCorpus.includes(token))) return true;
      
      const sanitizedLoc = nameLower.replace(/rumah|kamar|masjid|desa|kota/gi, '').trim();
      if (sanitizedLoc.length > 2 && fullCorpus.includes(sanitizedLoc)) return true;

      return false;
    });

    if (matched.length === 0 && locations.length > 0) {
      return locations;
    }

    return matched;
  }, [locations, shot, fullCorpus]);

  const activeObjects = useMemo(() => {
    return objects.filter((o) => {
      if (!o?.name) return false;
      const hasExplicitRef = Array.isArray((shot as any).object_ids)
        ? (shot as any).object_ids.includes(o.id)
        : (shot.object_refs?.includes(o.id || '') || shot.object_refs?.includes(o.name));
      const inText = fullCorpus.includes(o.name.toLowerCase());
      return hasExplicitRef || inText;
    });
  }, [objects, shot, fullCorpus]);

  // Resolve active prompt using the existing engine target adapters
  const activePrompt: PersistedPrompt = getPersistedPrompt(shot, selectedTarget, prompts, {
    isGenerating,
    hasError: Boolean(shotPromptError),
  });

  const rawMeta = PROVIDER_METADATA[selectedTarget] || PROVIDER_METADATA.veo;
  const shotDurationSec = activePrompt.resolvedDurationSec || shot.duration_sec || 5;
  const activeMeta = useMemo(() => {
    return {
      ...rawMeta,
      engine: rawMeta.engine.replace(/10s/g, `${shotDurationSec}s`),
      fullName: rawMeta.fullName.replace(/10s/g, `${shotDurationSec}s`),
    };
  }, [rawMeta, shotDurationSec]);
  
  const resolvePromptNegative = useCallback(
    (p: PersistedPrompt): string => {
      const rowNeg = p.row?.negative_prompt?.trim();
      if (rowNeg && rowNeg.length > 0 && rowNeg !== 'none' && rowNeg !== 'N/A') return rowNeg;

      const timelineNeg = p.row?.timeline_json?.negative_prompt?.trim();
      if (timelineNeg && timelineNeg.length > 0 && timelineNeg !== 'none' && timelineNeg !== 'N/A') return timelineNeg;

      const shotNeg = (shot as any).negative_prompt?.trim();
      if (shotNeg && shotNeg.length > 0 && shotNeg !== 'none' && shotNeg !== 'N/A') return shotNeg;

      const textCtx = `${shot.visual_description || ''} ${shot.action || ''} ${shot.character_action || ''}`.trim();
      const detailCtx = `${shot.event_detail || ''} ${shot.camera_note || ''}`.trim();
      return getDynamicNegativePrompt(textCtx || 'cinematic shot', detailCtx || 'film scene', 'character');
    },
    [shot]
  );

  const negativePromptText = useMemo(() => {
    return resolvePromptNegative(activePrompt);
  }, [activePrompt, resolvePromptNegative]);

  const buildCharacterFullBundle = useCallback((c: CharacterBible): string => {
    const isHoly = isReveredHolyFigureClient(c.name);
    if (isHoly) {
      const holyData = getDetailedHolyFigurePromptAndNegative(c);
      if (holyData && holyData.fullBundle) return holyData.fullBundle;
    }

    let posPrompt = c.master_portrait_prompt?.trim();
    if (!posPrompt) {
      const desc = c.physical_description || c.physical_appearance || (c as any).description || 'authentic historical facial features';
      const clothingStr = Array.isArray(c.clothing) ? c.clothing.filter(Boolean).join(', ') : (typeof c.clothing === 'string' ? c.clothing : '');
      let costume = c.costume || c.wardrobe || (clothingStr.length > 0 ? clothingStr : 'traditional historical garments');
      posPrompt = `Photorealistic cinematic master portrait of ${c.name}, ${c.age || 'adult'}, ${desc}, wearing ${costume}, 8k resolution, cinematic golden hour lighting, 85mm portrait lens, ultra-detailed skin texture --no modern clothes, no noise, no anatomical distortion`;
    }

    let negPrompt = (c as any).negative_prompt?.trim();
    if (!negPrompt || negPrompt === 'none' || negPrompt === 'N/A') {
      negPrompt = getDynamicNegativePrompt(c.name, c.physical_description || c.physical_appearance || (c as any).description || '', 'character');
    }

    return `[POSITIVE PROMPT - KARAKTER: ${c.name.toUpperCase()}]\n${posPrompt}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${negPrompt}`;
  }, []);

  const buildLocationFullBundle = useCallback((loc: LocationBible): string => {
    let posPrompt = loc.master_environment_prompt?.trim();
    if (!posPrompt) {
      const arch = loc.architectural_style || loc.architecture || 'ancient historical architecture';
      const env = loc.environment || loc.landscape || loc.description || 'historical landscape';
      const light = loc.lighting_atmosphere || loc.lighting_style || 'natural volumetric lighting';
      posPrompt = `Cinematic wide master landscape shot of ${loc.name}, featuring ${arch}, ${env}, ${light}, 8k ultra-detailed, photorealistic, 35mm anamorphic lens --no modern buildings, no asphalt, no vehicles`;
    }

    let negPrompt = (loc as any).negative_prompt?.trim();
    if (!negPrompt || negPrompt === 'none' || negPrompt === 'N/A') {
      negPrompt = getDynamicNegativePrompt(loc.name, loc.description || loc.environment || '', 'location');
    }

    return `[POSITIVE PROMPT - LOKASI: ${loc.name.toUpperCase()}]\n${posPrompt}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${negPrompt}`;
  }, []);

  // List of compiled prompts for quick shortcuts layer in Alur Cerita
  const compiledPromptsList = useMemo(() => {
    return SHOT_PROMPT_TARGETS.map((target) => {
      const p = getPersistedPrompt(shot, target, prompts, { isGenerating });
      if (!p.hasPrompt || !p.text || p.text.includes('Prompt belum digenerate')) return null;
      const meta = PROVIDER_METADATA[target];
      const durationSec = p.resolvedDurationSec || shot.duration_sec || 5;
      const targetMeta = {
        ...meta,
        shortName: meta.shortName,
        fullName: meta.fullName.replace(/10s/g, `${durationSec}s`),
      };
      const neg = resolvePromptNegative(p);
      const combinedText = `[POSITIVE PROMPT - ${targetMeta.fullName.toUpperCase()}]\n${p.text}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${neg}`;
      return {
        target,
        meta: targetMeta,
        prompt: p,
        neg,
        combinedText,
      };
    }).filter(Boolean) as {
      target: PromptTarget;
      meta: (typeof PROVIDER_METADATA)[PromptTarget];
      prompt: PersistedPrompt;
      neg: string;
      combinedText: string;
    }[];
  }, [shot, prompts, isGenerating, resolvePromptNegative]);

  // Main Action Narrative hierarchy fallback
  const mainAction =
    shot.event_detail ||
    shot.character_action ||
    shot.visual_description ||
    shot.action ||
    'Aksi sinematik mengalir sesuai alur adegan.';

  // Camera Specs (Read-Only metadata resolved cleanly)
  const lensSpecification = useMemo(() => {
    const text = (shot.camera_note || '').toLowerCase();
    if (text.includes('wide') || text.includes('18mm') || text.includes('24mm')) return { label: '24mm Wide-Angle', length: 24 };
    if (text.includes('tele') || text.includes('85mm') || text.includes('135mm')) return { label: '85mm Telephoto', length: 85 };
    if (text.includes('close up') || text.includes('portrait')) return { label: '50mm Prime Portrait', length: 50 };
    return { label: '35mm Standard Cinematic', length: 35 };
  }, [shot.camera_note]);

  // Dynamic Validation Diagnostics
  const validationDiagnostics = useMemo(() => {
    const diagnostics: { code: string; message: string; severity: 'error' | 'warning' }[] = [];
    if (!shot.image_url && !shot.shot_image_url) {
      diagnostics.push({ code: 'V-01', message: 'Visual Asset unassigned: No master frame reference.', severity: 'warning' });
    }
    if (!activePrompt.hasPrompt) {
      diagnostics.push({ code: 'P-03', message: 'Prompt code not compiled for current model provider.', severity: 'error' });
    }
    if (!locks.character_locked || !locks.location_locked) {
      diagnostics.push({ code: 'C-08', message: 'Incomplete continuity lock gate. Identity drift possible.', severity: 'warning' });
    }
    if (locks.camera_locked && (!shot.camera || Object.keys(shot.camera).length === 0)) {
      diagnostics.push({ code: 'C-09', message: 'Camera is locked but lacks canonical structured specifications. Fallback/legacy values will be parsed.', severity: 'warning' });
    }
    if (locks.composition_locked && (!shot.composition || Object.keys(shot.composition).length === 0)) {
      diagnostics.push({ code: 'C-10', message: 'Composition is locked but lacks canonical structured specifications. Fallback/legacy values will be parsed.', severity: 'warning' });
    }
    return diagnostics;
  }, [shot, activePrompt, locks]);

  // Actions Handlers
  const handleCopy = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegenerate = (requireAi: boolean = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onSmartRegenerate) {
      onSmartRegenerate(shotId, selectedTarget, locks, smartReason, requireAi);
    } else if (onRunShotPrompt) {
      onRunShotPrompt(shotId, selectedTarget);
    }
  };

  const processUploadedFile = (file: File) => {
    if (!file || !onUpdateShotImage) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onUpdateShotImage(shotId, event.target.result as string);
        setIsUploadModalOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Navigates within the same window using FloatingWindowManager config updating
  const handleShotChange = (nextShot: Shot) => {
    if (!nextShot || !onSelectShot) return;
    onSelectShot(nextShot.id || '');
    
    if (windowInstance) {
      openWindow({
        id: windowInstance.id,
        type: 'shot_detail',
        title: `Shot ${nextShot.shot_number} • SC-${String(sceneNumber).padStart(2, '0')}`,
        subtitle: nextShot.visual_description || nextShot.character_action || 'Shot Cockpit',
        data: {
          shot: nextShot,
          scene: windowInstance.data?.scene,
          characters,
          locations,
          objects
        }
      });
    }
  };

  return (
    <div
      id={`shot-cockpit-console-${shotId}`}
      className="bg-[#090A12] border border-[#20233B] h-full w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none text-slate-200 font-sans"
    >
      {/* ===================================================================== */}
      {/* 1. COMPACT SHOT HEADER & TELEMETRY                                    */}
      {/* ===================================================================== */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0E0F1A] border-b border-[#1E2034] flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          {/* Back/Next Navigator Chevron Trigger */}
          <div className="flex items-center bg-[#05060C] p-0.5 rounded-lg border border-[#1C1F38] shrink-0">
            <button
              onClick={() => {
                const idx = sceneShots.findIndex(s => s.id === shot.id);
                if (idx > 0) handleShotChange(sceneShots[idx - 1]);
              }}
              disabled={sceneShots.findIndex(s => s.id === shot.id) <= 0}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#141628] transition disabled:opacity-25 disabled:cursor-not-allowed"
              title="Shot Sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 sm:px-3 py-0.5 text-xs font-mono font-extrabold text-amber-300">
              S{String(sceneNumber).padStart(2, '0')}.{String(shot.shot_number).padStart(2, '0')}
            </span>
            <button
              onClick={() => {
                const idx = sceneShots.findIndex(s => s.id === shot.id);
                if (idx !== -1 && idx < sceneShots.length - 1) handleShotChange(sceneShots[idx + 1]);
              }}
              disabled={sceneShots.findIndex(s => s.id === shot.id) === -1 || sceneShots.findIndex(s => s.id === shot.id) >= sceneShots.length - 1}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#141628] transition disabled:opacity-25 disabled:cursor-not-allowed"
              title="Shot Berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Stats Indicator Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
              {shot.shot_type || shot.camera?.framing || 'Medium Shot'}
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded bg-[#161726] text-slate-300 border border-[#232644]">
              {shot.camera_movement || 'Static'}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-extrabold">
              ⏱️ {shot.duration_sec || 5}.0s
            </span>
            {validationDiagnostics.length === 0 ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[9px] tracking-wider uppercase">
                READY
              </span>
            ) : validationDiagnostics.some(d => d.severity === 'error') ? (
              <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold text-[9px] tracking-wider uppercase animate-pulse">
                BLOCKED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-[9px] tracking-wider uppercase">
                WARNING
              </span>
            )}
          </div>
        </div>

        {/* Existing Pipeline Actions (Generate / Validate / Save) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full md:w-auto">
          {/* Quick Copy Pos + Neg (Both) Button */}
          <button
            onClick={(e) => {
              const fullText = `[POSITIVE PROMPT - ${activeMeta.fullName.toUpperCase()}]\n${activePrompt.text}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${negativePromptText}`;
              handleCopy(fullText, `header-copy-both-${shotId}`, e);
            }}
            disabled={!activePrompt.hasPrompt}
            className={`min-h-[36px] sm:min-h-[30px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-extrabold flex items-center gap-1.5 border transition flex-1 sm:flex-initial justify-center ${
              copiedKey === `header-copy-both-${shotId}`
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30 text-amber-300 hover:text-white'
            } disabled:opacity-35`}
            title="Salin Gabungan Positive Prompt + Negative Prompt Sekaligus"
          >
            {copiedKey === `header-copy-both-${shotId}` ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied Both!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy Pos + Neg</span>
              </>
            )}
          </button>

          {/* Quick Copy Positive Prompt Button */}
          <button
            onClick={(e) => handleCopy(activePrompt.text, `header-copy-${shotId}`, e)}
            disabled={!activePrompt.hasPrompt}
            className={`min-h-[36px] sm:min-h-[30px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition flex-1 sm:flex-initial justify-center ${
              copiedKey === `header-copy-${shotId}`
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-[#151728] border-[#25284A] hover:bg-[#202444] text-slate-300 hover:text-white'
            } disabled:opacity-35`}
            title="Salin Positive Prompt Saja"
          >
            {copiedKey === `header-copy-${shotId}` ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied Pos!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Pos</span>
              </>
            )}
          </button>

          {/* Core Pipeline Generator Trigger */}
          <button
            onClick={(e) => handleRegenerate(false, e)}
            disabled={isGenerating}
            className="min-h-[36px] sm:min-h-[30px] px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20 disabled:opacity-40 w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Compiling...' : 'Run Compiler'}</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. CREATIVE WORKSPACE TAB SELECTION BAR                               */}
      {/* ===================================================================== */}
      <div className="px-3 sm:px-4 bg-[#0A0B14] border-b border-[#18192E] flex flex-wrap items-center justify-between shrink-0">
        <div className="flex items-center -mb-px overflow-x-auto scrollbar-none py-1 sm:py-0 w-full sm:w-auto">
          {([
            { id: 'overview', label: 'Overview console', icon: <Clapperboard className="w-3.5 h-3.5" /> },
            { id: 'prompt', label: 'Prompt Engine', icon: <Terminal className="w-3.5 h-3.5" /> },
            { id: 'camera', label: 'Camera & Specs', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
            { id: 'continuity', label: 'Continuity Locks', icon: <Lock className="w-3.5 h-3.5" /> },
            { id: 'assets', label: 'Asset linkages', icon: <Package className="w-3.5 h-3.5" /> },
            { id: 'validation', label: 'Validation Logs', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
          ] as const).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[44px] px-3 sm:px-4 py-2 text-[11px] font-mono font-bold tracking-wider uppercase border-b-2 flex items-center gap-2 shrink-0 transition-all select-none ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mini version indicator of compiler */}
        <span className="hidden sm:inline text-[9px] font-mono text-slate-500">
          Compiler v5.5 • Target: <strong className="text-amber-400 font-normal">{activeMeta.shortName}</strong>
        </span>
      </div>

      {/* ===================================================================== */}
      {/* 3. DYNAMIC WORKSPACE PANEL CONTENT                                    */}
      {/* ===================================================================== */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#07080E] p-4">
        
        {/* TAB 1: OVERVIEW PANEL */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Visual Stage (60%) */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-3 bg-[#0A0C16] border border-[#1B1E34] p-3.5 rounded-xl">
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-[#030408] border border-[#1A1C30] flex items-center justify-center group shadow-2xl">
                {shot.image_url || shot.shot_image_url ? (
                  <img
                    src={shot.image_url || shot.shot_image_url || ''}
                    alt={`Keyframe S${sceneNumber}.${shot.shot_number}`}
                    className="w-full h-full object-cover hover:scale-105 transition duration-500 cursor-pointer"
                    onClick={() => setIsLightboxOpen(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900/80 border border-[#232742] flex items-center justify-center mx-auto">
                      <ImageIcon className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-mono font-bold text-slate-400 block uppercase">NO VISUAL ASSET</span>
                      <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed mx-auto">
                        Generate or attach a keyframe to preview this Shot segment.
                      </p>
                    </div>
                  </div>
                )}

                {/* Simulated Video Playback Track Timeline for Video platform prompts */}
                {['veo', 'omni', 'seedance_10', 'seedance_30'].includes(selectedTarget) && (
                  <div className="absolute bottom-2 left-2 right-2 bg-black/75 border border-white/10 rounded-lg p-2 backdrop-blur-sm flex flex-col gap-1 text-[9px] font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span>VIDEO RENDERING SIMULATION TAPE</span>
                      </span>
                      <span className="text-indigo-300">00:00 / 00:10</span>
                    </div>
                    {/* Visual progress track */}
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full w-2/5 bg-indigo-500 rounded-full" />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500 pt-0.5">
                      <span>0.0s [KEYFRAME]</span>
                      <span>5.0s [SFX SYNC]</span>
                      <span>10.0s [TAIL OUT]</span>
                    </div>
                  </div>
                )}

                {/* Inline Quick Action Badge Options */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-200">
                  {shot.image_url && (
                    <button
                      onClick={() => setIsLightboxOpen(true)}
                      className="p-1.5 rounded bg-black/80 hover:bg-black text-cyan-300 border border-white/10 transition"
                      title="Saksikan Keyframe Penuh"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] font-mono flex items-center gap-1 shadow-lg transition"
                  >
                    <Upload className="w-3 h-3 text-black" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>

              {/* Upload trigger specs summary */}
              <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition"
                >
                  <Upload className="w-3 h-3" />
                  <span>{shot.image_url ? 'Ganti Keyframe Ref' : 'Bind Visual Frame'}</span>
                </button>
                {shot.image_url && (
                  <button
                    onClick={() => onUpdateShotImage?.(shotId, null)}
                    className="text-slate-500 hover:text-rose-400 transition"
                  >
                    Hapus Master Frame
                  </button>
                )}
              </div>
            </div>

            {/* Quick Intelligence Panel (40%) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3 bg-[#0A0C16] border border-[#1B1E34] p-3.5 rounded-xl">
              <div className="space-y-3 flex-1">
                {/* Narrative Slate Row */}
                <div className="bg-[#040509] p-3 rounded-lg border border-[#1C1F38] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                      ALUR CERITA &amp; EVENT DETAIL
                    </span>
                    {compiledPromptsList.length > 0 && (
                      <span className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{compiledPromptsList.length} PROMPT READY</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed max-h-24 overflow-y-auto select-text font-serif">
                    "{mainAction}"
                  </p>

                  {/* PROMPT SHORTCUTS (POS + NEG) IN ALUR CERITA LAYER */}
                  {compiledPromptsList.length > 0 ? (
                    <div className="pt-2 border-t border-[#181B30] space-y-1.5">
                      <span className="text-[9px] font-mono text-amber-400 font-bold uppercase block tracking-wider">
                        ⚡ SALIN PROMPT POS + NEG (1-CLICK SHORTCUTS):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {compiledPromptsList.map(({ target, meta, combinedText }) => {
                          const key = `alur-copy-${shotId}-${target}`;
                          const isCopied = copiedKey === key;
                          return (
                            <button
                              key={target}
                              onClick={(e) => handleCopy(combinedText, key, e)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-extrabold flex items-center gap-1.5 border transition ${
                                isCopied
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                                  : 'bg-[#121428] hover:bg-[#1B1E3B] text-amber-300 hover:text-amber-200 border-[#2A2E50]'
                              }`}
                              title={`Klik untuk Salin Positif & Negatif Prompt (${meta.fullName})`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copied ({meta.shortName})!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-amber-400" />
                                  <span>{meta.shortName}</span>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[#181B30] flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono text-slate-500 italic">Prompt belum digenerate</span>
                      <button
                        onClick={(e) => handleRegenerate(false, e)}
                        disabled={isGenerating}
                        className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white border border-indigo-500/30 flex items-center gap-1 transition disabled:opacity-40"
                      >
                        <Sparkles className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                        <span>{isGenerating ? 'Generating...' : '⚡ Generate Prompt Now'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Real Relationships */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">
                    ACTIVE SCENE ENTITIES
                  </span>
                  
                  {/* Cast / Characters present */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Tokoh Aktif:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeCharacters.length > 0 ? (
                        activeCharacters.map((c) => {
                          const charKey = `entity-char-${c.id}`;
                          const isCopied = copiedKey === charKey;
                          return (
                            <button
                              key={c.id}
                              onClick={(e) => {
                                const bundle = buildCharacterFullBundle(c);
                                handleCopy(bundle, charKey, e);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                openWindow({
                                  id: `char-${c.id}`,
                                  type: 'character_detail',
                                  title: `Karakter: ${c.name}`,
                                  subtitle: c.role || 'Visual Character Bible',
                                  data: c,
                                });
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-mono transition flex items-center gap-1.5 cursor-pointer border ${
                                isCopied
                                  ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold shadow-lg shadow-emerald-500/20'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                              }`}
                              title="1-Click: Salin Prompt & Negative | Double-click: Buka Bible Window"
                            >
                              <Users className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{c.name}</span>
                              {isCopied && <span className="text-[8px] bg-emerald-400/30 text-emerald-100 px-1 rounded font-bold">✓ Tersalin!</span>}
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 italic">No explicit character role.</span>
                      )}
                    </div>
                  </div>

                  {/* Setting / Location present */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Lokasi:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeLocations.length > 0 ? (
                        activeLocations.map((loc) => {
                          const locKey = `entity-loc-${loc.id}`;
                          const isCopied = copiedKey === locKey;
                          return (
                            <button
                              key={loc.id}
                              onClick={(e) => {
                                const bundle = buildLocationFullBundle(loc);
                                handleCopy(bundle, locKey, e);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                openWindow({
                                  id: `loc-${loc.id}`,
                                  type: 'location_detail',
                                  title: `Lokasi: ${loc.name}`,
                                  subtitle: loc.environment || 'Visual Environment Bible',
                                  data: loc,
                                });
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-mono transition flex items-center gap-1.5 text-left cursor-pointer border ${
                                isCopied
                                  ? 'bg-amber-500/30 text-amber-200 border-amber-400 font-bold shadow-lg shadow-amber-500/20'
                                  : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                              }`}
                              title="1-Click: Salin Prompt & Negative | Double-click: Buka Bible Window"
                            >
                              <MapPin className="w-2.5 h-2.5 text-amber-400" />
                              <span>{loc.name}</span>
                              {isCopied && <span className="text-[8px] bg-amber-400/30 text-amber-100 px-1 rounded font-bold">✓ Tersalin!</span>}
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 italic">Global Environment.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Production Gate Checks */}
              <div className="border-t border-[#1C1F38] pt-3 mt-1 space-y-2">
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Production Gates Checks:</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="flex items-center justify-between p-1.5 bg-[#04050A] rounded border border-[#16182C]">
                    <span className="text-slate-400">PROMPT COMPILING</span>
                    <span className={activePrompt.hasPrompt ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {activePrompt.hasPrompt ? '✓ PASSED' : '⚠ EMPTY'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-[#04050A] rounded border border-[#16182C]">
                    <span className="text-slate-400">CONTINUITY LOCK</span>
                    <span className={(locks.character_locked && locks.location_locked) ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {(locks.character_locked && locks.location_locked) ? '✓ SECURED' : '⚠ DRIFT'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-[#04050A] rounded border border-[#16182C]">
                    <span className="text-slate-400">VISUAL REFERENCE</span>
                    <span className={shot.image_url ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {shot.image_url ? '✓ DETECTED' : '⚠ MISSING'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-[#04050A] rounded border border-[#16182C]">
                    <span className="text-slate-400">PRODUCTION STATUS</span>
                    <span className={validationDiagnostics.length === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {validationDiagnostics.length === 0 ? '✓ READY' : '⚠ BLOCKED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROMPT ENGINE COCKPIT */}
        {activeTab === 'prompt' && (
          <div className="space-y-4">
            {/* Target platform selection row */}
            <div className="bg-[#0A0C16] border border-[#1B1E34] p-3 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181B30] pb-2">
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                  RESOLVED VIDEO GENERATOR ADAPTER:
                </span>
                
                {/* Dedicated Copy Both & Regenerate Buttons for currently selected adapter */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleRegenerate(false, e)}
                    disabled={isGenerating}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 shadow-md shadow-indigo-600/20 transition disabled:opacity-40"
                    title={`Compile/Generate Prompt untuk ${activeMeta.shortName}`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? 'Compiling...' : activePrompt.hasPrompt ? `Regenerate (${activeMeta.shortName})` : `Generate (${activeMeta.shortName})`}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      const fullText = `[POSITIVE PROMPT - ${activeMeta.fullName.toUpperCase()}]\n${activePrompt.text}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${negativePromptText}`;
                      handleCopy(fullText, `panel-adapter-both-${shotId}-${selectedTarget}`, e);
                    }}
                    disabled={!activePrompt.hasPrompt}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-extrabold flex items-center gap-1.5 border transition ${
                      copiedKey === `panel-adapter-both-${shotId}-${selectedTarget}`
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-amber-500 text-black hover:bg-amber-400 border-amber-400 shadow-md shadow-amber-500/20'
                    } disabled:opacity-35`}
                    title={`Salin Positive + Negative Prompt Sekaligus untuk Engine ${activeMeta.fullName}`}
                  >
                    {copiedKey === `panel-adapter-both-${shotId}-${selectedTarget}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied Both ({activeMeta.shortName})!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Pos + Neg ({activeMeta.shortName})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Adapter Target Chips */}
              <div className="flex flex-wrap gap-1.5">
                {SHOT_PROMPT_TARGETS.map((target) => {
                  const meta = PROVIDER_METADATA[target];
                  const isActive = selectedTarget === target;
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => setSelectedTarget(target)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 border shrink-0 ${
                        isActive
                          ? meta.chipActive
                          : 'bg-[#121426] hover:bg-[#1B1E36] text-slate-400 hover:text-slate-200 border-[#212543]'
                      }`}
                      title={meta.fullName}
                    >
                      {meta.icon}
                      <span>{meta.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compiled Prompt Editor Boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Positive prompt body (7 columns) */}
              <div className="lg:col-span-7 bg-[#0A0C16] border border-[#1B1E34] p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Positive compiled prompt ({activeMeta.shortName}):</span>
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleRegenerate(false, e)}
                      disabled={isGenerating}
                      className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1 font-bold bg-[#14162B] hover:bg-[#1E2244] px-2 py-1 rounded border border-[#23274D] transition disabled:opacity-40"
                      title="Generate / Regenerate Prompt"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? 'Compiling' : 'Regenerate'}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        const fullText = `[POSITIVE PROMPT - ${activeMeta.fullName.toUpperCase()}]\n${activePrompt.text}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${negativePromptText}`;
                        handleCopy(fullText, `box-both-${shotId}`, e);
                      }}
                      disabled={!activePrompt.hasPrompt}
                      className={`text-[10px] flex items-center gap-1 font-extrabold px-2 py-1 rounded border transition ${
                        copiedKey === `box-both-${shotId}`
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:text-white'
                      } disabled:opacity-35`}
                      title="Salin Positif & Negatif Prompt Sekaligus"
                    >
                      {copiedKey === `box-both-${shotId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
                      <span>{copiedKey === `box-both-${shotId}` ? 'Copied Both' : 'Copy Pos + Neg'}</span>
                    </button>

                    <button
                      onClick={(e) => handleCopy(activePrompt.text, `panel-pos-${shotId}`, e)}
                      disabled={!activePrompt.hasPrompt}
                      className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1 font-bold bg-[#14162B] px-2 py-1 rounded border border-[#23274D] transition disabled:opacity-35"
                      title="Salin Positive Prompt Saja"
                    >
                      {copiedKey === `panel-pos-${shotId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === `panel-pos-${shotId}` ? 'Copied' : 'Copy Prompt'}</span>
                    </button>
                  </div>
                </div>

                {!activePrompt.hasPrompt ? (
                  <div className="py-7 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-[#030408] rounded-lg border border-dashed border-[#252848]">
                    <Sparkles className="w-7 h-7 text-amber-400 animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-xs font-mono font-bold text-slate-200">
                        Prompt {activeMeta.fullName} belum digenerate
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 max-w-sm">
                        Klik tombol di bawah untuk menyusun prompt sinematik presisi durasi {shotDurationSec}s.
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleRegenerate(false, e)}
                      disabled={isGenerating}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-extrabold text-xs font-mono flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-40"
                    >
                      <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? 'Menyusun Prompt...' : `⚡ Generate Prompt (${activeMeta.shortName}) Now`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#030408] border border-[#181A2F] rounded-lg p-3.5 font-mono text-[11px] leading-relaxed text-slate-100 max-h-56 overflow-y-auto select-all whitespace-pre-wrap">
                    {activePrompt.text}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>Engine contract: <strong className="text-slate-300 font-normal">{activeMeta.engine}</strong></span>
                  <span>{activePrompt.text.length} characters</span>
                </div>
              </div>

              {/* Negative prompt body (5 columns) */}
              <div className="lg:col-span-5 bg-[#0A0C16] border border-[#1B1E34] p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Dynamic negative parameters:</span>
                  </span>
                  <button
                    onClick={(e) => handleCopy(negativePromptText, `panel-neg-${shotId}`, e)}
                    className="text-[10px] text-rose-300 hover:text-white flex items-center gap-1.5 font-bold bg-[#1B141E] px-2 py-1 rounded border border-[#3A222C] transition"
                    title="Salin Negative Prompt Saja"
                  >
                    {copiedKey === `panel-neg-${shotId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === `panel-neg-${shotId}` ? 'Copied' : 'Copy Neg'}</span>
                  </button>
                </div>
                <div className="bg-[#050406] border border-[#2D1C1C] rounded-lg p-3.5 font-mono text-[11px] leading-relaxed text-slate-400 max-h-56 overflow-y-auto select-all whitespace-pre-wrap">
                  {negativePromptText}
                </div>
                <p className="text-[9px] text-slate-500 font-mono italic leading-normal">
                  Prevents dynamic distortions, camera artifacts, physical drift, and visual noise of model generation.
                </p>
              </div>
            </div>

            {/* Prompt advanced workbench link */}
            <div className="bg-[#0B0D18] border border-[#1E223D] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-slate-200">Sandbox Compile Mode &amp; Prompt Workbench</h5>
                <p className="text-[10px] text-slate-500 font-mono">
                  Require isolated sandbox compilers or historical versions tracing?
                </p>
              </div>
              <button
                onClick={() => {
                  // Direct seamless workspace shift
                  const promptsTabBtn = document.querySelector('[id*="shots"]') || document.querySelector('[class*="Overview"]');
                  if (promptsTabBtn) {
                    setIsFocusOpen(true);
                  } else {
                    setIsFocusOpen(true);
                  }
                }}
                className="px-3.5 py-1.5 bg-[#171A34] hover:bg-[#20254C] text-indigo-300 hover:text-white border border-[#252C58] rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <span>Launch Full Prompt Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: CAMERA & SPECS PANEL */}
        {activeTab === 'camera' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Real-time Lock Integrations */}
            <div className="bg-[#0A0C16] border border-[#1B1E34] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-bold uppercase text-indigo-400 block">
                  CONSTRAINTS &amp; INVARIANT GATEWAYS
                </span>
                <p className="text-[10px] text-slate-500 font-mono">
                  Toggle lock gates to force camera and composition vectors as hard compiler rules.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleLock('camera_locked')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition border ${
                    locks.camera_locked
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-[#121424] border-[#1C1F38] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {locks.camera_locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                  <span>Camera Lock: {locks.camera_locked ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleLock('composition_locked')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition border ${
                    locks.composition_locked
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-[#121424] border-[#1C1F38] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {locks.composition_locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                  <span>Composition Lock: {locks.composition_locked ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Presets Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Camera Presets Row */}
              <div className="bg-[#0A0C16] border border-[#1B1E34] p-3 rounded-xl space-y-2">
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                  CAMERA PRESET PACKS:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CAMERA_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleUpdateShot({ camera: p.camera })}
                      className="px-2 py-1 text-[10px] font-mono bg-[#14162B] border border-[#23274D] text-slate-300 hover:text-white rounded hover:bg-[#1C1E3C] transition"
                    >
                      ★ {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Composition Presets Row */}
              <div className="bg-[#0A0C16] border border-[#1B1E34] p-3 rounded-xl space-y-2">
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                  COMPOSITION PRESET PACKS:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMPOSITION_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleUpdateShot({ composition: p.composition })}
                      className="px-2 py-1 text-[10px] font-mono bg-[#1A142B] border border-[#3A234D] text-slate-300 hover:text-white rounded hover:bg-[#251C3C] transition"
                    >
                      ★ {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Attributes Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Camera Attributes */}
              <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-indigo-400 block">
                  STRUCTURED CAMERA CONFIG
                </span>
                <div className="grid grid-cols-2 gap-2.5 text-[10px] font-mono">
                  {/* Framing Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Framing:</span>
                    <select
                      value={currentCamera.framing || ''}
                      onChange={(e) => updateCameraField('framing', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="CU (Close Up)">CU (Close Up)</option>
                      <option value="MCU (Medium Close Up)">MCU (Medium Close Up)</option>
                      <option value="MS (Medium Shot)">MS (Medium Shot)</option>
                      <option value="WS (Wide Shot)">WS (Wide Shot)</option>
                      <option value="EWS (Extreme Wide Shot)">EWS (Extreme Wide Shot)</option>
                    </select>
                  </div>

                  {/* Angle Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Angle:</span>
                    <select
                      value={currentCamera.angle || ''}
                      onChange={(e) => updateCameraField('angle', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Eye-Level">Eye-Level</option>
                      <option value="Low Angle">Low Angle</option>
                      <option value="High Angle">High Angle</option>
                      <option value="Bird's Eye">Bird's Eye</option>
                      <option value="Dutch Angle">Dutch Angle</option>
                    </select>
                  </div>

                  {/* Lens Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Lens Style:</span>
                    <select
                      value={currentCamera.lens || ''}
                      onChange={(e) => updateCameraField('lens', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Standard Spherical">Standard Spherical</option>
                      <option value="Anamorphic Prime">Anamorphic Prime</option>
                      <option value="Vintage Cinema">Vintage Cinema</option>
                      <option value="Macro Detail">Macro Detail</option>
                    </select>
                  </div>

                  {/* Focal Length Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Focal Length:</span>
                    <select
                      value={currentCamera.focal_length || ''}
                      onChange={(e) => updateCameraField('focal_length', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="18mm Ultra-Wide">18mm Ultra-Wide</option>
                      <option value="24mm Wide">24mm Wide</option>
                      <option value="35mm Cine Standard">35mm Cine Standard</option>
                      <option value="50mm Prime">50mm Prime</option>
                      <option value="85mm Telephoto">85mm Telephoto</option>
                    </select>
                  </div>

                  {/* Movement Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Movement Track:</span>
                    <select
                      value={currentCamera.movement || ''}
                      onChange={(e) => updateCameraField('movement', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Static Tripod">Static Tripod</option>
                      <option value="Slow Push-In">Slow Push-In</option>
                      <option value="Slow Pull-Out">Slow Pull-Out</option>
                      <option value="Pan Left/Right">Pan Left/Right</option>
                      <option value="Dolly Tracking">Dolly Tracking</option>
                    </select>
                  </div>

                  {/* Depth of Field Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Depth of Field:</span>
                    <select
                      value={currentCamera.depth_of_field || ''}
                      onChange={(e) => updateCameraField('depth_of_field', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Shallow (f/1.8)">Shallow (f/1.8)</option>
                      <option value="Moderate (f/2.8)">Moderate (f/2.8)</option>
                      <option value="Deep (f/8.0)">Deep (f/8.0)</option>
                    </select>
                  </div>

                  {/* Position Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Positioning:</span>
                    <select
                      value={currentCamera.position || ''}
                      onChange={(e) => updateCameraField('position', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Frontal Centered">Frontal Centered</option>
                      <option value="Three-Quarter View">Three-Quarter View</option>
                      <option value="Over-the-Shoulder">Over-the-Shoulder</option>
                      <option value="Rear Silhouette">Rear Silhouette</option>
                    </select>
                  </div>

                  {/* Speed Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Capture Speed:</span>
                    <select
                      value={currentCamera.speed || ''}
                      onChange={(e) => updateCameraField('speed', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Realtime (24fps)">Realtime (24fps)</option>
                      <option value="Slow Motion (60fps)">Slow Motion (60fps)</option>
                      <option value="Hyper-Slow (120fps)">Hyper-Slow (120fps)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Composition Attributes */}
              <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-indigo-400 block">
                  STRUCTURED COMPOSITION CONFIG
                </span>
                <div className="grid grid-cols-2 gap-2.5 text-[10px] font-mono">
                  {/* Layout Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Layout Matrix:</span>
                    <select
                      value={currentComposition.layout || ''}
                      onChange={(e) => updateCompositionField('layout', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Rule of Thirds">Rule of Thirds</option>
                      <option value="Symmetrical / Centered">Symmetrical / Centered</option>
                      <option value="Golden Spiral">Golden Spiral</option>
                      <option value="Diagonal Leading Lines">Diagonal Leading Lines</option>
                    </select>
                  </div>

                  {/* Subject Placement Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Subject Placement:</span>
                    <select
                      value={currentComposition.subject_placement || ''}
                      onChange={(e) => updateCompositionField('subject_placement', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Dead Center">Dead Center</option>
                      <option value="Left Third">Left Third</option>
                      <option value="Right Third">Right Third</option>
                      <option value="Lower Foreground">Lower Foreground</option>
                    </select>
                  </div>

                  {/* Visual Balance Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Visual Balance:</span>
                    <select
                      value={currentComposition.visual_balance || ''}
                      onChange={(e) => updateCompositionField('visual_balance', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Perfect Balance">Perfect Balance</option>
                      <option value="Asymmetric Dynamic">Asymmetric Dynamic</option>
                      <option value="Negative Space Dominated">Negative Space Dominated</option>
                    </select>
                  </div>

                  {/* Foreground Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Foreground Layer:</span>
                    <select
                      value={currentComposition.foreground || ''}
                      onChange={(e) => updateCompositionField('foreground', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Clean / Unobstructed">Clean / Unobstructed</option>
                      <option value="Over-the-Shoulder Silhouette">Over-the-Shoulder Silhouette</option>
                      <option value="Out-of-Focus Foliage">Out-of-Focus Foliage</option>
                      <option value="Atmospheric Particulate">Atmospheric Particulate</option>
                    </select>
                  </div>

                  {/* Background Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Background Layer:</span>
                    <select
                      value={currentComposition.background || ''}
                      onChange={(e) => updateCompositionField('background', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Cinematic Bokeh Blur">Cinematic Bokeh Blur</option>
                      <option value="In-Focus Historical Details">In-Focus Historical Details</option>
                      <option value="Dramatic Chiaroscuro Shadows">Dramatic Chiaroscuro Shadows</option>
                      <option value="Vast Desert Horizon">Vast Desert Horizon</option>
                    </select>
                  </div>

                  {/* Spatial Relationship Select */}
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase">Spatial Relation:</span>
                    <select
                      value={currentComposition.spatial_relationship || ''}
                      onChange={(e) => updateCompositionField('spatial_relationship', e.target.value)}
                      className="w-full bg-[#04050A] border border-[#1C1F38] text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400 font-mono animate-none"
                    >
                      <option value="Intimate Proximity">Intimate Proximity</option>
                      <option value="Distant Isolation">Distant Isolation</option>
                      <option value="Dominant Low Position">Dominant Low Position</option>
                      <option value="Submissive High Angle">Submissive High Angle</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CONTINUITY & LOCKS PANEL */}
        {activeTab === 'continuity' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Toggle Locks Section */}
            <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-200 uppercase">PROMPT LOCKING GATE MATRIX</h5>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Enable or disable prompt lock states to preserve identity anchors during smart regenerations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[10px] font-mono">
                {([
                  { key: 'character_locked', label: 'Character Identity' },
                  { key: 'location_locked', label: 'Location Anchor' },
                  { key: 'costume_locked', label: 'Wardrobe & Costume' },
                  { key: 'lighting_locked', label: 'Lighting & Atmosphere' },
                  { key: 'camera_locked', label: 'Camera Preset' },
                  { key: 'composition_locked', label: 'Composition Grid' },
                ] as const).map((item) => {
                  const isLocked = locks[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleLock(item.key)}
                      className={`p-2.5 rounded border flex flex-col items-center justify-between h-14 transition ${
                        isLocked
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 font-bold shadow-md shadow-amber-950/20'
                          : 'bg-[#121424] text-slate-500 border-[#20233A]'
                      }`}
                    >
                      {isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400 mb-1" /> : <Unlock className="w-3.5 h-3.5 mb-1" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smart regenerate popup builder drawer */}
            <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-200 uppercase">SMART REGENERATE ENTRYPOINT</h5>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Leverage Gemini model to rewrite this shot's instructions keeping active locks sealed.
                  </p>
                </div>
                <button
                  onClick={() => setShowSmartPanel(!showSmartPanel)}
                  className="px-3 py-1 rounded bg-[#171A30] hover:bg-[#202548] border border-[#282D54] text-[10px] font-mono transition"
                >
                  {showSmartPanel ? 'Hide Config' : 'Show Settings'}
                </button>
              </div>

              {showSmartPanel && (
                <div className="p-3 bg-[#04050A] border border-[#1A1C30] rounded-lg space-y-3 text-[10px] font-mono animate-in slide-in-from-top duration-200">
                  <div className="space-y-1">
                    <span className="text-slate-400">Regeneration Intent / Prompt Reason:</span>
                    <input
                      type="text"
                      value={smartReason}
                      onChange={(e) => setSmartReason(e.target.value)}
                      className="w-full bg-[#070914] border border-[#222543] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={(e) => handleRegenerate(false, e)}
                      className="px-3 py-1.5 bg-[#171A30] border border-[#2C3259] text-slate-200 font-bold rounded"
                    >
                      Fast Update
                    </button>
                    <button
                      onClick={(e) => handleRegenerate(true, e)}
                      className="px-3 py-1.5 bg-amber-500 text-black font-extrabold rounded hover:bg-amber-400 transition"
                    >
                      AI Orchestrated rewrite
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ASSETS & CAST LINKAGES */}
        {activeTab === 'assets' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cast/Characters details panel */}
              <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>CHARACTER REFS &amp; WARDROBE LOCK</span>
                </span>

                {activeCharacters.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {activeCharacters.map((c, idx) => {
                      const charKey = `card-char-${c.id || idx}`;
                      const isCopied = copiedKey === charKey;
                      return (
                        <div
                          key={c.id || idx}
                          onClick={(e) => {
                            const bundle = buildCharacterFullBundle(c);
                            handleCopy(bundle, charKey, e);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openWindow({
                              id: `char-${c.id}`,
                              type: 'character_detail',
                              title: `Karakter: ${c.name}`,
                              subtitle: c.role || 'Visual Character Bible',
                              data: c,
                            });
                          }}
                          className={`p-2.5 bg-[#04050A] border rounded-lg flex items-start justify-between gap-2.5 transition cursor-pointer ${
                            isCopied ? 'border-emerald-400 bg-emerald-950/20' : 'border-[#191B2F] hover:border-emerald-500/40'
                          }`}
                          title="Klik 1x untuk salin Positif + Negatif Prompt | Double-click untuk Buka Window"
                        >
                          <div className="flex items-start gap-2.5">
                            {(c as any).image_url ? (
                              <img
                                src={(c as any).image_url}
                                alt={c.name}
                                className="w-10 h-10 object-cover rounded-md border border-[#202440] shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-slate-900 border border-[#202440] rounded-md flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                            <div className="space-y-0.5 text-[11px]">
                              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {isCopied && <span className="text-[8px] bg-emerald-500/30 text-emerald-200 px-1 rounded font-mono font-bold">✓ Tersalin</span>}
                              </div>
                              <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{(c as any).description || c.physical_description || c.personality}</p>
                              {c.costume && <div className="text-[9px] text-slate-500 font-mono">Wardrobe: {c.costume}</div>}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-emerald-400/70 shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {isCopied ? 'Copied' : '1-Click Copy'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No character references mapped to this shot.</p>
                )}
              </div>

              {/* Locations details panel */}
              <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>LOCATION &amp; ENVIRONMENT SETTINGS</span>
                </span>

                {activeLocations.length > 0 ? (
                  <div className="space-y-2">
                    {activeLocations.map((loc) => {
                      const locKey = `card-loc-${loc.id}`;
                      const isCopied = copiedKey === locKey;
                      return (
                        <div
                          key={loc.id}
                          onClick={(e) => {
                            const bundle = buildLocationFullBundle(loc);
                            handleCopy(bundle, locKey, e);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openWindow({
                              id: `loc-${loc.id}`,
                              type: 'location_detail',
                              title: `Lokasi: ${loc.name}`,
                              subtitle: loc.environment || 'Visual Environment Bible',
                              data: loc,
                            });
                          }}
                          className={`p-3 bg-[#04050A] border rounded-lg flex items-start justify-between gap-2.5 transition cursor-pointer ${
                            isCopied ? 'border-amber-400 bg-amber-950/20' : 'border-[#191B2F] hover:border-amber-500/40'
                          }`}
                          title="Klik 1x untuk salin Positif + Negatif Prompt | Double-click untuk Buka Window"
                        >
                          <div className="flex items-start gap-2.5">
                            {(loc as any).image_url ? (
                              <img
                                src={(loc as any).image_url}
                                alt={loc.name}
                                className="w-12 h-12 object-cover rounded-md border border-[#202440] shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-slate-900 border border-[#202440] rounded-md flex items-center justify-center shrink-0">
                                <MapPin className="w-5 h-5 text-slate-500" />
                              </div>
                            )}
                            <div className="space-y-0.5 text-[11px]">
                              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                                <span>{loc.name}</span>
                                {isCopied && <span className="text-[8px] bg-amber-500/30 text-amber-200 px-1 rounded font-mono font-bold">✓ Tersalin</span>}
                              </div>
                              <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{loc.description}</p>
                              {loc.architectural_style && <div className="text-[9px] text-slate-500 font-mono">Style: {loc.architectural_style}</div>}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-amber-400/70 shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {isCopied ? 'Copied' : '1-Click Copy'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No environment setting references mapped.</p>
                )}
              </div>
            </div>

            {/* Asset Graph link button */}
            <div className="bg-[#0B0D18] border border-[#1E223D] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-slate-200">Asset Dependency Graph &amp; Impact Analysis</h5>
                <p className="text-[10px] text-slate-500 font-mono">
                  Inspect entire project assets, relationships, and upstream cascade dependencies.
                </p>
              </div>
              <button
                onClick={() => {
                  openWindow({
                    id: 'integrity-telemetry-graph',
                    type: 'telemetry_graph',
                    title: 'Asset Graph & Integrity Telemetry',
                    subtitle: 'Upstream Cascade & Regression Map',
                    icon: <Activity className="w-4 h-4 text-cyan-400" />,
                  });
                }}
                className="px-3.5 py-1.5 bg-[#171A34] hover:bg-[#20254C] text-indigo-300 hover:text-white border border-[#252C58] rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <span>Open Dependency Graph</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: INTEGRITY & VALIDATION LOGS */}
        {activeTab === 'validation' && (
          <div className="space-y-4">
            <div className="bg-[#0A0C16] border border-[#1B1E34] p-4 rounded-xl space-y-3">
              <span className="text-xs font-mono font-bold uppercase text-rose-400 block">
                INTEGRITY INSPECTOR CHECKLIST
              </span>

              {validationDiagnostics.length > 0 ? (
                <div className="space-y-2">
                  {validationDiagnostics.map((diag, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border flex items-start gap-3 ${
                        diag.severity === 'error'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <div className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black ${
                        diag.severity === 'error' ? 'bg-rose-500 text-black' : 'bg-amber-500 text-black'
                      }`}>
                        {diag.code}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="text-xs font-bold font-mono">
                          {diag.severity === 'error' ? 'CRITICAL ERROR' : 'CONTINUITY WARNING'}
                        </div>
                        <p className="text-[11px] leading-normal">{diag.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#040509] border border-[#15172C] rounded-lg space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-bold text-slate-300 block uppercase">ALL CHECKS PASSED</span>
                    <p className="text-[10px] text-slate-500 font-mono">
                      No continuity drift, uncompiled code, or unassigned visual frames found for this Shot.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ===================================================================== */}
      {/* 4. VISUAL HORIZONTAL NAVIGATOR STRIP (FOOTER)                         */}
      {/* ===================================================================== */}
      {sceneShots.length > 1 && (
        <div className="px-4 py-2 bg-[#0B0C16] border-t border-[#1C1E32] shrink-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider font-extrabold shrink-0">
              Scene Shots Matrix:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 min-w-0 flex-1 justify-end scrollbar-thin">
              {sceneShots.map((s) => {
                const isCurrent = s.id === shot.id;
                const isDone = s.image_url || s.shot_image_url;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleShotChange(s)}
                    className={`px-2.5 py-1 text-[10px] font-mono rounded border transition flex items-center gap-1 shrink-0 ${
                      isCurrent
                        ? 'bg-indigo-600 border-indigo-400 text-white font-black shadow-md shadow-indigo-600/10'
                        : isDone
                        ? 'bg-[#121424] border-[#222544] text-indigo-300 hover:text-white'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span>S{String(sceneNumber).padStart(2, '0')}.{String(s.shot_number).padStart(2, '0')}</span>
                    {isDone && <span className="w-1 h-1 rounded-full bg-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. LIGHTBOX & UPLOAD POPUPS                                           */}
      {/* ===================================================================== */}

      {/* LIGHTBOX INTERFACE */}
      {isLightboxOpen && (shot.image_url || shot.shot_image_url) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={shot.image_url || shot.shot_image_url || ''}
              alt={`S${sceneNumber}.${shot.shot_number}`}
              className="max-h-[80vh] w-auto object-contain rounded-xl border border-white/10 shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <div className="mt-3 flex items-center justify-between w-full text-xs font-mono text-slate-300 px-2">
              <span>Shot Master Frame - S{String(sceneNumber).padStart(2, '0')}.{String(shot.shot_number).padStart(2, '0')}</span>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B1D32] hover:bg-[#252846] text-white border border-[#2B2F52] transition"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT FILE & URL UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsUploadModalOpen(false)}
        >
          <div
            className="bg-[#121528] border border-[#282D50] rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#202542] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Upload Frame Ref S{sceneNumber}.{shot.shot_number}</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct computer local file drag & drop area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`p-7 rounded-xl border-2 border-dashed text-center space-y-2 cursor-pointer group transition ${
                isDragging ? 'border-amber-400 bg-amber-950/10' : 'border-[#242A4E] hover:border-amber-400/70'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-slate-500 group-hover:text-amber-400 transition group-hover:scale-105" />
              <div>
                <p className="text-xs font-bold text-slate-200 group-hover:text-white">
                  Pilih File atau Tarik ke Sini
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP didukung langsung</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processUploadedFile(e.target.files[0]);
                  }
                }}
              />
            </div>

            {/* Paste direct URL option */}
            <div className="space-y-2 pt-2 border-t border-[#1F2440]">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Atau Tempel URL Gambar:</span>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-[#070914] border border-[#252A4A] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (urlInput.trim() && onUpdateShotImage) {
                      onUpdateShotImage(shotId, urlInput.trim());
                      setIsUploadModalOpen(false);
                      setUrlInput('');
                    }
                  }}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render optional original popup modals for legacy actions */}
      <FocusWindow
        isOpen={isFocusOpen}
        onClose={() => setIsFocusOpen(false)}
        title={`PROMPT STUDIO: ${activeMeta.fullName}`}
        subtitle={`Scene ${sceneNumber} • Shot #${shot.shot_number} • Target ${activeMeta.shortName}`}
        icon={<Sparkles className="w-4 h-4 text-amber-400" />}
        footerActions={
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleRegenerate(true, e)}
              disabled={isGenerating}
              className="px-3.5 py-1.5 rounded-xl bg-[#1F2342] hover:bg-[#2C315C] text-amber-300 font-bold text-xs flex items-center gap-1.5 transition border border-amber-500/30"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Deep AI Regen</span>
            </button>
            <button
              onClick={(e) => {
                const fullText = `[POSITIVE PROMPT - ${activeMeta.fullName.toUpperCase()}]\n${activePrompt.text}\n\n[NEGATIVE PROMPT / PROMPT LARANGAN]\n${negativePromptText}`;
                handleCopy(fullText, `modal-copy-${shotId}`, e);
              }}
              disabled={!activePrompt.hasPrompt}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
            >
              {copiedKey === `modal-copy-${shotId}` ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Prompt Lengkap</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-[#21243E] pb-2">
            <span>
              Engine: <strong className="text-amber-300 font-sans">{activeMeta.engine}</strong>
            </span>
            <span>
              Karakter: <strong className="text-cyan-300">{activePrompt.text.length}</strong> • Durasi:{' '}
              <strong className="text-emerald-300">{shot.duration_sec || 5}s</strong>
            </span>
          </div>

          <div className="bg-[#05060C] p-4 rounded-xl border border-[#1F223A] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-indigo-400">✨ Positive Prompt Body:</span>
              <button
                onClick={(e) => handleCopy(activePrompt.text, `modal-pos-${shotId}`, e)}
                className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1 font-bold"
              >
                {copiedKey === `modal-pos-${shotId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Salin Positif</span>
              </button>
            </div>
            <pre className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap select-all font-mono">
              {activePrompt.text}
            </pre>
          </div>

          <div className="bg-[#05060C] p-3.5 rounded-xl border border-[#2B1B1B] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-rose-400">⚠️ Dynamic Negative Prompt:</span>
              <button
                onClick={(e) => handleCopy(negativePromptText, `modal-neg-${shotId}`, e)}
                className="text-[10px] text-rose-300 hover:text-white flex items-center gap-1 font-bold"
              >
                {copiedKey === `modal-neg-${shotId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Salin Negatif</span>
              </button>
            </div>
            <pre className="text-slate-400 text-[11px] leading-relaxed whitespace-pre-wrap select-all font-mono">
              {negativePromptText}
            </pre>
          </div>
        </div>
      </FocusWindow>
    </div>
  );
});

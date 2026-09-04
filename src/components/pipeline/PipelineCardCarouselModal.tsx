import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Compass,
  ArrowRight,
  Terminal,
  RotateCcw,
  Zap,
  Film,
  Check,
  Cpu,
  Layers,
  Activity,
  Clock,
} from 'lucide-react';
import { Project, PipelineLogEvent, Scene, Shot, VideoPrompt } from '../../types';
import { PipelineStageArt } from './PipelineStageArt';

interface PipelineCardCarouselModalProps {
  isOpen: boolean;
  project: Project | null;
  logs: PipelineLogEvent[];
  scenes?: Scene[];
  shots?: Record<string, Shot[]>;
  videoPrompts?: Record<string, VideoPrompt[]>;
  isGenerating: boolean;
  error?: string | null;
  onClose: () => void;
  onOpenPipelineDetails: () => void;
  onOpenStudio: () => void;
}

interface StageMeta {
  num: number;
  code: string;
  name: string;
  desc: string;
  conceptQuote: string;
  accentBg: string;
  cardColor: string;
}

const STAGES: StageMeta[] = [
  {
    num: 1,
    code: 'S1',
    name: 'Story Understanding & Parsing',
    desc: 'Menganalisis naskah mentah dan memecah premis utama',
    conceptQuote: 'Membedah arsitektur premis, era zaman, dan jangkar naratif cerita.',
    accentBg: 'from-blue-600 to-indigo-800',
    cardColor: '#173BF5', // Signature electric blue
  },
  {
    num: 2,
    code: 'S2',
    name: 'Character Detection & Wardrobe Lock',
    desc: 'Mengekstrak daftar tokoh, ciri fisik, dan mengunci kostum',
    conceptQuote: 'Mengekstrak dramatis personae & mengunci kontinuitas visual kostum.',
    accentBg: 'from-blue-600 to-indigo-900',
    cardColor: '#173BF5',
  },
  {
    num: 3,
    code: 'S3',
    name: 'Location & Object Bible',
    desc: 'Mengidentifikasi latar tempat, arsitektur, dan properti penting',
    conceptQuote: 'Menyusun kitab spasial, arsitektur lokasi, dan properti berulang.',
    accentBg: 'from-slate-800 to-blue-900',
    cardColor: '#0F172A',
  },
  {
    num: 4,
    code: 'S4',
    name: 'Narrative Structure & Cold Open',
    desc: 'Menyusun arsitektur babak, sekuens, dan kait cold open',
    conceptQuote: 'Mind Map: Memetakan 5-Babak naratif dan kait emosional pembuka.',
    accentBg: 'from-indigo-600 to-blue-800',
    cardColor: '#1E3A8A',
  },
  {
    num: 5,
    code: 'S5',
    name: 'Scene Breakdown & Beats',
    desc: 'Membagi cerita ke dalam adegan dengan durasi otoritatif',
    conceptQuote: 'Membagi naskah ke dalam adegan individual dengan durasi waktu presisi.',
    accentBg: 'from-amber-600 to-orange-700',
    cardColor: '#D9480F', // Warm burnt orange
  },
  {
    num: 6,
    code: 'S6',
    name: 'Shot Subdivision & Pacing',
    desc: 'Mensubdivisi adegan menjadi shot-shot sinematik dengan timing',
    conceptQuote: 'Follow your own path: Memetakan sudut kamera, pergerakan, dan pacing.',
    accentBg: 'from-blue-600 to-indigo-800',
    cardColor: '#173BF5',
  },
  {
    num: 7,
    code: 'S7',
    name: 'Master Frame Prompt Generation',
    desc: 'Membuat visual master frame untuk setiap adegan',
    conceptQuote: 'Generasi visual master frame Nano Banana Pro 16:9 4K sinematik.',
    accentBg: 'from-slate-900 to-indigo-950',
    cardColor: '#090D1A',
  },
  {
    num: 8,
    code: 'S8',
    name: 'Video Prompt Agent (Seedance)',
    desc: 'Menghasilkan prompt video mendetail untuk platform AI video',
    conceptQuote: 'Mengompilasi prompt video lengkap siap render platform AI video.',
    accentBg: 'from-blue-700 to-indigo-900',
    cardColor: '#173BF5',
  },
];

interface LiveWorkerItem {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'queued' | 'idle';
  sceneText: string;
  taskDetail: string;
  badge: string;
}

export const PipelineCardCarouselModal: React.FC<PipelineCardCarouselModalProps> = ({
  isOpen,
  project,
  logs,
  scenes = [],
  shots = {},
  videoPrompts = {},
  isGenerating,
  error,
  onClose,
  onOpenPipelineDetails,
  onOpenStudio,
}) => {
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(0);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const touchStartXRef = useRef<number | null>(null);

  // 1. Total Scenes Count Detection
  const totalScenes = useMemo(() => {
    if (scenes && scenes.length > 0) return scenes.length;
    for (let i = logs.length - 1; i >= 0; i--) {
      const msg = logs[i]?.message || '';
      const m = msg.match(/(?:generasi|seluruh|total)\s*(\d+)\s*scene/i) || msg.match(/(\d+)\s*scene\s*siap/i);
      if (m && parseInt(m[1], 10) > 0) {
        return parseInt(m[1], 10);
      }
    }
    return 12; // Standard default project scope
  }, [scenes, logs]);

  // 2. Scene Stage Completion Counters
  const { s6DoneCount, s7DoneCount, s8DoneCount } = useMemo(() => {
    if (scenes && scenes.length > 0) {
      const s6 = scenes.filter(
        (s) => (shots[s.id || ''] && shots[s.id || ''].length > 0) || s.pipeline_status === 'READY' || s.status === 'ready'
      ).length;
      const s7 = scenes.filter(
        (s) => Boolean(s.master_image_prompt || s.master_frame_image_url) || s.pipeline_status === 'READY' || s.status === 'ready'
      ).length;
      const s8 = scenes.filter((s) => s.status === 'ready' || s.pipeline_status === 'READY').length;
      return { s6DoneCount: s6, s7DoneCount: s7, s8DoneCount: s8 };
    }

    // Fallback: parse log signatures
    const s6Logs = new Set<number>();
    const s7Logs = new Set<number>();
    const s8Logs = new Set<number>();

    logs.forEach((l) => {
      const scMatch = l.message.match(/Scene\s*#?(\d+)/i);
      const scNum = scMatch ? parseInt(scMatch[1], 10) : 0;
      if (scNum > 0) {
        if (l.stage === 6 && (l.level === 'success' || l.message.includes('lolos') || l.message.includes('selesai'))) {
          s6Logs.add(scNum);
        }
        if (l.stage === 7 && (l.level === 'success' || l.message.includes('berhasil') || l.message.includes('siap dipakai'))) {
          s7Logs.add(scNum);
        }
        if (l.stage === 8 && (l.level === 'success' || l.message.includes('selesai') || l.message.includes('READY'))) {
          s8Logs.add(scNum);
        }
      }
    });

    return {
      s6DoneCount: s6Logs.size,
      s7DoneCount: s7Logs.size,
      s8DoneCount: s8Logs.size,
    };
  }, [scenes, shots, logs]);

  const isCompleted = !isGenerating && (project?.status === 'completed' || (s8DoneCount >= totalScenes && totalScenes > 0));

  // 3. Monotonic Director Stage Logic (Adobe Premiere / Unreal Engine archetype)
  const directorStage = useMemo(() => {
    if (isCompleted) {
      return {
        stageNum: 8,
        stageCode: 'S8',
        stageName: 'Video Prompt Agent (Seedance)',
        phaseTag: 'TAHAP 08 / 08 • COMPLETED',
        phaseSubtext: `Seluruh ${totalScenes} adegan sinematik siap diproduksi`,
        completedScenes: totalScenes,
        isCompleted: true,
      };
    }

    const currentStageFromProj = Math.max(1, Math.min(8, project?.current_stage || 1));
    const foundationStatus = project?.foundation_status;

    // Check S1-S5 foundation phases
    if (currentStageFromProj < 6 && foundationStatus !== 'ready') {
      const sNum = currentStageFromProj;
      const meta = STAGES[sNum - 1];
      return {
        stageNum: sNum,
        stageCode: meta.code,
        stageName: meta.name,
        phaseTag: `TAHAP 0${sNum} / 08 • PROCESSING`,
        phaseSubtext: `Inisialisasi Fondasi Proyek (${sNum}/5 Tahap Fondasi)`,
        completedScenes: sNum - 1,
        isCompleted: false,
      };
    }

    // Check S6: Shot Breakdown across all scenes
    if (s6DoneCount < totalScenes) {
      return {
        stageNum: 6,
        stageCode: 'S6',
        stageName: 'Shot Subdivision & Pacing',
        phaseTag: 'TAHAP 06 / 08 • PROCESSING',
        phaseSubtext: `${Math.min(s6DoneCount, totalScenes)} / ${totalScenes} adegan sedang dianalisis shot & pacing`,
        completedScenes: s6DoneCount,
        isCompleted: false,
      };
    }

    // Check S7: Master Frame Generation across all scenes
    if (s7DoneCount < totalScenes) {
      return {
        stageNum: 7,
        stageCode: 'S7',
        stageName: 'Master Frame Prompt Generation',
        phaseTag: 'TAHAP 07 / 08 • PROCESSING',
        phaseSubtext: `${Math.min(s7DoneCount, totalScenes)} / ${totalScenes} visual master frame 16:9 4K dirumuskan`,
        completedScenes: s7DoneCount,
        isCompleted: false,
      };
    }

    // Check S8: Video Prompt Generation across all scenes
    if (s8DoneCount < totalScenes) {
      return {
        stageNum: 8,
        stageCode: 'S8',
        stageName: 'Video Prompt Agent (Seedance)',
        phaseTag: 'TAHAP 08 / 08 • PROCESSING',
        phaseSubtext: `${Math.min(s8DoneCount, totalScenes)} / ${totalScenes} adegan video motion prompt dikompilasi`,
        completedScenes: s8DoneCount,
        isCompleted: false,
      };
    }

    return {
      stageNum: 8,
      stageCode: 'S8',
      stageName: 'Video Prompt Agent (Seedance)',
      phaseTag: 'TAHAP 08 / 08 • VERIFIED',
      phaseSubtext: `Seluruh ${totalScenes} adegan sinematik siap diproduksi`,
      completedScenes: totalScenes,
      isCompleted: true,
    };
  }, [isCompleted, project?.current_stage, project?.foundation_status, s6DoneCount, s7DoneCount, s8DoneCount, totalScenes]);

  // 4. Smooth Weighted Global Progress Calculation
  const progressPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (error) return Math.min(95, Math.max(10, Math.round(((directorStage.stageNum - 1) / 8) * 100)));

    if (directorStage.stageNum <= 5) {
      // 0% - 50% for foundation stages (10% each)
      const base = (directorStage.stageNum - 1) * 10;
      const stageLogsCount = logs.filter((l) => l.stage === directorStage.stageNum).length;
      const microBoost = Math.min(8, stageLogsCount * 1.5);
      return Math.min(50, Math.max(5, Math.round(base + microBoost + 2)));
    }

    // 50% - 100% for parallel scene stages S6-S8
    const s6Ratio = totalScenes > 0 ? Math.min(1, s6DoneCount / totalScenes) : 0;
    const s7Ratio = totalScenes > 0 ? Math.min(1, s7DoneCount / totalScenes) : 0;
    const s8Ratio = totalScenes > 0 ? Math.min(1, s8DoneCount / totalScenes) : 0;

    const weighted = 50 + s6Ratio * 18 + s7Ratio * 16 + s8Ratio * 16;
    return Math.min(99, Math.max(52, Math.round(weighted)));
  }, [isCompleted, error, directorStage.stageNum, s6DoneCount, s7DoneCount, s8DoneCount, totalScenes, logs]);

  // 5. Live Workers / Parallel Queue Extraction
  const liveWorkers: LiveWorkerItem[] = useMemo(() => {
    if (isCompleted) {
      return [
        {
          id: 'w1',
          name: 'Worker 1 (Thread A)',
          status: 'completed',
          sceneText: `All ${totalScenes} Scenes`,
          taskDetail: 'Pipeline eksekusi tuntas & terverifikasi.',
          badge: 'Selesai ✓',
        },
        {
          id: 'w2',
          name: 'Worker 2 (Thread B)',
          status: 'completed',
          sceneText: 'Master Image & Motion Prompts',
          taskDetail: 'Kitab visual & video siap dibuka di Studio.',
          badge: 'Ready ✓',
        },
      ];
    }

    // In S1-S5 foundation phases
    if (directorStage.stageNum <= 5) {
      const activeStage = STAGES[directorStage.stageNum - 1];
      return [
        {
          id: 'w1',
          name: 'Worker 1 (Foundation Engine)',
          status: 'active',
          sceneText: `Macro Project • ${activeStage.code}`,
          taskDetail: activeStage.name,
          badge: 'Aktif ⚡',
        },
        {
          id: 'w2',
          name: 'Worker 2 (Parallel Queue)',
          status: 'queued',
          sceneText: 'Scene Breakdown Queue',
          taskDetail: `Menunggu finalisasi fondasi (Tahap ${directorStage.stageNum}/5)...`,
          badge: 'Standby ⏳',
        },
      ];
    }

    // In S6-S8 parallel scene execution
    const workerLogs = logs.filter((l) => l.stage_name?.toLowerCase().includes('worker') || l.message.toLowerCase().includes('worker'));
    const lastWorker1Log = [...workerLogs].reverse().find((l) => l.stage_name?.includes('1') || l.message.includes('#1') || l.message.includes('Worker 1'));
    const lastWorker2Log = [...workerLogs].reverse().find((l) => l.stage_name?.includes('2') || l.message.includes('#2') || l.message.includes('Worker 2'));

    const items: LiveWorkerItem[] = [];

    // Worker 1 slot
    if (lastWorker1Log) {
      const isDone = lastWorker1Log.level === 'success' || lastWorker1Log.message.includes('READY') || lastWorker1Log.message.includes('selesai');
      const scMatch = lastWorker1Log.message.match(/Scene\s*#?(\d+)/i);
      items.push({
        id: 'w1',
        name: 'Worker 1 (Thread A)',
        status: isDone ? 'completed' : 'active',
        sceneText: scMatch ? `Scene #${scMatch[1]}` : 'Active Scene',
        taskDetail: lastWorker1Log.message.replace(/^Worker\s*#?\d+:\s*/i, ''),
        badge: isDone ? 'Done ✓' : 'Processing ◉',
      });
    } else {
      items.push({
        id: 'w1',
        name: 'Worker 1 (Thread A)',
        status: 'active',
        sceneText: `Scene #${Math.min(s6DoneCount + 1, totalScenes)}`,
        taskDetail: s6DoneCount < totalScenes ? 'S6 Shot Breakdown (Timing & Angles)' : 'S7 Master Frame Prompt Generation',
        badge: 'Processing ◉',
      });
    }

    // Worker 2 slot
    if (lastWorker2Log) {
      const isDone = lastWorker2Log.level === 'success' || lastWorker2Log.message.includes('READY') || lastWorker2Log.message.includes('selesai');
      const scMatch = lastWorker2Log.message.match(/Scene\s*#?(\d+)/i);
      items.push({
        id: 'w2',
        name: 'Worker 2 (Thread B)',
        status: isDone ? 'completed' : 'active',
        sceneText: scMatch ? `Scene #${scMatch[1]}` : 'Active Scene',
        taskDetail: lastWorker2Log.message.replace(/^Worker\s*#?\d+:\s*/i, ''),
        badge: isDone ? 'Done ✓' : 'Processing ◉',
      });
    } else {
      items.push({
        id: 'w2',
        name: 'Worker 2 (Thread B)',
        status: 'active',
        sceneText: `Scene #${Math.min(s6DoneCount + 2, totalScenes)}`,
        taskDetail: s7DoneCount < totalScenes ? 'S7 Master Frame Prompt (Nano Banana 16:9)' : 'S8 Video Motion Prompts (Seedance)',
        badge: 'Processing ◉',
      });
    }

    // Parallel Queue Summary Slot
    const remainingScenes = Math.max(0, totalScenes - s8DoneCount);
    items.push({
      id: 'w-queue',
      name: 'Queue Monitor',
      status: remainingScenes > 2 ? 'queued' : 'completed',
      sceneText: remainingScenes > 0 ? `${remainingScenes} Scene dalam Antrean` : 'Semua Scene Selesai',
      taskDetail: `${s8DoneCount}/${totalScenes} Scene tuntas dikompilasi ke format video sinematik.`,
      badge: remainingScenes > 0 ? 'Queued ⏳' : 'All Ready ✓',
    });

    return items;
  }, [isCompleted, directorStage.stageNum, logs, s6DoneCount, s7DoneCount, s8DoneCount, totalScenes]);

  // Sync selected card with Director Stage when autoFollow is active
  useEffect(() => {
    if (autoFollow) {
      setSelectedStageIdx(directorStage.stageNum - 1);
    }
  }, [directorStage.stageNum, autoFollow]);

  // Reset to active Director stage on open
  useEffect(() => {
    if (isOpen) {
      setSelectedStageIdx(directorStage.stageNum - 1);
      setAutoFollow(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStageMeta = STAGES[selectedStageIdx] || STAGES[0];
  const isViewingDirectorStage = selectedStageIdx === directorStage.stageNum - 1;

  // Latest log message for current selected stage
  const stageLogs = logs.filter((l) => l.stage === currentStageMeta.num);
  const latestLogForStage = stageLogs.length > 0 ? stageLogs[stageLogs.length - 1] : null;

  // Navigation handlers
  const handlePrev = () => {
    setAutoFollow(false);
    setSelectedStageIdx((prev) => (prev > 0 ? prev - 1 : STAGES.length - 1));
  };

  const handleNext = () => {
    setAutoFollow(false);
    setSelectedStageIdx((prev) => (prev < STAGES.length - 1 ? prev + 1 : 0));
  };

  const handleSelectStage = (idx: number) => {
    setAutoFollow(idx === directorStage.stageNum - 1);
    setSelectedStageIdx(idx);
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 45) {
      handleNext();
    } else if (diff < -45) {
      handlePrev();
    }
    touchStartXRef.current = null;
  };

  return (
    <div
      id="pipeline-card-carousel-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 overflow-y-auto select-none animate-in fade-in duration-300"
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between py-2 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-[11px] sm:text-xs font-mono font-bold tracking-widest text-zinc-300 uppercase">
            @sinema.director • Cetak Biru Sinematik
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Close button */}
          <button
            id="btn-close-pipeline-modal"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md sm:max-w-xl flex flex-col items-center my-auto py-3">
        {/* Overall Global Progress Section (Adobe Premiere / Unreal Engine model) */}
        <div className="w-full mb-3 px-1">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-zinc-300 font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isCompleted
                  ? 'Pipeline Berhasil Diselesaikan!'
                  : error
                  ? 'Pipeline Terkendala'
                  : `Global Progress • Fase: ${directorStage.stageCode} (${directorStage.stageName})`}
              </span>
            </span>
            <span className="text-amber-400 font-extrabold">{progressPercent}%</span>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div className="w-full h-2 sm:h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-white/10 p-0.5">
            <motion.div
              className={`h-full rounded-full ${
                error
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 shadow-lg shadow-blue-500/50'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* ERROR CARD STATE (if error occurs) */}
        {error ? (
          <motion.div
            id="pipeline-error-card"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full bg-rose-950/40 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-rose-100">
                  Terjadi Kendala dalam Eksekusi Pipeline
                </h3>
                <p className="text-xs text-rose-300/80">
                  Orkestrator menemukan galat saat memproses Tahap {directorStage.stageNum}.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-black/60 border border-rose-500/20 rounded-xl p-3.5 mb-6 text-xs font-mono text-rose-200 overflow-x-auto max-h-32">
              <span className="text-rose-400 font-bold block mb-1">[ERROR]:</span>
              {error}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                id="btn-error-close"
                onClick={onClose}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-white/10 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Tutup</span>
              </button>

              <button
                id="btn-error-open-pipeline"
                onClick={onOpenPipelineDetails}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Terminal className="w-4 h-4" />
                <span>Buka Detail Halaman Pipeline</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* LOCKED DIRECTOR VIEW CARD CAROUSEL */
          <div
            className="w-full relative flex flex-col items-center"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Stacked Card Effect Background (Depth layers) */}
            <div className="w-[92%] h-4 bg-[#0B0F19] rounded-t-2xl -mb-2 border-t border-x border-white/15 opacity-70" />
            <div className="w-[96%] h-4 bg-[#111827] rounded-t-2xl -mb-2 border-t border-x border-white/20 opacity-85" />

            {/* ACTIVE DIRECTOR CARD CONTAINER */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStageMeta.num}
                id={`pipeline-card-stage-${currentStageMeta.num}`}
                initial={{ opacity: 0, x: 25, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -25, scale: 0.98 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{ backgroundColor: currentStageMeta.cardColor }}
                className="w-full rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden border border-white/20 min-h-[440px] sm:min-h-[470px]"
              >
                {/* Top Card Header */}
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[11px] font-mono font-black tracking-wider text-white/80 uppercase">
                    @studio.sinema
                  </span>

                  {/* Stage Status Pill */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white">
                    {currentStageMeta.num < directorStage.stageNum || isCompleted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Selesai Terverifikasi</span>
                      </>
                    ) : currentStageMeta.num === directorStage.stageNum && isGenerating ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span className="text-amber-300">Fokus Produksi Aktif ⚡</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-3.5 h-3.5 text-white/50" />
                        <span className="text-white/60">Dalam Antrean</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Animated Vector Path Art (Centerpiece) */}
                <div className="my-2 relative z-10 flex flex-col items-center">
                  <PipelineStageArt
                    stageNum={currentStageMeta.num}
                    isActive={currentStageMeta.num === directorStage.stageNum && isGenerating}
                    isCompleted={currentStageMeta.num < directorStage.stageNum || isCompleted}
                  />

                  {/* Concept Quote & Insight from Stage */}
                  <p className="text-center text-xs sm:text-sm font-medium text-white/90 max-w-sm mt-1">
                    "{currentStageMeta.conceptQuote}"
                  </p>
                </div>

                {/* Bottom Card Info & Director View Details */}
                <div className="relative z-10 bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/15">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-extrabold">
                      {isViewingDirectorStage
                        ? directorStage.phaseTag
                        : `TAHAP 0${currentStageMeta.num} / 08 • ${currentStageMeta.code}`}
                    </span>
                    <span className="text-[10px] font-mono text-white/70 font-semibold">
                      {isViewingDirectorStage
                        ? `${directorStage.completedScenes}/${totalScenes} SCENES`
                        : currentStageMeta.num < directorStage.stageNum
                        ? 'TERVERIFIKASI ✓'
                        : 'ANTREAN ⏳'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    {currentStageMeta.name}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5 line-clamp-2">
                    {isViewingDirectorStage ? directorStage.phaseSubtext : currentStageMeta.desc}
                  </p>

                  {/* Realtime Live Terminal Log Line */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-start gap-2 text-[11px] font-mono text-white/90">
                    <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="truncate">
                      {latestLogForStage
                        ? latestLogForStage.message
                        : currentStageMeta.num === directorStage.stageNum
                        ? `${totalScenes} adegan sedang diproses secara paralel oleh worker pool...`
                        : currentStageMeta.num < directorStage.stageNum
                        ? 'Artefak terverifikasi dan terkunci di database.'
                        : 'Menunggu giliran eksekusi modular...'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Left & Right Swipe Navigation Buttons */}
            <button
              id="btn-carousel-prev"
              onClick={handlePrev}
              className="absolute -left-3 sm:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center shadow-xl backdrop-blur-md transition cursor-pointer hover:scale-105 active:scale-95 z-20"
              title="Tahap Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              id="btn-carousel-next"
              onClick={handleNext}
              className="absolute -right-3 sm:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center shadow-xl backdrop-blur-md transition cursor-pointer hover:scale-105 active:scale-95 z-20"
              title="Tahap Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* DEDICATED LIVE WORKERS / PARALLEL PIPELINE TASK MONITOR */}
        {!error && (
          <div
            id="pipeline-live-workers-section"
            className="w-full mt-3 bg-zinc-950/85 border border-white/10 rounded-2xl p-3 sm:p-3.5 backdrop-blur-md shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-indigo-400" />
                  <span>LIVE WORKERS • PARALLEL ENGINE</span>
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Parallel Tasks: {Math.min(s6DoneCount, totalScenes)}/{totalScenes} Scenes Done
              </span>
            </div>

            {/* Workers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {liveWorkers.map((w) => (
                <div
                  key={w.id}
                  className="bg-black/50 border border-white/5 rounded-xl p-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-zinc-400 font-semibold truncate">{w.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        w.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : w.status === 'active'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {w.badge}
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                    {w.status === 'completed' ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : w.status === 'active' ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-ping" />
                    ) : (
                      <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                    )}
                    <span className="truncate">{w.sceneText}</span>
                  </div>

                  <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5 line-clamp-1">
                    {w.taskDetail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STAGE DOTS / PILLS NAVIGATION BAR (8 Stages - Kept Intact as Timeline) */}
        <div className="w-full max-w-md mt-3 flex items-center justify-between gap-1.5 px-1">
          {STAGES.map((s, idx) => {
            const isSelected = selectedStageIdx === idx;
            const isStageActive = directorStage.stageNum === s.num && isGenerating && !isCompleted;
            const isStageDone = s.num < directorStage.stageNum || isCompleted;

            return (
              <button
                key={s.num}
                id={`btn-stage-pill-${s.num}`}
                onClick={() => handleSelectStage(idx)}
                className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition cursor-pointer border ${
                  isSelected
                    ? 'bg-white/20 border-white text-white font-black shadow-md'
                    : isStageActive
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : isStageDone
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300'
                }`}
                title={`Tahap ${s.num}: ${s.name}`}
              >
                <div className="flex items-center justify-center">
                  {isStageDone ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isStageActive ? (
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  ) : (
                    <span className="text-[10px] font-mono">{s.num}</span>
                  )}
                </div>
                <span className="text-[9px] font-mono hidden sm:inline truncate max-w-[40px]">
                  {s.code}
                </span>
              </button>
            );
          })}
        </div>

        {/* Auto Follow Return Button if User clicked away to inspect */}
        {!autoFollow && !isCompleted && !error && (
          <button
            id="btn-auto-follow-stage"
            onClick={() => {
              setSelectedStageIdx(directorStage.stageNum - 1);
              setAutoFollow(true);
            }}
            className="mt-2.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold flex items-center gap-1.5 hover:bg-amber-500/30 transition cursor-pointer"
          >
            <Zap className="w-3 h-3" />
            <span>Kembali ke Fokus Produksi Aktif ({directorStage.stageCode})</span>
          </button>
        )}

        {/* SUCCESS COMPLETION CTA */}
        {isCompleted && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full mt-4 flex flex-col items-center gap-2"
          >
            <button
              id="btn-open-studio-completed"
              onClick={onOpenStudio}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-sm shadow-xl shadow-amber-500/30 transition active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-zinc-950" />
              <span>Buka Studio Sinematik Proyek</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Footer Details Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between py-2 border-t border-white/10 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <Film className="w-3.5 h-3.5 text-indigo-400" />
          <span>{project?.title || 'Proyek Sinematik'}</span>
        </span>

        <div className="flex items-center gap-3">
          <button
            id="btn-footer-open-pipeline-details"
            onClick={onOpenPipelineDetails}
            className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] font-mono flex items-center gap-1 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Detail Log Terminal</span>
          </button>

          <button
            id="btn-footer-close"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-[11px] font-mono transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};


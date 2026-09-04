import React, { useState, useEffect } from 'react';
import { Sliders, Cpu, ShieldCheck, ShieldAlert, RefreshCw, Layers, Terminal, Clock, Play, CheckCircle2, AlertTriangle, Film, Trash2, Loader2, Key, Server } from 'lucide-react';
import { Project, ReasoningModelPreferences, FallbackLogEntry } from '../../types';
import { GeminiProjectManager } from '../settings/GeminiProjectManager';
import { VersionChangelogSection } from '../settings/VersionChangelogSection';
import { SupabaseSyncManager } from '../settings/SupabaseSyncManager';
import { useWindowManager } from '../../context/WindowManagerContext';

interface SettingsWorkspaceProps {
  project: Project | null;
  onChangeModel: (model: string) => void;
  onUpdateProject?: (updatedFields: Partial<Project>) => void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', desc: 'Model paling cerdas, stabil, dengan batas kuota optimal' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', desc: 'Model adaptif & cepat untuk orkestrasi sinematik' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', desc: 'Kemampuan penalaran mendalam dan logika skenario' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', desc: 'Ultra cepat untuk iterasi cepat' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', desc: 'Model stabil selalu terbarui untuk reliabilitas tinggi' },
];

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({ project, onChangeModel, onUpdateProject, onDeleteProject }) => {
  const { openWindow } = useWindowManager();
  const currentModelId = project?.ai_model || 'gemini-3.8-flash';
  const prefs = project?.reasoning_model_preferences || {
    mode: 'fixed',
    primary_model: { provider: 'google', model_id: currentModelId },
    fallback_policy: 'smart',
    fallback_pool: [
      { provider: 'google', model_id: 'gemini-3.8-flash', priority: 1 },
      { provider: 'google', model_id: 'gemini-3.7-flash', priority: 2 },
    ],
  };

  const [mode, setMode] = useState<'fixed' | 'adaptive' | 'custom'>(prefs.mode || 'fixed');
  const [fallbackPolicy, setFallbackPolicy] = useState<'strict' | 'smart' | 'off'>(prefs.fallback_policy || 'smart');
  const [fallbackLogs, setFallbackLogs] = useState<FallbackLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
    const [routerCatalog, setRouterCatalog] = useState<any[]>([]);
  const [routerLogs, setRouterLogs] = useState<any[]>([]);
  const [geminiProjects, setGeminiProjects] = useState<any[]>([]);
  const [geminiRouterLogs, setGeminiRouterLogs] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    fetchRouterData();
  }, []);
  
  const fetchRouterData = async () => {
    try {
            const [catalogRes, logsRes, geminiRes] = await Promise.all([
        fetch('/api/router/catalog'),
        fetch('/api/router/logs'),
        fetch('/api/router/gemini-projects').catch(() => ({ json: () => ({ projects: [], logs: [] }) } as any))
      ]);
      const catalogData = await catalogRes.json();
      const logsData = await logsRes.json();
      const geminiData = await geminiRes.json();
      setRouterCatalog(catalogData.models || []);
      setRouterLogs(logsData.logs || []);
      setGeminiProjects(geminiData.projects || []);
      setGeminiRouterLogs(geminiData.logs || []);
    } catch (err) {
      console.error('Error fetching router data:', err);
    }
  };

  const handleDeleteProject = async () => {
    if (!project?.id || !onDeleteProject) return;
    try {
      setIsDeleting(true);
      await onDeleteProject(project.id);
      setShowDeleteModal(false);
    } catch (err) {
      console.error('Gagal menghapus proyek:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Duration Architecture State
  const projectDuration = project?.total_duration_target_sec || 60;
  const sceneDuration = project?.scene_duration_sec || 10;
  const durationMode = project?.durationMode || 'match_scene';
  const selectedVideoModel = project?.primaryVideoModel || 'seedance';
  const [showExtendedConfirm, setShowExtendedConfirm] = useState(false);
  const [testResults, setTestResults] = useState<{ testId: string; name: string; passed: boolean; details: string }[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Prompt Engine Regression State (Patch 2)
  const [promptTestResults, setPromptTestResults] = useState<{ testId: string; name: string; passed: boolean; details: string }[] | null>(null);
  const [runningPromptTests, setRunningPromptTests] = useState(false);

  useEffect(() => {
    if (project?.id) {
      fetchLogs();
    }
  }, [project?.id]);

  const fetchLogs = async () => {
    if (!project?.id) return;
    try {
      setLoadingLogs(true);
      const res = await fetch(`/api/projects/${project.id}/fallback-logs`);
      const data = await res.json();
      if (data.logs) {
        setFallbackLogs(data.logs);
      }
    } catch (err) {
      console.error('Gagal mengambil fallback audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSavePreferences = async (newMode: 'fixed' | 'adaptive' | 'custom', newPolicy: 'strict' | 'smart' | 'off') => {
    setMode(newMode);
    setFallbackPolicy(newPolicy);
    const updatedPrefs: ReasoningModelPreferences = {
      ...prefs,
      mode: newMode,
      fallback_policy: newPolicy,
      primary_model: {
        provider: project?.reasoning_config?.provider_type || 'google',
        model_id: currentModelId,
      },
    };

    if (onUpdateProject) {
      onUpdateProject({ reasoning_model_preferences: updatedPrefs });
    } else if (project?.id) {
      try {
        await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reasoning_model_preferences: updatedPrefs }),
        });
      } catch (err) {
        console.error('Gagal menyimpan preferences:', err);
      }
    }
  };

  const handleDurationModeChange = (newMode: 'match_scene' | 'extended') => {
    if (newMode === 'extended') {
      setShowExtendedConfirm(true);
    } else {
      if (onUpdateProject && project) {
        onUpdateProject({ durationMode: 'match_scene', timelineSceneDuration: project.scene_duration_sec || 10 });
      }
    }
  };

  const confirmConvertTimeline = async () => {
    setShowExtendedConfirm(false);
    if (!project?.id) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/convert-timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDuration: 30 }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Gagal konversi timeline:', err);
    }
  };

  const runRegressionTests = async () => {
    try {
      setRunningTests(true);
      const res = await fetch('/api/regression-tests/duration');
      const data = await res.json();
      if (data.results) {
        setTestResults(data.results);
      }
    } catch (err) {
      console.error('Gagal menjalankan regression tests:', err);
    } finally {
      setRunningTests(false);
    }
  };

  const runPromptRegressionTests = async () => {
    try {
      setRunningPromptTests(true);
      const res = await fetch('/api/regression-tests/prompt');
      const data = await res.json();
      if (data.results) {
        setPromptTestResults(data.results);
      }
    } catch (err) {
      console.error('Gagal menjalankan prompt regression tests:', err);
    } finally {
      setRunningPromptTests(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-indigo-400 font-bold">
            <Sliders className="w-4 h-4" />
            <span>Studio Preferences &amp; Duration Architecture v1.2</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Studio Settings, Model Routing &amp; Duration Control
          </h1>
        </div>
      </div>

      {/* AI Infrastructure Control Center Entry Point */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              AI Infrastructure Control Center
            </h3>
          </div>
          <button
            onClick={() => openWindow({ 
                id: 'ai-infrastructure', 
                type: 'ai_infrastructure', 
                title: 'AI Infrastructure Control Center', 
                subtitle: 'Manage Providers & Models' 
            })}
            className="flex items-center gap-1.5 text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition"
          >
            <span>Open Control Center</span>
          </button>
        </div>
      </div>

      {/* PATCH v1.2: Duration Architecture & Model Output Settings */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Timeline vs Model Output Duration Architecture (Patch v1.2)
            </h3>
          </div>
          <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/30">
            Source of Truth: Timeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#121624] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Project Duration</span>
            <p className="font-extrabold text-zinc-100 font-mono text-sm">{projectDuration} Detik</p>
            <p className="text-[10px] text-zinc-400">Total target durasi video proyek</p>
          </div>
          <div className="p-4 rounded-xl bg-[#121624] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Timeline Scene Duration</span>
            <p className="font-extrabold text-indigo-300 font-mono text-sm">{sceneDuration} Detik / Scene</p>
            <p className="text-[10px] text-zinc-400">Durasi setiap scene dalam timeline</p>
          </div>
          <div className="p-4 rounded-xl bg-[#121624] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Model Output Duration</span>
            <p className="font-extrabold text-amber-300 font-mono text-sm">
              {durationMode === 'extended' ? 30 : sceneDuration} Detik
            </p>
            <p className="text-[10px] text-zinc-400">Durasi aktual yang diminta ke model AI</p>
          </div>
        </div>

        {/* Duration Mode Selection */}
        <div className="space-y-3 bg-[#121624] p-5 rounded-xl border border-white/5">
          <label className="text-xs font-bold text-zinc-200 uppercase font-mono">Mode Produksi Video &amp; Model Output</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => handleDurationModeChange('match_scene')}
              className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${
                durationMode !== 'extended'
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-md'
                  : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs font-mono">Standard Scene Mode (Match Scene)</span>
                <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded">Default</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Model mengikuti durasi scene timeline secara mutlak (misal {sceneDuration}s scene = {sceneDuration}s output).
              </p>
            </div>

            <div
              onClick={() => handleDurationModeChange('extended')}
              className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${
                durationMode === 'extended'
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-md'
                  : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs font-mono">Seedance Extended Mode (30s)</span>
                <span className="text-[10px] font-mono bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded">Specialized</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Menggunakan 30 detik sebagai satu scene penuh dengan 5-shot cinematic breakdown terstruktur.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Seedance Extended Mode Conversion */}
      {showExtendedConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0F131E] border border-emerald-500/40 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-zinc-100 font-mono">Konversi Timeline Extended Mode</h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Seedance Extended Mode membutuhkan scene berdurasi 30 detik. Apakah Anda ingin mengubah timeline menjadi 2 × 30 detik? Data adegan, karakter, lokasi, dan kontinuitas Anda akan digabungkan secara presisi tanpa kehilangan informasi.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExtendedConfirm(false)}
                className="px-4 py-2 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmConvertTimeline}
                className="px-4 py-2 text-xs font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition"
              >
                Convert Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regression Test Suite (Tests 01-08) */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Duration Architecture Regression Test Suite (Tests 01–08)
            </h3>
          </div>
          <button
            onClick={runRegressionTests}
            disabled={runningTests}
            className="flex items-center gap-1.5 text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
            <span>Run Regression Tests</span>
          </button>
        </div>

        {testResults && (
          <div className="space-y-2 pt-2 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {testResults.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs font-mono flex flex-col justify-between space-y-1 ${
                    t.passed
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/30 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100">{t.testId}: {t.name}</span>
                    {t.passed ? (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> PASSED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">
                        FAILED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">{t.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PATCH 2: Prompt Generation Engine Regression Test Suite (Tests A-H) */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Prompt Generation Engine Regression Test Suite (Patch 2 Tests A–H)
            </h3>
          </div>
          <button
            onClick={runPromptRegressionTests}
            disabled={runningPromptTests}
            className="flex items-center gap-1.5 text-xs font-mono bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningPromptTests ? 'animate-spin' : ''}`} />
            <span>Run Prompt Tests</span>
          </button>
        </div>

        {promptTestResults && (
          <div className="space-y-2 pt-2 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {promptTestResults.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs font-mono flex flex-col justify-between space-y-1 ${
                    t.passed
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/30 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100">{t.testId}: {t.name}</span>
                    {t.passed ? (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> PASSED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">
                        FAILED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">{t.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Smart Router Control Center */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Smart Router Control Center
            </h3>
          </div>
        </div>
        
        {/* Model Catalog & Health */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {(routerCatalog || []).map((m: any) => (
             <div key={m.id} className={`p-3 rounded-xl border ${m.health.status === 'available' ? 'bg-zinc-800/50 border-white/5' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-100 font-mono">{m.name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${m.health.status === 'available' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{m.health.status}</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">{m.description}</p>
             </div>
           ))}
        </div>
        
        {/* Logs */}
        <div className="text-xs text-zinc-400 font-mono">
          Decision log:
          {(routerLogs || []).map((log: any, i: number) => (
            <div key={i} className="text-[10px] text-zinc-500">{log.task} | {log.selected_model} | {log.status}</div>
          ))}
        </div>

        {/* Multi-Project Credential Router Manager */}
        <GeminiProjectManager />
      </div>

      {/* PATCH v1.1 Model Preferences & Adaptive Router Config */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
            Adaptive Pipeline &amp; Fallback Preferences (Patch v1.1)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reasoning Mode */}
          <div className="space-y-2 bg-[#121624] p-4 rounded-xl border border-white/5">
            <label className="text-xs font-bold text-zinc-300 uppercase font-mono">Mode Eksekusi Model</label>
            <div className="grid grid-cols-3 gap-2">
              {(['fixed', 'adaptive', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleSavePreferences(m, fallbackPolicy)}
                  className={`py-2 px-3 text-xs font-mono font-bold rounded-lg border transition uppercase ${
                    mode === m
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400">
              {mode === 'fixed' && 'Model pilihan pengguna dikunci mutlak. Tanpa failover otomatis.'}
              {mode === 'adaptive' && 'Router adaptif cerdas mengaktifkan fallback pool secara otomatis saat kuota habis.'}
              {mode === 'custom' && 'Routing kustom melalui endpoint eksternal fleksibel.'}
            </p>
          </div>

          {/* Fallback Policy */}
          <div className="space-y-2 bg-[#121624] p-4 rounded-xl border border-white/5">
            <label className="text-xs font-bold text-zinc-300 uppercase font-mono">Kebijakan Fallback (Fallback Policy)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['smart', 'strict', 'off'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleSavePreferences(mode, p)}
                  className={`py-2 px-3 text-xs font-mono font-bold rounded-lg border transition uppercase ${
                    fallbackPolicy === p
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400">
              {fallbackPolicy === 'smart' && 'Pindah ke model cadangan terdekat secara deterministik saat rate limit / kuota habis.'}
              {fallbackPolicy === 'strict' && 'Gagal langsung jika model utama mengalami gangguan tanpa beralih.'}
              {fallbackPolicy === 'off' && 'Menonaktifkan failover otomatis sepenuhnya.'}
            </p>
          </div>
        </div>

        {/* Fallback Pool Info */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400 font-bold">Fallback Pool (Model Cadangan Aktif)</span>
            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Deterministic Order</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(prefs.fallback_pool || []).map((fb, idx) => (
              <div key={idx} className="bg-[#121624] p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-zinc-200 font-mono">{fb.model_id}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">{fb.provider}</div>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">#{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explicit Fallback Audit Logs */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Explicit Fallback Audit Logs (Patch v1.1)
            </h3>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="flex items-center gap-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh Audit Logs</span>
          </button>
        </div>

        {fallbackLogs.length === 0 ? (
          <div className="p-8 text-center bg-[#121624] rounded-xl border border-white/5 text-zinc-500 text-xs font-mono">
            Belum ada event fallback yang tercatat pada sesi ini. Sistem berjalan stabil pada model utama.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {fallbackLogs.map((log, idx) => (
              <div key={idx} className="bg-[#121624] p-3 rounded-xl border border-amber-500/20 text-xs space-y-1 font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-400 font-bold">[{log.stage || 'Pipeline'}] Fallback Terdeteksi</span>
                  <span className="text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-zinc-300 flex items-center gap-2">
                  <span className="text-red-400 line-through">{log.requested_model}</span>
                  <span>→</span>
                  <span className="text-emerald-400 font-bold">{log.actual_model}</span>
                </div>
                {log.fallback_reason && (
                  <div className="text-[10px] text-zinc-400 bg-black/30 p-1.5 rounded">
                    Alasan: {log.fallback_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Configuration Info */}
      {project && (
        <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Konfigurasi Proyek Aktif
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Judul Proyek</span>
              <p className="font-semibold text-zinc-200 truncate">{project.title}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Target Durasi</span>
              <p className="font-semibold text-zinc-200 font-mono">{projectDuration} Detik</p>
            </div>
            <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Scene Duration</span>
              <p className="font-semibold text-zinc-200 font-mono">{sceneDuration} Detik</p>
            </div>
            <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Bahasa Prompt</span>
              <p className="font-semibold text-zinc-200 uppercase">{project.prompt_language}</p>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Connection & Sync Manager */}
      <SupabaseSyncManager />

      {/* System Version & Changelog Log */}
      <VersionChangelogSection />

      {/* Danger Zone */}
      {project && onDeleteProject && (
        <div className="bg-rose-950/20 border border-rose-500/30 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider">
              Zona Bahaya • Pengelolaan Proyek &amp; Cerita
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/40 p-4 rounded-xl border border-rose-900/40">
            <div>
              <div className="text-sm font-bold text-zinc-200">Hapus Proyek / Story Ini</div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Menghapus proyek "{project.title}" beserta seluruh fondasi cerita, babak, adegan, shot, dan prompt secara permanen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Proyek Ini
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && project && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#181926] border border-rose-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Hapus Proyek Ini?</h4>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-[#212335] p-3.5 rounded-2xl border border-[#2B2D44]">
              Anda yakin ingin menghapus proyek{' '}
              <strong className="text-white font-bold">"{project.title}"</strong>?
              Seluruh data cerita, karakter, lokasi, adegan, shot, dan prompt terkait akan dihapus secara permanen.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#212335] hover:bg-[#282B42] border border-[#2B2D44] transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Proyek</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Film,
  Cpu,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Layers,
  Database,
  Activity,
  ChevronRight,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Project, PipelineLogEvent } from '../types';
import { GeminiRealtimeQuotaPanel } from './GeminiRealtimeQuotaPanel';

interface MainDashboardViewProps {
  projects: Project[];
  activeProject: Project | null;
  logs: PipelineLogEvent[];
  onSelectProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  onOpenCreateModal: () => void;
  onOpenProductionPage: () => void;
}

const STAGES = [
  { stage: 1, name: 'Story Understanding' },
  { stage: 2, name: 'Character Detection' },
  { stage: 3, name: 'Location & Objects' },
  { stage: 4, name: 'Narrative Structure' },
  { stage: 5, name: 'Scene Breakdown' },
  { stage: 6, name: 'Shot Subdivision' },
  { stage: 7, name: 'Master Frame Prompt' },
  { stage: 8, name: 'Video Prompt Agent' },
];

export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  projects,
  activeProject,
  logs,
  onSelectProject,
  onDeleteProject,
  onOpenCreateModal,
  onOpenProductionPage,
}) => {
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || !onDeleteProject) return;
    try {
      setIsDeleting(true);
      await onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    } catch (err) {
      console.error('Gagal menghapus proyek:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const ongoingProjects = projects.filter((p) => p.status === 'processing');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  const recentLogs = [...logs].reverse().slice(0, 5);

  return (
    <div className="p-3.5 sm:p-5 pb-24 md:pb-12 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-150">
      {/* SaaS Dashboard Title & Quick Action Header (Compact) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141624] border border-[#23253A] px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-lg">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
              Studio AI v3.0
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sistem Aktif
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Dashboard Orkestrasi Sinematik
          </h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Pusat kendali pipeline AI untuk naskah film, pemisahan adegan, subdivisi kamera, dan prompt visual sinematik.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-indigo-600/25 transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Buat Proyek Baru
          </button>
          <button
            onClick={onOpenProductionPage}
            className="flex items-center gap-1.5 bg-[#1C1E30] hover:bg-[#24263D] border border-[#2A2D46] text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs transition shadow-sm cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            Halaman Produksi ({projects.length})
          </button>
        </div>
      </div>

      {/* 4 Compact Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Projects Card */}
        <div
          onClick={onOpenProductionPage}
          className="bg-[#141624] border border-[#23253A] hover:border-indigo-500/40 rounded-2xl p-3.5 sm:p-4 cursor-pointer transition group shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Total Proyek</span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-white group-hover:text-indigo-300 transition leading-none">
              {projects.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1.5">
              <span className="text-emerald-400 font-semibold">{completedProjects.length} Selesai</span>
              <span>•</span>
              <span className="text-indigo-400 font-semibold">{ongoingProjects.length} Berjalan</span>
            </div>
          </div>
        </div>

        {/* Ongoing Pipeline Card */}
        <div
          onClick={onOpenProductionPage}
          className="bg-[#141624] border border-[#23253A] hover:border-purple-500/40 rounded-2xl p-3.5 sm:p-4 cursor-pointer transition group shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Status Orkestrasi</span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-purple-300 group-hover:text-purple-200 transition leading-none">
              {ongoingProjects.length > 0 ? `${ongoingProjects.length} Aktif` : 'Idle'}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1 truncate">
              {ongoingProjects.length > 0
                ? 'Pipeline AI sedang memproses'
                : 'Standby / Siap Digunakan'}
            </div>
          </div>
        </div>

        {/* Engine Model Card */}
        <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-3.5 sm:p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Engine AI</span>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-black text-amber-300 truncate leading-none">
              AI Director (Auto)
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1 truncate">
              Autonomous Router S1–S8
            </div>
          </div>
        </div>

        {/* Real Storage & Sync Health */}
        <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-3.5 sm:p-4 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Database &amp; Sync</span>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-black text-emerald-400 truncate leading-none">
              Tersimpan &amp; Sinkron
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1 truncate">
              Real-time Supabase Database
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Gemini AI Quota & Model Status Monitor */}
      <GeminiRealtimeQuotaPanel />

      {/* Main Grid: Ongoing Projects + Quick Access + Log Terminal (Compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (2 Cols wide on LG): Proyek Berjalan & Proyek Terkini */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ongoing Projects Section */}
          <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-4 sm:p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Proyek Sedang Berjalan (In Progress)
                </h2>
              </div>
              <button
                onClick={onOpenProductionPage}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Lihat Semua ({projects.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {ongoingProjects.length === 0 ? (
              <div className="py-4 px-4 rounded-xl bg-[#1A1C2C] border border-dashed border-[#282B42] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">Tidak ada proses orkestrasi yang aktif</h3>
                    <p className="text-[11px] text-slate-400">
                      Semua naskah film Anda telah siap atau berada dalam draf.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onOpenCreateModal}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Mulai Produksi
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {ongoingProjects.map((proj, idx) => {
                  const stageNum = proj.current_stage || 1;
                  const progressPct = Math.round((stageNum / 8) * 100);
                  const stageObj = STAGES.find((s) => s.stage === stageNum) || STAGES[0];

                  return (
                    <div
                      key={proj.id ? `ongoing-${proj.id}` : `ongoing-${idx}`}
                      className="p-3.5 rounded-xl bg-[#1A1C2C] border border-indigo-500/40 space-y-2.5 shadow-sm hover:border-indigo-500 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono font-bold uppercase text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                            STAGE {stageNum}/8: {stageObj.name}
                          </span>
                          <h3 className="text-sm font-bold text-white mt-1 truncate">
                            {proj.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onDeleteProject && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(proj);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                              title="Hapus Proyek"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onSelectProject(proj.id)}
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition cursor-pointer"
                          >
                            Buka Studio
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold font-mono">
                          <span className="text-slate-400">{stageObj.name}</span>
                          <span className="text-indigo-400">{progressPct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#121420] overflow-hidden border border-[#23253A]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Projects List / Grid (Compact) */}
          <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-4 sm:p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
                Daftar Proyek Sinematik Terkini
              </h2>
              <button
                onClick={onOpenProductionPage}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                Ke Halaman Produksi →
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                Belum ada proyek yang dibuat.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {projects.slice(0, 4).map((proj, idx) => (
                  <div
                    key={proj.id ? `recent-${proj.id}` : `recent-${idx}`}
                    onClick={() => onSelectProject(proj.id)}
                    className="p-3.5 rounded-xl bg-[#1A1C2C] hover:bg-[#202337] border border-[#282B42] hover:border-indigo-500/50 cursor-pointer transition group shadow-sm flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#121420] text-slate-300 border border-[#282B42]">
                        Target: {proj.total_duration_target_sec}s
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            proj.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : proj.status === 'processing'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-700/40 text-slate-300'
                          }`}
                        >
                          {proj.status.toUpperCase()}
                        </span>
                        {onDeleteProject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(proj);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition cursor-pointer"
                            title="Hapus Proyek"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                        {proj.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {proj.raw_script}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#23253A] flex items-center justify-between text-[11px] text-indigo-400 font-semibold">
                      <span>Buka Studio Proyek</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Terminal Activity Stream & Roadmap (Compact) */}
        <div className="space-y-4">
          {/* Real-time Activity Stream */}
          <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-4 space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                    Aktivitas &amp; Stream Orkestrator
                  </h3>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                {recentLogs.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs">
                    Belum ada aktivitas orkestrasi tercatat.
                  </div>
                ) : (
                  recentLogs.map((item, idx) => (
                    <div
                      key={`${item.timestamp}-${idx}`}
                      className="p-2.5 rounded-xl bg-[#1A1C2C] border border-[#282B42] text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-indigo-300 truncate">
                          {item.stage_name || `Stage ${item.stage}`}
                        </span>
                        <span className="font-mono text-slate-400">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-[#23253A] text-center text-[10px] text-slate-400 font-mono">
              Terhubung ke Gemini Event Bus
            </div>
          </div>

          {/* 8-Stage Architecture Roadmap Overview (Compact Grid/List) */}
          <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-4 space-y-2.5 shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Tahapan Pipeline (1 – 8)
            </h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              {STAGES.map((st) => (
                <div
                  key={st.stage}
                  className="p-1.5 px-2 rounded-lg bg-[#1A1C2C] border border-[#282B42] flex items-center justify-between text-slate-300 text-[10px]"
                >
                  <span className="font-bold text-indigo-400">0{st.stage}</span>
                  <span className="truncate px-1">{st.name}</span>
                  <CheckCircle2 className="w-3 h-3 text-slate-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#141624] border border-rose-500/30 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center gap-2.5 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Hapus Proyek?</h4>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-[#1A1C2C] p-3 rounded-xl border border-[#282B42]">
              Anda yakin ingin menghapus proyek{' '}
              <strong className="text-white font-bold">"{projectToDelete.title}"</strong>?
              Seluruh data cerita, karakter, lokasi, adegan, shot, dan prompt terkait akan dihapus secara permanen.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProjectToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#1A1C2C] hover:bg-[#202337] border border-[#282B42] transition disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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


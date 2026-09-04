/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileNavDrawer } from './components/MobileNavDrawer';
import { MainDashboardView } from './components/MainDashboardView';
import { ArrowLeft, Loader2 } from 'lucide-react';

// Lazy-loaded Views and Modals for Optimized TTI & Code Splitting
const ProductionProjectsView = React.lazy(() => import('./components/ProductionProjectsView').then(m => ({ default: m.ProductionProjectsView })));
const ProjectListModal = React.lazy(() => import('./components/ProjectListModal').then(m => ({ default: m.ProjectListModal })));
const GoogleDriveExportModal = React.lazy(() => import('./components/GoogleDriveExportModal').then(m => ({ default: m.GoogleDriveExportModal })));
const GoogleDriveImportModal = React.lazy(() => import('./components/GoogleDriveImportModal').then(m => ({ default: m.GoogleDriveImportModal })));
const CommandPalette = React.lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const NotificationCenter = React.lazy(() => import('./components/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const VersionHistoryModal = React.lazy(() => import('./components/VersionHistoryModal').then(m => ({ default: m.VersionHistoryModal })));

import { PipelineCardCarouselModal } from './components/pipeline/PipelineCardCarouselModal';

// Lazy-loaded Studio & Workspaces
const UnifiedStudioLayout = React.lazy(() => import('./components/studio/UnifiedStudioLayout').then(m => ({ default: m.UnifiedStudioLayout })));
const ProjectDashboardWorkspace = React.lazy(() => import('./components/workspaces/ProjectDashboardWorkspace').then(m => ({ default: m.ProjectDashboardWorkspace })));
const StoryWorkspace = React.lazy(() => import('./components/workspaces/StoryWorkspace').then(m => ({ default: m.StoryWorkspace })));
const SceneWorkspace = React.lazy(() => import('./components/workspaces/SceneWorkspace').then(m => ({ default: m.SceneWorkspace })));
const ShotWorkspace = React.lazy(() => import('./components/workspaces/ShotWorkspace').then(m => ({ default: m.ShotWorkspace })));
const CharacterBibleWorkspace = React.lazy(() => import('./components/workspaces/CharacterBibleWorkspace').then(m => ({ default: m.CharacterBibleWorkspace })));
const LocationBibleWorkspace = React.lazy(() => import('./components/workspaces/LocationBibleWorkspace').then(m => ({ default: m.LocationBibleWorkspace })));
const AssetBibleWorkspace = React.lazy(() => import('./components/workspaces/AssetBibleWorkspace').then(m => ({ default: m.AssetBibleWorkspace })));
const ContinuityWorkspace = React.lazy(() => import('./components/workspaces/ContinuityWorkspace').then(m => ({ default: m.ContinuityWorkspace })));
const PipelineOrchestratorWorkspace = React.lazy(() => import('./components/workspaces/PipelineOrchestratorWorkspace').then(m => ({ default: m.PipelineOrchestratorWorkspace })));
const PromptStudioWorkspace = React.lazy(() => import('./components/workspaces/PromptStudioWorkspace').then(m => ({ default: m.PromptStudioWorkspace })));
const GenerationQueueWorkspace = React.lazy(() => import('./components/workspaces/GenerationQueueWorkspace').then(m => ({ default: m.GenerationQueueWorkspace })));
const SettingsWorkspace = React.lazy(() => import('./components/workspaces/SettingsWorkspace').then(m => ({ default: m.SettingsWorkspace })));
const ExportWorkspace = React.lazy(() => import('./components/workspaces/ExportWorkspace').then(m => ({ default: m.ExportWorkspace })));

import {
  Project,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  VideoPrompt,
  PipelineLogEvent,
  PromptLanguage,
  StoryArchitecture,
  CharacterContinuityState,
  ApprovedCostumeTransition,
  PromptTarget,
  PromptLockState,
  StudioWorkspaceTab,
  ReasoningConfig,
} from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [foundation, setFoundation] = useState<ProjectFoundation | null>(null);
  const [storyArchitecture, setStoryArchitecture] = useState<StoryArchitecture | null>(null);
  const [characters, setCharacters] = useState<CharacterBible[]>([]);
  const [continuityStates, setContinuityStates] = useState<CharacterContinuityState[]>([]);
  const [locations, setLocations] = useState<LocationBible[]>([]);
  const [objects, setObjects] = useState<ObjectBible[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shots, setShots] = useState<Record<string, Shot[]>>({});
  const [videoPrompts, setVideoPrompts] = useState<Record<string, VideoPrompt[]>>({});
  const [logs, setLogs] = useState<PipelineLogEvent[]>([]);

  // Top Level Navigation Mode: 'dashboard' | 'production' | 'studio'
  const [mainMode, setMainMode] = useState<'dashboard' | 'production' | 'studio'>('dashboard');

  const [activeTab, setActiveTab] = useState<StudioWorkspaceTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState<boolean>(false);
  const [isDriveExportOpen, setIsDriveExportOpen] = useState<boolean>(false);
  const [isDriveImportOpen, setIsDriveImportOpen] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isLoadingProjectDetails, setIsLoadingProjectDetails] = useState<boolean>(false);
  const [processingSceneId, setProcessingSceneId] = useState<string | null>(null);
  const [processingShotId, setProcessingShotId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  // PATCH 5.5-R1 FASE 5: per-shot generation error, drives the `error` UI state.
  // A failed contract means NOTHING was persisted, so the cell must not pretend
  // a prompt exists.
  const [shotPromptError, setShotPromptError] = useState<Record<string, string>>({});
  const [isPipelineCarouselOpen, setIsPipelineCarouselOpen] = useState<boolean>(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);


  const eventSourceRef = useRef<EventSource | null>(null);

  // Keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch all projects list
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const list: Project[] = await res.json().catch(() => []);
        setProjects(list);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const inFlightProjectLoadRef = useRef<string | null>(null);

  // Fetch full project data by ID
  const loadProjectDetails = useCallback(async (projectId: string, skipTabReset = false) => {
    if (inFlightProjectLoadRef.current === projectId) return;
    inFlightProjectLoadRef.current = projectId;
    setIsLoadingProjectDetails(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data || !data.project) {
          console.error('Failed to parse project details response as JSON or project missing');
          return;
        }
        setCurrentProject(data.project);
        setFoundation(data.foundation);
        setStoryArchitecture(data.story_architecture || null);
        setCharacters(data.characters || []);
        setContinuityStates(data.continuity_states || []);
        setLocations(data.locations || []);
        setObjects(data.objects || []);
        setScenes(data.scenes || []);
        setShots(data.shots || {});
        setVideoPrompts(data.video_prompts || {});
        setLogs(data.logs || []);

        if (!skipTabReset) {
          if (data.project.status === 'completed') {
            setActiveTab('overview');
          } else {
            setActiveTab('pipeline');
          }
          setMainMode('studio');
        }
      } else {
        const errBody = await res.json().catch(() => ({ error: `HTTP status ${res.status}` }));
        console.error('Failed to load project details:', errBody.error || errBody);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      inFlightProjectLoadRef.current = null;
      setIsLoadingProjectDetails(false);
    }
  }, []);

  // Set up SSE stream for real-time orchestrator updates
  useEffect(() => {
    // Only connect when project is actively generating/processing
    if (!currentProject || currentProject.status !== 'processing') {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const projectId = currentProject.id;
    const sse = new EventSource(`/api/projects/${projectId}/stream`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
            setLogs(data.logs);
          }
          if (data.project) {
            setCurrentProject((prev) => (prev && prev.id === projectId ? { ...prev, ...data.project } : data.project));
          }
        } else if (data.type === 'progress') {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: data.timestamp || new Date().toISOString(),
              stage: data.stage,
              stage_name: data.stageName,
              level: data.level || 'info',
              message: data.message,
            },
          ]);
          if (data.level === 'error' && data.message) {
            setPipelineError(data.message);
          }
          setCurrentProject((prev) => (prev ? { ...prev, current_stage: data.stage, status: 'processing' } : null));
        } else if (data.type === 'finished') {
          if (data.success === false && data.error) {
            setPipelineError(data.error);
            setCurrentProject((prev) => (prev ? { ...prev, status: 'failed', error_message: data.error } : null));
          } else {
            setCurrentProject((prev) => (prev ? { ...prev, status: 'completed', current_stage: 8 } : null));
          }
          loadProjectDetails(projectId, true);
          fetchProjects();
        } else if (data.type === 'end') {
          // The server intentionally ended this stream (serverless-safe) — stop
          // the EventSource so it does not auto-reconnect and churn invocations.
          sse.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    sse.onerror = () => {
      // EventSource reconnects automatically on transient network drop
    };

    return () => {
      sse.close();
    };
  }, [currentProject?.id, currentProject?.status, loadProjectDetails, fetchProjects]);

  // Polling fallback during active processing to guarantee state updates even if SSE is delayed
  useEffect(() => {
    if (!currentProject || currentProject.status !== 'processing') return;

    const projectId = currentProject.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.project) {
            setCurrentProject((prev) => {
              if (!prev || prev.id !== projectId) return prev;
              return {
                ...prev,
                ...data.project,
              };
            });
            if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
              setLogs(data.logs);
            }
            if (data.project.status === 'completed' || data.project.status === 'failed') {
              loadProjectDetails(projectId, true);
              fetchProjects();
            }
          }
        }
      } catch (err) {
        console.warn('Polling check encountered error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [currentProject?.id, currentProject?.status, loadProjectDetails, fetchProjects]);

  // Initial load
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create new project and kick off pipeline
  const handleCreateProject = async (formData: {
    title: string;
    raw_script: string;
    total_duration_target_sec: number;
    max_scene_shot_duration_sec: number | null;
    prompt_language: PromptLanguage;
    ai_model?: string;
    reasoning_config?: ReasoningConfig;
    image_model?: any;
    video_model?: any;
    include_seedance_format?: boolean;
    allow_final_scene_override?: boolean;
    scene_duration_sec?: number | null;
  }) => {
    setIsCreating(true);
    setIsPipelineCarouselOpen(true);
    setPipelineError(null);
    try {
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const createData = await createRes.json().catch(() => null);

      if (!createRes.ok || !createData) {
        throw new Error(createData?.error || 'Failed to create project');
      }

      // Immediately set project with status 'processing' and current_stage 1 so SSE and visual carousel activate
      const newProject: Project = {
        ...createData,
        status: 'processing',
        current_stage: 1,
      };
      setCurrentProject(newProject);
      setFoundation(null);
      setCharacters([]);
      setLocations([]);
      setObjects([]);
      setScenes([]);
      setLogs([
        {
          timestamp: new Date().toISOString(),
          stage: 1,
          stage_name: 'Pipeline Orchestrator',
          level: 'info',
          message: 'Memulai eksekusi otomatis pipeline cetak biru sinematik...',
        },
      ]);
      setActiveTab('pipeline');
      setMainMode('studio');

      const genRes = await fetch(`/api/projects/${newProject.id}/generate`, {
        method: 'POST',
      });
      const genData = await genRes.json().catch(() => null);
      if (!genRes.ok) {
        throw new Error(genData?.error || 'Gagal memulai generate pipeline.');
      }

      if (genData?.project) {
        setCurrentProject(genData.project);
      }

      await fetchProjects();
    } catch (err: any) {
      console.error('Error in handleCreateProject:', err);
      setPipelineError(err?.message || 'Gagal memulai orkestrasi pipeline.');
      setCurrentProject((prev) => (prev ? { ...prev, status: 'failed', error_message: err?.message } : null));
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportSuccess = async (importedRes: any) => {
    try {
      const proj = importedRes.project;
      if (proj && proj.id) {
        await fetchProjects();
        await loadProjectDetails(proj.id);
        setMainMode('studio');
        setActiveTab('overview');
      }
    } catch (err) {
      console.error('Error handling import success:', err);
    }
  };

  const handleRetryPipeline = async () => {
    if (!currentProject) return;
    try {
      setLogs([]);
      setPipelineError(null);
      setIsPipelineCarouselOpen(true);
      setCurrentProject((prev) => (prev ? { ...prev, status: 'processing', current_stage: 1 } : null));
      setActiveTab('pipeline');
      await fetch(`/api/projects/${currentProject.id}/generate`, {
        method: 'POST',
      });
    } catch (err: any) {
      console.error('Failed to retry pipeline:', err);
      setPipelineError(err?.message || 'Gagal melanjutkan pipeline.');
    }
  };

  const handleStopPipeline = async () => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/stop`, {
        method: 'POST',
      });
      setCurrentProject((prev) => (prev ? { ...prev, status: 'failed', error_message: 'Pipeline dihentikan oleh pengguna.' } : null));
    } catch (err) {
      console.error('Failed to stop pipeline:', err);
    }
  };

  const handleResetPipeline = async () => {
    if (!currentProject) return;
    try {
      setLogs([]);
      setPipelineError(null);
      setIsPipelineCarouselOpen(true);
      const res = await fetch(`/api/projects/${currentProject.id}/reset`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          setCurrentProject(data.project);
        }
        await fetch(`/api/projects/${currentProject.id}/generate`, {
          method: 'POST',
        });
        setCurrentProject((prev) => (prev ? { ...prev, status: 'processing', current_stage: 1 } : null));
        setActiveTab('pipeline');
      }
    } catch (err: any) {
      console.error('Failed to reset pipeline:', err);
      setPipelineError(err?.message || 'Gagal mereset pipeline.');
    }
  };

  const handleChangeModelAndRetry = async (newModel: string) => {
    if (!currentProject) return;
    try {
      setLogs([]);
      const patchRes = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_model: newModel }),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        setCurrentProject({ ...updated, status: 'processing', current_stage: 1 });
      }
      setActiveTab('pipeline');
      await fetch(`/api/projects/${currentProject.id}/generate`, {
        method: 'POST',
      });
      await fetchProjects();
    } catch (err) {
      console.error('Failed to change model and retry:', err);
    }
  };

  const handleRunScenePipeline = async (sceneId: string) => {
    if (!currentProject) return;
    setProcessingSceneId(sceneId);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/run-pipeline`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id, true);
      }
    } catch (err) {
      console.error('Failed to run scene pipeline:', err);
    } finally {
      setProcessingSceneId(null);
    }
  };

  const handleRegenerateScenePrompt = async (sceneId: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/scenes/${sceneId}/regenerate-prompt`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id, true);
      }
    } catch (err) {
      console.error('Failed to regenerate scene prompt:', err);
    }
  };

  const handleUpdateSceneImage = async (sceneId: string, imageUrl: string | null) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_frame_image_url: imageUrl }),
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id, true);
      }
    } catch (err) {
      console.error('Failed to update scene image:', err);
    }
  };

  const handleUpdateShotImage = async (shotId: string, imageUrl: string | null) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/shots/${shotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_image_url: imageUrl }),
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id, true);
      }
    } catch (err) {
      console.error('Failed to update shot image:', err);
    }
  };

  /**
   * PATCH 5.5-R1 FASE 5: the caller MUST name an explicit PromptTarget.
   *
   * `target` is required — there is no `|| 'seedance'` and no silent default.
   * The field sent over the wire is `target`, the canonical 5.5 field, not the
   * legacy `platform` alias. The server still accepts aliases for old clients,
   * but this UI no longer depends on that compatibility layer.
   */
  const handleRunShotPrompt = async (shotId: string, target: PromptTarget) => {
    if (!currentProject || processingShotId === shotId) return;
    setProcessingShotId(shotId);
    setShotPromptError((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
    try {
      const res = await fetch(`/api/shots/${shotId}/regenerate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && body.shot) {
          // Direct local state patch - avoids refetching the entire project payload
          setShots((prev) => {
            const next = { ...prev };
            for (const scId of Object.keys(next)) {
              next[scId] = next[scId].map((s) => (s.id === shotId ? { ...s, ...body.shot } : s));
            }
            return next;
          });
          if (body.prompts && Array.isArray(body.prompts)) {
            setVideoPrompts((prev) => ({
              ...prev,
              [shotId]: body.prompts,
            }));
          }
        } else {
          await loadProjectDetails(currentProject.id, true);
        }
      } else {
        // 400 INVALID_PROMPT_TARGET / 422 contract failure: nothing was
        // persisted server-side, so surface the error instead of a stale prompt.
        const body = await res.json().catch(() => ({}));
        setShotPromptError((prev) => ({
          ...prev,
          [shotId]: body?.error || `Gagal generate prompt ${target} (HTTP ${res.status}).`,
        }));
      }
    } catch (err) {
      console.error('Failed to regenerate shot prompt:', err);
      setShotPromptError((prev) => ({
        ...prev,
        [shotId]: `Gagal generate prompt ${target}.`,
      }));
    } finally {
      setProcessingShotId(null);
    }
  };

  /**
   * PHASE 6 / 7B: Smart Regenerate with explicit lock states and deterministic compiler execution.
   */
  const handleSmartRegenerateShot = async (
    shotId: string,
    target: PromptTarget,
    lockState?: PromptLockState,
    reason = 'FULL',
    requireAi = false
  ) => {
    if (!currentProject || processingShotId === shotId) return;
    setProcessingShotId(shotId);
    setShotPromptError((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
    try {
      const res = await fetch(`/api/shots/${shotId}/smart-regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          reason,
          require_ai: requireAi,
          field_locks: lockState,
        }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && body.shot) {
          setShots((prev) => {
            const next = { ...prev };
            for (const scId of Object.keys(next)) {
              next[scId] = next[scId].map((s) => (s.id === shotId ? { ...s, ...body.shot } : s));
            }
            return next;
          });
          if (body.prompts && Array.isArray(body.prompts)) {
            setVideoPrompts((prev) => ({
              ...prev,
              [shotId]: body.prompts,
            }));
          }
        } else {
          await loadProjectDetails(currentProject.id, true);
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setShotPromptError((prev) => ({
          ...prev,
          [shotId]: body?.error || `Gagal smart regenerate ${target} (HTTP ${res.status}).`,
        }));
      }
    } catch (err) {
      console.error('Failed to smart regenerate shot prompt:', err);
      setShotPromptError((prev) => ({
        ...prev,
        [shotId]: `Gagal smart regenerate prompt ${target}.`,
      }));
    } finally {
      setProcessingShotId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjects();
        if (currentProject?.id === projectId) {
          setCurrentProject(null);
          setFoundation(null);
          setStoryArchitecture(null);
          setCharacters([]);
          setLocations([]);
          setObjects([]);
          setScenes([]);
          setShots({});
          setVideoPrompts({});
          setLogs([]);
          setMainMode('production');
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Gagal menghapus proyek' }));
        console.error('Failed to delete project on server:', errorData);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const totalShotsCount = Object.values(shots).reduce((acc: number, curr: Shot[]) => acc + (curr?.length || 0), 0);
  const unreadLogsCount = logs.filter((l) => l.level === 'error' || l.level === 'warn').length;

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#090B10] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-hidden relative">
      {/* Top Bar */}
      <TopBar
        currentProject={currentProject}
        activeTab={activeTab}
        mainMode={mainMode}
        onSelectMainMode={(mode) => {
          if (mode === 'studio' && !currentProject) {
            setMainMode('production');
          } else {
            setMainMode(mode);
          }
        }}
        onNavigate={(tab) => {
          if (!currentProject && tab !== 'overview' && tab !== 'settings') {
            setIsProjectsModalOpen(true);
            return;
          }
          setActiveTab(tab);
          setMainMode('studio');
        }}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
        onOpenDriveExport={() => setIsDriveExportOpen(true)}
        onOpenVersionHistory={() => setIsVersionModalOpen(true)}
        onNewProject={() => {
          setCurrentProject(null);
          setMainMode('production');
        }}
        onChangeModel={handleChangeModelAndRetry}
        unreadCount={unreadLogsCount}
        isGenerating={currentProject?.status === 'processing'}
        onOpenMobileMenu={() => setIsMobileNavOpen(true)}
      />

      {/* Main View Router */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative pb-16 md:pb-0">
        {isInitialLoading && (
          <div className="absolute inset-0 bg-[#090B10]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs font-mono tracking-wider uppercase text-slate-400">Menghubungkan ke Studio AI...</p>
          </div>
        )}

        {isLoadingProjectDetails && (
          <div className="fixed inset-0 bg-[#090B10]/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150 pointer-events-none">
            <div className="p-4 rounded-2xl bg-[#151722] border border-indigo-500/30 shadow-2xl flex items-center gap-3 text-slate-200 text-sm font-medium">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <span>Memuat data proyek sinematik...</span>
            </div>
          </div>
        )}

        {mainMode === 'dashboard' && (
          <div className="flex-1 min-h-0 h-full overflow-y-auto bg-[#090B10] scrollbar-thin">
            <MainDashboardView
              projects={projects}
              activeProject={currentProject}
              logs={logs}
              onSelectProject={(id) => {
                loadProjectDetails(id);
              }}
              onDeleteProject={handleDeleteProject}
              onOpenCreateModal={() => setMainMode('production')}
              onOpenProductionPage={() => setMainMode('production')}
            />
          </div>
        )}

        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-[#090B10]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        }>
          {mainMode === 'production' && (
            <div className="flex-1 min-h-0 h-full overflow-y-auto bg-[#090B10] scrollbar-thin">
              <ProductionProjectsView
                projects={projects}
                activeProjectId={currentProject?.id || null}
                onSelectProject={(id) => {
                  loadProjectDetails(id);
                }}
                onDeleteProject={handleDeleteProject}
                onCreateProject={handleCreateProject}
                isCreating={isCreating}
                onOpenPipelineModal={() => setIsPipelineCarouselOpen(true)}
              />
            </div>
          )}

        {mainMode === 'studio' && (
          <>
            {!currentProject && activeTab !== 'settings' ? (
              <div className="flex-1 min-h-0 h-full overflow-y-auto bg-[#090B10] scrollbar-thin">
                <ProductionProjectsView
                  projects={projects}
                  activeProjectId={null}
                  onSelectProject={(id) => {
                    loadProjectDetails(id);
                  }}
                  onDeleteProject={handleDeleteProject}
                  onCreateProject={handleCreateProject}
                  isCreating={isCreating}
                  onOpenPipelineModal={() => setIsPipelineCarouselOpen(true)}
                />
              </div>
            ) : (
              <UnifiedStudioLayout
                currentProject={currentProject}
                foundation={foundation}
                storyArchitecture={storyArchitecture}
                scenes={scenes}
                shots={shots}
                characters={characters}
                locations={locations}
                objects={objects}
                videoPrompts={videoPrompts}
                activeTab={activeTab}
                onSelectTab={(tab) => setActiveTab(tab)}
                selectedSceneId={selectedSceneId || scenes[0]?.id || null}
                onSelectScene={setSelectedSceneId}
                selectedShotId={selectedShotId}
                onSelectShot={setSelectedShotId}
                onBackToProjects={() => setMainMode('production')}
                onRetryPipeline={handleRetryPipeline}
                onOpenExport={() => setIsDriveExportOpen(true)}
                isGenerating={currentProject?.status === 'processing'}
                onRunShotPrompt={handleRunShotPrompt}
                onSmartRegenerate={handleSmartRegenerateShot}
                onUpdateShotImage={handleUpdateShotImage}
                processingShotId={processingShotId}
                shotPromptError={shotPromptError ? Object.values(shotPromptError)[0] : undefined}
              >
                {activeTab === 'overview' && (
                  <ProjectDashboardWorkspace
                    project={currentProject}
                    foundation={foundation}
                    storyArchitecture={storyArchitecture}
                    characters={characters}
                    locations={locations}
                    objects={objects}
                    scenes={scenes}
                    shots={shots}
                    logs={logs}
                    onNavigate={(tab) => setActiveTab(tab)}
                    onRetryPipeline={handleRetryPipeline}
                    onOpenExport={() => setIsDriveExportOpen(true)}
                  />
                )}

                {activeTab === 'story' && (
                  <StoryWorkspace
                    storyArchitecture={storyArchitecture}
                    scenes={scenes}
                    onNavigate={(tab) => setActiveTab(tab)}
                  />
                )}

                {(activeTab === 'scenes' || activeTab === 'storyboard') && (
                  <SceneWorkspace
                    project={currentProject}
                    foundation={foundation}
                    storyArchitecture={storyArchitecture}
                    scenes={scenes}
                    shots={shots}
                    videoPrompts={videoPrompts}
                    characters={characters}
                    locations={locations}
                    objects={objects}
                    selectedSceneId={selectedSceneId || undefined}
                    onSelectScene={(scId) => setSelectedSceneId(scId)}
                    selectedShotId={selectedShotId || undefined}
                    onSelectShot={(shId) => setSelectedShotId(shId)}
                    onRunScenePipeline={handleRunScenePipeline}
                    onRegenerateScenePrompt={handleRegenerateScenePrompt}
                    onUpdateSceneImage={handleUpdateSceneImage}
                    onUpdateShotImage={handleUpdateShotImage}
                    onRunShotPrompt={handleRunShotPrompt}
                    onSmartRegenerate={handleSmartRegenerateShot}
                    processingSceneId={processingSceneId}
                    processingShotId={processingShotId}
                    shotPromptError={shotPromptError}
                  />
                )}

                {activeTab === 'shots' && (
                  <ShotWorkspace
                    scenes={scenes}
                    shots={shots}
                    videoPrompts={videoPrompts}
                    onRunShotPrompt={handleRunShotPrompt}
                    onUpdateShotImage={handleUpdateShotImage}
                    processingShotId={processingShotId}
                    shotPromptError={shotPromptError}
                    characters={characters}
                    locations={locations}
                    objects={objects}
                  />
                )}

                {activeTab === 'assets' && (
                  <AssetBibleWorkspace
                    characters={characters}
                    locations={locations}
                    objects={objects}
                  />
                )}

                {(activeTab === 'continuity' || activeTab === 'validation') && (
                  <ContinuityWorkspace
                    project={currentProject}
                    characters={characters}
                    locations={locations}
                    scenes={scenes}
                  />
                )}

                {activeTab === 'pipeline' && (
                  <PipelineOrchestratorWorkspace
                    project={currentProject}
                    logs={logs}
                    onRetryPipeline={handleRetryPipeline}
                    onStopPipeline={handleStopPipeline}
                    onResetPipeline={handleResetPipeline}
                    isGenerating={currentProject?.status === 'processing'}
                    onOpenVisualCarousel={() => setIsPipelineCarouselOpen(true)}
                  />
                )}

                {activeTab === 'prompts' && (
                  <PromptStudioWorkspace scenes={scenes} shots={shots} />
                )}

                {activeTab === 'queue' && (
                  <GenerationQueueWorkspace scenes={scenes} shots={shots} />
                )}

                {activeTab === 'export' && (
                  <ExportWorkspace
                    project={currentProject}
                    scenes={scenes}
                    shots={shots}
                    onOpenExportDriveModal={() => setIsDriveExportOpen(true)}
                    onOpenImportDriveModal={() => setIsDriveImportOpen(true)}
                    onImportSuccess={handleImportSuccess}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsWorkspace
                    project={currentProject}
                    onChangeModel={handleChangeModelAndRetry}
                    onDeleteProject={handleDeleteProject}
                  />
                )}
              </UnifiedStudioLayout>
            )}
          </>
        )}
        </Suspense>
      </div>

      {/* Modals & Overlays - Lazy and strictly rendered when open */}
      <Suspense fallback={null}>
        {isProjectsModalOpen && (
          <ProjectListModal
            isOpen={isProjectsModalOpen}
            onClose={() => setIsProjectsModalOpen(false)}
            projects={projects}
            currentProjectId={currentProject?.id || null}
            onSelectProject={(projId) => loadProjectDetails(projId)}
            onDeleteProject={handleDeleteProject}
            onNewProject={() => {
              setCurrentProject(null);
            }}
            onOpenImport={() => setIsDriveImportOpen(true)}
          />
        )}

        {isDriveExportOpen && currentProject && (
          <GoogleDriveExportModal
            isOpen={isDriveExportOpen}
            onClose={() => setIsDriveExportOpen(false)}
            projectData={{
              project: currentProject,
              foundation,
              characters,
              locations,
              objects,
              scenes,
              shots,
              videoPrompts,
              exportedAt: new Date().toISOString(),
            }}
          />
        )}

        {isDriveImportOpen && (
          <GoogleDriveImportModal
            isOpen={isDriveImportOpen}
            onClose={() => setIsDriveImportOpen(false)}
            onImportSuccess={handleImportSuccess}
          />
        )}

        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            project={currentProject}
            scenes={scenes}
            characters={characters}
            locations={locations}
            objects={objects}
            onNavigate={(tab) => {
              if (!currentProject) return;
              setActiveTab(tab);
            }}
            onNewProject={() => {
              setCurrentProject(null);
            }}
            onOpenProjects={() => setIsProjectsModalOpen(true)}
            onOpenExport={() => setIsDriveExportOpen(true)}
            onRetryPipeline={handleRetryPipeline}
          />
        )}

        {isNotificationCenterOpen && (
          <NotificationCenter
            isOpen={isNotificationCenterOpen}
            onClose={() => setIsNotificationCenterOpen(false)}
            logs={logs}
            onRetryStage={handleRetryPipeline}
          />
        )}

        {isVersionModalOpen && (
          <VersionHistoryModal
            isOpen={isVersionModalOpen}
            onClose={() => setIsVersionModalOpen(false)}
          />
        )}

        <PipelineCardCarouselModal
          isOpen={isPipelineCarouselOpen}
          project={currentProject}
          logs={logs}
          scenes={scenes}
          shots={shots}
          videoPrompts={videoPrompts}
          isGenerating={currentProject?.status === 'processing' || isCreating}
          error={pipelineError}
          onClose={() => setIsPipelineCarouselOpen(false)}
          onOpenPipelineDetails={() => {
            setIsPipelineCarouselOpen(false);
            setMainMode('studio');
            setActiveTab('pipeline');
          }}
          onOpenStudio={() => {
            setIsPipelineCarouselOpen(false);
            setMainMode('studio');
            setActiveTab('overview');
          }}
        />

        {/* Mobile Navigation Components (<=768px) */}
        <MobileNavDrawer
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          currentProject={currentProject}
          activeTab={activeTab}
          mainMode={mainMode}
          onSelectMainMode={setMainMode}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            setMainMode('studio');
          }}
          onNewProject={() => {
            setCurrentProject(null);
            setMainMode('production');
          }}
          onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
          onOpenDriveExport={() => setIsDriveExportOpen(true)}
          unreadCount={unreadLogsCount}
          isGenerating={currentProject?.status === 'processing'}
        />

        <MobileBottomNav
          mainMode={mainMode}
          activeTab={activeTab}
          currentProject={currentProject}
          onSelectMainMode={setMainMode}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            setMainMode('studio');
          }}
          onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
          isGenerating={currentProject?.status === 'processing'}
        />
      </Suspense>
    </div>
  );
}

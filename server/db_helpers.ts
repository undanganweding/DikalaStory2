import { Project } from '../src/types';
import { DEFAULT_NARRATIVE_STYLE_CONFIG } from './narrative_tone';

export const ephemeralApiKeys = new Map<string, string>();

export function sanitizeProjectForStorage(project: Partial<Project>): Partial<Project> {
  const copy = { ...project };
  if (copy.id && copy.reasoning_config?.api_key) {
    ephemeralApiKeys.set(copy.id, copy.reasoning_config.api_key);
    const { api_key, ...restConfig } = copy.reasoning_config;
    copy.reasoning_config = restConfig;
  }
  if (copy.consistencyReports && Array.isArray(copy.consistencyReports)) {
    const seenStages = new Set<string>();
    const compacted = [];
    for (let i = copy.consistencyReports.length - 1; i >= 0; i--) {
      const rep = copy.consistencyReports[i];
      const key = rep.stage || `idx_${i}`;
      if (!seenStages.has(key)) {
        seenStages.add(key);
        const cleanRep = { ...rep };
        if (cleanRep.warnings && Array.isArray(cleanRep.warnings)) {
          cleanRep.warnings = cleanRep.warnings.map((w: string) =>
            typeof w === 'string' && w.length > 200 ? `${w.slice(0, 180)}...` : w
          );
        }
        compacted.unshift(cleanRep);
      }
    }
    copy.consistencyReports = compacted;
  }
  return copy;
}

export function attachEphemeralApiKey(project: Project | null): Project | null {
  if (!project) return null;
  if (!project.reasoning_model_preferences) {
    const primaryModelId = project.reasoning_config?.model_id || project.ai_model || 'gemini-2.5-flash';
    project.reasoning_model_preferences = {
      mode: 'fixed',
      primary_model: {
        provider: project.reasoning_config?.provider_type || 'google',
        model_id: primaryModelId,
        display_name: project.reasoning_config?.display_name || primaryModelId,
      },
      fallback_policy: 'off',
      fallback_pool: [
        { provider: 'google', model_id: 'gemini-2.5-flash', priority: 1, display_name: 'Gemini 2.5 Flash' },
        { provider: 'google', model_id: 'gemini-3.8-flash', priority: 2, display_name: 'Gemini 3.8 Flash' },
        { provider: 'google', model_id: 'gemini-flash-latest', priority: 3, display_name: 'Gemini Flash Latest' },
      ],
      force_model: false,
      stage_routing: {},
    };
  }
  if (project.reasoning_config && ephemeralApiKeys.has(project.id)) {
    project.reasoning_config.api_key = ephemeralApiKeys.get(project.id);
  }
  if (project.reasoning_config && project.reasoning_model_preferences) {
    (project.reasoning_config as any).modelPreferences = project.reasoning_model_preferences;
  }
  if (!project.duration_mode) {
    project.duration_mode = project.scene_duration_sec ? 'fixed' : 'auto';
  }
  if (project.fixed_scene_duration === undefined) {
    project.fixed_scene_duration = project.scene_duration_sec ?? null;
  }
  if (!project.narrative_style_config) {
    project.narrative_style_config = {
      ...DEFAULT_NARRATIVE_STYLE_CONFIG,
      language: project.prompt_language === 'en' ? 'en-US' : 'id-ID',
    };
  }
  return project;
}

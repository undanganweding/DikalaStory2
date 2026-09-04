-- ============================================================================
-- SINEMA SUPABASE POSTGRESQL SCHEMA (PHASE 1 - REFINED)
-- ============================================================================
-- Philosophy:
-- 1. Normalized Relational Core: Entities with strict key relationships.
-- 2. Clean Domain Package Tables: Separates large AI packages out of projects table.
-- 3. Dedicated Telemetry/Logging: High-throughput log and metrics tables.
-- 4. RLS & Security: Server-only service_role access, default-deny for public.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE RELATIONAL ENTITIES
-- ============================================================================

-- Projects Table (Core Metadata Only)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raw_script TEXT NOT NULL DEFAULT '',
  total_duration_target_sec INTEGER NOT NULL DEFAULT 60,
  max_scene_shot_duration_sec INTEGER,
  scene_duration_sec INTEGER,
  duration_mode TEXT NOT NULL DEFAULT 'auto',
  fixed_scene_duration INTEGER,
  project_duration INTEGER,
  timeline_scene_duration INTEGER,
  duration_mode_override TEXT,
  model_output_duration INTEGER,
  selected_extended_duration INTEGER,
  primary_video_model TEXT NOT NULL DEFAULT 'veo',
  foundation_status TEXT NOT NULL DEFAULT 'not_initialized',
  allow_final_scene_override BOOLEAN NOT NULL DEFAULT false,
  prompt_language TEXT NOT NULL DEFAULT 'id',
  image_model TEXT NOT NULL DEFAULT 'nano_banana_pro',
  video_model JSONB NOT NULL DEFAULT '["veo"]'::jsonb,
  include_seedance_format BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  current_stage INTEGER DEFAULT 1,
  error_message TEXT,
  duration_validation_passed BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  active_run_id TEXT,
  latest_run_id TEXT,
  reasoning_config JSONB,
  reasoning_model_preferences JSONB,
  owner_id TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);

-- Project Foundations (1:1 with Projects)
CREATE TABLE IF NOT EXISTS project_foundations (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  era TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL DEFAULT '',
  timeline TEXT NOT NULL DEFAULT '',
  main_characters JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_characters JSONB NOT NULL DEFAULT '[]'::jsonb,
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  main_conflict TEXT NOT NULL DEFAULT '',
  emotional_arc TEXT NOT NULL DEFAULT '',
  narrative_arc TEXT NOT NULL DEFAULT '',
  visual_tone TEXT NOT NULL DEFAULT '',
  narrative_beats JSONB,
  is_historical_religious_biography BOOLEAN DEFAULT false,
  research_basic_facts JSONB,
  research_timeline JSONB,
  research_era_context JSONB,
  research_sources JSONB,
  act_1_world_setup JSONB,
  act_2_human_element JSONB,
  act_3_rising_conflict JSONB,
  act_4_climax_breath JSONB,
  act_5_legacy_meaning JSONB,
  narrative_style_mode TEXT,
  islamic_validation_safeguard JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  physical_appearance TEXT DEFAULT '',
  physical_description TEXT,
  role TEXT,
  importance TEXT,
  face_identity_locked BOOLEAN NOT NULL DEFAULT false,
  identity_version INTEGER DEFAULT 1,
  hair TEXT DEFAULT '',
  beard TEXT DEFAULT '',
  clothing JSONB NOT NULL DEFAULT '[]'::jsonb,
  costume TEXT,
  wardrobe TEXT,
  accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  personality TEXT DEFAULT '',
  voice_character TEXT DEFAULT '',
  movement_style TEXT DEFAULT '',
  master_portrait_prompt TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);

-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  era TEXT DEFAULT '',
  architecture TEXT DEFAULT '',
  architectural_style TEXT,
  environment TEXT DEFAULT '',
  environment_type TEXT,
  landscape TEXT DEFAULT '',
  climate TEXT DEFAULT '',
  culture TEXT DEFAULT '',
  lighting_style TEXT DEFAULT '',
  lighting_atmosphere TEXT,
  lighting_vibe TEXT,
  spatial_details TEXT,
  description TEXT,
  color_palette JSONB NOT NULL DEFAULT '[]'::jsonb,
  material TEXT DEFAULT '',
  master_environment_prompt TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_project_id ON locations(project_id);

-- Objects Table
CREATE TABLE IF NOT EXISTS objects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  continuity_notes TEXT DEFAULT '',
  material TEXT,
  owner TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objects_project_id ON objects(project_id);

-- Scenes Table
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 5,
  story_purpose TEXT DEFAULT '',
  location_name TEXT DEFAULT '',
  time_of_day TEXT DEFAULT '',
  character_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotional_objective TEXT DEFAULT '',
  event TEXT DEFAULT '',
  narrative_function TEXT DEFAULT '',
  sequence_id TEXT,
  act_id TEXT,
  continuity_scope JSONB,
  conflict TEXT,
  beginning_state TEXT,
  ending_state TEXT,
  beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  narrative_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
  scene_tone JSONB,
  master_frame_image_url TEXT,
  master_image_prompt TEXT,
  master_image_prompt_json JSONB,
  image_gen_status TEXT DEFAULT 'pending',
  image_gen_error TEXT,
  full_scene_prompt TEXT,
  full_scene_prompt_status TEXT,
  continuity_status TEXT DEFAULT 'pending',
  continuity_violations JSONB DEFAULT '[]'::jsonb,
  pipeline_status TEXT DEFAULT 'READY',
  blockers JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  version INTEGER NOT NULL DEFAULT 1,
  visual_anchor JSONB,
  anchor_ref TEXT,
  timeline JSONB DEFAULT '[]'::jsonb,
  character_refs JSONB DEFAULT '[]'::jsonb,
  object_refs JSONB DEFAULT '[]'::jsonb,
  location_ref TEXT,
  costume_ref TEXT,
  master_camera JSONB,
  master_composition JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_number ON scenes(project_id, scene_number ASC);

-- Shots Table
CREATE TABLE IF NOT EXISTS shots (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_number INTEGER NOT NULL,
  start_time_sec NUMERIC NOT NULL DEFAULT 0,
  end_time_sec NUMERIC NOT NULL DEFAULT 5,
  duration_sec NUMERIC NOT NULL DEFAULT 5,
  event_detail TEXT DEFAULT '',
  character_action TEXT DEFAULT '',
  camera_note TEXT DEFAULT '',
  dialogue JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotion TEXT DEFAULT '',
  audio_note TEXT DEFAULT '',
  beat_id TEXT,
  beat_number INTEGER,
  narrative_mode TEXT,
  cinematic_grammar JSONB,
  shot_image_url TEXT,
  image_url TEXT,
  visual_description TEXT,
  action TEXT,
  camera_movement TEXT,
  shot_type TEXT,
  audio_narration TEXT,
  sound_effects TEXT,
  master_image_prompt TEXT,
  video_prompt TEXT,
  seedance_prompt TEXT,
  asset_refs JSONB DEFAULT '[]'::jsonb,
  character_refs JSONB DEFAULT '[]'::jsonb,
  location_ref TEXT,
  costume_ref TEXT,
  object_refs JSONB DEFAULT '[]'::jsonb,
  visual_anchor_ref TEXT,
  lock_state JSONB,
  camera JSONB,
  composition JSONB,
  prompt_versions JSONB DEFAULT '[]'::jsonb,
  selected_platform TEXT,
  recommended_platform TEXT,
  fallback_platforms JSONB DEFAULT '[]'::jsonb,
  generation_container_sec INTEGER,
  generation_status TEXT DEFAULT 'not_started',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shots_scene_number ON shots(scene_id, shot_number ASC);
CREATE INDEX IF NOT EXISTS idx_shots_project_number ON shots(project_id, shot_number ASC);

-- Video Prompts Table
CREATE TABLE IF NOT EXISTS video_prompts (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_platform TEXT NOT NULL,
  prompt_target TEXT,
  generation_type TEXT NOT NULL DEFAULT 'direct',
  status TEXT DEFAULT 'ready',
  error TEXT,
  timeline_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  negative_prompt TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_prompts_shot_id ON video_prompts(shot_id);
CREATE INDEX IF NOT EXISTS idx_video_prompts_scene_id ON video_prompts(scene_id);
CREATE INDEX IF NOT EXISTS idx_video_prompts_project_id ON video_prompts(project_id);

-- ============================================================================
-- 2. DOMAIN SNAPSHOTS & DOMAIN PACKAGES (SEPARATED FROM PROJECTS TABLE)
-- ============================================================================

-- Research Packages (1:1 with Project)
CREATE TABLE IF NOT EXISTS project_research_packages (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  research_package JSONB,
  research_dossier JSONB,
  source_registry JSONB,
  context_package JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Narrative Blueprints (1:1 with Project)
CREATE TABLE IF NOT EXISTS project_narrative_blueprints (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  narrative_blueprint JSONB,
  full_story JSONB,
  narrative_style_config JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Production Plans & Quota Profiles (1:1 with Project)
CREATE TABLE IF NOT EXISTS project_production_plans (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  generation_plan JSONB,
  quota_profiles JSONB,
  ai_call_budget JSONB,
  production_readiness JSONB,
  finalization_report JSONB,
  asset_integrity_reports JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Graphs & Integrity (1:1 with Project)
CREATE TABLE IF NOT EXISTS project_asset_graphs (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  asset_graph JSONB,
  validation_result JSONB,
  consistency_reports JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Story Architectures (1:1 with Project)
CREATE TABLE IF NOT EXISTS story_architectures (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  cold_open JSONB,
  acts JSONB NOT NULL DEFAULT '[]'::jsonb,
  sequences JSONB NOT NULL DEFAULT '[]'::jsonb,
  beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Continuity States (1:1 with Project)
CREATE TABLE IF NOT EXISTS continuity_states (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  states JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Continuity Snapshots (1:N per Scene)
CREATE TABLE IF NOT EXISTS continuity_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_continuity_snapshots_proj_scene ON continuity_snapshots(project_id, scene_number);

-- ============================================================================
-- 3. EPHEMERAL & TELEMETRY TABLES
-- ============================================================================

-- Pipeline Logs
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  stage_code TEXT,
  scope TEXT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  duration_ms INTEGER,
  error_type TEXT,
  run_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_project_time ON pipeline_logs(project_id, timestamp ASC);

-- Stage Telemetry
CREATE TABLE IF NOT EXISTS stage_telemetry (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id TEXT,
  scene_id TEXT,
  shot_id TEXT,
  stage INTEGER,
  stage_code TEXT,
  scope TEXT,
  attempt INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT,
  error_type TEXT,
  error_message TEXT,
  summary_type TEXT,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_telemetry_project_started ON stage_telemetry(project_id, started_at ASC);

-- ============================================================================
-- 4. AI INFRASTRUCTURE DOMAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  capabilities JSONB NOT NULL DEFAULT '{"text": true, "vision": false, "image": false, "video": false}'::jsonb,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS ai_credentials (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  google_metadata JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 1,
  weight INTEGER NOT NULL DEFAULT 100,
  last_used_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT NOT NULL,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'flash',
  capabilities JSONB NOT NULL DEFAULT '["text"]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  context_window INTEGER,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (provider_id, id)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  credential_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  request_type TEXT,
  stage TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_type TEXT,
  timestamp BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_timestamp ON ai_usage(timestamp DESC);

CREATE TABLE IF NOT EXISTS ai_health (
  credential_id TEXT PRIMARY KEY REFERENCES ai_credentials(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'healthy',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC NOT NULL DEFAULT 1.0,
  cooldown_until BIGINT,
  last_error TEXT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS ai_routing_policies (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  preferred_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  fallback_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategy TEXT NOT NULL DEFAULT 'priority',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) SETUP
-- ============================================================================
-- Security posture: Default-deny on anon/authenticated public API roles.
-- Server operations execute via service_role key, bypassing RLS safely.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I;', t);
    EXECUTE format('CREATE POLICY service_role_all ON %I FOR ALL USING (auth.role() = %L);', t, 'service_role');
  END LOOP;
END $$;

-- ============================================================================
-- 6. RPC TRANSACTION FUNCTIONS (ATOMIC REPLACEMENTS)
-- ============================================================================

CREATE OR REPLACE FUNCTION replace_scenes(p_project_id TEXT, p_scenes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  elem JSONB;
BEGIN
  DELETE FROM scenes WHERE project_id = p_project_id;

  IF p_scenes IS NOT NULL AND jsonb_array_length(p_scenes) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_scenes) LOOP
      INSERT INTO scenes (
        id, project_id, scene_number, title, duration_sec, story_purpose,
        location_name, time_of_day, character_names, emotional_objective,
        event, narrative_function, sequence_id, act_id, continuity_scope,
        conflict, beginning_state, ending_state, beats, narrative_modes,
        scene_tone, master_frame_image_url, master_image_prompt,
        master_image_prompt_json, image_gen_status, image_gen_error,
        full_scene_prompt, full_scene_prompt_status, continuity_status,
        continuity_violations, pipeline_status, blockers, status, version,
        visual_anchor, anchor_ref, timeline, character_refs, object_refs,
        location_ref, costume_ref, master_camera, master_composition,
        created_at, updated_at
      ) VALUES (
        elem->>'id',
        p_project_id,
        COALESCE((elem->>'scene_number')::INTEGER, 1),
        COALESCE(elem->>'title', ''),
        COALESCE((elem->>'duration_sec')::INTEGER, 5),
        COALESCE(elem->>'story_purpose', ''),
        COALESCE(elem->>'location_name', ''),
        COALESCE(elem->>'time_of_day', ''),
        COALESCE(elem->'character_names', '[]'::jsonb),
        COALESCE(elem->>'emotional_objective', ''),
        COALESCE(elem->>'event', ''),
        COALESCE(elem->>'narrative_function', ''),
        elem->>'sequence_id',
        elem->>'act_id',
        elem->'continuity_scope',
        elem->>'conflict',
        elem->>'beginning_state',
        elem->>'ending_state',
        COALESCE(elem->'beats', '[]'::jsonb),
        COALESCE(elem->'narrative_modes', '[]'::jsonb),
        elem->'scene_tone',
        elem->>'master_frame_image_url',
        elem->>'master_image_prompt',
        elem->'master_image_prompt_json',
        COALESCE(elem->>'image_gen_status', 'pending'),
        elem->>'image_gen_error',
        elem->>'full_scene_prompt',
        elem->>'full_scene_prompt_status',
        COALESCE(elem->>'continuity_status', 'pending'),
        COALESCE(elem->'continuity_violations', '[]'::jsonb),
        COALESCE(elem->>'pipeline_status', 'READY'),
        COALESCE(elem->'blockers', '[]'::jsonb),
        COALESCE(elem->>'status', 'pending'),
        COALESCE((elem->>'version')::INTEGER, 1),
        elem->'visual_anchor',
        elem->>'anchor_ref',
        COALESCE(elem->'timeline', '[]'::jsonb),
        COALESCE(elem->'character_refs', '[]'::jsonb),
        COALESCE(elem->'object_refs', '[]'::jsonb),
        elem->>'location_ref',
        elem->>'costume_ref',
        elem->'master_camera',
        elem->'master_composition',
        COALESCE((elem->>'created_at')::TIMESTAMPTZ, NOW()),
        COALESCE((elem->>'updated_at')::TIMESTAMPTZ, NOW())
      );
    END LOOP;
  END IF;

  RETURN '{"status": "success"}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION replace_shots(p_scene_id TEXT, p_project_id TEXT, p_shots JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  elem JSONB;
BEGIN
  DELETE FROM shots WHERE scene_id = p_scene_id;

  IF p_shots IS NOT NULL AND jsonb_array_length(p_shots) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_shots) LOOP
      INSERT INTO shots (
        id, scene_id, project_id, shot_number, start_time_sec, end_time_sec,
        duration_sec, event_detail, character_action, camera_note, dialogue,
        emotion, audio_note, beat_id, beat_number, narrative_mode,
        cinematic_grammar, shot_image_url, image_url, visual_description,
        action, camera_movement, shot_type, audio_narration, sound_effects,
        master_image_prompt, video_prompt, seedance_prompt, asset_refs,
        character_refs, location_ref, costume_ref, object_refs,
        visual_anchor_ref, lock_state, camera, composition, prompt_versions,
        selected_platform, recommended_platform, fallback_platforms,
        generation_container_sec, generation_status, version, created_at, updated_at
      ) VALUES (
        elem->>'id',
        p_scene_id,
        p_project_id,
        COALESCE((elem->>'shot_number')::INTEGER, 1),
        COALESCE((elem->>'start_time_sec')::NUMERIC, 0),
        COALESCE((elem->>'end_time_sec')::NUMERIC, 5),
        COALESCE((elem->>'duration_sec')::NUMERIC, 5),
        COALESCE(elem->>'event_detail', ''),
        COALESCE(elem->>'character_action', ''),
        COALESCE(elem->>'camera_note', ''),
        COALESCE(elem->'dialogue', '[]'::jsonb),
        COALESCE(elem->>'emotion', ''),
        COALESCE(elem->>'audio_note', ''),
        elem->>'beat_id',
        (elem->>'beat_number')::INTEGER,
        elem->>'narrative_mode',
        elem->'cinematic_grammar',
        elem->>'shot_image_url',
        elem->>'image_url',
        elem->>'visual_description',
        elem->>'action',
        elem->>'camera_movement',
        elem->>'shot_type',
        elem->>'audio_narration',
        elem->>'sound_effects',
        elem->>'master_image_prompt',
        elem->>'video_prompt',
        elem->>'seedance_prompt',
        COALESCE(elem->'asset_refs', '[]'::jsonb),
        COALESCE(elem->'character_refs', '[]'::jsonb),
        elem->>'location_ref',
        elem->>'costume_ref',
        COALESCE(elem->'object_refs', '[]'::jsonb),
        elem->>'visual_anchor_ref',
        elem->'lock_state',
        elem->'camera',
        elem->'composition',
        COALESCE(elem->'prompt_versions', '[]'::jsonb),
        elem->>'selected_platform',
        elem->>'recommended_platform',
        COALESCE(elem->'fallback_platforms', '[]'::jsonb),
        (elem->>'generation_container_sec')::INTEGER,
        COALESCE(elem->>'generation_status', 'not_started'),
        COALESCE((elem->>'version')::INTEGER, 1),
        COALESCE((elem->>'created_at')::TIMESTAMPTZ, NOW()),
        COALESCE((elem->>'updated_at')::TIMESTAMPTZ, NOW())
      );
    END LOOP;
  END IF;

  RETURN '{"status": "success"}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION replace_video_prompts(p_shot_id TEXT, p_scene_id TEXT, p_project_id TEXT, p_prompts JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  elem JSONB;
BEGIN
  DELETE FROM video_prompts WHERE shot_id = p_shot_id;

  IF p_prompts IS NOT NULL AND jsonb_array_length(p_prompts) > 0 THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_prompts) LOOP
      INSERT INTO video_prompts (
        id, shot_id, scene_id, project_id, target_platform, prompt_text,
        negative_prompt, camera_parameters, seed, duration_seconds,
        aspect_ratio, motion_bucket_id, fps, cfg_scale, version, created_at, updated_at
      ) VALUES (
        elem->>'id',
        p_shot_id,
        p_scene_id,
        p_project_id,
        elem->>'target_platform',
        elem->>'prompt_text',
        elem->>'negative_prompt',
        elem->'camera_parameters',
        (elem->>'seed')::BIGINT,
        (elem->>'duration_seconds')::NUMERIC,
        elem->>'aspect_ratio',
        (elem->>'motion_bucket_id')::INTEGER,
        (elem->>'fps')::INTEGER,
        (elem->>'cfg_scale')::NUMERIC,
        COALESCE((elem->>'version')::INTEGER, 1),
        COALESCE((elem->>'created_at')::TIMESTAMPTZ, NOW()),
        COALESCE((elem->>'updated_at')::TIMESTAMPTZ, NOW())
      );
    END LOOP;
  END IF;

  RETURN '{"status": "success"}'::jsonb;
END;
$$;

-- ---------------------------------------------------------------------------
-- Safe Incremental Schema Migration Block
-- Adds any newly introduced columns to existing tables without breaking data
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Characters
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS importance TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS role TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS costume TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS wardrobe TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS master_portrait_prompt TEXT;

  -- Locations
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS environment_type TEXT;
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS lighting_vibe TEXT;
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS spatial_details TEXT;
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS architectural_style TEXT;
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS lighting_atmosphere TEXT;

  -- Scenes
  ALTER TABLE scenes ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE scenes ADD COLUMN IF NOT EXISTS continuity_snapshot JSONB;

  -- Shots
  ALTER TABLE shots ADD COLUMN IF NOT EXISTS master_image_prompt TEXT;
  ALTER TABLE shots ADD COLUMN IF NOT EXISTS cinematic_grammar JSONB;
END $$;

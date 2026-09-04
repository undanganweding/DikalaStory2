-- Dynamic AI provider compatibility migration
-- Safe for existing Supabase production databases.
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS base_url TEXT;
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS protocol TEXT NOT NULL DEFAULT 'openai-compatible';
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS health_latency INTEGER;
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS health_last_checked_at BIGINT;
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS health_error TEXT;

UPDATE public.ai_providers
SET protocol = CASE
  WHEN type = 'gemini' THEN 'google-generative-ai'
  WHEN type = 'openai-compatible' THEN 'openai-compatible'
  ELSE COALESCE(protocol, 'openai-compatible')
END
WHERE protocol IS NULL OR protocol = '';

UPDATE public.ai_providers SET metadata = '{}'::jsonb WHERE metadata IS NULL;

-- Credential quota / usage columns
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS quota_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS quota_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS quota_remaining INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS quota_reset_at BIGINT;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS usage_total_requests INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS usage_total_tokens BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS usage_success_rate NUMERIC NOT NULL DEFAULT 100;
ALTER TABLE public.ai_credentials ADD COLUMN IF NOT EXISTS usage_avg_latency_ms NUMERIC NOT NULL DEFAULT 0;

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
  StageExecutionTelemetry,
  ProjectFullData,
  StoryArchitecture,
  CharacterContinuityState,
  ContinuitySnapshot,
  ApprovedCostumeTransition,
  AIProvider,
  AICredential,
  AIModel,
  AIUsage,
  AIHealth,
  AIRoutingPolicy,
} from '../src/types';
import { DEFAULT_NARRATIVE_STYLE_CONFIG } from './narrative_tone';
import { supabaseDb } from './db/supabase_db';
import { isSupabaseConfigured } from './db/supabase_client';

// ---------------------------------------------------------------------------
// Supabase-Only Database Initialization
// ---------------------------------------------------------------------------
console.log(`[DB INIT] SUPABASE_ENABLED=true database=supabase`);

// ---------------------------------------------------------------------------
// Ephemeral In-Memory API Key Cache (never written to disk or database)
// ---------------------------------------------------------------------------
const ephemeralApiKeys = new Map<string, string>();

/**
 * Strips all `undefined` values and any `api_key` properties from objects.
 * Kept for pure object sanitization and existing test compatibility.
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) {
    return undefined as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
    return cleaned as unknown as T;
  }

  if (
    typeof (value as any).toMillis === 'function' ||
    (typeof (value as any).latitude === 'number' && typeof (value as any).longitude === 'number') ||
    (typeof (value as any).path === 'string' && typeof (value as any).listCollections === 'function') ||
    typeof (value as any).isEqual === 'function' ||
    Object.prototype.toString.call(value) !== '[object Object]'
  ) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'api_key') {
      continue;
    }
    const sanitizedVal = sanitizeForFirestore(val);
    if (sanitizedVal !== undefined) {
      result[key] = sanitizedVal;
    }
  }
  return result as unknown as T;
}

export { ephemeralApiKeys, sanitizeProjectForStorage, attachEphemeralApiKey } from './db_helpers';

// ---------------------------------------------------------------------------
// Database Driver Export (Supabase Only)
// ---------------------------------------------------------------------------
export function getDatabaseDriver(): typeof supabaseDb {
  if (!isSupabaseConfigured()) {
    throw new Error('[SUPABASE FAIL-CLOSED] Missing Supabase configuration.');
  }
  return supabaseDb;
}

// Export supabaseDb as primary db
export const db = supabaseDb;

// Backward-compatible alias for existing test suites
export const firestoreDb = supabaseDb;

/** Backward compatibility stub: Firestore is deprecated in favor of Supabase */
export function isFirestoreConfigured(): boolean {
  return false;
}


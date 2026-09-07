import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiInstance: GoogleGenAI | null = null;

export function getGeminiAI(apiKeyOverride?: string | null): GoogleGenAI {
  if ((global as any).__USE_ARMO_MOCKS__) {
    return {
      models: {
        generateContent: async (args: any) => {
          return (global as any).__ARMO_MOCK_GENERATE__(args);
        }
      }
    } as any;
  }

  // Request-scoped credential resolution: an explicit per-request key (from reasoning_config.api_key)
  // takes precedence over the global server secret. This is intentionally NOT written to process.env,
  // so concurrent workers cannot bleed credentials into each other or leak into logs/telemetry.
  const apiKey = (apiKeyOverride && apiKeyOverride.trim().length > 0)
    ? apiKeyOverride.trim()
    : (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  // Only reuse the singleton when it was built from the same (global env) key.
  // When an explicit override is supplied, build a request-scoped client instead.
  if (apiKeyOverride && apiKeyOverride.trim().length > 0) {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export interface GeminiModelInfo {
  id: string;
  name: string;
  badge?: string;
  description: string;
  isRecommended?: boolean;
  tier: 'flash' | 'pro' | 'lite';
  capabilities: {
    text: boolean;
    image: boolean;
    video: boolean;
    audio: boolean;
    reasoning: boolean;
    realtime: boolean;
  };
}

export const AVAILABLE_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Cinematic Default',
    description: 'Production default model for cinematic reasoning, complex narratives, and character bibles.',
    isRecommended: true,
    tier: 'pro',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Cinematic Fast',
    description: 'High-speed cinematic fallback model with strong narrative continuity and structured framing.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Recommended',
    description: 'Generasi terbaru dengan kecepatan tinggi, batas kuota optimal & penalaran naskah sinematik.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    badge: 'Latest Flash',
    description: 'Alias resmi model Flash mutakhir Google AI Studio.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Adaptive',
    description: 'Generasi Flash dengan penalaran adaptif sinematik & kecepatan sangat tinggi.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Legacy Fast',
    description: 'Model pemrosesan cepat teks legacy.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Production',
    description: 'Frontier performance dengan kecepatan Flash.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Fast Lite',
    description: 'Ultra-fast lightweight model for fast comprehension and structuring tasks.',
    isRecommended: false,
    tier: 'lite',
    capabilities: { text: true, image: true, video: false, audio: false, reasoning: false, realtime: false },
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'Efficiency',
    description: 'Optimized for high-volume, low-cost automation.',
    isRecommended: false,
    tier: 'lite',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: false, realtime: false },
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Deep Reasoning',
    description: 'Ideal untuk narasi kompleks, struktur naskah berlapis & karakter mendalam.',
    isRecommended: false,
    tier: 'pro',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: false },
  },
  {
    id: 'gemini-3.1-flash-live',
    name: 'Gemini 3.1 Flash Live',
    badge: 'Live API',
    description: 'Low-latency real-time voice/video.',
    isRecommended: false,
    tier: 'flash',
    capabilities: { text: true, image: true, video: true, audio: true, reasoning: true, realtime: true },
  },
];

export function resolveGeminiModel(modelName?: string | null): string {
  if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
    return DEFAULT_GEMINI_MODEL;
  }
  let trimmed = modelName.trim();
  // Strip 'models/' prefix if user provided it
  if (trimmed.startsWith('models/')) {
    trimmed = trimmed.replace('models/', '');
  }
  // Auto-upgrade legacy / discontinued models
  if (trimmed === 'gemini-2.5-flash' || trimmed === 'gemini-2.0-flash' || trimmed === 'gemini-1.5-flash' || trimmed === 'gemini-3.6-flash') {
    return 'gemini-3.8-flash';
  }
  if (trimmed === 'gemini-2.5-pro' || trimmed === 'gemini-2.0-pro' || trimmed === 'gemini-1.5-pro') {
    return 'gemini-3.1-pro-preview';
  }
  return trimmed;
}

export const GEMINI_MODEL = DEFAULT_GEMINI_MODEL;

let cachedOmniResult: { result: boolean; expiresAt: number; key: string } | null = null;
const OMNI_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Capability check for Gemini Omni / Live features
 * Returns true if the active / managed API key has access to Omni models
 */
export async function checkGeminiOmniCapability(apiKeyOverride?: string | null): Promise<boolean> {
  const cacheKey = apiKeyOverride || 'default_active_key';
  const now = Date.now();
  if (cachedOmniResult && cachedOmniResult.key === cacheKey && cachedOmniResult.expiresAt > now) {
    return cachedOmniResult.result;
  }

  try {
    let resolvedKey = apiKeyOverride;
    if (!resolvedKey) {
      try {
        // Dynamically access credential manager if available to avoid circular dependencies
        const { credentialManager } = await import('./credential_manager');
        const candidates = credentialManager.getOrderedCandidateCredentials('google');
        if (candidates.length > 0 && candidates[0].rawKey) {
          resolvedKey = candidates[0].rawKey;
        }
      } catch {}
    }
    const ai = getGeminiAI(resolvedKey);
    // Test model info for omni models
    const response = await ai.models.get({
      model: 'gemini-omni-flash-preview',
    });
    const hasOmni = !!response?.name;
    cachedOmniResult = { result: hasOmni, expiresAt: now + OMNI_CACHE_TTL_MS, key: cacheKey };
    return hasOmni;
  } catch (err: any) {
    // If not accessible (404/403/permission denied), cache negative response for 3 minutes to avoid hammering
    cachedOmniResult = { result: false, expiresAt: now + 3 * 60 * 1000, key: cacheKey };
    return false;
  }
}

export { Type };
export type { Schema };



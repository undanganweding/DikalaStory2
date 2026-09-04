import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InMemSupabaseMock } from './supabase_mock';

let instance: SupabaseClient | null = null;
const globalMock = new InMemSupabaseMock();

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (url.includes('supabase.com/') && !url.includes('.supabase.co')) {
    const parts = url.split('supabase.com/');
    const ref = parts[1]?.replace(/\/$/, '').split('/')[0];
    if (ref) {
      return `https://${ref}.supabase.co`;
    }
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, '');
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!rawUrl || !serviceRoleKey) {
    return null;
  }

  const url = normalizeSupabaseUrl(rawUrl);

  return {
    url,
    serviceRoleKey: serviceRoleKey.trim(),
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function getSupabaseClient(): SupabaseClient {
  if (instance) {
    return instance;
  }

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      '[SUPABASE FAIL-CLOSED] Cannot initialize Supabase client: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  const isMock =
    process.env.MOCK_SUPABASE === 'true' ||
    config.url.includes('sandbox') ||
    config.url.includes('mock') ||
    config.url.includes('localhost');

  if (isMock) {
    instance = globalMock as unknown as SupabaseClient;
    return instance;
  }

  instance = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return instance;
}

export function resetSupabaseClientInstance(): void {
  instance = null;
  tableColumnsCache = null;
}

export function resetSupabaseMockData(): void {
  globalMock.reset();
}

let tableColumnsCache: Record<string, Set<string>> | null = null;
let lastCacheFetchTime = 0;

export async function fetchSupabaseSchemaColumns(forceRefresh = false): Promise<Record<string, Set<string>>> {
  const now = Date.now();
  if (!forceRefresh && tableColumnsCache && now - lastCacheFetchTime < 120000) {
    return tableColumnsCache;
  }

  const config = getSupabaseConfig();
  if (!config) return tableColumnsCache || {};

  try {
    const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/`;
    const resp = await fetch(endpoint, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    });
    if (resp.ok) {
      const spec: any = await resp.json();
      const definitions = spec.definitions || {};
      const newCache: Record<string, Set<string>> = {};
      for (const [tbl, def] of Object.entries<any>(definitions)) {
        if (def && def.properties) {
          newCache[tbl] = new Set(Object.keys(def.properties));
        }
      }
      tableColumnsCache = newCache;
      lastCacheFetchTime = now;
      return newCache;
    }
  } catch (err) {
    console.warn('[Supabase] Could not fetch schema columns cache from OpenAPI:', err);
  }
  return tableColumnsCache || {};
}

export function getCachedTableColumns(tableName: string): Set<string> | null {
  return tableColumnsCache ? tableColumnsCache[tableName] || null : null;
}


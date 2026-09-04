import { firestoreDb } from '../db';
import { supabaseDb } from './supabase_db';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  getSupabaseClient,
  resetSupabaseClientInstance,
  normalizeSupabaseUrl,
  fetchSupabaseSchemaColumns,
} from './supabase_client';

export async function testSupabaseConnection(customConfig?: {
  url?: string;
  serviceRoleKey?: string;
}): Promise<{ success: boolean; message: string; details?: any; schemaNeeded?: boolean }> {
  try {
    if (customConfig?.url) {
      process.env.SUPABASE_URL = normalizeSupabaseUrl(customConfig.url);
    }
    if (customConfig?.serviceRoleKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = customConfig.serviceRoleKey.trim();
    }
    resetSupabaseClientInstance();

    const config = getSupabaseConfig();
    if (!config || !config.url || !config.serviceRoleKey) {
      return {
        success: false,
        message: 'Supabase URL atau Service Role Key belum dikonfigurasi. Harap isi form URL dan Service Role Key terlebih dahulu.',
      };
    }

    if (config.url.includes('your-project.supabase.co')) {
      return {
        success: false,
        message: 'URL masih berupa placeholder default (your-project). Harap masukkan Project URL asli dari Supabase Dashboard (contoh: https://vgkfmuwzczldnvozksdx.supabase.co).',
      };
    }

    // 1. First test raw REST endpoint to get clear HTTP diagnostic
    const restEndpoint = `${config.url.replace(/\/$/, '')}/rest/v1/`;
    let restStatus = 0;
    try {
      const resp = await fetch(restEndpoint, {
        method: 'GET',
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
      });
      restStatus = resp.status;
      if (resp.status === 401) {
        return {
          success: false,
          message:
            'Koneksi ke server Supabase berhasil, namun API Key ditolak (401 Unauthorized). Pastikan Anda menggunakan "service_role" secret key dari Supabase Dashboard > Project Settings > API.',
          details: { status: 401, statusText: resp.statusText },
        };
      }
    } catch (fetchErr: any) {
      const cause = fetchErr.cause;
      const code = cause?.code || '';
      if (code === 'ENOTFOUND') {
        return {
          success: false,
          message: `Domain '${config.url}' tidak dapat diakses (ENOTFOUND). Pastikan Project URL valid dan project Supabase Anda aktif (tidak paused).`,
          details: { code, error: fetchErr.message },
        };
      }
      return {
        success: false,
        message: `Gagal menghubungi host Supabase (${fetchErr.message}). Periksa kembali format Project URL.`,
        details: { code, error: fetchErr.message },
      };
    }

    // 2. Test PostgreSQL client query
    const client = getSupabaseClient();
    const { data, error } = await client.from('projects').select('id, title').limit(1);
    if (error) {
      // Check if table projects doesn't exist yet
      if (
        error.code === '42P01' ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST205' ||
        error.message.toLowerCase().includes('relation "public.projects" does not exist') ||
        error.message.toLowerCase().includes('could not find the')
      ) {
        return {
          success: true,
          schemaNeeded: true,
          message:
            'Koneksi Supabase & API Key BERHASIL TERVERIFIKASI! Namun tabel database belum dibuat. Silakan salin "Schema SQL" dan jalankan di SQL Editor Supabase untuk memulai sinkronisasi.',
          details: { note: 'Schema migration needed', error },
        };
      }
      return { success: false, message: `Koneksi Supabase gagal: ${error.message}`, details: error };
    }

    return {
      success: true,
      message: 'Koneksi ke Supabase PostgreSQL berhasil terhubung dan tabel siap digunakan!',
      details: { sampleCount: data?.length || 0, restStatus },
    };
  } catch (err: any) {
    return { success: false, message: `Gagal menguji koneksi Supabase: ${err.message}`, details: err };
  }
}

export async function syncLocalDataToSupabase(customConfig?: {
  url?: string;
  serviceRoleKey?: string;
}): Promise<{ success: boolean; message: string; syncedCounts: Record<string, number> }> {
  try {
    if (customConfig?.url) {
      process.env.SUPABASE_URL = normalizeSupabaseUrl(customConfig.url);
    }
    if (customConfig?.serviceRoleKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = customConfig.serviceRoleKey.trim();
    }
    resetSupabaseClientInstance();

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase belum dikonfigurasi. Masukkan URL dan Service Role Key terlebih dahulu.');
    }

    const testRes = await testSupabaseConnection();
    if (!testRes.success) {
      throw new Error(testRes.message);
    }

    // Refresh live schema cache from Supabase OpenAPI
    await fetchSupabaseSchemaColumns(true);

    const syncedCounts: Record<string, number> = {
      projects: 0,
      characters: 0,
      locations: 0,
      objects: 0,
      scenes: 0,
      shots: 0,
      video_prompts: 0,
      ai_providers: 0,
      ai_credentials: 0,
      ai_models: 0,
    };

    const projects = await firestoreDb.listProjects();
    for (const proj of projects) {
      await supabaseDb.saveProject(proj);
      syncedCounts.projects++;

      const full = await firestoreDb.getFullProjectData(proj.id);
      if (full) {
        if (full.foundation) {
          await supabaseDb.saveProjectFoundation(full.foundation);
        }
        if (full.characters && full.characters.length > 0) {
          await supabaseDb.saveAndMergeCharacters(proj.id, full.characters);
          syncedCounts.characters += full.characters.length;
        }
        if (full.locations && full.locations.length > 0) {
          await supabaseDb.saveAndMergeLocations(proj.id, full.locations);
          syncedCounts.locations += full.locations.length;
        }
        if (full.objects && full.objects.length > 0) {
          await supabaseDb.saveAndMergeObjects(proj.id, full.objects);
          syncedCounts.objects += full.objects.length;
        }
        if (full.scenes && full.scenes.length > 0) {
          await supabaseDb.saveScenes(proj.id, full.scenes);
          syncedCounts.scenes += full.scenes.length;
        }
        if (full.shots) {
          const shotsList: any[] = Array.isArray(full.shots) ? full.shots : Object.values(full.shots).flat();
          if (shotsList.length > 0) {
            const shotsByScene: Record<string, any[]> = {};
            for (const shot of shotsList) {
              const scId = shot.scene_id || 'scene_1';
              if (!shotsByScene[scId]) shotsByScene[scId] = [];
              shotsByScene[scId].push(shot);
            }
            for (const [scId, sceneShots] of Object.entries(shotsByScene)) {
              await supabaseDb.saveShots(scId, proj.id, sceneShots);
            }
            syncedCounts.shots += shotsList.length;
          }
        }
        if (full.video_prompts) {
          const vpList: any[] = Array.isArray(full.video_prompts) ? full.video_prompts : Object.values(full.video_prompts).flat();
          if (vpList.length > 0) {
            const vpByShot: Record<string, { sceneId: string; prompts: any[] }> = {};
            for (const vp of vpList) {
              const stId = vp.shot_id || 'shot_1';
              const scId = vp.scene_id || 'scene_1';
              if (!vpByShot[stId]) vpByShot[stId] = { sceneId: scId, prompts: [] };
              vpByShot[stId].prompts.push(vp);
            }
            for (const [stId, { sceneId, prompts }] of Object.entries(vpByShot)) {
              await supabaseDb.saveVideoPrompts(stId, sceneId, proj.id, prompts);
            }
            syncedCounts.video_prompts += vpList.length;
          }
        }
      }
    }

    try {
      const providers = await firestoreDb.getProviders();
      for (const prov of providers) {
        await supabaseDb.saveProvider(prov);
        syncedCounts.ai_providers++;
      }
      const creds = await firestoreDb.getCredentials();
      for (const cred of creds) {
        await supabaseDb.saveCredential(cred);
        syncedCounts.ai_credentials++;
      }
      const models = await firestoreDb.getModels();
      for (const model of models) {
        await supabaseDb.saveModel(model);
        syncedCounts.ai_models++;
      }
    } catch (e) {
      console.warn('Warning syncing AI catalog tables:', e);
    }

    return {
      success: true,
      message: `Berhasil menyinkronkan data lokal ke Supabase PostgreSQL (${syncedCounts.projects} proyek, ${syncedCounts.scenes} adegan, ${syncedCounts.shots} shot).`,
      syncedCounts,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Sinkronisasi gagal: ${err.message}`,
      syncedCounts: {},
    };
  }
}

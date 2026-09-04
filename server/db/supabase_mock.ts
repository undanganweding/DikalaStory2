import { SupabaseClient } from '@supabase/supabase-js';

export class InMemSupabaseMock {
  private tables: Map<string, any[]> = new Map();

  constructor() {
    this.reset();
  }

  public reset() {
    this.tables.clear();
  }

  public getTable(name: string): any[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }

  public from(tableName: string) {
    const table = this.getTable(tableName);
    let rows = [...table];
    let isSingle = false;
    let isMaybeSingle = false;
    let isDelete = false;
    let isUpdate = false;
    let updateData: any = null;
    let isInsert = false;
    let isUpsert = false;
    let payloadRows: any[] = [];
    let filters: Array<(row: any) => boolean> = [];
    let sortFn: ((a: any, b: any) => number) | null = null;
    let limitVal: number | null = null;

    const builder: any = {
      select: (_fields?: string) => {
        return builder;
      },
      eq: (col: string, val: any) => {
        filters.push((row) => row[col] === val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        const set = new Set(vals);
        filters.push((row) => set.has(row[col]));
        return builder;
      },
      gte: (col: string, val: any) => {
        filters.push((row) => row[col] >= val);
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending !== false;
        sortFn = (a, b) => {
          if (a[col] < b[col]) return asc ? -1 : 1;
          if (a[col] > b[col]) return asc ? 1 : -1;
          return 0;
        };
        return builder;
      },
      limit: (n: number) => {
        limitVal = n;
        return builder;
      },
      single: () => {
        isSingle = true;
        return builder;
      },
      maybeSingle: () => {
        isMaybeSingle = true;
        return builder;
      },
      insert: (items: any | any[]) => {
        isInsert = true;
        payloadRows = Array.isArray(items) ? items : [items];
        return builder;
      },
      upsert: (items: any | any[]) => {
        isUpsert = true;
        payloadRows = Array.isArray(items) ? items : [items];
        return builder;
      },
      update: (data: any) => {
        isUpdate = true;
        updateData = data;
        return builder;
      },
      delete: () => {
        isDelete = true;
        return builder;
      },
      then: (resolve: any, reject: any) => {
        try {
          // Perform inserts / upserts
          if (isInsert || isUpsert) {
            for (const item of payloadRows) {
              let getPk: (r: any) => string;
              if (tableName === 'ai_models') {
                getPk = (r) => `${r.provider_id || r.providerId || 'google'}::${r.id}`;
              } else if (tableName === 'project_foundations') {
                getPk = (r) => `${r.project_id || r.id}`;
              } else if (tableName === 'story_architectures' || tableName === 'continuity_states') {
                getPk = (r) => `${r.project_id || r.id}`;
              } else if (tableName === 'ai_health') {
                getPk = (r) => `${r.credential_id || r.credentialId}`;
              } else {
                getPk = (r) => `${r.id || r.project_id || r.credential_id || r.credentialId}`;
              }

              const itemPk = getPk(item);
              const existingIdx = table.findIndex((r) => getPk(r) === itemPk);

              if (existingIdx >= 0) {
                if (isUpsert) {
                  table[existingIdx] = { ...table[existingIdx], ...item };
                }
              } else {
                table.push({ ...item });
              }
            }
            return resolve({ data: payloadRows, error: null });
          }

          // Apply filters
          let result = table.filter((row) => filters.every((fn) => fn(row)));

          // Perform Delete
          if (isDelete) {
            const matchingIds = new Set(result.map((r) => r.id || r.project_id || r.credential_id));
            const newTable = table.filter((row) => !filters.every((fn) => fn(row)));
            this.tables.set(tableName, newTable);

            // Handle Foreign Key CASCADE on projects deletion
            if (tableName === 'projects') {
              for (const projId of matchingIds) {
                const dependentTables = [
                  'project_foundations',
                  'characters',
                  'locations',
                  'objects',
                  'scenes',
                  'shots',
                  'video_prompts',
                  'project_research_packages',
                  'project_narrative_blueprints',
                  'project_production_plans',
                  'project_asset_graphs',
                  'story_architectures',
                  'continuity_states',
                  'continuity_snapshots',
                  'pipeline_logs',
                  'stage_telemetry',
                ];
                for (const depTable of dependentTables) {
                  const depList = this.getTable(depTable);
                  this.tables.set(
                    depTable,
                    depList.filter((r) => r.project_id !== projId)
                  );
                }
              }
            }

            // Handle Foreign Key CASCADE on ai_providers deletion
            if (tableName === 'ai_providers') {
              for (const provId of matchingIds) {
                const creds = this.getTable('ai_credentials');
                this.tables.set('ai_credentials', creds.filter((r) => r.provider_id !== provId));
                const models = this.getTable('ai_models');
                this.tables.set('ai_models', models.filter((r) => r.provider_id !== provId));
              }
            }

            // Handle Foreign Key CASCADE on ai_credentials deletion
            if (tableName === 'ai_credentials') {
              for (const credId of matchingIds) {
                const health = this.getTable('ai_health');
                this.tables.set('ai_health', health.filter((r) => r.credential_id !== credId));
              }
            }
            return resolve({ data: result, error: null });
          }

          // Perform Update
          if (isUpdate) {
            for (const row of result) {
              Object.assign(row, updateData);
            }
            return resolve({ data: result, error: null });
          }

          // Perform Select / Query
          if (sortFn) {
            result.sort(sortFn);
          }
          if (limitVal !== null) {
            result = result.slice(0, limitVal);
          }

          if (isSingle) {
            if (result.length === 0) {
              return resolve({ data: null, error: { message: 'Row not found', code: 'PGRST116' } });
            }
            return resolve({ data: result[0], error: null });
          }

          if (isMaybeSingle) {
            return resolve({ data: result.length > 0 ? result[0] : null, error: null });
          }

          return resolve({ data: result, error: null });
        } catch (err: any) {
          return resolve({ data: null, error: { message: err.message } });
        }
      },
    };

    return builder;
  }

  public rpc(fnName: string, args: any) {
    return {
      then: (resolve: any) => {
        if (fnName === 'replace_scenes') {
          const { p_project_id, p_scenes } = args || {};
          for (const sc of p_scenes || []) {
            if (sc.scene_number === undefined || sc.scene_number === null || typeof sc.scene_number !== 'number' || isNaN(sc.scene_number)) {
              return resolve({ data: null, error: { message: 'invalid input syntax for type integer: scene_number' } });
            }
          }
          const table = this.getTable('scenes');
          this.tables.set('scenes', table.filter((r) => r.project_id !== p_project_id));
          const newTable = this.getTable('scenes');
          for (const sc of p_scenes || []) {
            newTable.push({ ...sc, project_id: p_project_id });
          }
          return resolve({ data: null, error: null });
        }

        if (fnName === 'replace_shots') {
          const { p_scene_id, p_project_id, p_shots } = args || {};
          for (const sh of p_shots || []) {
            if (sh.shot_number === undefined || sh.shot_number === null || typeof sh.shot_number !== 'number' || isNaN(sh.shot_number)) {
              return resolve({ data: null, error: { message: 'invalid input syntax for type integer: shot_number' } });
            }
          }
          const table = this.getTable('shots');
          this.tables.set('shots', table.filter((r) => r.scene_id !== p_scene_id));
          const newTable = this.getTable('shots');
          for (const sh of p_shots || []) {
            newTable.push({ ...sh, scene_id: p_scene_id, project_id: p_project_id });
          }
          return resolve({ data: null, error: null });
        }

        if (fnName === 'replace_video_prompts') {
          const { p_shot_id, p_scene_id, p_project_id, p_prompts } = args || {};
          for (const vp of p_prompts || []) {
            if (vp.seed !== undefined && vp.seed !== null && typeof vp.seed !== 'number' && typeof vp.seed !== 'bigint' && isNaN(Number(vp.seed))) {
              return resolve({ data: null, error: { message: 'invalid input syntax for type bigint: seed' } });
            }
          }
          const table = this.getTable('video_prompts');
          this.tables.set('video_prompts', table.filter((r) => r.shot_id !== p_shot_id));
          const newTable = this.getTable('video_prompts');
          for (const vp of p_prompts || []) {
            newTable.push({ ...vp, shot_id: p_shot_id, scene_id: p_scene_id, project_id: p_project_id });
          }
          return resolve({ data: null, error: null });
        }

        return resolve({ data: null, error: { message: `Unknown RPC function ${fnName}` } });
      },
    };
  }
}

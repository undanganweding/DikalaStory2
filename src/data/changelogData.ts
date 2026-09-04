export interface ReleaseChange {
  type: 'feat' | 'fix' | 'infra' | 'perf';
  description: string;
}

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  badge?: string;
  changes: ReleaseChange[];
}

export const APP_CURRENT_VERSION = 'v1.4.2';

export const CHANGELOG_DATA: ReleaseNote[] = [
  {
    version: 'v1.4.2',
    date: '2026-09-04',
    title: 'Compact Dashboard & Engine Health Optimization',
    badge: 'Latest',
    changes: [
      { type: 'perf', description: 'Optimalisasi tampilan dashboard menjadi lebih ringkas, padat, dan efisien.' },
      { type: 'feat', description: 'Integrasi status model AI riil & telemetri orkestrasi fungsional.' },
      { type: 'fix', description: 'Pembersihan elemen metrik non-fungsional dan peningkatan kehandalan sistem.' }
    ]
  },
  {
    version: 'v1.4.0',
    date: '2026-09-02',
    title: 'Vercel Serverless & Git Sync Optimization',
    changes: [
      { type: 'feat', description: 'System Version History & Release Notes terintegrasi.' },
      { type: 'infra', description: 'Vercel Ephemeral Storage Fallback ke /tmp/data/ saat serverless.' },
      { type: 'fix', description: 'Safe JSON Exception Handling pada pemrosesan stream response.' }
    ]
  },
  {
    version: 'v1.3.0',
    date: '2026-09-01',
    title: 'Stop & Resume Engine & ARMO Failover',
    changes: [
      { type: 'feat', description: 'Granular Pause/Resume Controller untuk pipeline sinematik.' },
      { type: 'feat', description: 'Multi-API Key & Multi-Project Router (ARMO).' }
    ]
  },
  {
    version: 'v1.2.0',
    date: '2026-08-30',
    title: 'Full Cinematic Pipeline (Phase 1 to 8)',
    changes: [
      { type: 'feat', description: 'Story Architecture, Scene Breakdown, Cinematic Shot Generation S1-S8.' }
    ]
  }
];

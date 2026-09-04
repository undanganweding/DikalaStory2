import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Play,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  FileCode,
  Info,
} from 'lucide-react';

export const SupabaseSyncManager: React.FC = () => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copyingSchema, setCopyingSchema] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    schemaNeeded?: boolean;
    details?: any;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    syncedCounts?: Record<string, number>;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  // Auto-normalize supabase.com/ref URL on the fly in the input
  const handleUrlChange = (val: string) => {
    let clean = val.trim();
    if (clean.includes('supabase.com/') && !clean.includes('.supabase.co')) {
      const parts = clean.split('supabase.com/');
      const ref = parts[1]?.replace(/\/$/, '').split('/')[0];
      if (ref) {
        clean = `https://${ref}.supabase.co`;
      }
    }
    setSupabaseUrl(clean);
  };

  const extractProjectRef = (url: string) => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.split('.')[0] || '';
    } catch {
      return '';
    }
  };

  const projectRef = extractProjectRef(supabaseUrl);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      setConfigured(data.configured);
      setEnabled(data.enabled);
      if (data.url && !data.url.includes('your-project')) {
        setSupabaseUrl(data.url);
      }
    } catch (err) {
      console.error('Error fetching Supabase status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supabaseUrl, serviceRoleKey, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigured(data.configured);
        setEnabled(data.enabled);
        setMessage('Konfigurasi Supabase berhasil disimpan.');
      } else {
        setMessage('Gagal menyimpan konfigurasi.');
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setMessage(null);
      const res = await fetch('/api/supabase/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supabaseUrl, serviceRoleKey }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setConfigured(true);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: `Koneksi gagal: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncDatabase = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      setMessage(null);
      const res = await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supabaseUrl, serviceRoleKey }),
      });
      const data = await res.json();
      setSyncResult(data);
    } catch (err: any) {
      setSyncResult({ success: false, message: `Sinkronisasi gagal: ${err.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySchemaSql = async () => {
    try {
      setCopyingSchema(true);
      const res = await fetch('/api/supabase/schema');
      const data = await res.json();
      if (data.success && data.sql) {
        await navigator.clipboard.writeText(data.sql);
        setSchemaCopied(true);
        setTimeout(() => setSchemaCopied(false), 3000);
      } else {
        alert('Gagal mengambil skema SQL: ' + (data.message || 'Error'));
      }
    } catch (err: any) {
      alert('Gagal menyalin skema: ' + err.message);
    } finally {
      setCopyingSchema(false);
    }
  };

  const sqlEditorUrl = projectRef && projectRef !== 'your-project'
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  return (
    <div className="space-y-6 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Koneksi & Sinkronisasi Database Supabase</h3>
            <p className="text-xs text-zinc-400">Hubungkan SINEMA ke Supabase PostgreSQL untuk penyimpanan produksi awan terpusat.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
            enabled && configured ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${enabled && configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {enabled && configured ? 'Aktif (Supabase)' : 'Mode Lokal / Non-Aktif'}
          </span>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Panduan Langkah Cepat */}
      <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs space-y-2 text-zinc-400">
        <div className="flex items-center gap-2 text-zinc-200 font-medium text-xs">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <span>Petunjuk Integrasi Supabase:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px]">
          <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
            <p className="font-semibold text-zinc-200 mb-0.5">1. URL Proyek</p>
            <p className="text-zinc-400">Format: <code className="text-emerald-400 font-mono">https://[ref].supabase.co</code></p>
          </div>
          <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
            <p className="font-semibold text-zinc-200 mb-0.5">2. Service Role Key</p>
            <p className="text-zinc-400">Gunakan secret <code className="text-amber-400 font-mono">service_role</code> dari Settings &gt; API</p>
          </div>
          <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
            <p className="font-semibold text-zinc-200 mb-0.5">3. Jalankan Skema</p>
            <p className="text-zinc-400">Salin skema SQL lalu jalankan di Supabase SQL Editor</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Supabase Project URL</label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://vgkfmuwzczldnvozksdx.supabase.co"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-zinc-400 mt-1">
              Contoh: <code className="text-emerald-400 font-mono">https://vgkfmuwzczldnvozksdx.supabase.co</code>
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-300">Supabase Service Role Key (Secret)</label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showKey ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            <input
              type={showKey ? 'text' : 'password'}
              value={serviceRoleKey}
              onChange={(e) => setServiceRoleKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-zinc-400 mt-1">
              Ambil dari Supabase Dashboard &gt; <b>Project Settings</b> &gt; <b>API</b> &gt; <b>service_role</b> secret.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between pt-2 gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
            />
            <span className="text-xs font-medium text-zinc-200">
              Aktifkan Supabase Driver (Gunakan Supabase sebagai database utama)
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
            Simpan Konfigurasi
          </button>
        </div>
      </form>

      <div className="border-t border-zinc-800 pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 border border-zinc-700 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            Test Koneksi Database
          </button>

          <button
            type="button"
            onClick={handleSyncDatabase}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-950/40 disabled:opacity-50"
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Sync Data Lokal ke Supabase
          </button>

          <button
            type="button"
            onClick={handleCopySchemaSql}
            disabled={copyingSchema}
            className="px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1.5 border border-zinc-700/80"
            title="Salin seluruh skema tabel SQL untuk Supabase"
          >
            {schemaCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Schema SQL Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Salin Schema SQL</span>
              </>
            )}
          </button>

          {projectRef && (
            <a
              href={sqlEditorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="px-3.5 py-2 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 border border-zinc-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka SQL Editor Supabase</span>
            </a>
          )}
        </div>

        <span className="text-[11px] text-zinc-500">
          Mendukung tabel relational lengkap (projects, scenes, shots, characters).
        </span>
      </div>

      {testResult && (
        <div className={`p-4 rounded-xl border text-xs flex flex-col gap-2.5 ${
          testResult.success
            ? testResult.schemaNeeded
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-start gap-2.5">
            {testResult.success ? (
              testResult.schemaNeeded ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {testResult.success
                  ? testResult.schemaNeeded
                    ? 'Koneksi Berhasil (Tabel Belum Dibuat)'
                    : 'Koneksi Berhasil & Database Siap'
                  : 'Koneksi Gagal'}
              </p>
              <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
            </div>
          </div>

          {testResult.schemaNeeded && (
            <div className="mt-2 pt-2.5 border-t border-amber-500/20 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopySchemaSql}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-amber-500/30"
              >
                {schemaCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode className="w-3.5 h-3.5" />}
                {schemaCopied ? 'Schema SQL Berhasil Disalin!' : 'Klik untuk Salin Schema SQL'}
              </button>
              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-amber-300 hover:text-amber-200 underline flex items-center gap-1"
              >
                Buka SQL Editor di Supabase Dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {syncResult && (
        <div className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 ${
          syncResult.success ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {syncResult.success ? <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
            <span className="font-semibold">{syncResult.success ? 'Sinkronisasi Berhasil' : 'Sinkronisasi Gagal'}</span>
          </div>
          <p>{syncResult.message}</p>
          {syncResult.syncedCounts && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-indigo-500/20 text-[11px]">
              {Object.entries(syncResult.syncedCounts).map(([k, v]) => (
                <div key={k} className="bg-zinc-950/50 p-1.5 rounded border border-indigo-500/20 flex justify-between">
                  <span className="text-zinc-400 capitalize">{k.replace('_', ' ')}:</span>
                  <span className="font-mono font-bold text-zinc-100">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

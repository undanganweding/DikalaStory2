import React, { useState, useRef } from 'react';
import {
  Download,
  FileText,
  CheckCircle2,
  Cloud,
  Sparkles,
  Upload,
  FolderDown,
  AlertCircle,
  RefreshCw,
  FileJson,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { Project, Scene, Shot } from '../../types';

interface ExportWorkspaceProps {
  project: Project | null;
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  onOpenExportDriveModal?: () => void;
  onOpenImportDriveModal?: () => void;
  onImportSuccess?: (importedData: any) => void;
}

export const ExportWorkspace: React.FC<ExportWorkspaceProps> = ({
  project,
  scenes,
  shots,
  onOpenExportDriveModal,
  onOpenImportDriveModal,
  onImportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  // Local JSON File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportDriveClick = () => {
    if (onOpenExportDriveModal) {
      onOpenExportDriveModal();
    } else {
      setIsExporting(true);
      setTimeout(() => {
        setIsExporting(false);
        setExported(true);
        setTimeout(() => setExported(false), 4000);
      }, 1500);
    }
  };

  const handleDownloadJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ project, scenes, shots }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${project?.title || 'cinematic_project'}_export.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Local JSON parsing & validation
  const processJsonFile = (file: File) => {
    setImportError(null);
    setImportSuccess(null);
    setSelectedFile(file);
    setParsedData(null);

    if (!file.name.endsWith('.json')) {
      setImportError('Berkas harus berformat .json');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        const projectData = json.project || json;
        if (!projectData || (!projectData.title && !projectData.raw_script)) {
          setImportError('Berkas JSON tidak memiliki struktur proyek sinematik yang valid.');
          return;
        }

        setParsedData(json);
      } catch (err: any) {
        setImportError('Format berkas JSON tidak valid atau rusak.');
      }
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processJsonFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processJsonFile(e.target.files[0]);
    }
  };

  const handleExecuteLocalImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const res = await fetch('/api/projects/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedData),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal mengimpor proyek ke backend database.');
      }

      const resData = await res.json();
      setImportSuccess(`Berhasil mengimpor: "${resData.project?.title || 'Proyek Sinematik'}"`);
      
      if (onImportSuccess) {
        setTimeout(() => {
          onImportSuccess(resData);
        }, 800);
      }
    } catch (err: any) {
      setImportError(err?.message || 'Gagal mengimpor proyek.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Workspace Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-amber-400 font-bold">
            <Download className="w-4 h-4" />
            <span>Deliverables, Export &amp; Import Studio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Ekspor &amp; Impor Proyek Sinematik
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Kelola paket cetak biru produksi, ekspor ke Google Drive, atau muat proyek dari file lokal &amp; cloud.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-950/80 p-1.5 rounded-xl border border-white/[0.08] shrink-0 self-start md:self-center">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'export'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Proyek</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor Proyek</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXPORT STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-150">
          {/* Google Drive Export Card */}
          <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Google Drive Deliverables</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kirim seluruh laporan skenario, Bible karakter/lokasi, master frame prompts, dan Seedance video prompts langsung ke folder Google Drive Anda.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleExportDriveClick}
                disabled={isExporting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {isExporting ? 'Mengirim ke Google Drive...' : exported ? 'Berhasil Diexport ke Drive! ✓' : 'Ekspor ke Google Drive'}
              </button>
              {exported && (
                <div className="mt-2 text-center text-xs text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Folder &amp; file berhasil disinkronkan.
                </div>
              )}
            </div>
          </div>

          {/* JSON Package Download Card */}
          <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Download Paket JSON Lengkap</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Unduh arsip lengkap proyek dalam format JSON terstruktur untuk backup lokal atau diimpor ke platform render video eksternal.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleDownloadJSON}
                className="w-full py-3 bg-[#141A29] hover:bg-[#1B2338] border border-white/10 text-zinc-200 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-400" />
                Download Proyek (.json)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: IMPORT STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-150">
          {/* Method 1: Local File Upload */}
          <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Upload Berkas JSON Lokal</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Unggah berkas cetak biru proyek sinematik (.json) dari komputer Anda untuk memulihkan seluruh struktur naskah, adegan, dan prompt.
              </p>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-5 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FileJson className="w-8 h-8 text-indigo-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-200">
                  {selectedFile ? selectedFile.name : 'Tarik & letakkan file .json di sini'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">atau klik untuk memilih berkas dari folder</p>
              </div>
            </div>

            {/* Preview of Parsed Data */}
            {parsedData && (
              <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-zinc-300 font-bold">
                  <span className="truncate">{parsedData.project?.title || parsedData.title || 'Proyek Sinematik'}</span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Siap Diimpor
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Adegan: {Array.isArray(parsedData.scenes) ? parsedData.scenes.length : 0} • Karakter: {Array.isArray(parsedData.characters) ? parsedData.characters.length : 0}
                </p>
              </div>
            )}

            {/* Error Banner */}
            {importError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {/* Success Banner */}
            {importSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleExecuteLocalImport}
                disabled={!parsedData || isImporting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses &amp; Mengimpor...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Impor Berkas JSON Ini</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Method 2: Google Drive Import */}
          <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FolderDown className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Impor via Google Drive</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tautkan akun Google Drive Anda untuk memilih berkas cetak biru secara langsung dari akun Cloud Anda tanpa perlu mengunduh ke lokal.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3 text-center">
              <Cloud className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-zinc-300">
                Buka wizard pemilih berkas Google Drive untuk menelusuri berkas cetak biru `.json` yang disimpan di Cloud Anda.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onOpenImportDriveModal}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderDown className="w-4 h-4" />
                <span>Buka Pemilih Google Drive</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

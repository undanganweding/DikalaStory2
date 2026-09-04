import React, { useState, useEffect } from 'react';
import {
  FolderDown,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  FileJson,
  Search,
  CloudDownload,
  Link,
  ListFilter,
} from 'lucide-react';
import {
  initDriveAuth,
  googleSignInForDrive,
  getDriveAccessToken,
  googleDriveSignOut,
  fetchDriveFileContent,
  listDriveBlueprintFiles,
} from '../lib/drive';
import { User } from 'firebase/auth';

interface GoogleDriveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedData: any) => void;
}

export const GoogleDriveImportModal: React.FC<GoogleDriveImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [driveUrlOrId, setDriveUrlOrId] = useState<string>('');
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; createdTime?: string }>>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = initDriveAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        fetchFilesList(t);
      },
      () => {
        setUser(null);
        setToken(null);
        setDriveFiles([]);
      }
    );
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchFilesList = async (activeToken: string) => {
    if (!activeToken) return;
    setIsLoadingFiles(true);
    try {
      const files = await listDriveBlueprintFiles(activeToken);
      setDriveFiles(files);
    } catch (err: any) {
      console.warn('Could not list drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await googleSignInForDrive();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        await fetchFilesList(res.accessToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal login Google Drive.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleDriveSignOut();
    setUser(null);
    setToken(null);
    setDriveFiles([]);
  };

  const executeImport = async (fileIdToUse: string) => {
    const activeToken = token || getDriveAccessToken();
    if (!activeToken) {
      setError('Silakan Masuk dengan Google terlebih dahulu untuk mengakses Google Drive.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const jsonData = await fetchDriveFileContent(fileIdToUse, activeToken);

      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      if (!response.ok) {
        const errRes = await response.json();
        throw new Error(errRes.error || 'Gagal mengimpor proyek ke database.');
      }

      const resData = await response.json();
      setSuccessMessage(`Berhasil mengimpor proyek: "${resData.project?.title || 'Proyek Sinematik'}"`);
      
      setTimeout(() => {
        onImportSuccess(resData);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengimpor proyek dari Google Drive.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Impor Proyek dari Google Drive</h3>
              <p className="text-xs text-zinc-400">Buka &amp; muat cetak biru sinematik dari akun Google Drive Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* User Auth Status */}
          {user ? (
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-zinc-700" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{user.displayName || 'Pengguna Google'}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="text-[11px] text-zinc-400 hover:text-rose-400 underline cursor-pointer shrink-0 ml-2"
              >
                Keluar Akun
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 text-center space-y-3">
              <p className="text-xs text-zinc-300">
                Masuk dengan akun Google Anda untuk membaca berkas JSON Cetak Biru Sinematik dari Google Drive.
              </p>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs shadow transition cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-700" />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>Masuk dengan Google</span>
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Option A: Link / File ID Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-amber-400" />
              Tautan atau File ID Google Drive:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://drive.google.com/file/d/.../view"
                value={driveUrlOrId}
                onChange={(e) => {
                  setDriveUrlOrId(e.target.value);
                  setSelectedFileId(null);
                }}
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={() => executeImport(driveUrlOrId)}
                disabled={!driveUrlOrId.trim() || isImporting || (!user && !token)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                <span>Impor</span>
              </button>
            </div>
          </div>

          {/* Option B: Drive Files List Picker */}
          {user && (
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-indigo-400" />
                  Pilih Berkas Blueprint di Google Drive Saya:
                </span>
                <button
                  onClick={() => token && fetchFilesList(token)}
                  className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  Segarkan
                </button>
              </div>

              {isLoadingFiles ? (
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-center text-xs text-zinc-400 animate-pulse">
                  Mencari berkas cetak biru di Drive...
                </div>
              ) : driveFiles.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {driveFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => {
                        setSelectedFileId(file.id);
                        setDriveUrlOrId(file.id);
                      }}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                        selectedFileId === file.id || driveUrlOrId === file.id
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate font-medium">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeImport(file.id);
                        }}
                        disabled={isImporting}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition shadow cursor-pointer shrink-0 ml-2"
                      >
                        Pilih &amp; Impor
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-center text-xs text-zinc-500">
                  Tidak ada berkas bertema "Blueprint_" atau JSON yang ditemukan di folder utama Drive Anda. Anda dapat memasukkan tautan langsung di atas.
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-400" />
            Keamanan terjamin. Data langsung disimpan ke workspace studio lokal Anda.
          </p>
          <button
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

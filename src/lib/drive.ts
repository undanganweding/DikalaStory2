import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let cachedAuth: ReturnType<typeof getAuth> | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

function getFirebaseAuth() {
  if (!cachedAuth) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      cachedAuth = getAuth(app);
    } catch (e) {
      console.warn('Firebase app init warning:', e);
      return null;
    }
  }
  return cachedAuth;
}

function getGoogleProvider() {
  if (!cachedProvider) {
    cachedProvider = new GoogleAuthProvider();
    cachedProvider.addScope('https://www.googleapis.com/auth/drive.file');
  }
  return cachedProvider;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      if (onAuthFailure) onAuthFailure();
      return () => {};
    }
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (err) {
    console.warn('initDriveAuth warning:', err);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

export const googleSignInForDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Konfigurasi Firebase belum siap.');
    }
    const provider = getGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token dari Google Sign-In.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error for Google Drive:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const googleDriveSignOut = async () => {
  try {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  cachedAccessToken = null;
};

export interface DriveExportResult {
  fileId: string;
  name: string;
  webViewLink?: string;
}

export async function exportProjectToDrive(
  projectData: any,
  accessToken: string
): Promise<DriveExportResult> {
  const fileName = `Blueprint_${(projectData.title || 'Cinematic_Project').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;
  const fileContent = JSON.stringify(projectData, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'AI Cinematic Production Studio - Blueprint Export',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive Export failed: ${res.statusText} (${errorText})`);
  }

  const data = await res.json();
  return {
    fileId: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
  };
}

export function extractFileIdFromDriveUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  // Match standard Google Drive file URL patterns e.g. /d/FILE_ID/view or id=FILE_ID
  const fileIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return fileIdMatch[1];
  }
  // If no URL pattern matched, assume it is already a direct File ID
  return trimmed;
}

export async function fetchDriveFileContent(fileId: string, accessToken: string): Promise<any> {
  const cleanId = extractFileIdFromDriveUrl(fileId);
  if (!cleanId) {
    throw new Error('ID atau URL berkas Google Drive tidak valid.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal mengunduh berkas dari Google Drive (${res.status}): ${errText}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Berkas yang diunduh dari Google Drive bukan format JSON yang valid.');
  }
}

export async function listDriveBlueprintFiles(accessToken: string): Promise<Array<{ id: string; name: string; createdTime?: string; size?: string; webViewLink?: string }>> {
  const query = encodeURIComponent("name contains 'Blueprint_' or mimeType = 'application/json'");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=20`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal mengambil daftar berkas dari Google Drive: ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

// Heuristic to pick a friendly filename from a URL
function pickFileNameFromUrl(url: string, fallback: string) {
  try {
    const u = new URL(url);
    const last = (u.pathname.split('/').pop() || '').trim();
    if (last) return last;
  } catch {}
  return fallback;
}

/**
 * Downloads a PDF to a temporary path, then either shares it (cross‑platform)
 * or, on Android, optionally saves it to a user‑chosen folder via SAF.
 * Returns the local file URI on success.
 */
export async function downloadPdfWithFallbacks(url: string, opts?: { fileName?: string; preferFolderSaveOnAndroid?: boolean }) {
  const clean = String(url || '').trim();
  if (!clean || !/^https?:\/\//i.test(clean)) {
    throw new Error('Invalid PDF URL');
  }
  const fileName = (opts?.fileName || pickFileNameFromUrl(clean, 'appointment-letter.pdf')).replace(/[^A-Za-z0-9._-]/g, '_');
  const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
  const tempPath = `${baseDir}${fileName}`;

  // 1) Download to cache
  const { uri: localUri, status } = await FileSystem.downloadAsync(clean, tempPath);
  if (status < 200 || status >= 300) {
    throw new Error(`Download failed (status ${status})`);
  }

  // 2) Android optional: Save to user folder via SAF (with persisted directory)
  if (Platform.OS === 'android' && opts?.preferFolderSaveOnAndroid) {
    try {
      const { StorageAccessFramework } = FileSystem as any;
      if (StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        const KEY = 'download_saf_dir';
        const saveIntoDir = async (directoryUri: string) => {
          const mime = 'application/pdf';
          const destFileUri = await StorageAccessFramework.createFileAsync(directoryUri, fileName, mime);
          const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' as any });
          await StorageAccessFramework.writeAsStringAsync(destFileUri, base64, { encoding: 'base64' as any });
          try { Alert.alert('Saved', 'Appointment Letter saved to your folder.'); } catch {}
          return true;
        };

        // 2a) Try previously selected directory (persisted)
  let dirUri: string | null = await AsyncStorage.getItem(KEY);
        let saved = false;
        if (dirUri) {
          try { saved = await saveIntoDir(dirUri); } catch { saved = false; }
        }

        // 2b) If not saved yet, prompt for directory and persist permission
        if (!saved) {
          const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (perm.granted) {
            dirUri = String(perm.directoryUri || '');
            try { if (dirUri) await AsyncStorage.setItem(KEY, dirUri); } catch {}
            if (dirUri) {
              await saveIntoDir(dirUri);
              return localUri;
            }
          }
        } else {
          return localUri;
        }
      }
    } catch {
      // Fall through to sharing if SAF fails
      // console.warn('SAF save failed', e);
    }
  }

  // 3) Share (lets user open with a PDF app or save to Drive/Files)
  try {
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Appointment Letter',
        UTI: 'com.adobe.pdf'
      } as any);
      return localUri;
    }
  } catch {
    // Ignore and fallback
  }

  // 4) Final fallback: open remote URL (browser/download manager)
  throw new Error('Share is not available. Try opening in browser from dashboard.');
}
